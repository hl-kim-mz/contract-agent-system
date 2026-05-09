# 아키텍처 설계서

**서비스명**: CAS — Contract Agent System  
**트랙**: Track 3 · Multi-Agent System  
**작성일**: 2026년 5월 9일  
**플랫폼**: AWS Bedrock + Strands Agent SDK  
**프론트 데모 (Vercel)**: https://contract-agent-system.vercel.app/

---

## 1. 시스템 개요

> 계약서 DOCX를 업로드하면 3개의 AI Agent가 협력하여 리스크 탐지 → 버전 비교 → 검토 라우팅 → 히스토리 검색을 자동 처리하는 Multi-Agent 계약 검토 시스템

### 전체 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          사용자 인터페이스                                │
│                    Next.js 14 + Tailwind CSS                            │
│  [대시보드] [업로드] [리스크리포트] [Diff뷰] [워크플로우] [검색] [설정]  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP (FastAPI)
┌──────────────────────────────▼──────────────────────────────────────────┐
│                         API Gateway (FastAPI)                            │
│               /upload  /contracts  /workflow  /search  /settings        │
└──────┬──────────────┬──────────────────────────────┬────────────────────┘
       │              │                              │
       ▼              ▼                              ▼
┌──────────────┐ ┌─────────────────────────┐ ┌──────────────────┐
│  DOCX 파서   │ │  Strands Agent SDK       │ │  Rule Engine     │
│  (코드 기반) │ │  ┌───────────────────┐  │ │  (코드 기반)     │
│              │ │  │ Legal Review Agent│  │ │                  │
│ python-docx  │ │  │  ├─ check_risk    │  │ │ 리스크 레벨 ×   │
│ + regex      │ │  │  ├─ diff_prev     │  │ │ 계약 유형 ×     │
│              │ │  │  └─ analyze_fin   │  │ │ 금액 조건 →     │
│ Contract JSON│ │  └───────────────────┘  │ │ 검토자 목록     │
└──────┬───────┘ │  ┌───────────────────┐  │ └──────┬───────────┘
       │         │  │  Search Agent     │  │        │
       │         │  │  └─ search_history│  │        │
       │         │  └───────────────────┘  │        │
       │         └──────────┬──────────────┘        │
       │                    │                        │
       ▼                    ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                        AWS 인프라                             │
│                                                              │
│  ┌───────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Amazon S3 │  │  Amazon        │  │  AWS Bedrock     │   │
│  │           │  │  DynamoDB      │  │                  │   │
│  │ DOCX 원본 │  │                │  │ ┌──────────────┐ │   │
│  │ JSON 파싱 │  │ cas-contracts  │  │ │ Claude 3.5   │ │   │
│  │ 결과 저장 │  │ cas-risk-reports│  │ │ Sonnet v2    │ │   │
│  │           │  │ cas-workflow   │  │ └──────────────┘ │   │
│  └───────────┘  │ cas-prompts    │  │ ┌──────────────┐ │   │
│       │         └────────────────┘  │ │ Knowledge    │ │   │
│       │                             │ │ Bases + OSS  │ │   │
│       └─────────────────────────────→ └──────────────┘ │   │
│                   (자동 동기화)       │                  │   │
│                                      └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI vs 코드 역할 분담

> **설계 원칙**: "AI가 필요한 곳에만 AI를 쓴다."  
> 확정적이고 반복적인 로직은 코드로, 비정형 텍스트 이해와 판단이 필요한 영역만 LLM에 위임한다.

| 구성 요소 | 처리 방식 | 근거 |
|---------|---------|------|
| **DOCX 텍스트 추출** | 코드 (python-docx) | 구조적 파일 파싱 — 확정적 결과, LLM 비용 불필요 |
| **계약 유형 분류** | 코드 (regex 키워드 매칭) | 파일명·제목 패턴 매칭 — 규칙으로 충분 |
| **표준/비표준 판별** | 코드 (템플릿 코드 매칭) | MZC 표준 템플릿 식별 — 규칙으로 충분 |
| **당사자/날짜/금액 추출** | 코드 (regex) | 패턴이 명확한 구조화 데이터 추출 |
| **조항 단위 분리** | 코드 (python-docx 스타일) | "제N조" 헤딩 기준 — 확정적 |
| **버전 간 Diff 비교** | 코드 (deepdiff) | JSON 구조 비교 — 확정적, 빠름 |
| **검토 라우팅 결정** | 코드 (Rule Engine, if/else) | 리스크 레벨 × 금액 조건 매트릭스 — 일관성 필요 |
| **리스크 조항 탐지** | **AI (Legal Review Agent)** | 법적 맥락 이해, MZC 기준 대비 판단 — AI 필수 |
| **손익·재무 리스크 분석** | **AI (Legal Review Agent)** | 비정형 금융 조건 해석 — AI 필수 |
| **Diff 리스크 영향 요약** | **AI (Legal Review Agent)** | 변경 의미의 법적 해석 — AI 필수 |
| **자연어 계약 히스토리 검색** | **AI (Search Agent)** | 의미 기반 유사 검색 + 답변 생성 — AI 필수 |

---

## 3. Agent 아키텍처

### 3-1. 전체 Agent 오케스트레이션 (Strands SDK)

```python
# Strands SDK 기반 Multi-Agent 구성
orchestrator = Agent(
    model=get_model(),
    tools=[
        legal_agent.as_tool(
            name="review_contract_risks",
            description="계약서 JSON을 받아 리스크 분석 + Diff 평가 수행"
        ),
        route_reviewers,   # @tool 데코레이터 — 코드 기반 룰 엔진
    ]
)

legal_agent  = Agent(model=model, tools=[check_risk, diff_with_previous, analyze_financials])
search_agent = Agent(model=model, tools=[search_contract_history])
```

```
[Orchestrator Agent]
     │
     ├──→ parse_contract()          ← 코드 함수 (Agent 아님)
     │         └─ Contract JSON 생성
     │
     ├──→ legal_agent.as_tool()     ← Sub-Agent (Strands Agent-as-Tool)
     │         ├─ check_risk()      ← LLM tool: 리스크 탐지
     │         ├─ diff_with_previous() ← 코드+LLM 혼합 tool
     │         └─ analyze_financials() ← LLM tool: 재무 리스크
     │
     └──→ route_reviewers()         ← 코드 함수 (Agent 아님)
               └─ 검토자 목록 생성

[Search Agent]  ← 독립 실행 (별도 엔드포인트)
     └─ search_contract_history()  ← Bedrock KB retrieve_and_generate
```

---

### 3-2. DOCX 파서 (코드 기반)

**역할**: DOCX → Contract JSON (LLM 없이 완전 코드 처리)

```
입력: DOCX 파일 (S3 다운로드)
  │
  ├─ python-docx: 텍스트·표 추출
  ├─ regex: 계약 유형 분류 (파일명·제목 키워드)
  ├─ regex: 표준/비표준 판별 (MZC 템플릿 코드 패턴)
  ├─ regex: 당사자 추출 (갑/을 인접 텍스트)
  ├─ regex: 날짜·금액·지체상금율 추출
  └─ 헤딩 스타일: 조항 단위 분리 (제N조)
  │
출력: Contract JSON
  {
    contract_type, is_standard,
    parties, dates, financials,
    clauses: [ {id, type, title, content} ]
  }
```

**추출 항목 (MZC DMS 입력항목 패턴 기반)**

| # | 항목 | 추출 방식 |
|---|------|----------|
| 1 | 갑(이용자) 상호 | `regex` — "갑" 인접 텍스트 파싱 |
| 2 | 을(공급자) 상호 | `regex` — "을" 인접 텍스트 파싱 |
| 3 | 계약금액 | `regex` — 억/만원/원 패턴 |
| 4 | 계약기간 | `regex` — YYYY.MM.DD 날짜 패턴 |
| 5 | 지체상금율 | `regex` — %/일 패턴 |
| 6 | 계약 유형 | 파일명·제목 키워드 매칭 |
| 7 | 표준/비표준 | MZC 템플릿 식별자 매칭 |
| 8 | 조항 분리 | 제N조 헤딩 기준 |

---

### 3-3. Legal Review Agent (AI Agent)

**역할**: Contract JSON + MZC 기준 프롬프트 → Risk Report JSON

```
입력: Contract JSON + system_prompt (DynamoDB에서 로드)
  │
  ├─ Tool 1: check_risk()
  │    ├─ 입력: clauses[] + MZC 기준 프롬프트
  │    ├─ LLM 추론: 조항별 리스크 탐지 (9가지 유형)
  │    └─ 출력: clause_risks[], overall_risk, key_concerns
  │
  ├─ Tool 2: diff_with_previous()
  │    ├─ 코드: DynamoDB에서 이전 버전 Contract JSON 조회
  │    ├─ 코드: deepdiff로 조항 변경점 추출 (확정적)
  │    └─ LLM: 변경된 조항의 리스크 영향 요약 (해석 필요)
  │
  └─ Tool 3: analyze_financials()
       ├─ 입력: financials{} + penalty_clauses
       └─ LLM: 지체상금·배상한도·결제조건 재무 리스크 분석
  │
출력: Risk Report JSON
  {
    overall_risk: HIGH|MEDIUM|LOW,
    is_standard_contract: bool,
    escalation_required: bool,
    clause_risks: [ {clause_id, risk_level, risk_type, reason, recommendation} ],
    key_concerns: [],
    standard_deviation: "MZC 표준 대비 주요 차이점"
  }
```

**탐지 리스크 유형 (9가지)**

| 리스크 유형 | MZC 허용 기준 | 초과 시 등급 |
|------------|-------------|-------------|
| 무제한 배상책임 | 계약금액 100% 이하 한도 | HIGH |
| IP 완전이전 | 공동소유 또는 기존 IP 제외 조건 포함 | HIGH |
| 일방적 해지권 | 양 당사자 30일 서면 통지 | HIGH |
| CR 절차 미정의 | 서면 합의 + 비용 정산 기준 명시 | HIGH |
| 과도한 지체상금 | 0.05%/일 이하 | MEDIUM |
| 자동갱신 조건 | 갱신 거절 기한 명시 | MEDIUM |
| 분쟁 관할 불리 | 서울중앙지방법원 지정 | MEDIUM |
| 하자보수 기간 미달 | 1년 이상 (SI 계약) | MEDIUM |
| 비밀유지 기간 미정 | 계약 종료 후 3년 이상 | LOW |

**시스템 프롬프트 구조**

```
[역할 정의]
당신은 메가존클라우드(MZC) 계약 리스크 분석 AI입니다.

[MZC 내부 기준 (false positive 방지)]
- 지체상금율: 0.05%/일 이하 → NONE
- 배상한도: 계약금액 100% 이하 → NONE
- 분쟁 관할: 서울중앙지방법원 → NONE
... (편집 가능, DynamoDB 저장)

[탐지 지시]
위 기준을 초과하거나 미충족하는 조항만 리스크로 판단할 것.
MZC 표준 문구와 동일한 조항은 NONE으로 처리할 것.

[출력 형식]
Risk Report JSON 스키마에 맞게 반환.
```

---

### 3-4. Search Agent (RAG 기반)

**역할**: 전체 계약서 히스토리 자연어 질의 → 답변 + 출처 인용

```
입력: 자연어 질의 (+ 고객사 메타데이터 필터)
  │
  └─ Tool: search_contract_history()
       │
       ├─ Bedrock KB retrieve_and_generate API 호출
       │    ├─ 쿼리 임베딩: Titan Embeddings V2
       │    ├─ 벡터 검색: OpenSearch Serverless (kNN)
       │    ├─ 메타데이터 필터: customer_name (선택적)
       │    └─ LLM 답변 생성: Claude 3.5 Sonnet v2
       │
출력:
  {
    answer: "자연어 답변",
    sources: [
      { contract_id, customer_name, version, clause_content, relevance_score }
    ]
  }
```

**RAG 인덱싱 파이프라인**

```
S3 (*.json 파싱 결과)
     │
     └─ Bedrock KB Data Source Sync (이벤트 기반)
          │
          ├─ 자동 청킹 (조항 단위, 최대 300 tokens)
          ├─ Titan Embeddings V2 → 벡터 생성
          └─ OpenSearch Serverless 인덱스 저장
               │
               └─ 메타데이터: {customer_name, contract_type, version, contract_id}
```

---

## 4. 데이터 흐름도

### 메인 흐름 (계약서 분석)

```
[영업팀]           [API]           [처리 파이프라인]           [저장소]
   │                 │                     │                      │
   │─ DOCX 업로드 ──→│                     │                      │
   │                 │─ S3 저장 ───────────────────────────────→  │ S3
   │                 │                     │                      │
   │                 │─ parse_contract() ──→│                      │
   │                 │   (코드, 즉시)        │─ Contract JSON ─────→ │ S3
   │                 │                     │─ DynamoDB INSERT ───→ │ DB
   │                 │                     │─ KB Sync 트리거 ─────→ │ KB
   │                 │                     │                      │
   │                 │─ legal_agent() ─────→│                      │
   │                 │   (Strands SDK)      │─ check_risk          │
   │                 │                     │   (LLM, ~30s)        │
   │                 │                     │─ diff_with_previous  │
   │                 │                     │   (코드+LLM)         │
   │                 │                     │─ analyze_financials  │
   │                 │                     │   (LLM)              │
   │                 │                     │─ Risk Report ────────→│ DB
   │                 │                     │                      │
   │                 │─ route_reviewers() ──→│                      │
   │                 │   (코드, 즉시)        │─ Workflow Steps ─────→│ DB
   │                 │                     │                      │
   │← 리스크 리포트 ─│                     │                      │
   │  (polling)      │                     │                      │
```

### 검색 흐름 (별도)

```
[사용자]          [API]           [Search Agent]        [Bedrock KB]
   │               │                   │                     │
   │─ 자연어 질의 ──→│                   │                     │
   │               │─ search_agent() ──→│                     │
   │               │                   │─ retrieve_and ─────→│
   │               │                   │   generate()         │
   │               │                   │                ←─────│ 관련 조항
   │               │                   │ LLM 답변 생성        │
   │← 답변+출처 ───│← 답변+출처 ────────│                     │
```

---

## 5. 데이터 모델

### Amazon S3 — `cas-contracts-megathon-26743`

```
cas-contracts-megathon-26743/
├── {customer_name}/
│   └── {contract_id}/
│       ├── v{n}.docx          ← 원본 DOCX (Bedrock KB 소스)
│       └── v{n}.json          ← 파싱 결과 Contract JSON (KB 인덱싱 대상)
└── samples/                   ← 데모용 샘플 계약서
    ├── A사/contract_001/sample_high_risk_v1.docx
    └── B사/contract_002/sample_low_risk_v1.docx
```

### AWS Bedrock Knowledge Base — `cas-knowledge-base` (ID: HGIVHPWUVC)

```
데이터 소스:  S3 cas-contracts-megathon-26743 (*.json)
임베딩 모델:  Amazon Titan Embeddings V2
벡터 저장소:  Amazon OpenSearch Serverless (자동 프로비저닝)
청킹 전략:   Fixed size (300 tokens, 20% overlap)
메타데이터 필터 지원: customer_name, contract_type, version
```

### Amazon DynamoDB — 4개 테이블

#### `cas-contracts`

```
PK: id (String)
속성:
  customer_name   String    고객사명
  contract_type   String    NDA|MSA|SI|SLA|Maintenance|Outsourcing|Other
  version         Number    자동 채번 (고객사 기준)
  is_standard     Boolean   MZC 표준 계약 여부
  status          String    DRAFT|PARSING|RISK_REVIEWED|PENDING_APPROVAL|APPROVED|REJECTED
  s3_key          String    S3 원본 경로
  uploaded_at     String    ISO8601
  uploaded_by     String    업로더 ID
  clauses         List      ContractClause 중첩 구조
  diff_report     Map       DiffReport (이전 버전 대비, 선택)

GSI: customer_name-version-index (고객사별 버전 조회)
```

#### `cas-risk-reports`

```
PK: id (String)
GSI: contract_id (FK → cas-contracts)
속성:
  overall_risk          String    HIGH|MEDIUM|LOW
  is_standard_contract  Boolean
  escalation_required   Boolean
  risk_summary          String    AI 생성 전체 요약
  standard_deviation    String    MZC 표준 대비 차이점
  key_concerns          List      핵심 우려사항 (≤3)
  clause_risks          List      ClauseRisk 중첩 구조
    └─ clause_id, risk_level, risk_type, reason, recommendation, financial_impact
  created_at            String    ISO8601
```

#### `cas-workflow-steps`

```
PK: id (String)
GSI: contract_id (FK → cas-contracts)
속성:
  step_order   Number    검토 순서 (1부터 시작)
  department   String    계약팀|법무팀|본부장|재무팀|기술법무
  assignee     String    담당자 ID (Mock)
  is_parallel  Boolean   병렬 검토 여부
  status       String    PENDING|APPROVED|REJECTED
  comment      String    검토 의견
  signed_at    String    ISO8601 (승인/반려 시각)
  created_at   String    ISO8601
```

#### `cas-prompt-templates`

```
PK: id (String)
GSI: contract_type (NDA|MSA|SI|SLA|Maintenance|Outsourcing|All)
속성:
  prompt_name      String    프롬프트 이름
  system_prompt    String    Legal Agent 시스템 프롬프트 전문
  mzc_baseline     String    MZC 허용 기준 규칙 블록
  is_default       Boolean   계약 유형 기본값 여부
  updated_at       String    ISO8601
  updated_by       String    수정자 ID
```

### 데이터 관계도

```
cas-contracts ──1:1──→ cas-risk-reports
     │
     └──1:N──→ cas-workflow-steps

cas-prompt-templates ──(조회)──→ Legal Review Agent 실행 시
                                  system_prompt 주입

S3 ──(자동 동기화)──→ Bedrock KB ──(벡터 검색)──→ Search Agent
```

---

## 6. 기술 스택 결정 근거

### 핵심 기술 선택 이유

| 기술 | 선택 이유 | 대안 대비 장점 |
|------|---------|---------------|
| **AWS Strands Agent SDK** | 해커톤 공식 권장 SDK, Agent-as-Tool 패턴으로 계층적 Multi-Agent 구현 | LangGraph 대비 AWS 서비스 네이티브 통합, 코드 단순성 |
| **AWS Bedrock Claude 3.5 Sonnet v2** | 계약서 법적 추론 최고 성능, 긴 컨텍스트 처리 | GPT-4o 대비 AWS 에코시스템 통합, 비용 관리 용이 |
| **Bedrock Knowledge Bases + OpenSearch Serverless** | 자동 청킹·임베딩·인덱싱·검색 완전 관리형, retrieve_and_generate API 단일 호출 | 자체 구축 벡터 DB 대비 운영 부담 없음, 해커톤 당일 15분 내 프로비저닝 |
| **Amazon Titan Embeddings V2** | Bedrock KB 기본 임베딩, 한국어 포함 다국어 지원 | 외부 임베딩 API 불필요 |
| **python-docx + deepdiff** | LLM 없이 계약서 파싱·버전 비교 처리 → 비용 절감 + 정확도 향상 | LLM 파싱 대비 100% 재현 가능한 구조화 결과 |
| **FastAPI** | Python 네이티브 (Strands SDK와 동일 런타임), 비동기 처리, 자동 OpenAPI 문서 | Flask 대비 성능·타입 안전성, Django 대비 경량 |
| **Next.js 14 + App Router** | SSR + 실시간 polling 지원, Tailwind CSS로 빠른 UI 구현 | React SPA 대비 SEO·초기 로딩 개선 |
| **Amazon DynamoDB** | 서버리스, 키-값 조회 O(1), JSON 중첩 구조 네이티브 저장 | RDS 대비 스키마 변경 유연성, 운영 비용 없음 |
| **LiteLLM** | 단일 인터페이스로 Groq/Bedrock 전환 (`.env` 변수 1개 변경) | 직접 SDK 호출 대비 모델 전환 코드 수정 불필요 |

### 아키텍처 설계 결정 사항

**Q: 왜 Parsing을 Agent가 아닌 코드로 처리하는가?**  
A: 계약서 구조화는 확정적 작업(텍스트 추출, 패턴 매칭)이다. LLM으로 처리 시 비용 발생, 결과 비결정성(hallucination), 처리 시간 증가. python-docx + regex로 100% 재현 가능한 Contract JSON을 생성한다.

**Q: 왜 Diff를 코드(deepdiff)로 처리하는가?**  
A: 버전 간 조항 변경점 비교는 JSON 구조 차이를 정확하게 추출해야 한다. LLM은 요약 능력은 뛰어나지만 정확한 diff 계산은 코드가 우월하다. CAS는 코드로 정확한 diff를 추출하고, LLM은 그 diff의 법적 의미만 해석한다.

**Q: 왜 검토 라우팅을 Rule Engine(코드)으로 처리하는가?**  
A: MZC 내부 라우팅 기준은 명확한 조건 매트릭스(리스크 레벨 × 계약 금액 × 조항 유형)로 정의된다. 이를 LLM으로 처리하면 일관성을 보장할 수 없고 비용이 발생한다. if/else 룰 엔진으로 100% 일관된 라우팅을 보장한다.

---

## 7. 모델 운영 전략 (2단계)

### 단계별 전환 전략

```
┌─────────────────────────────────────────────────────────────────┐
│  Stage 1: 로컬 개발 (해커톤 당일 오전)                           │
│                                                                  │
│  MODEL_PROVIDER=groq                                            │
│  ┌─────────────────────────────┐                               │
│  │  Groq API                   │  ← API Key 즉시 발급 (무료)   │
│  │  Llama 3.3 70B Versatile    │  ← 무료 한도 충분             │
│  │  ~0.5s 응답 (빠름)          │  ← 개발·테스트 최적           │
│  └─────────────────────────────┘                               │
│                                                                  │
│  저장소: SQLite + 로컬 파일시스템 + ChromaDB (AWS 불필요)        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ .env 환경변수 1줄 변경
                            │ MODEL_PROVIDER=bedrock
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stage 2: AWS Bedrock (AWS 계정 준비 완료 후)                    │
│                                                                  │
│  MODEL_PROVIDER=bedrock                                         │
│  ┌─────────────────────────────┐                               │
│  │  AWS Bedrock                │  ← Claude 3.5 Sonnet v2       │
│  │  ap-northeast-2             │  ← 최고 품질 법적 추론        │
│  │  anthropic.claude-3-5-      │  ← 팀당 25만원 예산 내        │
│  │  sonnet-20241022-v2:0       │  ← ($1~2 예상)               │
│  └─────────────────────────────┘                               │
│                                                                  │
│  저장소: S3 + DynamoDB + Bedrock KB (OpenSearch Serverless)     │
└─────────────────────────────────────────────────────────────────┘
```

### 어댑터 패턴 (코드 변경 없이 전환)

```python
# model.py — 환경변수로 모델·저장소 전환
def get_model():
    if os.getenv("MODEL_PROVIDER") == "bedrock":
        return BedrockModel(
            model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            region_name="ap-northeast-2"
        )
    return LiteLLMModel(model_id="groq/llama-3.3-70b-versatile")

# storage.py — 동일 인터페이스, 백엔드만 교체
def get_storage() -> StorageAdapter:
    return S3Storage()     if os.getenv("STORAGE_BACKEND") == "s3"     else LocalStorage()

def get_db() -> DBAdapter:
    return DynamoDB()      if os.getenv("DB_BACKEND")      == "dynamodb" else SQLiteDB()

def get_vector_store() -> VectorStoreAdapter:
    return BedrockKB()     if os.getenv("VECTOR_STORE")    == "bedrock_kb" else ChromaDB()
```

### 환경변수 전환 맵

| 변수 | Stage 1 (로컬) | Stage 2 (AWS) |
|------|--------------|--------------|
| `MODEL_PROVIDER` | `groq` | `bedrock` |
| `STORAGE_BACKEND` | `local` | `s3` |
| `DB_BACKEND` | `sqlite` | `dynamodb` |
| `VECTOR_STORE` | `chroma` | `bedrock_kb` |

### 비용 예측 (팀당 25만원 예산)

| 서비스 | 예상 사용량 | 예상 비용 |
|--------|-----------|---------|
| Bedrock Claude 3.5 Sonnet v2 | 계약서 20건 × 약 10,000 tokens | ~$1.50 |
| Bedrock Knowledge Bases | 인덱싱 10MB + 검색 50회 | ~$0.30 |
| OpenSearch Serverless | OCU 0.5 × 8h | ~$2.00 |
| DynamoDB | 온디맨드, 소규모 | ~$0.10 |
| S3 | 1GB 미만 | ~$0.02 |
| **합계** | | **~$4 (약 5,800원)** |

> 예산 25만원 대비 약 2.3% 사용 예상

---

## 부록: 계약 상태 전이도

```
     업로드
       │
       ▼
   [DRAFT]
       │ 파싱 시작
       ▼
  [PARSING]
       │ 파싱 완료
       ▼
[RISK_REVIEWED]──────────────────────────────────────────────────→ 리스크 리포트 생성
       │ 라우팅 완료
       ▼
[PENDING_APPROVAL]
       │                    │
       │ 승인               │ 반려
       ▼                    ▼
  [APPROVED]           [REJECTED]
                           │
                           └─ 수정 후 재업로드 → DRAFT
```

## 부록: 보안 설계

| 항목 | 구현 방식 |
|------|---------|
| **AWS IAM** | Bedrock, S3, DynamoDB 최소 권한 정책 (Least Privilege) |
| **API 인증** | MVP: Mock 세션 (role: sales/legal/approver) |
| **데이터 격리** | S3 버킷 퍼블릭 액세스 완전 차단, 서버 사이드 암호화(SSE-S3) |
| **프롬프트 보안** | 시스템 프롬프트 DynamoDB 저장, 관리자 권한으로만 수정 가능 |
| **Bedrock Guardrails** | 계약서 내 PII 마스킹, 유해 콘텐츠 필터 (확장 시 적용) |
