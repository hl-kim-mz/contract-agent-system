# CAS 데이터 모델 설계서

> 저장소: S3 + DynamoDB + Bedrock KB + MCP SQLite
> 기반 문서: DSC-014 합의문, Requirements v3.0

---

## 1. 저장소 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                      Storage Layer                           │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ Amazon S3   │  │ DynamoDB     │  │ Bedrock KB         │  │
│  │             │  │ (4 테이블)    │  │ + OpenSearch       │  │
│  │ DOCX 원본   │  │              │  │                    │  │
│  │ 파싱 JSON   │  │ contracts    │  │ 시맨틱 벡터 검색    │  │
│  │             │  │ risk-reports │  │ Titan Embeddings   │  │
│  │             │  │ workflow     │  │                    │  │
│  │             │  │ prompts      │  │                    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────┐                             │
│  │ MCP SQLite (compliance.db) │                             │
│  │ 사내 컴플라이언스 규정 Mock  │                             │
│  └─────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Amazon S3 구조

**버킷**: `cas-contracts-megathon`

```
cas-contracts-megathon/
├── {customer_name}/
│   └── {contract_id}/
│       ├── v1.docx          ← 원본 DOCX (버전별)
│       ├── v1.json          ← 파싱 결과 JSON (KB 인덱싱 대상)
│       ├── v2.docx
│       └── v2.json
```

| 항목 | 설명 |
|------|------|
| 경로 패턴 | `{customer_name}/{contract_id}/v{version}.{ext}` |
| DOCX | 원본 계약서 파일 |
| JSON | 파싱 결과 (Contract JSON) — Bedrock KB 인덱싱 대상 |
| 버저닝 | 동일 고객사 기준 자동 버전 채번 |

---

## 3. DynamoDB 테이블 설계

### 3-1. cas-contracts

계약서 메타데이터 및 파싱 결과 저장

| 속성 | 타입 | 설명 |
|------|------|------|
| **id** | String (PK) | 계약서 고유 ID |
| customer_name | String | 고객사명 |
| contract_type | String | NDA, MSA, SI, SLA, Maintenance, Outsourcing, Other |
| version | Number | 버전 번호 |
| status | String | DRAFT, PARSING, RISK_REVIEWED, PENDING_APPROVAL, APPROVED, REJECTED |
| is_standard | Boolean | MZC 표준계약서 여부 |
| s3_key | String | S3 파일 경로 |
| uploaded_at | String (ISO8601) | 업로드 시각 |
| uploaded_by | String | 업로드 사용자 |
| clauses_json | String | Contract JSON 직렬화 |
| diff_report_json | String (선택) | DiffReport JSON 직렬화 |

### 3-2. cas-risk-reports

리스크 분석 결과 저장

| 속성 | 타입 | 설명 |
|------|------|------|
| **id** | String (PK) | 리포트 고유 ID |
| contract_id | String (GSI) | 연결된 계약서 ID |
| overall_risk | String | HIGH, MEDIUM, LOW |
| risk_summary | String | 전체 요약 |
| is_standard_contract | Boolean | 표준계약 여부 |
| escalation_required | Boolean | 에스컬레이션 필요 여부 |
| standard_deviation | String | 표준 대비 차이점 |
| created_at | String (ISO8601) | 생성 시각 |
| clause_risks_json | String | ClauseRisk 배열 직렬화 |
| key_concerns_json | String | 핵심 우려사항 배열 직렬화 |

### 3-3. cas-workflow-steps

워크플로우 단계별 승인/반려 상태

| 속성 | 타입 | 설명 |
|------|------|------|
| **id** | String (PK) | 워크플로우 단계 ID |
| contract_id | String (GSI) | 연결된 계약서 ID |
| step_order | Number | 검토 순서 |
| department | String | 담당 부서 |
| assignee | String | 담당자 |
| status | String | PENDING, APPROVED, REJECTED |
| comment | String (선택) | 검토 의견 |
| signed_at | String (선택) | 서명 시각 |
| created_at | String (ISO8601) | 생성 시각 |

### 3-4. cas-prompt-templates

프롬프트 템플릿 저장 (향후 확장용)

| 속성 | 타입 | 설명 |
|------|------|------|
| **id** | String (PK) | 프롬프트 ID |
| contract_type | String (GSI) | 대상 계약 유형 |
| prompt_name | String | 프롬프트 이름 |
| system_prompt | String | 시스템 프롬프트 본문 |
| updated_at | String (ISO8601) | 수정 시각 |
| updated_by | String | 수정자 |

### GSI (Global Secondary Index)

| 테이블 | GSI 이름 | PK | 용도 |
|--------|---------|-----|------|
| cas-risk-reports | contract_id-index | contract_id | 계약서별 리스크 리포트 조회 |
| cas-workflow-steps | contract_id-index | contract_id | 계약서별 워크플로우 단계 조회 |
| cas-prompt-templates | contract_type-index | contract_type | 계약 유형별 프롬프트 조회 |

---

## 4. Bedrock Knowledge Base

| 항목 | 값 |
|------|-----|
| KB 이름 | cas-knowledge-base |
| 데이터 소스 | S3 파싱 JSON 파일 |
| 벡터 저장소 | OpenSearch Serverless (자동 프로비저닝) |
| 임베딩 모델 | Amazon Titan Embeddings V2 |
| 검색 방식 | retrieve_and_generate |
| Plan B | BM25 + SQLite FTS |

---

## 5. MCP SQLite (compliance.db)

사내 컴플라이언스 규정 Mock DB

```sql
CREATE TABLE compliance_rules (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL,        -- '배상', 'IP', '해지', '지체상금' 등
    rule_name TEXT NOT NULL,       -- 규정 이름
    description TEXT NOT NULL,     -- 규정 상세 내용
    threshold TEXT,                -- 기준값 (예: '계약금액 100%')
    risk_level TEXT,               -- HIGH, MEDIUM, LOW
    department TEXT,               -- 담당 부서
    updated_at TEXT                -- 최종 수정일
);
```

샘플 데이터 3~5건:
- 배상책임 한도 규정
- IP 소유권 기준
- 지체상금 허용 범위
- 계약 해지 절차
- CR 변경요청 처리 기준

---

## 6. Pydantic v2 모델 정의

### 6-1. Contract 관련

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class ContractType(str, Enum):
    NDA = "NDA"
    MSA = "MSA"
    SI = "SI"
    SLA = "SLA"
    MAINTENANCE = "Maintenance"
    OUTSOURCING = "Outsourcing"
    OTHER = "Other"

class ContractStatus(str, Enum):
    DRAFT = "DRAFT"
    PARSING = "PARSING"
    RISK_REVIEWED = "RISK_REVIEWED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class ClauseType(str, Enum):
    LIABILITY = "liability"
    IP = "ip"
    CONFIDENTIALITY = "confidentiality"
    TERMINATION = "termination"
    DISPUTE = "dispute"
    PENALTY = "penalty"
    OTHER = "other"

class Party(BaseModel):
    name: str
    representative: Optional[str] = None

class Parties(BaseModel):
    party_a: Party
    party_b: Party

class ContractDates(BaseModel):
    contract_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    renewal_terms: Optional[str] = None

class Financials(BaseModel):
    total_amount: int = 0
    currency: str = "KRW"
    payment_terms: Optional[str] = None
    penalty_clause: Optional[str] = None
    delay_penalty_rate: Optional[str] = None

class Clause(BaseModel):
    id: str
    type: ClauseType
    title: str
    content: str
    paragraph: int

class ContractParsed(BaseModel):
    contract_type: ContractType
    is_standard: bool
    parties: Parties
    dates: ContractDates
    financials: Financials
    clauses: list[Clause]

class Contract(BaseModel):
    id: str
    customer_name: str
    contract_type: ContractType
    version: int
    status: ContractStatus
    is_standard: bool
    s3_key: str
    uploaded_at: datetime
    uploaded_by: str
    clauses_json: Optional[str] = None
    diff_report_json: Optional[str] = None
```

### 6-2. RiskReport 관련

```python
class RiskLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class RiskType(str, Enum):
    UNLIMITED_LIABILITY = "무제한_배상책임"
    IP_FULL_TRANSFER = "IP_완전이전"
    UNILATERAL_TERMINATION = "일방적_해지권"
    EXCESSIVE_PENALTY = "과도한_지체상금"
    CR_UNDEFINED = "CR_절차_미정의"
    OTHER = "기타"

class ClauseRisk(BaseModel):
    clause_id: str
    risk_level: RiskLevel
    risk_type: RiskType
    reason: str
    recommendation: str
    financial_impact: Optional[str] = None

class RiskReport(BaseModel):
    id: str
    contract_id: str
    overall_risk: RiskLevel
    is_standard_contract: bool
    risk_summary: str
    clause_risks: list[ClauseRisk]
    key_concerns: list[str]
    standard_deviation: Optional[str] = None
    escalation_required: bool
    created_at: datetime
```

### 6-3. Workflow 관련

```python
class WorkflowStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class WorkflowStep(BaseModel):
    id: str
    contract_id: str
    step_order: int
    department: str
    assignee: str
    status: WorkflowStatus
    comment: Optional[str] = None
    signed_at: Optional[datetime] = None
    created_at: datetime
```

### 6-4. PromptTemplate

```python
class PromptTemplate(BaseModel):
    id: str
    contract_type: ContractType
    prompt_name: str
    system_prompt: str
    updated_at: datetime
    updated_by: str
```

### 6-5. 공통 응답

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    error: Optional[str] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None
```

---

## 7. 공유 타입 관리 전략 (DSC-014 합의)

- **Source of Truth**: BE Pydantic 모델 → `docs/api-spec.md`에 JSON 스키마 문서화
- **FE 소비**: `lib/types.ts`에 수동 선언 (api-spec.md 기반)
- 4개 도메인(Contract, RiskReport, WorkflowStep, PromptTemplate)뿐이므로 수동 관리로 충분
