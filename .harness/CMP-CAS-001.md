# CMP-CAS-001 — Parsing Agent 컴포넌트 명세

> 문서 타입: CMP (컴포넌트)
> 도메인: CAS (Contract Agent System)
> 버전: v1.0 | 작성일: 2026-04-23

---

## 1. 역할

DOCX 파일을 읽어 계약서 구조화 JSON으로 변환한다.
Orchestrator Agent로부터 호출되며, 결과는 Legal Review Agent와 Diff Agent에 전달된다.

---

## 2. 입출력

| 항목 | 내용 |
|------|------|
| 입력 | DOCX 파일 경로 (string) |
| 출력 | Contract JSON (DAT-CAS-001 Contract + ContractClause 구조) |

---

## 3. 등록 도구 (tools)

| 도구 함수 | 역할 |
|-----------|------|
| `load_document(s3_key)` | S3에서 DOCX 다운로드 → mammoth으로 plain text 변환 |
| `extract_clauses(text)` | 조항 경계 탐지 → 조항 목록 반환 |

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
def load_document(s3_key: str) -> str:
    """S3에서 DOCX 다운로드 후 mammoth으로 plain text 변환하여 반환"""
    s3 = boto3.client("s3", region_name="ap-northeast-2")
    obj = s3.get_object(Bucket="cas-contracts", Key=s3_key)
    ...

@tool
def extract_clauses(text: str) -> list:
    """텍스트에서 조항 경계를 탐지하고 조항 목록 반환"""
    ...

parsing_agent = Agent(
    model=model,
    tools=[load_document, extract_clauses],
    name="parsing_agent",
    description="DOCX 계약서를 파싱하여 구조화된 JSON으로 변환",
    system_prompt=(
        "당신은 계약서 분석 전문가입니다. "
        "DOCX 파일을 읽어 계약 유형, 당사자, 날짜, 금액, 조항 목록을 추출하세요. "
        "출력은 반드시 지정된 JSON 스키마 형식으로 반환하세요."
    )
)
```

---

## 5. 시스템 프롬프트 지시사항

- 계약 유형: NDA / MSA / SI / SLA / Maintenance / Other 중 하나로 분류
- 당사자: 갑(party_a) = 메가존클라우드, 을(party_b) = 고객사
- 날짜: ISO 8601 형식 (YYYY-MM-DD)
- 금액: 숫자만 추출 (단위 KRW 기본)
- 조항 유형: liability / ip / confidentiality / termination / dispute / penalty / other

---

## 6. 오류 처리

| 상황 | 처리 |
|------|------|
| 파일 없음 / 읽기 실패 | `FileNotFoundError` 발생 → status = ERROR |
| 텍스트 추출 결과 빈 문자열 | `ValueError("빈 문서")` 발생 → status = ERROR |
| Bedrock API 오류 | 예외 전파 → Orchestrator가 status = ERROR 처리 |

---

## 7. as_tool 등록 (Orchestrator용)

```python
parsing_agent.as_tool(
    name="parse_contract",
    description="DOCX 파싱 후 계약 JSON 반환"
)
```
