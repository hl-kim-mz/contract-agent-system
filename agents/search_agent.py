from strands import Agent

from agents.config import get_haiku
from tools.search_tools import search_history

search_agent = Agent(
    model=get_haiku(),
    system_prompt=(
        "당신은 계약서 히스토리 검색 전문가입니다. "
        "Bedrock Knowledge Base를 사용하여 과거 계약 이력을 검색하고 답변합니다."
    ),
    tools=[search_history],
)
