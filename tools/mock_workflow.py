"""Rule Engine: 리스크 리포트 기반 MZC 내부 검토 라우팅"""
from tools.risk_patterns import RISK_LEVEL_PRIORITY


def route_workflow(risk_report: dict, contract: dict) -> list:
    """MZC 내부 검토 라우팅 규칙 (코드 기반, LLM 불필요)

    Args:
        risk_report: RiskAgent 출력 Risk Report JSON
        contract:    ParsingAgent 출력 Contract JSON
    Returns:
        검토 단계 목록 [{"department": str, "step_order": int, "parallel": bool}]
    """
    overall = risk_report.get("overall_risk", "LOW")
    steps = []

    if overall == "HIGH":
        steps = [
            {"department": "계약팀", "step_order": 1, "parallel": False},
            {"department": "법무팀", "step_order": 2, "parallel": False},
            {"department": "본부장", "step_order": 3, "parallel": False},
        ]
    elif overall == "MEDIUM":
        steps = [
            {"department": "계약팀", "step_order": 1, "parallel": False},
            {"department": "담당 임원", "step_order": 2, "parallel": False},
        ]
    else:
        steps = [
            {"department": "영업팀 담당자", "step_order": 1, "parallel": False},
        ]

    # 계약금액 10억+ → 재무팀 병렬 검토
    total_amount = contract.get("financials", {}).get("total_amount", 0)
    if total_amount >= 1_000_000_000:
        steps.append({"department": "재무팀", "step_order": 1, "parallel": True})

    # IP 완전이전 → 기술법무 순차 추가
    clause_risks = risk_report.get("clause_risks", [])
    for cr in clause_risks:
        if cr.get("risk_type") == "IP_완전이전":
            max_order = max(s["step_order"] for s in steps)
            steps.append({"department": "기술법무", "step_order": max_order + 1, "parallel": False})
            break

    # CR 절차 미정의 (SI) → 프로젝트팀장 병렬 추가
    for cr in clause_risks:
        if cr.get("risk_type") == "CR_절차_미정의":
            steps.append({"department": "프로젝트팀장", "step_order": 1, "parallel": True})
            break

    # 비표준계약 → 계약팀 에스컬레이션
    if not contract.get("is_standard", True) and steps:
        steps[0]["escalation"] = True

    return steps


def get_status_transition(current_status: str, action: str) -> str:
    """계약서 상태 전이 규칙

    상태: DRAFT → PARSING → RISK_REVIEWED → PENDING_APPROVAL → APPROVED | REJECTED
    """
    transitions = {
        ("DRAFT", "parse"): "PARSING",
        ("PARSING", "complete"): "RISK_REVIEWED",
        ("RISK_REVIEWED", "submit"): "PENDING_APPROVAL",
        ("PENDING_APPROVAL", "approve"): "APPROVED",
        ("PENDING_APPROVAL", "reject"): "REJECTED",
        ("REJECTED", "resubmit"): "PENDING_APPROVAL",
    }
    return transitions.get((current_status, action), current_status)
