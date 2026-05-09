import type { ContractType } from '@/lib/api/prompts';
import DataPill from '@/components/ui/DataPill';

interface Props { contractType: ContractType; size?: 'sm' | 'md'; }

const CFG: Record<string, string> = {
  default:     '—',
  NDA:         'NDA',
  MSA:         'MSA',
  SI:          'SI',
  SLA:         'SLA',
  Maintenance: 'MNT',
  Outsourcing: 'OUT',
};

export default function PromptBadge({ contractType, size = 'sm' }: Props) {
  const label = CFG[contractType ?? 'default'] ?? '—';
  return (
    <DataPill size={size} style={{ color: '#94a3b8' }}>
      {label}
    </DataPill>
  );
}
