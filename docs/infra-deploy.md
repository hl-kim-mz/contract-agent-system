# CAS 인프라 및 배포 설계서

> AWS 인프라 구성, Docker Compose 배포, 보안, 모니터링
> 기반 문서: DSC-014 합의문, Requirements v3.0

---

## 1. AWS 인프라 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud (ap-northeast-2)                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ EC2 Instance (t3.medium)                                  │   │
│  │                                                           │   │
│  │  ┌─── Docker Compose ──────────────────────────────┐     │   │
│  │  │                                                   │     │   │
│  │  │  ┌─────────────┐       ┌──────────────────┐      │     │   │
│  │  │  │ backend     │       │ frontend         │      │     │   │
│  │  │  │ (FastAPI)   │◄─────►│ (Streamlit)      │      │     │   │
│  │  │  │ :8000       │       │ :8501            │      │     │   │
│  │  │  └──────┬──────┘       └──────────────────┘      │     │   │
│  │  │         │                                         │     │   │
│  │  │  ┌──────┴──────┐                                  │     │   │
│  │  │  │ mcp-server  │                                  │     │   │
│  │  │  │ -sqlite     │                                  │     │   │
│  │  │  │ (compliance │                                  │     │   │
│  │  │  │  .db)       │                                  │     │   │
│  │  │  └─────────────┘                                  │     │   │
│  │  └───────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                     │
│              ┌─────────────┼──────────────────┐                  │
│              ▼             ▼                  ▼                  │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐      │
│  │ Amazon S3    │ │ DynamoDB     │ │ Bedrock            │      │
│  │ cas-contracts│ │ (4 Tables)   │ │ Sonnet + Haiku     │      │
│  │ -megathon    │ │              │ │ Guardrails         │      │
│  └──────────────┘ └──────────────┘ │ Knowledge Base     │      │
│                                     └────────────────────┘      │
│                                              │                   │
│                                     ┌────────┴───────┐          │
│                                     │ OpenSearch      │          │
│                                     │ Serverless      │          │
│                                     │ (벡터 저장소)    │          │
│                                     └────────────────┘          │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │ CloudWatch Logs  │                                           │
│  │ (모니터링)        │                                           │
│  └──────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. EC2 인스턴스 구성

| 항목 | 값 |
|------|-----|
| 인스턴스 타입 | t3.medium (2 vCPU, 4 GiB) |
| AMI | Amazon Linux 2023 |
| 리전 | ap-northeast-2 (서울) |
| 스토리지 | 30 GiB gp3 |
| Security Group | 인바운드: 8501(Streamlit), 8000(API), 22(SSH) |

### IAM Role 권한

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Retrieve",
        "bedrock:RetrieveAndGenerate",
        "bedrock:ApplyGuardrail"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cas-contracts-megathon",
        "arn:aws:s3:::cas-contracts-megathon/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-2:*:table/cas-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 3. Docker Compose 설정

```yaml
# docker-compose.yml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    volumes:
      - ./samples:/app/samples:ro
    depends_on:
      - mcp-sqlite
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "8501:8501"
    environment:
      - API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped

  mcp-sqlite:
    image: mcp/sqlite:latest
    volumes:
      - ./data/compliance.db:/data/compliance.db
    restart: unless-stopped
```

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY pyproject.toml .
RUN pip install -e .

COPY app/ app/
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

---

## 4. 환경변수 설정

### backend/.env

```bash
# === 모델 제공자 ===
MODEL_PROVIDER=bedrock          # groq (사전 개발) | bedrock (해커톤 당일)

# === AWS ===
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-northeast-2
AWS_DEFAULT_REGION=ap-northeast-2

# === S3 ===
S3_BUCKET=cas-contracts-megathon

# === Bedrock ===
BEDROCK_KB_ID=                  # Knowledge Base ID
BEDROCK_GUARDRAIL_ID=           # Guardrails 정책 ID
BEDROCK_GUARDRAIL_VERSION=      # Guardrails 버전

# === Groq (사전 개발용) ===
GROQ_API_KEY=

# === DynamoDB ===
DYNAMODB_CONTRACTS_TABLE=cas-contracts
DYNAMODB_RISK_REPORTS_TABLE=cas-risk-reports
DYNAMODB_WORKFLOW_TABLE=cas-workflow-steps
DYNAMODB_PROMPTS_TABLE=cas-prompt-templates
```

### frontend/.env.local (Streamlit인 경우)

```bash
API_URL=http://localhost:8000
```

---

## 5. Bedrock Guardrails 설정

### 콘솔에서 사전 생성 (T-60분)

| 항목 | 설정 |
|------|------|
| 정책 이름 | cas-guardrails |
| PII 탐지 | 활성화 — 이름, 전화번호, 이메일, 주민번호 |
| Prompt Attack | 활성화 — 탈옥 시도 차단 |
| 출력 마스킹 | 활성화 — 민감정보 마스킹 |

### 코드 연동 (Converse API)

```python
response = bedrock_client.converse(
    modelId="anthropic.claude-sonnet-4-20250514",
    messages=[...],
    guardrailConfig={
        "guardrailIdentifier": BEDROCK_GUARDRAIL_ID,
        "guardrailVersion": BEDROCK_GUARDRAIL_VERSION,
        "trace": "enabled"
    }
)
```

---

## 6. Bedrock Knowledge Base 설정

| 항목 | 값 |
|------|-----|
| KB 이름 | cas-knowledge-base |
| 데이터 소스 | S3 `cas-contracts-megathon` (파싱 JSON) |
| 벡터 저장소 | OpenSearch Serverless (자동 프로비저닝) |
| 임베딩 모델 | Amazon Titan Embeddings V2 |
| 청킹 전략 | 기본값 (auto) |
| 동기화 | 수동 sync (업로드 후 트리거) |

### KB 검색 코드

```python
response = bedrock_agent_client.retrieve_and_generate(
    input={"text": query},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {
            "knowledgeBaseId": BEDROCK_KB_ID,
            "modelArn": "arn:aws:bedrock:ap-northeast-2::foundation-model/anthropic.claude-haiku-4-20250414",
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {
                    "numberOfResults": 5
                }
            }
        }
    }
)
```

---

## 7. DynamoDB 테이블 생성

```bash
# cas-contracts
aws dynamodb create-table \
  --table-name cas-contracts \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2

# cas-risk-reports (+ GSI)
aws dynamodb create-table \
  --table-name cas-risk-reports \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=contract_id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"contract_id-index","KeySchema":[{"AttributeName":"contract_id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2

# cas-workflow-steps (+ GSI)
aws dynamodb create-table \
  --table-name cas-workflow-steps \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=contract_id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"contract_id-index","KeySchema":[{"AttributeName":"contract_id","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2

# cas-prompt-templates (+ GSI)
aws dynamodb create-table \
  --table-name cas-prompt-templates \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=contract_type,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{"IndexName":"contract_type-index","KeySchema":[{"AttributeName":"contract_type","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]' \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2
```

---

## 8. S3 버킷 생성

```bash
aws s3 mb s3://cas-contracts-megathon --region ap-northeast-2

# CORS 설정 (Streamlit 직접 업로드 시)
aws s3api put-bucket-cors --bucket cas-contracts-megathon --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": []
    }
  ]
}'
```

---

## 9. 배포 절차

### Plan A: EC2 Docker Compose

```bash
# 1. EC2 접속
ssh -i key.pem ec2-user@{public-ip}

# 2. Docker 설치
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user

# 3. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. 코드 배포
git clone {repo-url} cas
cd cas

# 5. 환경변수 설정
cp backend/.env.example backend/.env
vi backend/.env  # AWS credentials, KB ID 등 입력

# 6. 빌드 & 실행
docker-compose up -d --build

# 7. 상태 확인
docker-compose ps
curl http://localhost:8000/health
```

### Plan B: ngrok 터널

```bash
# 로컬에서 실행
cd backend && uvicorn app.main:app --reload &
cd frontend && streamlit run app.py &

# ngrok 터널
ngrok http 8501
```

### Plan C: 로컬 데모

```bash
cd backend && uvicorn app.main:app --reload
# 별도 터미널
cd frontend && streamlit run app.py
# 브라우저에서 http://localhost:8501 접속
```

---

## 10. 모니터링 (CloudWatch)

```python
import logging
import watchtower

logger = logging.getLogger("cas")
logger.addHandler(watchtower.CloudWatchLogHandler(
    log_group="/cas/backend",
    stream_name="agent-logs"
))
```

| 로그 그룹 | 내용 |
|-----------|------|
| /cas/backend | FastAPI 요청/응답 + Agent 실행 로그 |
| /cas/agents | Agent 호출 트레이스 (입력/출력/소요시간) |

---

## 11. 사전 체크리스트 (T-60분)

| 항목 | 담당 | 중요도 | 상태 |
|------|------|--------|------|
| EC2 IAM 권한 검증 | 사람 | CRITICAL | [ ] |
| Bedrock Guardrails 정책 생성 (콘솔) | 사람 | HIGH | [ ] |
| 한국어 KB 검색 smoke test | 사람 | HIGH | [ ] |
| Bedrock 모델 접근 확인 (Sonnet + Haiku) | 사람 | HIGH | [ ] |
| 모델 버전 통일 (스택 표 ↔ 코드) | 사람 | MEDIUM | [ ] |
| DynamoDB 4 테이블 생성 | 사람 | HIGH | [ ] |
| S3 버킷 생성 | 사람 | HIGH | [ ] |
| Security Group 포트 오픈 (8501, 8000) | 사람 | HIGH | [ ] |

---

## 12. Plan B 전환 트리거

| 기술 | 전환 조건 | Plan B |
|------|-----------|--------|
| EC2 배포 | 블록 종료 5분 전 미작동 | ngrok 터널 |
| Bedrock KB | KB 검색 실패 또는 한국어 품질 미달 | BM25 + SQLite FTS |
| Bedrock Guardrails | 정책 미생성 또는 API 오류 | 프롬프트 내 규칙 |
| mcp-server-sqlite | MCP 연결 실패 | 직접 SQLite 쿼리 |
| Strands SDK | Agent 생성 실패 | boto3 직접 Converse API |
