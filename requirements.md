# Contract Agent System — Requirements (MVP)

> MEGATHON 2026 해커톤용 | 1일 MVP | Track 3: Multi-Agent System | AWS Bedrock + Strands SDK

---

## 1. 문제 정의

### 현황 및 Pain Point

| 문제 | 현재 방식 | 영향 |
|------|-----------|------|
| 계약서 형태가 프로젝트마다 상이 | 담당자가 수동 검토 | 검토 품질 편차 |
| 법무 리스크 조항 식별 | 법무팀 의존 (병목) | 계약 체결까지 평균 수일 소요 |
| 버전 변경 이력 관리 | 파일명 수기 버전관리 | 변경점 파악 불가 |
| 부서 간 검토 공유 | 이메일/메신저 분산 | 진행 현황 추적 불가 |
| 과거 계약 이력 검색 불가 | 파일 탐색기 수동 검색 | 유사 계약 참조 불가, 동일 실수 반복 |
| 전자서명 / 최종 승인 | 오프라인 또는 별도 툴 | 프로세스 단절 |

### 핵심 가설
> "계약서를 업로드하면 AI가 5분 안에 리스크 리포트를 생성하고, 적합한 검토자에게 자동 라우팅하면 계약 체결 사이클을 X일 → 당일로 단축할 수 있다."

---

## 2. 서비스 개요

**서비스명**: Contract Agent System (CAS)

메가존클라우드 영업팀이 고객사와 체결하는 다양한 계약서(NDA, MSA, SI 도급, SLA, 유지보수 등)를 업로드하면, **3개의 AI Agent + 코드 기반 로직**이 협력하여 **조항 분석 → 리스크 탐지 → 변경 이력 추적 → 내부 검토 라우팅 → 히스토리 검색**을 자동 처리한다.

### 설계 원칙
> **"AI가 필요한 곳에만 AI를 쓴다."** — 확정적 로직(JSON Diff, 라우팅 규칙)은 코드로 처리하고, LLM은 비정형 텍스트 이해·리스크 판단·자연어 검색 등 AI가 필수인 영역에만 투입한다.

### MVP 범위 (1일 개발 기준)

**In Scope**
- DOCX 업로드 및 텍스트 파싱 (하이브리드: python-docx + LLM 구조화)
- AI 기반 리스크 분석 리포트 생성 및 조회
- Legal Agent 리스크 판단 프롬프트 커스터마이징 UI
- 이전 버전 대비 조항 Diff 뷰 (코드 기반 JSON Diff + 리스크 영향 요약)
- 계약서 버저닝 (동일 고객사 기준 자동 버전 채번)
- RAG 기반 전체 계약 히스토리 자연어 검색
- 부서별 검토 라우팅 + 승인/반려 Mock UI (룰 엔진 기반)
- 계약서 목록 및 상태 대시보드

**Stretch Goal (시간 여유 시 추가)**
- 프로젝트별 컨텍스트/제약사항 프롬프트 관리 (프로젝트 단위 리스크 ���준 커스터마이징)
- 이메일 크롤러: `contract@mz.co.kr` BCC 계정으로 수신된 이메일 자동 수집 → 프로젝트별 분류 → RAG 히스토리 소스 추가

**Out of Scope (명시적 제외)**
- 실제 전자서명 연동 (DocuSign 등)
- 실제 이메일/슬랙 알림 발송
- 외부 ERP/CRM 연동
- 다국어 지원
- 모바일 반응형

---

## 3. 시스템 구성

### 전체 파이프라인 흐름

```
DOCX 업로드
    ↓
[python-docx] ──→ 원문 텍스트 추출 (코드, 확정적)
    ↓
[Parsing Agent] ──→ Contract JSON (LLM: 유형 분류, 조항 태깅, 당사자 추출)
    ↓
    ├──→ [Legal Review Agent] ──→ Risk Report JSON
    │        ├─ tool: check_risk (커스텀 프롬프트 기반 리스크 탐지)
    │        └─ tool: diff_with_previous (코드 기반 JSON Diff + LLM 리스크 영향 요약)
    │                    ↓
    │              Diff Report (이전 버전 존재 시)
    │
    ├──→ [Rule Engine] ──→ 검토 라우팅 (코드, if/else 기반)
    │                          ↓
    │                    검토 요청 / Mock 승인
    │
    └──→ S3 저장 + Bedrock KB 동기화 (RAG 인덱싱)

─── 별도 사용자 질의 시 ───
[Search Agent] ──→ RAG 히스토리 검색 (Bedrock Knowledge Bases)
```

### AI vs 코드 역할 분담

| 구성 요소 | 유형 | AI 필요 근거 |
|-----------|------|-------------|
| **Parsing Agent** | AI Agent | 비정형 계약서를 정형 JSON으로 변환 — 형태가 제각각이므로 LLM 필수 |
| **Legal Review Agent** | AI Agent | 법적 리스크 판단, 손익 분석 — 도메인 지식 기반 추론 필수 |
| **Search Agent** | AI Agent | 자연어 질의 → 전 버전 계약 히스토리 검색 + 답변 생성 |
| Diff 로직 | 코드 (tool) | JSON 구조 비교는 확정적 — deepdiff로 즉시·정확하게 처리 |
| Workflow 라우팅 | 코드 (Rule Engine) | 리스크 레벨 × 조건 매트릭스는 if/else로 충분 |
| DOCX 텍스트 추출 | 코드 (tool) | python-docx/mammoth는 확정적 파서 |

---

### Agent 1: Parsing Agent

**역할**: 추출된 원문 텍스트 → 구조화된 계약 JSON 변환

**처리 흐름**:
```
DOCX 파일 → [python-docx] 텍스트 추출 (코드) → [LLM] 구조화 (Agent)
```

**입력**: python-docx로 추출된 원문 텍스트

**출력**: Contract JSON

```json
{
  "contract_type": "NDA | MSA | SI | SLA | Maintenance | Other",
  "parties": {
    "party_a": { "name": "메가존클라우드", "representative": "..." },
    "party_b": { "name": "고객사명", "representative": "..." }
  },
  "dates": {
    "contract_date": "YYYY-MM-DD",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "renewal_terms": "..."
  },
  "financials": {
    "total_amount": 0,
    "currency": "KRW",
    "payment_terms": "...",
    "penalty_clause": "..."
  },
  "clauses": [
    {
      "id": "clause_001",
      "type": "liability | ip | confidentiality | termination | dispute | penalty | other",
      "title": "조항명",
      "content": "원문 텍스트",
      "paragraph": 3
    }
  ]
}
```

**상세 기능**

| 기능 | 설명 | 처리 방식 |
|------|------|-----------|
| DOCX 텍스트 추출 | 원문 텍스트, 표 데이터 추출 | 코드 (python-docx) |
| 계약 유형 자동 분류 | NDA / MSA / SI 도급 / SLA / 유지보수 / 기타 | LLM |
| 당사자 정보 추출 | 갑·을 법인명, 대표자, 담당자 | LLM |
| 핵심 날짜 추출 | 계약일, 이행기간, 만료일, 자동갱신 조건 | LLM |
| 금액 정보 추출 | 계약금액, 지급조건, 위약금/지체상금 | LLM |
| 조항 분류 | 6개 유형(책임/지재권/비밀유지/해지/분쟁해결/위약금)으로 태깅 | LLM |

---

### Agent 2: Legal Review Agent

**역할**: 계약 JSON → 리스크 조항 탐지 + 손익 분석 + 이전 버전 Diff 리스크 평가

**입력**: Parsing Agent 출력 JSON + 커스텀 리스크 판단 프롬프트

**출력**: Risk Report JSON + Diff Report JSON (이전 버전 존재 시)

#### Risk Report JSON

```json
{
  "overall_risk": "HIGH | MEDIUM | LOW",
  "risk_summary": "전체 요약 1~2문장",
  "clause_risks": [
    {
      "clause_id": "clause_001",
      "risk_level": "HIGH",
      "risk_type": "무제한_배상책임 | IP_완전이전 | 일방적_해지권 | 과도한_페널티 | 기타",
      "reason": "위험 근거 설명",
      "recommendation": "수정 제안 또는 협상 포인트",
      "financial_impact": "예상 손익 영향 (정성적)"
    }
  ],
  "key_concerns": ["핵심 우려사항 3개 이내"],
  "standard_deviation": "메가존 표준 계약 대비 주요 차이점"
}
```

#### Diff Report JSON (이전 버전 존재 시)

> Diff 자체는 코드 기반(deepdiff)으로 확정적 비교, 리스크 영향 요약만 LLM이 생성

```json
{
  "diff_summary": "변경사항 요약 (LLM 생성)",
  "risk_change": "LOW→HIGH | 동일 | 개선",
  "changes": [
    {
      "clause_id": "clause_003",
      "change_type": "ADDED | REMOVED | MODIFIED",
      "previous_content": "...",
      "current_content": "...",
      "risk_impact": "리스크 증가 | 리스크 감소 | 중립",
      "highlight": "핵심 변경 포인트 요약 (LLM 생성)"
    }
  ],
  "financial_changes": {
    "amount_delta": 0,
    "penalty_change": "..."
  },
  "new_risk_clauses": ["이번 버전에서 새로 발생한 리스크 조항 ID 목록"]
}
```

#### 탐지 대상 리스크 유형

| 리스크 유형 | 탐지 기준 | 기본 레벨 |
|------------|-----------|-----------|
| 무제한 배상책임 | 배상한도 미설정 또는 계약금액 초과 | HIGH |
| IP 완전이전 | 개발 산출물 지재권 전부 이전 조항 | HIGH |
| 일방적 해지권 | 갑 단독 해지 + 위약금 없음 | HIGH |
| 과도한 페널티 | 지체상금율 0.1%/일 초과 | MEDIUM |
| 자동갱신 조건 | 갱신 거절 기한 미명시 | MEDIUM |
| 분쟁 관할 불리 | 상대방 소재지 법원 지정 | MEDIUM |
| 비밀유지 기간 미정 | 계약 종료 후 기간 명시 없음 | LOW |

#### Tool 목록

| Tool | 처리 방식 | 설명 |
|------|-----------|------|
| `check_risk` | LLM | 커스텀 프롬프트 기반 조항별 리스크 탐지 + 손익 분석 |
| `diff_with_previous` | 코드 + LLM | DynamoDB에서 이전 버전 조회 → deepdiff로 변경점 추출 → LLM으로 리스크 영향 요약 |
| `analyze_financials` | LLM | 금액·페널티·지체상금 등 재무 리스크 분석 |

#### 프롬프트 커스터마이징

- UI에서 Legal Agent의 시스템 프롬프트를 편집·저장 가능
- DynamoDB `cas-prompt-templates` 테이블에 프롬프트 템플릿 저장
- 계약 유형별(NDA, MSA, SI 등) 별도 프롬프트 설정 가능
- 회사 내규·표준 계약 기준을 프롬프트에 반영하여 리스크 판단 기준 커스터마이징

---

### Agent 3: Search Agent (RAG)

**역할**: 전체 계약서 히스토리 자연어 검색 + 답변 생성

**입력**: 사용자 자연어 질의 (+ 선택적 고객사 필터)

**출력**: 검색 결과 + 출처 인용 포함 답변

```json
{
  "answer": "A사와의 3건 계약에서 배상 조항은 v1에서 무제한이었으나 v3에서 계약금액 100%로 한도 설정됨...",
  "sources": [
    {
      "contract_id": "...",
      "customer_name": "A사",
      "version": 1,
      "clause_content": "관련 원문 발췌",
      "relevance_score": 0.92
    }
  ],
  "total_sources": 3
}
```

**기술 구현: AWS Bedrock Knowledge Bases**

```
S3 (DOCX + 파싱 JSON) → Bedrock Knowledge Base (자동 청킹·임베딩·인덱싱)
                              ↓
                     OpenSearch Serverless (자동 프로비저닝)
                              ↓
                     retrieve_and_generate API
                              ↓
                     자연어 질의 → 관련 계약 조항 검색 + LLM 답변 생성
```

**상세 기능**

| 기능 | 설명 |
|------|------|
| 전 버전 대상 검색 | 동일 고객사의 v1, v2, v3... 모든 버전이 인덱싱되어 히스토리 검색 가능 |
| 고객사 필터 | 특정 고객사 기준으로 검색 범위 제한 가능 (메타데이터 필터) |
| 출처 인용 | 답변에 근거가 된 계약서 ID, 버전, 조항 원문 포함 |
| 자연어 질의 | "A사 배상 조항 변화 추이", "IP 이전 조항 있었던 계약", "지체상금 0.1% 초과 계약" 등 |

**기존 Diff 로직과의 역할 분담**

| | Diff (Legal Agent tool) | Search Agent (RAG) |
|---|---|---|
| 비교 대상 | v(n-1) vs v(n) 직전 버전 1:1 | 전 버전 대상 자유 검색 |
| 질의 방식 | 자동 실행 (업로드 시) | 사용자 자연어 질의 |
| 결과 | 구조화된 Diff JSON | 자연어 답변 + 출처 인용 |
| 용도 | "이번에 뭐가 바뀌었나" | "과거에 이런 조항 있었나" |

---

### Rule Engine: Workflow (코드 기반)

> Agent가 아닌 코드 기반 룰 엔진. 리스크 레벨 × 조건 매트릭스로 라우팅 결정.

**입력**: 계약서 ID + Risk Report의 overall_risk + 조건 플래그

**출력**: 워크플로우 상태 + 검토 요청 목록

**라우팅 규칙**

| 조건 | 라우팅 대상 | 필수 승인 |
|------|------------|-----------|
| Overall: HIGH | 법무팀 → 팀장 → 본부장 | 3단계 |
| Overall: MEDIUM | 팀장 → 담당 임원 | 2단계 |
| Overall: LOW | 담당자 자체 승인 | 1단계 |
| 계약금액 10억+ | 재무팀 병렬 검토 추가 | +1 |
| IP 이전 조항 포함 | 기술법무 검토 추가 | +1 |

```python
def route_reviewers(risk_report: dict, contract: dict) -> list:
    overall = risk_report["overall_risk"]
    routes = []

    if overall == "HIGH":
        routes = ["법무팀", "팀장", "본부장"]
    elif overall == "MEDIUM":
        routes = ["팀장", "담당임원"]
    else:
        routes = ["담당자"]

    if contract["financials"]["total_amount"] >= 1_000_000_000:
        routes.append("재무팀")

    has_ip = any(r["risk_type"] == "IP_완전이전" for r in risk_report["clause_risks"])
    if has_ip:
        routes.append("기술법무")

    return routes
```

**워크플로우 상태**

```
DRAFT → PARSING → REVIEWING → PENDING_APPROVAL → APPROVED / REJECTED
```

**전자서명 Mock**
- 실제 서명 연동 없이 "서명 완료" 버튼 클릭 시 서명자명 + 타임스탬프 기록
- 서명 완료 시 계약서 상태 → APPROVED 전환

---

## 4. 화면 목록 (UI)

| 화면 | 경로 | 주요 기능 |
|------|------|-----------|
| 대시보드 | `/` | 계약서 목록, 상태별 필터, 전체 현황 요약 |
| 계약서 업로드 | `/upload` | DOCX 드래그&드롭, 고객사 선택, 계약 유형 선택 |
| 분석 진행 | `/contracts/:id/analyze` | Agent 처리 단계별 진행 상태 표시 (스피너/체크) |
| 리스크 리포트 | `/contracts/:id/report` | 전체 리스크 요약 + 조항별 리스크 목록 + Diff 뷰 (탭) |
| Diff 뷰 | `/contracts/:id/diff` | 이전 버전과 조항별 변경사항 비교 (코드 기반 Diff) |
| 워크플로우 | `/contracts/:id/workflow` | 검토 요청 목록 + 승인/반려 버튼 |
| 계약서 상세 | `/contracts/:id` | 파싱 결과 + 원문 텍스트 + 전체 탭 + 우측 검색 패널 |
| **프롬프트 설정** | `/settings/prompts` | Legal Agent 시스템 프롬프트 편집 + 계약 유형별 프리셋 |

#### 검색 패널 (계약서 상세 페이지 내장)

검색은 별도 페이지가 아닌 `/contracts/:id` 레이아웃 우측에 상시 노출되는 사이드 패널로 구현한다.

| 항목 | 사양 |
|------|------|
| 위치 | 계약서 상세 페이지 우측 컬럼 |
| 기본 너비 | 전체 화면의 1/3 |
| 너비 조절 | 드래그로 리사이즈 가능 |
| 숨기기 | 토글 버튼으로 패널 접기/펼치기 |
| 구성 | 자연어 검색창 + 결과 리스트 + 출처 하이라이트 |
| 컨텍스트 | 현재 조회 중인 계약서의 고객사가 기본 필터로 적용 |

---

## 5. 데이터 모델

> 저장소: Amazon S3 (DOCX + 파싱 JSON) + Amazon DynamoDB 4테이블 + Bedrock Knowledge Base (ap-northeast-2)
> 상세 스키마: DAT-CAS-001.md 참조

```
[S3] cas-contracts 버킷
  {customer_name}/{contract_id}/v{version}.docx        ← 원본 DOCX
  {customer_name}/{contract_id}/v{version}.json        ← 파싱 결과 (KB 인덱싱 대상)

[Bedrock Knowledge Base] cas-knowledge-base
  데이터 소스: S3 cas-contracts 버킷 (*.json)
  벡터 저장소: OpenSearch Serverless (자동 프로비저닝)
  임베딩 모델: Amazon Titan Embeddings V2

[DynamoDB] cas-contracts
  id (PK), customer_name, contract_type, version, status
  s3_key, uploaded_at, uploaded_by
  clauses: List (ContractClause 중첩)
  diff_report: Map (DiffReport + DiffChange 중첩, 선택)

[DynamoDB] cas-risk-reports
  id (PK), contract_id (GSI), overall_risk, risk_summary
  standard_deviation, key_concerns, created_at
  clause_risks: List (ClauseRisk 중첩)

[DynamoDB] cas-workflow-steps
  id (PK), contract_id (GSI), step_order, department, assignee
  status (PENDING | APPROVED | REJECTED), comment
  signed_at, created_at

[DynamoDB] cas-prompt-templates
  id (PK), contract_type (GSI), prompt_name
  system_prompt: String (Legal Agent 시스템 프롬프트)
  updated_at, updated_by
```

---

## 6. 기술 스택

### 모델 운영 전략 (2단계)

| 단계 | 환경 | LLM | 이유 |
|------|------|-----|------|
| **사전 개발** | 로컬 | Groq (Llama 3.3 70B) — 무료 | API Key 즉시 발급, 무료 한도 충분 |
| **해커톤 당일** | 로컬 | AWS Bedrock Claude 3.5 Sonnet v2 | 최고 품질, 25만원 예산 내 ($1~2 수준) |

> ⚠️ **당일 필수**: `.env`의 `MODEL_PROVIDER=groq` → `MODEL_PROVIDER=bedrock` 변경 후 AWS credentials 입력

### AWS 서비스

| 영역 | 서비스 | 용도 |
|------|--------|------|
| AI 모델 | **AWS Bedrock** (Claude 3.5 Sonnet v1) | Agent 추론 엔진 |
| Agent 오케스트레이션 | **AWS Strands SDK** | Multi-Agent 파이프라인 구성 |
| RAG | **AWS Bedrock Knowledge Bases** | 계약서 히스토리 검색 (자동 청킹·임베딩·인덱싱) |
| 벡터 검색 | **Amazon OpenSearch Serverless** | Bedrock KB 벡터 저장소 (자동 프로비저닝) |
| 임베딩 | **Amazon Titan Embeddings V2** | 계약서 텍스트 벡터 변환 |
| 파일 저장 | **Amazon S3** | DOCX + 파싱 JSON 보관 |
| DB | **Amazon DynamoDB** | 계약서 메타데이터 + 리포트 + 프롬프트 템플릿 저장 |

### 개발 도구

| 도구 | 역할 | 비고 |
|------|------|------|
| **Claude Code** | 코드 생성·수정·디버깅 보조 | Bedrock 백엔드 연결 (`CLAUDE_CODE_USE_BEDROCK=1`) |
| **AWS Bedrock** | Agent LLM 추론 엔진 + Claude Code 백엔드 | Claude 3.5 Sonnet v1, ap-northeast-2 |

> Claude Code → Bedrock 연결 시 Anthropic API 크레딧 불필요. AWS 예산(25만원) 안에서 통합 관리.

### 애플리케이션 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| Frontend | Next.js 14 + Tailwind CSS | 빠른 UI 개발, App Router |
| Backend | Python (FastAPI 로컬 실행) | Strands SDK Python 네이티브 지원 |
| DOCX 파싱 | python-docx | Word 문서 텍스트·표 추출 |
| JSON Diff | deepdiff | 계약서 버전 간 구조적 비교 (코드 기반, 확정적) |
| LLM 추상화 | LiteLLM | 모델 전환 시 코드 변경 최소화 |
| AWS SDK | boto3 | Bedrock / S3 / DynamoDB / KB 연동 |
| 상태관리 | Zustand | 경량, 빠른 세팅 |

### AWS Strands SDK Agent 구성

```python
import os
from strands import Agent, tool
from strands.models import BedrockModel, LiteLLMModel

def get_model():
    provider = os.getenv("MODEL_PROVIDER", "groq")
    if provider == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
            region_name="ap-northeast-2"
        )
    return LiteLLMModel(model_id="groq/llama-3.3-70b-versatile")

model = get_model()

# --- Agent 정의 ---
parsing_agent = Agent(model=model, tools=[extract_docx_text, classify_contract, extract_parties])
legal_agent   = Agent(model=model, tools=[check_risk, diff_with_previous, analyze_financials])
search_agent  = Agent(model=model, tools=[search_contract_history])

# --- 코드 기반 로직 (Agent 아님) ---
# route_reviewers(): 리스크 레벨 기반 라우팅 (if/else)
# compute_diff(): deepdiff 기반 JSON Diff (legal_agent의 tool 내부에서 호출)
```

---

## 7. 오케스트레이션 (Strands SDK + 코드)

```
1. DOCX 업로드 → S3 저장 (버전별: {customer}/{id}/v{n}.docx)
   └─ python-docx로 텍스트 추출 (코드, 즉시)

2. Parsing Agent 실행 (동기)
   └─ 추출된 텍스트 → Bedrock Claude로 구조화 → Contract JSON
   └─ S3에 파싱 JSON 저장 → Bedrock KB 동기화 트리거

3. Legal Review Agent 실행
   ├─ check_risk: 커스텀 프롬프트 기반 리스크 탐지
   ├─ diff_with_previous: DynamoDB에서 이전 버전 조회
   │   → 존재 시 deepdiff로 변경점 추출 (코드)
   │   → LLM으로 리스크 영향 요약 (AI)
   └─ analyze_financials: 재무 리스크 분석

4. Rule Engine 실행 (코드, 즉시)
   └─ risk_report.overall_risk × 조건 매트릭스 → 검토자 목록 생성

5. DynamoDB 업데이트 + UI polling 반영

--- 별도 흐름 ---
6. 사용자 검색 질의 → Search Agent → Bedrock KB retrieve_and_generate
```

**Strands SDK 오케스트레이터 패턴**

```python
orchestrator = Agent(
    model=model,
    tools=[
        parsing_agent.as_tool(name="parse_contract", description="DOCX 파싱 후 계약 JSON 반환"),
        legal_agent.as_tool(name="review_risks", description="리스크 탐지 + Diff 리스크 평가"),
        route_reviewers,  # 일반 함수 (Agent 아님, @tool 데코레이터)
    ]
)
result = orchestrator("이 계약서를 분석하고 검토 라우팅까지 완료해줘")

# Search Agent는 별도 엔드포인트에서 독립 호출
search_result = search_agent("A사와의 계약에서 배상 조항 변화 추이를 알려줘")
```

---

## 8. 비기능 요구사항 (MVP 기준)

| 항목 | 목표 |
|------|------|
| 분석 소요 시간 | 업로드 후 리스크 리포트 생성까지 60초 이내 |
| 검색 응답 시간 | RAG 질의 후 답변까지 10초 이내 |
| 지원 파일 형식 | DOCX (Microsoft Word 형식) |
| 최대 파일 크기 | 10MB 이하 |
| 동시 처리 | MVP는 단일 계약서 처리 (큐 불필요) |
| 보안 | 로컬 실행 기준, 인증 Mock (로그인 화면만) |

---

## 9. 데모 시나리오 (해커톤 발표용)

1. **[Upload]** 영업팀 담당자가 고객사 계약서 DOCX 업로드
2. **[Parsing]** Parsing Agent가 조항 구조화 → JSON 변환 완료
3. **[Risk]** Legal Review Agent가 HIGH 리스크 3건 탐지 → 리포트 생성
4. **[Diff]** 이전 버전 대비 페널티 조항 변경 감지 → Diff 뷰 시각화 (코드 기반 + 리스크 영향 요약)
5. **[Routing]** Rule Engine이 법무팀 + 팀장 2단계 검토 자동 라우팅
6. **[Approve]** 검토자가 의견 입력 후 Mock 서명 완료 → 승인 처리
7. **[Search]** "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?" → RAG 히스토리 검색 결과 표시
8. **[Customize]** 프롬프트 설정 화면에서 리스크 탐지 기준 수정 → 즉시 재분석 결과 확인

---

## 10. 미결정 사항 (확인 필요)

- [ ] 메가존 표준 계약서 텍스트 확보 가능 여부 (Legal Review 기준선)
- [ ] 데모용 샘플 계약서 DOCX 준비 여부
- [ ] AWS 계정 및 Bedrock 모델 접근 권한 확보 여부 (Claude 3.5 Sonnet v2 활성화)
- [ ] Bedrock Knowledge Base + OpenSearch Serverless 사전 프로비저닝 여부
- [ ] Strands SDK 버전 및 팀 로컬 환경 세팅 방법 통일 필요
- [ ] S3 버킷 / DynamoDB 테이블 사전 프로비저닝 여부 (또는 LocalStack 로컬 대체)
- [ ] 발표 시간 기준 데모 흐름 우선순위 (전체 vs 핵심 시나리오)
- [ ] 팀 구성 (개발 인원 수에 따라 Search Agent / 프롬프트 UI 구현 우선순위 결정)
