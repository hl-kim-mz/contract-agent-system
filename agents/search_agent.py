from strands import Agent
from agents.config import get_model
from tools.search_tools import search_contract_history

model = get_model()

search_agent = Agent(
    model=model,
    system_prompt=(
        "당신은 계약서 히스토리 검색 전문가입니다. "
        "Bedrock Knowledge Base를 사용하여 과거 계약 이력을 검색하고 답변합니다."
    ),
    tools=[search_contract_history],
)
