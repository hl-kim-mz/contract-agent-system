import difflib
import json
import os

import boto3
from strands import tool

from tools.risk_patterns import RISK_PATTERNS, RISK_LEVEL_PRIORITY

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
    clause_lower = clause.lower()
    matched = []
    for pattern in RISK_PATTERNS:
        hits = [kw for kw in pattern["keywords"] if kw.lower() in clause_lower]
        if hits:
            matched.append({
                "risk_type": pattern["type"],
                "risk_level": pattern["default_level"],
                "category": pattern["category"],
                "reason": pattern["description"],
                "threshold": pattern["threshold"],
                "matched_keywords": hits,
            })

    if not matched:
        return {
            "risk_level": "LOW",
            "risk_type": "none",
            "reason": "특이사항 없음",
            "recommendation": "표준 조건 범위 내",
            "financial_impact": "없음",
        }

    highest = max(matched, key=lambda m: RISK_LEVEL_PRIORITY.get(m["risk_level"], 0))
    return {
        "risk_level": highest["risk_level"],
        "risk_type": highest["risk_type"],
        "reason": highest["reason"],
        "recommendation": f"{highest['category']} 조건 재협상 권고 (기준: {highest['threshold']})",
        "financial_impact": "확인 필요" if highest["risk_level"] == "HIGH" else "경미",
        "details": matched,
    }


@tool
def diff_clauses(contract_id: str, current_version: int) -> dict:
    """이전 버전과 현재 버전의 조항을 비교하여 변경점을 추출한다.

    Args:
        contract_id: 계약서 고유 ID
        current_version: 현재 버전 번호
    Returns:
        Diff Report (변경된 조항 목록 + 리스크 영향 요약)
    """
    curr_resp = contracts_table.get_item(Key={"id": contract_id})
    curr_item = curr_resp.get("Item")
    if not curr_item:
        return {"error": "계약서를 찾을 수 없습니다"}

    if current_version <= 1:
        return {"diffs": [], "total_changes": 0, "message": "이전 버전이 없습니다"}

    scan_resp = contracts_table.scan(
        FilterExpression="customer_name = :cn AND contract_type = :ct AND #v = :pv",
        ExpressionAttributeNames={"#v": "version"},
        ExpressionAttributeValues={
            ":cn": curr_item.get("customer_name"),
            ":ct": curr_item.get("contract_type"),
            ":pv": current_version - 1,
        },
    )
    prev_items = scan_resp.get("Items", [])
    if not prev_items:
        return {"error": "이전 버전을 찾을 수 없습니다"}

    prev_item = prev_items[0]
    old_clauses = prev_item.get("clauses", [])
    new_clauses = curr_item.get("clauses", [])

    old_map = {str(c.get("index", i)): c for i, c in enumerate(old_clauses)}
    new_map = {str(c.get("index", i)): c for i, c in enumerate(new_clauses)}

    diffs = []
    for cid, c in new_map.items():
        if cid not in old_map:
            diffs.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "ADDED",
                "old_content": None, "new_content": c.get("body", ""),
            })
        elif c.get("body") != old_map[cid].get("body"):
            matcher = difflib.SequenceMatcher(None, old_map[cid].get("body", ""), c.get("body", ""))
            diffs.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "MODIFIED",
                "ratio": f"{matcher.ratio():.2f}",
                "old_content": old_map[cid].get("body", ""),
                "new_content": c.get("body", ""),
            })
    for cid, c in old_map.items():
        if cid not in new_map:
            diffs.append({
                "clause_id": cid, "title": c.get("title", ""),
                "change_type": "REMOVED",
                "old_content": c.get("body", ""), "new_content": None,
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
    risks = []
    total = financials.get("total_amount", 0)
    penalty_rate = financials.get("penalty_rate", 0)
    liability_cap = financials.get("liability_cap")
    warranty_months = financials.get("warranty_months", 12)

    if penalty_rate and float(penalty_rate) > 0.001:
        risks.append({
            "type": "과도한_지체상금",
            "level": "HIGH" if float(penalty_rate) > 0.002 else "MEDIUM",
            "detail": f"지체상금율 {float(penalty_rate)*100:.2f}%/일 (기준: 0.05~0.1%/일)",
        })

    if liability_cap is None or (total and liability_cap and float(liability_cap) > float(total)):
        risks.append({
            "type": "무제한_배상책임",
            "level": "HIGH",
            "detail": "배상한도 미설정 또는 계약금액 초과",
        })

    if contract_type in ("SI", "개발") and warranty_months < 12:
        risks.append({
            "type": "하자보수_기간_미달",
            "level": "MEDIUM",
            "detail": f"하자보수 {warranty_months}개월 (SI 계약 기준 12개월 이상)",
        })

    if not risks:
        return {
            "overall_financial_risk": "LOW",
            "summary": "재무 조건 표준 범위 내",
            "risks": [],
        }

    max_level = max(risks, key=lambda r: RISK_LEVEL_PRIORITY.get(r["level"], 0))
    return {
        "overall_financial_risk": max_level["level"],
        "summary": f"재무 리스크 {len(risks)}건 감지",
        "risks": risks,
    }
