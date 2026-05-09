# CAS Multi-Agent 시스템 설계서

> Strands SDK 기반 Multi-Agent 아키텍처
> 기반 문서: DSC-014 합의문, Requirements v3.0

---

## 1. Agent 아키텍처 개요

CAS는 Strands SDK의 `Agent`, `@tool`, `as_tool()` 패턴으로 Multi-Agent 파이프라인을 구성한다. Orchestrator Agent가 사용자 입력을 자율 판단하여 전문가 Agent를 호출하는 구조이다.

```
┌─────────────────────────────────────────────────────────────┐
│ Orchestrator Agent (Sonnet) — as_tool() 자율 라우팅          │
│                                                              │
│  사용자 입력 (DOCX 업로드 / 자연어 질의)                     │
│      ↓                                                       │
│  Orchestrator가 자율 판단:                                    │
│    ├─ "계약서 분석해줘" → ParsingAgent + RiskAgent            │
│    ├─ "과거 이력 찾아줘" → SearchAgent (KB)                   │
│    ├─ "사내 규정 확인해줘" → MCP (mcp-server-sqlite)         │
│    └─ "이 조항 위험한가?" → RiskAgent 단독                    │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │
│  │ ParsingAgent  │  │ RiskAgent     │  │ SearchAgent   │    │
│  │ (Haiku)       │  │ (Sonnet)      │  │ (Haiku)       │    │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘    │
│          │                  │                   │             │
│  ┌───────┴──────────────────┴───────────────────┴──────────┐ │
│  │                      Tools                               │ │
│  │ extract_docx │ check_risk │ diff_clauses │ search_hist  │ │
│  │              │ analyze_fn │              │              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ── Bedrock Guardrails ──                                    │
│  입력: PII/Prompt Attack 차단 │ 출력: 민감정보 마스킹         │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Agent 상세 설계

### 2-1. Orchestrator Agent (Sonnet)

**역할**: 사용자 입력을 분석하여 적절한 전문가 Agent를 자율 선택·호출

| 속성 | 값 |
|------|-----|
| 모델 | Claude Sonnet (anthropic.claude-3-5-sonnet-20241022-v2:0, ap-northeast-2) |
| 패턴 | as_tool()로 하위 에이전트를 도구로 노출 |
| 입력 | 사용자 자연어 질의 또는 DOCX 업로드 트리거 |
| 출력 | 하위 에이전트 실행 결과 종합 |

```python
from strands import Agent
from agents.config import get_sonnet

orchestrator = Agent(
    model=get_sonnet(),
    tools=[
        parsing_agent.as_tool(),
        risk_agent.as_tool(),
        search_agent.as_tool(),
    ]
)
```

**자율 라우팅 매트릭스**:

| 사용자 의도 | 호출 Agent | 호출 순서 |
|------------|------------|-----------|
| DOCX 업로드 → 전체 분석 | ParsingAgent → RiskAgent | 순차 |
| 특정 조항 리스크 질의 | RiskAgent 단독 | 단일 |
| 과거 계약 검색 | SearchAgent | 단일 |
| 사내 규정 조회 | MCP Client | 단일 |
| HIGH 리스크 or 에스컬레이션 | RiskAgent → LegalReviewAgent | 순차 |
| 복합 질의 | 판단에 따라 복수 Agent | 자율 |

---

### 2-2. ParsingAgent (Haiku)

**역할**: DOCX 파서(python-docx) 출력을 입력받아 구조화된 Contract JSON으로 정제

| 속성 | 값 |
|------|-----|
| 모델 | Claude Haiku (anthropic.claude-haiku-4-5-20251001-v1:0, ap-northeast-2) |
| 도구 | 없음 (LLM 기반 구조화) |
| 입력 | DOCX 파서 추출 결과 (원문 텍스트 + 표) |
| 출력 | Contract JSON |

**출력 스키마: Contract JSON**

```json
{
  "contract_type": "NDA | MSA | SI | SLA | Maintenance | Outsourcing | Other",
  "is_standard": true,
  "parties": {
    "party_a": { "name": "메가존클라우드(주)", "representative": null },
    "party_b": { "name": "고객사명", "representative": null }
  },
  "dates": {
    "contract_date": null,
    "start_date": null,
    "end_date": null,
    "renewal_terms": null
  },
  "financials": {
    "total_amount": 0,
    "currency": "KRW",
    "payment_terms": null,
    "penalty_clause": null,
    "delay_penalty_rate": null
  },
  "clauses": [
    {
      "id": "clause_001",
      "type": "liability | ip | confidentiality | termination | dispute | penalty | other",
      "title": "조항명",
      "content": "원문 텍스트",
      "paragraph": 1
    }
  ]
}
```

**DOCX 파서 코드 기반 처리**:

| 기능 | 처리 방식 |
|------|-----------|
| DOCX 텍스트 추출 | python-docx |
| 계약 유형 분류 | 파일명·제목 키워드 매칭 (regex) |
| 표준/비표준 판별 | 파일명·템플릿 코드 매칭 (regex) |
| 당사자 정보 추출 | "갑"/"을" 키워드 파싱 (regex) |
| 핵심 날짜 추출 | 날짜 패턴 정규식 |
| 금액 정보 추출 | 금액 패턴 정규식 (억/만원 등) |
| 지체상금율 추출 | "%/일" 패턴 |
| 조항 분리 | 단락 헤딩(제N조) 기준 분리 |

---

### 2-3. RiskAgent (Sonnet)

**역할**: Contract JSON → 리스크 조항 탐지 + 재무 분석 + 이전 버전 Diff 리스크 평가

| 속성 | 값 |
|------|-----|
| 모델 | Claude Sonnet |
| 도구 | check_risk, diff_clauses, analyze_financials |
| 입력 | Contract JSON |
| 출력 | Risk Report JSON |

**탐지 대상 리스크 유형 (MZC 기준)**:

| 리스크 유형 | MZC 기준 | 탐지 조건 | 기본 레벨 |
|------------|---------|-----------|-----------|
| 무제한 배상책임 | 계약금액 100% 이내 | 배상한도 미설정 또는 계약금액 초과 | HIGH |
| IP 완전이전 | 공동소유 또는 기존 IP 제외 | 개발 산출물 지재권 전부 이전 | HIGH |
| 일방적 해지권 | 양 당사자 서면 통지 30일 전 | 갑 단독 해지 + 위약금 없음 | HIGH |
| 과도한 지체상금 | 0.05%/일 이내 | 0.1%/일 초과 | MEDIUM |
| 자동갱신 조건 | 갱신 거절 기한 명시 | 거절 기한 미명시 | MEDIUM |
| 분쟁 관할 불리 | 서울중앙지방법원 | 상대방 소재지 법원 | MEDIUM |
| 비밀유지 기간 미정 | 계약 종료 후 3년 | 종료 후 기간 미명시 | LOW |
| 하자보수 기간 미달 | 1년 이상 | 1년 미만 (SI 계약) | MEDIUM |
| CR 절차 미정의 | 서면 합의 + 비용 정산 | CR 처리 절차 미명시 (SI) | HIGH |

**출력 스키마: Risk Report JSON**

```json
{
  "overall_risk": "HIGH | MEDIUM | LOW",
  "is_standard_contract": false,
  "risk_summary": "전체 요약 1~2문장",
  "clause_risks": [
    {
      "clause_id": "clause_001",
      "risk_level": "HIGH",
      "risk_type": "무제한_배상책임 | IP_완전이전 | 일방적_해지권 | 과도한_지체상금 | CR_절차_미정의 | 기타",
      "reason": "위험 근거 설명",
      "recommendation": "수정 제안 또는 협상 포인트",
      "financial_impact": "예상 손익 영향 (정성적)"
    }
  ],
  "key_concerns": ["핵심 우려사항 3개 이내"],
  "standard_deviation": "MZC 표준 계약 대비 주요 차이점",
  "escalation_required": true
}
```

**Tool 목록**:

| Tool | 처리 방식 | 설명 |
|------|-----------|------|
| `check_risk` | LLM | MZC 기준 프롬프트 기반 조항별 리스크 탐지 + 손익 분석 |
| `diff_clauses` | 코드 + LLM | DynamoDB 이전 버전 조회 → difflib 비교 → LLM 리스크 영향 요약 |
| `analyze_financials` | LLM | 계약금액·지체상금·하자보수 등 재무 리스크 분석 |

---

### 2-4. SearchAgent (Haiku)

**역할**: 전체 계약서 히스토리 자연어 검색 + 답변 생성

| 속성 | 값 |
|------|-----|
| 모델 | Claude Haiku |
| 도구 | search_history |
| 입력 | 자연어 검색 질의 |
| 출력 | 검색 결과 + AI 생성 답변 |
| 백엔드 | Bedrock KB retrieve (Plan B: BM25 + SQLite FTS) |

**MZC 업무 맥락 질의 예시**:

| 질의 | 활용 상황 |
|------|-----------|
| "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?" | 동일 고객사 재계약 시 협상 참고 |
| "SI 도급 계약에서 CR 절차가 명시된 사례" | 비표준계약 검토 시 레퍼런스 |
| "지체상금 0.1% 초과로 체결된 계약 목록" | 리스크 현황 파악 |
| "IP 완전이전 조항이 있었던 계약" | 법무팀 검토 전 사전 스크리닝 |
| "B사 NDA 만료일 확인" | 계약 갱신 시점 관리 |

---

### 2-5. LegalReviewAgent (Haiku)

**역할**: Risk Report를 받아 법무팀 관점의 최종 검토 의견서 작성 및 승인/반려 권고

| 속성 | 값 |
|------|-----|
| 모델 | Claude Haiku (anthropic.claude-haiku-4-5-20251001-v1:0, ap-northeast-2) |
| 도구 | 없음 (LLM 기반) |
| 입력 | Risk Report JSON |
| 출력 | Legal Review Opinion JSON |

**출력 스키마: Legal Review Opinion**

```json
{
  "review_id": "uuid",
  "reviewed_at": "ISO8601",
  "recommendation": "APPROVE | REJECT | NEGOTIATE",
  "legal_opinion": "법무팀 종합 의견 (1~3문장)",
  "negotiation_points": [
    {
      "clause_id": "clause_001",
      "issue": "문제 조항 요약",
      "suggested_revision": "수정 권고안"
    }
  ],
  "escalation_required": true,
  "escalation_reason": "에스컬레이션 사유 (없으면 null)"
}
```

**호출 조건**: overall_risk = HIGH 또는 escalation_required = true인 경우 Orchestrator가 자동 호출

```python
from agents.config import get_haiku
from strands import Agent

legal_review_agent = Agent(
    model=get_haiku(),
    system_prompt="법무팀 계약 검토 전문가 — Risk Report 기반 승인/반려/협상 권고",
    tools=[],
)
```

---

### 2-6. MCP Client (mcp-server-sqlite)

**역할**: 사내 컴플라이언스 규정 DB Mock 연동

| 속성 | 값 |
|------|-----|
| MCP 서버 | mcp-server-sqlite (오픈소스) |
| DB | compliance.db (SQLite) |
| 데이터 | 사내 규정 3~5건 샘플 Mock |
| 쿼리 방식 | Orchestrator → MCP → SQLite 자율 쿼리 생성·실행 |

> MCP 프로토콜 표준 준수 → 실운영 시 사내 컴플라이언스 DB로 커넥터만 교체

---

### 2-6. Bedrock Guardrails

**역할**: 입출력 보안 필터링

| 구분 | 기능 |
|------|------|
| 입력 필터 | PII(개인정보) 탐지 + Prompt Attack(탈옥) 차단 |
| 출력 필터 | 민감정보 마스킹 |
| 연동 방식 | Converse API `guardrailConfig` 파라미터 |

---

## 3. 오케스트레이션 흐름

### 3-1. 계약서 업로드 흐름

```
1. DOCX 업로드 → S3 저장
   s3://{bucket}/{customer}/{id}/v{n}.docx
   └─ python-docx로 텍스트 추출 (코드, 즉시)

2. Orchestrator Agent 자율 판단:

   ├─ ParsingAgent (Haiku, as_tool)
   │    └─ DOCX 파서 결과 → Contract JSON 정제 → DynamoDB 저장
   │
   ├─ RiskAgent (Sonnet, as_tool)
   │    ├─ check_risk: MZC 기준 리스크 탐지
   │    ├─ diff_clauses: 이전 버전 조회 → difflib → LLM 리스크 요약
   │    └─ analyze_financials: 재무 리스크 분석
   │
   └─ Bedrock Guardrails 래핑
        ├─ 입력: PII/Prompt Attack 차단
        └─ 출력: 민감정보 마스킹

3. Rule Engine 실행 (코드, 즉시)
   └─ overall_risk × MZC 라우팅 매트릭스 → 검토자 목록 생성

4. DynamoDB 업데이트 + UI 반영
```

### 3-2. 검색 흐름

```
사용자 검색 질의 → Orchestrator → SearchAgent (Haiku)
    └─ Bedrock KB retrieve → 시맨틱 검색 결과 + AI 답변 생성
```

### 3-3. 사내 규정 조회 흐름

```
사내 규정 질의 → Orchestrator → MCP Client
    └─ mcp-server-sqlite → SQLite 자율 쿼리 → 규정 결과 반환
```

---

## 4. Strands SDK 구현 패턴

```python
from strands import Agent, tool
from agents.config import get_sonnet, get_haiku

# 모델 정의 (ap-northeast-2)
# Sonnet: anthropic.claude-3-5-sonnet-20241022-v2:0
# Haiku:  anthropic.claude-3-5-haiku-20241022-v1:0
sonnet = get_sonnet()
haiku = get_haiku()

# Tool 정의
@tool
def check_risk(clause: str, contract_type: str) -> dict:
    """MZC 기준 리스크 탐지"""
    ...

@tool
def diff_clauses(old_clauses: list, new_clauses: list) -> dict:
    """difflib 조항 단위 비교"""
    ...

@tool
def analyze_financials(financials: dict, contract_type: str) -> dict:
    """계약금액·지체상금·하자보수 등 재무 리스크 분석"""
    ...

@tool
def search_history(query: str) -> dict:
    """Bedrock KB 시맨틱 검색"""
    ...

# Agent 정의
parsing_agent = Agent(model=haiku, tools=[...])
risk_agent = Agent(model=sonnet, tools=[check_risk, diff_clauses, analyze_financials])
search_agent = Agent(model=haiku, tools=[search_history])

# Orchestrator
orchestrator = Agent(
    model=sonnet,
    tools=[
        parsing_agent.as_tool(),
        risk_agent.as_tool(),
        search_agent.as_tool(),
    ]
)
```

---

## 5. Rule Engine: Workflow 라우팅

### MZC 내부 검토 라우팅 규칙

| 조건 | 라우팅 대상 | 검토 순서 |
|------|------------|-----------|
| Overall: HIGH | 계약팀 → 법무팀 → 본부장 | 순차 3단계 |
| Overall: MEDIUM | 계약팀 → 담당 임원 | 순차 2단계 |
| Overall: LOW | 영업팀 담당자 자체 승인 | 1단계 |
| 계약금액 10억+ | 재무팀 병렬 검토 추가 | +1 (병렬) |
| IP 완전이전 조항 | 기술법무 검토 추가 | +1 (순차) |
| 비표준계약 플래그 | 계약팀 에스컬레이션 필수 | 최우선 |
| CR 절차 미정의 (SI) | 계약팀 + 프로젝트팀장 | +1 (병렬) |

### 계약 상태 전이

```
DRAFT → PARSING → RISK_REVIEWED → PENDING_APPROVAL → APPROVED / REJECTED
                                        ↓
                              (계약팀 CM검토중 상태 대응)
```

### DMS 연계 매핑 (데모 설명용)

| CAS 상태 | DMS 대응 상태 |
|----------|--------------|
| RISK_REVIEWED | 계약검토 요청 (CM검토중) |
| PENDING_APPROVAL | 검토 진행 중 |
| APPROVED | 계약검토 승인 → 날인 단계 |
| REJECTED | 계약검토 반려 → 수정 요청 |
