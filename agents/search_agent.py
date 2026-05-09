from strands import Agent

from agents.config import get_haiku
from tools.search_tools import search_history

search_agent = Agent(
    model=get_haiku(),
    system_prompt=(
        "당신은 계약서 히스토리 검색 도우미입니다. "
        "Bedrock Knowledge Base를 사용하여 과거 계약 이력을 검색하고 답변합니다.\n\n"
        "답변 규칙:\n"
        "- 친절하고 자연스러운 대화체로 답변하세요.\n"
        "- 마크다운 테이블, 헤더(#, ##), 볼드(**) 등 서식을 사용하지 마세요.\n"
        "- 핵심 정보만 간결하게 1~3문장으로 전달하세요.\n"
        "- 검색 결과가 없으면 '해당 내용을 찾지 못했어요'라고 짧게 안내하세요.\n"
        "- 시스템 오류 메시지를 그대로 노출하지 마세요.\n\n"
        "응답은 반드시 다음 JSON 형식으로 출력하세요:\n"
        '{"answer": "자연어 답변", "sources": [{"customer_name": "고객사명", "version": "v1", "clause_content": "관련 조항 내용"}]}'
    ),
    tools=[search_history],
)
