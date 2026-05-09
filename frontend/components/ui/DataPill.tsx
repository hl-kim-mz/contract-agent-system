import type { CSSProperties, ReactNode } from 'react';

const sizes: Record<'sm' | 'md', CSSProperties> = {
  /** 목록 테이블 유형·리스크·상태 */
  sm: {
    height: 16,
    padding: '0 5px',
    fontSize: 9,
    lineHeight: '16px',
    borderRadius: 2,
  },
  /** 상세 등 여유 있는 화면 */
  md: {
    height: 20,
    padding: '0 6px',
    fontSize: 10,
    lineHeight: '20px',
    borderRadius: 3,
  },
};

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  maxWidth: '100%',
  fontWeight: 500,
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  color: '#4b5563',
  backgroundColor: '#f3f4f6',
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
