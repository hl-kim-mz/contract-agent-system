# CAS 전체 아키텍처 설계서

> Contract Agent System (CAS) — MEGATHON 2026
> 기반 문서: DSC-014 합의문, Requirements v3.0

---

## 1. 시스템 개요

CAS는 메가존클라우드 영업팀이 고객사와 체결하는 계약서(NDA, MSA, SI 도급, SLA 등)를 업로드하면, **Orchestrator Agent + 4개 전문가 Agent + MCP Client**가 협력하여 조항 분석 → 리스크 탐지 → 변경 이력 추적 → 내부 검토 라우팅 → 히스토리 검색 → 사내 규정 조회를 자동 처리하는 시스템이다.

### 핵심 가설

> "계약서를 업로드하면 AI가 5분 안에 리스크 리포트를 생성하고, MZC 내부 기준에 맞게 자동 라우팅하면 계약 체결 사이클을 수일 → 당일로 단축할 수 있다."

### 설계 원칙

1. **AI가 필요한 곳에만 AI를 쓴다** — 확정적 로직(difflib Diff, 라우팅 규칙)은 코드로 처리하고, LLM은 비정형 텍스트 이해·리스크 판단·자연어 검색에만 투입
2. **Rule Engine은 절대 폐기하지 않는다** — 데모 안정성 최우선. Orchestrator는 as_tool()로 에이전트를 자율 호출하되, 라우팅 규칙은 Rule Engine이 처리
3. **플랫 모노레포** — Turborepo/Lerna 없이 디렉토리만 나란히 배치. backend/frontend 각각 독립 실행 단위

---

## 2. 전체 아키텍처 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                    Client (Next.js 14 :3000)                     │
│  업로드 & 대시보드 │ 리스크 리포트 │ Diff 뷰 │ 검색 & MCP        │
└───────────────────────────┬──────────────────────────────────────┘
                            │ HTTP (REST API)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI + Uvicorn)                    │
│                                                                   │
│  ┌─── Routers ───────────────────────────────────────────────┐   │
│  │ /contracts/*  │ /search  │ /prompts/*  │ /workflow/*      │   │
│  └───────┬───────────┬──────────┬──────────────┬─────────────┘   │
│          ▼           ▼          ▼              ▼                  │
│  ┌─── Agents / Services ─────────────────────────────────────┐   │
│  │                                                            │   │
│  │  ┌─────────────────────────────────────────────────┐       │   │
│  │  │ Orchestrator Agent (Sonnet)                      │       │   │
│  │  │   as_tool() 자율 라우팅                           │       │   │
│  │  │                                                   │       │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │       │   │
│  │  │  │ Parsing  │ │  Risk    │ │ Search   │         │       │   │
│  │  │  │ Agent    │ │  Agent   │ │ Agent    │         │       │   │
│  │  │  │ (Haiku)  │ │ (Sonnet) │ │ (Haiku)  │         │       │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘         │       │   │
│  │  └───────┼────────────┼────────────┼────────────────┘       │   │
│  │          ▼            ▼            ▼                         │   │
│  │  ┌─── Tools ──────────────────────────────────────────┐    │   │
│  │  │ extract_docx │ check_risk  │ search_history        │    │   │
│  │  │              │ diff_clauses│                        │    │   │
│  │  │              │ analyze_fin │                        │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  │                                                            │   │
│  │  ┌──── Rule Engine ─────┐  ┌──── MCP Client ───────────┐  │   │
│  │  │ route_reviewers()    │  │ mcp-server-sqlite          │  │   │
│  │  │ (Python if/else)     │  │ (컴플라이언스 규정 DB)      │  │   │
│  │  └──────────────────────┘  └────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─── Clients ───────────────────────────────────────────────┐   │
│  │ s3.py          │ dynamodb.py      │ bedrock_kb.py         │   │
│  └───────┬───────────────┬──────────────────┬────────────────┘   │
└──────────┼───────────────┼──────────────────┼────────────────────┘
           ▼               ▼                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                         AWS Services                              │
│  S3 (DOCX/JSON) │ DynamoDB (4테이블) │ Bedrock KB (RAG)         │
│  Bedrock (LLM)  │ Guardrails (보안)   │ CloudWatch (로그)        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. BE 레이어 아키텍처

```
router → agent/service → tool → client
```

| 레이어 | 역할 | 규칙 |
|--------|------|------|
| **Router** | HTTP 입출력만 처리 | clients 직접 import 금지 |
| **Agent** | Strands Agent 조합 정의 (`Agent()`, `@tool`, `as_tool()`) | 비즈니스 로직 포함 |
| **Tool** | `@tool` 데코레이터 함수 — LLM 호출 또는 코드 기반 처리 | 단일 책임 |
| **Client** | boto3 SDK 래퍼 (S3, DynamoDB, Bedrock KB) | 인프라 접근만 |
| **Service** | `rule_engine.py`만 유지 (코드 기반 워크플로우 라우팅) | AI 불필요한 규칙 |
| **Model** | Pydantic v2 데이터 모델 | 공유 스키마 정의 |

> **불채택 결정**: `repositories/` 레이어 — `clients/dynamodb.py`에 테이블별 메서드로 충분

---

## 4. AI vs 코드 역할 분담

| 구성 요소 | 유형 | 근거 |
|-----------|------|------|
| DOCX 파서 | **코드** (python-docx) | 텍스트·표 추출은 확정적 처리 |
| Orchestrator Agent | **AI** (Sonnet) | as_tool()로 전문가 에이전트 자율 선택·호출 |
| ParsingAgent | **AI** (Haiku 4.5) | DOCX 파서 결과를 구조화된 JSON으로 정제 |
| RiskAgent | **AI** (Sonnet) | 법적 리스크 판단, 재무 분석 — 도메인 지식 기반 추론 |
| SearchAgent | **AI** (Haiku 4.5) | 자연어 질의 → Bedrock KB 시맨틱 검색 |
| LegalReviewAgent | **AI** (Haiku 4.5) | Risk Report 기반 법무 검토 의견서 작성 및 승인/반려 권고 |
| MCP Client | **프로토콜** | mcp-server-sqlite로 컴플라이언스 규정 DB 자율 쿼리 |
| Diff 로직 | **코드** (difflib) | 조항 단위 비교 — SequenceMatcher |
| Workflow 라우팅 | **코드** (Rule Engine) | MZC 내부 라우팅 기준은 if/else로 충분 |
| Bedrock Guardrails | **AWS 관리형** | Converse API guardrailConfig |

---

## 5. 프로젝트 구조 (DSC-014 합의)

```
cas/                                     ← 프로젝트 루트
├── backend/                             ← BE 독립 실행 단위 (Python FastAPI)
│   ├── app/
│   │   ├── main.py                      # FastAPI 앱 엔트리 + CORS 미들웨어
│   │   ├── core/
│   │   │   ├── config.py                # Settings (pydantic-settings)
│   │   │   └── model.py                 # get_model() — Bedrock/Groq 전환
│   │   ├── routers/                     # HTTP 라우터
│   │   ├── agents/                      # Strands Agent 정의
│   │   ├── tools/                       # @tool 함수
│   │   ├── clients/                     # boto3 SDK 래퍼
│   │   ├── models/                      # Pydantic v2 모델
│   │   └── services/                    # rule_engine.py
│   ├── tests/
│   ├── pyproject.toml
│   └── .env
│
├── frontend/                            ← FE 독립 실행 단위 (Streamlit)
│
├── samples/                             ← Mock DOCX + 파싱 JSON + RAG 데이터
│   ├── contracts/
│   ├── parsed/
│   └── README.md
│
├── scripts/                             ← 공유 유틸리티 스크립트
│   ├── seed_prompts.py
│   ├── seed_demo_data.py
│   ├── verify_aws.sh
│   └── generate_mock_json.py
│
├── docs/                                ← 프로젝트 문서
│
└── .env.shared.example                  # 공통 환경변수 참고 템플릿
```

---

## 6. 기술 스택

### 모델 운영 전략

| 단계 | 환경 | LLM | 이유 |
|------|------|-----|------|
| 사전 개발 | 로컬 | Groq (Llama 3.3 70B) | 무료, API Key 즉시 발급 |
| 해커톤 당일 | EC2 | AWS Bedrock Sonnet + Haiku 4.5 | Orchestrator/RiskAgent=Sonnet 4, ParsingAgent/SearchAgent/LegalReviewAgent=Haiku 4.5 |

### AWS 서비스

| 영역 | 서비스 | 용도 |
|------|--------|------|
| AI 모델 | Bedrock (Sonnet + Haiku) | Agent 추론 엔진 |
| Agent 오케스트레이션 | Strands SDK | Multi-Agent + as_tool() |
| RAG | Bedrock Knowledge Bases | 계약서 히스토리 검색 |
| 벡터 검색 | OpenSearch Serverless | KB 벡터 저장소 |
| 임베딩 | Titan Embeddings V2 | 텍스트 벡터 변환 |
| 파일 저장 | S3 | DOCX + JSON 보관 |
| 보안 | Bedrock Guardrails | PII + Prompt Attack 차단 |
| 배포 | EC2 | Docker Compose 단일 인스턴스 |
| 모니터링 | CloudWatch Logs | 에이전트 실행 로그 |

### 애플리케이션 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| Frontend | Next.js 14 | React 기반 풀스택 프레임워크, App Router |
| Backend | FastAPI | Strands SDK Python 네이티브 |
| DOCX 파싱 | python-docx | Word 텍스트·표 추출 |
| 조항 Diff | difflib | stdlib, 외부 의존성 없음 |
| Agent 프레임워크 | Strands SDK | @tool, as_tool(), Agent 네이티브 |
| DB | DynamoDB | 완전관리형, 서버리스 |
| MCP | mcp-server-sqlite | 컴플라이언스 규정 Mock |
| 보안 | Bedrock Guardrails | Converse API 연동 |

---

## 7. .env 전략

| 파일 | 위치 | 핵심 변수 |
|------|------|-----------|
| `.env` | `backend/` | MODEL_PROVIDER, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, GROQ_API_KEY, S3_BUCKET_NAME, BEDROCK_KB_ID, DYNAMODB_CONTRACTS_TABLE, DYNAMODB_RISK_REPORTS_TABLE, DYNAMODB_WORKFLOW_TABLE, DYNAMODB_PROMPTS_TABLE |
| `.env.local` | `frontend/` | NEXT_PUBLIC_API_URL, NEXT_PUBLIC_USE_MOCK |
| `.env.shared.example` | 루트 | 공통 키 목록 참고용 |

---

## 8. 비기능 요구사항

| 항목 | 목표 |
|------|------|
| 분석 소요 시간 | 업로드 후 리스크 리포트 생성까지 60초 이내 |
| 검색 응답 시간 | RAG 질의 후 답변까지 10초 이내 |
| 지원 파일 형식 | DOCX (Microsoft Word) |
| 최대 파일 크기 | 10MB 이하 |
| 동시 처리 | 단일 계약서 처리 (MVP) |
| 배포 | EC2 Docker Compose (Plan B: ngrok, Plan C: 로컬) |
| 보안 | Bedrock Guardrails + 최소 권한 IAM |

---

## 9. Plan B 매트릭스

| 기술 | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| Agent 프레임워크 | Strands SDK | boto3 직접 호출 | — |
| 검색 | Bedrock KB | BM25 + AI 요약 | str.find + Mock |
| 프론트엔드 | Next.js 14 | FastAPI Swagger | Jupyter |
| 배포 | EC2 Docker | ngrok 터널 | 로컬 데모 |
| 보안 | Bedrock Guardrails | 프롬프트 내 규칙 | 데모 스킵 |
| MCP | mcp-server-sqlite | 직접 SQLite 쿼리 | — |

> Plan B 전환 트리거: 각 블록 종료 5분 전 미작동 시 즉시 전환
