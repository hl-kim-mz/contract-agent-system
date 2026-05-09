// lib/api/workflow.ts
// Feature: 검토 워크플로우 화면 (/contracts/:id — 워크플로우 탭)
// Screen: ContractDetailPage > tab='workflow'

export type WorkflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WorkflowStep {
  id: string;
  contract_id: string;
  step_order: number;
  department: string;
  role: string;
  status: WorkflowStatus;
  comment: string | null;
  signed_at: string | null;
  is_parallel: boolean;
}

// ─── Mock ─────────────────────────────────────────────────────────
const MOCK_STEPS: Record<string, WorkflowStep[]> = {
  ctr_001: [
    { id: 'wf_001', contract_id: 'ctr_001', step_order: 1, department: '계약팀',  role: '1차 검토자',  status: 'PENDING', comment: null, signed_at: null, is_parallel: false },
    { id: 'wf_002', contract_id: 'ctr_001', step_order: 2, department: '법무팀',  role: '법무 검토',   status: 'PENDING', comment: null, signed_at: null, is_parallel: false },
    { id: 'wf_003', contract_id: 'ctr_001', step_order: 3, department: '본부장',  role: '최종 승인',   status: 'PENDING', comment: null, signed_at: null, is_parallel: false },
    { id: 'wf_004', contract_id: 'ctr_001', step_order: 2, department: '재무팀',  role: '병렬 검토',   status: 'PENDING', comment: null, signed_at: null, is_parallel: true  },
  ],
  ctr_002: [
    { id: 'wf_010', contract_id: 'ctr_002', step_order: 1, department: '영업팀', role: '자체 승인', status: 'APPROVED', comment: '이상 없음. 승인합니다.', signed_at: new Date(Date.now() - 80000000).toISOString(), is_parallel: false },
  ],
  ctr_003: [
    { id: 'wf_020', contract_id: 'ctr_003', step_order: 1, department: '계약팀', role: '1차 검토자', status: 'APPROVED', comment: '검토 완료', signed_at: new Date(Date.now() - 10000000).toISOString(), is_parallel: false },
    { id: 'wf_021', contract_id: 'ctr_003', step_order: 2, department: '담당임원', role: '최종 승인', status: 'PENDING', comment: null, signed_at: null, is_parallel: false },
  ],
};

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── API 함수 ─────────────────────────────────────────────────────

/** 워크플로우 단계 목록 — GET /contracts/:id/workflow */
export async function getWorkflowSteps(contractId: string): Promise<WorkflowStep[]> {
  if (USE_MOCK) {
    await delay(150);
    const steps = MOCK_STEPS[contractId] ?? [];
    return steps.sort((a, b) => a.step_order - b.step_order);
  }
  const res = await fetch(`${API_BASE}/contracts/${contractId}/workflow`);
  const json = await res.json();
  return json.data as WorkflowStep[];
}

/** 단계 승인 — POST /workflow/:stepId/approve */
export async function approveStep(stepId: string, comment: string): Promise<WorkflowStep> {
  if (USE_MOCK) {
    await delay(500);
    for (const steps of Object.values(MOCK_STEPS)) {
      const s = steps.find(x => x.id === stepId);
      if (s) {
        s.status = 'APPROVED';
        s.comment = comment;
        s.signed_at = new Date().toISOString();
        return { ...s };
      }
    }
    throw new Error('Step not found');
  }
  const res = await fetch(`${API_BASE}/workflow/${stepId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment, status: 'APPROVED' }),
  });
  const json = await res.json();
  return json.data as WorkflowStep;
}

/** 단계 반려 — POST /workflow/:stepId/approve (status=REJECTED) */
export async function rejectStep(stepId: string, comment: string): Promise<WorkflowStep> {
  if (USE_MOCK) {
    await delay(500);
    for (const steps of Object.values(MOCK_STEPS)) {
      const s = steps.find(x => x.id === stepId);
      if (s) {
        s.status = 'REJECTED';
        s.comment = comment;
        s.signed_at = new Date().toISOString();
        return { ...s };
      }
    }
    throw new Error('Step not found');
  }
  const res = await fetch(`${API_BASE}/workflow/${stepId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment, status: 'REJECTED' }),
  });
  const json = await res.json();
  return json.data as WorkflowStep;
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
