# CMP-CAS-003 — Workflow Agent 컴포넌트 명세

> 문서 타입: CMP (컴포넌트)
> 도메인: CAS (Contract Agent System)
> 버전: v1.0 | 작성일: 2026-04-23

---

## 1. 역할

Risk Agent 출력(Risk Report)을 기반으로 부서별 검토 라우팅을 자동 생성한다.
PLY-CAS-001 §3 라우팅 규칙을 적용하여 WorkflowStep 목록을 DB에 저장한다.

---

## 2. 입출력

| 항목 | 내용 |
|------|------|
| 입력 | contract_id (string) + Risk Report JSON |
| 출력 | WorkflowStep 목록 (DAT-CAS-001 WorkflowStep 구조) |

---

## 3. 등록 도구 (tools)

| 도구 함수 | 역할 |
|-----------|------|
| `determine_reviewers(risk_report, contract)` | 리스크 레벨·계약 조건 기반 검토자 목록 결정 |
| `create_workflow_steps(contract_id, reviewers)` | WorkflowStep 레코드 생성 및 DynamoDB cas-workflow-steps 저장 |

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
def determine_reviewers(risk_report: dict, contract: dict) -> list:
    """PLY-CAS-001 §3 라우팅 규칙 적용, 검토자 목록 반환"""
    ...

@tool
def create_workflow_steps(contract_id: str, reviewers: list) -> list:
    """WorkflowStep 생성, DynamoDB cas-workflow-steps 저장, 생성된 step 목록 반환"""
    dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
    table = dynamodb.Table("cas-workflow-steps")
    ...

workflow_agent = Agent(
    model=model,
    tools=[determine_reviewers, create_workflow_steps],
    name="workflow_agent",
    description="리스크 레벨 기반 부서별 검토 라우팅 및 워크플로우 생성",
    system_prompt=(
        "당신은 기업 계약 승인 프로세스 관리자입니다. "
        "리스크 리포트를 기반으로 적절한 검토 부서와 승인 단계를 결정하세요. "
        "PLY-CAS-001 라우팅 규칙을 정확히 준수하고, "
        "검토자 목록을 step_order 순서로 정렬하여 반환하세요."
    )
)
```

---

## 5. 라우팅 규칙 적용 순서

```
1. overall_risk 확인 → 기본 검토 체인 결정
   - HIGH: 법무팀(1) → 팀장(2) → 본부장(3)
   - MEDIUM: 팀장(1) → 담당임원(2)
   - LOW: 담당자(1)

2. 계약금액 10억 이상 → 재무팀 병렬 추가 (step_order 동일 값)

3. IP 이전 조항 존재 → 기술법무 병렬 추가 (step_order 동일 값)
```

---

## 6. Mock 서명 처리

- 실제 전자서명 연동 없음 (MVP)
- `/contracts/{id}/workflow/{step_id}/approve` 호출 시:
  - `signed_at` = 현재 타임스탬프 기록
  - `status` = APPROVED
  - 모든 필수 step APPROVED 시 → contract.status = APPROVED

---

## 7. 오류 처리

| 상황 | 처리 |
|------|------|
| Risk Report 없음 | `ValueError` 발생 → status = ERROR |
| DB 저장 실패 | 예외 전파 → Orchestrator가 status = ERROR 처리 |
| 검토자 결정 불가 | 법무팀 기본값으로 fallback |

---

## 8. as_tool 등록 (Orchestrator용)

```python
workflow_agent.as_tool(
    name="route_approval",
    description="리스크 레벨 기반 부서별 검토 라우팅"
)
```
