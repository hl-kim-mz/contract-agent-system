import type { CSSProperties, ReactNode } from 'react';

const sizes: Record<'sm' | 'md', CSSProperties> = {
  sm: { fontSize: 11, lineHeight: 1 },
  md: { fontSize: 12, lineHeight: 1 },
};

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  fontWeight: 600,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
  color: '#94a3b8',
  background: 'none',
  flexShrink: 0,
};

export default function DataPill({
  children,
  size = 'md',
  style,
}: {
  children: ReactNode;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  return <span style={{ ...base, ...sizes[size], ...style }}>{children}</span>;
}
