# CAS API 연동 가이드

> 프론트엔드 ↔ 백엔드 연동 방법 및 feature별 API 매핑
> **Mock → Real 전환**: `.env.local`의 `NEXT_PUBLIC_USE_MOCK=false`로 변경

### 프로덕션 데모 (Vercel)

| 항목 | URL |
|------|-----|
| 프론트엔드 | https://contract-agent-system.vercel.app/ |

심사·데모 시 위 URL로 접속하면 됩니다. (기본값은 Mock 데이터; 백엔드를 붙일 경우 Vercel 프로젝트 환경 변수에 `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCK` 설정)

---

## 1. 환경 설정

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000   # 백엔드 주소
NEXT_PUBLIC_USE_MOCK=true                   # true: Mock / false: 실제 API
```

백엔드 실행:
```bash
cd contract-agent-system
uvicorn api.app:app --reload --port 8000
```

프론트엔드 실행:
```bash
cd frontend
npm run dev   # http://localhost:3000
```

---

## 2. Feature별 API 연동 현황

| Feature | 프론트 파일 | 백엔드 엔드포인트 | Mock | Real |
|---------|-----------|----------------|------|------|
| 계약서 목록 | `lib/api/contracts.ts` | `GET /contracts` | ✅ | ✅ |
| 계약서 업로드 | `lib/api/contracts.ts` | `POST /contracts/analyze` | ✅ | ✅ |
| 계약서 상세 | `lib/api/risk-reports.ts` | `GET /contracts/:id` | ✅ | ✅ |
| 리스크 리포트 | `lib/api/risk-reports.ts` | `GET /contracts/:id/report` | ✅ | ✅ |
| 버전 Diff | `lib/api/risk-reports.ts` | `GET /contracts/:id/diff` | ✅ | 🔧 TODO |
| 워크플로우 조회 | `lib/api/risk-reports.ts` | `GET /contracts/:id/workflow` | ✅ | ✅ |
| 워크플로우 승인 | `lib/api/risk-reports.ts` | `POST /workflow/:stepId/approve` | ✅ | ✅ |
| 댓글 조회 | `lib/api/comments.ts` | `GET /contracts/:id/comments` | ✅ | ✅ |
| 댓글 작성 | `lib/api/comments.ts` | `POST /contracts/:id/comments` | ✅ | ✅ |
| 댓글 삭제 | `lib/api/comments.ts` | `DELETE /contracts/:id/comments/:id` | ✅ | ✅ |
| 프롬프트 목록 | `lib/api/prompts.ts` | `GET /prompts` | ✅ | ✅ |
| 프롬프트 저장 | `lib/api/prompts.ts` | `PUT /prompts/:id` | ✅ | ✅ |
| 프롬프트 생성 | `lib/api/prompts.ts` | `POST /prompts` | ✅ | ✅ |
| 히스토리 검색 | `lib/api/risk-reports.ts` | `GET /search?query=` | ✅ | 🔧 TODO (Bedrock KB) |

---

## 3. Feature별 연동 방법

### 3-1. 계약서 목록 / 업로드

```typescript
// frontend/lib/api/contracts.ts
import { getContracts, uploadContract } from '@/lib/api/contracts';

// 목록 조회
const contracts = await getContracts();

// 업로드 (DOCX/PDF)
const newContract = await uploadContract(file, '주식회사 A사', 'SI');
```

백엔드 전환 시: `NEXT_PUBLIC_USE_MOCK=false` → 자동으로 `POST /contracts/analyze` 호출

---

### 3-2. 리스크 리포트

```typescript
// frontend/lib/api/risk-reports.ts
import { getContractDetail, getRiskReport } from '@/lib/api/risk-reports';

const contract = await getContractDetail(contractId);
const report   = await getRiskReport(contractId);
```

---

### 3-3. 버전 Diff

```typescript
import { getDiffReport } from '@/lib/api/risk-reports';
const diff = await getDiffReport(contractId); // null이면 이전 버전 없음
```

> **TODO**: 백엔드 `GET /contracts/:id/diff` 구현 필요
> 현재는 DynamoDB에서 이전 버전 조회 + deepdiff 비교 로직 추가 필요

---

### 3-4. 워크플로우

```typescript
import { getWorkflowSteps, approveStep } from '@/lib/api/risk-reports';

const steps = await getWorkflowSteps(contractId);
const updated = await approveStep(stepId, '검토 완료. 승인합니다.');
```

---

### 3-5. 댓글 (@멘션)

```typescript
import { getComments, createComment, deleteComment, TEAM_MEMBERS } from '@/lib/api/comments';

// 댓글 목록
const comments = await getComments(contractId);

// 댓글 작성 (@멘션 포함)
const newComment = await createComment(contractId, {
  content: '@박계약 제3조 검토 부탁드립니다.',
  mentions: ['usr_002'],
  author_id: 'usr_001',
  clause_ref: 'clause_003',  // 특정 조항 연결 (선택)
});

// 댓글 삭제
await deleteComment(contractId, commentId);
```

**DynamoDB 테이블 추가 필요**: `cas-comments`

```bash
# 테이블 생성 (AWS CLI)
aws dynamodb create-table \
  --table-name cas-comments \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=contract_id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"contract_id-index","KeySchema":[{"AttributeName":"contract_id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"BillingMode":"PAY_PER_REQUEST"}]' \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2
```

---

### 3-6. 프롬프트 설정

```typescript
import { getPrompts, updatePrompt, createPrompt } from '@/lib/api/prompts';

const prompts = await getPrompts();
const updated = await updatePrompt(promptId, {
  prompt_name: 'SI 도급 전용',
  contract_type: 'SI',
  system_prompt: '당신은 MZC 계약 분석 AI...',
});
```

---

### 3-7. 히스토리 검색 (RAG)

```typescript
import { searchHistory } from '@/lib/api/risk-reports';

const result = await searchHistory('CR 조항 과거 처리 방식', 'A사');
// result.answer: AI 답변
// result.sources: 참조 계약서 목록
```

> **TODO**: Bedrock Knowledge Bases `retrieve_and_generate` 연동 필요
> 현재 `GET /search` Mock 응답 반환 중

---

## 4. 공통 응답 형식

```typescript
// 성공
{ "success": true, "data": { ... } }

// 에러
{ "success": false, "error": "메시지", "detail": "상세" }
```

프론트엔드 API 함수는 모두 `data` 필드를 직접 반환하도록 래핑되어 있음.

---

## 5. DynamoDB 테이블 목록

| 테이블명 | 환경변수 | 용도 |
|---------|---------|------|
| `cas-contracts` | `DYNAMODB_CONTRACTS_TABLE` | 계약서 메타데이터 |
| `cas-risk-reports` | `DYNAMODB_RISK_REPORTS_TABLE` | 리스크 분석 결과 |
| `cas-workflow-steps` | `DYNAMODB_WORKFLOW_TABLE` | 검토 워크플로우 단계 |
| `cas-comments` | `DYNAMODB_COMMENTS_TABLE` | 계약서별 댓글 |
| `cas-prompt-templates` | `DYNAMODB_PROMPTS_TABLE` | AI 프롬프트 템플릿 |

인프라 셋업: `docs/guides/04.dynamodb.md` 참조

---

## 6. 미구현 (TODO)

| 기능 | 우선순위 | 설명 |
|------|---------|------|
| Diff API | 🔴 High | `GET /contracts/:id/diff` — DynamoDB 이전 버전 조회 + deepdiff |
| Bedrock KB 검색 | 🟡 Medium | `GET /search` — retrieve_and_generate 연동 |
| 실시간 댓글 | 🟢 Low | WebSocket 또는 SSE (현재 폴링 방식) |
| 파일 다운로드 | 🟢 Low | `GET /contracts/:id/download` — S3 presigned URL |
