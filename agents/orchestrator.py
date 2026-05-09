import json
import os

from mcp import StdioServerParameters
from strands import Agent
from strands.tools.mcp import MCPClient

from agents.config import get_model
from agents.legal_agent import legal_agent
from agents.search_agent import search_agent
from tools.clause_extractor import extract_clauses, extract_entities
from tools.document_loader import load_docx

_MCP_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "compliance.db")
)

_SYSTEM_PROMPT = (
    "당신은 메가존클라우드 계약 분석 오케스트레이터입니다. "
    "계약서를 분석하고, 사내 컴플라이언스 규정을 조회하여 종합 리스크 리포트를 작성합니다. "
    "항상 한국어로 응답하세요."
)


def analyze_contract(file_path: str) -> dict:
    """DOCX 파일 파싱 → 리스크 분석 → 컴플라이언스 조회 → 종합 리포트 반환"""
    doc = load_docx(file_path)
    clauses = extract_clauses(doc["text"])
    entities = extract_entities(doc["text"])

    contract_data = {
        "source_file": doc["source_file"],
        "entities": entities,
        "clauses": clauses,
    }
    contract_json = json.dumps(contract_data, ensure_ascii=False)

    mcp_client = MCPClient(
        lambda: StdioServerParameters(
            command="npx",
            args=["-y", "@anthropic/mcp-server-sqlite", "--db-path", _MCP_DB_PATH],
        )
    )

    model = get_model()

    with mcp_client:
        orchestrator = Agent(
            model=model,
            system_prompt=_SYSTEM_PROMPT,
            tools=[
                legal_agent.as_tool(
                    tool_name="legal_risk_analyzer",
                    description="계약서 조항별 MZC 기준 리스크 분석",
                ),
                search_agent.as_tool(
                    tool_name="contract_history_searcher",
                    description="Bedrock KB에서 유사 계약 이력 검색",
                ),
                *mcp_client.list_tools(),
            ],
        )

        result = orchestrator(
            f"다음 계약서를 분석하고, 사내 컴플라이언스 규정과 비교하여 리스크 리포트를 작성하세요:\n\n{contract_json}"
        )

    return {
        "contract": contract_data,
        "analysis": str(result),
    }
