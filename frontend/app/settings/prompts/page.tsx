'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptTemplate } from '@/lib/api/prompts';
import { getPrompts } from '@/lib/api/prompts';
import PromptList from '@/components/prompts/PromptList';
import PromptEditor from '@/components/prompts/PromptEditor';

export default function PromptsPage() {
  const [prompts, setPrompts]       = useState<PromptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew]           = useState(false);
  const [dirty, setDirty]           = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    getPrompts().then(d => { setPrompts(d); if (d.length) setSelectedId(d[0].id); }).finally(() => setLoading(false));
  }, []);

  const select = useCallback((p: PromptTemplate) => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return;
    setSelectedId(p.id); setIsNew(false); setDirty(false);
  }, [dirty]);

  const newPrompt = useCallback(() => {
    if (dirty && !confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return;
    setSelectedId(null); setIsNew(true); setDirty(false);
  }, [dirty]);

  const saved = useCallback((p: PromptTemplate) => {
    setPrompts(prev => { const i = prev.findIndex(x => x.id === p.id); if (i >= 0) { const n = [...prev]; n[i] = p; return n; } return [p, ...prev]; });
    setSelectedId(p.id); setIsNew(false); setDirty(false);
  }, []);

  const selected = prompts.find(p => p.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#fff', fontFamily: '-apple-system, sans-serif' }}>
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          불러오는 중…
        </div>
      ) : (
        <>
          <PromptList prompts={prompts} selectedId={selectedId} onSelect={select} onNew={newPrompt} />
          <PromptEditor prompt={selected} isNew={isNew} onSaved={saved} />
        </>
      )}
    </div>
  );
}
