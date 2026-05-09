'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Contract } from '@/lib/api/contracts';
import type { ContractType } from '@/lib/api/prompts';
import {
  getContracts,
  uploadContract,
  RISK_CONFIG,
  STATUS_CONFIG,
  formatAmount,
  formatRelativeTime,
} from '@/lib/api/contracts';
import PromptBadge from '@/components/prompts/PromptBadge';

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: null,           label: 'Other' },
  { value: 'NDA',         label: 'NDA' },
  { value: 'MSA',         label: 'MSA' },
  { value: 'SI',          label: 'SI 도급' },
  { value: 'SLA',         label: 'SLA' },
  { value: 'Maintenance', label: 'Maintenance' },
];

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [contractType, setContractType] = useState<ContractType>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await getContracts();
    setContracts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 3초 폴링 (PARSING 상태 계약서 갱신)
  useEffect(() => {
    const hasParsing = contracts.some((c) => c.status === 'PARSING');
    if (!hasParsing) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [contracts, load]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.pdf'))) {
      setSelectedFile(file);
      setShowModal(true);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setShowModal(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !customerName.trim()) return;
    setUploading(true);
    try {
      const newContract = await uploadContract(selectedFile, customerName, contractType);
      setContracts((prev) => [newContract, ...prev]);
      setShowModal(false);
      setSelectedFile(null);
      setCustomerName('');
      setContractType(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 헤더 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          borderBottom: '1px solid #1E1E22',
          backgroundColor: '#111113',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: '#F0F0F1', margin: 0 }}>
            Contracts
          </h1>
          <p style={{ fontSize: '12px', color: '#6B6B78', margin: '2px 0 0' }}>
            {contracts.length}개 계약서
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFF',
            backgroundColor: '#5E6AD2',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6E7AE2')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#5E6AD2')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Contract
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </header>

      {/* 본문 */}
      <main
        style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: '#6B6B78', paddingTop: '60px', fontSize: '14px' }}>
            로딩 중...
          </div>
        ) : contracts.length === 0 ? (
          /* 빈 상태 — 드래그앤드롭 유도 */
          <DropZone isDragging={isDragging} onClick={() => fileInputRef.current?.click()} />
        ) : (
          <>
            {/* 계약서 목록 테이블 */}
            <div
              style={{
                backgroundColor: '#111113',
                border: '1px solid #1E1E22',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              {/* 테이블 헤더 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 80px 90px 100px 90px 80px',
                  padding: '10px 16px',
                  borderBottom: '1px solid #1E1E22',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6B6B78',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                <span>계약서</span>
                <span>고객사</span>
                <span>유형</span>
                <span>리스크</span>
                <span>상태</span>
                <span>금액</span>
                <span>업로드</span>
              </div>

              {/* 목록 */}
              {contracts.map((contract, i) => {
                const risk = contract.overall_risk ? RISK_CONFIG[contract.overall_risk] : null;
                const status = STATUS_CONFIG[contract.status];
                const isParsing = contract.status === 'PARSING';
                return (
                  <div
                    key={contract.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 80px 90px 100px 90px 80px',
                      padding: '12px 16px',
                      borderBottom: i < contracts.length - 1 ? '1px solid #1E1E22' : 'none',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#161618')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent')}
                  >
                    {/* 계약서명 */}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#F0F0F1' }}>
                        {contract.file_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B6B78', marginTop: '2px' }}>
                        v{contract.version} · {contract.uploaded_by}
                      </div>
                    </div>

                    {/* 고객사 */}
                    <span style={{ fontSize: '13px', color: '#B0B0BA' }}>
                      {contract.customer_name}
                    </span>

                    {/* 유형 뱃지 */}
                    <PromptBadge contractType={contract.contract_type} />

                    {/* 리스크 */}
                    {isParsing ? (
                      <span style={{ fontSize: '11px', color: '#0090FF' }}>분석중…</span>
                    ) : risk ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '4px',
                          color: risk.color,
                          backgroundColor: risk.bg,
                          border: `1px solid ${risk.color}33`,
                        }}
                      >
                        {risk.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#3E3E46' }}>—</span>
                    )}

                    {/* 상태 */}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: status.color,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isParsing && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#0090FF',
                            animation: 'pulse 1.5s infinite',
                          }}
                        />
                      )}
                      {status.label}
                    </span>

                    {/* 금액 */}
                    <span style={{ fontSize: '12px', color: '#B0B0BA' }}>
                      {formatAmount(contract.total_amount)}
                    </span>

                    {/* 업로드 시각 */}
                    <span style={{ fontSize: '11px', color: '#6B6B78' }}>
                      {formatRelativeTime(contract.uploaded_at)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 드래그앤드롭 영역 (목록 아래) */}
            <div style={{ marginTop: '16px' }}>
              <DropZone isDragging={isDragging} compact onClick={() => fileInputRef.current?.click()} />
            </div>
          </>
        )}
      </main>

      {/* 업로드 모달 */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            style={{
              backgroundColor: '#111113',
              border: '1px solid #1E1E22',
              borderRadius: '8px',
              padding: '24px',
              width: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#F0F0F1', margin: 0 }}>
                계약서 업로드
              </h2>
              <p style={{ fontSize: '12px', color: '#6B6B78', marginTop: '4px' }}>
                {selectedFile?.name}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6B6B78' }}>
                고객사명 *
                <input
                  autoFocus
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="예: 주식회사 A사"
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '4px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: '#F0F0F1',
                    backgroundColor: '#0D0D0F',
                    border: '1px solid #1E1E22',
                    borderRadius: '4px',
                    outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#5E6AD2')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#1E1E22')}
                />
              </label>

              <label style={{ fontSize: '12px', color: '#6B6B78' }}>
                계약 유형
                <select
                  value={contractType ?? ''}
                  onChange={(e) => setContractType((e.target.value || null) as ContractType)}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '4px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: '#F0F0F1',
                    backgroundColor: '#0D0D0F',
                    border: '1px solid #1E1E22',
                    borderRadius: '4px',
                    outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={String(ct.value)} value={ct.value ?? ''}>
                      {ct.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '7px 14px',
                  fontSize: '13px',
                  color: '#6B6B78',
                  backgroundColor: 'transparent',
                  border: '1px solid #2E2E36',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                취소
              </button>
              <button
                onClick={handleUpload}
                disabled={!customerName.trim() || uploading}
                style={{
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#FFF',
                  backgroundColor: uploading ? '#3D4592' : '#5E6AD2',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: uploading || !customerName.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {uploading ? '업로드 중...' : '분석 시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ─── 드래그앤드롭 영역 컴포넌트 ────────────────────────────────────
function DropZone({
  isDragging,
  compact = false,
  onClick,
}: {
  isDragging: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `1.5px dashed ${isDragging ? '#5E6AD2' : '#2E2E36'}`,
        borderRadius: '6px',
        backgroundColor: isDragging ? '#1A1A3E' : 'transparent',
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '8px' : '12px',
        padding: compact ? '14px 20px' : '60px 20px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        color: isDragging ? '#5E6AD2' : '#3E3E46',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!isDragging) {
          el.style.borderColor = '#3E3E46';
          el.style.color = '#6B6B78';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        if (!isDragging) {
          el.style.borderColor = '#2E2E36';
          el.style.color = '#3E3E46';
        }
      }}
    >
      <svg width={compact ? 16 : 32} height={compact ? 16 : 32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <div style={{ textAlign: compact ? 'left' : 'center' }}>
        <p style={{ fontSize: compact ? '12px' : '14px', fontWeight: 500, margin: 0 }}>
          {isDragging ? '여기에 놓으세요' : 'DOCX / PDF 드래그 또는 클릭하여 업로드'}
        </p>
        {!compact && (
          <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.6 }}>
            최대 10MB · Word(.docx) 또는 PDF
          </p>
        )}
      </div>
    </div>
  );
}
