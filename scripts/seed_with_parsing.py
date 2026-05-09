"""
ParsingAgent를 통해 raw parsed JSON → Contract JSON 변환 후
S3 업로드 + DynamoDB cas-contracts 시딩
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import boto3
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# sys.path에 프로젝트 루트 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.parsing_agent import parsing_agent

BUCKET = os.getenv("S3_BUCKET_NAME", "cas-contracts-megathon-26743")
REGION = os.getenv("AWS_REGION", "ap-northeast-2")
CONTRACTS_TABLE = os.getenv("DYNAMODB_CONTRACTS_TABLE", "cas-contracts")

s3  = boto3.client("s3", region_name=REGION)
ddb = boto3.resource("dynamodb", region_name=REGION)
contracts_table = ddb.Table(CONTRACTS_TABLE)

# 파일명 → (customer_name, contract_id, version, contract_type)
FILE_MAP = {
    "SI_비즈솔루션코리아_v1.json":        ("비즈솔루션코리아", "contract-001", 1, "SI"),
    "NDA_에이원테크놀로지_v1.json":       ("에이원테크놀로지",  "contract-002", 1, "NDA"),
    "NDA_에이원테크놀로지_v2.json":       ("에이원테크놀로지",  "contract-002", 2, "NDA"),
}

PARSED_DIR = Path(__file__).parent.parent / "samples" / "parsed" / "contracts"


def run_parsing_agent(raw: dict) -> dict:
    """ParsingAgent로 Contract JSON 변환"""
    filename = raw.get("source_file", "")
    text = raw.get("text", "")
    prompt = f"[파일명]: {filename}\n\n[원문 텍스트]:\n{text}"
    response = parsing_agent(prompt)
    raw_str = str(response)
    # JSON 블록 추출
    start = raw_str.find("{")
    end   = raw_str.rfind("}") + 1
    return json.loads(raw_str[start:end])


def upload_to_s3(contract_json: dict, customer: str, contract_id: str, version: int) -> str:
    s3_key = f"{customer}/{contract_id}/v{version}.json"
    s3.put_object(
        Bucket=BUCKET,
        Key=s3_key,
        Body=json.dumps(contract_json, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    print(f"  S3 업로드: s3://{BUCKET}/{s3_key}")
    return s3_key


def to_decimal(obj):
    """float → Decimal 재귀 변환 (DynamoDB 요구사항)"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(i) for i in obj]
    return obj


def seed_dynamodb(contract_json: dict, contract_id: str, version: int,
                  customer: str, s3_key: str):
    item = to_decimal({
        "id": f"{contract_id}-v{version}",
        "customer_name": customer,
        "contract_type": contract_json.get("contract_type", "Other"),
        "version": version,
        "status": "RISK_REVIEWED" if version == 1 else "DRAFT",
        "is_standard": contract_json.get("is_standard", False),
        "s3_key": s3_key,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": "seed_script",
        "parties": contract_json.get("parties"),
        "dates": contract_json.get("dates"),
        "financials": contract_json.get("financials"),
        "clauses_json": json.dumps(contract_json.get("clauses", []), ensure_ascii=False),
    })
    contracts_table.put_item(Item=item)
    print(f"  DynamoDB 시딩: {item['id']}")


def main():
    for filename, (customer, contract_id, version, _) in FILE_MAP.items():
        raw_path = PARSED_DIR / filename
        if not raw_path.exists():
            print(f"[SKIP] {filename} — 파일 없음")
            continue

        print(f"\n[{filename}] 처리 중...")
        raw = json.loads(raw_path.read_text(encoding="utf-8"))

        print("  ParsingAgent 호출 중...")
        contract_json = run_parsing_agent(raw)
        print(f"  → contract_type: {contract_json.get('contract_type')}, clauses: {len(contract_json.get('clauses', []))}개")

        s3_key = upload_to_s3(contract_json, customer, contract_id, version)
        seed_dynamodb(contract_json, contract_id, version, customer, s3_key)

    print("\n✅ 완료")


if __name__ == "__main__":
    main()
