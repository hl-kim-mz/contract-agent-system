// lib/api/risk-report.ts
// Feature: 리스크 리포트 화면 (/contracts/:id — 리스크 리포트 탭)
// Screen: ContractDetailPage > tab='report'

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

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

// ─── Mock ─────────────────────────────────────────────────────────
const MOCK: Record<string, RiskReport> = {
  ctr_001: {
    id: 'rep_001', contract_id: 'ctr_001',
    overall_risk: 'HIGH', is_standard_contract: false, escalation_required: true,
    risk_summary: '비표준 SI 도급 계약서로 무제한 배상책임, IP 완전이전, CR 절차 미정의 등 HIGH 리스크 3건이 탐지되었습니다. 계약팀·법무팀·본부장 3단계 검토 및 에스컬레이션이 필요합니다.',
    clause_risks: [
      { clause_id: 'clause_003', risk_level: 'HIGH', risk_type: '무제한_배상책임',
        reason: '제3조에서 "배상액의 상한은 없으며 간접손해를 포함한다"고 명시하여 배상한도가 설정되지 않았습니다.',
        recommendation: '제3조에 "을의 배상책임은 계약금액의 100%를 초과하지 않으며, 간접손해는 배상 범위에서 제외한다" 조항 삽입을 요청합니다.',
        financial_impact: '배상한도 미설정 시 계약금액을 초과하는 손해배상 청구에 무방비로 노출됩니다.' },
      { clause_id: 'clause_002', risk_level: 'HIGH', risk_type: 'IP_완전이전',
        reason: '제2조에서 "일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다"고 명시. 기존 MZC 보유 기술 제외 조건 없음.',
        recommendation: '"기존 MZC 보유 기술은 귀속 대상에서 제외하며 비독점 라이선스로 제공한다" 조항 추가 요청.',
        financial_impact: 'MZC 핵심 기술 자산이 이전되면 향후 지재권 분쟁 및 기술 경쟁력 약화 우려.' },
      { clause_id: 'clause_005', risk_level: 'HIGH', risk_type: 'CR_절차_미정의',
        reason: '제5조 "갑은 언제든지 용역 범위를 변경할 수 있으며 을은 즉시 응하여야 한다" — 서면 합의 절차, 추가 비용 정산 기준 없음.',
        recommendation: '"범위 변경은 양 당사자 서면 합의로 처리하며 추가 비용·일정은 별도 변경계약서로 정산한다"로 수정 요청.',
        financial_impact: 'CR 절차 미정의 시 무제한 범위 추가로 수익성 악화 및 추가 비용 청구 근거 소멸.' },
      { clause_id: 'clause_004', risk_level: 'MEDIUM', risk_type: '과도한_지체상금',
        reason: '지체상금율 0.15%/일 — MZC 기준(0.05%/일)의 3배, 총액 한도 조항 없음.',
        recommendation: '"지체상금율 0.05%/일 이하, 총액 계약금액의 10% 이하"로 수정 요청.',
        financial_impact: '30일 지체 시 9억원(20억×0.15%×30일) 규모 지체상금 발생.' },
      { clause_id: 'clause_006', risk_level: 'MEDIUM', risk_type: '분쟁_관할_불리',
        reason: '"갑의 소재지를 관할하는 법원을 전속 관할"로 지정. MZC 과천 소재지 기준으로 불리.',
        recommendation: '"서울중앙지방법원을 전속 관할 법원으로 한다"로 수정 요청.',
        financial_impact: '관할 불리 시 소송 비용 증가 및 법적 대응 지연.' },
    ],
    key_concerns: [
      '배상한도 미설정 — 계약금액(20억) 초과 무제한 손해배상 청구 가능',
      'IP 전부 이전 — MZC 기존 기술 자산 몰수 가능성',
      'CR 절차 미정의 — 무제한 범위 추가 강요 및 추가 비용 청구 불가',
    ],
    standard_deviation: '비표준 고객사 양식으로 배상한도, IP 제외, CR 절차, 지체상금율이 MZC 표준과 상이.',
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  ctr_002: {
    id: 'rep_002', contract_id: 'ctr_002',
    overall_risk: 'LOW', is_standard_contract: false, escalation_required: false,
    risk_summary: '비밀유지 기간이 명확히 명시되어 있으며 MZC 기준에 대체로 부합. 전반적 리스크 낮음.',
    clause_risks: [
      { clause_id: 'clause_004', risk_level: 'LOW', risk_type: '비밀유지_기간_미정',
        reason: '비밀유지 기간이 "계약 종료 후 2년"으로 명시. MZC 표준(3년)보다 짧음.',
        recommendation: '비밀유지 기간을 "계약 종료 후 3년"으로 연장 요청 검토.',
        financial_impact: '기간이 짧을 경우 정보 유출 시 법적 구제 범위 제한.' },
    ],
    key_concerns: ['비밀유지 기간 MZC 표준(3년) 대비 1년 부족'],
    standard_deviation: '전반적으로 MZC 표준에 부합하나 비밀유지 기간이 다소 짧음.',
    created_at: new Date(Date.now() - 86000000).toISOString(),
  },
};

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── API 함수 ─────────────────────────────────────────────────────

/** 리스크 리포트 조회 — GET /contracts/:id/report */
export async function getRiskReport(contractId: string): Promise<RiskReport | null> {
  if (USE_MOCK) { await delay(300); return MOCK[contractId] ?? null; }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/report`);
  if (res.status === 404) return null;
  const json = await res.json();
  return json.data as RiskReport;
}

// ─── 표시 헬퍼 ───────────────────────────────────────────────────
/** 표시용 — 유형 배지와 동일한 중립 톤(화면에서 테두리·강조색 미사용) */
export const RISK_LEVEL_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  HIGH:   { label: 'HIGH', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
  MEDIUM: { label: 'MED',  color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
  LOW:    { label: 'LOW',  color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
};

export const RISK_TYPE_LABEL: Record<string, string> = {
  '무제한_배상책임':    '무제한 배상책임',
  'IP_완전이전':       'IP 완전이전',
  '일방적_해지권':     '일방적 해지권',
  'CR_절차_미정의':    'CR 절차 미정의',
  '과도한_지체상금':   '과도한 지체상금',
  '자동갱신_조건':     '자동갱신 조건',
  '분쟁_관할_불리':    '분쟁 관할 불리',
  '하자보수_기간_미달': '하자보수 기간 미달',
  '비밀유지_기간_미정': '비밀유지 기간 미정',
  '기타':             '기타',
};

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
