import type { ContractType } from '@/lib/api/prompts';

interface PromptBadgeProps {
  contractType: ContractType;
  size?: 'sm' | 'md';
}

const BADGE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  default: { label: 'Default', bg: '#1A1A3E', text: '#5E6AD2', border: '#2D2D6B' },
  NDA:     { label: 'NDA',     bg: '#2D1215', text: '#E5484D', border: '#5C1F23' },
  MSA:     { label: 'MSA',     bg: '#0E2C1E', text: '#30A46C', border: '#1A5438' },
  SI:      { label: 'SI',      bg: '#2C1A0A', text: '#F76B15', border: '#5C3410' },
  SLA:     { label: 'SLA',     bg: '#0A1F30', text: '#0090FF', border: '#103D60' },
  Maintenance: { label: 'MTC', bg: '#1F0D2C', text: '#8E4EC6', border: '#3E1A58' },
};

export default function PromptBadge({ contractType, size = 'sm' }: PromptBadgeProps) {
  const key = contractType ?? 'default';
  const config = BADGE_CONFIG[key] ?? BADGE_CONFIG['default'];

  const padding = size === 'md' ? '3px 8px' : '2px 6px';
  const fontSize = size === 'md' ? '12px' : '11px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding,
        fontSize,
        fontWeight: 500,
        lineHeight: 1,
        borderRadius: '4px',
        backgroundColor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        letterSpacing: '0.02em',
        fontFamily: 'Inter, -apple-system, sans-serif',
        flexShrink: 0,
      }}
    >
      {config.label}
    </span>
  );
}
