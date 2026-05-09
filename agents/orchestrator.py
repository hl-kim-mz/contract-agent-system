import os
from pathlib import Path

from mcp.client.stdio import stdio_client, StdioServerParameters
from strands import Agent
from strands.tools.mcp import MCPClient

from agents.config import get_sonnet
from agents.risk_agent import risk_agent
from agents.parsing_agent import parsing_agent
from agents.search_agent import search_agent

_MCP_DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data", "compliance.db")
)

_SYSTEM_PROMPT = """당신은 메가존클라우드의 계약 관리 시스템 Orchestrator입니다.
사용자 입력에 따라 적절한 전문가 에이전트를 자율적으로 선택하여 호출합니다.

[에이전트 선택 기준]
- 계약서 업로드/파싱 → parsing_agent
- 리스크 분석/Diff/재무분석 → risk_agent
- 과거 이력 검색 → search_agent
- 사내 규정 조회 → MCP 도구 (mcp-server-sqlite)

항상 한국어로 응답하세요."""


def create_orchestrator() -> Agent:
    """MCP 클라이언트 포함 Orchestrator 생성 (with 블록 내에서 사용)"""
    mcp_client = MCPClient(
        lambda: stdio_client(StdioServerParameters(
            command="uvx",
            args=["mcp-server-sqlite", "--db-path", _MCP_DB_PATH],
        ))
    )

    with mcp_client:
        return Agent(
            model=get_sonnet(),
            system_prompt=_SYSTEM_PROMPT,
            tools=[
                parsing_agent.as_tool(
                    name="parsing_agent",
                    description="DOCX 파서 결과를 구조화된 Contract JSON으로 정제",
                ),
                risk_agent.as_tool(
                    name="risk_agent",
                    description="MZC 기준 리스크 탐지, 조항 Diff, 재무 분석",
                ),
                search_agent.as_tool(
                    name="search_agent",
                    description="Bedrock KB 기반 계약서 히스토리 시맨틱 검색",
                ),
                *mcp_client.list_tools_sync(),
            ],
        )


def create_orchestrator_simple() -> Agent:
    """MCP 없이 간단하게 사용할 경우"""
    return Agent(
        model=get_sonnet(),
        system_prompt=_SYSTEM_PROMPT,
        tools=[
            parsing_agent.as_tool(
                name="parsing_agent",
                description="DOCX 파서 결과를 구조화된 Contract JSON으로 정제",
            ),
            risk_agent.as_tool(
                name="risk_agent",
                description="MZC 기준 리스크 탐지, 조항 Diff, 재무 분석",
            ),
            search_agent.as_tool(
                name="search_agent",
                description="Bedrock KB 기반 계약서 히스토리 시맨틱 검색",
            ),
        ],
    )
