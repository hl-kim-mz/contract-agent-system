import difflib
import json
import os

import boto3
from strands import tool

dynamodb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-northeast-2"))
contracts_table = dynamodb.Table(os.getenv("DYNAMODB_CONTRACTS_TABLE", "cas-contracts"))


@tool
def check_risk(clause: str, contract_type: str) -> dict:
    """MZC 기준 프롬프트 기반으로 조항별 리스크를 탐지한다.

    Args:
        clause: 분석 대상 조항 텍스트
        contract_type: 계약 유형 (SI, NDA, MSA 등)
    Returns:
        리스크 분석 결과 (risk_level, risk_type, reason, recommendation, financial_impact)
    """
    pass  # LLM이 실제 분석 수행


@tool
def diff_clauses(contract_id: str, current_version: int) -> dict:
    """이전 버전과 현재 버전의 조항을 비교하여 변경점을 추출한다.

    Args:
        contract_id: 계약서 고유 ID
        current_version: 현재 버전 번호
    Returns:
        Diff Report (변경된 조항 목록 + 리스크 영향 요약)
    """
    prev_resp = contracts_table.get_item(Key={"id": f"{contract_id}-v{current_version - 1}"})
    curr_resp = contracts_table.get_item(Key={"id": f"{contract_id}-v{current_version}"})

    prev_item = prev_resp.get("Item")
    curr_item = curr_resp.get("Item")
    if not prev_item or not curr_item:
        return {"error": "이전 버전을 찾을 수 없습니다"}

    old_clauses = json.loads(prev_item.get("clauses_json", "[]"))
    new_clauses = json.loads(curr_item.get("clauses_json", "[]"))

    diffs = []
    for old_c, new_c in zip(old_clauses, new_clauses):
        if old_c["content"] != new_c["content"]:
            matcher = difflib.SequenceMatcher(None, old_c["content"], new_c["content"])
            diffs.append({
                "clause_id": new_c["id"],
                "title": new_c["title"],
                "ratio": str(matcher.ratio()),
                "old_content": old_c["content"],
                "new_content": new_c["content"],
            })

    return {"diffs": diffs, "total_changes": len(diffs)}


@tool
def analyze_financials(financials: dict, contract_type: str) -> dict:
    """계약금액·지체상금·하자보수 등 재무 리스크를 분석한다.

    Args:
        financials: 계약서 financials 섹션 (total_amount, penalty_clause 등)
        contract_type: 계약 유형
    Returns:
        재무 리스크 분석 결과
    """
    pass  # LLM이 실제 분석 수행
