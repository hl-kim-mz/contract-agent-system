'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ContractType, PromptTemplate } from '@/lib/api/prompts';
import { updatePrompt, createPrompt, formatRelativeTime } from '@/lib/api/prompts';
import PromptBadge from './PromptBadge';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: null,           label: 'Default (전체 공통)' },
  { value: 'NDA',         label: 'NDA' },
  { value: 'MSA',         label: 'MSA' },
  { value: 'SI',          label: 'SI 도급' },
  { value: 'SLA',         label: 'SLA' },
  { value: 'Maintenance', label: 'Maintenance' },
];

interface PromptEditorProps {
  prompt: PromptTemplate | null;
  isNew: boolean;
  onSaved: (saved: PromptTemplate) => void;
}

export default function PromptEditor({ prompt, isNew, onSaved }: PromptEditorProps) {
  const [name, setName]               = useState('');
  const [contractType, setContractType] = useState<ContractType>(null);
  const [body, setBody]               = useState('');
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle');
  const [isDirty, setIsDirty]         = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const originalRef = useRef<PromptTemplate | null>(null);

  // prompt 변경 시 폼 초기화
  useEffect(() => {
    if (prompt) {
      setName(prompt.prompt_name);
      setContractType(prompt.contract_type);
      setBody(prompt.system_prompt);
      setIsDirty(false);
      setSaveStatus('idle');
      setLastSavedAt(prompt.updated_at);
      originalRef.current = prompt;
    } else if (isNew) {
      setName('새 프롬프트');
      setContractType(null);
      setBody('');
      setIsDirty(false);
      setSaveStatus('idle');
      setLastSavedAt(null);
      originalRef.current = null;
    }
    setIsEditingName(false);
  }, [prompt, isNew]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const payload = { prompt_name: name, contract_type: contractType, system_prompt: body };
      let saved: PromptTemplate;
      if (isNew || !prompt) {
        saved = await createPrompt(payload);
      } else {
        saved = await updatePrompt(prompt.id, payload);
      }
      setSaveStatus('saved');
      setIsDirty(false);
      setLastSavedAt(saved.updated_at);
      onSaved(saved);
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleReset = () => {
    if (!window.confirm('저장하지 않은 변경사항이 사라집니다. 초기화하시겠습니까?')) return;
    const original = originalRef.current;
    if (original) {
      setName(original.prompt_name);
      setContractType(original.contract_type);
      setBody(original.system_prompt);
      setIsDirty(false);
    } else {
      setName('새 프롬프트');
      setContractType(null);
      setBody('');
    }
  };

  if (!prompt && !isNew) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
          color: '#6B6B78',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <p style={{ fontSize: '14px', margin: 0 }}>왼쪽 목록에서 프롬프트를 선택하거나 새로 만드세요</p>
      </div>
    );
  }

  const saveLabel = saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved ✓' : saveStatus === 'error' ? 'Error' : '저장';
  const saveBg    = saveStatus === 'saved' ? '#30A46C' : saveStatus === 'error' ? '#E5484D' : '#5E6AD2';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#0A0A0B',
      }}
    >
      {/* 상단 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          borderBottom: '1px solid #1E1E22',
          backgroundColor: '#111113',
        }}
      >
        {/* 이름 인라인 편집 */}
        {isEditingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); markDirty(); }}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false); }}
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#F0F0F1',
              backgroundColor: '#1E1E22',
              border: '1px solid #5E6AD2',
              borderRadius: '4px',
              padding: '4px 8px',
              outline: 'none',
              flex: 1,
              maxWidth: '320px',
              fontFamily: 'Inter, -apple-system, sans-serif',
            }}
          />
        ) : (
          <span
            onClick={() => setIsEditingName(true)}
            title="클릭하여 이름 편집"
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#F0F0F1',
              cursor: 'text',
              padding: '4px 0',
              borderBottom: '1px dashed #3E3E46',
            }}
          >
            {name}
          </span>
        )}

        {/* 계약 유형 드롭다운 */}
        <select
          value={contractType ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setContractType((v === '' ? null : v) as ContractType);
            markDirty();
          }}
          style={{
            fontSize: '13px',
            color: '#F0F0F1',
            backgroundColor: '#1E1E22',
            border: '1px solid #2E2E36',
            borderRadius: '4px',
            padding: '5px 8px',
            cursor: 'pointer',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          {CONTRACT_TYPES.map((ct) => (
            <option key={String(ct.value)} value={ct.value ?? ''}>
              {ct.label}
            </option>
          ))}
        </select>

        <PromptBadge contractType={contractType} size="md" />

        {/* 스페이서 */}
        <div style={{ flex: 1 }} />

        {/* 초기화 버튼 */}
        <button
          onClick={handleReset}
          disabled={!isDirty}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 500,
            color: isDirty ? '#6B6B78' : '#3E3E46',
            backgroundColor: 'transparent',
            border: '1px solid #2E2E36',
            borderRadius: '4px',
            cursor: isDirty ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          초기화
        </button>

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          style={{
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFFFFF',
            backgroundColor: saveBg,
            border: 'none',
            borderRadius: '4px',
            cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            minWidth: '80px',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
          onMouseEnter={(e) => {
            if (saveStatus === 'idle') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6E7AE2';
          }}
          onMouseLeave={(e) => {
            if (saveStatus === 'idle') (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#5E6AD2';
          }}
        >
          {saveLabel}
        </button>
      </div>

      {/* 에디터 영역 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          gap: '8px',
          overflow: 'hidden',
        }}
      >
        {/* 라벨 */}
        <label
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6B6B78',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          System Prompt
        </label>

        {/* Textarea */}
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); markDirty(); }}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight: '400px',
            width: '100%',
            padding: '16px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#F0F0F1',
            backgroundColor: '#0D0D0F',
            border: '1px solid #1E1E22',
            borderRadius: '6px',
            outline: 'none',
            resize: 'vertical',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            transition: 'border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#5E6AD2'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#1E1E22'; }}
        />
      </div>

      {/* 하단 상태바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 20px',
          borderTop: '1px solid #1E1E22',
          backgroundColor: '#111113',
          gap: '16px',
        }}
      >
        {/* 글자수 */}
        <span style={{ fontSize: '12px', color: '#6B6B78' }}>
          {body.length.toLocaleString()} chars
        </span>

        {/* 스페이서 */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6B6B78' }}>
            {isDirty ? '● 저장되지 않은 변경사항' : lastSavedAt ? `Saved ${formatRelativeTime(lastSavedAt)}` : ''}
          </span>
        </div>

        {/* 테스트 실행 버튼 */}
        <button
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#5E6AD2',
            backgroundColor: 'transparent',
            border: '1px solid #2D2D6B',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1A1A3E';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
          onClick={() => alert('테스트 실행 기능은 개발 예정입니다.')}
        >
          테스트 실행
        </button>
      </div>
    </div>
  );
}
