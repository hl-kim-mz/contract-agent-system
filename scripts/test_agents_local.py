"""
Orchestrator ↔ Agent 연결 검증 스크립트 (Groq 로컬 환경)
- 에이전트 임포트 및 인스턴스 생성 확인
- create_orchestrator_simple() 빌드 확인
- parsing_agent에 샘플 텍스트 전송 → JSON 응답 확인
- risk_agent tool 등록 확인 (check_risk, diff_clauses, analyze_financials)

전제조건: MODEL_PROVIDER=groq, GROQ_API_KEY 세팅
실행: python scripts/test_agents_local.py
"""
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent.parent))

PASS = "✅"
FAIL = "❌"
results: list[tuple[str, bool, str]] = []


def check(label: str, fn):
    try:
        result = fn()
        results.append((label, True, str(result)[:120]))
        print(f"{PASS} {label}")
        return result
    except Exception as e:
        results.append((label, False, str(e)[:200]))
        print(f"{FAIL} {label}\n   → {e}")
        return None


# ─── 1. 환경 변수 ──────────────────────────────────────────────────────────────
print("\n=== [1] 환경 변수 ===")
provider = os.getenv("MODEL_PROVIDER", "groq")
groq_key = os.getenv("GROQ_API_KEY", "")
aws_key = os.getenv("AWS_ACCESS_KEY_ID", "")
print(f"  MODEL_PROVIDER   : {provider}")
print(f"  GROQ_API_KEY     : {'설정됨' if groq_key else '미설정'}")
print(f"  AWS_ACCESS_KEY   : {'설정됨' if aws_key else '❌ 미설정'}")

if provider == "groq" and not groq_key:
    print("❌ GROQ_API_KEY 없음 — LLM 호출 테스트 실패")
if provider == "bedrock" and not aws_key:
    print("❌ AWS_ACCESS_KEY_ID 없음 — LLM 호출 테스트 실패")


# ─── 2. 모듈 임포트 ────────────────────────────────────────────────────────────
print("\n=== [2] 에이전트 모듈 임포트 ===")

config_mod = check("agents.config 임포트", lambda: __import__("agents.config", fromlist=["get_sonnet", "get_haiku"]))

parsing_mod = check("agents.parsing_agent 임포트", lambda: __import__("agents.parsing_agent", fromlist=["parsing_agent"]))

risk_mod = check("agents.risk_agent 임포트", lambda: __import__("agents.risk_agent", fromlist=["risk_agent"]))

search_mod = check("agents.search_agent 임포트", lambda: __import__("agents.search_agent", fromlist=["search_agent"]))

orchestrator_mod = check("agents.orchestrator 임포트", lambda: __import__("agents.orchestrator", fromlist=["create_orchestrator_simple"]))


# ─── 3. Orchestrator 빌드 ──────────────────────────────────────────────────────
print("\n=== [3] Orchestrator 빌드 (MCP 없음) ===")

def build_orchestrator():
    from agents.orchestrator import create_orchestrator_simple
    agent = create_orchestrator_simple()
    return f"tool_names={list(agent.tool_names)}"

orchestrator = check("create_orchestrator_simple() 빌드", build_orchestrator)


# ─── 4. Risk Agent tool 등록 확인 ──────────────────────────────────────────────
print("\n=== [4] Risk Agent tool 등록 확인 ===")

def verify_risk_tools():
    from agents.risk_agent import risk_agent
    tool_names = set(risk_agent.tool_names)
    expected = {"check_risk", "diff_clauses", "analyze_financials"}
    missing = expected - tool_names
    if missing:
        raise AssertionError(f"누락된 tool: {missing}")
    return f"등록된 tools: {sorted(tool_names)}"

check("risk_agent tools 3개 등록 확인", verify_risk_tools)


# ─── 5. parsing_agent LLM 호출 ────────────────────────────────────────────────
print("\n=== [5] parsing_agent 실제 호출 (Groq) ===")

SAMPLE_TEXT = """[파일명]: 테스트_NDA_v1.docx

[원문 텍스트]:
본 계약은 메가존클라우드(이하 '갑')와 테스트컴퍼니(이하 '을') 간에 체결된 비밀유지계약입니다.
계약기간: 2026년 1월 1일 ~ 2026년 12월 31일
제1조(목적) 본 계약은 상호 비밀정보를 보호하기 위함입니다.
제2조(비밀유지) 계약 종료 후 3년간 비밀을 유지한다."""

def call_parsing_agent():
    if provider == "groq" and not groq_key:
        raise RuntimeError("GROQ_API_KEY 미설정 — 스킵")
    if provider == "bedrock" and not aws_key:
        raise RuntimeError("AWS_ACCESS_KEY_ID 미설정 — 스킵")
    from agents.parsing_agent import parsing_agent
    response = parsing_agent(SAMPLE_TEXT)
    raw = str(response)
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1:
        raise ValueError(f"JSON 없음. 응답: {raw[:200]}")
    parsed = json.loads(raw[start:end])
    ct = parsed.get("contract_type", "UNKNOWN")
    clauses = len(parsed.get("clauses", []))
    return f"contract_type={ct}, clauses={clauses}개"

check("parsing_agent(샘플 NDA) → JSON 반환", call_parsing_agent)


# ─── 최종 결과 ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 50)
passed = sum(1 for _, ok, _ in results if ok)
total  = len(results)
print(f"결과: {passed}/{total} 통과\n")

failed = [(l, msg) for l, ok, msg in results if not ok]
if failed:
    print("실패 항목:")
    for label, msg in failed:
        print(f"  {FAIL} {label}: {msg}")
    sys.exit(1)
else:
    print("🎉 모든 연결 검증 통과")
