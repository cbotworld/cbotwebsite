import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'CBOT - Carrom Balu Online Tournament',
  description: 'The ultimate online Carrom esports tournament platform for Organizers, Captains, and Players. Live brackets, automated match scoring, and global leaderboards.',
  keywords: ['Carrom', 'CBOT', 'Carrom Balu', 'Online Tournament', 'Esports', 'Match Scoring', 'Tournament Brackets'],
  authors: [{ name: 'CBOT Team' }],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'CBOT - Carrom Balu Online Tournament',
    description: 'Competitive Carrom tournament portal with visual interactive brackets and real-time match statistics.',
    url: 'https://cbot.gg',
    siteName: 'CBOT Esports',
    images: [{ url: '/logo.png', width: 500, height: 500, alt: 'Carrom Balu Online Tournament Logo' }],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans flex min-h-screen flex-col bg-background text-foreground`}>
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
