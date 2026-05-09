import type { ContractType } from '@/lib/api/prompts';
import DataPill from '@/components/ui/DataPill';

interface Props { contractType: ContractType; size?: 'sm' | 'md'; }

const CFG: Record<string, { label: string }> = {
  default:     { label: '—' },
  NDA:         { label: 'NDA' },
  MSA:         { label: 'MSA' },
  SI:          { label: 'SI' },
  SLA:         { label: 'SLA' },
  Maintenance: { label: '유지보수' },
  Outsourcing: { label: '외주' },
};

export default function PromptBadge({ contractType, size = 'sm' }: Props) {
  const key = contractType ?? 'default';
  const cfg = CFG[key] ?? CFG['default'];
  const compact = size === 'sm';
  return <DataPill size={compact ? 'sm' : 'md'}>{cfg.label}</DataPill>;
}
