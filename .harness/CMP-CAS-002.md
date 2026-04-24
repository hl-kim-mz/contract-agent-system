# CMP-CAS-002 — Legal Review Agent 컴포넌트 명세

> 문서 타입: CMP (컴포넌트)
> 도메인: CAS (Contract Agent System)
> 버전: v1.0 | 작성일: 2026-04-23

---

## 1. 역할

Parsing Agent 출력(Contract JSON)을 입력받아 리스크 조항을 탐지하고 Risk Report JSON을 생성한다.
Parsing Agent와 병렬로 Diff Agent가 실행되는 동안 독립적으로 수행된다.

---

## 2. 입출력

| 항목 | 내용 |
|------|------|
| 입력 | Contract JSON (CMP-CAS-001 출력) |
| 출력 | Risk Report JSON (DAT-CAS-001 RiskReport + ClauseRisk 구조) |

---

## 3. 등록 도구 (tools)

| 도구 함수 | 역할 |
|-----------|------|
| `detect_risk_patterns(clauses)` | PLY-CAS-001 §2 기준으로 조항별 리스크 패턴 탐지 |
| `assess_financial_impact(clause, contract)` | 금액 정보 기반 손익 영향 정성 평가 |
| `save_risk_report(contract_id, report)` | 분석 결과를 DynamoDB cas-risk-reports 테이블에 저장 |

---

## 4. Strands SDK 구성

```python
import os
from strands import Agent, tool
from strands.models import BedrockModel, LiteLLMModel

def get_model():
    """MODEL_PROVIDER 환경변수 기반 모델 분기
    - groq  : 사전 개발 (무료, 기본값)
    - bedrock: 해커톤 당일 (Claude 3.5 Sonnet v2)
    """
    if os.getenv("MODEL_PROVIDER", "groq") == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
            region_name=os.getenv("AWS_REGION", "ap-northeast-2")
        )
    return LiteLLMModel(model_id="groq/llama-3.3-70b-versatile")

model = get_model()

@tool
def detect_risk_patterns(clauses: list) -> list:
    """PLY-CAS-001 §2 기준 7가지 리스크 유형 탐지, 조항별 risk_level 반환"""
    ...

@tool
def assess_financial_impact(clause: dict, contract: dict) -> str:
    """계약 금액 기반 해당 조항의 손익 영향 정성 평가 반환"""
    ...

legal_agent = Agent(
    model=model,
    tools=[detect_risk_patterns, assess_financial_impact],
    name="legal_review_agent",
    description="계약 JSON에서 리스크 조항 탐지 및 손익 분석",
    system_prompt=(
        "당신은 기업 계약 리스크 전문 법무 검토자입니다. "
        "메가존클라우드 관점에서 불리한 조항을 탐지하세요. "
        "리스크 레벨은 HIGH / MEDIUM / LOW 세 단계로 분류하고, "
        "각 조항에 대해 위험 근거와 협상 포인트를 구체적으로 제시하세요. "
        "출력은 반드시 지정된 Risk Report JSON 스키마로 반환하세요."
    )
)
```

---

## 5. 리스크 탐지 프롬프트 기준 (PLY-CAS-001 §2 요약)

| 리스크 유형 | 탐지 키워드/패턴 |
|------------|-----------------|
| 무제한_배상책임 | "배상한도 없음", "전손해 배상", 한도 금액 미기재 |
| IP_완전이전 | "저작권 전부 귀속", "지식재산권 이전" |
| 일방적_해지권 | "갑은 언제든지 해지 가능", 위약금 조항 부재 |
| 과도한_페널티 | 지체상금율 수치 > 0.1%/일 |
| 자동갱신_조건 | "자동 연장", 거절 기한 미명시 |
| 분쟁관할_불리 | 상대방 소재지 법원명 등장 |
| 비밀유지_기간미정 | 비밀유지 기간 숫자 미기재 |

---

## 6. 오류 처리

| 상황 | 처리 |
|------|------|
| 입력 Contract JSON 파싱 실패 | `ValueError` 발생 → status = ERROR |
| Bedrock API 타임아웃 | 예외 전파 → Orchestrator가 status = ERROR 처리 |
| 조항 없음 (빈 clauses) | overall_risk = LOW, risk_summary = "분석 가능한 조항 없음" 반환 |

---

## 7. as_tool 등록 (Orchestrator용)

```python
legal_agent.as_tool(
    name="review_risks",
    description="리스크 조항 탐지 및 손익 분석"
)
```
