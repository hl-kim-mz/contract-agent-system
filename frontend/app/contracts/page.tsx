'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Contract } from '@/lib/api/contracts';
import type { ContractType } from '@/lib/api/prompts';
import {
  getContracts, uploadContract,
  RISK_CONFIG, STATUS_CONFIG,
  formatAmount, formatRelativeTime,
} from '@/lib/api/contracts';
import PromptBadge from '@/components/prompts/PromptBadge';

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
  const [contracts, setContracts]   = useState<Contract[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isDrag, setIsDrag]         = useState(false);
  const [modal, setModal]           = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [customer, setCustomer]     = useState('');
  const [ctype, setCtype]           = useState<ContractType>(null);
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
    if (f && (f.name.endsWith('.docx') || f.name.endsWith('.pdf'))) openModal(f);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff',
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>계약서 목록</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{contracts.length}건</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 13, fontWeight: 500,
            color: '#fff', backgroundColor: '#1d4ed8',
            border: 'none', borderRadius: 5, cursor: 'pointer',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          계약서 업로드
        </button>
        <input ref={fileRef} type="file" accept=".docx,.pdf" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) openModal(f); }} />
      </div>

      {/* 본문 */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: 24 }}
        onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={onDrop}
      >
        {loading ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: 60 }}>불러오는 중…</p>
        ) : (
          <>
            {/* 테이블 */}
            <div style={{
              border: '1px solid #e5e7eb', borderRadius: 8,
              overflow: 'hidden', backgroundColor: '#fff',
            }}>
              {/* 헤더 행 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2.5fr 1fr 80px 90px 110px 90px 80px',
                padding: '9px 16px',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontSize: 11, fontWeight: 600,
                color: '#6b7280',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                <span>계약서</span>
                <span>고객사</span>
                <span>유형</span>
                <span>리스크</span>
                <span>상태</span>
                <span>금액</span>
                <span>업로드</span>
              </div>

              {contracts.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  아직 계약서가 없습니다
                </div>
              ) : contracts.map((c, i) => {
                const risk = c.overall_risk ? RISK_CONFIG[c.overall_risk] : null;
                const st = STATUS_CONFIG[c.status];
                const parsing = c.status === 'PARSING';
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.5fr 1fr 80px 90px 110px 90px 80px',
                      padding: '11px 16px',
                      borderBottom: i < contracts.length - 1 ? '1px solid #f3f4f6' : 'none',
                      alignItems: 'center', cursor: 'pointer',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#f9fafb')}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{c.file_name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        v{c.version} · {c.uploaded_by}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: '#374151' }}>{c.customer_name}</span>
                    <PromptBadge contractType={c.contract_type} />
                    {parsing ? (
                      <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#60a5fa', display: 'inline-block', animation: 'pulse 1.5s infinite' }}/>
                        분석중
                      </span>
                    ) : risk ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 7px', fontSize: 11, fontWeight: 600,
                        borderRadius: 4, color: risk.color, backgroundColor: risk.bg,
                        border: `1px solid ${risk.color}25`,
                      }}>{risk.label}</span>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
                    )}
                    <span style={{ fontSize: 12, color: st.color, fontWeight: 500 }}>{st.label}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>{formatAmount(c.total_amount)}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatRelativeTime(c.uploaded_at)}</span>
                  </div>
                );
              })}
            </div>

            {/* 드래그앤드롭 */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                marginTop: 16,
                border: `1.5px dashed ${isDrag ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: 8, padding: '20px',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', color: isDrag ? '#3b82f6' : '#9ca3af',
                backgroundColor: isDrag ? '#eff6ff' : 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#9ca3af'; }}
              onMouseLeave={e => { if (!isDrag) (e.currentTarget as HTMLDivElement).style.borderColor = '#d1d5db'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span style={{ fontSize: 13 }}>
                {isDrag ? '여기에 놓으세요' : 'DOCX / PDF 드래그하거나 클릭해서 업로드'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 업로드 모달 */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}
        >
          <div style={{
            backgroundColor: '#fff', borderRadius: 10,
            border: '1px solid #e5e7eb',
            padding: 24, width: 400,
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 4 }}>계약서 업로드</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>{file?.name}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
                  고객사명 *
                </label>
                <input
                  autoFocus value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  placeholder="예: 주식회사 A사"
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 13,
                    border: '1px solid #d1d5db', borderRadius: 5,
                    outline: 'none', color: '#111827',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>
                  계약 유형
                </label>
                <select
                  value={ctype ?? ''}
                  onChange={e => setCtype((e.target.value || null) as ContractType)}
                  style={{
                    width: '100%', padding: '8px 10px', fontSize: 13,
                    border: '1px solid #d1d5db', borderRadius: 5,
                    outline: 'none', color: '#111827', cursor: 'pointer',
                    boxSizing: 'border-box', backgroundColor: '#fff',
                  }}
                >
                  {CONTRACT_TYPES.map(t => (
                    <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setModal(false)}
                style={{
                  padding: '7px 14px', fontSize: 13, color: '#374151',
                  backgroundColor: 'transparent', border: '1px solid #d1d5db',
                  borderRadius: 5, cursor: 'pointer',
                }}
              >취소</button>
              <button
                onClick={doUpload}
                disabled={!customer.trim() || uploading}
                style={{
                  padding: '7px 16px', fontSize: 13, fontWeight: 500,
                  color: '#fff',
                  backgroundColor: !customer.trim() || uploading ? '#93c5fd' : '#1d4ed8',
                  border: 'none', borderRadius: 5,
                  cursor: !customer.trim() || uploading ? 'not-allowed' : 'pointer',
                }}
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
