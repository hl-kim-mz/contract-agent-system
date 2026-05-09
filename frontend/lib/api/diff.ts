// lib/api/diff.ts
// Feature: 버전 비교(Diff) 화면 (/contracts/:id — 버전 비교 탭)
// Screen: ContractDetailPage > tab='diff'

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
  risk_change: string; // e.g. 'MEDIUM→HIGH'
  changes: ClauseDiff[];
}

// ─── Mock ─────────────────────────────────────────────────────────
const MOCK: Record<string, DiffReport> = {
  ctr_001: {
    from_version: 1, to_version: 2,
    diff_summary: '지체상금율이 0.1%→0.15%/일로 인상되었고, CR 조항이 신규 추가되었습니다. 배상책임 조항 표현이 더 불리하게 수정되었습니다.',
    risk_change: 'MEDIUM→HIGH',
    changes: [
      {
        clause_id: 'clause_003', title: '제3조 (손해배상)',
        change_type: 'MODIFIED',
        previous_content: '을의 귀책사유로 인하여 갑에게 손해가 발생한 경우, 을은 그 손해를 배상하여야 한다.',
        current_content:  '을의 귀책사유로 인하여 갑에게 손해가 발생한 경우, 을은 그 손해의 전부를 배상하여야 한다. 배상액의 상한은 없으며 간접손해 및 영업손실을 포함한다.',
        risk_impact: '리스크 증가',
        highlight: '"배상액의 상한은 없으며 간접손해 포함" 문구 추가 → 무제한 배상책임으로 변경',
      },
      {
        clause_id: 'clause_004', title: '제4조 (지체상금)',
        change_type: 'MODIFIED',
        previous_content: '지체일수 1일당 계약금액의 0.1%에 해당하는 지체상금을 갑에게 지급한다.',
        current_content:  '지체일수 1일당 계약금액의 0.15%에 해당하는 지체상금을 갑에게 지급한다.',
        risk_impact: '리스크 증가',
        highlight: '지체상금율 0.1%→0.15%/일 인상 (MZC 기준 0.05% 초과)',
      },
      {
        clause_id: 'clause_005', title: '제5조 (변경요청)',
        change_type: 'ADDED',
        previous_content: null,
        current_content:  '갑은 계약 체결 후 언제든지 용역의 범위를 변경할 수 있으며, 을은 이에 즉시 응하여야 한다.',
        risk_impact: '리스크 증가',
        highlight: 'CR 절차 조항 신규 삽입 — 서면 합의·비용 정산 기준 없음',
      },
      {
        clause_id: 'clause_001', title: '제1조 (목적)',
        change_type: 'UNCHANGED',
        previous_content: '본 계약은 갑이 발주하는 차세대 클라우드 플랫폼 구축의 개발 용역에 관한 제반 사항을 정함을 목적으로 한다.',
        current_content:  '본 계약은 갑이 발주하는 차세대 클라우드 플랫폼 구축의 개발 용역에 관한 제반 사항을 정함을 목적으로 한다.',
        risk_impact: null, highlight: null,
      },
      {
        clause_id: 'clause_002', title: '제2조 (지식재산권)',
        change_type: 'UNCHANGED',
        previous_content: '본 계약에 의하여 개발된 소프트웨어, 소스코드 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다.',
        current_content:  '본 계약에 의하여 개발된 소프트웨어, 소스코드 등 일체의 지식재산권은 납품과 동시에 갑에게 완전히 귀속된다.',
        risk_impact: null, highlight: null,
      },
    ],
  },
};

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── API 함수 ─────────────────────────────────────────────────────

/** 버전 Diff 리포트 — GET /contracts/:id/diff */
export async function getDiffReport(contractId: string): Promise<DiffReport | null> {
  if (USE_MOCK) { await delay(250); return MOCK[contractId] ?? null; }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/diff`);
  if (res.status === 404) return null;
  const json = await res.json();
  return json.data as DiffReport;
}

// ─── 표시 헬퍼 ───────────────────────────────────────────────────
export const DIFF_COLOR: Record<DiffChangeType, { label: string; color: string; bg: string; border: string }> = {
  ADDED:     { label: '추가', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
  REMOVED:   { label: '삭제', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
  MODIFIED:  { label: '수정', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
  UNCHANGED: { label: '유지', color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
};

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
