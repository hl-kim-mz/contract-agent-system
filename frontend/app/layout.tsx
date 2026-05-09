import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CAS — Contract Agent System',
  description: 'MZC 계약 리스크 분석 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" style={{ colorScheme: 'dark' }}>
      <body>{children}</body>
    </html>
  );
}
