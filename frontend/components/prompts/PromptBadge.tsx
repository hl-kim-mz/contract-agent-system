import type { ContractType } from '@/lib/api/prompts';

interface Props { contractType: ContractType; size?: 'sm' | 'md'; }

const CFG: Record<string, { label: string; color: string; bg: string }> = {
  default:     { label: 'Default',  color: '#1d4ed8', bg: '#eff6ff' },
  NDA:         { label: 'NDA',      color: '#dc2626', bg: '#fef2f2' },
  MSA:         { label: 'MSA',      color: '#16a34a', bg: '#f0fdf4' },
  SI:          { label: 'SI',       color: '#d97706', bg: '#fffbeb' },
  SLA:         { label: 'SLA',      color: '#0891b2', bg: '#ecfeff' },
  Maintenance: { label: 'MTC',      color: '#7c3aed', bg: '#f5f3ff' },
  Outsourcing: { label: 'OUT',      color: '#0f766e', bg: '#f0fdfa' },
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
