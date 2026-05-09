'use client';

import type { PromptTemplate } from '@/lib/api/prompts';
import { formatRelativeTime } from '@/lib/api/prompts';
import PromptBadge from './PromptBadge';

interface PromptListProps {
  prompts: PromptTemplate[];
  selectedId: string | null;
  onSelect: (prompt: PromptTemplate) => void;
  onNew: () => void;
}

export default function PromptList({ prompts, selectedId, onSelect, onNew }: PromptListProps) {
  return (
    <aside
      style={{
        width: '320px',
        minWidth: '320px',
        height: '100%',
        backgroundColor: '#111113',
        borderRight: '1px solid #1E1E22',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          borderBottom: '1px solid #1E1E22',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#F0F0F1',
            letterSpacing: '-0.01em',
          }}
        >
          Prompts
        </span>
        <button
          onClick={onNew}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#F0F0F1',
            backgroundColor: '#5E6AD2',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6E7AE2';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#5E6AD2';
          }}
        >
          + New
        </button>
      </div>

      {/* 목록 */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          overflowY: 'auto',
          flex: 1,
        }}
      >
        {prompts.map((prompt) => {
          const isSelected = prompt.id === selectedId;
          return (
            <li key={prompt.id}>
              <button
                onClick={() => onSelect(prompt)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: isSelected ? '#1A1A2E' : 'transparent',
                  borderLeft: isSelected ? '2px solid #5E6AD2' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                  paddingLeft: isSelected ? '14px' : '14px',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16161A';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <PromptBadge contractType={prompt.contract_type} />
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#F0F0F1',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {prompt.prompt_name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#6B6B78',
                  }}
                >
                  {formatRelativeTime(prompt.updated_at)}
                </span>
              </button>
              <div style={{ height: '1px', backgroundColor: '#1E1E22', margin: '0 16px' }} />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
