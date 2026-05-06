# Guide 03: 프로젝트 초기화 + 스캐폴딩

> 담당: 공통 (BE+FE 함께) | 예상 소요: 30분 | 의존성: Guide 01 완료
> 대응 Phase: work-plan.md Phase 1 (10:00~10:30)
> 실행 시점: **해커톤 당일 10:00**

---

## 사전 조건

- [ ] Guide 01 완료 (AWS 인프라 프로비저닝)
- [ ] Guide 02 완료 (사전 문서 + 프롬프트)
- [ ] 팀원 로컬 환경: Python 3.11+, Node 18+, AWS CLI v2
- [ ] `.env.example` 존재 (Guide 01 Step 6)

---

## 인간 작업: 환경 세팅 (10:00~10:10)

### Step 0.1: .env 파일 생성 (H-07)

**소요**: 5m | **담당**: 인간

#### 작업 설명

`.env.example`을 복사하여 `.env`를 만들고, 실제 AWS 자격증명과 KB ID를 입력한다.

#### 수동 작업

```bash
cp .env.example .env
```

`.env` 편집 — 아래 값들을 실제 값으로 교체:

```
MODEL_PROVIDER=bedrock                  # ← groq에서 bedrock으로 변경!
AWS_ACCESS_KEY_ID=AKIA...실제값...
AWS_SECRET_ACCESS_KEY=...실제값...
BEDROCK_KB_ID=...Guide 01에서 메모한 KB ID...
```

---

### Step 0.2: AWS 연결 테스트 (H-08, H-09)

**소요**: 3m | **담당**: 인간

#### AI 프롬프트 (Claude Code에 복붙)

```
AWS 연결 상태를 테스트하는 Python 스크립트를 만들어서 실행해줘.
파일: scripts/test-aws-connection.py

테스트 항목:
1. S3: cas-contracts-megathon 버킷 접근 가능한지 (list_objects)
2. DynamoDB: cas-contracts 테이블 존재하는지 (describe_table)
3. Bedrock: Claude 모델 접근 가능한지 (list_foundation_models에서 anthropic.claude-3-5-sonnet 확인)
4. Bedrock KB: .env의 BEDROCK_KB_ID로 KB 상태 확인 (get_knowledge_base)

각 항목 성공/실패 출력. 리전은 ap-northeast-2.
.env 파일에서 환경변수 로드 (python-dotenv 사용).
```

#### 검증

```bash
pip install python-dotenv boto3 && python scripts/test-aws-connection.py
```

> 예상 출력:
> ```
> [✓] S3: cas-contracts-megathon — 접근 가능
> [✓] DynamoDB: cas-contracts — 테이블 존재
> [✓] Bedrock: Claude 3.5 Sonnet — 활성화됨
> [✓] Bedrock KB: cas-knowledge-base — ACTIVE
> ```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| `NoCredentialsError` | .env에 AWS 키 누락 | .env 파일 AWS_ACCESS_KEY_ID/SECRET 확인 |
| S3 접근 실패 | 버킷명 다름 | .env의 S3_BUCKET 값 확인 |
| KB 상태 FAILED | KB 생성 실패 | AWS 콘솔에서 KB 재생성 (Guide 01 Step 4) |

---

## 병렬 그룹 A (10:10~10:30, 동시 실행)

BE 담당과 FE 담당이 각자의 Claude Code 세션에서 동시 진행.

---

### Step 1.1: FastAPI 프로젝트 스캐폴딩 (BE 담당)

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 1-01

#### 작업 설명

Python FastAPI 백엔드 프로젝트의 전체 폴더 구조와 설정 파일을 한 번에 생성한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/ 디렉토리에 FastAPI 프로젝트를 스캐폴딩해줘.
backend/.claude/CLAUDE.md를 먼저 읽고 폴더 구조를 따라.

1. pyproject.toml 생성:
   - name: "cas-backend"
   - python: ">=3.11"
   - dependencies:
     fastapi, uvicorn[standard], pydantic>=2.0, pydantic-settings,
     strands-agents, strands-agents-tools,
     boto3, python-docx, deepdiff, litellm,
     python-multipart, python-dotenv, mangum
   - dev dependencies: pytest, httpx, ruff

2. app/main.py:
   - FastAPI 앱 생성
   - CORS 미들웨어 (localhost:3000, localhost:8000)
   - /health 엔드포인트
   - 모든 router include (contracts, search, prompts, workflow)
   - 404 handler

3. app/core/config.py:
   - pydantic-settings BaseSettings 클래스
   - 모든 .env 변수를 필드로 정의
   - model_config로 .env 파일 로드

4. app/core/model.py:
   - get_model() 팩토리 함수
   - MODEL_PROVIDER에 따라 BedrockModel 또는 LiteLLMModel 반환

5. 모든 하위 디렉토리 + __init__.py 생성:
   clients/, models/, agents/, tools/, routers/, services/
   각 디렉토리에 빈 파일(placeholder)로 __init__.py만 생성

6. app/models/common.py:
   - ApiResponse 모델 (success: bool, data: Any)
   - ErrorResponse 모델 (success: bool, error: dict)

실행 확인용으로 uvicorn 실행 명령어도 알려줘:
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload --port 8000
```

#### 예상 결과물

```
backend/
  pyproject.toml
  app/
    __init__.py
    main.py
    core/
      __init__.py, config.py, model.py
    clients/
      __init__.py
    models/
      __init__.py, common.py
    agents/
      __init__.py
    tools/
      __init__.py
    routers/
      __init__.py
    services/
      __init__.py
```

#### 검증

```bash
cd backend && pip install -e . && uvicorn app.main:app --port 8000 &
sleep 3
curl http://localhost:8000/health
kill %1
```

> 예상 출력: `{"status": "ok"}` 또는 유사한 health check 응답

---

### Step 1.2: Next.js 14 프로젝트 스캐폴딩 (FE 담당)

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 1-02

#### 작업 설명

Next.js 14 프론트엔드 프로젝트를 생성하고, App Router 기반 폴더 구조를 세팅한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/ 디렉토리에 Next.js 14 프로젝트를 생성해줘.

1. 프로젝트 생성 (이미 frontend/ 디렉토리와 .claude/CLAUDE.md가 있으므로 그 안에 생성):
   cd frontend && npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm

   만약 디렉토리가 비어있지 않다는 에러가 나면:
   - .claude 디렉토리를 임시로 이동
   - create-next-app 실행
   - .claude 디렉토리를 다시 복원

2. frontend/.claude/CLAUDE.md를 읽고 폴더 구조를 따라 디렉토리 생성:
   components/ui/
   components/layout/
   components/contracts/
   components/analysis/
   components/risk/
   components/diff/
   components/workflow/
   components/search/
   components/prompts/
   stores/
   lib/
   public/mock/

3. .env.local 생성:
   NEXT_PUBLIC_USE_MOCK=true
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

4. app/layout.tsx를 기본 레이아웃으로 수정:
   - html lang="ko"
   - body에 flex 레이아웃 (사이드바 + 메인)
   - 사이드바/헤더는 나중에 구현, 일단 placeholder

5. app/page.tsx를 대시보드 placeholder로:
   - "Contract Agent System — Dashboard" 텍스트 표시

6. 라우트 디렉토리 생성 (page.tsx는 placeholder "Coming soon" 텍스트):
   app/upload/page.tsx
   app/contracts/[id]/page.tsx
   app/contracts/[id]/analyze/page.tsx
   app/contracts/[id]/report/page.tsx
   app/contracts/[id]/diff/page.tsx
   app/contracts/[id]/workflow/page.tsx
   app/settings/prompts/page.tsx
```

#### 예상 결과물

```
frontend/
  app/
    layout.tsx, page.tsx
    upload/page.tsx
    contracts/[id]/
      page.tsx, analyze/page.tsx, report/page.tsx
      diff/page.tsx, workflow/page.tsx
    settings/prompts/page.tsx
  components/ (빈 하위 디렉토리들)
  stores/
  lib/
  public/mock/
  .env.local
  package.json, tsconfig.json, tailwind.config.ts
```

#### 검증

```bash
cd frontend && npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

> 예상 출력: HTML 응답 (Next.js 페이지)

---

### Step 1.3: 공통 타입/스키마 정의 (공통)

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 1-03

#### 작업 설명

api-spec.md를 기반으로 BE(Pydantic)와 FE(TypeScript) 양쪽의 데이터 타입을 정의한다. 양쪽이 동일한 스키마를 사용해야 연동 시 문제가 없다.

#### AI 프롬프트 — BE Pydantic 모델 (Claude Code에 복붙)

```
docs/api-spec.md를 읽고, backend/app/models/ 하위에 Pydantic 모델을 생성해줘.

1. contract.py:
   - ContractUpload (customer_name, contract_type optional)
   - Clause (id, type, title, content, paragraph)
   - Party (name, representative)
   - Dates (contract_date, start_date, end_date, renewal_terms)
   - Financials (total_amount, currency, payment_terms, penalty_clause)
   - AnalysisStep (name, status, started_at, completed_at)
   - PreviousVersion (version, uploaded_at)
   - Contract (전체 — api-spec.md GET /contracts/:id 응답 기준)
   - ContractListItem (목록용 축약 — api-spec.md GET /contracts 응답 기준)

2. risk_report.py:
   - ClauseRisk (clause_id, risk_level, risk_type, reason, recommendation, financial_impact)
   - RiskReport (id, contract_id, overall_risk, risk_summary, clause_risks, key_concerns, standard_deviation, created_at)

3. workflow.py:
   - WorkflowStep (id, step_order, department, assignee, status, comment, signed_at, created_at)
   - WorkflowResponse (contract_id, overall_status, steps)
   - ApprovalRequest (comment)

4. prompt_template.py:
   - PromptTemplate (id, prompt_name, contract_type, system_prompt, updated_at, updated_by)
   - PromptUpdate (prompt_name, system_prompt)

5. search.py:
   - SearchRequest (query, customer_name optional, max_results optional default 5)
   - SearchSource (contract_id, customer_name, version, contract_type, clause_content, relevance_score)
   - SearchResponse (answer, sources, total_sources)

6. diff.py:
   - DiffChange (clause_id, change_type, previous_content, current_content, risk_impact, highlight)
   - FinancialChanges (amount_delta, penalty_change)
   - DiffReport (diff_summary, risk_change, changes, financial_changes, new_risk_clauses)

모든 모델에 type hints + Optional 적절히 사용. api-spec.md의 JSON 스키마와 정확히 일치하게.
```

#### AI 프롬프트 — FE TypeScript 타입 (Claude Code에 복붙)

```
docs/api-spec.md를 읽고, frontend/lib/types.ts를 생성해줘.

API 응답에 사용되는 모든 TypeScript 타입을 정의해.

포함 타입:
- ApiResponse<T> (success, data, error?)
- Contract, ContractListItem, Clause, Party, Dates, Financials
- AnalysisStep, PreviousVersion
- RiskReport, ClauseRisk
- DiffReport, DiffChange, FinancialChanges
- WorkflowStep, WorkflowResponse
- SearchRequest, SearchResponse, SearchSource
- PromptTemplate, PromptUpdate
- ContractListResponse (items, total, limit, offset)

api-spec.md의 JSON 스키마와 정확히 일치하게. 
필드명은 snake_case (API가 Python이므로).
```

#### 예상 결과물

- `backend/app/models/contract.py`, `risk_report.py`, `workflow.py`, `prompt_template.py`, `search.py`, `diff.py`
- `frontend/lib/types.ts`

#### 검증

```bash
cd backend && python -c "from app.models.contract import Contract; print('BE models OK')"
cd frontend && npx tsc --noEmit lib/types.ts && echo "FE types OK"
```

---

### Step 1.4: DynamoDB 프롬프트 시드 투입 (공통)

**소요**: 5m | **의존성**: Guide 02 (seed-data.json 존재) | **work-plan ID**: 1-06

#### 작업 설명

사전 준비에서 작성한 프롬프트 시드 데이터를 DynamoDB에 투입한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/seed-data.json을 읽고, DynamoDB cas-prompt-templates 테이블에 투입하는 Python 스크립트를 만들어서 실행해줘.

파일: scripts/seed-prompts.py

내용:
1. seed-data.json 로드
2. boto3 DynamoDB resource 사용
3. batch_writer()로 모든 아이템 put_item
4. 투입 완료 후 scan으로 확인 출력

리전: ap-northeast-2, .env에서 환경변수 로드.
```

#### 검증

```bash
python scripts/seed-prompts.py
```

> 예상 출력: `4건 투입 완료: prompt_default, prompt_nda, prompt_msa, prompt_si`

---

## 순차 그룹 B (Step 1.2 완료 후)

---

### Step 2.1: Mock JSON 데이터 생성 (FE 담당)

**소요**: 10m | **의존성**: Step 1.2 | **work-plan ID**: 1-04

#### 작업 설명

api-spec.md의 응답 예시를 기반으로 10개 Mock JSON 파일을 생성한다. FE 개발 전체 기간 동안 이 데이터로 독립 개발한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/api-spec.md를 읽고, frontend/public/mock/ 디렉토리에 Mock JSON 파일 10개를 생성해줘.

각 파일은 api-spec.md의 Response 예시를 그대로 사용하되, 데이터를 좀 더 풍부하게 만들어.

파일 목록:
1. contracts-list.json — GET /contracts 응답. 계약서 5건 (다양한 상태, 고객사, 리스크 레벨)
2. contract-detail.json — GET /contracts/:id 응답. 상세 정보 + clauses 5개 + analysis_steps 4개 + previous_versions 2개
3. risk-report.json — GET /contracts/:id/risk-report 응답. HIGH 리스크. clause_risks 3개 (HIGH, HIGH, MEDIUM)
4. diff-report.json — GET /contracts/:id/diff 응답. changes 3개 (MODIFIED, ADDED, MODIFIED)
5. diff-report-null.json — 이전 버전 없는 경우: {"success": true, "data": null}
6. workflow.json — GET /contracts/:id/workflow 응답. 3단계 (APPROVED, PENDING, PENDING)
7. search-result.json — POST /search 응답. A사 배상조항 검색 결과. sources 3건
8. prompts-list.json — GET /prompts 응답. 프롬프트 4건 (default, nda, msa, si)
9. prompt-detail.json — GET /prompts/:id 응답. 기본 리스크 분석 프롬프트 상세
10. analyze-accepted.json — POST /contracts/:id/analyze 응답. 202 Accepted 형태

모든 JSON은 {"success": true, "data": {...}} 래퍼 포맷.
한국어 데이터 사용 (고객사명: A사, 메가존클라우드 등).
```

#### 예상 결과물

- `frontend/public/mock/` 하위 JSON 10개

#### 검증

```bash
ls frontend/public/mock/ | wc -l
```

> 예상 출력: `10`

```bash
python3 -c "import json; [json.load(open(f'frontend/public/mock/{f}')) for f in __import__('os').listdir('frontend/public/mock/')]; print('All valid JSON')"
```

---

### Step 2.2: FE API 클라이언트 래퍼 (FE 담당)

**소요**: 10m | **의존성**: Step 1.2 | **work-plan ID**: 1-05

#### 작업 설명

Mock/Real 전환이 가능한 API 클라이언트를 생성한다. `NEXT_PUBLIC_USE_MOCK=true`이면 Mock JSON을, `false`이면 실제 BE API를 호출한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/.claude/CLAUDE.md의 API Client 패턴을 참고해서 frontend/lib/api.ts를 생성해줘.

포함 내용:
1. apiClient<T>(path, options?) 함수 — Mock/Real 자동 전환
2. pathToMockFile(path) 함수 — API 경로 → Mock 파일명 매핑
   예:
   "/contracts" → "contracts-list.json"
   "/contracts/contract_001" → "contract-detail.json"
   "/contracts/contract_001/risk-report" → "risk-report.json"
   "/contracts/contract_001/diff" → "diff-report.json"
   "/contracts/contract_001/workflow" → "workflow.json"
   "/contracts/contract_001/analyze" → "analyze-accepted.json"
   "/search" → "search-result.json"
   "/prompts" → "prompts-list.json"
   "/prompts/prompt_default" → "prompt-detail.json"

3. 편의 함수들:
   - api.get<T>(path) — GET 요청
   - api.post<T>(path, body) — POST 요청
   - api.put<T>(path, body) — PUT 요청

4. ApiResponse<T> 타입은 lib/types.ts에서 import

Mock 모드에서 POST/PUT 요청은 해당 mock 파일을 GET으로 반환하면 됨 (write는 무시).
```

#### 예상 결과물

- `frontend/lib/api.ts` — Mock/Real 전환 API 클라이언트

#### 검증

- TypeScript 컴파일 에러 없는지 확인
- Mock 모드에서 `apiClient('/contracts')` 호출 시 contracts-list.json 반환되는지 확인

---

## 10:30 상태 확인

> **이 시점에서 확인할 것:**
> - [ ] BE: `uvicorn app.main:app --reload` 실행 가능, /health 응답
> - [ ] FE: `npm run dev` 실행 가능, localhost:3000 접속 가능
> - [ ] FE: Mock JSON 10개 존재, API 클라이언트 작동
> - [ ] DynamoDB: 프롬프트 시드 4건 투입됨
> - [ ] BE/FE 양쪽 타입 정의 완료
>
> **이제부터 BE와 FE는 완전 독립 병렬 진행!**
> - BE 담당 → **Guide 04: Backend Agent + Tool 구현**
> - FE 담당 → **Guide 06: Frontend 화면 구현**

---

## 다음 가이드

- BE 담당 → **Guide 04** (`guide-04-backend-agent.md`)
- FE 담당 → **Guide 06** (`guide-06-frontend.md`)
