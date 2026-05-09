// lib/api/contract-detail.ts
// Feature: 계약서 상세 헤더 정보 (/contracts/:id)
// Screen: ContractDetailPage > header + 좌측 계약 정보 바

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
    renewal_terms: string | null;
  } | null;
}

// ─── Mock ─────────────────────────────────────────────────────────
const MOCK: Record<string, ContractDetail> = {
  ctr_001: {
    id: 'ctr_001', customer_name: '주식회사 A사', contract_type: 'SI', version: 2,
    status: 'RISK_REVIEWED', file_name: 'A사_SI도급계약서_v2.docx',
    uploaded_at: new Date(Date.now() - 1800000).toISOString(), uploaded_by: '김영업',
    total_amount: 2000000000,
    parties: {
      party_a: { name: '주식회사 A사', representative: '홍길동' },
      party_b: { name: '메가존클라우드 주식회사', representative: '이주완' },
    },
    dates: { contract_date: '2026-05-30', start_date: '2026-06-01', end_date: '2026-12-31', renewal_terms: null },
  },
  ctr_002: {
    id: 'ctr_002', customer_name: '주식회사 B사', contract_type: 'NDA', version: 1,
    status: 'APPROVED', file_name: 'B사_비밀유지계약서_v1.docx',
    uploaded_at: new Date(Date.now() - 86400000).toISOString(), uploaded_by: '박대리',
    total_amount: null,
    parties: {
      party_a: { name: '주식회사 B사', representative: '김철수' },
      party_b: { name: '메가존클라우드 주식회사', representative: '이주완' },
    },
    dates: { contract_date: '2026-05-01', start_date: null, end_date: null, renewal_terms: null },
  },
  ctr_003: {
    id: 'ctr_003', customer_name: '주식회사 C사', contract_type: 'MSA', version: 1,
    status: 'PENDING_APPROVAL', file_name: 'C사_기본계약서_v1.docx',
    uploaded_at: new Date(Date.now() - 172800000).toISOString(), uploaded_by: '이팀장',
    total_amount: 500000000,
    parties: { party_a: { name: '주식회사 C사', representative: '박영희' }, party_b: { name: '메가존클라우드 주식회사', representative: '이주완' } },
    dates: { contract_date: '2026-04-15', start_date: '2026-05-01', end_date: '2027-04-30', renewal_terms: null },
  },
};

// ─── API 설정 ────────────────────────────────────────────────────
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── API 함수 ─────────────────────────────────────────────────────

/** 계약서 상세 조회 — GET /contracts/:id */
export async function getContractDetail(id: string): Promise<ContractDetail> {
  if (USE_MOCK) {
    await delay(200);
    const d = MOCK[id];
    if (!d) throw new Error(`Contract not found: ${id}`);
    return { ...d };
  }
  const res = await fetch(`${API_BASE}/contracts/${id}`);
  if (!res.ok) throw new Error('Contract not found');
  const json = await res.json();
  return json.data as ContractDetail;
}

function delay(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
