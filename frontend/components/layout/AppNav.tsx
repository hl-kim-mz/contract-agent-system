'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/contracts',
    label: 'Contracts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    href: '/settings/prompts',
    label: 'Prompts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
      </svg>
    ),
  },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        width: '200px',
        minWidth: '200px',
        height: '100vh',
        backgroundColor: '#111113',
        borderRight: '1px solid #1E1E22',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 10,
      }}
    >
      {/* 로고 */}
      <div
        style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid #1E1E22',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: '#5E6AD2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#FFF',
            flexShrink: 0,
          }}
        >
          C
        </div>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#F0F0F1',
            letterSpacing: '-0.01em',
          }}
        >
          CAS
        </span>
      </div>

      {/* 네비게이션 항목 */}
      <div style={{ padding: '8px 8px', flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 8px',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#F0F0F1' : '#6B6B78',
                backgroundColor: isActive ? '#1E1E28' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                marginBottom: '2px',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#16161A';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#B0B0BA';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = '#6B6B78';
                }
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* 하단 버전 */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E1E22' }}>
        <span style={{ fontSize: '11px', color: '#3E3E46' }}>MEGATHON 2026</span>
      </div>
    </nav>
  );
}
