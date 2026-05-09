'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Contract } from '@/lib/api/contracts';
import type { ContractType } from '@/lib/api/prompts';
import { getContracts, uploadContract, RISK_CONFIG, STATUS_CONFIG, formatAmount, formatRelativeTime } from '@/lib/api/contracts';
import PromptBadge from '@/components/prompts/PromptBadge';
import DataPill from '@/components/ui/DataPill';

type FilterKey = 'ALL' | 'PARSING' | 'RISK_REVIEWED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL',              label: '전체' },
  { key: 'PARSING',         label: '분석 중' },
  { key: 'RISK_REVIEWED',   label: '검토 대기' },
  { key: 'PENDING_APPROVAL',label: '결재 대기' },
  { key: 'APPROVED',        label: '승인 완료' },
  { key: 'REJECTED',        label: '반려' },
];

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: null,           label: '유형 선택' },
  { value: 'NDA',         label: 'NDA — 비밀유지' },
  { value: 'MSA',         label: 'MSA — 기본계약' },
  { value: 'SI',          label: 'SI — 시스템구축' },
  { value: 'SLA',         label: 'SLA — 서비스수준' },
  { value: 'Maintenance', label: '유지보수' },
  { value: 'Outsourcing', label: '외주도급' },
];

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<FilterKey>('ALL');
  const [isDrag,    setIsDrag]    = useState(false);
  const [modal,     setModal]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [customer,  setCustomer]  = useState('');
  const [ctype,     setCtype]     = useState<ContractType>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await getContracts();
    setContracts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!contracts.some(c => c.status === 'PARSING')) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [contracts, load]);

  const openModal = (f: File) => { setFile(f); setModal(true); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) openModal(f);
  };
  const doUpload = async () => {
    if (!file || !customer.trim()) return;
    setUploading(true);
    try {
      const c = await uploadContract(file, customer, ctype);
      setContracts(p => [c, ...p]);
      setModal(false); setFile(null); setCustomer(''); setCtype(null);
    } finally { setUploading(false); }
  };

  const visible = filter === 'ALL' ? contracts : contracts.filter(c => c.status === filter);
  const countBy = (status: string) => contracts.filter(c => c.status === status).length;
  const highCount = contracts.filter(c => c.overall_risk === 'HIGH').length;

  const stats = [
    { label: '전체 계약', value: contracts.length },
    { label: 'HIGH 리스크', value: highCount },
    { label: '결재 대기', value: countBy('PENDING_APPROVAL') },
    { label: '승인 완료', value: countBy('APPROVED') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb' }}>
      {/* ── 헤더 ── */}
      <div style={{ padding: '20px 28px 0', backgroundColor: '#f9fafb' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>계약서 관리</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>MZC 계약 검토 및 리스크 분석 현황</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: '#1d4ed8', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: '0 1px 3px rgba(29,78,216,0.3)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            계약서 업로드
          </button>
          <input ref={fileRef} type="file" accept=".docx,.pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) openModal(f); }} />
        </div>

        {/* ── 현황 카드 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {stats.map(s => (
            <div key={s.label} style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px' }}>
              <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── 상태 필터 탭 ── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', borderRadius: '8px 8px 0 0', padding: '0 4px' }}>
          {FILTERS.map(f => {
            const cnt = f.key === 'ALL' ? contracts.length : countBy(f.key);
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#1d4ed8' : '#6b7280', borderBottom: `2px solid ${active ? '#1d4ed8' : 'transparent'}`, background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer', marginBottom: -1, transition: 'all 0.1s' }}>
                {f.label}
                {cnt > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 10, backgroundColor: active ? '#eff6ff' : '#f3f4f6', color: active ? '#1d4ed8' : '#6b7280' }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px', backgroundColor: '#f9fafb' }}
        onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={onDrop}
      >
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {/* 컬럼 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 72px 72px 88px 90px 80px', padding: '10px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span>계약서</span><span>고객사</span><span>유형</span>
            <span>리스크</span><span>상태</span><span>금액</span><span>업로드</span>
          </div>

          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>불러오는 중…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>해당 조건의 계약서가 없습니다.</div>
          ) : visible.map((c, i) => {
            const risk    = c.overall_risk ? RISK_CONFIG[c.overall_risk] : null;
            const st      = STATUS_CONFIG[c.status];
            const parsing = c.status === 'PARSING';
            return (
              <div key={c.id}
                onClick={() => router.push(`/contracts/${c.id}`)}
                style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 72px 72px 88px 90px 80px', padding: '10px 20px', borderBottom: i < visible.length - 1 ? '1px solid #f3f4f6' : 'none', alignItems: 'center', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#f9fafb')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
              >
                {/* 파일명 + 업로더 */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file_name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>v{c.version} · {c.uploaded_by}</div>
                </div>

                <span style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer_name}</span>
                <PromptBadge contractType={c.contract_type} />

                {parsing ? (
                  <DataPill size="sm">분석</DataPill>
                ) : risk ? (
                  <DataPill size="sm">{risk.label}</DataPill>
                ) : (
                  <DataPill size="sm" style={{ color: '#9ca3af', backgroundColor: '#fafafa' }}>—</DataPill>
                )}

                <DataPill size="sm" style={{ fontWeight: 500 }}>{st.label}</DataPill>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{formatAmount(c.total_amount)}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatRelativeTime(c.uploaded_at)}</span>
              </div>
            );
          })}
        </div>

        {/* 드래그앤드롭 영역 */}
        <div
          onClick={() => fileRef.current?.click()}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#9ca3af'; }}
          onMouseLeave={e => { if (!isDrag) (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; }}
          style={{ marginTop: 12, border: `1.5px dashed ${isDrag ? '#9ca3af' : '#d1d5db'}`, borderRadius: 8, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', backgroundColor: isDrag ? '#f9fafb' : 'transparent', color: '#9ca3af', transition: 'all 0.15s' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span style={{ fontSize: 13 }}>{isDrag ? '여기에 놓으세요' : 'DOCX / PDF 파일을 드래그하거나 클릭해서 업로드'}</span>
        </div>
      </div>

      {/* ── 업로드 모달 ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24, width: 420, boxShadow: '0 12px 32px rgba(0,0,0,0.1)' }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>계약서 업로드</h2>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{file?.name}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>고객사명 *</label>
                <input autoFocus value={customer} onChange={e => setCustomer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customer.trim()) doUpload(); }} placeholder="예: 주식회사 A사"
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', boxSizing: 'border-box' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')} onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>계약 유형</label>
                <select value={ctype ?? ''} onChange={e => setCtype((e.target.value || null) as ContractType)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', color: '#111827', backgroundColor: '#fff', boxSizing: 'border-box', cursor: 'pointer' }}>
                  {CONTRACT_TYPES.map(t => <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ padding: '8px 16px', fontSize: 13, color: '#374151', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>취소</button>
              <button onClick={doUpload} disabled={!customer.trim() || uploading}
                style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, color: '#fff', backgroundColor: !customer.trim() || uploading ? '#93c5fd' : '#1d4ed8', border: 'none', borderRadius: 6, cursor: !customer.trim() || uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? '업로드 중…' : 'AI 분석 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
