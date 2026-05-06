# Guide 07: BE↔FE 연동 + 통합 테스트

> 담당: 공통 (BE+FE 담당 합류) | 예상 소요: 1.5시간 | 의존성: Guide 05 + Guide 06 완료
> 대응 Phase: work-plan.md Phase 4 (13:30~15:00)
> 실행 시점: **해커톤 당일 13:30~15:00**

---

## 사전 조건

- [ ] Guide 05 완료 — BE 전체 API 13개 + E2E 테스트 통과
- [ ] Guide 06 완료 — FE 전체 화면 8개 Mock 기반 동작 확인
- [ ] BE 서버 실행 중: `cd backend && uvicorn app.main:app --reload --port 8000`
- [ ] FE 서버 실행 중: `cd frontend && npm run dev` (현재 NEXT_PUBLIC_USE_MOCK=true)
- [ ] DynamoDB에 시드 데이터 존재 (프롬프트 템플릿 등)

---

## Feature 1: Mock→Real 전환 (13:30~14:15)

> api-spec.md 기준으로 양측이 구현했으므로 인터페이스 불일치 최소화.
> env 전환 후 각 화면별로 빠르게 확인+수정한다.

---

### Step 1.1: 환경변수 전환

**소요**: 2m | **의존성**: 없음 | **work-plan ID**: 4-01

#### 작업 설명

FE의 API 클라이언트를 Mock에서 Real로 전환한다. `.env.local` 파일 하나만 수정하면 모든 API 호출이 실제 BE로 향한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/.env.local 파일을 수정해줘:

NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

변경 후 Next.js dev 서버를 재시작해야 한다고 알려줘 (환경변수는 서버 시작 시점에 읽히므로).
```

#### 예상 결과물

- `frontend/.env.local` — Mock 비활성화, 실제 API URL 설정

#### 검증

```bash
# FE 서버 재시작 후
curl http://localhost:3000 -I
# 200 OK 확인

# 브라우저 개발자 도구 Network 탭에서 API 호출이 localhost:8000으로 가는지 확인
```

> 예상 출력: 브라우저에서 대시보드 접속 시 Network 탭에 `http://localhost:8000/api/v1/contracts` 요청이 보임

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| CORS 에러 (브라우저 콘솔) | BE에 CORS 설정 누락 | `backend/app/main.py`에서 `CORSMiddleware` origins에 `http://localhost:3000` 추가 |
| Network 탭에 여전히 Mock 데이터 | 환경변수 미반영 | FE 서버 완전 종료 후 재시작 (Ctrl+C → `npm run dev`) |
| `ECONNREFUSED` 에러 | BE 서버 미실행 | 별도 터미널에서 `cd backend && uvicorn app.main:app --reload --port 8000` |

---

### Step 1.2: 대시보드 + 업로드 연동 확인

**소요**: 15m | **의존성**: Step 1.1 | **work-plan ID**: 4-02

#### 작업 설명

대시보드(`/`)와 업로드(`/upload`) 화면에서 실제 API와 통신하는지 확인하고, 인터페이스 불일치가 있으면 수정한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
브라우저에서 http://localhost:3000 을 열고 실제 API 연동을 확인해줘.

1. 대시보드 (/)
   - GET /api/v1/contracts 호출이 정상인지 확인
   - 응답 JSON 필드명이 FE 타입(ContractListItem)과 일치하는지 확인
   - 불일치 시: FE 타입 또는 API 호출 부분을 api-spec.md 기준으로 수정

2. 업로드 (/upload)
   - 테스트용 DOCX 파일 업로드 시도
   - POST /api/v1/contracts/upload의 multipart/form-data 요청이 정상인지 확인
   - 업로드 후 대시보드에 새 계약서가 나타나는지 확인
   - 불일치 시 수정

확인할 때 docs/api-spec.md 응답 포맷을 기준으로 한다.
에러가 발생하면 브라우저 콘솔 에러와 BE 로그를 함께 확인해서 원인을 파악해줘.
```

#### 예상 결과물

- 대시보드에 계약서 목록 표시 (DynamoDB 데이터)
- 업로드 후 계약서가 목록에 추가됨
- 수정 파일 (있을 경우): FE의 API 호출 코드 또는 타입 정의

#### 검증

```bash
# 브라우저에서 직접 확인:
# 1. http://localhost:3000 → 계약서 목록이 표시되는지
# 2. /upload에서 DOCX 업로드 → 성공 메시지 → 대시보드 이동 → 새 항목 존재
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 목록은 뜨지만 필드 누락 (예: 날짜 없음) | BE/FE 필드명 불일치 | `api-spec.md`의 응답 필드명 기준으로 FE 타입 수정 |
| 업로드 시 400 에러 | FormData 필드명 불일치 | `file`, `customer_name`, `contract_type` 필드명 확인 |
| 업로드 성공인데 목록에 안 보임 | FE가 캐시된 데이터 표시 | 대시보드에서 `refetch` 또는 새로고침 로직 확인 |

---

### Step 1.3: 분석 진행 + 리포트 + Diff 연동 확인

**소요**: 15m | **의존성**: Step 1.1 | **work-plan ID**: 4-03

#### 작업 설명

분석 실행(`/contracts/:id/analyze`), 리스크 리포트(`/contracts/:id/report`), Diff 뷰(`/contracts/:id/diff`) 화면이 실제 API와 정상 동작하는지 확인한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
업로드된 계약서의 분석~리포트~Diff 흐름을 실제 API로 테스트해줘.

1. 분석 실행
   - 대시보드에서 계약서 클릭 → /contracts/:id/analyze 화면
   - POST /api/v1/contracts/:id/analyze 호출
   - 분석 진행 애니메이션이 실시간으로 업데이트되는지 확인
   - 단계별: parsing → risk_analysis → financial_analysis → diff_analysis → routing
   - 완료 후 리포트 화면으로 이동하는지 확인

2. 리스크 리포트
   - GET /api/v1/contracts/:id/risk-report 응답이 화면에 표시되는지 확인
   - risk_items 배열의 각 항목이 리스크 카드로 렌더링되는지 확인
   - severity별 색상(HIGH=빨강, MEDIUM=노랑, LOW=초록)이 맞는지 확인

3. Diff 뷰 (계약서 v2 이상일 때만)
   - GET /api/v1/contracts/:id/diff 응답이 화면에 표시되는지 확인
   - 추가/수정/삭제 항목이 색상으로 구분되는지 확인
   - 첫 번째 계약서(v1)이면 Diff 없음 상태 처리가 맞는지 확인

에러 발생 시 브라우저 콘솔 + BE 서버 로그를 함께 확인해줘.
docs/api-spec.md 의 응답 포맷을 기준으로 불일치 수정.
```

#### 예상 결과물

- 분석 실행→완료→리포트 표시 전체 흐름 동작
- 리스크 카드 정상 렌더링
- Diff 뷰 정상 렌더링 (v2+ 계약서)
- 수정 파일 (있을 경우): 타입 불일치, API 응답 매핑 수정

#### 검증

```bash
# 브라우저에서 전체 흐름 확인:
# 1. 대시보드 → 계약서 클릭 → 분석 실행 → 단계별 진행 표시
# 2. 완료 후 리스크 리포트 확인 → 조항별 리스크 수준 표시
# 3. Diff 탭 → 이전 버전 대비 변경사항 표시 (v2 이상)
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 분석 시작 후 무한 로딩 | BE가 분석 완료 못함 / 폴링 실패 | BE 로그에서 Agent 에러 확인, `GET /contracts/:id` status 필드 확인 |
| 리포트 화면 빈 화면 | risk_items 필드명 불일치 | api-spec.md의 risk-report 응답 구조와 FE 타입 비교 |
| Diff 뷰 에러 | v1 계약서에 Diff 요청 | FE에서 version === 1이면 Diff 탭 비활성화 또는 안내 메시지 |
| 분석이 매우 느림 (3분+) | Bedrock 응답 지연 | MODEL_PROVIDER=groq로 전환해서 우선 연동 확인 |

---

### Step 1.4: 워크플로우 연동 확인

**소요**: 10m | **의존성**: Step 1.1 | **work-plan ID**: 4-04

#### 작업 설명

워크플로우(`/contracts/:id/workflow`) 화면에서 승인/반려 기능이 실제 API와 동작하는지 확인한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
워크플로우 화면의 실제 API 연동을 확인해줘.

1. 워크플로우 상태 조회
   - 분석 완료된 계약서의 /contracts/:id/workflow 화면 접속
   - GET /api/v1/contracts/:id/workflow 응답이 정상 표시되는지 확인
   - 단계별(담당자, 순서, 현재 상태)이 맞게 렌더링되는지 확인

2. 승인 동작
   - 현재 단계의 "승인" 버튼 클릭
   - POST /api/v1/contracts/:id/workflow/:stepId/approve 호출
   - 코멘트 입력 가능 여부 확인
   - 승인 후 다음 단계로 넘어가는지 확인

3. 반려 동작 (별도 계약서로 테스트)
   - "반려" 버튼 → 코멘트 필수 → 상태 REJECTED로 변경

docs/api-spec.md "6. 워크플로우 승인", "7. 워크플로우 반려" 섹션 기준으로 확인.
```

#### 예상 결과물

- 워크플로우 단계 표시 + 승인/반려 동작 정상
- 수정 파일 (있을 경우): 워크플로우 상태 매핑 수정

#### 검증

```bash
# 브라우저에서:
# 1. 분석 완료된 계약서 → 워크플로우 탭 → 단계 표시
# 2. 승인 클릭 → 코멘트 입력 → 상태 변경 확인
# 3. 전체 승인 후 계약서 status가 APPROVED로 변경
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 워크플로우 데이터 없음 | 분석 미완료 또는 Rule Engine 미실행 | 먼저 분석 완료 확인, `workflow_steps`가 DynamoDB에 있는지 확인 |
| 승인 후 상태 안 바뀜 | stepId 불일치 | URL의 stepId와 실제 step id 포맷 비교 |
| "다음 단계" 미표시 | FE에서 단계 순서 로직 오류 | `order` 필드 기준 정렬 확인 |

---

### Step 1.5: 검색 패널 연동 확인

**소요**: 10m | **의존성**: Step 1.1 | **work-plan ID**: 4-05

#### 작업 설명

우측 검색 패널에서 RAG 검색이 실제 Bedrock Knowledge Base를 통해 동작하는지 확인한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
검색 패널의 RAG 검색 실제 API 연동을 확인해줘.

1. 검색 패널 열기 (우측 1/3 패널)
2. 테스트 쿼리 입력: "배상 조항"
3. POST /api/v1/search 호출 확인
   - Request body: { "query": "배상 조항", "max_results": 5 }
4. 응답 결과 확인:
   - answer (AI 생성 답변) 표시
   - sources (출처 계약서 목록) 표시
   - relevance_score 기반 정렬

5. 고객사 필터 테스트:
   - customer_name 필터 추가 후 재검색
   - 결과가 해당 고객사로 필터링되는지 확인

Bedrock KB가 아직 동기화 안 됐을 수 있다 — 빈 결과가 나오면
BE 로그에서 KB 호출이 정상인지만 확인하고 넘어갈 것.
```

#### 예상 결과물

- 검색 쿼리 → AI 답변 + 출처 목록 표시
- 수정 파일 (있을 경우): 검색 요청/응답 매핑 수정

#### 검증

```bash
# 직접 BE API 호출로도 확인
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "배상 조항", "max_results": 5}'
# 200 OK + data.answer, data.sources 존재 확인
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 검색 결과 0건 | KB에 데이터 미동기화 | Guide 01의 KB 데이터 소스 동기화 재실행, 5분 대기 후 재시도 |
| 500 에러 | KB 연결 실패 | `.env`의 `KNOWLEDGE_BASE_ID` 확인, AWS 자격증명 유효성 확인 |
| 답변은 있는데 sources 누락 | FE 렌더링 오류 | `sources` 배열 매핑 코드 확인 |

---

### Step 1.6: 프롬프트 설정 연동 확인

**소요**: 10m | **의존성**: Step 1.1 | **work-plan ID**: 4-06

#### 작업 설명

프롬프트 설정(`/settings/prompts`) 화면에서 프롬프트 조회/수정이 실제 API와 동작하는지 확인한다.

> **Plan B 적용 시**: 이 Step은 생략 가능 (프롬프트 하드코딩으로 대체)

#### AI 프롬프트 (Claude Code에 복붙)

```
프롬프트 설정 화면의 실제 API 연동을 확인해줘.

1. /settings/prompts 접속
   - GET /api/v1/prompts 호출 → 프롬프트 목록 표시
   - DynamoDB cas-prompts 테이블의 시드 데이터가 나타나는지 확인

2. 프롬프트 상세 조회
   - 목록에서 하나 클릭 → GET /api/v1/prompts/:id
   - template_text가 에디터에 표시되는지 확인

3. 프롬프트 수정
   - template_text 일부 수정 → 저장
   - PUT /api/v1/prompts/:id 호출
   - 새로고침 후 수정 내용 유지 확인

에러 시 docs/api-spec.md "9~11. 프롬프트" 섹션 기준으로 수정.
```

#### 예상 결과물

- 프롬프트 목록/상세/수정 정상 동작
- 수정 파일 (있을 경우): 프롬프트 API 매핑 수정

#### 검증

```bash
# 프롬프트 목록 직접 확인
curl http://localhost:8000/api/v1/prompts
# 200 OK + data 배열에 parsing_agent, legal_agent, search_agent 존재
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 프롬프트 0건 | 시드 데이터 미투입 | Guide 03 Step 4.2의 시드 투입 재실행 |
| 수정 후 저장 실패 | PUT 요청 body 구조 불일치 | api-spec.md의 PUT /prompts/:id 요청 body 확인 |

---

## Feature 2: E2E 시나리오 테스트 (14:15~14:30)

> 데모에서 보여줄 흐름과 동일하게 5개 시나리오를 순서대로 실행한다.
> 이 단계에서 발견되는 이슈가 데모 품질을 결정한다.

---

### Step 2.1: 시나리오 1 — 신규 계약서 업로드 → 분석 → 리포트

**소요**: 10m | **의존성**: Feature 1 전체 | **work-plan ID**: 4-07

#### 작업 설명

데모의 핵심 흐름을 처음부터 끝까지 테스트한다. 이 시나리오가 통과하지 않으면 다른 시나리오도 진행 불가.

#### AI 프롬프트 (Claude Code에 복붙)

```
E2E 시나리오 1을 실행해줘. 브라우저에서 전체 흐름을 테스트한다.

시나리오: "A사 SI 계약서 v1 업로드 → AI 분석 → 리스크 리포트 확인"

1. 대시보드(/) → 빈 목록 또는 기존 목록 확인
2. /upload → 테스트 DOCX 파일 업로드
   - customer_name: "A사"
   - contract_type: "SI"
3. 업로드 성공 → 자동으로 분석 화면 이동 (또는 수동 이동)
4. 분석 진행 화면: 5단계 진행 표시 확인
   - parsing (DOCX→JSON)
   - risk_analysis (리스크 탐지)
   - financial_analysis (금액 분석)
   - diff_analysis (이전 버전 비교 - v1이면 스킵)
   - routing (워크플로우 라우팅)
5. 분석 완료 → 리스크 리포트 화면
   - HIGH/MEDIUM/LOW 리스크 항목 표시
   - 각 항목: clause_text, risk_type, severity, suggestion
6. 리포트 데이터가 합리적인지 확인 (실제 AI 분석 결과)

각 단계에서 문제가 발생하면 즉시 보고해줘.
스크린샷이나 콘솔 에러가 있으면 같이 알려줘.
```

#### 예상 결과물

- 전체 흐름 통과: 업로드 → 분석 진행 → 리포트 표시
- 이슈 발견 시: 이슈 목록 + 원인 분석

#### 검증

> **통과 기준**: 업로드 후 5분 이내에 리스크 리포트가 화면에 표시되어야 함

| 체크 | 기준 |
|------|------|
| 업로드 성공 | 201 응답 + 대시보드에 표시 |
| 분석 완료 | status: "ANALYZED" |
| 리포트 표시 | risk_items 1개 이상 |

---

### Step 2.2: 시나리오 2 — 동일 고객사 v2 → Diff 뷰

**소요**: 10m | **의존성**: Step 2.1 | **work-plan ID**: 4-08

#### 작업 설명

동일 고객사(A사)의 두 번째 계약서를 업로드하여 자동 버전 채번 + Diff 리포트 생성을 확인한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
E2E 시나리오 2를 실행해줘.

시나리오: "A사 SI 계약서 v2 업로드 → Diff 뷰 확인"

사전 조건: 시나리오 1에서 A사 v1 계약서가 이미 업로드+분석 완료 상태

1. /upload → 두 번째 DOCX 파일 업로드
   - customer_name: "A사" (동일)
   - contract_type: "SI"
2. 자동 버전 채번 확인 — version: 2로 생성되어야 함
3. 분석 실행 → 완료 대기
4. /contracts/:id/diff 화면 확인:
   - v1 vs v2 변경사항 표시
   - diff_items 배열: 각 항목에 clause_title, change_type(ADDED/MODIFIED/REMOVED), 
     before_text, after_text, risk_impact
   - 색상 구분: 추가=초록, 수정=노랑, 삭제=빨강
5. summary (전체 변경 요약) 텍스트 확인

Diff가 없으면(동일 문서) "변경사항 없음" 상태도 정상.
```

#### 예상 결과물

- v2 자동 채번 + Diff 리포트 생성
- Diff 뷰 화면에서 변경사항 시각화

#### 검증

```bash
# Diff API 직접 확인
curl http://localhost:8000/api/v1/contracts/{CONTRACT_ID}/diff
# 200 OK + data.diff_items 배열 존재
```

---

### Step 2.3: 시나리오 3 — 워크플로우 승인

**소요**: 10m | **의존성**: Step 2.1 | **work-plan ID**: 4-09

#### 작업 설명

HIGH 리스크 계약서의 자동 라우팅 결과 확인 + 전체 승인 흐름 테스트.

#### AI 프롬프트 (Claude Code에 복붙)

```
E2E 시나리오 3을 실행해줘.

시나리오: "HIGH 리스크 → 3단계 워크플로우 → 순차 승인"

사전 조건: 시나리오 1의 계약서가 분석 완료 + HIGH 리스크 포함 상태

1. /contracts/:id/workflow 접속
2. 자동 라우팅 결과 확인:
   - HIGH 리스크 → 3단계 (담당자→팀장→법무팀)
   - MEDIUM 리스크 → 2단계 (담당자→팀장)
   - LOW 리스크 → 1단계 (담당자)
3. 1단계 승인:
   - "승인" 클릭 → 코멘트 입력: "1단계 검토 완료"
   - 상태: PENDING → APPROVED
4. 2단계 승인 (가능해지면):
   - "승인" 클릭 → 코멘트 입력
5. 3단계 승인:
   - 최종 승인 → 계약서 전체 status: APPROVED
6. 대시보드에서 해당 계약서 status 변경 확인

각 단계 전환이 정상적으로 이루어지는지 확인.
이전 단계 미승인 시 다음 단계 비활성화 확인.
```

#### 예상 결과물

- 3단계 순차 승인 → 최종 APPROVED 상태
- 각 단계 전환 정상 동작

#### 검증

```bash
# 워크플로우 상태 API 확인
curl http://localhost:8000/api/v1/contracts/{CONTRACT_ID}/workflow
# 모든 step의 status가 "APPROVED"인지 확인
```

---

### Step 2.4: 시나리오 4 — RAG 검색

**소요**: 10m | **의존성**: Step 2.2 (v1+v2 데이터 필요) | **work-plan ID**: 4-10

#### 작업 설명

RAG 히스토리 검색으로 이전 계약 내용을 자연어로 질의한다. v1, v2 계약서가 KB에 동기화되어야 의미 있는 결과가 나온다.

#### AI 프롬프트 (Claude Code에 복붙)

```
E2E 시나리오 4를 실행해줘.

시나리오: "RAG 검색 — A사 배상 조항 변화"

사전 조건: A사 v1, v2 계약서가 업로드+분석 완료, KB에 인덱싱됨

1. 아무 화면에서 검색 패널(우측) 열기
2. 검색어 입력: "A사와의 계약에서 배상 조항은 어떻게 변해왔나?"
3. 검색 결과 확인:
   - answer: AI가 생성한 요약 답변
   - sources: 관련 계약서 목록 (v1, v2)
   - 각 source의 clause_content, relevance_score
4. 고객사 필터 테스트:
   - customer_name: "A사" 선택 후 재검색
   - 결과가 A사 계약서로만 필터링
5. 다른 질의 테스트: "IP 이전 관련 조항 찾아줘"

검색 결과가 합리적인지 (AI 환각 없는지) 간단히 확인.
KB 동기화가 안 됐으면 빈 결과 → "KB 동기화 필요" 리포트.
```

#### 예상 결과물

- 자연어 질의 → AI 답변 + 출처 목록 표시
- KB 미동기화 시: 해당 사실 확인 리포트

#### 검증

> **통과 기준**: answer 필드에 합리적인 답변 + sources 1개 이상

---

### Step 2.5: 시나리오 5 — 프롬프트 수정 → 재분석

**소요**: 10m | **의존성**: Step 2.1 | **work-plan ID**: 4-11

#### 작업 설명

프롬프트를 수정한 뒤 동일 계약서를 재분석하여 결과가 달라지는지 확인한다. AI 커스터마이징 가능성을 보여주는 핵심 시나리오.

> **Plan B 적용 시**: 이 Step은 생략 가능

#### AI 프롬프트 (Claude Code에 복붙)

```
E2E 시나리오 5를 실행해줘.

시나리오: "프롬프트 수정 → 재분석 → 결과 변화 확인"

1. /settings/prompts 접속
2. legal_agent 프롬프트 선택
3. 프롬프트 수정:
   - 기존: "리스크를 HIGH/MEDIUM/LOW로 분류하세요"
   - 수정: "리스크를 분류할 때 금액 관련 조항은 더 엄격하게 평가하세요. 
     배상한도 미명시는 반드시 HIGH로 분류하세요."
4. 저장
5. 시나리오 1에서 사용한 계약서 재분석 실행:
   - POST /api/v1/contracts/:id/analyze
6. 리포트 비교:
   - 수정 전: 특정 조항이 MEDIUM이었다면
   - 수정 후: 해당 조항이 HIGH로 변경되었는지 확인
7. 변화가 있든 없든 결과 리포트

프롬프트 변경의 영향이 미미할 수 있다 — 변화 유무와 관계없이 
"프롬프트 수정 → 재분석" 흐름 자체가 동작하면 통과.
```

#### 예상 결과물

- 프롬프트 수정 → 재분석 흐름 동작
- 결과 변화 여부 리포트

#### 검증

> **통과 기준**: 재분석이 에러 없이 완료되고 새 리포트가 생성됨 (내용 변화는 optional)

---

## 인간 체크포인트 (14:30)

> **work-plan ID: H-15**

| 시각 | 작업 | 판단 기준 |
|------|------|-----------|
| 14:30 | 5개 E2E 시나리오 수동 확인 | 데모에서 보여줄 흐름과 동일하게 직접 실행 |

### 판단 기준

| 통과 시나리오 수 | 상태 | 액션 |
|-----------------|------|------|
| 5개 전체 | Plan A 정상 | Feature 3(핫픽스 버퍼) 스킵 가능 → 바로 Guide 08 진행 |
| 3~4개 | Plan A/B | Feature 3에서 실패 시나리오 집중 수정 |
| 2개 이하 | Plan C | 시나리오 1+3(업로드→분석→워크플로우)만 집중 수정 |

---

## Feature 3: 핫픽스 버퍼 (14:30~15:00)

---

### Step 3.1: 통합 테스트 이슈 수정

**소요**: 30m (버퍼) | **의존성**: Feature 2 | **work-plan ID**: 4-12

#### 작업 설명

E2E 시나리오에서 발견된 이슈를 우선순위별로 수정한다. 30분 버퍼이므로 데모에 직접 영향을 주는 이슈만 집중한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
통합 테스트에서 발견된 이슈를 수정해줘.

[여기에 Feature 2에서 발견된 이슈 목록을 붙여넣기]

수정 우선순위:
1. 데모 중단 이슈 (에러, 화면 깨짐, API 실패) — 반드시 수정
2. UX 이슈 (로딩 안 나옴, 상태 미갱신) — 가능하면 수정
3. 미관 이슈 (정렬, 색상, 폰트) — 시간 남으면 수정

수정 원칙:
- 최소한의 변경으로 이슈 해결 (이 시점에서 큰 리팩토링 금지)
- 수정 후 해당 시나리오 재실행해서 확인
- 하나 고칠 때마다 알려줘 (나머지에 영향 줄 수 있으므로)
```

#### 검증

```bash
# 수정 후 실패했던 시나리오 재실행
# 각 시나리오별 통과 기준은 Feature 2 참조
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 수정이 30분 안에 끝나지 않음 | 이슈가 너무 많거나 복잡 | Plan B/C 적용 — 핵심 시나리오(1, 3)만 동작하게 집중 |
| 수정하면 다른 곳이 깨짐 | 사이드이펙트 | git stash로 롤백 후 더 안전한 방법으로 재수정 |

---

## Plan B/C 가이드라인

### 이 시점에서 Plan B 전환 (12:30 판단)

Step 1.6 (프롬프트 설정)과 Step 2.5 (시나리오 5)를 **생략**한다.
E2E 시나리오를 4개로 줄인다 (시나리오 5 제외).

### 이 시점에서 Plan C 전환 (13:00 판단)

Step 1.5 (검색), Step 1.6 (프롬프트), Step 2.2 (Diff), Step 2.4 (RAG), Step 2.5 (프롬프트) **생략**.
E2E 시나리오를 2개로 줄인다:
- 시나리오 1: 업로드 → 분석 → 리포트
- 시나리오 3: 워크플로우 승인

---

## 체크리스트 (15:00 기준)

- [ ] Mock→Real 전환 완료 (NEXT_PUBLIC_USE_MOCK=false)
- [ ] CORS 이슈 없음
- [ ] E2E 시나리오 통과 (Plan A: 5개 / B: 4개 / C: 2개)
- [ ] 핫픽스 적용 완료 (있을 경우)
- [ ] BE+FE 모두 에러 없이 실행 중
- [ ] 데모 시나리오 순서대로 전체 흐름 동작 확인

> **15:00 기준 상태**: 전체 시스템 연동 완료. 데모 시나리오 동작 확인. → Guide 08 진행.
