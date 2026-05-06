# Guide 02: 사전 문서 작성

> 담당: 브릿지/공통 | 예상 소요: 2.5시간 | 의존성: requirements.md 완료
> 대응 Phase: work-plan.md Phase 0-C (D-01 ~ D-07)
> 실행 시점: **해커톤 D-1** (사전 준비)

---

## 사전 조건

- [ ] `docs/requirements.md` 최신 버전 존재
- [ ] `docs/api-spec.md` 최신 버전 존재
- [ ] 메가존 표준 계약 기준 텍스트 확보 (없으면 Mock 텍스트 작성)

---

## 병렬 그룹 A (동시 실행 가능)

아래 4개 작업은 서로 의존성이 없어 동시에 진행할 수 있다. 팀원이 나눠서 작업하거나, AI 세션을 여러 개 열어서 병렬 실행한다.

---

### Step 1.1: 서비스 기획안 작성 (D-01)

**소요**: 30m | **의존성**: requirements.md | **work-plan ID**: D-01

#### 작업 설명

해커톤 제출물 #4에 해당하는 서비스 기획안. 비기술 심사위원도 이해할 수 있는 수준으로 문제 정의 → 솔루션 → 사용자 시나리오 → 차별점을 정리한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/requirements.md를 읽고, docs/service-plan.md 파일을 생성해줘.

서비스 기획안이야. 해커톤 제출용이라 비기술 심사위원도 이해할 수 있어야 해.

포함 내용:
1. 서비스 개요 (서비스명, 한줄 설명, 대상 사용자)
2. 문제 정의 (현재 계약 관리 Pain Points 3~5개, 정량적 영향 포함)
3. 솔루션 (CAS가 어떻게 해결하는지, AI Agent 3개의 역할을 비기술 언어로)
4. 핵심 가치 제안 (3가지)
   - 계약 리스크 5분 내 자동 탐지
   - 계약 이력 자연어 검색 (RAG)
   - 리스크 기반 자동 검토 라우팅
5. 사용자 시나리오 (영업팀 담당자 관점, step-by-step 스토리)
6. 화면 흐름도 (텍스트 기반)
   대시보드 → 업로드 → 분석 진행 → 리포트 → Diff → 워크플로우 → 검색
7. 차별점 (기존 계약 관리 도구 대비)
8. 향후 확장 계획 (프로젝트 컨텍스트, 이메일 크롤러 등)

톤: 전문적이되 쉬운 한국어. 기술 용어는 괄호 안에 설명 추가.
분량: A4 3~4페이지 분량.
```

#### 예상 결과물

- `docs/service-plan.md` — 서비스 기획안 완성본

#### 검증

- 문서를 읽어보고 비기술자가 이해 가능한지 확인
- 8개 섹션 모두 포함되었는지 체크
- requirements.md와 내용 일관성 확인

---

### Step 1.2: 아키텍처 설계서 작성 (D-02)

**소요**: 30m | **의존성**: requirements.md | **work-plan ID**: D-02

#### 작업 설명

해커톤 제출물 #3에 해당하는 아키텍처 설계서. 시스템 구성도, 기술 스택, 데이터 흐름, AI Agent 구조를 기술적으로 문서화한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/requirements.md와 docs/api-spec.md를 읽고, docs/architecture.md를 생성해줘.

아키텍처 설계서야. 해커톤 제출물이라 기술 심사위원이 볼 수 있어야 해.

포함 내용:
1. 시스템 개요 (한줄 + 전체 아키텍처 ASCII 다이어그램)
2. AI vs Code 역할 분담표 (requirements.md에 있는 표 기반)
3. Agent 아키텍처
   - Parsing Agent: 입출력, tool, 프롬프트 전략
   - Legal Review Agent: 3개 tool 상세 (check_risk, diff_with_previous, analyze_financials)
   - Search Agent: Bedrock KB 연동 방식
   - Orchestrator: as_tool 패턴으로 파이프라인 구성
4. 데이터 흐름도 (DOCX 업로드 → S3 → Parsing → Legal → Rule Engine → DynamoDB)
5. 데이터 모델 (S3 경로 구조, DynamoDB 4테이블 스키마, Bedrock KB 구성)
6. 기술 스택 결정 근거
   - Strands SDK 선택 이유
   - DynamoDB 선택 이유 (vs RDS)
   - Bedrock KB 선택 이유 (vs 자체 RAG)
   - deepdiff 선택 이유 (vs LLM diff)
7. API 구조 (엔드포인트 목록 + 역할)
8. 모델 운영 전략 (Groq → Bedrock 2단계)
9. 인프라 구성도 (AWS 서비스 간 연결 ASCII 다이어그램)

다이어그램은 ASCII art로 작성. 한국어로 작성.
```

#### 예상 결과물

- `docs/architecture.md` — 아키텍처 설계서 완성본

#### 검증

- ASCII 다이어그램이 깨지지 않는지 확인
- requirements.md의 기술 스택과 일관성 확인
- DynamoDB 테이블 스키마가 정확한지 확인

---

### Step 1.3: Parsing Agent 시스템 프롬프트 (D-03)

**소요**: 20m | **의존성**: requirements.md | **work-plan ID**: D-03

#### 작업 설명

Parsing Agent가 사용할 시스템 프롬프트를 작성한다. DOCX에서 추출된 원문 텍스트를 입력받아 구조화된 Contract JSON을 출력하도록 지시한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/requirements.md의 "Agent 1: Parsing Agent" 섹션을 읽고, docs/prompts/parsing-agent.md를 생성해줘.

이 파일은 Parsing Agent의 시스템 프롬프트야. Strands SDK Agent의 system_prompt 파라미터에 들어갈 텍스트를 마크다운으로 작성해.

프롬프트 내용:
1. 역할 정의: "당신은 메가존클라우드의 계약서 파싱 전문가입니다."
2. 작업 지시:
   - 입력: python-docx로 추출된 계약서 원문 텍스트
   - 수행: 계약 유형 분류, 당사자 추출, 날짜 추출, 금액 추출, 조항 분류
3. 계약 유형 분류 기준: NDA, MSA, SI 도급, SLA, 유지보수, 기타
4. 조항 분류 기준: liability, ip, confidentiality, termination, dispute, penalty, other
5. 출력 형식: requirements.md에 정의된 Contract JSON 스키마 (정확히 복사)
6. 주의사항:
   - 한국어 계약서 기준
   - 금액은 숫자로 변환 (예: "5억원" → 500000000)
   - 날짜는 YYYY-MM-DD 형식
   - 조항이 여러 유형에 해당하면 가장 핵심적인 유형 1개만 선택
   - 누락 정보는 null로 표시

docs/prompts/ 디렉토리가 없으면 먼저 생성해.
```

#### 예상 결과물

- `docs/prompts/parsing-agent.md` — Parsing Agent 시스템 프롬프트

#### 검증

- 출력 JSON 스키마가 requirements.md의 Contract JSON과 일치하는지 확인
- 6개 조항 유형이 모두 포함되었는지 확인

---

### Step 1.4: Search Agent 시스템 프롬프트 (D-06)

**소요**: 15m | **의존성**: requirements.md | **work-plan ID**: D-06

#### 작업 설명

Search Agent가 사용할 시스템 프롬프트를 작성한다. Bedrock KB의 retrieve_and_generate를 활용하여 계약 히스토리를 검색하고 출처 포함 답변을 생성한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/requirements.md의 "Agent 3: Search Agent" 섹션을 읽고, docs/prompts/search-agent.md를 생성해줘.

Search Agent 시스템 프롬프트야.

프롬프트 내용:
1. 역할 정의: "당신은 메가존클라우드의 계약 히스토리 검색 전문가입니다."
2. 작업 지시:
   - 사용자의 자연어 질의를 받아 과거 계약서 히스토리에서 관련 정보를 검색
   - Bedrock Knowledge Base에서 검색된 결과를 바탕으로 종합적인 답변 생성
3. 답변 규칙:
   - 반드시 출처(계약서 ID, 버전, 고객사명)를 포함
   - 검색 결과가 없으면 "관련 계약 이력을 찾지 못했습니다"로 응답
   - 추측하지 않고 검색된 근거만으로 답변
   - 시간순으로 변화 추이를 설명할 때는 버전 순서 명시
4. 출력 형식: requirements.md에 정의된 Search Agent 출력 JSON 스키마
5. 질의 예시:
   - "A사와의 계약에서 배상 조항 변화 추이"
   - "IP 이전 조항이 있었던 계약 목록"
   - "지체상금 0.1% 초과 계약"
```

#### 예상 결과물

- `docs/prompts/search-agent.md` — Search Agent 시스템 프롬프트

#### 검증

- 출력 JSON 스키마가 requirements.md와 일치하는지 확인

---

## 순차 그룹 B (Step 1.3 완료 후)

---

### Step 2.1: Legal Review Agent 시스템 프롬프트 (D-04)

**소요**: 30m | **의존성**: requirements.md, 표준 계약 텍스트 (H-05) | **work-plan ID**: D-04

#### 작업 설명

Legal Review Agent의 핵심 시스템 프롬프트. 계약 JSON을 분석하여 7가지 리스크 유형을 탐지하고, 조항별 리스크 레벨 + 수정 제안 + 재무 영향을 출력한다. 메가존 표준 계약 기준 텍스트가 있으면 포함, 없으면 일반적인 기준으로 작성.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/requirements.md의 "Agent 2: Legal Review Agent" 섹션을 읽고, docs/prompts/legal-agent.md를 생성해줘.

Legal Review Agent 시스템 프롬프트야. 이 프롬프트는 DynamoDB cas-prompt-templates 테이블에 저장되어 UI에서 수정 가능해야 해.

프롬프트 내용:
1. 역할 정의: "당신은 메가존클라우드의 법무 리스크 분석 전문가입니다. IT 서비스 계약(NDA, MSA, SI 도급, SLA, 유지보수 등)의 리스크를 분석합니다."

2. 리스크 탐지 기준 (7가지):
   | 리스크 유형 | 탐지 기준 | 기본 레벨 |
   | 무제한 배상책임 | 배상한도 미설정 또는 계약금액 초과 | HIGH |
   | IP 완전이전 | 개발 산출물 지재권 전부 이전 | HIGH |
   | 일방적 해지권 | 갑 단독 해지 + 위약금 없음 | HIGH |
   | 과도한 페널티 | 지체상금율 0.1%/일 초과 | MEDIUM |
   | 자동갱신 조건 | 갱신 거절 기한 미명시 | MEDIUM |
   | 분쟁 관할 불리 | 상대방 소재지 법원 | MEDIUM |
   | 비밀유지 기간 미정 | 계약 종료 후 기간 미명시 | LOW |

3. 분석 지시:
   - 입력: Parsing Agent가 출력한 Contract JSON
   - 각 조항(clause)마다 위 7가지 기준으로 검토
   - 리스크 발견 시: risk_level, risk_type, reason, recommendation, financial_impact 작성
   - overall_risk: 가장 높은 개별 리스크 레벨로 결정
   - standard_deviation: 메가존 표준 계약 대비 주요 차이점 서술
   - key_concerns: 가장 중요한 우려사항 3개 이내

4. 메가존 표준 기준 (기본값 — UI에서 수정 가능):
   - 배상한도: 계약금액의 100% 이내
   - 지체상금율: 0.05%/일 이내
   - IP: 공동 소유 또는 을의 기존 IP 제외
   - 해지: 양 당사자 서면 통지 30일 전
   - 비밀유지: 계약 종료 후 3년

5. 출력 형식: requirements.md에 정의된 Risk Report JSON 스키마

6. {project_context} 변수 자리 표시:
   프롬프트 마지막에 아래 블록 포함:
   ---
   ## 프로젝트 컨텍스트 (선택)
   {project_context}
   
   ## 프로젝트별 제약사항 (선택)
   {constraints}
   
   위 제약사항이 존재하면 반드시 반영하여 리스크를 평가하세요.
   ---
   (이 변수는 Plan A+의 프로젝트별 컨텍스트 기능에서 동적으로 주입됨. 없으면 빈 값.)
```

#### 예상 결과물

- `docs/prompts/legal-agent.md` — Legal Review Agent 시스템 프롬프트

#### 검증

- 7가지 리스크 유형이 모두 포함되었는지 확인
- Risk Report JSON 스키마와 출력 형식이 일치하는지 확인
- `{project_context}`, `{constraints}` 변수 자리표시 포함 확인

---

## 순차 그룹 C (Step 2.1 완료 후)

---

### Step 3.1: Legal Agent 계약유형별 프리셋 (D-05)

**소요**: 20m | **의존성**: D-04 (Legal Agent 기본 프롬프트) | **work-plan ID**: D-05

#### 작업 설명

Legal Agent의 기본 프롬프트 위에 계약 유형별 추가 검토 기준을 정의하는 프리셋 프롬프트. NDA, MSA, SI 3가지.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/legal-agent.md를 읽고, 계약 유형별 프리셋 프롬프트 3개를 생성해줘.

파일 위치: docs/prompts/legal-presets/ 디렉토리 생성 후:
1. docs/prompts/legal-presets/nda.md
2. docs/prompts/legal-presets/msa.md
3. docs/prompts/legal-presets/si.md

각 프리셋은 기본 프롬프트(legal-agent.md)의 탐지 기준에 **추가로** 적용될 유형별 특화 기준이야.

NDA 프리셋:
- 비밀정보 정의 범위 (너무 넓으면 MEDIUM)
- 비밀유지 의무 예외조항 존재 여부 (없으면 MEDIUM)
- 비밀유지 기간 (5년 초과 시 MEDIUM)
- 잔존조항 범위

MSA 프리셋:
- SLA 가동률 명시 여부 (미명시 시 MEDIUM)
- 유지보수 범위 및 응답시간 (미명시 시 LOW)
- 계약 갱신 조건 자동갱신 여부
- 하도급 허용 범위

SI 도급 프리셋:
- 산출물 인수 기준 및 검수 기간 (미명시 시 MEDIUM)
- 하자보수 기간 및 범위 (1년 미만 시 MEDIUM)
- 프로젝트 범위 변경(Change Request) 절차 (미명시 시 HIGH)
- 인력 투입 기준 변경 시 비용 정산

각 프리셋 파일 구조:
# {유형} 전용 리스크 분석 프리셋
> 기본 프롬프트(legal-agent.md) + 이 프리셋이 합쳐져서 적용됩니다.
## 추가 탐지 기준
(표 형식)
## 유형별 주의사항
```

#### 예상 결과물

- `docs/prompts/legal-presets/nda.md`
- `docs/prompts/legal-presets/msa.md`
- `docs/prompts/legal-presets/si.md`

#### 검증

- 각 프리셋이 기본 프롬프트와 중복 없이 **추가** 기준만 포함하는지 확인
- 리스크 레벨 기준이 합리적인지 확인

---

### Step 3.2: DynamoDB 시드 데이터 JSON (D-07)

**소요**: 10m | **의존성**: D-04, D-05 | **work-plan ID**: D-07

#### 작업 설명

위에서 작성한 프롬프트들을 DynamoDB `cas-prompt-templates` 테이블에 투입할 수 있는 JSON 형태로 정리한다. 해커톤 당일 Guide 03에서 이 파일을 사용하여 시드 데이터를 투입한다.

#### AI 프롬프트 (Claude Code에 복붙)

```
docs/prompts/legal-agent.md와 docs/prompts/legal-presets/ 하위 3개 파일을 읽고,
docs/prompts/seed-data.json을 생성해줘.

DynamoDB cas-prompt-templates 테이블에 batch write할 JSON 배열이야.
각 프롬프트 내용을 system_prompt 필드에 넣어.

스키마:
[
  {
    "id": "prompt_default",
    "prompt_name": "기본 리스크 분석",
    "contract_type": null,
    "system_prompt": "(legal-agent.md 내용 전체)",
    "updated_at": "2026-05-03T00:00:00Z",
    "updated_by": "system"
  },
  {
    "id": "prompt_nda",
    "prompt_name": "NDA 전용 분석",
    "contract_type": "NDA",
    "system_prompt": "(nda.md 프리셋 내용)",
    "updated_at": "2026-05-03T00:00:00Z",
    "updated_by": "system"
  },
  {
    "id": "prompt_msa",
    "prompt_name": "MSA 전용 분석",
    "contract_type": "MSA",
    "system_prompt": "(msa.md 프리셋 내용)",
    "updated_at": "2026-05-03T00:00:00Z",
    "updated_by": "system"
  },
  {
    "id": "prompt_si",
    "prompt_name": "SI 도급 전용 분석",
    "contract_type": "SI",
    "system_prompt": "(si.md 프리셋 내용)",
    "updated_at": "2026-05-03T00:00:00Z",
    "updated_by": "system"
  }
]

system_prompt 안의 마크다운은 이스케이프 처리해서 유효한 JSON이 되게 해줘.
```

#### 예상 결과물

- `docs/prompts/seed-data.json` — DynamoDB 시드 데이터 (프롬프트 4건)

#### 검증

```bash
python3 -c "import json; d=json.load(open('docs/prompts/seed-data.json')); print(f'{len(d)}건, IDs: {[x[\"id\"] for x in d]}')"
```

> 예상 출력: `4건, IDs: ['prompt_default', 'prompt_nda', 'prompt_msa', 'prompt_si']`

---

## 완료 체크리스트

- [ ] `docs/service-plan.md` — 서비스 기획안 (제출물 #4)
- [ ] `docs/architecture.md` — 아키텍처 설계서 (제출물 #3)
- [ ] `docs/prompts/parsing-agent.md` — Parsing Agent 시스템 프롬프트
- [ ] `docs/prompts/search-agent.md` — Search Agent 시스템 프롬프트
- [ ] `docs/prompts/legal-agent.md` — Legal Review Agent 시스템 프롬프트
- [ ] `docs/prompts/legal-presets/nda.md` — NDA 프리셋
- [ ] `docs/prompts/legal-presets/msa.md` — MSA 프리셋
- [ ] `docs/prompts/legal-presets/si.md` — SI 프리셋
- [ ] `docs/prompts/seed-data.json` — DynamoDB 시드 데이터

---

## 다음 가이드

→ **Guide 03: 프로젝트 초기화** (`guide-03-init.md`)
