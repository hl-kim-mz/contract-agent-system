'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

// Feature별 분리된 API 레이어
import { getContractDetail, type ContractDetail }                      from '@/lib/api/contract-detail';
import { getRiskReport, RISK_LEVEL_CFG, RISK_TYPE_LABEL, type RiskReport } from '@/lib/api/risk-report';
import { getWorkflowSteps, approveStep, rejectStep, type WorkflowStep } from '@/lib/api/workflow';
import { getDiffReport, DIFF_COLOR, type DiffReport }                  from '@/lib/api/diff';
import { searchHistory, type SearchResult }                            from '@/lib/api/search';
import CommentThread                                                   from '@/components/contracts/CommentThread';
import PromptBadge                                                     from '@/components/prompts/PromptBadge';
import type { ContractType }                                           from '@/lib/api/prompts';

type Tab = 'report' | 'diff' | 'workflow' | 'comments';

export default function ContractDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [report,   setReport]   = useState<RiskReport | null>(null);
  const [steps,    setSteps]    = useState<WorkflowStep[]>([]);
  const [diff,     setDiff]     = useState<DiffReport | null>(null);
  const [tab,      setTab]      = useState<Tab>('report');
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [comment,   setComment]   = useState('');

  // 우측 검색 패널
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searching,    setSearching]    = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getContractDetail(id),
      getRiskReport(id),
      getWorkflowSteps(id),
      getDiffReport(id),
    ]).then(([c, r, s, d]) => {
      setContract(c); setReport(r); setSteps(s); setDiff(d);
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

  const doReject = async (stepId: string) => {
    const reason = prompt('반려 사유를 입력하세요:');
    if (reason === null) return;
    setApproving(stepId);
    try {
      const updated = await rejectStep(stepId, reason || '반려');
      setSteps(prev => prev.map(s => s.id === stepId ? updated : s));
    } finally { setApproving(null); }
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await searchHistory(searchQuery, contract?.customer_name);
      setSearchResult(result);
    } finally { setSearching(false); }
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

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff', flexShrink: 0 }}>
        <button onClick={() => router.push('/contracts')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          목록
        </button>
        <span style={{ color: '#d1d5db' }}>/</span>
        <PromptBadge contractType={contract.contract_type as ContractType} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{contract.file_name}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>v{contract.version}</span>
        {overallCfg && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', fontSize: 12, fontWeight: 600, borderRadius: 20, color: overallCfg.color, backgroundColor: overallCfg.bg, border: `1px solid ${overallCfg.border}` }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: overallCfg.color, display: 'inline-block' }}/>
            {overallCfg.label} 리스크
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{contract.uploaded_by} · {new Date(contract.uploaded_at).toLocaleDateString('ko-KR')}</span>
      </div>

      {/* ── 본문 ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* 탭 바 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px', backgroundColor: '#fff', flexShrink: 0 }}>
            {([
              ['report',   `리스크 리포트${report ? ` (${report.clause_risks.length})` : ''}`],
              ['diff',     diff ? `버전 비교 v${diff.from_version}→v${diff.to_version}` : '버전 비교'],
              ['workflow', `검토 워크플로우 (${steps.length}단계)`],
              ['comments', '💬 코멘트'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '11px 4px', marginRight: 20, fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? '#111827' : '#6b7280', borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`, background: 'none', border: 'none', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: tab === 'comments' ? '16px 24px' : 24 }}>

            {/* ── 리스크 리포트 ── */}
            {tab === 'report' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {!report ? (
                  <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 48 }}>분석 결과가 없습니다.</p>
                ) : <>
                  <div style={{ border: `1px solid ${overallCfg?.border}`, borderLeft: `3px solid ${overallCfg?.color}`, borderRadius: 7, padding: 16, backgroundColor: overallCfg?.bg }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: overallCfg?.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      {overallCfg?.label} 리스크 · {report.escalation_required ? '에스컬레이션 필요' : '자체 승인 가능'}
                    </p>
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, marginBottom: report.key_concerns.length ? 12 : 0 }}>{report.risk_summary}</p>
                    {report.key_concerns.length > 0 && (
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {report.key_concerns.map((c, i) => (
                          <li key={i} style={{ fontSize: 12, color: '#374151', display: 'flex', gap: 6 }}>
                            <span style={{ color: overallCfg?.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>{c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 20, padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 7, border: '1px solid #e5e7eb' }}>
                    {[
                      ['고객사', contract.customer_name],
                      ['금액', contract.total_amount ? `${(contract.total_amount / 100000000).toFixed(1)}억원` : '—'],
                      ['계약일', contract.dates?.contract_date ?? '—'],
                      ['종료일', contract.dates?.end_date ?? '—'],
                      ['비표준', report.is_standard_contract ? '표준' : '비표준'],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <p style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{l}</p>
                        <p style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                    조항별 리스크 <span style={{ color: '#9ca3af', fontWeight: 400 }}>({report.clause_risks.length}건)</span>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {report.clause_risks.map(risk => {
                      const cfg = RISK_LEVEL_CFG[risk.risk_level];
                      const open = expanded === risk.clause_id;
                      return (
                        <div key={risk.clause_id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden', backgroundColor: '#fff' }}>
                          <button onClick={() => setExpanded(open ? null : risk.clause_id)}
                            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '11px 14px', gap: 10, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}
                            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fafafa')}
                            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}>
                            <span style={{ padding: '1px 6px', fontSize: 10, fontWeight: 700, borderRadius: 3, color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>{cfg.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', flex: 1 }}>{RISK_TYPE_LABEL[risk.risk_type] ?? risk.risk_type}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 6 }}>{risk.clause_id}</span>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {open && (
                            <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {[['위험 근거', risk.reason, '#374151'], ['수정 권고', risk.recommendation, '#1d4ed8'], ['재무 영향', risk.financial_impact, '#d97706']].map(([title, text, color]) => (
                                <div key={title as string}>
                                  <p style={{ fontSize: 10, fontWeight: 600, color: color as string, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{title as string}</p>
                                  <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.65 }}>{text as string}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>}
              </div>
            )}

            {/* ── Diff 뷰 ── */}
            {tab === 'diff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!diff ? (
                  <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 48 }}>이전 버전이 없습니다.</p>
                ) : <>
                  <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: 7, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div><p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>버전 비교</p><p style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>v{diff.from_version} → v{diff.to_version}</p></div>
                    <div style={{ width: 1, height: 32, backgroundColor: '#e5e7eb' }} />
                    <div><p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>리스크 변화</p><p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{diff.risk_change}</p></div>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 12, color: '#374151' }}>{diff.diff_summary}</p></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {Object.entries(DIFF_COLOR).map(([key, cfg]) => (
                      <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: cfg.color, padding: '2px 8px', borderRadius: 4, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {diff.changes.map(change => {
                      const cfg = DIFF_COLOR[change.change_type];
                      const open = expanded === `diff_${change.clause_id}`;
                      return (
                        <div key={change.clause_id} style={{ border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: 6, overflow: 'hidden', backgroundColor: '#fff' }}>
                          <button onClick={() => setExpanded(open ? null : `diff_${change.clause_id}`)}
                            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '11px 14px', gap: 10, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }}
                            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fafafa')}
                            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent')}>
                            <span style={{ padding: '1px 6px', fontSize: 10, fontWeight: 700, borderRadius: 3, color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>{cfg.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', flex: 1 }}>{change.title}</span>
                            {change.risk_impact && <span style={{ fontSize: 11, color: change.risk_impact === '리스크 증가' ? '#dc2626' : '#16a34a', marginRight: 6 }}>{change.risk_impact === '리스크 증가' ? '↑' : '↓'} {change.risk_impact}</span>}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {open && (
                            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {change.highlight && (
                                <div style={{ padding: '8px 10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5, fontSize: 12, color: '#92400e' }}>⚠️ {change.highlight}</div>
                              )}
                              {change.change_type !== 'UNCHANGED' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                  {change.previous_content && (
                                    <div>
                                      <p style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>이전 (v{diff.from_version})</p>
                                      <div style={{ padding: '8px 10px', backgroundColor: '#fef2f2', borderRadius: 5, fontSize: 12, color: '#374151', lineHeight: 1.65, border: '1px solid #fecaca' }}>{change.previous_content}</div>
                                    </div>
                                  )}
                                  <div>
                                    <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>현재 (v{diff.to_version})</p>
                                    <div style={{ padding: '8px 10px', backgroundColor: '#f0fdf4', borderRadius: 5, fontSize: 12, color: '#374151', lineHeight: 1.65, border: '1px solid #bbf7d0' }}>{change.current_content}</div>
                                  </div>
                                </div>
                              ) : (
                                <p style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.65 }}>{change.current_content}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>}
              </div>
            )}

            {/* ── 워크플로우 ── */}
            {tab === 'workflow' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 580 }}>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>리스크 수준에 따라 자동 배정된 검토 단계입니다.</p>
                {steps.length === 0 ? <p style={{ color: '#9ca3af', fontSize: 13 }}>검토 단계가 없습니다.</p> : steps.map((step, i) => {
                  const isActive = step.status === 'PENDING' && (i === 0 || steps.filter(s => !s.is_parallel && s.step_order < step.step_order).every(s => s.status === 'APPROVED'));
                  return (
                    <div key={step.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, backgroundColor: '#fff', opacity: step.status === 'PENDING' && !isActive ? 0.55 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, backgroundColor: step.status === 'APPROVED' ? '#dcfce7' : step.status === 'REJECTED' ? '#fee2e2' : isActive ? '#eff6ff' : '#f3f4f6', color: step.status === 'APPROVED' ? '#16a34a' : step.status === 'REJECTED' ? '#dc2626' : isActive ? '#1d4ed8' : '#9ca3af' }}>
                          {step.status === 'APPROVED' ? '✓' : step.status === 'REJECTED' ? '✕' : step.step_order}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{step.department}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af', padding: '1px 6px', backgroundColor: '#f3f4f6', borderRadius: 10 }}>{step.role}</span>
                            {step.is_parallel && <span style={{ fontSize: 10, color: '#7c3aed', padding: '1px 6px', backgroundColor: '#f5f3ff', borderRadius: 10, border: '1px solid #ede9fe' }}>병렬</span>}
                          </div>
                          {step.comment && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>💬 {step.comment}</p>}
                          {step.signed_at && <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{new Date(step.signed_at).toLocaleString('ko-KR')}</p>}
                        </div>
                        {step.status === 'APPROVED' && <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>승인</span>}
                        {step.status === 'REJECTED' && <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>반려</span>}
                        {!step.status.includes('APPROVED') && !step.status.includes('REJECTED') && !isActive && <span style={{ fontSize: 11, color: '#9ca3af' }}>대기 중</span>}
                        {isActive && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => doApprove(step.id)} disabled={approving === step.id}
                              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', backgroundColor: approving === step.id ? '#93c5fd' : '#1d4ed8', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                              {approving === step.id ? '…' : '승인'}
                            </button>
                            <button onClick={() => doReject(step.id)} disabled={approving === step.id}
                              style={{ padding: '6px 12px', fontSize: 12, color: '#dc2626', backgroundColor: '#fff', border: '1px solid #fecaca', borderRadius: 5, cursor: 'pointer' }}>
                              반려
                            </button>
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <div style={{ marginTop: 10 }}>
                          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="검토 의견 입력 (선택)"
                            style={{ width: '100%', padding: '7px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 5, outline: 'none', color: '#374151', boxSizing: 'border-box' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 코멘트 ── */}
            {tab === 'comments' && (
              <div style={{ height: '100%' }}>
                <CommentThread contractId={id} currentUserId="usr_001" />
              </div>
            )}

          </div>
        </div>

        {/* ── 우측 검색 패널 ── */}
        <aside style={{ width: 280, minWidth: 280, borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>계약 이력 검색</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
                placeholder="예: CR 조항 과거 처리 방식"
                style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 5, outline: 'none', color: '#111827', backgroundColor: '#fff' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')} />
              <button onClick={doSearch} disabled={searching || !searchQuery.trim()}
                style={{ padding: '7px 10px', fontSize: 12, fontWeight: 500, color: '#fff', backgroundColor: searching || !searchQuery.trim() ? '#93c5fd' : '#1d4ed8', border: 'none', borderRadius: 5, cursor: 'pointer', flexShrink: 0 }}>
                {searching ? '…' : '검색'}
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {['CR 조항 이력', '배상 조항 변화', '지체상금 기준'].map(q => (
                <button key={q} onClick={() => setSearchQuery(q)}
                  style={{ fontSize: 10, padding: '2px 7px', color: '#374151', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {searching && <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingTop: 24 }}>검색 중…</p>}
            {!searching && searchResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: '10px 12px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', marginBottom: 6 }}>AI 답변</p>
                  <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.65 }}>{searchResult.answer}</p>
                </div>
                {searchResult.sources.length > 0 && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>참조 계약서</p>
                    {searchResult.sources.map((src, i) => (
                      <div key={i} style={{ padding: '8px 10px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, marginBottom: 4 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{src.customer_name} v{src.version}</p>
                        <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.6 }}>{src.clause_content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!searching && !searchResult && (
              <div style={{ textAlign: 'center', paddingTop: 32, color: '#d1d5db' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 8 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style={{ fontSize: 12, color: '#9ca3af' }}>과거 계약 이력을<br/>자연어로 검색하세요</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
