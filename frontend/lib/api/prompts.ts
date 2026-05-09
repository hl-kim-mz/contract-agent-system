// ─────────────────────────────────────────────────────────────────
// lib/api/prompts.ts
// API 함수 레이어 — Mock ↔ Real API 전환 포인트
// ─────────────────────────────────────────────────────────────────

export type ContractType = 'NDA' | 'MSA' | 'SI' | 'SLA' | 'Maintenance' | 'Outsourcing' | null;

export interface PromptTemplate {
  id: string;
  prompt_name: string;
  contract_type: ContractType;
  system_prompt: string;
  updated_at: string;
  updated_by: string;
}

// ─── Mock 데이터 ─────────────────────────────────────────────────
const mockPrompts: PromptTemplate[] = [
  {
    id: 'prompt_default',
    prompt_name: '기본 리스크 분석',
    contract_type: null,
    system_prompt: `당신은 메가존클라우드(MZC) 전속 계약 리스크 분석 AI입니다.
입력으로 계약서 구조화 JSON(Contract JSON)을 받아, MZC 내부 기준에 따라 리스크를 탐지하고
Risk Report JSON을 반환하는 것이 유일한 역할입니다.

[역할 원칙]
- 당신의 판단은 계약팀 검토를 위한 참고 자료입니다. 최종 법적 판단은 계약팀이 수행합니다.
- MZC가 이미 허용한 표준 조항을 위험으로 분류하지 마십시오 (오탐 방지).
- 원문에 근거 없는 리스크를 추가하지 마십시오.
- 출력은 반드시 유효한 JSON만 반환합니다.

[MZC 표준 기준값]
- 배상한도: 계약금액의 100% 이내 명시 → NONE
- 지체상금율: 0.05%/일 이하 → NONE
- 해지 사전통지: 양 당사자 모두 서면 30일 전 + 위약금 조건 → NONE
- 비밀유지 기간: 구체적으로 명시된 경우 → NONE
- 하자보수 기간: 1년 이상 명시 (SI 계약) → NONE`,
    updated_at: '2026-05-09T10:30:00Z',
    updated_by: 'system',
  },
  {
    id: 'prompt_nda',
    prompt_name: 'NDA 전용 분석',
    contract_type: 'NDA',
    system_prompt: `당신은 메가존클라우드(MZC) NDA 계약서 전용 리스크 분석 AI입니다.

[NDA 특화 분석 기준]
- 비밀유지 기간이 구체적으로 명시되어 있는지 확인합니다. (MZC 표준: 계약 종료 후 3년)
- 비밀정보의 범위가 명확하게 정의되어 있는지 확인합니다.
- 양 당사자 모두에게 동등한 의무가 부여되어 있는지 확인합니다.
- IP 관련 조항: NDA에서는 IP 완전이전 탐지를 생략합니다.
- CR 절차, 하자보수 탐지를 생략합니다.

[우선 탐지 항목]
1. 비밀유지_기간_미정 (LOW)
2. 무제한_배상책임 (HIGH)
3. 일방적_해지권 (HIGH)
4. 분쟁_관할_불리 (MEDIUM)
5. 자동갱신_조건 (MEDIUM)`,
    updated_at: '2026-05-09T09:15:00Z',
    updated_by: 'lkwoo',
  },
  {
    id: 'prompt_msa',
    prompt_name: 'MSA 전용 분석',
    contract_type: 'MSA',
    system_prompt: `당신은 메가존클라우드(MZC) MSA(기본계약서) 전용 리스크 분석 AI입니다.

[MSA 특화 분석 기준]
- MSA는 이후 체결될 개별계약의 기본 조건을 정하는 계약입니다.
- 배상한도, IP 귀속, 해지 조건을 중점적으로 분석합니다.
- 전체 계약 관계에 영향을 미치는 포괄적 조항에 집중합니다.

[우선 탐지 항목]
1. 무제한_배상책임 (HIGH) — 전체 개별계약에 영향
2. IP_완전이전 (HIGH) — 모든 개발 결과물에 적용
3. 일방적_해지권 (HIGH) — 전체 관계 종료
4. 자동갱신_조건 (MEDIUM)
5. 분쟁_관할_불리 (MEDIUM)
6. 비밀유지_기간_미정 (LOW)`,
    updated_at: '2026-05-09T09:00:00Z',
    updated_by: 'lkwoo',
  },
  {
    id: 'prompt_si',
    prompt_name: 'SI 도급 전용 분석',
    contract_type: 'SI',
    system_prompt: `당신은 메가존클라우드(MZC) SI 도급 계약서 전용 리스크 분석 AI입니다.

[SI 특화 분석 기준]
- SI 계약에서 CR(변경요청) 절차와 하자보수 기간은 필수 탐지 항목입니다.
- 지체상금율 기준: 0.05%/일 이하 → NONE (초과 시 MEDIUM)
- 하자보수 기간: 시스템 인수 후 1년 이상 → NONE

[MZC 표준 기준값 (SI 전용)]
- 지체상금율: 0.05%/일 이하
- 하자보수: 인수 후 1년 이상 무상
- CR 절차: 서면 합의 + 추가 비용/일정 정산 기준 명시 필수
- IP 귀속: 기존 보유 지재권 제외 조건 필수

[우선 탐지 항목 — SI 전용]
1. CR_절차_미정의 (HIGH) ← SI 전용
2. 무제한_배상책임 (HIGH)
3. IP_완전이전 (HIGH)
4. 일방적_해지권 (HIGH)
5. 과도한_지체상금 (MEDIUM)
6. 하자보수_기간_미달 (MEDIUM) ← SI 전용
7. 분쟁_관할_불리 (MEDIUM)
8. 자동갱신_조건 (MEDIUM)
9. 비밀유지_기간_미정 (LOW)`,
    updated_at: '2026-05-09T08:45:00Z',
    updated_by: 'lkwoo',
  },
];

// ─── API 환경 설정 ────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

// ─── API 함수 (Mock ↔ Real 전환 포인트) ───────────────────────────

/** 프롬프트 목록 조회 */
export async function getPrompts(): Promise<PromptTemplate[]> {
  if (USE_MOCK) {
    await delay(300);
    return [...mockPrompts];
  }
  const res = await fetch(`${API_BASE}/prompts`);
  const json = await res.json();
  return json.data as PromptTemplate[];
}

/** 단건 조회 */
export async function getPrompt(id: string): Promise<PromptTemplate> {
  if (USE_MOCK) {
    await delay(100);
    const found = mockPrompts.find((p) => p.id === id);
    if (!found) throw new Error(`Prompt not found: ${id}`);
    return { ...found };
  }
  const res = await fetch(`${API_BASE}/prompts/${id}`);
  const json = await res.json();
  return json.data as PromptTemplate;
}

/** 저장 (PUT) */
export async function updatePrompt(
  id: string,
  payload: Pick<PromptTemplate, 'prompt_name' | 'system_prompt' | 'contract_type'>
): Promise<PromptTemplate> {
  if (USE_MOCK) {
    await delay(600);
    const idx = mockPrompts.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Prompt not found: ${id}`);
    mockPrompts[idx] = {
      ...mockPrompts[idx],
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: 'demo_user',
    };
    return { ...mockPrompts[idx] };
  }
  const res = await fetch(`${API_BASE}/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return json.data as PromptTemplate;
}

/** 신규 생성 (POST) */
export async function createPrompt(
  payload: Pick<PromptTemplate, 'prompt_name' | 'system_prompt' | 'contract_type'>
): Promise<PromptTemplate> {
  if (USE_MOCK) {
    await delay(400);
    const newPrompt: PromptTemplate = {
      id: `prompt_${Date.now()}`,
      ...payload,
      updated_at: new Date().toISOString(),
      updated_by: 'demo_user',
    };
    mockPrompts.push(newPrompt);
    return { ...newPrompt };
  }
  const res = await fetch(`${API_BASE}/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  return json.data as PromptTemplate;
}

// ─── 유틸 ─────────────────────────────────────────────────────────
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
