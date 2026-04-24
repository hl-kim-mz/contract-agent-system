# ACT-CAS-001 — FastAPI 엔드포인트 액션 명세

> 문서 타입: ACT (액션)
> 도메인: CAS (Contract Agent System)
> 버전: v1.0 | 작성일: 2026-04-23
> Base URL: `http://localhost:8000`

---

## 1. 엔드포인트 목록

| Method | Path | 역할 | 화면 연결 |
|--------|------|------|-----------|
| GET | `/contracts` | 계약서 목록 + 상태 필터 | 대시보드 |
| POST | `/contracts/upload` | DOCX 업로드 + 메타데이터 저장 | 업로드 화면 |
| POST | `/contracts/{id}/analyze` | Agent 파이프라인 실행 | 분석 진행 화면 |
| GET | `/contracts/{id}` | 계약서 상세 (파싱 결과 포함) | 계약서 상세 |
| GET | `/contracts/{id}/report` | 리스크 리포트 조회 | 리스크 리포트 |
| GET | `/contracts/{id}/diff` | Diff 리포트 조회 | Diff 뷰 |
| GET | `/contracts/{id}/workflow` | 워크플로우 + 검토 단계 목록 | 워크플로우 |
| POST | `/contracts/{id}/workflow/{step_id}/approve` | 검토 단계 승인 | 워크플로우 |
| POST | `/contracts/{id}/workflow/{step_id}/reject` | 검토 단계 반려 | 워크플로우 |

---

## 2. 상세 명세

### POST `/contracts/upload`
```
Request:  multipart/form-data
  - file: DOCX (≤10MB)
  - customer_name: string
  - contract_type: NDA | MSA | SI | SLA | Maintenance | Other

Response 201:
  { "id": "uuid", "customer_name": "...", "contract_type": "...", "version": 1, "status": "DRAFT" }

Response 400:
  { "error": "지원하지 않는 파일 형식" | "파일 크기 초과" }
```

### POST `/contracts/{id}/analyze`
```
Request:  없음 (id로 S3 key 조회 → S3에서 파일 로드)

Response 200:
  { "id": "uuid", "status": "PARSING" }

비고: Agent 파이프라인은 백그라운드 실행.
      FE는 GET /contracts/{id} 폴링으로 status 변화 감지.
```

### GET `/contracts/{id}`
```
Response 200:
  {
    "id": "uuid",
    "customer_name": "...",
    "contract_type": "...",
    "version": 1,
    "status": "DRAFT | PARSING | REVIEWING | PENDING_APPROVAL | APPROVED | REJECTED | ERROR",
    "clauses": [ { "id": "...", "type": "...", "title": "...", "content": "..." } ],
    "uploaded_at": "ISO 8601"
  }
```

### GET `/contracts/{id}/report`
```
Response 200:
  {
    "overall_risk": "HIGH | MEDIUM | LOW",
    "risk_summary": "...",
    "clause_risks": [ { "clause_id": "...", "risk_level": "...", "risk_type": "...", "reason": "...", "recommendation": "..." } ],
    "key_concerns": ["...", "..."],
    "standard_deviation": "..."
  }

Response 404: { "error": "리포트 없음 — 분석을 먼저 실행하세요" }
```

### GET `/contracts/{id}/diff`
```
Response 200:
  {
    "diff_summary": "...",
    "risk_change": "LOW→HIGH | 동일 | 개선",
    "changes": [ { "clause_id": "...", "change_type": "ADDED|REMOVED|MODIFIED", "previous_content": "...", "current_content": "...", "risk_impact": "..." } ]
  }

Response 404: { "error": "이전 버전 없음 — Diff 미적용" }
```

### GET `/contracts/{id}/workflow`
```
Response 200:
  {
    "contract_id": "uuid",
    "steps": [
      { "id": "...", "step_order": 1, "department": "법무팀", "assignee": "...", "status": "PENDING | APPROVED | REJECTED", "comment": "...", "signed_at": "..." }
    ]
  }
```

### POST `/contracts/{id}/workflow/{step_id}/approve`
```
Request:  { "comment": "string (optional)" }

Response 200:
  { "step_id": "...", "status": "APPROVED", "signed_at": "ISO 8601" }
```

### POST `/contracts/{id}/workflow/{step_id}/reject`
```
Request:  { "comment": "string (필수)" }

Response 200:
  { "step_id": "...", "status": "REJECTED", "signed_at": "ISO 8601" }
```

---

## 3. 공통 응답 규칙

| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 요청 오류 (파일 형식, 파라미터) |
| 404 | 리소스 없음 |
| 500 | 서버 오류 (Agent 실패 포함) |
