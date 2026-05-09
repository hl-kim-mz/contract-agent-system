import type { Metadata } from 'next';
import AppNav from '@/components/layout/AppNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'CAS — Contract Agent System',
  description: 'MZC 계약 리스크 분석',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <AppNav />
        <main style={{ flex: 1, marginLeft: '200px', minHeight: '100vh', backgroundColor: '#ffffff' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
