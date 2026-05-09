'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  getContractDetail, getRiskReport, getWorkflowSteps, approveStep,
  RISK_LEVEL_CFG, RISK_TYPE_LABEL,
  type ContractDetail, type RiskReport, type WorkflowStep,
} from '@/lib/api/risk-reports';
import PromptBadge from '@/components/prompts/PromptBadge';
import type { ContractType } from '@/lib/api/prompts';

type Tab = 'report' | 'workflow';

export default function ContractDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [report, setReport]     = useState<RiskReport | null>(null);
  const [steps, setSteps]       = useState<WorkflowStep[]>([]);
  const [tab, setTab]           = useState<Tab>('report');
  const [loading, setLoading]   = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [comment, setComment]   = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getContractDetail(id),
      getRiskReport(id),
      getWorkflowSteps(id),
    ]).then(([c, r, s]) => {
      setContract(c); setReport(r); setSteps(s);
    }).finally(() => setLoading(false));
  }, [id]);

  const doApprove = async (stepId: string) => {
    setApproving(stepId);
    try {
      const updated = await approveStep(stepId, comment || '검토 완료. 승인합니다.');
      setSteps(prev => prev.map(s => s.id === stepId ? updated : s));
      setComment('');
    } finally { setApproving(null); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: 13 }}>
      불러오는 중…
    </div>
  );

  if (!contract) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9ca3af', fontSize: 13 }}>
      계약서를 찾을 수 없습니다.
    </div>
  );

  const overallCfg = report ? RISK_LEVEL_CFG[report.overall_risk] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff' }}>

      {/* 상단 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 24px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff',
      }}>
        <button
          onClick={() => router.push('/contracts')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          목록으로
        </button>

        <span style={{ color: '#d1d5db' }}>·</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PromptBadge contractType={contract.contract_type as ContractType} />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{contract.file_name}</span>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>v{contract.version}</span>
        </div>

        {overallCfg && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', fontSize: 12, fontWeight: 600,
            borderRadius: 20, color: overallCfg.color,
            backgroundColor: overallCfg.bg, border: `1px solid ${overallCfg.border}`,
            marginLeft: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: overallCfg.color, display: 'inline-block' }}/>
            {overallCfg.label} 리스크
          </span>
        )}

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          {contract.uploaded_by} · {new Date(contract.uploaded_at).toLocaleDateString('ko-KR')}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* 왼쪽: 계약 정보 패널 */}
        <aside style={{
          width: 240, minWidth: 240, borderRight: '1px solid #e5e7eb',
          padding: 20, overflowY: 'auto', backgroundColor: '#fafafa',
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>계약 정보</h3>

          <InfoRow label="고객사" value={contract.customer_name} />
          <InfoRow label="계약 유형" value={contract.contract_type} />
          {contract.total_amount && (
            <InfoRow label="계약금액" value={`${(contract.total_amount / 100000000).toFixed(1)}억원`} />
          )}
          {contract.parties && <>
            <InfoRow label="갑 (이용자)" value={contract.parties.party_a.name} />
            {contract.parties.party_a.representative && (
              <InfoRow label="대표자" value={contract.parties.party_a.representative} />
            )}
          </>}
          {contract.dates?.contract_date && (
            <InfoRow label="계약일" value={contract.dates.contract_date} />
          )}
          {contract.dates?.start_date && (
            <InfoRow label="시작일" value={contract.dates.start_date} />
          )}
          {contract.dates?.end_date && (
            <InfoRow label="종료일" value={contract.dates.end_date} />
          )}

          {report && <>
            <div style={{ height: 1, backgroundColor: '#e5e7eb', margin: '16px 0' }} />
            <h3 style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>분석 결과</h3>
            <InfoRow label="비표준 계약" value={report.is_standard_contract ? '아니오 (표준)' : '예'} />
            <InfoRow label="에스컬레이션" value={report.escalation_required ? '필요' : '불필요'} valueColor={report.escalation_required ? '#dc2626' : '#16a34a'} />
            <InfoRow label="탐지 리스크" value={`${report.clause_risks.length}건`} />
          </>}
        </aside>

        {/* 오른쪽: 탭 콘텐츠 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 탭 헤더 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px', backgroundColor: '#fff' }}>
            {([['report', '리스크 리포트'], ['workflow', '검토 워크플로우']] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '12px 4px', marginRight: 20, fontSize: 13, fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? '#111827' : '#6b7280',
                  borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
                  background: 'none', border: 'none', cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

            {/* ── 리스크 리포트 탭 ── */}
            {tab === 'report' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {!report ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', paddingTop: 60, fontSize: 13 }}>
                    리스크 분석 결과가 없습니다.
                  </div>
                ) : <>
                  {/* 요약 카드 */}
                  <div style={{
                    border: `1px solid ${overallCfg?.border ?? '#e5e7eb'}`,
                    borderLeft: `4px solid ${overallCfg?.color ?? '#e5e7eb'}`,
                    borderRadius: 8, padding: 20,
                    backgroundColor: overallCfg?.bg ?? '#fff',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: overallCfg?.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                          {overallCfg?.label} 리스크
                        </p>
                        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, maxWidth: 600 }}>
                          {report.risk_summary}
                        </p>
                      </div>
                    </div>

                    {report.key_concerns.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>핵심 우려사항</p>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {report.key_concerns.map((c, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151' }}>
                              <span style={{ color: overallCfg?.color, fontWeight: 600, flexShrink: 0 }}>{i + 1}.</span>
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.standard_deviation && (
                      <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 6, fontSize: 12, color: '#6b7280' }}>
                        <strong style={{ fontWeight: 600 }}>MZC 표준 대비: </strong>{report.standard_deviation}
                      </div>
                    )}
                  </div>

                  {/* 조항별 리스크 목록 */}
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
                      조항별 리스크 <span style={{ color: '#9ca3af', fontWeight: 400 }}>({report.clause_risks.length}건)</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {report.clause_risks.map(risk => {
                        const cfg = RISK_LEVEL_CFG[risk.risk_level];
                        const expanded = expandedId === risk.clause_id;
                        return (
                          <div
                            key={risk.clause_id}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderLeft: `3px solid ${cfg.color}`,
                              borderRadius: 7,
                              backgroundColor: '#fff',
                              overflow: 'hidden',
                            }}
                          >
                            {/* 조항 헤더 */}
                            <button
                              onClick={() => setExpandedId(expanded ? null : risk.clause_id)}
                              style={{
                                display: 'flex', alignItems: 'center', width: '100%',
                                padding: '12px 16px', gap: 12, cursor: 'pointer',
                                background: 'none', border: 'none', textAlign: 'left',
                              }}
                              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fafafa')}
                              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}
                            >
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 7px', fontSize: 11, fontWeight: 600,
                                borderRadius: 4, color: cfg.color, backgroundColor: cfg.bg,
                                border: `1px solid ${cfg.border}`,
                                flexShrink: 0,
                              }}>{cfg.label}</span>

                              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', flex: 1 }}>
                                {RISK_TYPE_LABEL[risk.risk_type] ?? risk.risk_type}
                              </span>

                              <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 8 }}>{risk.clause_id}</span>

                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>

                            {/* 상세 펼치기 */}
                            {expanded && (
                              <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>

                                  <DetailSection icon="⚠️" title="위험 근거" color="#374151">
                                    {risk.reason}
                                  </DetailSection>

                                  <DetailSection icon="✏️" title="수정 권고안" color="#1d4ed8">
                                    {risk.recommendation}
                                  </DetailSection>

                                  <DetailSection icon="💰" title="재무 영향" color="#d97706">
                                    {risk.financial_impact}
                                  </DetailSection>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>}
              </div>
            )}

            {/* ── 워크플로우 탭 ── */}
            {tab === 'workflow' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 600 }}>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
                  리스크 수준에 따라 자동 배정된 검토 순서입니다.
                </p>
                {steps.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: 13 }}>검토 단계가 없습니다.</p>
                ) : steps.map((step, i) => (
                  <div
                    key={step.id}
                    style={{
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      padding: 16, backgroundColor: '#fff',
                      opacity: step.status === 'PENDING' && i > 0 && steps[i - 1]?.status !== 'APPROVED' ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* 스텝 번호 */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        backgroundColor: step.status === 'APPROVED' ? '#dcfce7' : step.status === 'REJECTED' ? '#fee2e2' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600, flexShrink: 0,
                        color: step.status === 'APPROVED' ? '#16a34a' : step.status === 'REJECTED' ? '#dc2626' : '#6b7280',
                      }}>
                        {step.status === 'APPROVED' ? '✓' : step.status === 'REJECTED' ? '✕' : step.step_order}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{step.department}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>{step.role}</span>
                          {step.status === 'PENDING' && step.step_order > 1 && (
                            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, backgroundColor: '#f3f4f6', color: '#6b7280' }}>대기 중</span>
                          )}
                        </div>
                        {step.comment && (
                          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>💬 {step.comment}</p>
                        )}
                        {step.signed_at && (
                          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            {new Date(step.signed_at).toLocaleString('ko-KR')}
                          </p>
                        )}
                      </div>

                      {/* 승인 버튼 — 현재 PENDING인 첫 번째 단계만 활성화 */}
                      {step.status === 'PENDING' && (i === 0 || steps[i - 1]?.status === 'APPROVED') && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => doApprove(step.id)}
                            disabled={approving === step.id}
                            style={{
                              padding: '6px 14px', fontSize: 12, fontWeight: 500,
                              color: '#fff', backgroundColor: approving === step.id ? '#93c5fd' : '#1d4ed8',
                              border: 'none', borderRadius: 5, cursor: 'pointer',
                            }}
                          >
                            {approving === step.id ? '처리 중…' : '승인'}
                          </button>
                          <button
                            style={{
                              padding: '6px 12px', fontSize: 12, color: '#dc2626',
                              backgroundColor: '#fff', border: '1px solid #fecaca',
                              borderRadius: 5, cursor: 'pointer',
                            }}
                          >반려</button>
                        </div>
                      )}

                      {step.status === 'APPROVED' && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>승인 완료</span>
                      )}
                      {step.status === 'REJECTED' && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>반려</span>
                      )}
                    </div>

                    {/* 의견 입력 (현재 단계) */}
                    {step.status === 'PENDING' && (i === 0 || steps[i - 1]?.status === 'APPROVED') && (
                      <div style={{ marginTop: 12 }}>
                        <input
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          placeholder="검토 의견 입력 (선택)"
                          style={{
                            width: '100%', padding: '7px 10px', fontSize: 12,
                            border: '1px solid #e5e7eb', borderRadius: 5,
                            outline: 'none', color: '#374151',
                            boxSizing: 'border-box',
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                          onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 작은 헬퍼 컴포넌트 ──────────────────────────────────────────
function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: valueColor ?? '#374151', fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function DetailSection({ icon, title, color, children }: { icon: string; title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {icon} {title}
      </p>
      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{children}</p>
    </div>
  );
}
