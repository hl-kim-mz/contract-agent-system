// lib/api/risk-reports.ts

export type RiskType =
  | '무제한_배상책임'
  | 'IP_완전이전'
  | '일방적_해지권'
  | 'CR_절차_미정의'
  | '과도한_지체상금'
  | '자동갱신_조건'
  | '분쟁_관할_불리'
  | '하자보수_기간_미달'
  | '비밀유지_기간_미정'
  | '기타';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ClauseRisk {
  clause_id: string;
  risk_level: RiskLevel;
  risk_type: RiskType;
  reason: string;
  recommendation: string;
  financial_impact: string;
}

export interface RiskReport {
  id: string;
  contract_id: string;
  overall_risk: RiskLevel;
  is_standard_contract: boolean;
  risk_summary: string;
  clause_risks: ClauseRisk[];
  key_concerns: string[];
  standard_deviation: string | null;
  escalation_required: boolean;
  created_at: string;
}

export interface WorkflowStep {
  id: string;
  step_order: number;
  department: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment: string | null;
  signed_at: string | null;
}

export interface ContractDetail {
  id: string;
  customer_name: string;
  contract_type: string;
  version: number;
  status: string;
  file_name: string;
  uploaded_at: string;
  uploaded_by: string;
  total_amount: number | null;
  parties: {
    party_a: { name: string; representative: string | null };
    party_b: { name: string; representative: string | null };
  } | null;
  dates: {
    contract_date: string | null;
    start_date: string | null;
    end_date: string | null;
  } | null;
}

// ─── Mock 데이터 ─────────────────────────────────────────────────
const MOCK_DETAILS: Record<string, ContractDetail> = {
  ctr_001: {
    id: 'ctr_001',
    customer_name: '주식회사 A사',
    contract_type: 'SI',
    version: 2,
    status: 'RISK_REVIEWED',
    file_name: 'A사_SI도급계약서_v2.docx',
    uploaded_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    uploaded_by: '김영업',
    total_amount: 2000000000,
    parties: {
      party_a: { name: '주식회사 A사', representative: '홍길동' },
      party_b: { name: '메가존클라우드 주식회사', representative: '이주완' },
    },
    dates: { contract_date: '2026-05-30', start_date: '2026-06-01', end_date: '2026-12-31' },
  },
  ctr_002: {
    id: 'ctr_002', customer_name: '주식회사 B사', contract_type: 'NDA', version: 1,
    status: 'APPROVED', file_name: 'B사_비밀유지계약서_v1.docx',
    uploaded_at: new Date(Date.now() - 86400000).toISOString(), uploaded_by: '박대리',
    total_amount: null,
    parties: { party_a: { name: '주식회사 B사', representative: '김철수' }, party_b: { name: '메가존클라우드 주식회사', representative: '이주완' } },
    dates: { contract_date: '2026-05-01', start_date: null, end_date: null },
  },
};

const MOCK_REPORTS: Record<string, RiskReport> = {
  ctr_001: {
    id: 'rep_001',
    contract_id: 'ctr_001',
    overall_risk: 'HIGH',
    is_standard_contract: false,
    risk_summary: '비표준 SI 도급 계약서로 무제한 배상책임, IP 완전이전, CR 절차 미정의 등 HIGH 리스크 3건이 탐지되었습니다. 계약팀·법무팀·본부장 3단계 검토 및 에스컬레이션이 필요합니다.',
    clause_risks: [
      {
        clause_id: 'clause_003',
        risk_level: 'HIGH',
        risk_type: '무제한_배상책임',
        reason: '제3조에서 "배상액의 상한은 없으며 간접손해를 포함한다"고 명시하여 배상한도가 설정되지 않았습니다. MZC 기준은 계약금액(20억) 100% 이하 한도를 요구합니다.',
        recommendation: '제3조에 "을의 배상책임은 계약금액의 100%를 초과하지 않으며, 간접손해 및 결과적 손해는 배상 범위에서 제외한다" 조항 삽입을 요청합니다.',
        financial_impact: '배상한도 미설정 시 프로젝트 실패 또는 분쟁 발생 시 계약금액을 초과하는 손해배상 청구에 무방비로 노출됩니다.',
      },
      {
        clause_id: 'clause_002',
        risk_level: 'HIGH',
        risk_type: 'IP_완전이전',
        reason: '제2조에서 "개발된 소프트웨어, 소스코드 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다"고 명시합니다. 기존 MZC 보유 기술·라이브러리 제외 조건이 없습니다.',
        recommendation: '제2조에 "단, 계약 체결 전 을이 보유한 기존 기술, 라이브러리, 프레임워크는 귀속 대상에서 제외하며 해당 부분은 비독점 라이선스 형태로 갑에게 제공한다" 조항 추가를 요청합니다.',
        financial_impact: 'MZC 핵심 기술 자산이 고객사에 이전되면 향후 유사 프로젝트 수행 시 지재권 분쟁 및 기술 경쟁력 약화로 이어질 수 있습니다.',
      },
      {
        clause_id: 'clause_005',
        risk_level: 'HIGH',
        risk_type: 'CR_절차_미정의',
        reason: '제5조에서 "갑은 언제든지 용역 범위를 변경할 수 있으며 을은 즉시 응하여야 한다"고 명시하나, 서면 합의 절차, 추가 비용 정산 기준, 일정 조정 방법이 전혀 명시되어 있지 않습니다.',
        recommendation: '제5조를 "용역 범위 변경은 양 당사자의 서면 합의로 처리하며, 변경으로 인한 추가 비용 및 일정은 별도 변경계약서를 통해 정산한다"로 수정 요청합니다.',
        financial_impact: 'CR 절차 미정의 시 무제한적인 범위 추가로 인해 수익성 악화 및 프로젝트 일정 지연이 발생할 수 있으며, 추가 비용 청구 근거가 없어집니다.',
      },
      {
        clause_id: 'clause_004',
        risk_level: 'MEDIUM',
        risk_type: '과도한_지체상금',
        reason: '제4조에서 지체상금율을 "계약금액의 0.15%/일"로 명시합니다. MZC 표준 기준(0.05%/일)의 3배이며, 지체상금 총액 한도 조항도 없습니다.',
        recommendation: '제4조를 "지체상금율은 계약금액의 0.05%/일로 하며, 지체상금 총액은 계약금액의 10%를 초과하지 않는다"로 수정 요청합니다.',
        financial_impact: '30일 지체 시 현행 조건으로 9억원(20억 × 0.15% × 30일) 규모의 지체상금이 발생합니다.',
      },
      {
        clause_id: 'clause_006',
        risk_level: 'MEDIUM',
        risk_type: '분쟁_관할_불리',
        reason: '제6조에서 "갑의 소재지를 관할하는 법원을 전속 관할"로 지정합니다.',
        recommendation: '제6조를 "본 계약과 관련한 분쟁은 서울중앙지방법원을 전속 관할 법원으로 한다"로 수정 요청합니다.',
        financial_impact: '관할 불리 시 소송 비용 증가 및 법적 대응 지연이 발생할 수 있습니다.',
      },
    ],
    key_concerns: [
      '배상한도 미설정 — 계약금액(20억) 초과 무제한 손해배상 청구 가능',
      'IP 전부 이전 — MZC 기존 기술 자산 몰수 가능성',
      'CR 절차 미정의 — 무제한 범위 추가 강요 및 추가 비용 청구 불가',
    ],
    standard_deviation: '비표준 고객사 양식으로 배상한도, 기존 IP 제외, CR 절차, 지체상금율이 MZC 표준과 상이합니다.',
    escalation_required: true,
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  ctr_002: {
    id: 'rep_002', contract_id: 'ctr_002', overall_risk: 'LOW',
    is_standard_contract: false, escalation_required: false,
    risk_summary: '비밀유지 기간이 명확히 명시되어 있으며 MZC 기준에 부합하는 계약서입니다. 전반적인 리스크가 낮아 영업팀 자체 승인이 가능합니다.',
    clause_risks: [
      {
        clause_id: 'clause_004',
        risk_level: 'LOW',
        risk_type: '비밀유지_기간_미정',
        reason: '비밀유지 기간이 "계약 종료 후 2년"으로 명시되어 있으나, MZC 표준(3년)보다 짧습니다.',
        recommendation: '비밀유지 기간을 "계약 종료 후 3년"으로 연장 요청을 검토하시기 바랍니다.',
        financial_impact: '비밀유지 기간이 짧을 경우 정보 유출 시 법적 구제 범위가 제한될 수 있습니다.',
      },
    ],
    key_concerns: ['비밀유지 기간 MZC 표준(3년) 대비 1년 부족'],
    standard_deviation: '전반적으로 MZC 표준에 부합하나 비밀유지 기간이 다소 짧습니다.',
    created_at: new Date(Date.now() - 86000000).toISOString(),
  },
};

const MOCK_WORKFLOW: Record<string, WorkflowStep[]> = {
  ctr_001: [
    { id: 'wf_001', step_order: 1, department: '계약팀', role: '검토자', status: 'PENDING', comment: null, signed_at: null },
    { id: 'wf_002', step_order: 2, department: '법무팀', role: '검토자', status: 'PENDING', comment: null, signed_at: null },
    { id: 'wf_003', step_order: 3, department: '본부장', role: '최종승인', status: 'PENDING', comment: null, signed_at: null },
    { id: 'wf_004', step_order: 4, department: '재무팀', role: '병렬검토', status: 'PENDING', comment: null, signed_at: null },
  ],
  ctr_002: [
    { id: 'wf_010', step_order: 1, department: '영업팀', role: '자체승인', status: 'APPROVED', comment: '이상 없음. 승인합니다.', signed_at: new Date(Date.now() - 80000000).toISOString() },
  ],
};

// ─── API 함수 ─────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function getContractDetail(id: string): Promise<ContractDetail> {
  if (USE_MOCK) {
    await delay(200);
    const d = MOCK_DETAILS[id];
    if (!d) throw new Error('Contract not found');
    return d;
  }
  const res = await fetch(`${API_BASE}/contracts/${id}`);
  return res.json();
}

export async function getRiskReport(contractId: string): Promise<RiskReport | null> {
  if (USE_MOCK) {
    await delay(300);
    return MOCK_REPORTS[contractId] ?? null;
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/report`);
  if (res.status === 404) return null;
  return res.json();
}

export async function getWorkflowSteps(contractId: string): Promise<WorkflowStep[]> {
  if (USE_MOCK) {
    await delay(150);
    return MOCK_WORKFLOW[contractId] ?? [];
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/workflow`);
  return res.json();
}

export async function approveStep(stepId: string, comment: string): Promise<WorkflowStep> {
  if (USE_MOCK) {
    await delay(500);
    for (const steps of Object.values(MOCK_WORKFLOW)) {
      const s = steps.find(x => x.id === stepId);
      if (s) { s.status = 'APPROVED'; s.comment = comment; s.signed_at = new Date().toISOString(); return { ...s }; }
    }
    throw new Error('Step not found');
  }
  const res = await fetch(`${API_BASE}/workflow/${stepId}/approve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment }),
  });
  return res.json();
}

// ─── Diff 타입 ────────────────────────────────────────────────────
export type DiffChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface ClauseDiff {
  clause_id: string;
  title: string;
  change_type: DiffChangeType;
  previous_content: string | null;
  current_content: string;
  risk_impact: '리스크 증가' | '리스크 감소' | '중립' | null;
  highlight: string | null;
}

export interface DiffReport {
  from_version: number;
  to_version: number;
  diff_summary: string;
  risk_change: 'HIGH→HIGH' | 'LOW→HIGH' | 'MEDIUM→HIGH' | 'HIGH→MEDIUM' | 'LOW→MEDIUM' | '동일' | '개선';
  changes: ClauseDiff[];
}

const MOCK_DIFF: Record<string, DiffReport> = {
  ctr_001: {
    from_version: 1,
    to_version: 2,
    diff_summary: '지체상금율이 0.1%/일에서 0.15%/일로 인상되었고, 변경요청(CR) 관련 조항이 신규 추가되었습니다. 배상책임 조항의 표현이 더 불리하게 수정되었습니다.',
    risk_change: 'MEDIUM→HIGH',
    changes: [
      {
        clause_id: 'clause_003',
        title: '제3조 (손해배상)',
        change_type: 'MODIFIED',
        previous_content: '을의 귀책사유로 인하여 갑에게 손해가 발생한 경우, 을은 그 손해를 배상하여야 한다.',
        current_content: '을의 귀책사유로 인하여 갑에게 손해가 발생한 경우, 을은 그 손해의 전부를 배상하여야 한다. 배상액의 상한은 없으며 간접손해 및 영업손실을 포함한다.',
        risk_impact: '리스크 증가',
        highlight: '"배상액의 상한은 없으며 간접손해 및 영업손실을 포함한다" 문구 추가 — 무제한 배상책임으로 변경',
      },
      {
        clause_id: 'clause_004',
        title: '제4조 (지체상금)',
        change_type: 'MODIFIED',
        previous_content: '을이 납기일까지 용역을 완료하지 못하는 경우 지체일수 1일당 계약금액의 0.1%에 해당하는 지체상금을 갑에게 지급한다.',
        current_content: '을이 납기일까지 용역을 완료하지 못하는 경우 지체일수 1일당 계약금액의 0.15%에 해당하는 지체상금을 갑에게 지급한다.',
        risk_impact: '리스크 증가',
        highlight: '지체상금율 0.1%/일 → 0.15%/일로 인상 (MZC 기준 0.05% 초과)',
      },
      {
        clause_id: 'clause_005',
        title: '제5조 (변경요청)',
        change_type: 'ADDED',
        previous_content: null,
        current_content: '갑은 계약 체결 후 언제든지 용역의 범위를 변경할 수 있으며, 을은 이에 즉시 응하여야 한다.',
        risk_impact: '리스크 증가',
        highlight: 'CR 절차 조항 신규 삽입 — 서면 합의 및 비용 정산 기준 없음',
      },
      {
        clause_id: 'clause_001',
        title: '제1조 (목적)',
        change_type: 'UNCHANGED',
        previous_content: '본 계약은 갑이 발주하는 차세대 클라우드 플랫폼 구축의 개발 용역에 관한 제반 사항을 정함을 목적으로 한다.',
        current_content: '본 계약은 갑이 발주하는 차세대 클라우드 플랫폼 구축의 개발 용역에 관한 제반 사항을 정함을 목적으로 한다.',
        risk_impact: null,
        highlight: null,
      },
      {
        clause_id: 'clause_002',
        title: '제2조 (지식재산권)',
        change_type: 'UNCHANGED',
        previous_content: '본 계약에 의하여 개발된 소프트웨어, 소스코드 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다.',
        current_content: '본 계약에 의하여 개발된 소프트웨어, 소스코드 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다.',
        risk_impact: null,
        highlight: null,
      },
    ],
  },
};

export async function getDiffReport(contractId: string): Promise<DiffReport | null> {
  if (USE_MOCK) {
    await delay(250);
    return MOCK_DIFF[contractId] ?? null;
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/diff`);
  if (res.status === 404) return null;
  return res.json();
}

// ─── 검색 ────────────────────────────────────────────────────────
export interface SearchResult {
  answer: string;
  sources: { contract_id: string; customer_name: string; version: number; clause_content: string }[];
}

export async function searchHistory(query: string, customerName?: string): Promise<SearchResult> {
  if (USE_MOCK) {
    await delay(800);
    return {
      answer: `"${query}"에 대한 검색 결과입니다. 과거 A사 계약(v1)에서 CR 절차는 "서면 합의 후 추가 비용 정산" 방식으로 처리되었습니다. 당시 지체상금율은 0.1%/일이었으며 배상한도는 계약금액의 100%로 설정되어 있었습니다.`,
      sources: [
        { contract_id: 'ctr_001', customer_name: customerName ?? 'A사', version: 1, clause_content: '용역 범위 변경은 양 당사자의 서면 합의로 처리하며, 추가 비용은 별도 계약으로 정산한다.' },
      ],
    };
  }
  const params = new URLSearchParams({ query });
  if (customerName) params.append('customer', customerName);
  const res = await fetch(`${API_BASE}/search?${params}`);
  return res.json();
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────
export const RISK_LEVEL_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  HIGH:   { label: 'HIGH',   color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  MEDIUM: { label: 'MED',    color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  LOW:    { label: 'LOW',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
};

export const RISK_TYPE_LABEL: Record<string, string> = {
  '무제한_배상책임': '무제한 배상책임',
  'IP_완전이전':    'IP 완전이전',
  '일방적_해지권':  '일방적 해지권',
  'CR_절차_미정의': 'CR 절차 미정의',
  '과도한_지체상금': '과도한 지체상금',
  '자동갱신_조건':  '자동갱신 조건',
  '분쟁_관할_불리': '분쟁 관할 불리',
  '하자보수_기간_미달': '하자보수 기간 미달',
  '비밀유지_기간_미정': '비밀유지 기간 미정',
  '기타': '기타',
};

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
