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
  { key: 'ALL',               label: '전체' },
  { key: 'PARSING',           label: '분석 중' },
  { key: 'RISK_REVIEWED',     label: '검토 대기' },
  { key: 'PENDING_APPROVAL',  label: '결재 대기' },
  { key: 'APPROVED',          label: '승인 완료' },
  { key: 'REJECTED',          label: '반려' },
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

const COL = '2.4fr 1.1fr 68px 68px 90px 88px 76px';

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

  const visible      = filter === 'ALL' ? contracts : contracts.filter(c => c.status === filter);
  const countBy      = (s: string) => contracts.filter(c => c.status === s).length;
  const highCount    = contracts.filter(c => c.overall_risk === 'HIGH').length;
  const pendingCount = countBy('PENDING_APPROVAL');
  const approvedCount = countBy('APPROVED');

  const stats = [
    { label: '전체 계약',   value: contracts.length },
    { label: 'HIGH 리스크', value: highCount },
    { label: '결재 대기',   value: pendingCount },
    { label: '승인 완료',   value: approvedCount },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f8fafc' }}>

      {/* ── 헤더 ── */}
      <div style={{ padding: '24px 28px 0', backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>계약서 관리</h1>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: 400 }}>MZC 계약 검토 및 AI 리스크 분석</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', fontSize: 12, fontWeight: 600,
              color: '#fff', backgroundColor: '#334155',
              border: 'none', borderRadius: 7, cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e293b')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#334155')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            계약서 업로드
          </button>
          <input ref={fileRef} type="file" accept=".docx,.pdf" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) openModal(f); }} />
        </div>

        {/* ── 현황 카드 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              backgroundColor: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: 10,
              padding: '13px 16px',
            }}>
              <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500, marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── 상태 필터 탭 ── */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#fff',
          borderRadius: '10px 10px 0 0',
          padding: '0 8px',
          boxShadow: '0 -1px 0 0 #f1f5f9 inset',
        }}>
          {FILTERS.map(f => {
            const cnt    = f.key === 'ALL' ? contracts.length : countBy(f.key);
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '10px 11px',
                fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? '#0f172a' : '#94a3b8',
                borderBottom: `2px solid ${active ? '#334155' : 'transparent'}`,
                background: 'none', border: 'none', borderBottomStyle: 'solid',
                cursor: 'pointer', marginBottom: -1,
                transition: 'color 0.1s',
                whiteSpace: 'nowrap',
              }}>
                {f.label}
                {cnt > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    padding: '1px 5px', borderRadius: 99,
                    backgroundColor: '#f1f5f9',
                    color: active ? '#475569' : '#cbd5e1',
                  }}>
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
        style={{ flex: 1, overflowY: 'auto', padding: '0 28px 28px', backgroundColor: '#f8fafc' }}
        onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={onDrop}
      >
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0', borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {/* 컬럼 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: COL,
            padding: '9px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #f1f5f9',
            fontSize: 10, fontWeight: 700, color: '#cbd5e1',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            <span>계약서</span><span>고객사</span><span>유형</span>
            <span>리스크</span><span>상태</span><span>금액</span><span>업로드</span>
          </div>

          {loading ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>불러오는 중…</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: '56px 0', textAlign: 'center', color: '#cbd5e1', fontSize: 13 }}>해당 조건의 계약서가 없습니다.</div>
          ) : visible.map((c, i) => {
            const risk    = c.overall_risk ? RISK_CONFIG[c.overall_risk] : null;
            const st      = STATUS_CONFIG[c.status];
            const parsing = c.status === 'PARSING';
            return (
              <div key={c.id}
                onClick={() => router.push(`/contracts/${c.id}`)}
                style={{
                  display: 'grid', gridTemplateColumns: COL,
                  padding: '11px 20px',
                  borderBottom: i < visible.length - 1 ? '1px solid #f8fafc' : 'none',
                  alignItems: 'center', cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#f8fafc')}
                onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.file_name}</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 1.5 }}>v{c.version} · {c.uploaded_by}</div>
                </div>

                <span style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.customer_name}</span>
                <PromptBadge contractType={c.contract_type} />

                {parsing ? (
                  <DataPill size="sm" style={{ color: '#94a3b8' }}>분석중</DataPill>
                ) : risk ? (
                  <DataPill size="sm" style={{ color: risk.color }}>{risk.label}</DataPill>
                ) : (
                  <DataPill size="sm" style={{ color: '#cbd5e1' }}>—</DataPill>
                )}

                <DataPill size="sm" style={{ color: st.color }}>{st.label}</DataPill>
                <span style={{ fontSize: 12, color: '#64748b' }}>{formatAmount(c.total_amount)}</span>
                <span style={{ fontSize: 11, color: '#cbd5e1' }}>{formatRelativeTime(c.uploaded_at)}</span>
              </div>
            );
          })}
        </div>

        {/* 드래그앤드롭 업로드 존 */}
        <div
          onClick={() => fileRef.current?.click()}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#94a3b8'; (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f8fafc'; }}
          onMouseLeave={e => { if (!isDrag) { (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; } }}
          style={{
            marginTop: 10,
            border: `1.5px dashed ${isDrag ? '#94a3b8' : '#e2e8f0'}`,
            borderRadius: 10, padding: '16px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: 'pointer',
            backgroundColor: isDrag ? '#f8fafc' : 'transparent',
            color: '#94a3b8', transition: 'all 0.15s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span style={{ fontSize: 12 }}>{isDrag ? '여기에 놓으세요' : 'DOCX / PDF 파일을 드래그하거나 클릭해서 업로드'}</span>
        </div>
      </div>

      {/* ── 업로드 모달 ── */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(15,23,42,0.35)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            animation: 'fadeIn 0.15s ease',
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            border: '1px solid #f1f5f9',
            padding: '24px 24px 20px',
            width: 400,
            boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
            animation: 'slideUp 0.18s ease',
          }}>
            {/* 모달 헤더 */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>계약서 업로드</h2>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file?.name}</p>
              </div>
              <button
                onClick={() => setModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', borderRadius: 4, display: 'flex', transition: 'color 0.1s' }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#475569')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#94a3b8')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>고객사명 *</label>
                <input
                  autoFocus value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customer.trim()) doUpload(); }}
                  placeholder="예: 주식회사 A사"
                  style={{
                    width: '100%', padding: '9px 12px', fontSize: 13,
                    border: '1.5px solid #e2e8f0', borderRadius: 8,
                    color: '#0f172a', boxSizing: 'border-box',
                    backgroundColor: '#f8fafc', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>계약 유형</label>
                <select
                  value={ctype ?? ''}
                  onChange={e => setCtype((e.target.value || null) as ContractType)}
                  style={{
                    width: '100%', padding: '9px 12px', fontSize: 13,
                    border: '1.5px solid #e2e8f0', borderRadius: 8,
                    color: '#0f172a', backgroundColor: '#f8fafc',
                    boxSizing: 'border-box', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.backgroundColor = '#fff'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                >
                  {CONTRACT_TYPES.map(t => <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setModal(false)}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: 500,
                  color: '#64748b', backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f1f5f9')}
                onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8fafc')}
              >
                취소
              </button>
              <button
                onClick={doUpload}
                disabled={!customer.trim() || uploading}
                style={{
                  padding: '8px 18px', fontSize: 12, fontWeight: 600,
                  color: '#fff',
                  backgroundColor: !customer.trim() || uploading ? '#cbd5e1' : '#334155',
                  border: 'none', borderRadius: 8,
                  cursor: !customer.trim() || uploading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (customer.trim() && !uploading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e293b'; }}
                onMouseLeave={e => { if (customer.trim() && !uploading) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#334155'; }}
              >
                {uploading ? '업로드 중…' : 'AI 분석 시작'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
