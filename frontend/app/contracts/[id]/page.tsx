'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getContractDetail, type ContractDetail }                       from '@/lib/api/contract-detail';
import { getRiskReport, RISK_LEVEL_CFG, RISK_TYPE_LABEL, type RiskReport } from '@/lib/api/risk-report';
import { getWorkflowSteps, approveStep, rejectStep, type WorkflowStep }  from '@/lib/api/workflow';
import { getDiffReport, DIFF_COLOR, type DiffReport }                   from '@/lib/api/diff';
import { searchHistory, type SearchResult }                             from '@/lib/api/search';
import { getContractText, CLAUSE_TYPE_LABEL, type ContractText }        from '@/lib/api/contract-text';
import CommentThread                                                    from '@/components/contracts/CommentThread';
import PromptBadge                                                      from '@/components/prompts/PromptBadge';
import DataPill                                                         from '@/components/ui/DataPill';
import type { ContractType }                                            from '@/lib/api/prompts';

type Tab = 'report' | 'text' | 'diff' | 'workflow' | 'comments';

const STATUS_STEPS = ['DRAFT','PARSING','RISK_REVIEWED','PENDING_APPROVAL','APPROVED'] as const;
const STATUS_LABEL: Record<string, string> = {
  DRAFT:'업로드', PARSING:'AI 분석', RISK_REVIEWED:'검토 대기', PENDING_APPROVAL:'결재 중', APPROVED:'승인 완료', REJECTED:'반려',
};

export default function ContractDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [report,   setReport]   = useState<RiskReport | null>(null);
  const [steps,    setSteps]    = useState<WorkflowStep[]>([]);
  const [diff,     setDiff]     = useState<DiffReport | null>(null);
  const [text,     setText]     = useState<ContractText | null>(null);
  const [tab,      setTab]      = useState<Tab>('report');
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [comment,   setComment]   = useState('');
  const [searchQ,   setSearchQ]   = useState('');
  const [searching, setSearching] = useState(false);
  const [searchRes, setSearchRes] = useState<SearchResult | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    const [c, r, s, d, t] = await Promise.all([
      getContractDetail(id), getRiskReport(id).catch(() => null),
      getWorkflowSteps(id), getDiffReport(id).catch(() => null), getContractText(id).catch(() => null),
    ]);
    setContract(c); setReport(r); setSteps(s); setDiff(d); setText(t);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadDetail().finally(() => setLoading(false));
  }, [id, loadDetail]);

  useEffect(() => {
    if (!contract) return;
    if (contract.status !== 'PARSING' && contract.status !== 'RISK_ANALYZING') return;
    const t = setInterval(() => loadDetail(), 3000);
    return () => clearInterval(t);
  }, [contract, loadDetail]);

  const doApprove = async (stepId: string) => {
    setApproving(stepId);
    try { const u = await approveStep(stepId, comment || '검토 완료. 승인합니다.'); setSteps(p => p.map(s => s.id === stepId ? u : s)); setComment(''); }
    finally { setApproving(null); }
  };
  const doReject = async (stepId: string) => {
    const reason = prompt('반려 사유:'); if (reason === null) return;
    setApproving(stepId);
    try { const u = await rejectStep(stepId, reason || '반려'); setSteps(p => p.map(s => s.id === stepId ? u : s)); }
    finally { setApproving(null); }
  };
  const doSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try { setSearchRes(await searchHistory(searchQ, contract?.customer_name)); }
    finally { setSearching(false); }
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#9ca3af', fontSize:13 }}>불러오는 중…</div>;
  if (!contract) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#9ca3af', fontSize:13 }}>계약서를 찾을 수 없습니다.</div>;

  const overallCfg = report ? RISK_LEVEL_CFG[report.overall_risk] : null;
  const statusIdx  = STATUS_STEPS.indexOf(contract.status as typeof STATUS_STEPS[number]);

  const tabs: [Tab, string][] = [
    ['report',   `리스크 리포트${report ? ` (${report.clause_risks.length})` : ''}`],
    ['text',     `원문 보기${text ? ` (${text.clauses.length}조)` : ''}`],
    ['diff',     diff ? `버전 비교 v${diff.from_version}→v${diff.to_version}` : '버전 비교'],
    ['workflow', `워크플로우 (${steps.length}단계)`],
    ['comments', '코멘트'],
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', backgroundColor:'#fff' }}>

      {/* ── 헤더 ── */}
      <div style={{ padding:'14px 24px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#fff', flexShrink:0 }}>
        {/* 브레드크럼 */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <button onClick={() => router.push('/contracts')} style={{ fontSize:12, color:'#6b7280', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            계약서 목록
          </button>
          <span style={{ color:'#d1d5db' }}>/</span>
          <span style={{ fontSize:12, color:'#374151', fontWeight:500 }}>{contract.file_name}</span>
        </div>

        {/* 메인 헤더 */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <PromptBadge contractType={contract.contract_type as ContractType} />
          <h1 style={{ fontSize:16, fontWeight:700, color:'#111827', margin:0 }}>{contract.file_name}</h1>
          <span style={{ fontSize:12, color:'#9ca3af', padding:'1px 6px', backgroundColor:'#f3f4f6', borderRadius:10 }}>v{contract.version}</span>
          {overallCfg && (
            <DataPill style={{ minWidth: 72, fontSize: 11, fontWeight: 600 }}>{overallCfg.label} 리스크</DataPill>
          )}
          {contract.status === 'REJECTED' && (
            <DataPill style={{ minWidth: 56, fontSize: 11, fontWeight: 600 }}>반려</DataPill>
          )}
          <div style={{ flex:1 }}/>
          <span style={{ fontSize:11, color:'#9ca3af' }}>{contract.uploaded_by} · {new Date(contract.uploaded_at).toLocaleDateString('ko-KR')}</span>
        </div>

        {/* 상태 Progress Bar */}
        {contract.status !== 'REJECTED' && (
          <div style={{ display:'flex', alignItems:'center', gap:0 }}>
            {STATUS_STEPS.map((s, i) => {
              const done = i < statusIdx;
              const active = i === statusIdx;
              return (
                <div key={s} style={{ display:'flex', alignItems:'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', backgroundColor: done ? '#1d4ed8' : active ? '#fff' : '#f3f4f6', border: active ? '2px solid #1d4ed8' : done ? '2px solid #1d4ed8' : '2px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color: done ? '#fff' : active ? '#1d4ed8' : '#9ca3af', flexShrink:0 }}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span style={{ fontSize:10, color: active ? '#1d4ed8' : done ? '#374151' : '#9ca3af', fontWeight: active ? 600 : 400, whiteSpace:'nowrap' }}>{STATUS_LABEL[s]}</span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div style={{ flex:1, height:2, backgroundColor: done ? '#1d4ed8' : '#e5e7eb', margin:'0 4px', marginBottom:16 }}/>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 본문 ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* 탭 바 */}
          <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', padding:'0 24px', backgroundColor:'#fff', flexShrink:0 }}>
            {tabs.map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:'11px 4px', marginRight:20, fontSize:13, fontWeight: tab===t ? 600 : 400, color: tab===t ? '#111827' : '#6b7280', borderBottom:`2px solid ${tab===t ? '#1d4ed8' : 'transparent'}`, background:'none', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
                {label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div style={{ flex:1, overflowY:'auto', padding: tab==='comments' ? '16px 24px' : '24px' }}>

            {/* ── 리스크 리포트 탭 ── */}
            {tab==='report' && (
              <div style={{ display:'flex', flexDirection:'column', gap:20, maxWidth:760 }}>
                {!report ? (
                  <EmptyState text="분석 결과가 없습니다." />
                ) : <>
                  {/* 전체 리스크 요약 카드 */}
                  <div style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ backgroundColor:'#fafafa', padding:'16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                        {overallCfg && <DataPill style={{ fontSize:11 }}>{overallCfg.label}</DataPill>}
                        <span style={{ fontSize:14, fontWeight:700, color:'#111827' }}>종합 평가</span>
                        <span style={{ fontSize:11, color:'#6b7280' }}>
                          {report.escalation_required ? '에스컬레이션 필요' : '담당자 승인 가능'}
                        </span>
                      </div>
                      <p style={{ fontSize:13, color:'#374151', lineHeight:1.7, margin:0 }}>{report.risk_summary}</p>
                    </div>
                    {report.key_concerns.length > 0 && (
                      <div style={{ padding:'14px 20px', borderTop:'1px solid #e5e7eb', backgroundColor:'#fff' }}>
                        <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>핵심 우려사항</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {report.key_concerns.map((c, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'#374151' }}>
                              <span style={{ color:'#9ca3af', fontWeight:600, fontSize:12, marginTop:1, flexShrink:0 }}>{i+1}.</span>
                              <span style={{ lineHeight:1.5 }}>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 계약 정보 요약 */}
                  <div style={{ display:'flex', gap:0, backgroundColor:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                    {[
                      ['고객사', contract.customer_name],
                      ['계약금액', contract.total_amount ? `${(contract.total_amount/1e8).toFixed(1)}억원` : '—'],
                      ['계약일', contract.dates?.contract_date ?? '—'],
                      ['종료일', contract.dates?.end_date ?? '—'],
                      ['비표준', report.is_standard_contract ? '표준' : '비표준'],
                    ].map(([l, v], i, arr) => (
                      <div key={l as string} style={{ flex:1, padding:'12px 16px', borderRight: i < arr.length-1 ? '1px solid #e5e7eb' : 'none' }}>
                        <p style={{ fontSize:10, color:'#9ca3af', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{l as string}</p>
                        <p style={{ fontSize:13, color:'#111827', fontWeight:600 }}>{v as string}</p>
                      </div>
                    ))}
                  </div>

                  {/* 조항별 리스크 목록 */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <h3 style={{ fontSize:14, fontWeight:600, color:'#111827', margin:0 }}>조항별 리스크</h3>
                      <div style={{ display:'flex', gap:6 }}>
                        {['HIGH','MEDIUM','LOW'].map(lvl => {
                          const cnt = report.clause_risks.filter(r => r.risk_level === lvl).length;
                          const cfg = RISK_LEVEL_CFG[lvl];
                          if (!cnt) return null;
                          return (
                            <DataPill key={lvl} style={{ minWidth: 48, fontSize: 10 }}>
                              {cfg.label} {cnt}
                            </DataPill>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {report.clause_risks.map(risk => {
                        const cfg = RISK_LEVEL_CFG[risk.risk_level];
                        const open = expanded === risk.clause_id;
                        return (
                          <div key={risk.clause_id} style={{ border:'1px solid #e5e7eb', borderRadius:7, overflow:'hidden', backgroundColor:'#fff' }}>
                            <button onClick={() => setExpanded(open ? null : risk.clause_id)}
                              style={{ display:'flex', alignItems:'center', width:'100%', padding:'12px 16px', gap:10, cursor:'pointer', background:'none', border:'none', textAlign:'left' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='#fafafa')}
                              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent')}>
                              <DataPill style={{ flexShrink:0 }}>{cfg.label}</DataPill>
                              <span style={{ fontSize:13, fontWeight:500, color:'#111827', flex:1 }}>{RISK_TYPE_LABEL[risk.risk_type] ?? risk.risk_type}</span>
                              <span style={{ fontSize:11, color:'#9ca3af', padding:'1px 6px', backgroundColor:'#f3f4f6', borderRadius:6, marginRight:4 }}>{risk.clause_id}</span>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform:open?'rotate(180deg)':'none', transition:'0.15s', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            {open && (
                              <div style={{ padding:'0 16px 16px', borderTop:'1px solid #f3f4f6' }}>
                                {[
                                  { label:'위험 근거', text:risk.reason, accent:'#6b7280', bg:'#fafafa' },
                                  { label:'수정 권고안', text:risk.recommendation, accent:'#6b7280', bg:'#fafafa' },
                                  { label:'재무 영향', text:risk.financial_impact, accent:'#6b7280', bg:'#fafafa' },
                                ].map(s => (
                                  <div key={s.label} style={{ marginTop:12, padding:'10px 12px', backgroundColor:s.bg, borderRadius:6 }}>
                                    <p style={{ fontSize:10, fontWeight:700, color:s.accent, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>{s.label}</p>
                                    <p style={{ fontSize:13, color:'#374151', lineHeight:1.65, margin:0 }}>{s.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {report.standard_deviation && (
                      <div style={{ marginTop:12, padding:'10px 14px', backgroundColor:'#f9fafb', borderRadius:6, border:'1px solid #e5e7eb', fontSize:12, color:'#6b7280' }}>
                        <strong style={{ color:'#374151' }}>MZC 표준 대비: </strong>{report.standard_deviation}
                      </div>
                    )}
                  </div>
                </>}
              </div>
            )}

            {/* ── 원문 텍스트 탭 ── */}
            {tab==='text' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:760 }}>
                {!text ? <EmptyState text="파싱된 원문 텍스트가 없습니다." /> : <>
                  {/* 추출 정보 */}
                  <div style={{ backgroundColor:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb', padding:'14px 16px' }}>
                    <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>추출된 계약 정보</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                      {Object.entries({
                        '갑 (이용자)': text.entities.party_a,
                        '을 (공급자)': text.entities.party_b,
                        '계약일':      text.entities.contract_date,
                        '계약금액':    text.entities.total_amount,
                        '계약기간':    text.entities.contract_period,
                      }).map(([l, v]) => {
                        const display = typeof v === 'object' && v !== null ? (v as { name: string }).name : v;
                        return display ? (
                          <div key={l} style={{ padding:'8px 10px', backgroundColor:'#fff', borderRadius:5, border:'1px solid #e5e7eb' }}>
                            <p style={{ fontSize:10, color:'#9ca3af', marginBottom:3 }}>{l}</p>
                            <p style={{ fontSize:12, color:'#111827', fontWeight:500 }}>{display}</p>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>

                  {/* 원문 미리보기 */}
                  <div style={{ padding:16, backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:8 }}>
                    <p style={{ fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>원문 앞부분</p>
                    <pre style={{ fontSize:12, color:'#374151', lineHeight:1.8, margin:0, whiteSpace:'pre-wrap', fontFamily:'-apple-system, sans-serif' }}>{text.raw_text_preview}</pre>
                  </div>

                  {/* 조항 목록 */}
                  <div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <h3 style={{ fontSize:14, fontWeight:600, color:'#111827', margin:0 }}>조항 목록 ({text.clauses.length}개)</h3>
                      <span style={{ fontSize:11, color:'#9ca3af' }}>리스크 조항에 배지가 표시됩니다</span>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {text.clauses.map(clause => {
                        const riskCfg = clause.has_risk && clause.risk_level ? RISK_LEVEL_CFG[clause.risk_level] : null;
                        const open = expanded === `text_${clause.id}`;
                        return (
                          <div key={clause.id} style={{ border:'1px solid #e5e7eb', borderRadius:7, overflow:'hidden', backgroundColor:'#fff' }}>
                            <button onClick={() => setExpanded(open ? null : `text_${clause.id}`)}
                              style={{ display:'flex', alignItems:'center', width:'100%', padding:'11px 14px', gap:10, cursor:'pointer', background:'none', border:'none', textAlign:'left' }}
                              onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='#fafafa')}
                              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent')}>
                              <span style={{ fontSize:13, fontWeight:600, color:'#111827', flex:1 }}>{clause.title}</span>
                              <span style={{ fontSize:10, color:'#9ca3af', padding:'1px 6px', backgroundColor:'#f3f4f6', borderRadius:6 }}>{CLAUSE_TYPE_LABEL[clause.type]}</span>
                              {riskCfg && <DataPill style={{ minWidth: 44, minHeight: 18, fontSize: 10 }}>{riskCfg.label}</DataPill>}
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform:open?'rotate(180deg)':'none', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            {open && (
                              <div style={{ padding:'12px 14px 14px', borderTop:'1px solid #f3f4f6' }}>
                                <p style={{ fontSize:13, color:'#374151', lineHeight:1.75, margin:0 }}>{clause.content}</p>
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

            {/* ── Diff 뷰 탭 ── */}
            {tab==='diff' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:900 }}>
                {!diff ? <EmptyState text="이전 버전이 없습니다." /> : <>
                  {/* Diff 요약 */}
                  <div style={{ display:'flex', gap:12, padding:'16px 20px', backgroundColor:'#fff', borderRadius:8, border:'1px solid #e5e7eb', alignItems:'center' }}>
                    <div style={{ textAlign:'center', padding:'0 16px', borderRight:'1px solid #e5e7eb' }}>
                      <p style={{ fontSize:10, color:'#9ca3af', marginBottom:4 }}>버전 비교</p>
                      <p style={{ fontSize:18, fontWeight:700, color:'#111827' }}>v{diff.from_version} → v{diff.to_version}</p>
                    </div>
                    <div style={{ textAlign:'center', padding:'0 16px', borderRight:'1px solid #e5e7eb' }}>
                      <p style={{ fontSize:10, color:'#9ca3af', marginBottom:4 }}>리스크 변화</p>
                      <p style={{ fontSize:14, fontWeight:700, color:'#111827' }}>{diff.risk_change}</p>
                    </div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:10, color:'#9ca3af', marginBottom:4 }}>변경 요약</p>
                      <p style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{diff.diff_summary}</p>
                    </div>
                  </div>

                  {/* 범례 */}
                  <div style={{ display:'flex', gap:8 }}>
                    {Object.entries(DIFF_COLOR).map(([k, c]) => (
                      <DataPill key={k} style={{ minWidth: 56, fontSize: 10, fontWeight: 500 }}>
                        {k==='ADDED' ? '+' : k==='REMOVED' ? '−' : k==='MODIFIED' ? '~' : '='} {c.label}
                      </DataPill>
                    ))}
                  </div>

                  {/* 조항별 Diff */}
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {diff.changes.map(ch => {
                      const cfg = DIFF_COLOR[ch.change_type];
                      const open = expanded === `diff_${ch.clause_id}`;
                      return (
                        <div key={ch.clause_id} style={{ border:'1px solid #e5e7eb', borderRadius:7, overflow:'hidden', backgroundColor:'#fff' }}>
                          <button onClick={() => setExpanded(open ? null : `diff_${ch.clause_id}`)}
                            style={{ display:'flex', alignItems:'center', width:'100%', padding:'12px 16px', gap:10, cursor:'pointer', background:'none', border:'none', textAlign:'left' }}
                            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='#fafafa')}
                            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.backgroundColor='transparent')}>
                            <DataPill style={{ flexShrink:0, fontSize:10 }}>{cfg.label}</DataPill>
                            <span style={{ fontSize:13, fontWeight:500, color:'#111827', flex:1 }}>{ch.title}</span>
                            {ch.risk_impact && ch.risk_impact !== '중립' && (
                              <DataPill style={{ minWidth: 72, marginRight:4, fontSize:10 }}>
                                {ch.risk_impact==='리스크 증가' ? '위험 증가' : '위험 감소'}
                              </DataPill>
                            )}
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform:open?'rotate(180deg)':'none', flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {open && (
                            <div style={{ borderTop:'1px solid #f3f4f6', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                              {ch.highlight && (
                                <div style={{ padding:'8px 12px', backgroundColor:'#fafafa', border:'1px solid #e5e7eb', borderRadius:6, fontSize:12, color:'#374151' }}>
                                  <strong style={{ color:'#6b7280' }}>주요 변경</strong> {ch.highlight}
                                </div>
                              )}
                              {ch.change_type !== 'UNCHANGED' ? (
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                                  {ch.previous_content && (
                                    <div>
                                      <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                                        이전 v{diff.from_version}
                                      </p>
                                      <div style={{ padding:'10px 12px', backgroundColor:'#fafafa', borderRadius:6, fontSize:12, color:'#374151', lineHeight:1.7, border:'1px solid #e5e7eb', whiteSpace:'pre-wrap' }}>
                                        {ch.previous_content}
                                      </div>
                                    </div>
                                  )}
                                  <div style={{ gridColumn: ch.previous_content ? 'auto' : '1 / -1' }}>
                                    <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                                      현재 v{diff.to_version}
                                    </p>
                                    <div style={{ padding:'10px 12px', backgroundColor:'#fafafa', borderRadius:6, fontSize:12, color:'#374151', lineHeight:1.7, border:'1px solid #e5e7eb', whiteSpace:'pre-wrap' }}>
                                      {ch.current_content}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding:'10px 12px', backgroundColor:'#f9fafb', borderRadius:6, fontSize:12, color:'#6b7280', lineHeight:1.7 }}>
                                  {ch.current_content}
                                </div>
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

            {/* ── 워크플로우 탭 ── */}
            {tab==='workflow' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:600 }}>
                <p style={{ fontSize:13, color:'#6b7280', margin:0 }}>리스크 수준에 따라 자동 배정된 검토 단계입니다.</p>
                {steps.length===0 ? <EmptyState text="검토 단계가 없습니다." /> : steps.map((step, i) => {
                  const isActive = step.status==='PENDING' && (i===0 || steps.filter(s => !s.is_parallel && s.step_order < step.step_order).every(s => s.status==='APPROVED'));
                  const done=step.status==='APPROVED', rej=step.status==='REJECTED';
                  return (
                    <div key={step.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:16, backgroundColor:'#fff', opacity: step.status==='PENDING' && !isActive ? 0.55 : 1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, backgroundColor:'#f3f4f6', color:'#4b5563', border:'1px solid #e5e7eb' }}>
                          {done ? '✓' : rej ? '×' : step.step_order}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                            <span style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{step.department}</span>
                            <span style={{ fontSize:11, color:'#9ca3af', padding:'1px 7px', backgroundColor:'#f3f4f6', borderRadius:10 }}>{step.role}</span>
                            {step.is_parallel && <DataPill style={{ minWidth: 40, minHeight: 18, fontSize: 10, fontWeight: 500 }}>병렬</DataPill>}
                          </div>
                          {step.comment && <p style={{ fontSize:12, color:'#6b7280', margin:'4px 0 0' }}>{step.comment}</p>}
                          {step.signed_at && <p style={{ fontSize:11, color:'#9ca3af', margin:'2px 0 0' }}>{new Date(step.signed_at).toLocaleString('ko-KR')}</p>}
                        </div>
                        {done && <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>승인 완료</span>}
                        {rej  && <span style={{ fontSize:13, fontWeight:600, color:'#374151' }}>반려</span>}
                        {!done && !rej && !isActive && <span style={{ fontSize:11, color:'#9ca3af' }}>대기 중</span>}
                        {isActive && (
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={() => doApprove(step.id)} disabled={approving===step.id}
                              style={{ padding:'7px 16px', fontSize:12, fontWeight:600, color:'#fff', backgroundColor: approving===step.id ? '#93c5fd' : '#1d4ed8', border:'none', borderRadius:6, cursor:'pointer' }}>
                              {approving===step.id ? '…' : '승인'}
                            </button>
                            <button onClick={() => doReject(step.id)} disabled={approving===step.id}
                              style={{ padding:'7px 14px', fontSize:12, color:'#374151', backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:6, cursor:'pointer' }}>
                              반려
                            </button>
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <div style={{ marginTop:10 }}>
                          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="검토 의견 입력 (선택)"
                            style={{ width:'100%', padding:'8px 12px', fontSize:12, border:'1px solid #e5e7eb', borderRadius:6, outline:'none', color:'#374151', boxSizing:'border-box' }}
                            onFocus={e => (e.currentTarget.style.borderColor='#3b82f6')} onBlur={e => (e.currentTarget.style.borderColor='#e5e7eb')} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 코멘트 탭 ── */}
            {tab==='comments' && <CommentThread contractId={id} currentUserId="usr_001" />}

          </div>
        </div>

        {/* ── 우측 검색 패널 ── */}
        <aside style={{ width:280, minWidth:280, borderLeft:'1px solid #e5e7eb', display:'flex', flexDirection:'column', backgroundColor:'#fafafa', height:'100%', overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e5e7eb' }}>
            <p style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>계약 이력 검색</p>
            <div style={{ display:'flex', gap:6 }}>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} onKeyDown={e => { if (e.key==='Enter') doSearch(); }} placeholder="과거 계약 이력 자연어 검색"
                style={{ flex:1, padding:'7px 10px', fontSize:12, border:'1px solid #d1d5db', borderRadius:5, outline:'none', color:'#111827', backgroundColor:'#fff' }}
                onFocus={e => (e.currentTarget.style.borderColor='#3b82f6')} onBlur={e => (e.currentTarget.style.borderColor='#d1d5db')} />
              <button onClick={doSearch} disabled={searching || !searchQ.trim()}
                style={{ padding:'7px 10px', fontSize:12, fontWeight:500, color:'#fff', backgroundColor: searching||!searchQ.trim() ? '#93c5fd' : '#1d4ed8', border:'none', borderRadius:5, cursor:'pointer', flexShrink:0 }}>
                {searching ? '…' : '검색'}
              </button>
            </div>
            <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
              {['CR 조항 이력', '배상 조항 변화', '지체상금 기준'].map(q => (
                <button key={q} onClick={() => setSearchQ(q)} style={{ fontSize:10, padding:'2px 7px', color:'#374151', backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:10, cursor:'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:16 }}>
            {searching && <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center', paddingTop:24 }}>검색 중…</p>}
            {!searching && searchRes && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ padding:'12px', backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:7 }}>
                  <p style={{ fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:6 }}>AI 답변</p>
                  <p style={{ fontSize:12, color:'#374151', lineHeight:1.65, margin:0 }}>{searchRes.answer}</p>
                </div>
                {searchRes.sources.length > 0 && (
                  <div>
                    <p style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>참조 계약서</p>
                    {searchRes.sources.map((s, i) => (
                      <div key={i} style={{ padding:'8px 10px', backgroundColor:'#fff', border:'1px solid #e5e7eb', borderRadius:5, marginBottom:4 }}>
                        <p style={{ fontSize:11, fontWeight:600, color:'#374151', marginBottom:3 }}>{s.customer_name} v{s.version}</p>
                        <p style={{ fontSize:11, color:'#6b7280', lineHeight:1.6, margin:0 }}>{s.clause_content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!searching && !searchRes && (
              <div style={{ textAlign:'center', paddingTop:40, color:'#d1d5db' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom:10 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style={{ fontSize:12, color:'#9ca3af', lineHeight:1.6 }}>과거 계약 이력을<br/>자연어로 검색하세요</p>
                <p style={{ fontSize:11, color:'#d1d5db', marginTop:6 }}>Bedrock KB 기반<br/>시맨틱 검색</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ textAlign:'center', paddingTop:60, color:'#9ca3af', fontSize:13 }}>{text}</div>;
}
