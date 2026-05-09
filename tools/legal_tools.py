import json
import os
import boto3
from strands import tool


@tool
def check_risk(contract_json: str, system_prompt: str) -> str:
    """MZC 기준 프롬프트 기반으로 계약서 조항별 리스크를 탐지한다.

    Args:
        contract_json: 파싱된 계약서 JSON 문자열
        system_prompt: 계약 유형별 커스텀 시스템 프롬프트
    Returns:
        Risk Report JSON 문자열
    """
    return json.dumps({
        "status": "delegated_to_llm",
        "contract_json": contract_json,
        "system_prompt": system_prompt,
    })


@tool
def diff_with_previous(contract_id: str, current_version: int) -> str:
    """이전 버전 계약서와 현재 버전을 비교하여 변경점을 추출한다.

    Args:
        contract_id: 계약서 고유 ID
        current_version: 현재 버전 번호
    Returns:
        Diff Report JSON (변경된 조항 목록 + 리스크 영향 요약)
    """
    ddb = boto3.resource("dynamodb", region_name=os.getenv("AWS_REGION", "ap-northeast-2"))
    table = ddb.Table(os.getenv("DYNAMODB_CONTRACTS_TABLE", "cas-contracts"))

    current = table.get_item(Key={"id": f"{contract_id}_v{current_version}"}).get("Item")
    previous = table.get_item(Key={"id": f"{contract_id}_v{current_version - 1}"}).get("Item")

    if not current or not previous:
        return json.dumps({"error": "version not found", "contract_id": contract_id})

    import difflib
    current_clauses = json.dumps(current.get("clauses", []), ensure_ascii=False)
    previous_clauses = json.dumps(previous.get("clauses", []), ensure_ascii=False)
    diff = list(difflib.unified_diff(
        previous_clauses.splitlines(),
        current_clauses.splitlines(),
        lineterm="",
    ))

    return json.dumps({
        "contract_id": contract_id,
        "from_version": current_version - 1,
        "to_version": current_version,
        "diff": diff,
    }, ensure_ascii=False)


@tool
def analyze_financials(contract_json: str) -> str:
    """계약금액, 지체상금, 하자보수 등 재무 관련 리스크를 분석한다.

    Args:
        contract_json: 파싱된 계약서 JSON 문자열
    Returns:
        Financial Risk Analysis JSON
    """
    return json.dumps({
        "status": "delegated_to_llm",
        "contract_json": contract_json,
    })
