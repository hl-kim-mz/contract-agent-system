import json
from pathlib import Path

from strands import Agent

from agents.config import get_sonnet
from tools.risk_tools import check_risk, diff_clauses, analyze_financials

PROMPT_PATH = Path(__file__).parent.parent / "docs/prompts/risk-agent.md"


def load_risk_prompt() -> str:
    content = PROMPT_PATH.read_text(encoding="utf-8")
    start = content.find("```\n당신은 메가존클라우드(MZC) 전속 계약")
    end   = content.find("\n```\n\n---\n\n## 입력 예시")
    return content[start + 3:end].strip()


risk_agent = Agent(
    model=get_sonnet(),
    system_prompt=load_risk_prompt(),
    tools=[check_risk, diff_clauses, analyze_financials],
)
