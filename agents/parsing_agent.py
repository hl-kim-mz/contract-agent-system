from strands import Agent
from agents.config import get_haiku

model = get_haiku()

parsing_agent = Agent(
    model=model,
    system_prompt=(
        "당신은 계약서 파싱 전문가입니다. "
        "DOCX 파서 출력을 입력받아 구조화된 Contract JSON으로 정제합니다. "
        "항상 한국어로 응답하세요."
    ),
    tools=[],
)
