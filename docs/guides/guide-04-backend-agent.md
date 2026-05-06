# Guide 04: Backend — Agent + Tool 구현

> 담당: BE 담당 | 예상 소요: 2시간 | 의존성: Guide 03 완료 (스캐폴딩)
> 대응 Phase: work-plan.md Phase 2 Layer 1~2 (10:30~12:30)
> 실행 시점: **해커톤 당일 10:30~12:30**

---

## 사전 조건

- [ ] Guide 03 완료 — FastAPI 스캐폴딩 + Pydantic 모델 존재
- [ ] `backend/` 디렉토리에서 `uvicorn app.main:app --reload` 실행 가능
- [ ] `.env` 파일에 AWS credentials + KB ID 입력됨
- [ ] backend/.claude/CLAUDE.md 읽어둠

---

## 공통 인프라 래퍼 (10:30~11:00)

> 모든 Agent/Tool이 공유하는 AWS 클라이언트 래퍼 4개를 먼저 만든다.
> 4개 모두 독립적이므로 동시 진행 가능.

---

### Step 0.1: get_model() 팩토리

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 2-01

#### 작업 설명

환경변수 `MODEL_PROVIDER`에 따라 Bedrock 또는 Groq 모델을 반환하는 팩토리 함수. 모든 Agent가 이 함수로 모델을 가져온다.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/.claude/CLAUDE.md를 읽고, backend/app/core/model.py를 구현해줘.

get_model() 함수:
- MODEL_PROVIDER 환경변수 확인 (app.core.config의 settings 사용)
- "bedrock": strands.models.bedrock의 BedrockModel 반환
  - model_id: settings.BEDROCK_MODEL_ID
  - region_name: settings.AWS_REGION
- "groq": strands.models.litellm의 LiteLLMModel 반환
  - model_id: "groq/llama-3.3-70b-versatile"
- 그 외: ValueError

Strands SDK import 경로:
- from strands.models.bedrock import BedrockModel
- from strands.models.litellm import LiteLLMModel

config.py에 MODEL_PROVIDER, BEDROCK_MODEL_ID, AWS_REGION 필드가 있는지 확인하고 없으면 추가해.
```

#### 예상 결과물

- `backend/app/core/model.py` — get_model() 함수

#### 검증

```bash
cd backend && python -c "from app.core.model import get_model; m = get_model(); print(type(m))"
```

> 예상 출력: `<class 'strands.models.bedrock.BedrockModel'>` (bedrock 모드일 때)

---

### Step 0.2: S3 클라이언트 래퍼

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 2-02

#### 작업 설명

계약서 DOCX/JSON 파일의 업로드·다운로드·버전별 경로 생성을 담당하는 S3 래퍼.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/clients/s3.py를 구현해줘. app.core.config의 settings를 사용.

S3Client 클래스:
1. __init__: boto3.client("s3", region_name=settings.AWS_REGION)

2. upload_file(file_bytes: bytes, customer_name: str, contract_id: str, version: int, ext: str = "docx") -> str:
   - S3 키: "{customer_name}/{contract_id}/v{version}.{ext}"
   - put_object로 업로드
   - 키 문자열 반환

3. upload_json(data: dict, customer_name: str, contract_id: str, version: int) -> str:
   - JSON 직렬화 후 upload_file (ext="json")
   - ContentType="application/json" 설정
   - Bedrock KB가 이 JSON을 인덱싱하므로 중요

4. download_file(s3_key: str) -> bytes:
   - get_object로 다운로드

5. get_version_key(customer_name: str, contract_id: str, version: int, ext: str = "docx") -> str:
   - S3 키 패턴 반환 (업로드/다운로드 시 재사용)

settings.S3_BUCKET을 사용. 싱글톤 인스턴스도 모듈 수준에서 생성:
s3_client = S3Client()
```

#### 예상 결과물

- `backend/app/clients/s3.py` — S3Client 클래스 + s3_client 싱글톤

#### 검증

```bash
cd backend && python -c "from app.clients.s3 import s3_client; print('S3 client OK')"
```

---

### Step 0.3: DynamoDB 클라이언트 래퍼

**소요**: 15m | **의존성**: 없음 | **work-plan ID**: 2-03

#### 작업 설명

4개 DynamoDB 테이블에 대한 CRUD + GSI 쿼리 + 버전 채번 기능을 제공하는 래퍼.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/clients/dynamodb.py를 구현해줘. app.core.config의 settings를 사용.

DynamoDBClient 클래스:
1. __init__: boto3.resource("dynamodb", region_name=settings.AWS_REGION)

2. 범용 CRUD:
   - put_item(table_name: str, item: dict)
   - get_item(table_name: str, key: dict) -> dict | None
   - update_item(table_name: str, key: dict, updates: dict)
   - query_by_gsi(table_name: str, index_name: str, key_name: str, key_value: str) -> list[dict]
   - scan_all(table_name: str) -> list[dict]

3. 계약서 전용:
   - get_next_version(customer_name: str) -> int:
     cas-contracts 테이블에서 customer_name으로 GSI 쿼리 → 최대 version + 1 반환 (없으면 1)
   
   - get_previous_contract(customer_name: str, current_version: int) -> dict | None:
     customer_name으로 GSI 쿼리 → version이 current_version - 1인 아이템 반환

4. 테이블명은 settings에서 가져옴:
   settings.DYNAMODB_TABLE_CONTRACTS
   settings.DYNAMODB_TABLE_RISK_REPORTS
   settings.DYNAMODB_TABLE_WORKFLOW
   settings.DYNAMODB_TABLE_PROMPTS

싱글톤: db_client = DynamoDBClient()
```

#### 예상 결과물

- `backend/app/clients/dynamodb.py` — DynamoDBClient 클래스 + db_client 싱글톤

#### 검증

```bash
cd backend && python -c "
from app.clients.dynamodb import db_client
from app.core.config import settings
items = db_client.scan_all(settings.DYNAMODB_TABLE_PROMPTS)
print(f'Prompts: {len(items)}건')
"
```

> 예상 출력: `Prompts: 4건` (Guide 03에서 시드 데이터 투입했으므로)

---

### Step 0.4: Bedrock KB 클라이언트 래퍼

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 2-04

#### 작업 설명

RAG 검색(retrieve_and_generate)과 KB 동기화 트리거를 담당하는 래퍼.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/clients/bedrock_kb.py를 구현해줘.

BedrockKBClient 클래스:
1. __init__:
   - self.agent_runtime = boto3.client("bedrock-agent-runtime", region_name=settings.AWS_REGION)
   - self.agent = boto3.client("bedrock-agent", region_name=settings.AWS_REGION)
   - self.kb_id = settings.BEDROCK_KB_ID

2. retrieve_and_generate(query: str, customer_filter: str | None = None) -> dict:
   - bedrock-agent-runtime의 retrieve_and_generate API 호출
   - knowledgeBaseId: self.kb_id
   - modelArn: settings.BEDROCK_MODEL_ID의 full ARN
   - input: {"text": query}
   - customer_filter가 있으면 retrievalConfiguration에 메타데이터 필터 추가
   - 응답에서 output.text와 citations 추출하여 반환

3. sync_data_source() -> None:
   - bedrock-agent의 start_ingestion_job API 호출
   - knowledgeBaseId: self.kb_id
   - dataSourceId: 첫 번째 데이터소스 ID (list_data_sources로 조회)
   - 비동기 — 호출만 하고 완료 대기 안 함

싱글톤: kb_client = BedrockKBClient()

참고: retrieve_and_generate API의 정확한 파라미터는 boto3 문서를 참조해.
modelArn 형식: arn:aws:bedrock:{region}::foundation-model/{model_id}
```

#### 예상 결과물

- `backend/app/clients/bedrock_kb.py` — BedrockKBClient 클래스 + kb_client 싱글톤

#### 검증

```bash
cd backend && python -c "from app.clients.bedrock_kb import kb_client; print('KB client OK')"
```

---

> **11:00 기준 상태**: AWS 클라이언트 래퍼 4개 완성. 이제 Feature별 Tool + Agent 구현.

---

## Feature 1: 계약서 업로드 + 파싱 (11:00~11:30)

---

### Step 1.1: @tool extract_docx_text

**소요**: 15m | **의존성**: Step 0.2 (S3 래퍼) | **work-plan ID**: 2-05

#### 작업 설명

DOCX 파일에서 텍스트와 표 데이터를 추출하는 tool. python-docx를 사용하여 확정적으로 추출한다 (LLM 불필요).

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/tools/extract_docx.py를 구현해줘.

from strands import tool 데코레이터를 사용.

@tool
def extract_docx_text(s3_key: str) -> str:
    """S3에서 DOCX 파일을 다운로드하고 텍스트와 표 내용을 추출합니다."""
    
    처리 흐름:
    1. s3_client.download_file(s3_key)로 DOCX 바이트 다운로드
    2. io.BytesIO로 감싸서 python-docx Document 로드
    3. 모든 paragraph에서 텍스트 추출 (빈 줄 제거)
    4. 모든 table에서 셀 텍스트 추출 (표 형태 유지: | col1 | col2 | 형식)
    5. paragraph 텍스트 + table 텍스트를 합쳐서 하나의 문자열로 반환

import:
- from docx import Document
- import io
- from app.clients.s3 import s3_client

표 추출 시 각 행을 "| cell1 | cell2 | cell3 |" 형태로 변환.
표와 본문 사이에 "\n\n--- 표 ---\n\n" 구분자 추가.
```

#### 예상 결과물

- `backend/app/tools/extract_docx.py` — extract_docx_text tool

#### 검증

```bash
# 샘플 DOCX가 S3에 있으면 테스트
cd backend && python -c "
from app.tools.extract_docx import extract_docx_text
# 테스트는 실제 DOCX 업로드 후 진행
print('Tool import OK')
"
```

---

### Step 1.2: Parsing Agent 조합

**소요**: 30m | **의존성**: Step 0.1, 1.1 | **work-plan ID**: 2-06

#### 작업 설명

사전 작성한 시스템 프롬프트(`docs/prompts/parsing-agent.md`)를 적용하여 Parsing Agent를 정의한다. DOCX 텍스트를 입력받아 Contract JSON을 출력한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/parsing-agent.md를 읽고, backend/app/agents/parsing_agent.py를 구현해줘.

구현 내용:
1. DynamoDB cas-prompt-templates에서 프롬프트를 로드하는 것이 아니라,
   docs/prompts/parsing-agent.md 내용을 기본 시스템 프롬프트로 사용.
   (Parsing Agent는 프롬프트 커스터마이징 대상이 아님)

2. Strands Agent 정의:
   from strands import Agent
   from app.core.model import get_model
   from app.tools.extract_docx import extract_docx_text

   SYSTEM_PROMPT = """
   (parsing-agent.md 내용 — 파일에서 읽어서 문자열로)
   """

   def create_parsing_agent() -> Agent:
       return Agent(
           model=get_model(),
           tools=[extract_docx_text],
           system_prompt=SYSTEM_PROMPT,
       )

3. 편의 함수:
   def parse_contract(s3_key: str) -> dict:
       agent = create_parsing_agent()
       response = agent(f"다음 S3 키에서 DOCX를 추출하고 Contract JSON으로 구조화해주세요: {s3_key}")
       # 응답에서 JSON 파싱
       # Agent 응답이 텍스트일 수 있으므로 JSON 블록을 추출하는 로직 필요
       return extract_json_from_response(str(response))

4. extract_json_from_response(text: str) -> dict 헬퍼:
   - 응답 텍스트에서 ```json ... ``` 블록 추출
   - 없으면 전체 텍스트를 json.loads 시도
   - 실패하면 {"error": "JSON 파싱 실패", "raw": text} 반환

시스템 프롬프트는 docs/prompts/parsing-agent.md 파일 내용을 직접 문자열로 넣어도 되고,
파일에서 읽어도 됨. 해커톤이니 문자열로 직접 넣는 게 간단.
```

#### 예상 결과물

- `backend/app/agents/parsing_agent.py` — create_parsing_agent() + parse_contract()

#### 검증 (샘플 DOCX 필요)

```bash
cd backend && python -c "
from app.agents.parsing_agent import create_parsing_agent
agent = create_parsing_agent()
print(f'Parsing Agent created, tools: {[t.__name__ for t in agent.tools if hasattr(t, \"__name__\")]}')
"
```

---

### 🔴 인간 체크포인트 (12:00)

| 시각 | 작업 | 판단 기준 |
|------|------|-----------|
| 12:00 | Parsing Agent 단독 테스트 — 샘플 DOCX 1건 업로드 후 JSON 품질 확인 | JSON 구조가 스키마와 일치하고 핵심 필드(parties, dates, clauses)가 추출됨 |

> 이 체크포인트에서 Parsing Agent 출력이 불만족스러우면 시스템 프롬프트 조정.

---

## Feature 2: 리스크 분석 + 재무 분석 (11:30~12:15)

---

### Step 2.1: @tool check_risk

**소요**: 20m | **의존성**: Step 0.1, 0.3 | **work-plan ID**: 2-08

#### 작업 설명

DynamoDB에서 커스텀 프롬프트를 로드하여 조항별 리스크를 탐지하는 tool. 계약 유형에 맞는 프리셋 프롬프트가 있으면 병합한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/tools/check_risk.py를 구현해줘.

from strands import tool 사용.

@tool
def check_risk(contract_json: dict, contract_type: str | None = None) -> dict:
    """계약서 JSON을 분석하여 조항별 리스크를 탐지합니다. 
    DynamoDB에서 커스텀 프롬프트를 로드하여 리스크 판단 기준으로 사용합니다."""
    
    처리 흐름:
    1. DynamoDB cas-prompt-templates에서 프롬프트 로드:
       - 기본: id="prompt_default" 항상 로드
       - 유형별: contract_type이 있으면 contract_type-index GSI로 해당 프리셋도 로드
       - 두 프롬프트를 합침 (기본 + 프리셋)
    
    2. get_model()로 LLM 호출:
       - 시스템 프롬프트: 로드된 커스텀 프롬프트
       - 사용자 메시지: contract_json을 JSON 문자열로 전달
       - "다음 계약서를 분석하여 Risk Report JSON을 생성하세요."
    
    3. 응답에서 Risk Report JSON 추출하여 반환

import:
- from app.clients.dynamodb import db_client
- from app.core.config import settings
- from app.core.model import get_model
- from strands import Agent

LLM 호출은 간단히 Agent를 임시 생성하여 사용:
temp_agent = Agent(model=get_model(), system_prompt=combined_prompt)
response = temp_agent(f"다음 계약서를 분석하세요:\n{json.dumps(contract_json, ensure_ascii=False)}")
```

#### 예상 결과물

- `backend/app/tools/check_risk.py` — check_risk tool

---

### Step 2.2: @tool analyze_financials

**소요**: 15m | **의존성**: Step 0.1 | **work-plan ID**: 2-09

#### 작업 설명

계약서의 금액·페널티·지체상금 등 재무 관련 리스크를 분석하는 tool.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/tools/analyze_financials.py를 구현해줘.

@tool
def analyze_financials(contract_json: dict) -> dict:
    """계약서의 재무 정보(금액, 페널티, 지체상금 등)를 분석하여 재무 리스크를 평가합니다."""
    
    처리:
    1. contract_json에서 financials 섹션 추출
    2. get_model()로 LLM에 재무 분석 요청
    3. 분석 항목:
       - 계약금액 적정성
       - 지급조건 리스크 (선급금 비율, 잔금 시점)
       - 지체상금율 (0.1%/일 초과 여부)
       - 위약금 조건
       - 총 재무 노출 금액 추정
    4. 결과를 dict로 반환: {"financial_risks": [...], "total_exposure": "...", "summary": "..."}

시스템 프롬프트:
"당신은 IT 서비스 계약의 재무 리스크 분석 전문가입니다.
메가존클라우드 기준: 지체상금율 0.05%/일 이내, 선급금 30% 이상 권장."

임시 Agent 생성해서 LLM 호출.
```

#### 예상 결과물

- `backend/app/tools/analyze_financials.py`

---

### Step 2.3: @tool diff_with_previous

**소요**: 20m | **의존성**: Step 0.3 | **work-plan ID**: 2-07

#### 작업 설명

DynamoDB에서 이전 버전 계약서를 조회하고, deepdiff로 JSON 구조를 비교한 뒤, LLM으로 리스크 영향 요약을 생성한다. 코드 + AI 하이브리드 tool.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/tools/diff_previous.py를 구현해줘.

@tool
def diff_with_previous(contract_id: str, customer_name: str, current_version: int, current_json: dict) -> dict | None:
    """이전 버전 계약서와 비교하여 변경사항과 리스크 영향을 분석합니다.
    이전 버전이 없으면 None을 반환합니다."""
    
    처리 흐름:
    1. db_client.get_previous_contract(customer_name, current_version)로 이전 버전 조회
       - None이면 return None (첫 번째 버전)
    
    2. 이전 버전의 clauses와 현재 clauses를 deepdiff로 비교:
       from deepdiff import DeepDiff
       diff = DeepDiff(prev_clauses, current_clauses, ignore_order=True)
    
    3. diff 결과를 변경 유형별로 정리:
       - ADDED: 새로 추가된 조항
       - REMOVED: 삭제된 조항
       - MODIFIED: 내용이 변경된 조항
    
    4. financials도 비교:
       amount_delta = current_financials["total_amount"] - prev_financials["total_amount"]
       penalty_change도 비교
    
    5. LLM으로 리스크 영향 요약 생성:
       각 변경사항에 대해 "리스크 증가 | 리스크 감소 | 중립" 판정 + highlight 요약
       전체 diff_summary 생성
       risk_change 판정 (예: "MEDIUM→HIGH")
    
    6. Diff Report JSON 구조로 반환 (requirements.md의 스키마 참조)

import:
- from deepdiff import DeepDiff
- from app.clients.dynamodb import db_client
- from app.core.model import get_model
- from strands import Agent
```

#### 예상 결과물

- `backend/app/tools/diff_previous.py` — diff_with_previous tool

---

### Step 2.4: Legal Review Agent 조합

**소요**: 20m | **의존성**: Step 2.1~2.3 | **work-plan ID**: 2-10

#### 작업 설명

3개 tool(check_risk, diff_with_previous, analyze_financials)을 바인딩한 Legal Review Agent.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/legal-agent.md를 읽고, backend/app/agents/legal_agent.py를 구현해줘.

Legal Review Agent:
1. 3개 tool 바인딩: check_risk, diff_with_previous, analyze_financials
2. 시스템 프롬프트: legal-agent.md 내용을 기본으로 하되,
   실제로는 DynamoDB에서 로드하는 것이 정석.
   하지만 check_risk tool 내부에서 이미 DynamoDB 프롬프트를 로드하므로,
   Agent 수준 프롬프트는 오케스트레이션 지시만:
   
   "당신은 계약서 법무 리스크 분석 에이전트입니다.
   주어진 계약서를 분석하여:
   1. check_risk tool로 조항별 리스크를 탐지하세요.
   2. analyze_financials tool로 재무 리스크를 분석하세요.
   3. diff_with_previous tool로 이전 버전과 비교하세요 (이전 버전이 있는 경우).
   4. 모든 결과를 종합하여 최종 Risk Report를 생성하세요."

3. create_legal_agent() → Agent
4. review_contract(contract_id, customer_name, version, contract_json, contract_type) → dict:
   - Agent 실행
   - 결과에서 Risk Report + Diff Report 추출

from app.tools.check_risk import check_risk
from app.tools.diff_previous import diff_with_previous
from app.tools.analyze_financials import analyze_financials
```

#### 예상 결과물

- `backend/app/agents/legal_agent.py` — create_legal_agent() + review_contract()

#### 검증

```bash
cd backend && python -c "
from app.agents.legal_agent import create_legal_agent
agent = create_legal_agent()
print(f'Legal Agent created, tools: {len(agent.tools)}개')
"
```

> 예상 출력: `Legal Agent created, tools: 3개`

---

### 🔴 인간 체크포인트 (12:30)

| 시각 | 작업 | 판단 기준 |
|------|------|-----------|
| 12:30 | Legal Agent 리스크 탐지 결과 검증 — 프롬프트 피드백 | HIGH 리스크 조항이 정확히 탐지되고, 수정 제안이 합리적인지 |

> 이 시점에서 리스크 탐지 품질이 부족하면 프롬프트 수정 (DynamoDB 시드 데이터 업데이트).

---

## Feature 3: RAG 히스토리 검색 (12:15~12:45)

---

### Step 3.1: @tool search_contract_history

**소요**: 20m | **의존성**: Step 0.4 (KB 래퍼) | **work-plan ID**: 2-11

#### 작업 설명

Bedrock KB의 retrieve_and_generate API를 호출하여 계약 히스토리를 검색하는 tool.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/tools/search_history.py를 구현해줘.

@tool
def search_contract_history(query: str, customer_name: str | None = None, max_results: int = 5) -> dict:
    """계약서 히스토리를 자연어로 검색합니다. 
    Bedrock Knowledge Base에서 관련 계약서를 검색하고 출처 포함 답변을 생성합니다."""
    
    처리:
    1. kb_client.retrieve_and_generate(query, customer_filter=customer_name) 호출
    2. 응답에서 answer 텍스트 추출
    3. citations에서 source 정보 추출:
       - 각 citation의 retrievedReferences에서
         content.text (관련 텍스트)
         location.s3Location.uri (S3 경로 → contract_id, customer_name, version 파싱)
         metadata (있으면)
    4. sources 배열 구성 (최대 max_results개)
    5. SearchResponse 형태로 반환

import:
- from app.clients.bedrock_kb import kb_client

S3 URI 파싱 예:
"s3://cas-contracts-megathon/A사/contract_001/v3.json"
→ customer_name: "A사", contract_id: "contract_001", version: 3
```

#### 예상 결과물

- `backend/app/tools/search_history.py`

---

### Step 3.2: Search Agent 조합

**소요**: 10m | **의존성**: Step 3.1 | **work-plan ID**: 2-12

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/search-agent.md를 읽고, backend/app/agents/search_agent.py를 구현해줘.

create_search_agent() → Agent:
- model: get_model()
- tools: [search_contract_history]
- system_prompt: search-agent.md 내용

search_contracts(query: str, customer_name: str | None = None) → dict:
- Agent 실행
- 결과 파싱하여 SearchResponse 형태 반환
```

#### 예상 결과물

- `backend/app/agents/search_agent.py`

---

## Feature 4: 워크플로우 라우팅 (12:00~12:10)

---

### Step 4.1: Rule Engine

**소요**: 10m | **의존성**: 없음 | **work-plan ID**: 2-13

#### 작업 설명

리스크 레벨과 조건에 따라 검토자를 결정하는 순수 Python 함수. AI가 아닌 코드 기반 로직.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/services/rule_engine.py를 구현해줘.

docs/requirements.md의 "Rule Engine: Workflow" 섹션을 참고.

from strands import tool 데코레이터를 사용 (Orchestrator에서 tool로 사용하므로).

@tool
def route_reviewers(risk_report: dict, contract: dict) -> list[dict]:
    """리스크 레벨과 계약 조건에 따라 검토자를 자동 결정합니다."""
    
    라우팅 규칙:
    1. overall_risk == "HIGH" → ["법무팀", "팀장", "본부장"] (3단계)
    2. overall_risk == "MEDIUM" → ["팀장", "담당임원"] (2단계)
    3. overall_risk == "LOW" → ["담당자"] (1단계)
    4. 계약금액 >= 10억 (1_000_000_000) → "재무팀" 추가
    5. clause_risks에 IP_완전이전 유형 있으면 → "기술법무" 추가

    반환: 각 검토자를 WorkflowStep dict로 변환
    [
      {"step_order": 1, "department": "법무팀", "assignee": "이법무", "status": "PENDING"},
      {"step_order": 2, "department": "팀장", "assignee": "박팀장", "status": "PENDING"},
      ...
    ]
    
    assignee는 Mock 이름 사용 (법무팀→이법무, 팀장→박팀장, 본부장→김본부장, 
    담당임원→최임원, 담당자→정담당, 재무팀→한재무, 기술법무→윤기술).
```

#### 예상 결과물

- `backend/app/services/rule_engine.py` — route_reviewers tool

---

## Orchestrator 통합 (12:30~12:50)

---

### Step 5.1: Orchestrator Agent

**소요**: 20m | **의존성**: Feature 1~4 전부 | **work-plan ID**: 2-14

#### 작업 설명

Parsing → Legal → Rule Engine을 순차 실행하는 오케스트레이터. Strands SDK의 `as_tool` 패턴으로 Agent를 tool로 조합한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
backend/app/agents/orchestrator.py를 구현해줘.

Orchestrator Agent:
1. Strands as_tool 패턴으로 하위 Agent를 조합:
   - parsing_agent.as_tool(name="parse_contract", description="DOCX를 파싱하여 Contract JSON 생성")
   - legal_agent.as_tool(name="review_risks", description="리스크 탐지 + Diff + 재무 분석")
   - route_reviewers (이미 @tool이므로 직접 사용)

2. system_prompt:
   "당신은 계약서 분석 오케스트레이터입니다.
   다음 순서로 계약서를 분석하세요:
   1. parse_contract로 DOCX를 파싱하여 Contract JSON을 생성
   2. review_risks로 리스크 분석 + 이전 버전 비교 + 재무 분석
   3. route_reviewers로 리스크 기반 검토자 라우팅
   모든 결과를 종합하여 보고하세요."

3. 하지만 해커톤에서는 as_tool 패턴보다 **직접 함수 호출 파이프라인**이 더 안정적일 수 있어:

   async def run_analysis_pipeline(contract_id: str, s3_key: str, customer_name: str, version: int, contract_type: str | None) -> dict:
       # Step 1: Parsing
       contract_json = parse_contract(s3_key)
       
       # DynamoDB에 파싱 결과 저장
       db_client.update_item(...)
       
       # S3에 JSON 저장 (KB 인덱싱용)
       s3_client.upload_json(contract_json, customer_name, contract_id, version)
       
       # KB 동기화 트리거
       kb_client.sync_data_source()
       
       # Step 2: Legal Review
       review_result = review_contract(contract_id, customer_name, version, contract_json, contract_type)
       risk_report = review_result["risk_report"]
       diff_report = review_result.get("diff_report")
       
       # DynamoDB에 리스크 리포트 저장
       db_client.put_item(settings.DYNAMODB_TABLE_RISK_REPORTS, risk_report)
       
       # Step 3: Routing
       workflow_steps = route_reviewers(risk_report, contract_json)
       
       # DynamoDB에 워크플로우 스텝 저장
       for step in workflow_steps:
           step["contract_id"] = contract_id
           step["id"] = f"step_{contract_id}_{step['step_order']}"
           db_client.put_item(settings.DYNAMODB_TABLE_WORKFLOW, step)
       
       # 계약서 상태 업데이트
       db_client.update_item(settings.DYNAMODB_TABLE_CONTRACTS, 
           {"id": contract_id}, 
           {"status": "REVIEWING", "overall_risk": risk_report.get("overall_risk")})
       
       return {
           "contract_json": contract_json,
           "risk_report": risk_report,
           "diff_report": diff_report,
           "workflow_steps": workflow_steps
       }

두 가지 방식(as_tool Agent vs 직접 파이프라인) 중 직접 파이프라인을 기본으로 구현하되,
as_tool Agent도 참고용으로 주석으로 남겨둬.
해커톤에서는 예측 가능한 직접 호출이 더 안전해.
```

#### 예상 결과물

- `backend/app/agents/orchestrator.py` — run_analysis_pipeline()

#### 검증

```bash
cd backend && python -c "
from app.agents.orchestrator import run_analysis_pipeline
print('Orchestrator pipeline import OK')
"
```

---

## 완료 체크리스트

- [ ] `app/core/model.py` — get_model() 팩토리
- [ ] `app/clients/s3.py` — S3Client
- [ ] `app/clients/dynamodb.py` — DynamoDBClient
- [ ] `app/clients/bedrock_kb.py` — BedrockKBClient
- [ ] `app/tools/extract_docx.py` — @tool extract_docx_text
- [ ] `app/agents/parsing_agent.py` — Parsing Agent
- [ ] `app/tools/check_risk.py` — @tool check_risk
- [ ] `app/tools/analyze_financials.py` — @tool analyze_financials
- [ ] `app/tools/diff_previous.py` — @tool diff_with_previous
- [ ] `app/agents/legal_agent.py` — Legal Review Agent (3 tools)
- [ ] `app/tools/search_history.py` — @tool search_contract_history
- [ ] `app/agents/search_agent.py` — Search Agent
- [ ] `app/services/rule_engine.py` — route_reviewers
- [ ] `app/agents/orchestrator.py` — run_analysis_pipeline()

### Plan B/C 절단 지점

| Plan | 삭제 대상 | 영향 |
|------|-----------|------|
| Plan B | (Agent 전부 유지) | 이 가이드 영향 없음 |
| Plan C | Feature 3 (Search Agent) 제거 | Step 3.1~3.2 건너뜀, Orchestrator에서 KB 연동 제거 |

---

## 다음 가이드

→ **Guide 05: Backend API 엔드포인트** (`guide-05-backend-api.md`)
