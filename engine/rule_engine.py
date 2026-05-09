def route_workflow(risk_report: dict, contract: dict) -> list:
    """MZC 내부 검토 라우팅 규칙 (if/else, LLM 불필요)"""
    steps = []
    overall = risk_report.get("overall_risk", "LOW")

    if overall == "HIGH":
        steps = [
            {"department": "계약팀",  "step_order": 1},
            {"department": "법무팀",  "step_order": 2},
            {"department": "본부장",  "step_order": 3},
        ]
    elif overall == "MEDIUM":
        steps = [
            {"department": "계약팀",    "step_order": 1},
            {"department": "담당 임원", "step_order": 2},
        ]
    else:
        steps = [{"department": "영업팀 담당자", "step_order": 1}]

    # 계약금액 10억+ → 재무팀 병렬 검토
    amount = contract.get("financials", {}).get("total_amount") or 0
    if amount >= 1_000_000_000:
        steps.append({"department": "재무팀", "step_order": 1, "parallel": True})

    # IP 완전이전 → 기술법무 순차 추가
    for cr in risk_report.get("clause_risks", []):
        if cr.get("risk_type") == "IP_완전이전":
            max_order = max(s["step_order"] for s in steps)
            steps.append({"department": "기술법무", "step_order": max_order + 1})
            break

    # CR 절차 미정의 (SI) → 프로젝트팀장 병렬 추가
    for cr in risk_report.get("clause_risks", []):
        if cr.get("risk_type") == "CR_절차_미정의":
            steps.append({"department": "프로젝트팀장", "step_order": 1, "parallel": True})
            break

    # 비표준계약 → 계약팀 에스컬레이션
    if not contract.get("is_standard", True):
        steps[0]["escalation"] = True

    return steps
