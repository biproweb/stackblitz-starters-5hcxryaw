import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://portal-dmz.vercel.app'),
  title: 'Dashboards Grupo DMZ',
  description: 'Portal de dashboards Power BI Grupo DMZ',
  openGraph: {
    title: 'Dashboards Grupo DMZ',
    description: 'Portal de dashboards Power BI Grupo DMZ',
    siteName: 'Dashboards Grupo DMZ',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'DMZ Incorporadora' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
