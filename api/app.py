import os
import uuid
import tempfile
from datetime import datetime, timezone
from typing import Optional

import boto3
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tools.clause_extractor import extract_clauses, extract_entities
from tools.document_loader import load_docx
from tools.mock_workflow import route_workflow

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
    """계약서 목록 조회 (최대 100건, 최신순)"""
    resp = _contracts_table.scan(Limit=100)
    items = sorted(
        resp.get("Items", []),
        key=lambda x: x.get("uploaded_at", ""),
        reverse=True,
    )
    return {"success": True, "data": items, "count": len(items)}


@app.get("/contracts/{contract_id}")
def get_contract(contract_id: str):
    """계약서 상세 조회"""
    resp = _contracts_table.get_item(Key={"id": contract_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")
    return {"success": True, "data": item}


@app.post("/contracts/analyze")
async def analyze_contract(
    file: UploadFile = File(...),
    customer_name: str = "Unknown",
    contract_type: str = "Other",
    uploaded_by: str = "demo_user",
):
    """DOCX 업로드 → 파싱 → 리스크 분석 → DynamoDB 저장"""
    if not (file.filename.endswith(".docx") or file.filename.endswith(".pdf")):
        raise HTTPException(status_code=400, detail="DOCX 또는 PDF 파일만 지원합니다")

    contract_id = str(uuid.uuid4())
    content = await file.read()

    # S3 업로드
    s3_key = f"{customer_name}/{contract_id}/v1/{file.filename}"
    if _bucket:
        _s3.put_object(Bucket=_bucket, Key=s3_key, Body=content)

    # DOCX 파싱
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    doc = load_docx(tmp_path)
    clauses = extract_clauses(doc["text"])
    entities = extract_entities(doc["text"])

    now = datetime.now(timezone.utc).isoformat()
    contract_data = {
        "id": contract_id,
        "customer_name": customer_name,
        "contract_type": contract_type,
        "file_name": file.filename,
        "version": 1,
        "status": "RISK_REVIEWED",
        "s3_key": s3_key,
        "entities": entities,
        "clauses": clauses,
        "uploaded_at": now,
        "uploaded_by": uploaded_by,
        "parsed_at": now,
    }
    _contracts_table.put_item(Item=contract_data)

    risk_report = {"overall_risk": "MEDIUM", "clause_risks": []}
    workflow_steps = route_workflow(risk_report, contract_data)

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
            "workflow_steps": workflow_steps,
        },
    }


# ═══════════════════════════════════════════════════════════════
# Risk Reports
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/report")
def get_risk_report(contract_id: str):
    """리스크 리포트 조회"""
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
    return {"success": True, "data": items[0]}


# ═══════════════════════════════════════════════════════════════
# Workflow
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/workflow")
def get_workflow(contract_id: str):
    """워크플로우 단계 목록 조회"""
    resp = _workflow_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
    )
    steps = sorted(resp.get("Items", []), key=lambda x: int(x.get("step_order", 0)))
    return {"success": True, "data": steps}


class WorkflowAction(BaseModel):
    comment: Optional[str] = None
    status: str  # APPROVED | REJECTED


@app.post("/workflow/{step_id}/approve")
def approve_step(step_id: str, body: WorkflowAction):
    """워크플로우 단계 승인/반려"""
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
    return {"success": True, "data": resp.get("Item")}


# ═══════════════════════════════════════════════════════════════
# Comments — @멘션 포함 계약서별 댓글
# ═══════════════════════════════════════════════════════════════
@app.get("/contracts/{contract_id}/comments")
def get_comments(contract_id: str):
    """계약서 댓글 목록 조회 (오래된 순)"""
    resp = _comments_table.query(
        IndexName="contract_id-index",
        KeyConditionExpression="contract_id = :cid",
        ExpressionAttributeValues={":cid": contract_id},
    )
    comments = sorted(resp.get("Items", []), key=lambda x: x.get("created_at", ""))
    return {"success": True, "data": comments}


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
    """댓글 작성"""
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
    """댓글 삭제"""
    _comments_table.delete_item(Key={"id": comment_id})
    return {"success": True}


# ═══════════════════════════════════════════════════════════════
# Prompt Templates
# ═══════════════════════════════════════════════════════════════
@app.get("/prompts")
def list_prompts():
    """프롬프트 템플릿 목록"""
    resp = _prompts_table.scan()
    return {"success": True, "data": resp.get("Items", [])}


@app.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: str):
    resp = _prompts_table.get_item(Key={"id": prompt_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="프롬프트를 찾을 수 없습니다")
    return {"success": True, "data": item}


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
    return {"success": True, "data": resp.get("Item")}


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
# Search (RAG)
# ═══════════════════════════════════════════════════════════════
@app.get("/search")
def search_contracts(query: str, customer: Optional[str] = None):
    """계약 히스토리 자연어 검색 (Bedrock KB 연동 예정)"""
    # TODO: Bedrock Knowledge Bases retrieve_and_generate 연동
    # 현재는 Mock 응답 반환
    return {
        "success": True,
        "data": {
            "answer": f"'{query}'에 대한 검색 결과입니다. (Bedrock KB 연동 후 실제 결과 제공 예정)",
            "sources": [],
        },
    }
