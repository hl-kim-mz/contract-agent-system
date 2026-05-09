# Contract Agent System — Requirements (MVP)

> MEGATHON 2026 해커톤용 | 5시간 해커톤 | Track 3: Multi-Agent System | AWS Bedrock + Strands SDK
> **v3.0** — DSC-013/DSC-015 기술검토 합의 반영, 심사기준 최적화

---

## 1. 문제 정의

### 배경: MZC DMS의 현재 계약 관리 구조

메가존클라우드는 영업팀이 SFDC(Salesforce)에서 영업기회를 생성하고, DMS(Deal Management System)를 통해 계약 라이프사이클을 관리한다. 계약은 크게 **사업성 검토 → 계약검토 → 계약관리(정산) → 마감** 4단계를 거치며, QIS(구매품의), A10(내부결재), ASP/ACP/MCIS(정산) 등 복수의 시스템과 연동된다.

### 현황 및 Pain Point

| 문제 | 현재 방식 | 영향 |
|------|-----------|------|
| 계약서 형태가 프로젝트/고객사마다 상이 | 영업팀 담당자가 수동 검토 | 검토 품질 편차, 리스크 누락 |
| 법무 리스크 조항 식별 | 계약팀·법무팀 의존 (병목) | 계약 체결까지 평균 수일 소요 |
| 비표준계약 판단 기준 불명확 | 계약팀 판단에 의존 | 기준 편차, 에스컬레이션 지연 |
| 버전 변경 이력 관리 | 파일명 수기 버전관리 (v1, v2_최종, v2_최최종...) | 변경점 파악 불가 |
| 부서 간 검토 공유 | 이메일/Slack 메신저 분산 | 진행 현황 추적 불가 |
| 과거 계약 이력 검색 불가 | 파일 탐색기 수동 검색 | 유사 계약 참조 불가, 동일 실수 반복 |
| QIS 구매품의 연동 판단 | 담당자가 수동으로 QIS 요청 생성 | 누락·지연 빈번 |
| 전자서명 / 최종 승인 | 오프라인 또는 DocuSign 별도 툴 | 프로세스 단절, 상태 추적 불가 |

### 핵심 가설

> "계약서를 업로드하면 AI가 5분 안에 리스크 리포트를 생성하고, MZC 내부 기준(계약팀 검토 → 법무팀 → 본부장)에 맞게 자동 라우팅하면 계약 체결 사이클을 수일 → 당일로 단축할 수 있다."

---

## 2. 서비스 개요

**서비스명**: Contract Agent System (CAS)

메가존클라우드 영업팀이 고객사와 체결하는 다양한 계약서(NDA, MSA, SI 도급, SLA, 유지보수 등)를 업로드하면, **Orchestrator Agent + 3개의 전문가 Agent + MCP 클라이언트 + 코드 기반 로직**이 협력하여 **조항 분석 → 리스크 탐지 → 변경 이력 추적 → 내부 검토 라우팅 → 히스토리 검색 → 사내 규정 조회**를 자동 처리한다.

### 설계 원칙

> **"AI가 필요한 곳에만 AI를 쓴다."** — 확정적 로직(difflib Diff, 라우팅 규칙)은 코드로 처리하고, LLM은 비정형 텍스트 이해·리스크 판단·자연어 검색 등 AI가 필수인 영역에만 투입한다.

> **"Rule Engine은 절대 폐기하지 않는다."** — 데모 안정성 최우선. Orchestrator는 as_tool()로 에이전트를 자율 호출하되, 라우팅 규칙은 Rule Engine이 처리한다.

### MZC 실제 계약 흐름과의 대응

```
[MZC DMS 현행]                          [CAS가 지원하는 영역]
SFDC 영업기회 생성
    ↓
사업성 검토
    ↓
계약서 작성 (영업팀)          ←——  DOCX 업로드 → AI 리스크 분석
    ↓
계약검토 요청 (CM검토중)      ←——  자동 라우팅 (계약팀/법무팀/본부장)
    ↓
검토/승인 (계약팀)             ←——  워크플로우 Mock (승인/반려/의견)
    ↓
날인
    ↓
구매품의 연동             ←——  계약 히스토리 RAG 검색 + 사내 규정 MCP 조회
    ↓
정산 연동
```

### MVP 범위 (5시간 개발 기준)

**In Scope**
- DOCX 업로드 및 텍스트 파싱 (python-docx 코드 기반, LLM 불필요)
- Orchestrator Agent(Sonnet)가 as_tool()로 전문가 에이전트 자율 선택·호출
- AI 기반 리스크 분석 리포트 생성 및 조회 (RiskAgent)
- 재무 리스크 분석 (analyze_financials)
- 이전 버전 대비 조항 Diff 뷰 (difflib 조항 단위 비교 + 리스크 영향 요약)
- 계약서 버저닝 (동일 고객사 기준 자동 버전 채번)
- RAG 기반 전체 계약 히스토리 자연어 검색 (Bedrock KB, Plan B: BM25)
- MCP 클라이언트 (mcp-server-sqlite)로 사내 컴플라이언스 규정 DB 연동
- Bedrock Guardrails (PII 마스킹 + Prompt Attack 차단)
- MZC 내부 기준 검토 라우팅 + 승인/반려 Mock UI (룰 엔진 기반)
- 클라우드 배포 (EC2 Docker Compose, Plan B: ngrok 터널)

**Stretch Goal (시간 여유 시 추가)**
- 비표준계약 자동 판별 및 에스컬레이션 플래그
- CloudWatch Logs 모니터링 대시보드

**Out of Scope (명시적 제외)**
- 프롬프트 커스터마이징 UI (시간 부족)
- 프로젝트별 컨텍스트/제약사항 프롬프트 관리
- 실제 DocuSign/전자서명 연동
- 실제 Slack/이메일 알림 발송
- SFDC, A10, QIS, ASP/ACP/MCIS 실연동
- 다국어 지원
- 모바일 반응형

---

## 3. 시스템 구성

### 전체 아키텍처

```
┌──────────────────────────────────────────────────────┐
│ Orchestrator Agent (Sonnet) — as_tool() 자율 라우팅    │
│                                                        │
│  사용자 입력 (DOCX 업로드 / 자연어 질의)               │
│      ↓                                                 │
│  Orchestrator가 자율 판단:                              │
│    ├─ "계약서 분석해줘" → ParsingAgent + RiskAgent      │
│    ├─ "과거 이력 찾아줘" → SearchAgent (KB)             │
│    ├─ "사내 규정 확인해줘" → MCP (mcp-server-sqlite)   │
│    └─ "이 조항 위험한가?" → RiskAgent 단독              │
│                                                        │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ ParsingAgent     │  │ RiskAgent        │              │
│  │ as_tool(Haiku)   │  │ as_tool(Sonnet)  │              │
│  └────────┬────────┘  └────────┬────────┘              │
│           ↓                     ↓                       │
│  Rule Engine (Python if/else — 변경 없음, 안정성 유지)  │
│           ↓                                             │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ SearchAgent      │  │ MCP Client       │              │
│  │ as_tool(Haiku)   │  │ (mcp-server-     │              │
│  │ KB retrieve      │  │  sqlite)         │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                        │
│  ── Bedrock Guardrails ──                              │
│  입력: PII/Prompt Attack 차단                           │
│  출력: 민감정보 마스킹                                  │
└──────────────────────────────────────────────────────────┘

배포: EC2 단일 (Docker Compose) | Plan B: ngrok 터널
모니터링: CloudWatch Logs 자동 수집
```

### AI vs 코드 역할 분담

| 구성 요소 | 유형 | 근거 |
|-----------|------|------|
| **DOCX 파서** | 코드 (python-docx) | 텍스트·표 추출은 확정적 처리 — LLM 불필요 |
| **Orchestrator Agent** | AI Agent (Sonnet) | as_tool()로 전문가 에이전트 자율 선택·호출 |
| **ParsingAgent** | AI Agent (Haiku) | DOCX 파서 결과를 구조화된 Contract JSON으로 정제 |
| **RiskAgent** | AI Agent (Sonnet) | 법적 리스크 판단, 재무 분석 — 도메인 지식 기반 추론 필수 |
| **SearchAgent** | AI Agent (Haiku) | 자연어 질의 → Bedrock KB 시맨틱 검색 + 답변 생성 |
| **MCP Client** | 표준 프로토콜 | mcp-server-sqlite로 사내 컴플라이언스 규정 DB 자율 쿼리 |
| Diff 로직 | 코드 (tool) | 조항 단위 비교 — difflib SequenceMatcher |
| Workflow 라우팅 | 코드 (Rule Engine) | MZC 내부 라우팅 기준은 if/else로 충분 |
| **Bedrock Guardrails** | AWS 관리형 | Converse API guardrailConfig로 PII/Prompt Attack 차단 |

---

### DOCX 파서 (코드 기반)

**역할**: DOCX 파일 → 텍스트 추출 + 규칙 기반 구조화 (LLM 없이 python-docx + regex)

**출력**: Contract JSON

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

**상세 기능**

| 기능 | 설명 | 처리 방식 |
|------|------|-----------|
| DOCX 텍스트 추출 | 원문 텍스트, 표 데이터 추출 | 코드 (python-docx) |
| 계약 유형 분류 | 파일명·제목 키워드 매칭 | 코드 (regex) |
| 표준/비표준 판별 플래그 | MZC 표준계약서 여부 (파일명·템플릿 코드 매칭) | 코드 (regex) |
| 당사자 정보 추출 | "갑"(메가존클라우드), "을"(고객사) 키워드 파싱 | 코드 (regex) |
| 핵심 날짜 추출 | 날짜 패턴 정규식 매칭 | 코드 (regex) |
| 금액 정보 추출 | 금액 패턴 정규식 (억/만원 등) | 코드 (regex) |
| 지체상금율 추출 | "%/일" 패턴 추출 | 코드 (regex) |
| 조항 분리 | 단락 헤딩(제N조) 기준으로 조항 분리 | 코드 (python-docx 스타일) |

---

### ParsingAgent (Haiku)

**역할**: DOCX 파서 출력을 입력받아 구조화된 Contract JSON으로 정제

- as_tool()로 Orchestrator에 노출
- Haiku 모델 사용 (비용 효율, 단순 구조화 작업)
- DOCX 파서의 regex 추출 결과를 검증·보완

---

### RiskAgent (Sonnet)

**역할**: Contract JSON → 리스크 조항 탐지 + 재무 분석 + 이전 버전 Diff 리스크 평가

**탐지 대상 리스크 유형 (MZC 기준)**

| 리스크 유형 | MZC 기준 | 탐지 조건 | 기본 레벨 |
|------------|---------|-----------|-----------|
| 무제한 배상책임 | 계약금액 100% 이내 | 배상한도 미설정 또는 계약금액 초과 | HIGH |
| IP 완전이전 | 공동소유 또는 기존 IP 제외 | 개발 산출물 지재권 전부 이전 조항 | HIGH |
| 일방적 해지권 | 양 당사자 서면 통지 30일 전 | 갑 단독 해지 + 위약금 없음 | HIGH |
| 과도한 지체상금 | 0.05%/일 이내 | 0.1%/일 초과 | MEDIUM |
| 자동갱신 조건 | 갱신 거절 기한 명시 | 갱신 거절 기한 미명시 | MEDIUM |
| 분쟁 관할 불리 | 서울중앙지방법원 | 상대방 소재지 법원 지정 | MEDIUM |
| 비밀유지 기간 미정 | 계약 종료 후 3년 | 계약 종료 후 기간 명시 없음 | LOW |
| 하자보수 기간 미달 | 1년 이상 | 1년 미만 명시 (SI 계약) | MEDIUM |
| CR 절차 미정의 | 서면 합의 + 비용 정산 기준 | 변경요청(CR) 처리 절차 미명시 (SI) | HIGH |

**출력: Risk Report JSON**

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

**Tool 목록**

| Tool | 처리 방식 | 설명 |
|------|-----------|------|
| `check_risk` | LLM | MZC 기준 프롬프트 기반 조항별 리스크 탐지 + 손익 분석 |
| `diff_clauses` | 코드 + LLM | DynamoDB에서 이전 버전 조회 → difflib SequenceMatcher 조항 단위 비교 → LLM 리스크 영향 요약 |
| `analyze_financials` | LLM | 계약금액·지체상금·하자보수 등 재무 리스크 분석 |

---

### SearchAgent (Haiku)

**역할**: 전체 계약서 히스토리 자연어 검색 + 답변 생성

- as_tool()로 Orchestrator에 노출
- Haiku 모델 사용 (비용 효율)
- Bedrock KB retrieve 사용 (Plan B: BM25 + SQLite FTS)

**MZC 업무 맥락 활용 예시 질의**

| 질의 예시 | 활용 상황 |
|-----------|-----------|
| "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?" | 동일 고객사 재계약 시 협상 참고 |
| "SI 도급 계약에서 CR 절차가 명시된 사례" | 비표준계약 검토 시 레퍼런스 확인 |
| "지체상금 0.1% 초과로 체결된 계약 목록" | 리스크 현황 파악 |
| "IP 완전이전 조항이 있었던 계약" | 법무팀 검토 전 사전 스크리닝 |
| "B사 NDA 만료일 확인" | 계약 갱신 시점 관리 |

---

### MCP Client (mcp-server-sqlite)

**역할**: 사내 컴플라이언스 규정 DB Mock 연동

- `mcp-server-sqlite` 오픈소스 MCP 서버 사용
- 사내 규정 3~5건 샘플 데이터로 Mock DB 구성
- Orchestrator가 "사내 규정 확인해줘" 질의 시 MCP가 SQLite 자율 쿼리 생성·실행
- MCP 프로토콜 표준 준수 → 실운영 시 사내 컴플라이언스 DB로 커넥터만 교체

---

### Bedrock Guardrails

**역할**: 입출력 보안 필터링

- Converse API `guardrailConfig` 파라미터로 연동
- **입력 필터**: PII(개인정보) 탐지 + Prompt Attack(탈옥) 차단
- **출력 필터**: 민감정보 마스킹
- 데모에서 악성 프롬프트 입력 → 즉시 차단 시연
- T-60분 전 콘솔에서 Guardrails 정책 사전 생성 필수

---

### Rule Engine: Workflow (코드 기반)

> MZC 실제 계약검토 프로세스를 반영한 라우팅 룰엔진

**MZC 내부 검토 라우팅 규칙**

| 조건 | 라우팅 대상 | 검토 순서 |
|------|------------|-----------|
| Overall: HIGH | 계약팀 → 법무팀 → 본부장 | 순차 3단계 |
| Overall: MEDIUM | 계약팀 → 담당 임원 | 순차 2단계 |
| Overall: LOW | 영업팀 담당자 자체 승인 | 1단계 |
| 계약금액 10억+ | 재무팀 병렬 검토 추가 | +1 (병렬) |
| IP 완전이전 조항 | 기술법무 검토 추가 | +1 (순차) |
| 비표준계약 플래그 | 계약팀 에스컬레이션 필수 | 최우선 |
| CR 절차 미정의 (SI) | 계약팀 + 프로젝트팀장 | +1 (병렬) |

**MZC 계약 상태 전이 (CAS 내부)**

```
DRAFT → PARSING → RISK_REVIEWED → PENDING_APPROVAL → APPROVED / REJECTED
                                        ↓
                              (계약팀 CM검토중 상태 대응)
```

**DMS 연계 참고 (데모 설명용)**
```
CAS 상태           DMS 대응 상태
────────────────────────────────
RISK_REVIEWED   ↔  계약검토 요청 (CM검토중)
PENDING_APPROVAL↔  검토 진행 중
APPROVED        ↔  계약검토 승인 → 날인 단계
REJECTED        ↔  계약검토 반려 → 수정 요청
```

---

## 4. 화면 목록 (UI — Streamlit)

| 화면 | 주요 기능 |
|------|-----------|
| **업로드 & 대시보드** | 계약서 목록, 상태별 필터, DOCX 드래그&드롭 업로드, 고객사·유형 선택, `st.spinner` 진행 표시 |
| **리스크 리포트** | 전체 리스크 요약 + 조항별 리스크 목록 + 색상 코딩된 리스크 뱃지 (HIGH: red, MEDIUM: orange, LOW: green) + 워크플로우 승인/반려 Mock |
| **Diff 뷰** (탭) | 이전 버전 대비 조항별 변경사항 비교 (difflib 기반) + 리스크 영향 요약 |
| **검색 & MCP** | RAG 자연어 검색 (Bedrock KB) + MCP 사내 규정 조회 + 채팅 인터페이스 |

---

## 5. 데이터 모델

> 저장소: Amazon S3 (DOCX + 파싱 JSON) + DynamoDB (구조화 데이터) + Bedrock Knowledge Base (Plan B: BM25)

```
[S3] cas-contracts-{팀명}/
  {customer_name}/{contract_id}/v{version}.docx        ← 원본 DOCX
  {customer_name}/{contract_id}/v{version}.json        ← 파싱 결과 (KB 인덱싱 대상)

[Bedrock Knowledge Base] cas-knowledge-base (Plan B: BM25)
  데이터 소스: S3 파싱 JSON 파일
  벡터 저장소: OpenSearch Serverless (자동 프로비저닝)
  임베딩 모델: Amazon Titan Embeddings V2

[DynamoDB] cas-contracts
  id (PK: String), customer_name, contract_type, version, status
  is_standard, s3_key, uploaded_at, uploaded_by
  clauses_json: String (Contract JSON 직렬화)
  diff_report_json: String (DiffReport 직렬화, 선택)

[DynamoDB] cas-risk-reports
  id (PK: String), contract_id (GSI), overall_risk, risk_summary
  is_standard_contract, escalation_required
  standard_deviation, created_at
  clause_risks_json: String (ClauseRisk 배열 직렬화)
  key_concerns_json: String

[DynamoDB] cas-workflow-steps
  id (PK: String), contract_id (GSI), step_order, department, assignee
  status (PENDING | APPROVED | REJECTED), comment
  signed_at, created_at

[DynamoDB] cas-prompt-templates
  id (PK: String), contract_type (GSI), prompt_name
  system_prompt: String
  updated_at, updated_by

[MCP] mcp-server-sqlite — compliance.db
  사내 컴플라이언스 규정 Mock DB (3~5건 샘플)
```

---

## 6. 기술 스택

### 모델 운영 전략

| 단계 | 환경 | LLM | 이유 |
|------|------|-----|------|
| **사전 개발** | 로컬 | Groq (Llama 3.3 70B) — 무료 | API Key 즉시 발급, 무료 한도 충분 |
| **해커톤 당일** | EC2 | AWS Bedrock Sonnet + Haiku | Orchestrator/RiskAgent=Sonnet, ParsingAgent/SearchAgent=Haiku |

> ⚠️ **당일 필수**: `.env`의 `MODEL_PROVIDER=groq` → `MODEL_PROVIDER=bedrock` 변경 후 AWS credentials 입력

### AWS 서비스

| 영역 | 서비스 | 용도 |
|------|--------|------|
| AI 모델 | **AWS Bedrock** (Sonnet + Haiku) | Agent 추론 엔진 |
| Agent 오케스트레이션 | **AWS Strands SDK** | Multi-Agent 파이프라인 + as_tool() |
| RAG | **AWS Bedrock Knowledge Bases** | 계약서 히스토리 검색 (Plan B: BM25) |
| 벡터 검색 | **Amazon OpenSearch Serverless** | Bedrock KB 벡터 저장소 |
| 임베딩 | **Amazon Titan Embeddings V2** | 계약서 텍스트 벡터 변환 |
| 파일 저장 | **Amazon S3** | DOCX + 파싱 JSON 보관 |
| 보안 | **Bedrock Guardrails** | PII 마스킹 + Prompt Attack 차단 |
| 배포 | **Amazon EC2** | Docker Compose 단일 인스턴스 |
| 모니터링 | **CloudWatch Logs** | 에이전트 실행 로그 자동 수집 |

### 애플리케이션 스택

| 영역 | 기술 | 선택 이유 |
|------|------|-----------|
| Frontend | **Streamlit** | 4페이지+탭, Python 단일 스택, 빠른 프로토타이핑 |
| Backend | Python (FastAPI) | Strands SDK Python 네이티브 지원 |
| DOCX 파싱 | python-docx | Word 문서 텍스트·표 추출 |
| 조항 Diff | **difflib** | 조항 단위 SequenceMatcher 비교 (stdlib, 외부 의존성 없음) |
| Agent 프레임워크 | **Strands SDK** | `@tool`, `as_tool()`, `Agent` 네이티브 지원 |
| DB | **DynamoDB** | 완전관리형, 서버리스, On-Demand 용량, 자동 스케일링 |
| MCP | **mcp-server-sqlite** | 사내 컴플라이언스 규정 DB Mock 연동 |
| 보안 | **Bedrock Guardrails** | Converse API guardrailConfig 연동 |
| AWS SDK | boto3 | Bedrock / S3 / KB 연동 |
| 배포 | **Docker Compose on EC2** | 단일 인스턴스, Plan B: ngrok 터널 |

### Strands SDK Agent 구성

```python
from strands import Agent, tool
from strands.models import BedrockModel

sonnet = BedrockModel(model_id="anthropic.claude-sonnet-4-20250514", region_name="us-west-2")
haiku  = BedrockModel(model_id="anthropic.claude-haiku-4-20250414", region_name="us-west-2")

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

parsing_agent = Agent(model=haiku, tools=[...])
risk_agent    = Agent(model=sonnet, tools=[check_risk, diff_clauses, analyze_financials])
search_agent  = Agent(model=haiku, tools=[search_history])

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

## 7. 오케스트레이션 흐름

```
1. DOCX 업로드 → S3 저장 (s3://{bucket}/{customer}/{id}/v{n}.docx)
   └─ python-docx로 텍스트 추출 (코드, 즉시)

2. Orchestrator Agent가 자율 판단하여 에이전트 호출:

   [업로드 흐름]
   ├─ ParsingAgent (Haiku, as_tool)
   │    └─ DOCX 파서 결과 → Contract JSON 정제 → DynamoDB 저장
   │
   ├─ RiskAgent (Sonnet, as_tool)
   │    ├─ check_risk: MZC 기준 프롬프트 기반 리스크 탐지
   │    ├─ diff_clauses: DynamoDB에서 이전 버전 조회 → difflib → LLM 리스크 요약
   │    └─ analyze_financials: 재무 리스크 분석
   │
   └─ Bedrock Guardrails 래핑
        ├─ 입력: PII/Prompt Attack 차단
        └─ 출력: 민감정보 마스킹

3. Rule Engine 실행 (코드, 즉시)
   └─ overall_risk × MZC 라우팅 매트릭스 → 검토자 목록 생성
      (계약팀 → 법무팀 → 본부장 순차 / 재무팀·기술법무 병렬)

4. DynamoDB 업데이트 + Streamlit UI 반영

--- 별도 흐름 ---
5. 사용자 검색 질의 → Orchestrator → SearchAgent (Haiku, as_tool) → Bedrock KB retrieve
6. 사내 규정 질의 → Orchestrator → MCP Client → mcp-server-sqlite 자율 쿼리
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
| 배포 | EC2 클라우드 배포 (Plan B: ngrok 터널, Plan C: 로컬 데모) |
| 보안 | Bedrock Guardrails (PII/Prompt Attack) + 최소 권한 IAM |
| 모니터링 | CloudWatch Logs 자동 수집 |

---

## 9. 데모 시나리오 (해커톤 발표용 — 2분 라이브 데모)

> "계약 체결 수일 → 당일. 건당 $0.06. MZC 전 부서 확장 가능"

### 2분 라이브 데모 스크립트

| 시간 | 행동 | 심사 항목 |
|------|------|----------|
| **0:00~0:15** | AWS URL 접속 → "클라우드에 배포된 계약 분석 에이전트입니다" | 완성도(배포) |
| **0:15~0:40** | DOCX 업로드 → AI 리스크 리포트 실시간 생성 (HIGH 3건) | 고객임팩트 + 완성도 |
| **0:40~0:55** | "무제한 배상, CR 절차 미정의" → 법무팀 자동 에스컬레이션 | 에이전트 자율성 |
| **0:55~1:10** | 채팅: "사내 규정 확인해줘" → MCP가 SQLite 자율 쿼리 | 기술혁신(MCP) |
| **1:10~1:25** | RAG: "과거 CR 조항 이력?" → Bedrock KB 시맨틱 검색 | 기술혁신(RAG) |
| **1:25~1:40** | 악성 프롬프트 입력 → Guardrails 즉시 차단 | 기술혁신(보안) |
| **1:40~2:00** | "계약 체결 수일 → 당일. 건당 $0.06. MZC 전 부서 확장 가능" | 고객임팩트(ROI) |

### 데모 상세 시나리오

1. **[URL 접속]** EC2 퍼블릭 URL에서 Streamlit 앱 접속 (클라우드 배포 증명)
2. **[Upload]** 영업팀 담당자가 고객사 SI 도급 계약서 DOCX 업로드 (비표준계약)
3. **[Risk]** RiskAgent가 HIGH 리스크 3건 탐지
   - 무제한 배상책임 (배상한도 미설정)
   - CR 절차 미정의 (변경요청 처리 기준 없음)
   - 지체상금 0.15%/일 (MZC 기준 0.05% 초과)
4. **[Routing]** Rule Engine이 MZC 기준으로 자동 라우팅 → 법무팀 에스컬레이션
5. **[MCP]** "사내 규정 확인해줘" → MCP가 컴플라이언스 DB 자율 쿼리
6. **[Search]** "과거 CR 조항 이력?" → Bedrock KB 시맨틱 검색
7. **[Guardrails]** 악성 프롬프트 입력 → Guardrails 즉시 차단
8. **[Impact]** 비즈니스 임팩트 수치 제시

### Q&A 예상 질문 사전 대비

| 예상 질문 | 준비된 답변 |
|-----------|-----------|
| "에이전트가 오판하면?" | "Rule Engine이 최종 라우팅을 검증합니다. AI 판단 + 규칙 기반 이중 안전장치" |
| "실운영 확장은?" | "ECS Auto Scaling으로 수백 건/일 처리 가능. 현재 DynamoDB + S3 아키텍처가 그대로 확장" |
| "MCP DB가 Mock인데?" | "MCP 프로토콜 표준 준수. 실운영 시 사내 컴플라이언스 DB로 커넥터만 교체" |
| "보안은 충분한가?" | "Bedrock Guardrails + IAM 최소 권한. 엔터프라이즈 도입 시 VPC 엔드포인트 추가" |

---

## 10. 타임라인 (5시간)

| 시간 | 모듈 | 비고 |
|------|------|------|
| **T-60분** | AWS 사전 체크: Bedrock 모델 접근 + Guardrails 정책 생성(콘솔) + EC2 IAM 권한 확인 + 한국어 KB smoke test | **사람 필수** |
| **T+0:00~0:30** | 환경 셋업 + Strands 설치 + Bedrock 검증 + KB Quick Create(병렬) | |
| **T+0:30~1:00** | DOCX 파싱 + 정규식 엔티티 추출 + mcp-server-sqlite 세팅 | MCP 보강 |
| **T+1:00~1:30** | ParsingAgent (Haiku) + as_tool() 래핑 | |
| **T+1:30~2:30** | RiskAgent (Sonnet) + analyze_financials + Guardrails API 연동 + Orchestrator Agent | **핵심 블록** |
| **T+2:30~3:00** | SearchAgent + KB 연동 (실패 시 BM25) | |
| **T+3:00~3:30** | Streamlit UI — 업로드 + 리포트 + Diff + 검색 | |
| **T+3:30~4:00** | Rule Engine 라우팅 + 승인 UI + 통합 테스트 | |
| **T+4:00~4:30** | EC2 Docker Compose 배포 (실패 시 ngrok) | 배포 보강 |
| **T+4:30~5:00** | **데모 리허설 + 버그픽스 — 절대 타협 없음** | |

---

## 11. Plan B 매트릭스

| 기술 | Plan A | Plan B | Plan C |
|------|--------|--------|--------|
| Agent 프레임워크 | Strands SDK | boto3 직접 호출 | — |
| 검색 | Bedrock KB | BM25 + AI 요약 | str.find + Mock |
| 프론트엔드 | Streamlit | FastAPI Swagger | Jupyter |
| 배포 | EC2 Docker | ngrok 터널 | 로컬 데모 |
| 보안 | Bedrock Guardrails | 프롬프트 내 규칙 | 데모 스킵 |
| MCP | mcp-server-sqlite | 직접 SQLite 쿼리 | — |

> **Plan B 전환 트리거**: 각 블록 종료 5분 전 미작동 시 즉시 Plan B 전환

---

## 12. 사전 체크리스트 (T-60분)

### AWS 사전 조치 (해커톤 전날 밤 or 당일 아침)

| 항목 | 담당 | 중요도 |
|------|------|--------|
| **EC2 IAM 권한 검증** (`ec2:RunInstances`, `ec2:CreateSecurityGroup`) | 사람 | CRITICAL |
| **Bedrock Guardrails 정책 생성** (콘솔에서 PII + Prompt Attack 정책) | 사람 | HIGH |
| **한국어 KB 검색 smoke test** (샘플 3건 + 질의 2개) | 사람 | HIGH |
| **Bedrock 모델 접근 확인** (Sonnet + Haiku, 리전 확인) | 사람 | HIGH |
| **모델 버전 통일** (스택 표 ↔ 코드 일치) | 사람 | MEDIUM |

### 코드 착수 전 확정

| 항목 | 상태 |
|------|------|
| RiskAgent Pydantic 스키마 (`financial_impact` 포함) | 즉시 정의 |
| structured_output 실패 fallback (try/except + raw 파싱) | 코드 템플릿 준비 |
| difflib 조항 단위 비교 구현 패턴 | 합의 완료 |
| Plan B 전환 트리거 (블록 종료 5분 전 미작동 → 즉시 전환) | 합의 완료 |

---

## 13. 미결정 사항 (확인 필요)

- [ ] MZC 표준 계약서 텍스트 확보 가능 여부 (Mock 사용 — Claude로 기준선 Mock 텍스트 생성)
- [ ] AWS 계정 및 Bedrock 모델 액세스 신청 (Sonnet + Haiku, 당일 계정 생성 후 즉시)
- [ ] Bedrock Knowledge Base + OpenSearch Serverless 사전 프로비저닝 여부
- [ ] Strands SDK 버전 및 팀 로컬 환경 세팅 방법 통일
- [x] 발표 시간 기준 데모 흐름 우선순위 → 2분 라이브 데모 스크립트 확정
- [ ] 팀 구성 확정 (역할 분담 명시적 발표 필요 — 협업 점수)
- [ ] EC2 IAM 권한 해커톤 전날 밤 사전 검증
- [ ] Guardrails 정책 사전 생성 (콘솔 작업)
