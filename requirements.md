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
| 전자서명 / 최종 승인 | 오프라인 또는 별도 툴 | 프로세스 단절 |

### 핵심 가설
> "계약서를 업로드하면 AI가 5분 안에 리스크 리포트를 생성하고, 적합한 검토자에게 자동 라우팅하면 계약 체결 사이클을 X일 → 당일로 단축할 수 있다."

---

## 2. 서비스 개요

**서비스명**: Contract Agent System (CAS)

메가존클라우드 영업팀이 고객사와 체결하는 다양한 계약서(NDA, MSA, SI 도급, SLA, 유지보수 등)를 업로드하면, 4개의 전문 AI Agent가 순차·병렬로 협력하여 **조항 분석 → 리스크 탐지 → 변경 이력 추적 → 내부 검토 라우팅**을 자동 처리한다.

### MVP 범위 (1일 개발 기준)

**In Scope**
- DOCX 업로드 및 텍스트 파싱
- AI 기반 리스크 분석 리포트 생성 및 조회
- 이전 버전 대비 조항 Diff 뷰 (동일 고객사 계약서)
- 부서별 검토 라우팅 + 승인/반려 Mock UI
- 계약서 목록 및 상태 대시보드

**Out of Scope (명시적 제외)**
- 실제 전자서명 연동 (DocuSign 등)
- 실제 이메일/슬랙 알림 발송
- 외부 ERP/CRM 연동
- 다국어 지원
- 모바일 반응형

---

## 3. 핵심 Agent 명세

### Agent 파이프라인 흐름

```
DOCX 업로드
    ↓
[Parsing Agent] ──→ Contract JSON
    ↓
[Legal Review Agent] ──→ Risk Report JSON
    ↓                         ↓
[Diff Agent]          [Workflow Agent]
(이전 버전 존재 시)    (리스크 기반 라우팅)
    ↓                         ↓
Diff Report            검토 요청 / Mock 승인
```

---

### Agent 1: Parsing Agent

**역할**: DOCX → 구조화된 계약 JSON 변환

**입력**: DOCX 파일 (업로드)

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

| 기능 | 설명 |
|------|------|
| 계약 유형 자동 분류 | NDA / MSA / SI 도급 / SLA / 유지보수 / 기타 |
| 당사자 정보 추출 | 갑·을 법인명, 대표자, 담당자 |
| 핵심 날짜 추출 | 계약일, 이행기간, 만료일, 자동갱신 조건 |
| 금액 정보 추출 | 계약금액, 지급조건, 위약금/지체상금 |
| 조항 분류 | 6개 유형(책임/지재권/비밀유지/해지/분쟁해결/위약금)으로 태깅 |

---

### Agent 2: Legal Review Agent

**역할**: 계약 JSON → 리스크 조항 탐지 + 손익 분석

**입력**: Parsing Agent 출력 JSON

**출력**: Risk Report JSON

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

**탐지 대상 리스크 유형**

| 리스크 유형 | 탐지 기준 | 기본 레벨 |
|------------|-----------|-----------|
| 무제한 배상책임 | 배상한도 미설정 또는 계약금액 초과 | HIGH |
| IP 완전이전 | 개발 산출물 지재권 전부 이전 조항 | HIGH |
| 일방적 해지권 | 갑 단독 해지 + 위약금 없음 | HIGH |
| 과도한 페널티 | 지체상금율 0.1%/일 초과 | MEDIUM |
| 자동갱신 조건 | 갱신 거절 기한 미명시 | MEDIUM |
| 분쟁 관할 불리 | 상대방 소재지 법원 지정 | MEDIUM |
| 비밀유지 기간 미정 | 계약 종료 후 기간 명시 없음 | LOW |

---

### Agent 3: Diff Agent

**역할**: 현재 vs 이전 버전 계약서 변경사항 시각화

**입력**: 현재 Contract JSON + 이전 Contract JSON (동일 고객사 기준)

**출력**: Diff Report JSON

```json
{
  "diff_summary": "변경사항 요약",
  "risk_change": "LOW→HIGH | 동일 | 개선",
  "changes": [
    {
      "clause_id": "clause_003",
      "change_type": "ADDED | REMOVED | MODIFIED",
      "previous_content": "...",
      "current_content": "...",
      "risk_impact": "리스크 증가 | 리스크 감소 | 중립",
      "highlight": "핵심 변경 포인트 요약"
    }
  ],
  "financial_changes": {
    "amount_delta": 0,
    "penalty_change": "..."
  },
  "new_risk_clauses": ["이번 버전에서 새로 발생한 리스크 조항 ID 목록"]
}
```

**상세 기능**

| 기능 | 설명 |
|------|------|
| 조항 단위 비교 | 추가/삭제/수정 3가지 유형으로 분류 |
| 리스크 레벨 변화 표시 | 조항별 이전→현재 리스크 변화 화살표 표시 |
| 금액/날짜 변경 하이라이트 | 수치 변경분 색상 강조 |
| 이전 버전 없을 경우 | Diff 생략, 신규 계약서로 처리 |

---

### Agent 4: Workflow Agent

**역할**: 리스크 레벨 기반 부서별 검토 라우팅 + 승인 Mock

**입력**: 계약서 ID + Risk Report

**출력**: 워크플로우 상태 + 검토 요청 목록

**라우팅 규칙**

| 조건 | 라우팅 대상 | 필수 승인 |
|------|------------|-----------|
| Overall: HIGH | 법무팀 → 팀장 → 본부장 | 3단계 |
| Overall: MEDIUM | 팀장 → 담당 임원 | 2단계 |
| Overall: LOW | 담당자 자체 승인 | 1단계 |
| 계약금액 10억+ | 재무팀 병렬 검토 추가 | +1 |
| IP 이전 조항 포함 | 기술법무 검토 추가 | +1 |

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
| 리스크 리포트 | `/contracts/:id/report` | 전체 리스크 요약 + 조항별 리스크 목록 |
| Diff 뷰 | `/contracts/:id/diff` | 이전 버전과 조항별 변경사항 비교 |
| 워크플로우 | `/contracts/:id/workflow` | 검토 요청 목록 + 승인/반려 버튼 |
| 계약서 상세 | `/contracts/:id` | 파싱 결과 + 원문 텍스트 + 전체 탭 |

---

## 5. 데이터 모델

> 저장소: Amazon S3 (DOCX 파일) + Amazon DynamoDB 3테이블 (ap-northeast-2)
> 상세 스키마: DAT-CAS-001.md 참조

```
[S3] cas-contracts 버킷
  {contract_id}.docx

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
| 파일 저장 | **Amazon S3** | DOCX 파일 업로드 보관 |
| DB | **Amazon DynamoDB** | 계약서 메타데이터 + 리포트 저장 |

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
| DOCX 파싱 | mammoth | Word 문서 텍스트 추출 |
| LLM 추상화 | LiteLLM | 모델 전환 시 코드 변경 최소화 |
| AWS SDK | boto3 | Bedrock / S3 / DynamoDB 연동 |
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
    # 사전 개발 기본값: Groq 무료 API
    return LiteLLMModel(model_id="groq/llama-3.3-70b-versatile")

model = get_model()

parsing_agent    = Agent(model=model, tools=[parse_docx, classify_contract])
legal_agent      = Agent(model=model, tools=[detect_risk, analyze_financials])
diff_agent       = Agent(model=model, tools=[compare_clauses, highlight_changes])
workflow_agent   = Agent(model=model, tools=[route_reviewers, mock_sign])
```

---

## 7. Agent 간 오케스트레이션 (Strands SDK 기반)

```
1. DOCX 업로드 → S3 저장 → Parsing Agent 실행 (동기)
   └─ python-docx로 텍스트 추출 → Bedrock Claude로 구조화

2. Parsing 완료 → Legal Review Agent + Diff Agent 병렬 실행
   ├─ Legal Review Agent: Bedrock Claude로 리스크 조항 분류·평가
   └─ Diff Agent: DynamoDB에서 이전 버전 조회 → 존재 시에만 실행

3. Legal Review 완료 → Workflow Agent 실행 (자동 라우팅)
   └─ 리스크 레벨 × 계약 유형 매트릭스 → 검토자 목록 생성

4. 각 Agent 완료 시 → DynamoDB 업데이트 + UI polling 반영
```

**Strands SDK 오케스트레이터 패턴**
```python
# 상위 Orchestrator Agent가 하위 Agent 호출 조율
orchestrator = Agent(
    model=model,
    tools=[
        parsing_agent.as_tool(name="parse_contract", description="DOCX 파싱 후 계약 JSON 반환"),
        legal_agent.as_tool(name="review_risks", description="리스크 조항 탐지 및 손익 분석"),
        diff_agent.as_tool(name="compare_versions", description="이전 버전 대비 조항 변경사항 시각화"),
        workflow_agent.as_tool(name="route_approval", description="리스크 레벨 기반 부서별 검토 라우팅"),
    ]
)
result = orchestrator("이 계약서를 분석하고 검토 라우팅까지 완료해줘")
```

---

## 8. 비기능 요구사항 (MVP 기준)

| 항목 | 목표 |
|------|------|
| 분석 소요 시간 | 업로드 후 리스크 리포트 생성까지 60초 이내 |
| 지원 파일 형식 | DOCX (Microsoft Word 형식) |
| 최대 파일 크기 | 10MB 이하 |
| 동시 처리 | MVP는 단일 계약서 처리 (큐 불필요) |
| 보안 | 로컬 실행 기준, 인증 Mock (로그인 화면만) |

---

## 9. 데모 시나리오 (해커톤 발표용)

1. **[Upload]** 영업팀 담당자가 고객사 계약서 DOCX 업로드
2. **[Parsing]** Parsing Agent가 조항 구조화 → JSON 변환 완료
3. **[Risk]** Legal Review Agent가 HIGH 리스크 3건 탐지 → 리포트 생성
4. **[Diff]** Diff Agent가 이전 버전 대비 페널티 조항 변경 감지 → 시각화
5. **[Workflow]** Workflow Agent가 법무팀 + 팀장 2단계 검토 자동 라우팅
6. **[Approve]** 검토자가 의견 입력 후 Mock 서명 완료 → 승인 처리

---

## 10. 미결정 사항 (확인 필요)

- [ ] 메가존 표준 계약서 텍스트 확보 가능 여부 (Legal Review 기준선)
- [ ] 데모용 샘플 계약서 DOCX 준비 여부
- [ ] AWS 계정 및 Bedrock 모델 접근 권한 확보 여부 (Claude 3.5 Sonnet v2 활성화)
- [ ] Strands SDK 버전 및 팀 로컬 환경 세팅 방법 통일 필요
- [ ] S3 버킷 / DynamoDB 테이블 사전 프로비저닝 여부 (또는 LocalStack 로컬 대체)
- [ ] 발표 시간 기준 데모 흐름 우선순위 (전체 vs 핵심 2~3개 Agent)
- [ ] 팀 구성 (개발 인원 수에 따라 Diff/Workflow Agent 구현 여부 결정)
