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
  const [isDirtyGuard, setIsDirtyGuard] = useState(false);
  const [loading, setLoading]       = useState(true);

  // 초기 로드
  useEffect(() => {
    getPrompts().then((data) => {
      setPrompts(data);
      if (data.length > 0) setSelectedId(data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const selectedPrompt = prompts.find((p) => p.id === selectedId) ?? null;

  const handleSelect = useCallback(
    (prompt: PromptTemplate) => {
      if (isDirtyGuard) {
        if (!window.confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return;
      }
      setSelectedId(prompt.id);
      setIsNew(false);
      setIsDirtyGuard(false);
    },
    [isDirtyGuard]
  );

  const handleNew = useCallback(() => {
    if (isDirtyGuard) {
      if (!window.confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return;
    }
    setSelectedId(null);
    setIsNew(true);
    setIsDirtyGuard(false);
  }, [isDirtyGuard]);

  const handleSaved = useCallback((saved: PromptTemplate) => {
    setPrompts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setSelectedId(saved.id);
    setIsNew(false);
    setIsDirtyGuard(false);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#0A0A0B',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: '#F0F0F1',
        overflow: 'hidden',
      }}
    >
      {loading ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B6B78',
            fontSize: '14px',
          }}
        >
          Loading prompts...
        </div>
      ) : (
        <>
          <PromptList
            prompts={prompts}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNew={handleNew}
          />
          <PromptEditor
            prompt={selectedPrompt}
            isNew={isNew}
            onSaved={handleSaved}
          />
        </>
      )}
    </div>
  );
}
