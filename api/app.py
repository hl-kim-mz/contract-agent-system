import json
import os
import re
import uuid
import logging

from dotenv import load_dotenv
load_dotenv()
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import boto3
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tools.clause_extractor import extract_clauses, extract_entities
from tools.document_loader import load_docx
from tools.mock_workflow import route_workflow
from tools.risk_patterns import get_overall_risk

logger = logging.getLogger(__name__)

app = FastAPI(title="CAS — Contract Analysis System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_region = os.getenv("AWS_REGION", "ap-northeast-2")
_ddb = boto3.resource("dynamodb", region_name=_region)
_contracts_table  = _ddb.Table(os.getenv("DYNAMODB_CONTRACTS_TABLE",  "cas-contracts"))
_reports_table    = _ddb.Table(os.getenv("DYNAMODB_RISK_REPORTS_TABLE","cas-risk-reports"))
_workflow_table   = _ddb.Table(os.getenv("DYNAMODB_WORKFLOW_TABLE",    "cas-workflow-steps"))
_comments_table   = _ddb.Table(os.getenv("DYNAMODB_COMMENTS_TABLE",   "cas-comments"))
_prompts_table    = _ddb.Table(os.getenv("DYNAMODB_PROMPTS_TABLE",    "cas-prompt-templates"))
_s3 = boto3.client("s3", region_name=_region)
_bucket = os.getenv("S3_BUCKET_NAME", "")


def _extract_json(text: str) -> dict:
    """Extract JSON from agent output with fallback strategies."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Failed to extract JSON from agent output")


def _decimal_to_native(obj):
    """Convert DynamoDB Decimal types to Python int/float."""
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    if isinstance(obj, dict):
        return {k: _decimal_to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_decimal_to_native(i) for i in obj]
    return obj


# ═══════════════════════════════════════════════════════════════
# Health
# ═══════════════════════════════════════════════════════════════
@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ═══════════════════════════════════════════════════════════════
# Contracts
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts")
def list_contracts():
    resp = _contracts_table.scan(Limit=100)
    items = sorted(
        resp.get("Items", []),
        key=lambda x: x.get("uploaded_at", ""),
        reverse=True,
    )
    return {"success": True, "data": _decimal_to_native(items), "count": len(items)}


@app.get("/contracts/{contract_id}")
def get_contract(contract_id: str):
    resp = _contracts_table.get_item(Key={"id": contract_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")
    return {"success": True, "data": _decimal_to_native(item)}


@app.post("/contracts/analyze")
async def analyze_contract(
    file: UploadFile = File(...),
    customer_name: str = Form("Unknown"),
    contract_type: str = Form("Other"),
    uploaded_by: str = Form("demo_user"),
):
    """DOCX 업로드 → AI 파싱 → 리스크 분석 → 법무 검토 → DynamoDB 저장"""
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="DOCX 파일만 지원합니다")

    contract_id = str(uuid.uuid4())
    content = await file.read()
    now = datetime.now(timezone.utc).isoformat()

    # ── S3 업로드 ──
    s3_key = f"{customer_name}/{contract_id}/v1/{file.filename}"
    if _bucket:
        _s3.put_object(Bucket=_bucket, Key=s3_key, Body=content)

    # ── DOCX 파싱 (코드 기반) ──
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    doc = load_docx(tmp_path)
    clauses = extract_clauses(doc["text"])
    entities = extract_entities(doc["text"])

    # ── 초기 contract 저장 (status=PARSING) ──
    contract_data = {
        "id": contract_id,
        "customer_name": customer_name,
        "contract_type": contract_type,
        "file_name": file.filename,
        "version": 1,
        "status": "PARSING",
        "s3_key": s3_key,
        "entities": entities,
        "clauses": clauses,
        "uploaded_at": now,
        "uploaded_by": uploaded_by,
        "parsed_at": now,
    }
    _contracts_table.put_item(Item=contract_data)

    # ── AI Agent Pipeline ──
    contract_json = None
    risk_data = None
    legal_data = None

    # Step 1: ParsingAgent
    try:
        from agents.parsing_agent import parsing_agent
        parsing_input = (
            f"다음 계약서를 분석하세요:\n\n"
            f"원문:\n{doc['text'][:3000]}\n\n"
            f"추출된 조항:\n{json.dumps(clauses, ensure_ascii=False)}\n\n"
            f"엔티티:\n{json.dumps(entities, ensure_ascii=False)}"
        )
        parsing_result = parsing_agent(parsing_input)
        contract_json = _extract_json(str(parsing_result))
        logger.info("ParsingAgent completed: %s", contract_json.get("contract_type"))
    except Exception as e:
        logger.warning("ParsingAgent failed, using clause_extractor fallback: %s", e)

    # Step 2: RiskAgent
    try:
        from agents.risk_agent import risk_agent
        analysis_input = contract_json or {"clauses": clauses, "entities": entities}
        risk_input = f"다음 계약서의 리스크를 분석하세요:\n\n{json.dumps(analysis_input, ensure_ascii=False)}"
        risk_result = risk_agent(risk_input)
        risk_data = _extract_json(str(risk_result))
        logger.info("RiskAgent completed: overall_risk=%s", risk_data.get("overall_risk"))
    except Exception as e:
        logger.warning("RiskAgent failed: %s", e)
        risk_data = {
            "overall_risk": "MEDIUM",
            "risk_summary": "AI 분석 실패 — 기본 리스크 수준 적용",
            "clause_risks": [],
            "key_concerns": [],
            "escalation_required": False,
        }

    # Step 3: LegalReviewAgent
    try:
        from agents.legal_review_agent import legal_review_agent
        legal_input = f"다음 리스크 리포트를 검토하세요:\n\n{json.dumps(risk_data, ensure_ascii=False)}"
        legal_result = legal_review_agent(legal_input)
        legal_data = _extract_json(str(legal_result))
        logger.info("LegalReviewAgent completed: %s", legal_data.get("recommendation"))
    except Exception as e:
        logger.warning("LegalReviewAgent failed: %s", e)

    # ── 결과 계산 ──
    overall_risk = risk_data.get("overall_risk", get_overall_risk(risk_data.get("clause_risks", [])))

    # ── Risk Report → DynamoDB ──
    report_id = str(uuid.uuid4())
    risk_report_item = {
        "id": report_id,
        "contract_id": contract_id,
        "overall_risk": overall_risk,
        "is_standard_contract": (contract_json or {}).get("is_standard", False),
        "risk_summary": risk_data.get("risk_summary", ""),
        "clause_risks_json": json.dumps(risk_data.get("clause_risks", []), ensure_ascii=False),
        "key_concerns_json": json.dumps(risk_data.get("key_concerns", []), ensure_ascii=False),
        "standard_deviation": risk_data.get("standard_deviation"),
        "escalation_required": risk_data.get("escalation_required", False),
        "created_at": now,
    }
    if legal_data:
        risk_report_item["legal_review"] = json.dumps(legal_data, ensure_ascii=False)
    _reports_table.put_item(Item=risk_report_item)

    # ── Workflow Steps → DynamoDB ──
    wf_input_contract = dict(contract_data)
    if contract_json and "financials" in contract_json:
        wf_input_contract["financials"] = contract_json["financials"]
    workflow_steps = route_workflow(
        {"overall_risk": overall_risk, "clause_risks": risk_data.get("clause_risks", [])},
        wf_input_contract,
    )
    saved_steps = []
    for step in workflow_steps:
        step_id = str(uuid.uuid4())
        step_item = {
            "id": step_id,
            "contract_id": contract_id,
            "step_order": step["step_order"],
            "department": step["department"],
            "role": step["department"],
            "status": "PENDING",
            "comment": None,
            "signed_at": None,
            "is_parallel": step.get("parallel", False),
        }
        _workflow_table.put_item(Item=step_item)
        saved_steps.append(step_item)

    # ── Contract 업데이트 (status=RISK_REVIEWED) ──
    update_expr_parts = [
        "#st = :st", "overall_risk = :or_val", "is_standard = :is_std", "analyzed_at = :aa"
    ]
    expr_names = {"#st": "status"}
    expr_values = {
        ":st": "RISK_REVIEWED",
        ":or_val": overall_risk,
        ":is_std": (contract_json or {}).get("is_standard", False),
        ":aa": now,
    }
    if contract_json and "parties" in contract_json:
        update_expr_parts.append("parties = :parties")
        expr_values[":parties"] = contract_json["parties"]
    if contract_json and "dates" in contract_json:
        update_expr_parts.append("dates = :dates")
        expr_values[":dates"] = contract_json["dates"]

    _contracts_table.update_item(
        Key={"id": contract_id},
        UpdateExpression="SET " + ", ".join(update_expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )

    return {
        "success": True,
        "data": {
            "contract_id": contract_id,
            "status": "RISK_REVIEWED",
            "parsed": {
                "paragraph_count": doc["paragraph_count"],
                "clause_count": len(clauses),
                "entities": entities,
            },
            "risk_report": {
                "id": report_id,
                "overall_risk": overall_risk,
                "clause_risks_count": len(risk_data.get("clause_risks", [])),
            },
            "workflow_steps": saved_steps,
            "legal_review": legal_data,
        },
    }


# ═══════════════════════════════════════════════════════════════
# Contract Text
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/text")
def get_contract_text(contract_id: str):
    resp = _contracts_table.get_item(Key={"id": contract_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")

    clauses = item.get("clauses", [])
    entities = item.get("entities", {})

    risk_resp = _reports_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
        Limit=1,
        ScanIndexForward=False,
    )
    clause_risks = {}
    risk_items = risk_resp.get("Items", [])
    if risk_items:
        risks_json = risk_items[0].get("clause_risks_json", "[]")
        try:
            risks_list = json.loads(risks_json) if isinstance(risks_json, str) else risks_json
            clause_risks = {r.get("clause_id", ""): r for r in risks_list}
        except (json.JSONDecodeError, TypeError):
            pass

    clause_items = []
    for i, c in enumerate(clauses):
        clause_id = c.get("id", f"clause_{i+1:03d}")
        risk_info = clause_risks.get(clause_id, {})
        clause_items.append({
            "id": clause_id,
            "type": c.get("type", c.get("category", "")),
            "title": c.get("title", f"제{i+1}조"),
            "content": c.get("body", c.get("content", "")),
            "paragraph": c.get("index", i + 1),
            "has_risk": bool(risk_info),
            "risk_level": risk_info.get("risk_level"),
        })

    raw_text = " ".join(c.get("body", c.get("content", "")) for c in clauses)

    parties = entities.get("parties", [])
    amounts = entities.get("amounts", [])
    dates = entities.get("dates", [])

    return {
        "success": True,
        "data": _decimal_to_native({
            "contract_id": contract_id,
            "file_name": item.get("file_name", ""),
            "customer_name": item.get("customer_name", ""),
            "contract_type": item.get("contract_type", ""),
            "raw_text_preview": raw_text[:500],
            "clauses": clause_items,
            "entities": {
                "party_a": entities.get("party_a", parties[0] if parties else None),
                "party_b": entities.get("party_b", parties[1] if len(parties) > 1 else None),
                "contract_date": entities.get("contract_date", dates[0] if dates else None),
                "total_amount": entities.get("total_amount", amounts[0] if amounts else None),
                "contract_period": entities.get("contract_period"),
            },
        }),
    }


# ═══════════════════════════════════════════════════════════════
# Analysis Progress
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/progress")
def get_contract_progress(contract_id: str):
    resp = _contracts_table.get_item(Key={"id": contract_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")

    status = item.get("status", "DRAFT")
    status_map = {
        "DRAFT":            (0,   "DRAFT"),
        "PARSING":          (30,  "PARSING"),
        "RISK_REVIEWED":    (80,  "RISK_REVIEWED"),
        "PENDING_APPROVAL": (100, "PENDING_APPROVAL"),
        "APPROVED":         (100, "APPROVED"),
        "REJECTED":         (100, "REJECTED"),
        "ANALYSIS_FAILED":  (0,   "ERROR"),
    }
    progress_percent, overall_status = status_map.get(status, (0, status))

    parsed_at = item.get("parsed_at")
    analyzed_at = item.get("analyzed_at")
    clause_count = len(item.get("clauses", []))

    steps = [
        {"id": "upload", "label": "파일 업로드", "status": "done",
         "detail": None, "completed_at": item.get("uploaded_at")},
        {"id": "parse", "label": "문서 파싱",
         "status": "done" if status != "DRAFT" else "pending",
         "detail": f"{clause_count}개 조항 추출" if parsed_at else None,
         "completed_at": parsed_at},
        {"id": "risk", "label": "리스크 분석",
         "status": "done" if status in ("RISK_REVIEWED", "PENDING_APPROVAL", "APPROVED", "REJECTED") else ("active" if status == "PARSING" else "pending"),
         "detail": "분석 완료" if analyzed_at else ("분석 중..." if status == "PARSING" else None),
         "completed_at": analyzed_at},
        {"id": "legal", "label": "법무 검토",
         "status": "done" if status in ("RISK_REVIEWED", "PENDING_APPROVAL", "APPROVED", "REJECTED") else "pending",
         "detail": None, "completed_at": analyzed_at},
        {"id": "workflow", "label": "결재 라우팅",
         "status": "done" if status in ("PENDING_APPROVAL", "APPROVED", "REJECTED") else "pending",
         "detail": None,
         "completed_at": analyzed_at if status in ("PENDING_APPROVAL", "APPROVED", "REJECTED") else None},
    ]

    return {
        "success": True,
        "data": {
            "contract_id": contract_id,
            "overall_status": overall_status,
            "progress_percent": progress_percent,
            "steps": steps,
            "estimated_remaining_sec": 30 if status == "PARSING" else None,
        },
    }


# ═══════════════════════════════════════════════════════════════
# Diff
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/diff")
def get_diff(contract_id: str):
    resp = _contracts_table.get_item(Key={"id": contract_id})
    current = resp.get("Item")
    if not current:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")

    current_version = int(current.get("version", 1))
    if current_version <= 1:
        return {"success": True, "data": None}

    scan_resp = _contracts_table.scan(
        FilterExpression="customer_name = :cn AND contract_type = :ct AND #v = :pv",
        ExpressionAttributeNames={"#v": "version"},
        ExpressionAttributeValues={
            ":cn": current.get("customer_name"),
            ":ct": current.get("contract_type"),
            ":pv": current_version - 1,
        },
    )
    prev_items = scan_resp.get("Items", [])
    if not prev_items:
        return {"success": True, "data": None}

    previous = prev_items[0]
    current_clauses = {str(c["index"]): c for c in current.get("clauses", [])}
    previous_clauses = {str(c["index"]): c for c in previous.get("clauses", [])}

    changes = []
    for cid, c in current_clauses.items():
        if cid not in previous_clauses:
            changes.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "ADDED", "previous_content": None,
                "current_content": c.get("body", ""),
                "risk_impact": None, "highlight": None,
            })
        elif c.get("body") != previous_clauses[cid].get("body"):
            changes.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "MODIFIED",
                "previous_content": previous_clauses[cid].get("body", ""),
                "current_content": c.get("body", ""),
                "risk_impact": None, "highlight": None,
            })
    for cid, c in previous_clauses.items():
        if cid not in current_clauses:
            changes.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "REMOVED",
                "previous_content": c.get("body", ""),
                "current_content": "",
                "risk_impact": None, "highlight": None,
            })

    added = sum(1 for ch in changes if ch["change_type"] == "ADDED")
    removed = sum(1 for ch in changes if ch["change_type"] == "REMOVED")
    modified = sum(1 for ch in changes if ch["change_type"] == "MODIFIED")

    return {
        "success": True,
        "data": {
            "contract_id": contract_id,
            "from_version": current_version - 1,
            "to_version": current_version,
            "diff_summary": f"조항 추가 {added}건, 삭제 {removed}건, 수정 {modified}건이 감지되었습니다.",
            "risk_change": "",
            "changes": changes,
        },
    }


# ═══════════════════════════════════════════════════════════════
# Risk Reports
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/report")
def get_risk_report(contract_id: str):
    resp = _reports_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
        Limit=1,
        ScanIndexForward=False,
    )
    items = resp.get("Items", [])
    if not items:
        raise HTTPException(status_code=404, detail="리스크 리포트가 없습니다")

    report = dict(items[0])
    if "clause_risks_json" in report:
        try:
            report["clause_risks"] = json.loads(report.pop("clause_risks_json"))
        except (json.JSONDecodeError, TypeError):
            report["clause_risks"] = []
            report.pop("clause_risks_json", None)
    if "key_concerns_json" in report:
        try:
            report["key_concerns"] = json.loads(report.pop("key_concerns_json"))
        except (json.JSONDecodeError, TypeError):
            report["key_concerns"] = []
            report.pop("key_concerns_json", None)
    if "legal_review" in report and isinstance(report["legal_review"], str):
        try:
            report["legal_review"] = json.loads(report["legal_review"])
        except (json.JSONDecodeError, TypeError):
            pass

    return {"success": True, "data": _decimal_to_native(report)}


# ═══════════════════════════════════════════════════════════════
# Workflow
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/workflow")
def get_workflow(contract_id: str):
    resp = _workflow_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
    )
    steps = sorted(resp.get("Items", []), key=lambda x: int(x.get("step_order", 0)))
    return {"success": True, "data": _decimal_to_native(steps)}


class WorkflowAction(BaseModel):
    comment: Optional[str] = None
    status: str


@app.post("/workflow/{step_id}/approve")
def approve_step(step_id: str, body: WorkflowAction):
    now = datetime.now(timezone.utc).isoformat()
    _workflow_table.update_item(
        Key={"id": step_id},
        UpdateExpression="SET #s = :s, comment = :c, signed_at = :t",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":s": body.status,
            ":c": body.comment or "",
            ":t": now,
        },
    )
    resp = _workflow_table.get_item(Key={"id": step_id})
    return {"success": True, "data": _decimal_to_native(resp.get("Item"))}


# ═══════════════════════════════════════════════════════════════
# Comments
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/comments")
def get_comments(contract_id: str):
    resp = _comments_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
    )
    comments = sorted(resp.get("Items", []), key=lambda x: x.get("created_at", ""))
    return {"success": True, "data": _decimal_to_native(comments)}


class CommentCreate(BaseModel):
    content: str
    mentions: list[str] = []
    parent_id: Optional[str] = None
    clause_ref: Optional[str] = None
    author_id: str = "usr_001"
    author_name: str = "김영업"
    author_department: str = "영업팀"


@app.post("/contracts/{contract_id}/comments")
def create_comment(contract_id: str, body: CommentCreate):
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": comment_id,
        "contract_id": contract_id,
        "content": body.content,
        "mentions": body.mentions,
        "parent_id": body.parent_id,
        "clause_ref": body.clause_ref,
        "author": {
            "id": body.author_id,
            "name": body.author_name,
            "department": body.author_department,
        },
        "created_at": now,
        "updated_at": None,
    }
    _comments_table.put_item(Item=item)
    return {"success": True, "data": item}


@app.delete("/contracts/{contract_id}/comments/{comment_id}")
def delete_comment(contract_id: str, comment_id: str):
    _comments_table.delete_item(Key={"id": comment_id})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# Prompt Templates
# ═══════════════════════════════════════════════════════════════
@app.get("/prompts")
def list_prompts():
    resp = _prompts_table.scan()
    return {"success": True, "data": _decimal_to_native(resp.get("Items", []))}


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: str):
    resp = _prompts_table.get_item(Key={"id": prompt_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="프롬프트를 찾을 수 없습니다")
    return {"success": True, "data": _decimal_to_native(item)}


class PromptUpdate(BaseModel):
    prompt_name: str
    system_prompt: str
    contract_type: Optional[str] = None


@app.put("/prompts/{prompt_id}")
def update_prompt(prompt_id: str, body: PromptUpdate):
    now = datetime.now(timezone.utc).isoformat()
    _prompts_table.update_item(
        Key={"id": prompt_id},
        UpdateExpression="SET prompt_name = :n, system_prompt = :p, contract_type = :t, updated_at = :u",
        ExpressionAttributeValues={
            ":n": body.prompt_name,
            ":p": body.system_prompt,
            ":t": body.contract_type,
            ":u": now,
        },
    )
    resp = _prompts_table.get_item(Key={"id": prompt_id})
    return {"success": True, "data": _decimal_to_native(resp.get("Item"))}


@app.post("/prompts")
def create_prompt(body: PromptUpdate):
    prompt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": prompt_id,
        "prompt_name": body.prompt_name,
        "system_prompt": body.system_prompt,
        "contract_type": body.contract_type,
        "updated_at": now,
        "updated_by": "demo_user",
    }
    _prompts_table.put_item(Item=item)
    return {"success": True, "data": item}


# ═══════════════════════════════════════════════════════════════
# Search (RAG — Bedrock KB)
# ═══════════════════════════════════════════════════════════════
_COMPLIANCE_KEYWORDS = {"규정", "컴플라이언스", "사내 기준", "사내기준", "내규", "준수", "compliance"}


@app.get("/search")
def search_contracts(query: str, customer: Optional[str] = None):
    """계약 히스토리 자연어 검색 (Bedrock KB + MCP SQLite 컴플라이언스)"""
    use_orchestrator = any(kw in query for kw in _COMPLIANCE_KEYWORDS)

    try:
        if use_orchestrator:
            from agents.orchestrator import create_orchestrator
            try:
                orchestrator = create_orchestrator()
                result = orchestrator(query)
            except Exception:
                from agents.orchestrator import create_orchestrator_simple
                orchestrator = create_orchestrator_simple()
                result = orchestrator(query)
        else:
            from agents.search_agent import search_agent
            search_input = f"다음 검색어로 과거 계약을 검색하세요: {query}"
            if customer:
                search_input += f"\n고객사 필터: {customer}"
            result = search_agent(search_input)

        result_text = str(result)

        try:
            data = _extract_json(result_text)
            return {"success": True, "data": data}
        except (ValueError, json.JSONDecodeError):
            return {
                "success": True,
                "data": {"answer": result_text, "sources": []},
            }
    except Exception as e:
        logger.warning("Search failed: %s", e)
        return {
            "success": True,
            "data": {
                "answer": f"검색 중 오류가 발생했습니다: {str(e)}",
                "sources": [],
            },
        }
