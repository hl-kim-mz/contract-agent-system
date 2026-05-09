'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  {
    href: '/contracts',
    label: '계약서',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      backgroundColor: '#f9fafb',
      borderRight: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 로고 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: '#1d4ed8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}>
          CAS
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>계약 분석</span>
      </div>

      {/* 메뉴 */}
      <div style={{ padding: '8px 8px', flex: 1 }}>
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
                borderRadius: 5,
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? '#1d4ed8' : '#374151',
                backgroundColor: active ? '#eff6ff' : 'transparent',
                marginBottom: 2,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f3f4f6'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent'; }}
            >
              <span style={{ color: active ? '#1d4ed8' : '#6b7280' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>MEGATHON 2026</span>
      </div>
    </nav>
  );
}
