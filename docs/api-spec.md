# CAS API 명세서

> FE/BE 계약 (Contract) — REST API Specification
> 기반 문서: DSC-014 합의문, Requirements v3.0

---

## 1. 공통 사항

### Base URL

| 환경 | URL |
|------|-----|
| 로컬 개발 | `http://localhost:8000` |
| EC2 배포 | `http://{ec2-public-ip}:8000` |

### 공통 응답 형식

```json
// 성공
{
  "success": true,
  "data": { ... }
}

// 에러
{
  "success": false,
  "error": "에러 메시지",
  "detail": "상세 설명 (선택)"
}
```

### 공통 헤더

| 헤더 | 값 | 필수 |
|------|-----|------|
| Content-Type | application/json | 응답 기본 |
| Content-Type | multipart/form-data | 파일 업로드 시 |

---

## 2. Contracts API (`/contracts`)

### 2-1. 계약서 업로드

```
POST /contracts/upload
```

DOCX 파일 업로드 → 파싱 → 리스크 분석 → 워크플로우 생성 전체 파이프라인 실행

**Request** (multipart/form-data):

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| file | File | O | DOCX 파일 (최대 10MB) |
| customer_name | string | O | 고객사명 |
| contract_type | string | O | NDA, MSA, SI, SLA, Maintenance, Outsourcing, Other |
| uploaded_by | string | X | 업로드 사용자 (기본: "demo_user") |

**Response** (200):

```json
{
  "success": true,
  "data": {
    "contract_id": "con_abc123",
    "version": 1,
    "status": "RISK_REVIEWED",
    "s3_key": "A사/con_abc123/v1.docx",
    "risk_report_id": "rr_xyz789",
    "workflow_steps": [
      {
        "id": "wf_001",
        "step_order": 1,
        "department": "계약팀",
        "assignee": "김계약",
        "status": "PENDING"
      }
    ]
  }
}
```

**에러**:

| 코드 | 상황 |
|------|------|
| 400 | 파일 형식 오류 (DOCX 아님) |
| 400 | 파일 크기 초과 (10MB) |
| 422 | 필수 필드 누락 |
| 500 | 파싱/분석 실패 |

---

### 2-2. 계약서 목록 조회

```
GET /contracts
```

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| status | string | X | 상태 필터 (DRAFT, PARSING, RISK_REVIEWED, PENDING_APPROVAL, APPROVED, REJECTED) |
| customer_name | string | X | 고객사명 필터 |
| contract_type | string | X | 계약 유형 필터 |

**Response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "con_abc123",
      "customer_name": "A사",
      "contract_type": "SI",
      "version": 2,
      "status": "RISK_REVIEWED",
      "is_standard": false,
      "uploaded_at": "2026-05-10T09:00:00Z",
      "uploaded_by": "demo_user"
    }
  ]
}
```

---

### 2-3. 계약서 상세 조회

```
GET /contracts/{contract_id}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "con_abc123",
    "customer_name": "A사",
    "contract_type": "SI",
    "version": 2,
    "status": "RISK_REVIEWED",
    "is_standard": false,
    "s3_key": "A사/con_abc123/v2.docx",
    "uploaded_at": "2026-05-10T09:00:00Z",
    "uploaded_by": "demo_user",
    "parsed": {
      "contract_type": "SI",
      "is_standard": false,
      "parties": {
        "party_a": { "name": "메가존클라우드(주)", "representative": null },
        "party_b": { "name": "비즈솔루션코리아", "representative": "홍길동" }
      },
      "dates": {
        "contract_date": "2026-05-01",
        "start_date": "2026-06-01",
        "end_date": "2027-05-31",
        "renewal_terms": null
      },
      "financials": {
        "total_amount": 500000000,
        "currency": "KRW",
        "payment_terms": "검수 완료 후 30일 이내",
        "penalty_clause": "지체상금 적용",
        "delay_penalty_rate": "0.15%/일"
      },
      "clauses": [
        {
          "id": "clause_001",
          "type": "liability",
          "title": "제10조 (손해배상)",
          "content": "을은 본 계약으로 인하여 갑에게 발생한 모든 손해를 배상한다...",
          "paragraph": 10
        }
      ]
    }
  }
}
```

---

## 3. Risk Report API

### 3-1. 리스크 리포트 조회

```
GET /contracts/{contract_id}/risk-report
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "rr_xyz789",
    "contract_id": "con_abc123",
    "overall_risk": "HIGH",
    "is_standard_contract": false,
    "risk_summary": "3건의 HIGH 리스크 조항 발견. 무제한 배상책임, CR 절차 미정의, 과도한 지체상금 확인됨.",
    "clause_risks": [
      {
        "clause_id": "clause_001",
        "risk_level": "HIGH",
        "risk_type": "무제한_배상책임",
        "reason": "배상한도가 설정되지 않아 MZC 기준(계약금액 100% 이내) 위반",
        "recommendation": "배상한도를 계약금액의 100% 이내로 설정할 것을 권고",
        "financial_impact": "최대 5억원 초과 손실 가능성"
      }
    ],
    "key_concerns": [
      "무제한 배상책임 — 배상한도 미설정",
      "CR 절차 미정의 — 변경요청 처리 기준 없음",
      "지체상금 0.15%/일 — MZC 기준 0.05% 3배 초과"
    ],
    "standard_deviation": "표준 SI 도급계약 대비 배상 조항, CR 조항, 지체상금 조항에서 차이 발견",
    "escalation_required": true,
    "created_at": "2026-05-10T09:01:30Z"
  }
}
```

---

## 4. Diff API

### 4-1. 버전 간 Diff 조회

```
GET /contracts/{contract_id}/diff?compare_version={version}
```

**Query Parameters**:

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| compare_version | number | X | 비교 대상 버전 (기본: 직전 버전) |

**Response** (200):

```json
{
  "success": true,
  "data": {
    "contract_id": "con_abc123",
    "current_version": 2,
    "compare_version": 1,
    "changes": [
      {
        "clause_id": "clause_001",
        "clause_title": "제10조 (손해배상)",
        "change_type": "modified",
        "old_content": "을은 갑에게 발생한 직접 손해를 배상한다...",
        "new_content": "을은 갑에게 발생한 모든 손해를 배상한다...",
        "risk_impact": "배상 범위가 '직접 손해'에서 '모든 손해'로 확대. 간접 손해 포함으로 리스크 상승.",
        "risk_level_change": "MEDIUM → HIGH"
      },
      {
        "clause_id": "clause_005",
        "clause_title": "제15조 (변경요청)",
        "change_type": "removed",
        "old_content": "변경요청은 서면 합의로 처리한다...",
        "new_content": null,
        "risk_impact": "CR 절차 조항 삭제. 변경요청 처리 기준 부재로 HIGH 리스크.",
        "risk_level_change": "LOW → HIGH"
      }
    ],
    "summary": "v1 대비 2개 조항 변경. 배상 범위 확대, CR 절차 삭제로 전반적 리스크 상승."
  }
}
```

---

## 5. Search API (`/search`)

### 5-1. RAG 기반 계약 히스토리 검색

```
POST /search
```

**Request**:

```json
{
  "query": "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?",
  "top_k": 5
}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "query": "A사와의 과거 계약에서 배상 조항은 어떻게 변해왔나?",
    "answer": "A사와의 계약 이력을 분석한 결과, 배상 조항은 다음과 같이 변해왔습니다...",
    "sources": [
      {
        "contract_id": "con_abc123",
        "customer_name": "A사",
        "contract_type": "SI",
        "version": 1,
        "relevance_score": 0.92,
        "matched_clause": "제10조 (손해배상) — 직접 손해에 한하여 배상...",
        "uploaded_at": "2026-01-15T09:00:00Z"
      }
    ]
  }
}
```

---

## 6. Workflow API (`/workflow`)

### 6-1. 워크플로우 단계 조회

```
GET /workflow/{contract_id}
```

**Response** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "wf_001",
      "contract_id": "con_abc123",
      "step_order": 1,
      "department": "계약팀",
      "assignee": "김계약",
      "status": "APPROVED",
      "comment": "배상 조항 수정 요청 전달 완료",
      "signed_at": "2026-05-10T10:30:00Z",
      "created_at": "2026-05-10T09:01:30Z"
    },
    {
      "id": "wf_002",
      "contract_id": "con_abc123",
      "step_order": 2,
      "department": "법무팀",
      "assignee": "박법무",
      "status": "PENDING",
      "comment": null,
      "signed_at": null,
      "created_at": "2026-05-10T09:01:30Z"
    },
    {
      "id": "wf_003",
      "contract_id": "con_abc123",
      "step_order": 3,
      "department": "본부장",
      "assignee": "이본부장",
      "status": "PENDING",
      "comment": null,
      "signed_at": null,
      "created_at": "2026-05-10T09:01:30Z"
    }
  ]
}
```

### 6-2. 워크플로우 승인/반려

```
POST /workflow/{contract_id}/steps/{step_id}/action
```

**Request**:

```json
{
  "action": "APPROVED",
  "comment": "검토 완료. 배상 조항 수정 협상 진행 요망."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| action | string | O | APPROVED 또는 REJECTED |
| comment | string | X | 검토 의견 |

**Response** (200):

```json
{
  "success": true,
  "data": {
    "id": "wf_002",
    "status": "APPROVED",
    "comment": "검토 완료. 배상 조항 수정 협상 진행 요망.",
    "signed_at": "2026-05-10T11:00:00Z",
    "next_step": {
      "id": "wf_003",
      "department": "본부장",
      "assignee": "이본부장",
      "status": "PENDING"
    }
  }
}
```

---

## 7. MCP 질의 API

### 7-1. 사내 규정 조회 (Orchestrator 경유)

```
POST /search
```

**Request**:

```json
{
  "query": "배상한도 관련 사내 컴플라이언스 규정 확인해줘"
}
```

> MCP 질의와 RAG 검색은 동일한 `/search` 엔드포인트를 사용. Orchestrator Agent가 질의 내용을 분석하여 SearchAgent 또는 MCP Client를 자율 선택.

---

## 8. 에러 코드

| HTTP 코드 | 의미 | 예시 |
|-----------|------|------|
| 200 | 성공 | - |
| 400 | 잘못된 요청 | 파일 형식 오류, 파라미터 오류 |
| 404 | 리소스 없음 | 존재하지 않는 contract_id |
| 422 | 유효성 검증 실패 | 필수 필드 누락 |
| 500 | 서버 오류 | Agent 호출 실패, AWS 서비스 장애 |

---

## 9. CORS 설정

```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> MVP 단계에서는 `allow_origins=["*"]` 허용. 프로덕션에서는 특정 도메인만 허용.
