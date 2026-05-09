'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContractType, PromptTemplate } from '@/lib/api/prompts';
import { updatePrompt, createPrompt, formatRelativeTime } from '@/lib/api/prompts';
import PromptBadge from './PromptBadge';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const TYPES: { value: ContractType; label: string }[] = [
  { value: null,           label: 'Default (전체 공통)' },
  { value: 'NDA',         label: 'NDA' },
  { value: 'MSA',         label: 'MSA' },
  { value: 'SI',          label: 'SI 도급' },
  { value: 'SLA',         label: 'SLA' },
  { value: 'Maintenance', label: '유지보수' },
];

interface Props { prompt: PromptTemplate | null; isNew: boolean; onSaved: (p: PromptTemplate) => void; }

export default function PromptEditor({ prompt, isNew, onSaved }: Props) {
  const [name, setName]           = useState('');
  const [ctype, setCtype]         = useState<ContractType>(null);
  const [body, setBody]           = useState('');
  const [status, setStatus]       = useState<SaveStatus>('idle');
  const [dirty, setDirty]         = useState(false);
  const [editName, setEditName]   = useState(false);
  const [savedAt, setSavedAt]     = useState<string | null>(null);
  const origRef = useRef<PromptTemplate | null>(null);

  useEffect(() => {
    if (prompt) { setName(prompt.prompt_name); setCtype(prompt.contract_type); setBody(prompt.system_prompt); setSavedAt(prompt.updated_at); origRef.current = prompt; }
    else if (isNew) { setName('새 프롬프트'); setCtype(null); setBody(''); setSavedAt(null); origRef.current = null; }
    setDirty(false); setStatus('idle'); setEditName(false);
  }, [prompt, isNew]);

  const mark = useCallback(() => setDirty(true), []);

  const save = async () => {
    setStatus('saving');
    try {
      const payload = { prompt_name: name, contract_type: ctype, system_prompt: body };
      const saved = isNew || !prompt ? await createPrompt(payload) : await updatePrompt(prompt.id, payload);
      setStatus('saved'); setDirty(false); setSavedAt(saved.updated_at); onSaved(saved);
      setTimeout(() => setStatus('idle'), 1500);
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2000); }
  };

  const reset = () => {
    if (!confirm('변경사항을 되돌리겠습니까?')) return;
    const o = origRef.current;
    if (o) { setName(o.prompt_name); setCtype(o.contract_type); setBody(o.system_prompt); setDirty(false); }
    else { setName('새 프롬프트'); setCtype(null); setBody(''); }
  };

  if (!prompt && !isNew) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
      <p style={{ fontSize: 13 }}>왼쪽에서 프롬프트를 선택하거나 새로 만드세요</p>
    </div>
  );

  const saveLabel = status === 'saving' ? '저장 중…' : status === 'saved' ? '저장됨 ✓' : status === 'error' ? '오류' : '저장';
  const saveBg = status === 'saved' ? '#16a34a' : status === 'error' ? '#dc2626' : '#1d4ed8';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#fff',
      }}>
        {editName ? (
          <input autoFocus value={name}
            onChange={e => { setName(e.target.value); mark(); }}
            onBlur={() => setEditName(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditName(false); }}
            style={{
              fontSize: 15, fontWeight: 600, color: '#111827',
              border: '1px solid #3b82f6', borderRadius: 4,
              padding: '3px 8px', outline: 'none', flex: 1, maxWidth: 280,
            }}
          />
        ) : (
          <span onClick={() => setEditName(true)} title="클릭하여 수정"
            style={{ fontSize: 15, fontWeight: 600, color: '#111827', cursor: 'text', borderBottom: '1px dashed #d1d5db', paddingBottom: 1 }}>
            {name}
          </span>
        )}

        <select value={ctype ?? ''} onChange={e => { setCtype((e.target.value || null) as ContractType); mark(); }}
          style={{ fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 8px', color: '#374151', backgroundColor: '#fff', cursor: 'pointer', outline: 'none' }}>
          {TYPES.map(t => <option key={String(t.value)} value={t.value ?? ''}>{t.label}</option>)}
        </select>
        <PromptBadge contractType={ctype} size="md" />

        <div style={{ flex: 1 }} />

        <button onClick={reset} disabled={!dirty}
          style={{ padding: '6px 12px', fontSize: 12, color: dirty ? '#374151' : '#d1d5db', backgroundColor: 'transparent', border: '1px solid #e5e7eb', borderRadius: 4, cursor: dirty ? 'pointer' : 'not-allowed' }}>
          초기화
        </button>
        <button onClick={save} disabled={status === 'saving'}
          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', backgroundColor: saveBg, border: 'none', borderRadius: 4, cursor: 'pointer', minWidth: 72 }}
          onMouseEnter={e => { if (status === 'idle') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1e40af'; }}
          onMouseLeave={e => { if (status === 'idle') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8'; }}>
          {saveLabel}
        </button>
      </div>

      {/* 에디터 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 20px', gap: 8, overflow: 'hidden' }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          System Prompt
        </label>
        <textarea value={body}
          onChange={e => { setBody(e.target.value); mark(); }}
          spellCheck={false}
          style={{
            flex: 1, minHeight: 400, width: '100%', padding: 16,
            fontSize: 13, lineHeight: 1.65, color: '#111827',
            backgroundColor: '#fafafa',
            border: '1px solid #e5e7eb', borderRadius: 6,
            outline: 'none', resize: 'vertical',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            boxSizing: 'border-box',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* 하단 */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 20px',
        borderTop: '1px solid #f3f4f6',
        backgroundColor: '#fafafa',
        gap: 12,
      }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{body.length.toLocaleString()} chars</span>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: dirty ? '#f59e0b' : '#9ca3af' }}>
            {dirty ? '● 미저장 변경사항' : savedAt ? `저장됨 · ${formatRelativeTime(savedAt)}` : ''}
          </span>
        </div>
        <button onClick={() => alert('테스트 기능 준비 중')}
          style={{ fontSize: 11, color: '#3b82f6', backgroundColor: 'transparent', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}>
          테스트 실행
        </button>
      </div>
    </div>
  );
}
