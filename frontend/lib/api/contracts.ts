// lib/api/contracts.ts

import type { ContractType } from './prompts';

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | null;
export type ContractStatus =
  | 'DRAFT'
  | 'PARSING'
  | 'RISK_REVIEWED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface Contract {
  id: string;
  customer_name: string;
  contract_type: ContractType;
  version: number;
  status: ContractStatus;
  overall_risk: RiskLevel;
  is_standard: boolean;
  uploaded_at: string;
  uploaded_by: string;
  s3_key: string;
  file_name: string;
  total_amount: number | null;
}

// ─── Mock 데이터 ─────────────────────────────────────────────────
let mockContracts: Contract[] = [
  {
    id: 'ctr_001',
    customer_name: '주식회사 A사',
    contract_type: 'SI',
    version: 2,
    status: 'RISK_REVIEWED',
    overall_risk: 'HIGH',
    is_standard: false,
    uploaded_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    uploaded_by: '김영업',
    s3_key: 'A사/ctr_001/v2.docx',
    file_name: 'A사_SI도급계약서_v2.docx',
    total_amount: 2000000000,
  },
  {
    id: 'ctr_002',
    customer_name: '주식회사 B사',
    contract_type: 'NDA',
    version: 1,
    status: 'APPROVED',
    overall_risk: 'LOW',
    is_standard: false,
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    uploaded_by: '박대리',
    s3_key: 'B사/ctr_002/v1.docx',
    file_name: 'B사_비밀유지계약서_v1.docx',
    total_amount: null,
  },
  {
    id: 'ctr_003',
    customer_name: '주식회사 C사',
    contract_type: 'MSA',
    version: 1,
    status: 'PENDING_APPROVAL',
    overall_risk: 'MEDIUM',
    is_standard: false,
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    uploaded_by: '이팀장',
    s3_key: 'C사/ctr_003/v1.docx',
    file_name: 'C사_기본계약서_v1.docx',
    total_amount: 500000000,
  },
  {
    id: 'ctr_004',
    customer_name: '주식회사 D물류',
    contract_type: 'Maintenance',
    version: 3,
    status: 'PARSING',
    overall_risk: null,
    is_standard: false,
    uploaded_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    uploaded_by: '최사원',
    s3_key: 'D물류/ctr_004/v3.docx',
    file_name: 'D물류_유지보수계약서_v3.docx',
    total_amount: 120000000,
  },
  {
    id: 'ctr_005',
    customer_name: '주식회사 E테크',
    contract_type: 'SI',
    version: 1,
    status: 'REJECTED',
    overall_risk: 'HIGH',
    is_standard: false,
    uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    uploaded_by: '김영업',
    s3_key: 'E테크/ctr_005/v1.docx',
    file_name: 'E테크_시스템구축계약서_v1.docx',
    total_amount: 850000000,
  },
];

// ─── API 함수 ─────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function getContracts(): Promise<Contract[]> {
  if (USE_MOCK) {
    await delay(300);
    return [...mockContracts].sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    );
  }
  const res = await fetch(`${API_BASE}/contracts`);
  const json = await res.json();
  return json.data as Contract[];
}

export async function uploadContract(file: File, customerName: string, contractType: ContractType): Promise<Contract> {
  if (USE_MOCK) {
    await delay(800);
    const newContract: Contract = {
      id: `ctr_${Date.now()}`,
      customer_name: customerName,
      contract_type: contractType,
      version: 1,
      status: 'PARSING',
      overall_risk: null,
      is_standard: false,
      uploaded_at: new Date().toISOString(),
      uploaded_by: 'demo_user',
      s3_key: `${customerName}/${Date.now()}/v1.docx`,
      file_name: file.name,
      total_amount: null,
    };
    mockContracts = [newContract, ...mockContracts];

    // 3초 후 RISK_REVIEWED로 자동 전환 (Mock 분석 완료 시뮬레이션)
    setTimeout(() => {
      const idx = mockContracts.findIndex((c) => c.id === newContract.id);
      if (idx >= 0) {
        mockContracts[idx] = {
          ...mockContracts[idx],
          status: 'RISK_REVIEWED',
          overall_risk: 'MEDIUM',
        };
      }
    }, 3000);

    return newContract;
  }
  const form = new FormData();
  form.append('file', file);
  form.append('customer_name', customerName);
  form.append('contract_type', contractType ?? 'Other');
  const res = await fetch(`${API_BASE}/contracts/upload`, { method: 'POST', body: form });
  const json = await res.json();
  return json.data as Contract;
}

// ─── 표시 헬퍼 ───────────────────────────────────────────────────
export const RISK_CONFIG: Record<string, { label: string }> = {
  HIGH:   { label: 'HIGH' },
  MEDIUM: { label: 'MED' },
  LOW:    { label: 'LOW' },
  NONE:   { label: 'NONE' },
};

export const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string }> = {
  DRAFT:            { label: '대기',     color: '#6b7280' },
  PARSING:          { label: '분석중',   color: '#6b7280' },
  RISK_REVIEWED:    { label: '검토완료', color: '#6b7280' },
  PENDING_APPROVAL: { label: '결재대기', color: '#6b7280' },
  APPROVED:         { label: '승인완료', color: '#6b7280' },
  REJECTED:         { label: '반려',     color: '#6b7280' },
};

export function formatAmount(amount: number | null): string {
  if (!amount) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}억원`;
  if (amount >= 10_000_000) return `${(amount / 100_000_000).toFixed(1)}억원`;
  return `${(amount / 10_000).toFixed(0)}만원`;
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
