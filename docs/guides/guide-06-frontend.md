# Guide 06: Frontend — 화면 구현

> 담당: FE 담당 | 예상 소요: 3시간 | 의존성: Guide 03 완료 (스캐폴딩 + Mock JSON)
> 대응 Phase: work-plan.md Phase 3 (10:30~13:30)
> 실행 시점: **해커톤 당일 10:30~13:30**

---

## 사전 조건

- [ ] Guide 03 완료 — Next.js 스캐폴딩 + Mock JSON 10개 + API 클라이언트
- [ ] `cd frontend && npm run dev` → localhost:3000 정상 접속
- [ ] `frontend/.env.local`에 `NEXT_PUBLIC_USE_MOCK=true`
- [ ] `frontend/lib/types.ts` + `frontend/lib/api.ts` 존재
- [ ] `frontend/.claude/CLAUDE.md` 읽어둠

---

## 공통 컴포넌트 + 레이아웃 (10:30~11:00)

---

### Step 0.1: 사이드바 + 헤더 + 메인 레이아웃

**소요**: 15m | **의존성**: 없음 | **work-plan ID**: 3-01

#### 작업 설명

모든 페이지에 적용되는 공통 레이아웃. 좌측 사이드바(네비게이션) + 상단 헤더 + 메인 콘텐츠 영역.

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/.claude/CLAUDE.md를 읽고, 공통 레이아웃 컴포넌트를 구현해줘.

1. components/layout/Sidebar.tsx:
   - 좌측 고정 사이드바 (w-64, bg-gray-900, text-white)
   - 상단: CAS 로고/타이틀 "Contract Agent System"
   - 네비게이션 링크:
     - 📊 대시보드 (/)
     - 📤 계약서 업로드 (/upload)
     - ⚙️ 프롬프트 설정 (/settings/prompts)
   - 현재 경로 active 표시 (bg-gray-700 rounded)
   - Next.js Link + usePathname() 사용

2. components/layout/Header.tsx:
   - 상단 고정 헤더 (h-16, bg-white, border-b, shadow-sm)
   - 좌측: 현재 페이지 타이틀 (동적)
   - 우측: Mock 사용자 "홍길동 (영업팀)" + 아바타 placeholder

3. app/layout.tsx 수정:
   - html lang="ko"
   - body: flex flex-row
   - Sidebar (좌측 고정)
   - 우측: flex flex-col
     - Header (상단 고정)
     - main (flex-1, overflow-auto, p-6, bg-gray-50) → {children}

Tailwind만 사용. 이모지는 네비게이션 아이콘 대용 (해커톤이므로 아이콘 라이브러리 미설치).
```

#### 예상 결과물

- `components/layout/Sidebar.tsx`
- `components/layout/Header.tsx`
- `app/layout.tsx` 수정됨

#### 검증

- localhost:3000 접속 → 좌측 사이드바 + 상단 헤더 + 메인 영역 표시
- 네비게이션 클릭 시 페이지 이동

---

### Step 0.2: 공통 UI 컴포넌트

**소요**: 20m | **의존성**: 없음 | **work-plan ID**: 3-02

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/components/ui/ 하위에 공통 재사용 컴포넌트를 구현해줘.
frontend/.claude/CLAUDE.md의 컴포넌트 패턴 참고.

1. Badge.tsx:
   - variant: "default" | "success" | "warning" | "danger" | "info"
   - 색상 매핑: default=gray, success=green, warning=yellow, danger=red, info=blue
   - 작은 둥근 뱃지 (px-2 py-0.5 rounded-full text-xs font-medium)

2. RiskBadge.tsx:
   - riskLevel: "HIGH" | "MEDIUM" | "LOW"
   - HIGH=red-100/red-800, MEDIUM=yellow-100/yellow-800, LOW=green-100/green-800

3. StatusChip.tsx:
   - status: "DRAFT" | "PARSING" | "REVIEWING" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED"
   - 상태별 색상 + 한국어 라벨
   - DRAFT=gray"초안", PARSING=blue"분석중", REVIEWING=yellow"검토중",
     PENDING_APPROVAL=orange"승인대기", APPROVED=green"승인", REJECTED=red"반려"

4. Card.tsx:
   - children, className, title(optional), description(optional)
   - bg-white rounded-lg shadow-sm border p-6

5. Table.tsx:
   - columns: {key, label, render?}[], data: any[]
   - 기본 테이블 스타일 (border, hover:bg-gray-50, header:bg-gray-50)

6. Button.tsx:
   - variant: "primary" | "secondary" | "danger" | "ghost"
   - size: "sm" | "md" | "lg"
   - loading: boolean (스피너 표시)
   - disabled 상태

7. Skeleton.tsx:
   - variant: "text" | "card" | "table"
   - 회색 배경 애니메이션 (animate-pulse)
   - table: 3행 * 4열 스켈레톤

8. Input.tsx:
   - label, error, helperText 지원
   - Tailwind form 스타일

모든 컴포넌트에 TypeScript Props interface 정의.
export 형태: named export.
```

#### 예상 결과물

- `components/ui/` 하위 8개 파일

#### 검증

```bash
cd frontend && npx tsc --noEmit
```

> 타입 에러 없으면 OK

---

### Step 0.3: Zustand 스토어 설계

**소요**: 15m | **의존성**: types.ts, api.ts | **work-plan ID**: 3-03

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/lib/types.ts와 frontend/lib/api.ts를 읽고,
frontend/stores/ 하위에 Zustand 스토어 5개를 구현해줘.

frontend/.claude/CLAUDE.md의 Zustand 패턴 참고.

1. stores/contracts.ts:
   - contracts: ContractListItem[], loading, error
   - selectedContract: Contract | null
   - fetchContracts(filters?): GET /contracts
   - fetchContract(id): GET /contracts/:id
   - uploadContract(file, customerName, contractType?): POST /contracts/upload
   - analyzeContract(id): POST /contracts/:id/analyze

2. stores/riskReport.ts:
   - report: RiskReport | null, loading
   - fetchRiskReport(contractId): GET /contracts/:id/risk-report

3. stores/workflow.ts:
   - workflow: WorkflowResponse | null, loading
   - fetchWorkflow(contractId): GET /contracts/:id/workflow
   - approveStep(contractId, stepId, comment): POST .../approve
   - rejectStep(contractId, stepId, comment): POST .../reject

4. stores/search.ts:
   - result: SearchResponse | null, loading, query
   - searchContracts(query, customerName?, maxResults?): POST /search
   - clearResults()

5. stores/prompts.ts:
   - prompts: PromptTemplate[], selectedPrompt: PromptTemplate | null, loading
   - fetchPrompts(): GET /prompts
   - fetchPrompt(id): GET /prompts/:id
   - updatePrompt(id, data): PUT /prompts/:id

각 스토어에서 apiClient를 사용. Mock 모드에서도 동작하게.
에러 발생 시 error 상태에 저장.
```

#### 예상 결과물

- `stores/contracts.ts`, `riskReport.ts`, `workflow.ts`, `search.ts`, `prompts.ts`

---

## Feature 1: 대시보드 (11:00~11:30)

---

### Step 1.1: 대시보드 페이지

**소요**: 30m | **의존성**: Step 0.1~0.3 | **work-plan ID**: 3-04

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/contracts-list.json을 읽고 데이터 구조를 확인한 뒤,
대시보드 페이지를 구현해줘.

1. components/contracts/ContractSummaryCards.tsx:
   - 상단 요약 카드 4개 (한 줄로 grid grid-cols-4 gap-4):
     - 전체 계약서 수 (총 N건)
     - 분석 진행중 (PARSING + REVIEWING 합계)
     - 승인 대기 (PENDING_APPROVAL)
     - 리스크 HIGH 건수
   - 각 카드: Card 컴포넌트 사용, 숫자 크게 표시 (text-3xl font-bold)

2. components/contracts/ContractTable.tsx:
   - 상단: 상태 필터 버튼 그룹 (전체, 초안, 분석중, 검토중, 승인대기, 승인, 반려)
   - Table 컴포넌트 사용
   - 컬럼: 고객사명, 계약유형, 버전, 상태(StatusChip), 리스크(RiskBadge), 업로드일, 액션
   - 행 클릭 시 /contracts/:id로 이동
   - 액션 열: "분석" 버튼 (status가 DRAFT일 때만)

3. app/page.tsx 수정:
   - 'use client'
   - useContractStore에서 fetchContracts + contracts 가져옴
   - ContractSummaryCards + ContractTable 렌더링
   - 로딩 시 Skeleton 표시

Mock 모드에서 contracts-list.json 데이터가 표시되는지 확인.
```

#### 예상 결과물

- `components/contracts/ContractSummaryCards.tsx`
- `components/contracts/ContractTable.tsx`
- `app/page.tsx` 수정

#### 검증

- localhost:3000 → 요약 카드 4개 + 계약서 테이블 표시
- 상태 필터 클릭 시 테이블 필터링

---

## Feature 2: 계약서 업로드 (11:00~11:25)

---

### Step 2.1: 업로드 페이지

**소요**: 25m | **work-plan ID**: 3-05

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/app/upload/page.tsx를 구현해줘.

업로드 페이지:
1. 드래그&드롭 영역:
   - 점선 테두리 (border-2 border-dashed border-gray-300 rounded-lg)
   - 파일 드롭 또는 클릭으로 파일 선택
   - .docx만 허용 (accept=".docx")
   - 파일 선택 시 파일명 표시 + 삭제(X) 버튼
   - onDragOver/onDrop 이벤트 처리

2. 메타데이터 입력 폼:
   - 고객사명 (필수, text input)
   - 계약유형 (선택, select dropdown: NDA, MSA, SI, SLA, Maintenance, Other)
     - "자동 분류" 옵션 (AI가 분류)

3. 업로드 버튼:
   - 파일 + 고객사명 입력 시 활성화
   - 클릭 시 useContractStore.uploadContract() 호출
   - 업로드 중 loading 스피너
   - 성공 시 /contracts/:id/analyze 페이지로 이동
   - Mock 모드에서는 바로 성공 응답

4. UI:
   - 카드 레이아웃 (max-w-2xl mx-auto)
   - 드래그 영역 위에 "계약서 DOCX 파일을 드래그하세요" 안내
   - 파일 아이콘 (📄 이모지)
```

#### 예상 결과물

- `app/upload/page.tsx`

#### 검증

- /upload 접속 → 드래그 영역 + 폼 표시
- 파일 드래그 시 영역 하이라이트

---

## Feature 3: 분석 진행 (11:00~11:20)

---

### Step 3.1: 분석 진행 페이지

**소요**: 20m | **work-plan ID**: 3-06

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/analyze-accepted.json을 읽고,
frontend/app/contracts/[id]/analyze/page.tsx를 구현해줘.

분석 진행 페이지 — Agent 처리 단계별 상태를 실시간으로 보여줌:

1. components/analysis/AnalysisStepIndicator.tsx:
   - 4단계를 세로 타임라인으로 표시:
     1. 📄 계약서 파싱 (Parsing)
     2. 🔍 리스크 분석 (Legal Review)
     3. 📊 버전 비교 (Diff)
     4. 🔀 검토 라우팅 (Routing)
   
   - 각 단계 상태 표시:
     - PENDING: 회색 원 + 회색 텍스트
     - IN_PROGRESS: 파란색 스피너 (animate-spin) + 파란색 텍스트 + "처리 중..."
     - COMPLETED: 초록색 체크마크 ✓ + 초록색 텍스트 + 완료 시간

   - 단계 간 세로선 연결 (border-l-2)
   - 현재 진행 단계에 약간의 확대/강조 효과

2. page.tsx:
   - useParams()로 id 가져옴
   - useContractStore.fetchContract(id)로 analysis_steps 가져옴
   - 3초 간격 polling (setInterval로 fetchContract 반복 호출)
   - 모든 단계 COMPLETED 시 polling 중지 + "분석 완료!" 메시지 + 리포트 보기 버튼
   - 리포트 보기 → /contracts/:id/report로 이동

Mock 모드에서는 contract-detail.json의 analysis_steps 사용 (이미 COMPLETED 상태).
실제에서는 단계별로 IN_PROGRESS→COMPLETED 순차 변화.
```

#### 예상 결과물

- `components/analysis/AnalysisStepIndicator.tsx`
- `app/contracts/[id]/analyze/page.tsx`

---

## Feature 4: 리스크 리포트 (11:15~11:45)

---

### Step 4.1: 리스크 리포트 페이지

**소요**: 30m | **work-plan ID**: 3-07

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/risk-report.json을 읽고,
리스크 리포트 페이지를 구현해줘.

1. components/risk/RiskSummary.tsx:
   - 상단 카드: overall_risk를 크게 표시 (RiskBadge 대형 버전)
   - risk_summary 텍스트
   - key_concerns 리스트 (⚠️ 아이콘 + 텍스트)
   - standard_deviation 표시

2. components/risk/ClauseRiskCard.tsx:
   - 조항별 리스크 카드:
     - 좌측: RiskBadge (HIGH/MEDIUM/LOW)
     - 제목: risk_type (한국어 매핑: 무제한_배상책임 → "무제한 배상책임")
     - 위험 근거: reason
     - 수정 제안: recommendation (bg-blue-50 p-3 rounded)
     - 재무 영향: financial_impact (bg-yellow-50 p-3 rounded)
   - 리스크 레벨별 좌측 보더 색상 (border-l-4 border-red-500 등)

3. app/contracts/[id]/report/page.tsx:
   - useRiskReportStore.fetchRiskReport(id)
   - RiskSummary + ClauseRiskCard 리스트 렌더링
   - 로딩 시 Skeleton

Mock 데이터로 HIGH 리스크 3건이 카드로 표시되는지 확인.
```

#### 예상 결과물

- `components/risk/RiskSummary.tsx`, `ClauseRiskCard.tsx`
- `app/contracts/[id]/report/page.tsx`

---

## Feature 5: Diff 뷰 (11:30~12:00)

---

### Step 5.1: Diff 뷰 페이지

**소요**: 30m | **work-plan ID**: 3-08

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/diff-report.json을 읽고,
Diff 뷰 페이지를 구현해줘.

1. components/diff/DiffChangeItem.tsx:
   - 변경 조항 카드:
     - change_type 뱃지: ADDED=초록, REMOVED=빨강, MODIFIED=노랑
     - clause_id 표시
     - 이전 내용 (previous_content): bg-red-50 + 취소선 (있을 때만)
     - 현재 내용 (current_content): bg-green-50
     - risk_impact: "리스크 증가" = 빨강 뱃지, "리스크 감소" = 초록, "중립" = 회색
     - highlight: 핵심 변경 포인트 (font-medium, 노란 배경 하이라이트)

2. app/contracts/[id]/diff/page.tsx:
   - 상단: diff_summary + risk_change (예: "MEDIUM → HIGH" 화살표 표시)
   - financial_changes: amount_delta, penalty_change 표시
   - new_risk_clauses: 이번 버전에서 새로 발생한 리스크 조항 하이라이트
   - DiffChangeItem 리스트
   - data가 null이면 "이전 버전이 없습니다. 첫 번째 업로드된 계약서입니다." 메시지

변경 타입별 시각적 구분이 명확해야 데모에서 임팩트 있음.
ADDED는 전체 카드 좌측 border-l-4 border-green-500
REMOVED는 border-red-500
MODIFIED는 border-yellow-500
```

#### 예상 결과물

- `components/diff/DiffChangeItem.tsx`
- `app/contracts/[id]/diff/page.tsx`

---

## Feature 6: 워크플로우 (11:30~11:55)

---

### Step 6.1: 워크플로우 페이지

**소요**: 25m | **work-plan ID**: 3-09

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/workflow.json을 읽고,
워크플로우 페이지를 구현해줘.

1. components/workflow/WorkflowTimeline.tsx:
   - 세로 타임라인 (step_order 순서):
     - 각 단계: 원형 아이콘 + 부서명 + 담당자명 + 상태
     - APPROVED: 초록 체크 ✓ + comment + signed_at
     - PENDING: 회색 시계 ⏳ + "승인 대기"
     - REJECTED: 빨강 X ✗ + comment
   - 단계 간 세로 연결선

2. components/workflow/ApprovalButton.tsx:
   - 승인 / 반려 버튼 그룹 (PENDING 상태일 때만 표시)
   - 코멘트 입력 textarea
   - 승인: 초록 버튼, 반려: 빨강 버튼
   - 클릭 시 useWorkflowStore.approveStep/rejectStep 호출
   - 로딩 스피너

3. app/contracts/[id]/workflow/page.tsx:
   - 상단: overall_status 표시
   - WorkflowTimeline
   - 현재 PENDING인 첫 번째 단계에 ApprovalButton 표시
   - 승인/반려 후 새로고침

Mock 데이터: 3단계 중 1단계 APPROVED, 2-3단계 PENDING.
```

#### 예상 결과물

- `components/workflow/WorkflowTimeline.tsx`, `ApprovalButton.tsx`
- `app/contracts/[id]/workflow/page.tsx`

---

## Feature 7: 계약서 상세 + 검색 패널 (11:30~12:30)

---

### Step 7.1: 계약서 상세 (탭 레이아웃)

**소요**: 30m | **work-plan ID**: 3-10

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/contract-detail.json을 읽고,
계약서 상세 페이지를 구현해줘.

app/contracts/[id]/page.tsx:

레이아웃: 좌측 2/3 (메인) + 우측 1/3 (검색 패널)

1. 메인 영역 (좌측):
   - 상단: 고객사명, 계약유형(Badge), 버전(v3), 상태(StatusChip), 리스크(RiskBadge)
   - 당사자 정보: party_a, party_b 카드
   - 날짜 정보: contract_date, start_date, end_date, renewal_terms
   - 금액 정보: total_amount(원 단위 포맷), payment_terms, penalty_clause
   
   - 탭 네비게이션:
     - "조항 목록" (기본 탭): clauses를 카드 리스트로 표시
     - "리스크 리포트" → /contracts/:id/report로 이동 (또는 탭 내 렌더링)
     - "Diff 뷰" → /contracts/:id/diff
     - "워크플로우" → /contracts/:id/workflow
   
   - 탭은 Link로 실제 페이지 이동 (해커톤이므로 간단하게)

   - 이전 버전 목록: previous_versions를 작은 뱃지로 표시 (v1, v2 클릭 가능)

2. 우측 영역: SearchPanel 자리 (Step 7.2에서 구현, 일단 placeholder)

금액 포맷: 500000000 → "5억 원" 또는 "500,000,000원"
```

---

### Step 7.2: 검색 사이드 패널

**소요**: 30m | **의존성**: Step 7.1 | **work-plan ID**: 3-11

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/search-result.json을 읽고,
검색 사이드 패널을 구현해줘.

1. components/search/SearchPanel.tsx:
   - 우측 패널 (기본 w-1/3)
   - 상단: "계약 히스토리 검색" 타이틀 + 토글 접기/펼치기 버튼 (« »)
   - 검색창: 텍스트 input + 검색 버튼
   - 고객사 필터: 현재 계약서의 customer_name이 기본값
   - 로딩 스피너
   - 결과 영역: SearchResultItem 리스트

   드래그 리사이즈:
   - 좌측 경계에 리사이즈 핸들 (w-1 cursor-col-resize bg-gray-200 hover:bg-blue-400)
   - onMouseDown → document mousemove로 너비 조절
   - 최소 너비 250px, 최대 너비 50%
   
   토글 숨기기:
   - 접힌 상태: 패널 사라지고 우측 가장자리에 "🔍 검색" 세로 버튼만 표시
   - 펼침: 원래 너비로 복원

2. components/search/SearchResultItem.tsx:
   - 각 검색 결과 카드:
     - 계약서 ID + 고객사 + 버전 + 유형
     - clause_content (관련 조항 발췌, 2~3줄 truncate)
     - relevance_score (프로그레스 바 또는 퍼센트)

3. app/contracts/[id]/page.tsx 수정:
   - 좌측(메인) + 우측(SearchPanel) flex 레이아웃
   - 패널 접히면 메인이 전체 너비 차지

4. 검색 실행:
   - useSearchStore.searchContracts(query, customerName) 호출
   - 엔터키 또는 검색 버튼 클릭

상단에 answer 텍스트 (LLM 답변) 표시, 아래에 sources 리스트.
```

#### 예상 결과물

- `components/search/SearchPanel.tsx`, `SearchResultItem.tsx`
- `app/contracts/[id]/page.tsx` 수정

#### 검증

- /contracts/contract_001 → 좌측 상세 + 우측 검색 패널
- 검색 패널 리사이즈 드래그 동작
- 토글 버튼으로 접기/펼치기

---

## Feature 8: 프롬프트 설정 (11:45~12:10)

---

### Step 8.1: 프롬프트 설정 페이지

**소요**: 25m | **work-plan ID**: 3-12

#### AI 프롬프트 (Claude Code에 복붙)

```
frontend/public/mock/prompts-list.json과 prompt-detail.json을 읽고,
프롬프트 설정 페이지를 구현해줘.

1. components/prompts/PromptEditor.tsx:
   - 좌측 패널 (w-1/3): 프롬프트 목록
     - 각 항목: prompt_name + contract_type Badge (NDA, MSA 등)
     - 선택 시 우측에 상세 표시
   
   - 우측 패널 (w-2/3): 프롬프트 편집
     - prompt_name 입력 필드
     - system_prompt textarea (h-96, font-mono, text-sm)
     - 마지막 수정: updated_at + updated_by 표시
     - 저장 버튼 (usePromptsStore.updatePrompt)
     - 저장 성공 시 토스트 메시지 "프롬프트가 저장되었습니다"
   
   - 계약유형별 프리셋 드롭다운:
     - "기본", "NDA 전용", "MSA 전용", "SI 전용" 선택 시 해당 프롬프트 로드

2. app/settings/prompts/page.tsx:
   - usePromptsStore에서 fetchPrompts, fetchPrompt 사용
   - PromptEditor 렌더링

textarea에 구문 하이라이팅은 불필요 (해커톤). 기본 textarea로 충분.
Mock 모드에서 프롬프트 텍스트가 표시되고 수정 가능한지 확인.
```

#### 예상 결과물

- `components/prompts/PromptEditor.tsx`
- `app/settings/prompts/page.tsx`

---

## UI 폴리싱 (12:30~13:30)

---

### Step 9.1: 로딩/에러/빈 상태

**소요**: 20m | **work-plan ID**: 3-13

#### AI 프롬프트 (Claude Code에 복붙)

```
모든 페이지에 로딩, 에러, 빈 상태 처리를 추가해줘.

1. 로딩 상태:
   - 각 페이지에서 store의 loading이 true일 때 Skeleton 컴포넌트 표시
   - 대시보드: 카드 4개 스켈레톤 + 테이블 스켈레톤
   - 리포트: 큰 카드 스켈레톤 + 작은 카드 3개 스켈레톤

2. 에러 상태:
   - store의 error가 있을 때:
     - 빨간 배경 카드 (bg-red-50 border-red-200)
     - 에러 메시지 표시
     - "다시 시도" 버튼

3. 빈 상태:
   - 대시보드: 계약서 없을 때 → "아직 등록된 계약서가 없습니다. 첫 계약서를 업로드해보세요!" + 업로드 버튼
   - 검색 결과 없을 때 → "검색 결과가 없습니다. 다른 키워드로 검색해보세요."
   - Diff 없을 때 → "이전 버전이 없습니다."

각 페이지를 확인하고 누락된 상태 처리를 추가해.
```

---

### Step 9.2: 분석 애니메이션 최적화

**소요**: 15m | **work-plan ID**: 3-15

#### AI 프롬프트 (Claude Code에 복붙)

```
components/analysis/AnalysisStepIndicator.tsx를 개선해줘.

1. 단계 전환 시 부드러운 애니메이션:
   - PENDING → IN_PROGRESS: fadeIn + slideDown
   - IN_PROGRESS → COMPLETED: 체크마크 팝 애니메이션 (scale-0 → scale-100)
   - Tailwind transition 클래스 사용

2. 현재 IN_PROGRESS 단계:
   - 스피너 아이콘 (animate-spin)
   - 텍스트 pulse 효과 (animate-pulse)
   - 배경 약간 하이라이트 (bg-blue-50)

3. 전체 완료 시:
   - "✅ 분석 완료!" 메시지 fade-in
   - confetti 효과는 불필요 — 간단한 초록색 배경 + 체크마크면 충분
   - "리스크 리포트 보기" 버튼 (자동으로 포커스)

데모 시 이 화면이 인상적이어야 함. 단계별로 순차 체크 효과가 시각적으로 만족스러워야.
```

---

### Step 9.3: 전체 UX 점검

**소요**: 20m | **work-plan ID**: 3-14

#### AI 프롬프트 (Claude Code에 복붙)

```
전체 화면 흐름을 점검하고 UX를 개선해줘. Mock 모드로 아래 시나리오를 따라가며 확인:

1. / (대시보드) → "업로드" 클릭
2. /upload → 파일 선택 + 고객사 입력 → 업로드
3. /contracts/:id/analyze → 분석 진행 애니메이션 → 완료
4. /contracts/:id/report → 리스크 리포트 확인
5. /contracts/:id/diff → Diff 뷰 확인
6. /contracts/:id/workflow → 워크플로우 승인
7. /contracts/:id → 상세 + 검색 패널에서 검색
8. /settings/prompts → 프롬프트 수정

점검 항목:
- 페이지 간 이동이 자연스러운지 (뒤로가기 포함)
- 모든 페이지에 "뒤로" 또는 "대시보드로" 돌아가는 링크가 있는지
- 색상이 일관된지 (리스크: red/yellow/green)
- 텍스트 가독성 (한국어 폰트, 줄 간격)
- 반응형은 불필요하지만 1920x1080에서 레이아웃이 깨지지 않는지

발견된 문제가 있으면 수정해.
```

---

### 🔴 인간 체크포인트 (12:30, 13:30)

| 시각 | 작업 | 판단 기준 |
|------|------|-----------|
| 12:30 | 각 화면 UI 리뷰 (Mock 데이터) | 디자인 적합성, 데이터 표시 정확성 |
| 13:30 | FE 전체 흐름 UX 점검 (Mock 기반) | 화면 전환 자연스러움, 누락 기능 없음 |

---

## 완료 체크리스트

- [ ] 공통 레이아웃: 사이드바 + 헤더
- [ ] 공통 컴포넌트: Badge, RiskBadge, StatusChip, Card, Table, Button, Skeleton, Input
- [ ] Zustand 스토어 5개
- [ ] 대시보드 (/) — 요약 카드 + 계약서 테이블 + 상태 필터
- [ ] 업로드 (/upload) — 드래그&드롭 + 폼
- [ ] 분석 진행 (/contracts/:id/analyze) — 4단계 타임라인 + 스피너
- [ ] 리스크 리포트 (/contracts/:id/report) — 리스크 요약 + 조항별 카드
- [ ] Diff 뷰 (/contracts/:id/diff) — 변경사항 색상 구분
- [ ] 워크플로우 (/contracts/:id/workflow) — 타임라인 + 승인/반려
- [ ] 계약서 상세 (/contracts/:id) — 탭 + 검색 패널
- [ ] 검색 패널 — 드래그 리사이즈 + 토글
- [ ] 프롬프트 설정 (/settings/prompts) — 에디터 + 프리셋
- [ ] 로딩/에러/빈 상태 처리
- [ ] Mock 데이터로 전체 흐름 동작 확인

### Plan B/C 절단 지점

| Plan | 삭제 대상 | 영향 |
|------|-----------|------|
| Plan B | Feature 8 (프롬프트 설정 UI) 삭제 + 검색 패널 리사이즈/토글 단순화 | Step 8.1 건너뜀, 검색 패널 고정 1/3 너비 |
| Plan C | Feature 8 + 검색 패널 전체 + Feature 5 (Diff) + 워크플로우 승인 UI 삭제 | 화면 5개만 유지 |

---

## 다음 가이드

→ **Guide 07: BE↔FE 연동** (`guide-07-integration.md`)
