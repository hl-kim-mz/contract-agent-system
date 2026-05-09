import type { ContractType } from '@/lib/api/prompts';

interface Props { contractType: ContractType; size?: 'sm' | 'md'; }

// 모든 유형 동일 색상 — 심플하게
const CFG: Record<string, { label: string; color: string; bg: string }> = {
  default:     { label: 'Default',  color: '#374151', bg: '#f3f4f6' },
  NDA:         { label: 'NDA',      color: '#374151', bg: '#f3f4f6' },
  MSA:         { label: 'MSA',      color: '#374151', bg: '#f3f4f6' },
  SI:          { label: 'SI',       color: '#374151', bg: '#f3f4f6' },
  SLA:         { label: 'SLA',      color: '#374151', bg: '#f3f4f6' },
  Maintenance: { label: '유지보수', color: '#374151', bg: '#f3f4f6' },
  Outsourcing: { label: '외주',     color: '#374151', bg: '#f3f4f6' },
};

export default function PromptBadge({ contractType, size = 'sm' }: Props) {
  const key = contractType ?? 'default';
  const cfg = CFG[key] ?? CFG['default'];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'md' ? '3px 8px' : '2px 6px',
      fontSize: size === 'md' ? 12 : 11,
      fontWeight: 500,
      borderRadius: 4,
      color: cfg.color,
      backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      flexShrink: 0,
      letterSpacing: '0.01em',
    }}>
      {cfg.label}
    </span>
  );
}
