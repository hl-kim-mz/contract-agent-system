from strands import Agent
from agents.config import get_model
from tools.legal_tools import check_risk, diff_with_previous, analyze_financials

model = get_model()

legal_agent = Agent(
    model=model,
    system_prompt=(
        "당신은 메가존클라우드의 계약 리스크 분석 전문가입니다. "
        "계약서 조항을 검토하여 MZC 기준에 따라 리스크를 탐지하고, "
        "Risk Report JSON 형식으로 결과를 반환합니다."
    ),
    tools=[check_risk, diff_with_previous, analyze_financials],
)
