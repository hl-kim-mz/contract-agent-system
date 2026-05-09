// lib/api/analysis-progress.ts
// Feature: 분석 진행 화면 (/contracts/:id — 분석중 상태)
// Screen: ContractDetailPage 또는 contracts list 내 인라인 진행바

export type ProgressStep = {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending' | 'error';
  detail: string | null;
  completed_at: string | null;
};

export interface AnalysisProgress {
  contract_id: string;
  overall_status: 'PARSING' | 'RISK_REVIEWED' | 'ERROR';
  progress_percent: number; // 0-100
  steps: ProgressStep[];
  estimated_remaining_sec: number | null;
}

// ─── Mock (PARSING 중인 계약서 시뮬레이션) ───────────────────────
const MOCK_PROGRESS: Record<string, AnalysisProgress> = {
  ctr_004: { // D물류 유지보수계약서 — PARSING 상태
    contract_id: 'ctr_004',
    overall_status: 'PARSING',
    progress_percent: 60,
    estimated_remaining_sec: 30,
    steps: [
      { id: 'upload',  label: '파일 업로드',   status: 'done',   detail: 'D물류_유지보수계약서_v3.docx (245KB)', completed_at: new Date(Date.now() - 60000).toISOString() },
      { id: 'parse',   label: '문서 파싱',     status: 'done',   detail: '8개 조항 추출 완료', completed_at: new Date(Date.now() - 30000).toISOString() },
      { id: 'analyze', label: 'AI 리스크 분석', status: 'active', detail: '조항 분석 중…', completed_at: null },
      { id: 'route',   label: '검토 라우팅',   status: 'pending', detail: null, completed_at: null },
    ],
  },
};

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** 분석 진행 상태 조회 — GET /contracts/:id/progress */
export async function getAnalysisProgress(contractId: string): Promise<AnalysisProgress | null> {
  if (USE_MOCK) {
    await delay(100);
    return MOCK_PROGRESS[contractId] ?? null;
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/progress`);
  if (res.status === 404) return null;
  const json = await res.json();
  return json.data as AnalysisProgress;
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
