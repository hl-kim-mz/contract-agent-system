# Team R&R — Contract Agent System

> MEGATHON 2026 | 팀 구성: 기획자 2명 + FE 1명 | AWS 당일 계정 발급

---

## 팀 제약사항 및 리스크

| 리스크 | 내용 | 대응 |
|--------|------|------|
| AWS 당일 계정 발급 | 세팅에 30~60분 소요 예상 | 세팅 체크리스트 사전 준비 |
| AWS 경험 없음 | S3/DynamoDB 설정 중 막힐 가능성 | boto3 연동 코드 사전 완성 + 리소스 생성 가이드 준비 |
| 백엔드 개발자 없음 | Python/FastAPI + Strands SDK를 기획자가 담당 | **Claude Code + Bedrock 백엔드**로 코드 생성, 사전 완성 |

---

## 아키텍처 재조정 (AWS 서비스 최대 활용 기준)

> **전략**: 데모 완성도와 AWS 활용도를 모두 확보. Lambda 배포는 복잡도 대비 리스크가 크므로
> FastAPI 로컬 실행 유지. 나머지 스토리지·DB·AI는 모두 AWS 관리형 서비스로 구성.

| 영역 | 채택 서비스 | 이유 | 난이도 |
|------|------------|------|--------|
| AI 추론 | **AWS Bedrock** (Claude 3.5 Sonnet v1) | 핵심 차별점 | ★★☆ |
| Agent 오케스트레이션 | **AWS Strands SDK** | Bedrock 네이티브 연동 | ★★☆ |
| 파일 저장 | **Amazon S3** | boto3 `put_object` 2~3줄, 무료 수준 | ★☆☆ |
| 데이터 저장 | **Amazon DynamoDB** | NoSQL, 스키마 없이 즉시 사용 | ★★☆ |
| 백엔드 API | **FastAPI 로컬 실행** | Lambda 배포는 당일 리스크, 로컬 데모로 충분 | ★☆☆ |
| 프론트엔드 | **Next.js 로컬 실행** | 배포 불필요, 데모용 | ★☆☆ |

### S3 연동 (난이도 낮음 — boto3 3줄)
```python
import boto3
s3 = boto3.client("s3", region_name="ap-northeast-2")
s3.put_object(Bucket="cas-contracts", Key=f"{contract_id}.docx", Body=file_bytes)
```

### DynamoDB 연동 (난이도 낮음 — 스키마 없이 dict 저장)
```python
import boto3
dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-2")
table = dynamodb.Table("cas-contracts")
table.put_item(Item={"id": contract_id, "status": "DRAFT", ...})
```

### 당일 AWS 리소스 사전 생성 체크
```
□ S3 버킷 생성: cas-contracts (리전: ap-northeast-2, 퍼블릭 차단)
□ DynamoDB 테이블 생성:
     - cas-contracts      (PK: id, 타입: String)
     - cas-risk-reports   (PK: id, 타입: String)
     - cas-workflow-steps (PK: id, 타입: String)
□ 테이블 생성 후 boto3로 연결 확인
```

---

## 비용 예상 (250K KRW 기준)

| 항목 | 예상 비용 | 비고 |
|------|-----------|------|
| Bedrock Claude 3.5 Sonnet v1 | ~$1~3 (약 1.5K~4K원) | 데모 30회 기준 |
| Amazon S3 | ~$0 | 무료 티어 (5GB) |
| Amazon DynamoDB | ~$0 | 무료 티어 (25GB, 25 RCU/WCU) |
| **합계** | **~2K~5K원** | 250K 중 2% 이내 |

→ 비용 여유 충분. 3개 AWS 서비스 활용으로 심사 어필 가능.

---

## R&R

### 기획자 A — Agent 엔지니어

> Python + Strands SDK 담당. Claude Code로 코드 생성 지원 활용.

**해커톤 전 (사전 준비)**
- [ ] Python 환경 세팅 (`pip install -r dependencies.txt`)
- [ ] [Groq API Key 발급](https://console.groq.com) → `.env`에 `GROQ_API_KEY=` 입력
- [ ] `.env`에 `MODEL_PROVIDER=groq` 설정 후 로컬 Agent 동작 검증
- [ ] Parsing Agent + Risk Agent 구현 완료
- [ ] FastAPI 기본 엔드포인트 완성

**해커톤 당일**

| 시간 | 업무 |
|------|------|
| 09:00~10:00 | AWS 계정 발급 → IAM → Bedrock 모델 활성화 → boto3 연결 확인 |
| 10:00~12:00 | Bedrock 연동으로 Agent 전환 + 동작 확인 |
| 14:00~16:00 | Diff Agent + Workflow Agent 구현 |
| 16:00~ | 통합 테스트 지원 |

---

### 기획자 B — 콘텐츠 & QA

> 프롬프트 설계, 테스트 데이터, 발표 담당. 개발 의존도 낮음.

**해커톤 전 (사전 준비)**
- [ ] 샘플 계약서 DOCX 2종 준비 (버전 1 + 버전 2, Diff 시연용)
- [ ] Risk Agent 프롬프트 설계 (리스크 탐지 기준 문서화)
- [ ] 발표 자료 초안 + 데모 시나리오 스크립트 작성

**해커톤 당일**

| 시간 | 업무 |
|------|------|
| 09:00~10:00 | AWS 계정 세팅 보조 (가이드 문서 준비) |
| 10:00~13:00 | Agent 프롬프트 튜닝 (출력 품질 개선 반복) |
| 14:00~16:00 | QA 테스트 (샘플 계약서 업로드 → 결과 검증) |
| 16:00~ | 데모 리허설 + 발표 자료 최종화 |

---

### FE 개발자 — 프론트엔드 전담

> Next.js UI + FastAPI 연동. AWS 설정 불관여.

**해커톤 전 (사전 준비)**
- [ ] Next.js 프로젝트 세팅 + 7개 화면 기본 레이아웃 완성
- [ ] FastAPI Mock 응답으로 UI 선행 개발
- [ ] 대시보드 + 리스크 리포트 화면 완성

**해커톤 당일**

| 시간 | 업무 |
|------|------|
| 09:00~11:00 | 기획자 A 완성 API와 연동 (Upload → Analyze 흐름) |
| 11:00~14:00 | 리스크 리포트 + Diff 뷰 화면 완성 |
| 14:00~16:00 | 워크플로우 Mock UI + 전체 흐름 연결 |
| 16:00~ | 데모 환경 최종 점검 |

---

## 당일 AWS 세팅 체크리스트 (기획자 A 담당)

> ⚠️ **[필수 — 절대 누락 금지]** 아래 체크리스트를 순서대로 완료한 뒤 모델 전환할 것.
> 특히 **Bedrock 모델 활성화 신청을 가장 먼저** — 수 분 대기 필요.

```
□ AWS 콘솔 로그인

── [STEP 1] Bedrock 모델 활성화 (가장 먼저 — 대기 시간 있음) ──────────
□ 우측 상단 리전 드롭다운 → 아시아 태평양(서울) ap-northeast-2 선택
□ 검색창 → "Bedrock" 입력 → Amazon Bedrock 클릭
□ 좌측 사이드바 → Model access 클릭
□ "Manage model access" 버튼 클릭
□ Anthropic 섹션 → Claude 3.5 Sonnet (20240620) 체크박스 선택
□ "Save changes" 클릭
□ Access status: In Progress 확인 → 아래 STEP 2~3 진행하는 동안 대기
   (보통 1~5분, Access granted 상태 되면 사용 가능)

── [STEP 2] IAM 설정 ───────────────────────────────────────────────────
□ IAM → 사용자 생성 → AdministratorAccess 정책 부여
□ Access Key / Secret Key 발급

── [STEP 2-1] AWS 리소스 생성 ─────────────────────────────────────────
□ S3 → 버킷 생성: cas-contracts (리전: ap-northeast-2, 퍼블릭 차단 유지)
□ DynamoDB → 테이블 3개 생성 (리전: ap-northeast-2, 기본 설정):
     - cas-contracts      (파티션 키: id, String)
     - cas-risk-reports   (파티션 키: id, String)
     - cas-workflow-steps (파티션 키: id, String)

── [STEP 3] 로컬 환경 전환 ─────────────────────────────────────────────
□ .env 수정:
     AWS_ACCESS_KEY_ID=...
     AWS_SECRET_ACCESS_KEY=...
     AWS_REGION=ap-northeast-2
     MODEL_PROVIDER=bedrock     ← groq → bedrock 으로 변경
□ Claude Code Bedrock 백엔드 연결 (환경변수 설정):
     CLAUDE_CODE_USE_BEDROCK=1
     AWS_REGION=ap-northeast-2
     (이후 claude 실행 시 Bedrock Claude 호출 — Anthropic API 크레딧 불필요)
□ boto3 연결 테스트: python -c "import boto3; print('OK')"

── [STEP 4] 최종 확인 ──────────────────────────────────────────────────
□ Bedrock Model access → Claude 3.5 Sonnet Access granted 상태 확인
□ Agent 동작 테스트 실행
```

> ⚠️ **[리마인더]** `MODEL_PROVIDER=bedrock` 변경을 빠뜨리면 당일에도 Groq로 실행됩니다.
> AWS 연결 후 반드시 `.env` 확인.

---

## 기능 우선순위 컷라인

개발 시간이 부족할 경우 아래 순서로 기능 축소:

| 우선순위 | 기능 | 이유 |
|---------|------|------|
| **P0 필수** | Parsing + Risk Agent + 리스크 리포트 UI | 핵심 가치 증명 |
| **P1 권장** | Workflow Agent + 승인 Mock UI | 완결성 |
| **P2 선택** | Diff Agent | 시간 여유 시 구현 |
