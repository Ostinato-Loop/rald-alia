import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RALD ALIA — Financial Identity Infrastructure for Africa',
  description: 'Send money using email, phone, or username. No account numbers. Banking-grade alias resolution for 100M+ users.',
  keywords: ['open banking', 'alias resolution', 'fintech infrastructure', 'Nigeria', 'Africa', 'financial identity'],
  openGraph: {
    title: 'RALD ALIA',
    description: 'Financial Identity Infrastructure for Africa',
    url: 'https://raldalia.com',
    siteName: 'RALD ALIA',
    locale: 'en_NG',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
