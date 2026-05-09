import type { CSSProperties, ReactNode } from 'react';

/** 유형·리스크 등 테이블 배지 — 동일 규격·무테두리·중립 톤 */
const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minWidth: 52,
  minHeight: 20,
  padding: '0 6px',
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: '0.02em',
  color: '#4b5563',
  backgroundColor: '#f3f4f6',
  borderRadius: 3,
  flexShrink: 0,
};

export default function DataPill({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ ...base, ...style }}>{children}</span>;
}
