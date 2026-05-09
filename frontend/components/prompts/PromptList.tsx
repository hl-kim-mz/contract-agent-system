'use client';

import type { PromptTemplate } from '@/lib/api/prompts';
import { formatRelativeTime } from '@/lib/api/prompts';
import PromptBadge from './PromptBadge';

interface Props {
  prompts: PromptTemplate[];
  selectedId: string | null;
  onSelect: (p: PromptTemplate) => void;
  onNew: () => void;
}

export default function PromptList({ prompts, selectedId, onSelect, onNew }: Props) {
  return (
    <aside style={{
      width: 280, minWidth: 280, height: '100%',
      backgroundColor: '#f9fafb',
      borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>프롬프트</span>
        <button
          onClick={onNew}
          style={{
            fontSize: 12, fontWeight: 500, color: '#1d4ed8',
            backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
          }}
        >+ 새로 만들기</button>
      </div>

      <ul style={{ listStyle: 'none', overflowY: 'auto', flex: 1 }}>
        {prompts.map(p => {
          const sel = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                onClick={() => onSelect(p)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '11px 16px', cursor: 'pointer', border: 'none',
                  backgroundColor: sel ? '#eff6ff' : 'transparent',
                  borderLeft: `2px solid ${sel ? '#1d4ed8' : 'transparent'}`,
                  paddingLeft: 14,
                }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                  <PromptBadge contractType={p.contract_type} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.prompt_name}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatRelativeTime(p.updated_at)}</span>
              </button>
              <div style={{ height: 1, backgroundColor: '#f3f4f6', margin: '0 16px' }} />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
