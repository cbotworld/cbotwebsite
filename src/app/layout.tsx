import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { NavbarWithCms } from '@/components/layout/NavbarWithCms';
import { FooterWithCms } from '@/components/layout/FooterWithCms';
import { WhatsAppButtonWithCms } from '@/components/ui/WhatsAppButtonWithCms';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getWebsiteCmsContent();
  return {
    title: site.metaTitle,
    description: site.metaDescription,
    keywords: site.metaKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
    authors: [{ name: `${site.shortName} Team` }],
    icons: {
      icon: '/logo.png',
      shortcut: '/logo.png',
      apple: '/logo.png',
    },
    openGraph: {
      title: site.metaTitle,
      description: site.metaDescription,
      url: site.ogUrl,
      siteName: site.brandName,
      images: [{ url: '/logo.png', width: 500, height: 500, alt: `${site.organizationName} Logo` }],
      type: 'website',
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans flex min-h-screen flex-col bg-background text-foreground`}>
        <Providers>
          <NavbarWithCms />
          <main className="flex-1">{children}</main>
          <FooterWithCms />
          <WhatsAppButtonWithCms />
        </Providers>
      </body>
    </html>
  );
}
