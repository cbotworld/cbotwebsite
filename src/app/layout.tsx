import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { FooterWithCms } from '@/components/layout/FooterWithCms';
import { WhatsAppButton } from '@/components/ui/WhatsAppButton';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'CBOT World - Carrom Balu Online Tournament',
  description: 'The ultimate online Carrom esports tournament platform for Organizers, Captains, and Players. Live brackets, automated match scoring, and global leaderboards.',
  keywords: ['Carrom', 'CBOT', 'CBOT World', 'Carrom Balu', 'Online Tournament', 'Esports', 'Match Scoring', 'Tournament Brackets'],
  authors: [{ name: 'CBOT Team' }],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'CBOT World - Carrom Balu Online Tournament',
    description: 'Competitive Carrom tournament portal with visual interactive brackets and real-time match statistics.',
    url: 'https://cbot.gg',
    siteName: 'CBOT World',
    images: [{ url: '/logo.png', width: 500, height: 500, alt: 'Carrom Balu Online Tournament Logo' }],
    type: 'website',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans flex min-h-screen flex-col bg-background text-foreground`}>
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <FooterWithCms />
          <WhatsAppButton />
        </Providers>
      </body>
    </html>
  );
}
