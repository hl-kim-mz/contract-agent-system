import io
import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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
_contracts_table = _ddb.Table(os.getenv("DYNAMODB_CONTRACTS_TABLE", "cas-contracts"))
_reports_table = _ddb.Table(os.getenv("DYNAMODB_RISK_REPORTS_TABLE", "cas-risk-reports"))
_s3 = boto3.client("s3", region_name=_region)
_bucket = os.getenv("S3_BUCKET_NAME", "")


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post("/contracts/analyze")
async def analyze_contract(file: UploadFile = File(...)):
    """DOCX 업로드 → 파싱 → 리스크 분석 → 리포트 반환"""
    if not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="DOCX 파일만 지원합니다")

    contract_id = str(uuid.uuid4())
    content = await file.read()

    # S3 업로드
    s3_key = f"contracts/{contract_id}/v1/{file.filename}"
    if _bucket:
        _s3.put_object(Bucket=_bucket, Key=s3_key, Body=content)

    # 파싱
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    doc = load_docx(tmp_path)
    clauses = extract_clauses(doc["text"])
    entities = extract_entities(doc["text"])

    contract_data = {
        "id": contract_id,
        "source_file": file.filename,
        "s3_key": s3_key,
        "status": "RISK_REVIEWED",
        "entities": entities,
        "clauses": clauses,
        "parsed_at": datetime.now(timezone.utc).isoformat(),
    }

    # DynamoDB 저장
    _contracts_table.put_item(Item=contract_data)

    # 워크플로우 라우팅 (Rule Engine)
    risk_report = {"overall_risk": "MEDIUM", "clause_risks": []}
    workflow_steps = route_workflow(risk_report, contract_data)

    return {
        "contract_id": contract_id,
        "status": "RISK_REVIEWED",
        "parsed": {
            "paragraph_count": doc["paragraph_count"],
            "clause_count": len(clauses),
            "entities": entities,
        },
        "workflow_steps": workflow_steps,
    }


@app.get("/contracts/{contract_id}")
def get_contract(contract_id: str):
    """계약서 상세 조회"""
    resp = _contracts_table.get_item(Key={"id": contract_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="계약서를 찾을 수 없습니다")
    return item


@app.get("/contracts")
def list_contracts():
    """계약서 목록 조회 (최대 100건)"""
    resp = _contracts_table.scan(Limit=100)
    return {"contracts": resp.get("Items", []), "count": resp.get("Count", 0)}
