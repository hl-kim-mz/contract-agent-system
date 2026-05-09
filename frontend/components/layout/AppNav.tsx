'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/contracts',
    label: '계약서',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: '/settings/prompts',
    label: '프롬프트 설정',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
];

export default function AppNav() {
  const path = usePathname();

  return (
    <nav style={{
      width: 200,
      minWidth: 200,
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      backgroundColor: '#fff',
      borderRight: '1px solid #f1f5f9',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 로고 */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid #f8fafc',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          backgroundColor: '#334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          flexShrink: 0,
        }}>
          CAS
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, letterSpacing: '-0.01em' }}>계약 분석</div>
          <div style={{ fontSize: 10, color: '#cbd5e1', marginTop: 1, fontWeight: 400 }}>MZC · AI 리스크</div>
        </div>
      </div>

      {/* 섹션 레이블 */}
      <div style={{ padding: '16px 16px 6px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>메뉴</span>
      </div>

      {/* 메뉴 */}
      <div style={{ padding: '0 8px', flex: 1 }}>
        {NAV.map(item => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? '#0f172a' : '#64748b',
                backgroundColor: active ? '#f1f5f9' : 'transparent',
                marginBottom: 2,
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f8fafc'; (e.currentTarget as HTMLAnchorElement).style.color = '#334155'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'; } }}
            >
              <span style={{ color: active ? '#475569' : '#cbd5e1', flexShrink: 0, transition: 'color 0.12s' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* 푸터 */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #f8fafc' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>MEGATHON 2026</div>
        <div style={{ fontSize: 10, color: '#e2e8f0' }}>v0.1.0 · Mock 모드</div>
      </div>
    </nav>
  );
}
