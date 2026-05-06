# Guide 01: AWS 인프라 프로비저닝

> 담당: 브릿지/공통 | 예상 소요: 1시간 | 의존성: AWS 계정 접근 권한
> 대응 Phase: work-plan.md Phase 0-B (P-01 ~ P-05)
> 실행 시점: **해커톤 D-1** (사전 준비)

---

## 사전 조건

- [ ] AWS 계정 로그인 가능 (IAM 사용자 또는 SSO)
- [ ] IAM 권한: S3, DynamoDB, Bedrock, OpenSearch, IAM (KB 서비스 역할 생성용)
- [ ] AWS CLI v2 설치됨 (`aws --version` → 2.x.x)
- [ ] `aws configure` 완료 (ap-northeast-2, Access Key 설정)
- [ ] Python 3.11+ 설치됨 (시드 데이터 투입용)

---

## Step 1: S3 버킷 생성 + CORS 설정

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: P-01

### 작업 설명

계약서 DOCX 원본과 파싱 JSON을 저장할 S3 버킷을 생성한다. 프론트엔드(localhost:3000)에서 직접 접근할 일은 없지만, 개발 편의를 위해 CORS를 열어둔다.

### AI 프롬프트 (Claude Code에 복붙)

```
다음 AWS CLI 명령어를 실행해서 S3 버킷을 생성하고 CORS를 설정해줘.

1. 버킷 생성:
aws s3 mb s3://cas-contracts-megathon --region ap-northeast-2

2. CORS 설정 파일 생성 (cors.json):
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "http://localhost:8000"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}

3. CORS 적용:
aws s3api put-bucket-cors --bucket cas-contracts-megathon --cors-configuration file://cors.json

4. cors.json 임시 파일 삭제
```

### 예상 결과물

- S3 버킷 `cas-contracts-megathon` 생성됨 (ap-northeast-2)
- CORS 정책 적용됨

### 검증

```bash
aws s3 ls | grep cas-contracts
aws s3api get-bucket-cors --bucket cas-contracts-megathon
```

> 예상 출력: 버킷 이름 표시 + CORS 규칙 JSON 출력

### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| `BucketAlreadyExists` | 버킷명 글로벌 중복 | `cas-contracts-megathon-{팀명}` 으로 변경 |
| `AccessDenied` | IAM 권한 부족 | S3 full access 정책 확인 |
| `IllegalLocationConstraintException` | 리전 불일치 | `--region ap-northeast-2` 확인 |

---

## Step 2: DynamoDB 테이블 4개 생성

**소요**: 15m | **의존성**: 없음 | **work-plan ID**: P-02

### 작업 설명

계약서 메타데이터, 리스크 리포트, 워크플로우, 프롬프트 템플릿을 저장할 DynamoDB 테이블 4개를 생성한다. 모두 On-Demand 모드(해커톤 트래픽 수준).

### AI 프롬프트 (Claude Code에 복붙)

```
DynamoDB 테이블 4개를 AWS CLI로 생성해줘. 모두 ap-northeast-2 리전, PAY_PER_REQUEST(On-Demand) 모드.

테이블 1: cas-contracts
- PK: id (S)
- GSI: customer_name-index (PK: customer_name (S))

테이블 2: cas-risk-reports
- PK: id (S)
- GSI: contract_id-index (PK: contract_id (S))

테이블 3: cas-workflow-steps
- PK: id (S)
- GSI: contract_id-index (PK: contract_id (S))

테이블 4: cas-prompt-templates
- PK: id (S)
- GSI: contract_type-index (PK: contract_type (S))

각 테이블마다 aws dynamodb create-table 명령어를 작성하고 순서대로 실행해줘.
GSI는 ProjectionType KEYS_ONLY가 아니라 ALL로 설정해야 해.
```

### 예상 결과물

- DynamoDB 테이블 4개: `cas-contracts`, `cas-risk-reports`, `cas-workflow-steps`, `cas-prompt-templates`
- 각 테이블에 GSI 1개씩

### 검증

```bash
aws dynamodb list-tables --region ap-northeast-2 --query "TableNames[?starts_with(@, 'cas-')]"
```

> 예상 출력:
> ```json
> ["cas-contracts", "cas-prompt-templates", "cas-risk-reports", "cas-workflow-steps"]
> ```

```bash
aws dynamodb describe-table --table-name cas-contracts --query "Table.GlobalSecondaryIndexes[].IndexName"
```

> 예상 출력: `["customer_name-index"]`

### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| `ResourceInUseException` | 동일 이름 테이블 이미 존재 | `aws dynamodb delete-table --table-name {name}` 후 재생성 |
| `LimitExceededException` | GSI 동시 생성 한도 | 30초 간격으로 하나씩 생성 |
| `ValidationException` | 키 스키마 오류 | AttributeDefinitions에 GSI 키도 포함 확인 |

---

## Step 3: Bedrock 모델 활성화

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: H-02, H-03

### 작업 설명

AWS Bedrock에서 Claude 3.5 Sonnet v2 (Agent 추론용)와 Titan Embeddings V2 (KB 임베딩용)를 활성화한다. **이 단계는 AWS 콘솔에서 수동 작업**이 필요하다.

### 수동 작업 (AWS 콘솔)

1. AWS 콘솔 접속 → 리전: `ap-northeast-2` (서울) 확인
2. 서비스 검색: **Amazon Bedrock** 클릭
3. 좌측 메뉴 → **Model access** (모델 액세스)
4. **Manage model access** 버튼 클릭
5. 아래 모델 2개를 찾아서 체크:
   - `Anthropic` → `Claude 3.5 Sonnet v2` (anthropic.claude-3-5-sonnet-20241022-v2:0)
   - `Amazon` → `Titan Text Embeddings V2` (amazon.titan-embed-text-v2:0)
6. **Save changes** 클릭
7. 상태가 `Access granted` 로 변할 때까지 대기 (보통 즉시~수 분)

> ⚠️ 일부 조직에서는 Bedrock 모델 접근에 관리자 승인이 필요할 수 있음. 사전에 확인할 것.

### 검증

```bash
aws bedrock list-foundation-models --region ap-northeast-2 --query "modelSummaries[?modelId=='anthropic.claude-3-5-sonnet-20241022-v2:0'].{id:modelId,status:modelLifecycle.status}" --output table
```

> 예상 출력: modelId가 ACTIVE 상태

```bash
aws bedrock list-foundation-models --region ap-northeast-2 --query "modelSummaries[?modelId=='amazon.titan-embed-text-v2:0'].{id:modelId,status:modelLifecycle.status}" --output table
```

### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| 모델 목록에 안 보임 | 리전 불일치 | ap-northeast-2 확인 |
| `Access denied` | IAM bedrock:* 권한 없음 | IAM 정책에 `bedrock:*` 추가 |
| 승인 대기 중 | 조직 정책 | 관리자에게 사전 요청 |

---

## Step 4: Bedrock Knowledge Base 생성

**소요**: 20m | **의존성**: Step 1 (S3), Step 3 (Titan Embeddings) | **work-plan ID**: P-03

### 작업 설명

계약서 히스토리 RAG 검색을 위한 Bedrock Knowledge Base를 생성한다. S3 버킷의 JSON 파일을 자동으로 청킹·임베딩·인덱싱한다. OpenSearch Serverless가 벡터 저장소로 자동 프로비저닝된다.

### 수동 작업 (AWS 콘솔)

> KB 생성은 CLI보다 콘솔이 편리하다. 아래 순서를 따라간다.

1. AWS 콘솔 → **Amazon Bedrock** → 좌측 메뉴 **Knowledge bases**
2. **Create knowledge base** 클릭
3. 기본 설정:
   - Knowledge base name: `cas-knowledge-base`
   - Description: `Contract Agent System - 계약서 히스토리 검색용`
   - IAM role: **Create and use a new service role** 선택
4. Data source 설정:
   - Data source name: `cas-contracts-s3`
   - S3 URI: `s3://cas-contracts-megathon/` (Step 1에서 생성한 버킷)
   - Inclusion patterns: `*.json` (JSON 파일만 인덱싱)
5. Embeddings 설정:
   - Embedding model: **Titan Text Embeddings V2** 선택
   - Vector dimensions: 1024 (기본값)
6. Vector store 설정:
   - **Quick create a new vector store** 선택 (OpenSearch Serverless 자동 생성)
7. **Create knowledge base** 클릭
8. 생성 완료까지 대기 (2~5분)

### 예상 결과물

- Bedrock Knowledge Base: `cas-knowledge-base` (ID: XXXXXXXXXX)
- OpenSearch Serverless collection 자동 생성됨
- S3 데이터 소스 연결됨

### 검증

```bash
aws bedrock-agent list-knowledge-bases --region ap-northeast-2 --query "knowledgeBaseSummaries[?name=='cas-knowledge-base'].{id:knowledgeBaseId,status:status}" --output table
```

> 예상 출력: knowledgeBaseId + status: ACTIVE

> ⚠️ **KB ID를 메모해둘 것!** — 이후 .env 파일에 `BEDROCK_KB_ID=XXXXXXXXXX` 로 입력해야 한다.

### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| KB 생성 실패 | IAM 서비스 역할 권한 | Bedrock 서비스 역할에 S3, OpenSearch 접근 권한 확인 |
| OpenSearch 생성 지연 | 첫 생성 시 10~15분 소요 | 대기 (자동 프로비저닝) |
| S3 연결 오류 | 버킷명/리전 불일치 | S3 URI 재확인 |

---

## Step 5: OpenSearch Serverless 상태 확인

**소요**: 10~15m (대기) | **의존성**: Step 4 | **work-plan ID**: P-04

### 작업 설명

Knowledge Base 생성 시 자동으로 프로비저닝된 OpenSearch Serverless 컬렉션이 ACTIVE 상태인지 확인한다. 자동이므로 기다리면 된다.

### 검증

```bash
aws opensearchserverless list-collections --region ap-northeast-2 --query "collectionSummaries[].{name:name,status:status}" --output table
```

> 예상 출력: `cas-knowledge-base` 관련 컬렉션이 `ACTIVE` 상태

> 💡 CREATING 상태이면 5분 간격으로 재확인. 최대 15분 소요.

### 문제 발생 시

| 증상 | 원인 | 해결 |
|------|------|------|
| CREATING 상태 지속 | 정상 — 초기 프로비저닝 | 15분 대기 |
| FAILED | 서비스 한도 초과 | AWS Support 문의 또는 다른 리전 시도 |

---

## Step 6: .env.example 작성

**소요**: 5m | **의존성**: 없음 | **work-plan ID**: P-05

### 작업 설명

프로젝트 루트에 환경변수 템플릿 파일을 생성한다. 해커톤 당일 .env로 복사하여 실제 값을 입력한다.

### AI 프롬프트 (Claude Code에 복붙)

```
프로젝트 루트(/Users/kainy/Projects/10-dev/10-work/10.07-megathon2026)에 .env.example 파일을 생성해줘.

내용:
# === Model Provider ===
MODEL_PROVIDER=groq                    # groq (사전 개발) | bedrock (해커톤 당일)

# === Groq (사전 개발용) ===
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx

# === AWS Common ===
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# === S3 ===
S3_BUCKET=cas-contracts-megathon

# === DynamoDB ===
DYNAMODB_TABLE_CONTRACTS=cas-contracts
DYNAMODB_TABLE_RISK_REPORTS=cas-risk-reports
DYNAMODB_TABLE_WORKFLOW=cas-workflow-steps
DYNAMODB_TABLE_PROMPTS=cas-prompt-templates

# === Bedrock ===
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0

# === Bedrock Knowledge Base ===
BEDROCK_KB_ID=                          # Knowledge Base 생성 후 ID 입력

# === App ===
BACKEND_PORT=8000
FRONTEND_PORT=3000

# === Frontend ===
NEXT_PUBLIC_USE_MOCK=true               # true: Mock 모드 | false: 실 API 연동
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### 예상 결과물

- `.env.example` 파일 (프로젝트 루트)

### 검증

```bash
cat .env.example | head -5
```

> 예상 출력: `# === Model Provider ===` ...

---

## 완료 체크리스트

- [ ] S3 버킷 `cas-contracts-megathon` 존재 + CORS 설정됨
- [ ] DynamoDB 테이블 4개 존재 (각각 GSI 포함)
- [ ] Bedrock Claude 3.5 Sonnet v2 — Access granted
- [ ] Bedrock Titan Embeddings V2 — Access granted
- [ ] Bedrock KB `cas-knowledge-base` — ACTIVE
- [ ] OpenSearch Serverless 컬렉션 — ACTIVE
- [ ] `.env.example` 작성됨
- [ ] **KB ID 메모됨** (당일 .env에 입력할 값)

---

## 다음 가이드

→ **Guide 02: 사전 문서 작성** (`guide-02-docs-prep.md`)
