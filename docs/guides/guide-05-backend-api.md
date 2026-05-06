# Guide 05: Backend — API 엔드포인트

> 담당: BE 담당 | 예상 소요: 1.5시간 | 의존성: Guide 04 완료 (Agent + Tool)
> 대응 Phase: work-plan.md Phase 2 Layer 3~4 (12:30~13:30)
> 실행 시점: **해커톤 당일 12:30~13:30**

---

## 사전 조건

- [ ] Guide 04 완료 — 모든 Agent/Tool/Orchestrator 구현됨
- [ ] `backend/app/agents/orchestrator.py`의 `run_analysis_pipeline()` 작동
- [ ] DynamoDB 4테이블 + 프롬프트 시드 존재

---

## Feature 1: 업로드 + 분석 트리거 (12:30~13:00)

---

### Step 1.1: POST /contracts/upload

**소요**: 15m | **의존성**: S3 래퍼, DynamoDB 래퍼 | **work-plan ID**: 2-15

#### 작업 설명

DOCX 파일을 업로드하면 S3에 저장하고, DynamoDB에 메타데이터를 기록하며, 자동 버전 채번한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/api-spec.md의 "1. 계약서 업로드" 섹션을 읽고,
backend/app/routers/contracts.py를 구현해줘.

POST /contracts/upload 엔드포인트:

1. Request: multipart/form-data
   - file: UploadFile (DOCX, 최대 10MB)
   - customer_name: str (Form field)
   - contract_type: str | None (Form field, optional)

2. 처리:
   a. 파일 검증: .docx 확장자, 10MB 이하
   b. contract_id 생성: f"contract_{datetime.now().strftime('%Y%m%d')}_{uuid4().hex[:6]}"
   c. 버전 채번: db_client.get_next_version(customer_name)
   d. S3 업로드: s3_client.upload_file(file.read(), customer_name, contract_id, version)
   e. DynamoDB 저장: cas-contracts 테이블에 메타데이터 put_item
      - id, customer_name, contract_type (None이면 Parsing 후 업데이트), 
        version, status="DRAFT", s3_key, uploaded_at, uploaded_by="user_mock"
   f. 응답: 201 Created + contract 데이터

3. 에러 처리:
   - 파일 확장자 오류 → VALIDATION_ERROR 400
   - 파일 크기 초과 → FILE_TOO_LARGE 413

import:
- from fastapi import APIRouter, UploadFile, File, Form, HTTPException
- from app.clients.s3 import s3_client
- from app.clients.dynamodb import db_client
- from app.core.config import settings

router = APIRouter(prefix="/contracts", tags=["contracts"])

api-spec.md의 응답 스키마와 정확히 일치하게 구현해.
```

#### 예상 결과물

- `backend/app/routers/contracts.py` — upload 엔드포인트 포함

#### 검증

```bash
# 테스트 DOCX 파일이 있으면:
curl -X POST http://localhost:8000/api/v1/contracts/upload \
  -F "file=@sample.docx" \
  -F "customer_name=A사"
```

> 예상 출력: `{"success": true, "data": {"id": "contract_...", "version": 1, "status": "DRAFT", ...}}`

---

### Step 1.2: POST /contracts/:id/analyze

**소요**: 15m | **의존성**: Orchestrator | **work-plan ID**: 2-16

#### 작업 설명

Orchestrator Agent 파이프라인을 비동기로 실행한다. 즉시 202 Accepted를 반환하고, 분석은 백그라운드에서 진행한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/contracts.py에 analyze 엔드포인트를 추가해줘.

POST /contracts/{contract_id}/analyze:

1. DynamoDB에서 계약서 조회 (없으면 404)
2. 이미 분석 중이면 409 (ANALYSIS_IN_PROGRESS)
3. 상태를 "PARSING"으로 업데이트
4. analysis_steps 초기화:
   [
     {"name": "parsing", "status": "IN_PROGRESS", "started_at": now},
     {"name": "legal_review", "status": "PENDING", "started_at": None},
     {"name": "diff", "status": "PENDING", "started_at": None},
     {"name": "routing", "status": "PENDING", "started_at": None}
   ]
5. BackgroundTasks로 run_analysis_pipeline() 비동기 실행
6. 202 Accepted 즉시 응답

from fastapi import BackgroundTasks
from app.agents.orchestrator import run_analysis_pipeline

async def background_analyze(contract_id, s3_key, customer_name, version, contract_type):
    try:
        # 각 단계 진행 시 DynamoDB의 analysis_steps 업데이트
        # parsing → legal_review → diff → routing 순서로 status 변경
        result = await run_analysis_pipeline(contract_id, s3_key, customer_name, version, contract_type)
        # 성공 시 모든 단계 COMPLETED
    except Exception as e:
        # 실패 시 현재 단계 FAILED + 계약서 status = "DRAFT"로 롤백

run_analysis_pipeline이 동기 함수면 asyncio.to_thread()로 감싸거나 동기 BackgroundTasks 사용.
api-spec.md의 응답 스키마와 일치하게.
```

#### 예상 결과물

- `contracts.py`에 analyze 엔드포인트 추가

---

## Feature 2: 계약서 조회 (병렬)

---

### Step 2.1: GET /contracts + GET /contracts/:id

**소요**: 15m | **의존성**: DynamoDB 래퍼 | **work-plan ID**: 2-17, 2-18

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/contracts.py에 조회 엔드포인트 2개를 추가해줘.
docs/api-spec.md의 "3. 계약서 목록"과 "4. 계약서 상세" 섹션 참조.

GET /contracts:
- Query params: status, customer_name, contract_type, sort, order, limit, offset
- DynamoDB scan + 필터링 (해커톤 규모이므로 scan OK)
- 응답: items 배열 + total + limit + offset
- items는 ContractListItem 형태 (clauses 제외, overall_risk 포함)

GET /contracts/{contract_id}:
- DynamoDB get_item
- 없으면 404
- 응답: 전체 Contract 데이터 (clauses, analysis_steps, previous_versions 포함)
- previous_versions: 같은 customer_name의 다른 버전 목록 조회

api-spec.md의 응답 JSON과 정확히 일치하게.
```

#### 예상 결과물

- `contracts.py`에 list + detail 엔드포인트 추가

#### 검증

```bash
curl http://localhost:8000/api/v1/contracts | python3 -m json.tool | head -20
```

---

## Feature 3: 리포트 조회 (병렬)

---

### Step 3.1: GET /contracts/:id/risk-report

**소요**: 10m | **work-plan ID**: 2-19

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/contracts.py에 리스크 리포트 조회를 추가해줘.
docs/api-spec.md "5. 리스크 리포트" 참조.

GET /contracts/{contract_id}/risk-report:
- DynamoDB cas-risk-reports에서 contract_id GSI로 조회
- 분석 미완료면 422 (ANALYSIS_NOT_COMPLETE)
- 없으면 404
```

---

### Step 3.2: GET /contracts/:id/diff

**소요**: 10m | **work-plan ID**: 2-20

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/contracts.py에 Diff 리포트 조회를 추가해줘.
docs/api-spec.md "6. Diff 리포트" 참조.

GET /contracts/{contract_id}/diff:
- DynamoDB cas-contracts에서 계약서 조회 → diff_report 필드 반환
- 이전 버전이 없으면 {"success": true, "data": null}
- diff_report는 Orchestrator 파이프라인에서 계약서 문서에 저장됨
```

---

## Feature 4: 워크플로우 (병렬)

---

### Step 4.1: 워크플로우 조회 + 승인/반려

**소요**: 15m | **work-plan ID**: 2-21, 2-22

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/workflow.py를 새로 만들어줘.
docs/api-spec.md "7. 워크플로우" 참조.

router = APIRouter(prefix="/contracts", tags=["workflow"])

3개 엔드포인트:

GET /contracts/{contract_id}/workflow:
- cas-workflow-steps에서 contract_id GSI로 조회
- step_order 순서로 정렬
- overall_status 계산: 모든 APPROVED면 "APPROVED", 하나라도 REJECTED면 "REJECTED", 아니면 "PENDING_APPROVAL"

POST /contracts/{contract_id}/workflow/{step_id}/approve:
- Request body: {"comment": "..."}
- 해당 step status를 "APPROVED"로 업데이트
- signed_at 기록
- 모든 step이 APPROVED되면 계약서 status도 "APPROVED"로 업데이트

POST /contracts/{contract_id}/workflow/{step_id}/reject:
- 동일하게 "REJECTED"로 업데이트
- 계약서 status도 "REJECTED"로

main.py에 이 router를 include하는 것도 잊지 마.
```

#### 예상 결과물

- `backend/app/routers/workflow.py`

---

## Feature 5: RAG 검색 (병렬)

---

### Step 5.1: POST /search

**소요**: 10m | **work-plan ID**: 2-23

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/search.py를 새로 만들어줘.
docs/api-spec.md "8. RAG 히스토리 검색" 참조.

router = APIRouter(tags=["search"])

POST /search:
- Request body: SearchRequest (query, customer_name?, max_results?)
- search_agent.search_contracts() 호출
- 응답: SearchResponse (answer, sources, total_sources)

from app.agents.search_agent import search_contracts
from app.models.search import SearchRequest

main.py에 router include 추가.
```

---

## Feature 6: 프롬프트 관리 (병렬)

---

### Step 6.1: GET/PUT /prompts

**소요**: 15m | **work-plan ID**: 2-24

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/routers/prompts.py를 새로 만들어줘.
docs/api-spec.md "9. 프롬프트 템플릿" 참조.

router = APIRouter(prefix="/prompts", tags=["prompts"])

3개 엔드포인트:

GET /prompts:
- cas-prompt-templates 테이블 scan
- items 배열로 반환 (system_prompt는 목록에서 제외 — 상세에서만)

GET /prompts/{prompt_id}:
- get_item으로 상세 조회 (system_prompt 포함)

PUT /prompts/{prompt_id}:
- Request body: PromptUpdate (prompt_name, system_prompt)
- updated_at, updated_by="user_mock" 자동 설정
- 업데이트 후 전체 아이템 반환

main.py에 router include 추가.
```

---

## BE 통합 테스트 (13:15~13:30)

---

### Step 7.1: E2E 테스트 — 전체 파이프라인

**소요**: 10m | **work-plan ID**: 2-25

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/tests/test_e2e.py를 만들어줘.

httpx의 AsyncClient로 FastAPI 앱 직접 테스트.

테스트 시나리오:
1. POST /contracts/upload — 샘플 DOCX 업로드
2. POST /contracts/{id}/analyze — 분석 트리거
3. 분석 완료 대기 (GET /contracts/{id}의 status가 "REVIEWING"이 될 때까지 polling, 최대 120초)
4. GET /contracts/{id}/risk-report — 리스크 리포트 조회 → 200 확인
5. GET /contracts/{id}/workflow — 워크플로우 조회 → steps 존재 확인

샘플 DOCX가 없으면 python-docx로 간단한 테스트 계약서 DOCX를 생성하는 코드도 포함:
from docx import Document
doc = Document()
doc.add_heading("서비스 기본 계약서", 0)
doc.add_paragraph("제1조 (목적) 본 계약은 갑과 을 사이의 IT 서비스 도급 계약입니다...")
# 리스크 유발 조항 포함:
doc.add_paragraph("제5조 (손해배상) 을은 본 계약 불이행으로 인하여 갑에게 발생한 모든 손해를 배상한다.")
doc.add_paragraph("제8조 (지체상금) 지체상금은 계약금액의 0.15%/일로 한다.")
```

#### 검증

```bash
cd backend && python -m pytest tests/test_e2e.py -v
```

---

### Step 7.2: Search E2E

**소요**: 10m | **work-plan ID**: 2-26

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/tests/test_search.py를 만들어줘.

테스트:
1. KB 동기화 상태 확인 (Step 7.1에서 업로드한 계약서가 인덱싱되었는지)
   - 참고: KB 동기화에 수 분 걸릴 수 있음. 사전 데이터가 있다면 그것으로 테스트
2. POST /search — "배상 조항" 검색 → 200 + answer 존재 + sources 존재

KB 동기화 안됐으면 skip 처리 (해커톤이므로).
```

---

### Step 7.3: Diff E2E

**소요**: 10m | **work-plan ID**: 2-27

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/tests/test_diff.py를 만들어줘.

테스트:
1. 동일 고객사 "A사"로 계약서 2건 업로드 (v1, v2)
   - v1: 배상한도 "계약금액의 100%"
   - v2: 배상한도 "모든 손해" (무제한)
2. v2에 대해 분석 실행
3. GET /contracts/{v2_id}/diff — diff_report 존재 확인
4. changes에 "MODIFIED" 타입 변경사항 포함 확인
```

---

### 🔴 인간 체크포인트 (13:30)

| 시각 | 작업 | 판단 기준 |
|------|------|-----------|
| 13:30 | 샘플 DOCX 2건으로 전체 BE 파이프라인 수동 검증 | 업로드 → 분석 → 리포트 → Diff → 워크플로우 모두 동작 |

> **13:30 기준 상태**: Backend 완성. 모든 API 동작, 샘플 데이터로 검증 완료.

---

## 완료 체크리스트

- [ ] `POST /contracts/upload` — 업로드 + S3 저장 + 버전 채번
- [ ] `POST /contracts/:id/analyze` — Orchestrator 비동기 실행
- [ ] `GET /contracts` — 목록 (필터, 페이징)
- [ ] `GET /contracts/:id` — 상세
- [ ] `GET /contracts/:id/risk-report` — 리스크 리포트
- [ ] `GET /contracts/:id/diff` — Diff 리포트
- [ ] `GET /contracts/:id/workflow` — 워크플로우 상태
- [ ] `POST .../approve` + `.../reject` — 승인/반려
- [ ] `POST /search` — RAG 검색
- [ ] `GET/PUT /prompts` — 프롬프트 관리
- [ ] E2E 테스트 3개 통과
- [ ] main.py에 모든 router include됨

### Plan B/C 절단 지점

| Plan | 삭제 대상 | 영향 |
|------|-----------|------|
| Plan B | Feature 6 (프롬프트 API) 삭제 | Step 6.1 건너뜀 (BE 15m 절약) |
| Plan C | Feature 5 (검색) + Feature 3 Diff + Feature 6 삭제 | Step 3.2, 5.1, 6.1 건너뜀 |

---

## 다음 가이드

→ **Guide 07: BE↔FE 연동** (`guide-07-integration.md`) — FE 완성 후 진행
