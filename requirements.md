# Contract Agent System — Requirements (MVP)

> MEGATHON 2026 해커톤용 | 1일 MVP | Track 3: Multi-Agent System | AWS Bedrock + Strands SDK
> **v2.0** — MZC DMS 실제 계약 흐름 및 내부 업무 맥락 반영

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

메가존클라우드 영업팀이 고객사와 체결하는 다양한 계약서(NDA, MSA, SI 도급, SLA, 유지보수 등)를 업로드하면, **3개의 AI Agent + 코드 기반 로직**이 협력하여 **조항 분석 → 리스크 탐지 → 변경 이력 추적 → 내부 검토 라우팅 → 히스토리 검색**을 자동 처리한다.

### 설계 원칙

> **"AI가 필요한 곳에만 AI를 쓴다."** — 확정적 로직(JSON Diff, 라우팅 규칙)은 코드로 처리하고, LLM은 비정형 텍스트 이해·리스크 판단·자연어 검색 등 AI가 필수인 영역에만 투입한다.

### MZC 실제 계약 흐름과의 대응

```
[MZC DMS 현행]                          [CAS가 지원하는 영역]
SFDC 영업기회 생성
    ↓
사업성 검토 (A10 결재)
    ↓
계약서 작성 (영업팀)          ←——  DOCX 업로드 → AI 리스크 분석
    ↓
계약검토 요청 (CM검토중)      ←——  자동 라우팅 (계약팀/법무팀/본부장)
    ↓
계약팀 검토/승인              ←——  워크플로우 Mock (승인/반려/의견)
    ↓
날인 (DocuSign)
    ↓
QIS 구매품의 연동             ←——  계약 히스토리 RAG 검색
    ↓
ASP/ACP/MCIS 정산 연동
```

### MVP 범위 (1일 개발 기준)

**In Scope**
- DOCX 업로드 및 텍스트 파싱 (python-docx 코드 기반, LLM 불필요)
- AI 기반 리스크 분석 리포트 생성 및 조회
- Legal Agent 리스크 판단 프롬프트 커스터마이징 UI
- 이전 버전 대비 조항 Diff 뷰 (코드 기반 JSON Diff + 리스크 영향 요약)
- 계약서 버저닝 (동일 고객사 기준 자동 버전 채번)
- RAG 기반 전체 계약 히스토리 자연어 검색
- MZC 내부 기준 검토 라우팅 + 승인/반려 Mock UI (룰 엔진 기반)
- 계약서 목록 및 상태 대시보드

**Stretch Goal (시간 여유 시 추가)**
- 프로젝트별 컨텍스트/제약사항 프롬프트 관리
- 비표준계약 자동 판별 및 에스컬레이션 플래그

**Out of Scope (명시적 제외)**
- 실제 DocuSign/전자서명 연동
- 실제 Slack/이메일 알림 발송
- SFDC, A10, QIS, ASP/ACP/MCIS 실연동
- 다국어 지원
- 모바일 반응형

---

## 3. 시스템 구성

### 전체 파이프라인 흐름

```
DOCX 업로드
    ↓
[python-docx] ──→ 텍스트·표 추출 + 규칙 기반 구조화 (코드, 확정적)
    ↓
Contract JSON (코드 생성)
    ↓
    ├──→ [Legal Review Agent] ──→ Risk Report JSON
    │        ├─ tool: check_risk (MZC 기준 리스크 탐지)
    │        └─ tool: diff_with_previous (deepdiff + LLM 리스크 영향 요약)
    │                    ↓
    │              Diff Report (이전 버전 존재 시)
    │
    ├──→ [Rule Engine] ──→ MZC 내부 검토 라우팅 (코드, if/else 기반)
    │                          ↓
    │                    계약팀 → 법무팀 → 본부장 순차 검토 요청
    │
    └──→ S3 저장 + Bedrock KB 동기화 (RAG 인덱싱)

─── 별도 사용자 질의 시 ───
[Search Agent] ──→ RAG 히스토리 검색 (Bedrock Knowledge Bases)
```

### AI vs 코드 역할 분담

| 구성 요소 | 유형 | 근거 |
|-----------|------|------|
| **DOCX 파서** | 코드 (python-docx) | 텍스트·표 추출은 확정적 처리 — LLM 불필요 |
| **Legal Review Agent** | AI Agent | 법적 리스크 판단, 손익 분석 — 도메인 지식 기반 추론 필수 |
| **Search Agent** | AI Agent | 자연어 질의 → 전 버전 계약 히스토리 검색 + 답변 생성 |
| Diff 로직 | 코드 (tool) | JSON 구조 비교는 확정적 — deepdiff로 즉시·정확하게 처리 |
| Workflow 라우팅 | 코드 (Rule Engine) | MZC 내부 라우팅 기준은 if/else로 충분 |

---

### DOCX 파서 (코드 기반)

**역할**: DOCX 파일 → Contract JSON 변환 (LLM 없이 python-docx + 규칙 기반)

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

### Agent 2: Legal Review Agent

**역할**: 계약 JSON → 리스크 조항 탐지 + 손익 분석 + 이전 버전 Diff 리스크 평가

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
| `diff_with_previous` | 코드 + LLM | DynamoDB에서 이전 버전 조회 → deepdiff로 변경점 추출 → LLM으로 리스크 영향 요약 |
| `analyze_financials` | LLM | 계약금액·지체상금·하자보수 등 재무 리스크 분석 |

**프롬프트 커스터마이징**
- UI에서 Legal Agent 시스템 프롬프트 편집·저장 가능
- DynamoDB `cas-prompt-templates` 테이블에 저장
- 계약 유형별(NDA, MSA, SI, 외주도급 등) 별도 프롬프트 설정 가능
- MZC 내규·표준 계약 기준을 프롬프트에 반영

---

### Agent 3: Search Agent (RAG)

**역할**: 전체 계약서 히스토리 자연어 검색 + 답변 생성

**MZC 업무 맥락 활용 예시 질의**

| 질의 예시 | 활용 상황 |
|-----------|-----------|
| "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?" | 동일 고객사 재계약 시 협상 참고 |
| "SI 도급 계약에서 CR 절차가 명시된 사례" | 비표준계약 검토 시 레퍼런스 확인 |
| "지체상금 0.1% 초과로 체결된 계약 목록" | 리스크 현황 파악 |
| "IP 완전이전 조항이 있었던 계약" | 법무팀 검토 전 사전 스크리닝 |
| "B사 NDA 만료일 확인" | 계약 갱신 시점 관리 |

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

## 4. 화면 목록 (UI)

| 화면 | 경로 | 주요 기능 |
|------|------|-----------|
| 대시보드 | `/` | 계약서 목록, 상태별 필터(리스크 레벨/검토단계), 전체 현황 요약 |
| 계약서 업로드 | `/upload` | DOCX 드래그&드롭, 고객사 선택, 계약 유형 선택, 표준/비표준 플래그 |
| 분석 진행 | `/contracts/:id/analyze` | Agent 처리 단계별 진행 상태 표시 (스피너/체크) |
| 리스크 리포트 | `/contracts/:id/report` | 전체 리스크 요약 + 조항별 리스크 목록 + Diff 뷰 (탭) |
| Diff 뷰 | `/contracts/:id/diff` | 이전 버전과 조항별 변경사항 비교 (코드 기반 Diff) |
| 워크플로우 | `/contracts/:id/workflow` | MZC 라우팅 검토 요청 목록 + 승인/반려/의견 입력 |
| 계약서 상세 | `/contracts/:id` | 파싱 결과 + 원문 텍스트 + 전체 탭 + 우측 검색 패널 |
| 프롬프트 설정 | `/settings/prompts` | Legal Agent 시스템 프롬프트 편집 + 계약 유형별 프리셋 |

#### 검색 패널 (계약서 상세 페이지 내장)

| 항목 | 사양 |
|------|------|
| 위치 | 계약서 상세 페이지 우측 컬럼 |
| 기본 너비 | 전체 화면의 1/3 |
| 구성 | 자연어 검색창 + 결과 리스트 + 출처 하이라이트 |
| 컨텍스트 | 현재 조회 중인 계약서의 고객사가 기본 필터로 적용 |

---

## 5. 데이터 모델

> 저장소: Amazon S3 (DOCX + 파싱 JSON) + Amazon DynamoDB 4테이블 + Bedrock Knowledge Base (ap-northeast-2)

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
  is_standard, s3_key, uploaded_at, uploaded_by
  clauses: List (ContractClause 중첩)
  diff_report: Map (DiffReport + DiffChange 중첩, 선택)

[DynamoDB] cas-risk-reports
  id (PK), contract_id (GSI), overall_risk, risk_summary
  is_standard_contract, escalation_required
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
| AI 모델 | **AWS Bedrock** (Claude 3.5 Sonnet v2) | Agent 추론 엔진 |
| Agent 오케스트레이션 | **AWS Strands SDK** | Multi-Agent 파이프라인 구성 |
| RAG | **AWS Bedrock Knowledge Bases** | 계약서 히스토리 검색 |
| 벡터 검색 | **Amazon OpenSearch Serverless** | Bedrock KB 벡터 저장소 |
| 임베딩 | **Amazon Titan Embeddings V2** | 계약서 텍스트 벡터 변환 |
| 파일 저장 | **Amazon S3** | DOCX + 파싱 JSON 보관 |
| DB | **Amazon DynamoDB** | 계약서 메타데이터 + 리포트 + 프롬프트 템플릿 저장 |

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
            model_id="anthropic.claude-3-5-sonnet-20241022-v2:0",
            region_name="ap-northeast-2"
        )
    return LiteLLMModel(model_id="groq/llama-3.3-70b-versatile")

model = get_model()

# parse_contract(): python-docx + regex로 Contract JSON 생성 (코드, LLM 불필요)
legal_agent   = Agent(model=model, tools=[check_risk, diff_with_previous, analyze_financials])
search_agent  = Agent(model=model, tools=[search_contract_history])

# route_reviewers(): MZC 라우팅 기준 룰엔진 (if/else, Agent 아님)
```

---

## 7. 오케스트레이션 흐름

```
1. DOCX 업로드 → S3 저장 ({customer}/{id}/v{n}.docx)
   └─ python-docx로 텍스트 추출 (코드, 즉시)

2. DOCX 파싱 실행 (코드, 동기)
   └─ Contract JSON 생성 → S3 저장 → Bedrock KB 동기화 트리거

3. Legal Review Agent 실행
   ├─ check_risk: MZC 기준 프롬프트 기반 리스크 탐지
   ├─ diff_with_previous: DynamoDB에서 이전 버전 조회 → deepdiff → LLM 리스크 요약
   └─ analyze_financials: 재무 리스크 분석

4. Rule Engine 실행 (코드, 즉시)
   └─ overall_risk × MZC 라우팅 매트릭스 → 검토자 목록 생성
      (계약팀 → 법무팀 → 본부장 순차 / 재무팀·기술법무 병렬)

5. DynamoDB 업데이트 + UI polling 반영

--- 별도 흐름 ---
6. 사용자 검색 질의 → Search Agent → Bedrock KB retrieve_and_generate
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

> MZC 영업팀 담당자가 고객사 SI 도급 계약서를 처음 받은 상황

1. **[Upload]** 영업팀 담당자가 고객사 SI 도급 계약서 DOCX 업로드 (비표준계약)
2. **[Parsing]** DOCX 파서(코드)가 텍스트 추출 + 규칙 기반 구조화 → Contract JSON 생성
3. **[Risk]** Legal Review Agent가 HIGH 리스크 3건 탐지
   - 무제한 배상책임 (배상한도 미설정)
   - CR 절차 미정의 (변경요청 처리 기준 없음)
   - 지체상금 0.15%/일 (MZC 기준 0.05% 초과)
4. **[Diff]** 이전 버전(v1) 대비 페널티 조항 변경 감지 → Diff 뷰 시각화
5. **[Routing]** Rule Engine이 MZC 기준으로 자동 라우팅
   - 계약팀 → 법무팀 → 본부장 (HIGH + 비표준계약)
   - 재무팀 병렬 검토 (계약금액 10억+)
6. **[Approve]** 계약팀이 의견 입력 후 Mock 승인 → 다음 단계 진행
7. **[Search]** "이 고객사와의 과거 계약에서 CR 조항은 어떻게 처리했나?" → RAG 검색 결과 표시
8. **[Customize]** 프롬프트 설정 화면에서 SI 전용 리스크 기준 수정 → 즉시 재분석

---

## 10. 미결정 사항 (확인 필요)

- [ ] MZC 표준 계약서 텍스트 확보 가능 여부 (Mock 사용 — 있긴 하나 보안상 제공 불가, Claude로 기준선 Mock 텍스트 생성)
- [ ] AWS 계정 및 Bedrock 모델 액세스 신청 (Claude 3.5 Sonnet v2, 당일 계정 생성 후 즉시)
- [ ] Bedrock Knowledge Base + OpenSearch Serverless 사전 프로비저닝 여부
- [ ] Strands SDK 버전 및 팀 로컬 환경 세팅 방법 통일
- [ ] S3 버킷 / DynamoDB 테이블 사전 프로비저닝 여부 (또는 LocalStack 로컬 대체)
- [ ] 발표 시간 기준 데모 흐름 우선순위 핵심 5단계 — Upload→Risk→Diff→Routing→Search (Customize 제외)
- [ ] 팀 구성 확정 (FE 1명 기준 화면 범위 조율 필요)
