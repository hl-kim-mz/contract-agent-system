# Guide 08: 제출 문서 + 데모 준비

> 담당: 브릿지/공통 (전원 합류) | 예상 소요: 1.5시간 | 의존성: Guide 07 완료 (E2E 통과)
> 대응 Phase: work-plan.md Phase 5~6 (15:00~16:30)
> 실행 시점: **해커톤 당일 15:00~16:30**

---

## 사전 조건

- [ ] Guide 07 완료 — E2E 시나리오 통과 (Plan A: 5개 / B: 4개 / C: 2개)
- [ ] BE+FE 서버 모두 정상 실행 중
- [ ] 전체 시스템 Mock→Real 전환 완료
- [ ] DynamoDB에 테스트 데이터 존재 (분석 완료 계약서 2개+)

---

## Feature 1: 제출 문서 작성 (15:00~15:40)

> 4개 문서를 **병렬**로 작성한다. 팀원 분담 권장:
> - 팀원 A → Step 1.1 (결과 답변서) + Step 1.2 (아키텍처)
> - 팀원 B → Step 1.3 (시연 보조 자료) + Step 1.4 (README)

---

### Step 1.1: 해커톤 결과 답변서

**소요**: 20m | **의존성**: Phase 4 완료 | **work-plan ID**: 5-01

#### 작업 설명

해커톤 심사위원에게 제출하는 핵심 문서. 프로젝트 개요, 문제 정의, 해결 방법, 기술 스택, 팀 구성, 기대 효과를 담는다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/result-report.md 를 작성해줘.

아래 정보를 기반으로 해커톤 결과 답변서를 작성한다.
docs/requirements.md와 docs/api-spec.md를 참고해서 실제 구현된 내용 기준으로 작성할 것.

## 문서 구조

### 1. 프로젝트 개요
- 프로젝트명: Contract Agent System (CAS)
- 한 줄 설명: AI 에이전트가 계약서를 자동 분석하여 리스크를 탐지하고 검토 워크플로우를 자동화하는 시스템
- 팀명: [팀명 입력]
- 팀원: [팀원 입력]

### 2. 문제 정의
- SI/IT 서비스 기업의 계약 검토 프로세스 비효율
- 수백 페이지 계약서를 사람이 수동 검토 → 리스크 누락, 시간 소요
- 이전 버전 대비 변경사항 추적 어려움
- 검토자 배정이 주먹구구식

### 3. 해결 방법
- 3개 AI 에이전트: Parsing Agent, Legal Review Agent, Search Agent
- Rule Engine 기반 자동 워크플로우 라우팅
- RAG 기반 계약 히스토리 검색
- 프롬프트 커스터마이징으로 기업별 맞춤 분석

### 4. 기술 스택
- AI: AWS Bedrock (Claude 3.5 Sonnet v2), Strands Agents SDK
- Backend: Python 3.11, FastAPI, Pydantic v2
- Frontend: Next.js 14, Tailwind CSS, Zustand
- Infra: DynamoDB, S3, Bedrock Knowledge Bases, OpenSearch Serverless
- 특이사항: Strands SDK의 @tool + Agent() + as_tool() 패턴으로 에이전트 합성

### 5. 주요 기능 (실제 구현 기준)
각 기능별 1~2줄 설명 + 스크린샷 참조 표시

### 6. 기대 효과
- 계약 검토 시간 70% 단축 (수시간 → 수분)
- 리스크 조항 탐지율 향상 (사람 검토 누락 방지)
- 이전 버전 대비 변경 추적 자동화
- 기업별 맞춤 프롬프트로 도메인 특화 분석

### 7. 향후 계획
- 다국어 계약서 지원
- 실시간 협업 리뷰 (다중 사용자)
- 계약서 자동 생성 (역방향)

[팀명 입력], [팀원 입력] 부분은 플레이스홀더로 남겨둘 것.
한국어로 작성. 전체 분량은 A4 2~3장 내외.
```

#### 예상 결과물

- `docs/result-report.md` — 해커톤 결과 답변서

#### 검증

```bash
# 파일 존재 + 내용 확인
cat docs/result-report.md | head -30
# 7개 섹션 제목이 모두 존재하는지 확인
grep -c "^###" docs/result-report.md
# 7 이상이면 OK
```

---

### Step 1.2: 아키텍처 설계서 최종 업데이트

**소요**: 15m | **의존성**: Phase 4 완료 | **work-plan ID**: 5-02

#### 작업 설명

Guide 02에서 사전 작성한 `docs/architecture.md`를 실제 구현 결과에 맞게 보정한다. 사전 설계와 달라진 부분 (폴더 구조, 클래스명, 엔드포인트 등)을 업데이트.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/architecture.md를 실제 구현 코드 기준으로 업데이트해줘.

1. 아래 파일/폴더를 확인해서 실제 구조와 설계서가 일치하는지 검증:
   - backend/ 폴더 구조 (ls -la backend/app/)
   - frontend/ 폴더 구조 (ls -la frontend/src/)
   - 실제 API 엔드포인트 (backend/app/main.py 또는 routers/)
   - 실제 Agent 목록 (backend/app/agents/)
   - 실제 Tool 목록 (backend/app/tools/)

2. 불일치하는 부분을 수정:
   - 폴더/파일 경로 업데이트
   - 클래스명/함수명 업데이트
   - 다이어그램(텍스트 기반) 업데이트
   - 제거된 기능은 문서에서도 제거 (Plan B/C 적용 시)

3. 추가할 섹션 (없으면 추가):
   - "실제 구현 범위" — Plan A/B/C 중 어디까지 구현했는지 명시
   - 데이터 흐름도 — 업로드→파싱→분석→리포트→워크플로우 전체 흐름

기존 문서 내용을 최대한 유지하면서 실제와 다른 부분만 수정.
```

#### 예상 결과물

- `docs/architecture.md` — 실제 구현 기준으로 업데이트된 아키텍처 문서

#### 검증

```bash
# 업데이트 확인
grep -c "실제 구현 범위" docs/architecture.md
# 1 이상이면 해당 섹션 추가됨
```

---

### Step 1.3: 시연 보조 자료 (데모 스크립트)

**소요**: 15m | **의존성**: Phase 4 완료 | **work-plan ID**: 5-03

#### 작업 설명

17:30 심사 시 화면을 보며 읽을 데모 스크립트. 각 단계별 클릭 위치, 설명 멘트, 예상 소요를 포함한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/demo-guide.md를 작성해줘.

17:30 라이브 데모용 시연 스크립트.
docs/work-plan.md의 "데모 시나리오" 섹션을 기반으로 하되,
실제 구현된 기능 기준으로 작성한다.

## 문서 구조

### 데모 개요
- 총 소요: 5분 이내
- 시연자: [이름]
- 시작점: 브라우저에서 http://localhost:3000 (대시보드)

### 시나리오별 스크립트

각 시나리오마다:

#### 시나리오 N: [제목] (소요: Xs)

**화면**: [URL 또는 화면명]
**클릭 순서**:
1. [어디를] 클릭
2. [무엇을] 입력
3. [어디를] 클릭

**설명 멘트** (시연자가 말할 내용):
> "지금 보시는 것은 ~입니다. ~를 통해 ~합니다."

**포인트** (심사위원에게 어필할 점):
- [기술적 차별점]

**예상 화면**: [어떤 결과가 보여야 하는지]

---

시나리오 목록 (Plan A 기준, 실제 구현 범위에 맞게 조정):

1. 대시보드에서 계약서 현황 확인 (30s)
   - 포인트: 한눈에 보이는 계약 현황
2. 신규 계약서 DOCX 업로드 (30s)
   - 포인트: 드래그&드롭, 자동 버전 채번
3. AI 분석 진행 과정 실시간 확인 (30s)
   - 포인트: 5단계 파이프라인, 단계별 진행 표시
4. 리스크 리포트 — HIGH 리스크 조항 확인 (1m)
   - 포인트: 조항별 리스크 수준 + 수정 제안
5. 이전 버전 대비 Diff 뷰 (30s)
   - 포인트: 자동 변경 추적, 리스크 영향 표시
6. 워크플로우 승인 (30s)
   - 포인트: 리스크 기반 자동 라우팅
7. RAG 히스토리 검색 (1m)
   - 포인트: 자연어 질의, 출처 포함 답변
8. 프롬프트 수정 → 재분석 (30s) — Plan B에서는 생략
   - 포인트: 커스터마이징 가능한 AI

### 비상 대응
- 특정 시나리오 실패 시 → 스킵하고 다음으로 ("이 부분은 시간 관계상 넘어가겠습니다")
- 전체 서버 다운 시 → 스크린샷/녹화 영상으로 대체
- Bedrock 응답 지연 시 → "실시간 분석이 진행 중입니다" 말하며 대기

Plan B/C 적용 시 해당 시나리오를 [Plan B: 생략] 으로 표시해줘.
한국어로 작성.
```

#### 예상 결과물

- `docs/demo-guide.md` — 데모 시연 스크립트

#### 검증

```bash
# 시나리오 개수 확인
grep -c "^#### 시나리오" docs/demo-guide.md
# Plan A: 8개, Plan B: 6개, Plan C: 4개
```

---

### Step 1.4: README.md 작성

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 5-04

#### 작업 설명

프로젝트 루트의 README.md. 심사위원이 소스코드를 볼 때 가장 먼저 보는 파일.

#### AI 프롬프트 (Claude Code에 복붙)

```
프로젝트 루트에 README.md를 작성해줘.
(이미 존재하면 업데이트)

docs/requirements.md와 실제 프로젝트 구조를 참고해서 작성.

## 문서 구조

# Contract Agent System (CAS)

> AI 에이전트 기반 계약서 자동 분석 + 리스크 탐지 + 워크플로우 자동화

## 🎯 프로젝트 소개
1~2문장

## 🏗️ 아키텍처
텍스트 다이어그램:
```
DOCX → Parsing Agent → Legal Review Agent → Rule Engine → Workflow
                              ↕
                    Bedrock Knowledge Base
                      (Search Agent/RAG)
```

## 🛠️ 기술 스택
| 영역 | 기술 |
표 형식

## 📁 프로젝트 구조
실제 폴더 구조 트리 (backend/, frontend/, docs/)

## 🚀 실행 방법

### 사전 요구사항
- Python 3.11+
- Node.js 18+
- AWS CLI configured
- AWS Bedrock access (Claude 3.5 Sonnet v2)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # AWS credentials 설정
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 환경변수 설명
주요 환경변수 표

## 📊 주요 기능
기능별 한 줄 설명 리스트

## 👥 팀
[팀명] — [팀원]

## 📄 문서
| 문서 | 설명 |
docs/ 내 주요 문서 링크

한국어로 작성. 이모지 사용 OK (README는 관례적으로 허용).
```

#### 예상 결과물

- `README.md` — 프로젝트 루트 README

#### 검증

```bash
# 파일 존재 + 주요 섹션 확인
grep -c "^##" README.md
# 7개 이상이면 OK
```

---

## Feature 2: 데모 데이터 세팅 (15:40~16:00)

> 테스트 데이터를 정리하고 데모용 깨끗한 초기 상태를 만든다.

---

### Step 2.1: DB/S3 초기화

**소요**: 5m | **의존성**: Feature 1 완료 | **work-plan ID**: 5-05

#### 작업 설명

테스트 중 쌓인 데이터를 삭제하고 깨끗한 상태로 만든다. 데모 시작 시 대시보드에 "준비된 데이터"만 보여야 한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
데모를 위해 DB와 S3를 초기화하는 스크립트를 작성하고 실행해줘.

파일: backend/scripts/reset_demo.py

기능:
1. DynamoDB cas-contracts 테이블: 전체 scan → batch delete
2. DynamoDB cas-risk-reports 테이블: 전체 scan → batch delete
3. DynamoDB cas-workflow 테이블: 전체 scan → batch delete
4. DynamoDB cas-prompts 테이블: 삭제하지 않음 (시드 유지!)
5. S3 cas-documents-{suffix} 버킷: 전체 object 삭제

실행:
cd backend && python scripts/reset_demo.py

안전장치:
- 실행 전 "정말 초기화하시겠습니까? (y/N)" 프롬프트 표시
- 프롬프트 테이블은 절대 삭제 안 함
- 삭제된 항목 수 출력

boto3 import, .env의 AWS 설정 사용.
```

#### 예상 결과물

- `backend/scripts/reset_demo.py` — DB/S3 초기화 스크립트
- 실행 후: 빈 상태 (프롬프트 제외)

#### 검증

```bash
# 초기화 후 확인
cd backend && python -c "
import boto3
ddb = boto3.resource('dynamodb')
print('contracts:', ddb.Table('cas-contracts').scan()['Count'])
print('prompts:', ddb.Table('cas-prompts').scan()['Count'])
"
# contracts: 0, prompts: 3 (시드 유지)
```

---

### Step 2.2: 데모용 초기 데이터 투입

**소요**: 10m | **의존성**: Step 2.1 | **work-plan ID**: 5-06

#### 작업 설명

Diff와 RAG 검색 데모를 위해 "A사 v1 계약서"를 사전에 업로드+분석 완료 상태로 만든다. 데모 시에는 v2를 업로드하여 Diff를 보여주는 시나리오.

#### AI 프롬프트 (Claude Code에 복붙)

```
데모용 초기 데이터를 세팅하는 스크립트를 작성하고 실행해줘.

파일: backend/scripts/seed_demo.py

시나리오 설정:
- "A사"의 MSA 계약서 v1이 이미 업로드+분석 완료된 상태
- 대시보드에 접속하면 A사 v1 계약서가 "ANALYZED" 상태로 보임
- 데모 시연 시 v2를 업로드하면 Diff가 나타남

구현:
1. 테스트 DOCX 파일 확인 (없으면 docs/samples/ 에서 복사하거나 간단한 텍스트 DOCX 생성)
2. POST /contracts/upload 호출 (httpx 사용):
   - customer_name: "A사"
   - contract_type: "MSA"
   - file: 테스트 DOCX
3. POST /contracts/:id/analyze 호출
4. 분석 완료 대기 (polling: GET /contracts/:id → status == "ANALYZED")
5. 완료 확인 로그 출력

BE 서버가 실행 중이어야 한다 (http://localhost:8000).
httpx 또는 requests 사용.

데모용 DOCX가 없으면 python-docx로 간단한 계약서 DOCX를 자동 생성:
- 제목: "A사 클라우드 마이그레이션 MSA 계약서"
- 5개 조항: 계약 범위, 계약 기간, 대금 지급, 손해배상, 지식재산권
- 각 조항 2~3문장
```

#### 예상 결과물

- `backend/scripts/seed_demo.py` — 데모 데이터 투입 스크립트
- `docs/samples/sample_contract_v1.docx` — 테스트 DOCX (없을 경우 자동 생성)
- `docs/samples/sample_contract_v2.docx` — 데모 시 업로드할 v2 DOCX
- DynamoDB에 A사 v1 계약서 + 분석 결과 존재

#### 검증

```bash
# 데모 데이터 확인
curl http://localhost:8000/api/v1/contracts | python -m json.tool
# A사 v1 계약서가 "ANALYZED" 상태로 존재

curl http://localhost:8000/api/v1/contracts/{ID}/risk-report | python -m json.tool
# risk_items 존재 확인
```

---

### Step 2.3: KB 동기화 확인

**소요**: 5m | **의존성**: Step 2.2 | **work-plan ID**: 5-07

#### 작업 설명

v1 계약서 데이터가 Bedrock Knowledge Base에 인덱싱되어 RAG 검색이 가능한지 확인한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
Bedrock Knowledge Base 동기화 상태를 확인해줘.

1. KB 데이터 소스 동기화 트리거 (이미 자동이면 확인만):
   aws bedrock-agent start-ingestion-job \
     --knowledge-base-id {KB_ID} \
     --data-source-id {DS_ID}

2. 동기화 완료 대기:
   aws bedrock-agent get-ingestion-job \
     --knowledge-base-id {KB_ID} \
     --data-source-id {DS_ID} \
     --ingestion-job-id {JOB_ID}
   status가 "COMPLETE"일 때까지 30초 간격 확인 (최대 5분)

3. 검색 테스트:
   curl -X POST http://localhost:8000/api/v1/search \
     -H "Content-Type: application/json" \
     -d '{"query": "A사 손해배상 조항", "max_results": 3}'
   → sources에 v1 계약서가 포함되는지 확인

KB_ID와 DS_ID는 .env 파일에서 확인.
동기화에 시간이 걸리면 다음 단계 먼저 진행하고 나중에 재확인.
```

#### 예상 결과물

- KB 동기화 완료 상태
- 검색 테스트 통과

#### 검증

```bash
curl -X POST http://localhost:8000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "A사 손해배상", "max_results": 3}'
# data.sources에 1개 이상 결과
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 동기화 5분 이상 소요 | OpenSearch 인덱싱 느림 | 데모에서 검색은 "사전 인덱싱된 데이터" 기반으로 시연, 실시간 인덱싱은 말로 설명 |
| 검색 결과 0건 | S3→KB 경로 불일치 | KB 데이터 소스의 S3 URI와 실제 업로드 경로 비교 |

---

## Feature 3: 최종 리허설 (16:00~16:30)

---

### Step 3.1: 데모 리허설 1회차

**소요**: 15m | **의존성**: Feature 2 완료 | **work-plan ID**: 6-01

#### 작업 설명

`docs/demo-guide.md`를 보면서 전체 데모 시나리오를 실제로 한 번 실행한다. 타이머를 켜고 5분 이내에 완료되는지 확인.

#### 실행 순서 (사람이 직접)

1. 타이머 시작
2. `docs/demo-guide.md` 열기
3. 시나리오 1부터 순서대로 실행:
   - 브라우저에서 각 화면 이동
   - 클릭, 입력, 결과 확인
   - 설명 멘트 연습
4. 타이머 종료 — 5분 이내인지 확인

#### 체크리스트

| 시나리오 | 통과 | 소요 | 비고 |
|----------|------|------|------|
| 1. 대시보드 | ☐ | s | |
| 2. 업로드 | ☐ | s | |
| 3. 분석 진행 | ☐ | s | |
| 4. 리스크 리포트 | ☐ | s | |
| 5. Diff 뷰 | ☐ | s | |
| 6. 워크플로우 | ☐ | s | |
| 7. RAG 검색 | ☐ | s | |
| 8. 프롬프트 수정 | ☐ | s | |
| **합계** | /8 | m s | 목표: 5분 이내 |

---

### Step 3.2: 최종 핫픽스

**소요**: 10m | **의존성**: Step 3.1 | **work-plan ID**: 6-02

#### 작업 설명

리허설 중 발견된 이슈를 최종 수정한다. 이 시점에서는 데모 흐름을 깨는 치명적 이슈만 수정.

#### AI 프롬프트 (Claude Code에 복붙)

```
리허설에서 발견된 이슈를 수정해줘.

[여기에 리허설 중 발견된 이슈를 붙여넣기]

수정 원칙:
1. 데모 중단 이슈만 수정 (UI 미관은 이 시점에서 무시)
2. 최소 변경 (1~2줄 수정으로 해결 가능한 것만)
3. 수정 후 해당 시나리오만 빠르게 재확인
4. 10분 안에 끝나지 않으면 → 해당 시나리오를 데모에서 스킵하기로 결정

16:30 마감이 절대적이다. 완벽보다 "돌아가는 데모"가 우선.
```

#### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 수정해도 안 고쳐짐 | 근본 원인이 깊음 | 해당 시나리오 데모에서 스킵. demo-guide.md에 "[스킵]" 표시 |
| 수정하면 다른 데 영향 | 사이드이펙트 | git stash로 롤백. 해당 시나리오 스킵 |

---

### Step 3.3: 브라우저 + 환경 세팅

**소요**: 5m | **의존성**: Step 3.2 | **work-plan ID**: 6-03

#### 작업 설명

데모 시작 직전 환경을 준비한다.

#### 실행 순서 (사람이 직접)

1. **브라우저 탭 준비**
   - 탭 1: `http://localhost:3000` (대시보드 — 데모 시작점)
   - 탭 2: 빈 탭 (업로드 시 사용)
   - 불필요한 탭 모두 닫기

2. **업로드 파일 준비**
   - `docs/samples/sample_contract_v2.docx`를 바탕화면에 복사
   - 파일명: `A사_MSA_v2.docx` 등 데모에서 보기 좋은 이름

3. **터미널 확인**
   - BE 서버 실행 중 (에러 로그 없음)
   - FE 서버 실행 중 (컴파일 에러 없음)
   - 불필요한 터미널 출력 정리

4. **네트워크 확인**
   - `curl http://localhost:8000/api/v1/contracts` → 200 OK
   - 브라우저에서 대시보드 로딩 확인

5. **화면 정리**
   - 알림 끄기 (방해 금지 모드)
   - 해상도 확인 (프로젝터 연결 시)

---

## 인간 체크포인트 (16:00~16:30)

> **work-plan ID: H-16, H-17**

| ID | 시각 | 작업 |
|----|------|------|
| H-16 | 16:00 | 데모 리허설 — demo-guide.md 보며 전체 흐름 확인 |
| H-17 | 16:25 | 제출물 최종 확인 (아래 체크리스트) |

### 제출물 최종 체크리스트

| # | 제출물 | 파일 | 상태 |
|---|--------|------|------|
| 1 | 결과 답변서 | `docs/result-report.md` | ☐ |
| 2 | 아키텍처 설계서 | `docs/architecture.md` | ☐ |
| 3 | 시연 보조 자료 | `docs/demo-guide.md` | ☐ |
| 4 | 소스코드 + README | `README.md` | ☐ |
| 5 | 서비스 기획안 | `docs/service-plan.md` (Guide 02에서 작성) | ☐ |

### 시스템 상태 체크리스트

| # | 항목 | 상태 |
|---|------|------|
| 1 | BE 서버 실행 중 (포트 8000) | ☐ |
| 2 | FE 서버 실행 중 (포트 3000) | ☐ |
| 3 | 대시보드에 A사 v1 계약서 표시 | ☐ |
| 4 | v2 DOCX 파일 바탕화면에 준비 | ☐ |
| 5 | 브라우저 탭 세팅 완료 | ☐ |

---

## 타임라인 요약

```
15:00 ─── Feature 1: 제출 문서 (4개 병렬) ───
         팀원 A: 결과 답변서 + 아키텍처 → 15:35
         팀원 B: 데모 스크립트 + README → 15:25
15:40 ─── Feature 2: 데모 데이터 세팅 ───────
         DB 초기화 → 시드 투입 → KB 확인
16:00 ─── Feature 3: 최종 리허설 ────────────
         리허설 1회차 → 핫픽스 → 환경 세팅
16:30 ━━━ 마감 ━━━━━━━━━━━━━━━━━━━━━━━━━━━
         제출물 제출 완료. 데모 준비 완료.
17:30 ─── 1차 심사: 라이브 데모 시연 ─────────
```

> **16:30 마감 시점**: 모든 제출물 완성, 데모 환경 준비 완료, 브라우저 대기 상태.
