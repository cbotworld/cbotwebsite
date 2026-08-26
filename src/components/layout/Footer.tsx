'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_WEBSITE_CMS, type WebsiteFooterCms } from '@/lib/website-cms';

type FooterProps = {
  footerCms?: WebsiteFooterCms;
  brandName?: string;
};

export function Footer({
  footerCms = DEFAULT_WEBSITE_CMS.footer,
  brandName = DEFAULT_WEBSITE_CMS.site.brandName,
}: FooterProps) {
  const pathname = usePathname();
  if (pathname?.includes('/live')) {
    return null;
  }
  return (
    <footer className="w-full border-t border-border/40 bg-card/60 backdrop-blur-md pt-12 pb-8 text-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">

          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Carrom Balu Logo" className="h-10 w-10 object-contain drop-shadow-md" />
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                {brandName}
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-sm">
              {footerCms.brandDescription}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-3 text-xs uppercase tracking-wider text-amber-500">
              Download Mobile App
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="https://apps.apple.com/us/app/cbot-world/id6803811587"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 shrink-0 items-center leading-none opacity-95 transition-opacity hover:opacity-100"
                aria-label="Download on the App Store"
              >
                <img
                  src="/badges/app-store.png"
                  alt="Download on the App Store"
                  className="block h-10 w-auto object-contain"
                  width={120}
                  height={40}
                />
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.cbotworld"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 shrink-0 items-center leading-none opacity-95 transition-opacity hover:opacity-100"
                aria-label="Get it on Google Play"
              >
                <img
                  src="/badges/google-play.png"
                  alt="Get it on Google Play"
                  className="block h-7 w-auto object-contain"
                  width={126}
                  height={28}
                />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-amber-500">
              {footerCms.governanceHeading}
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-sm font-semibold">
              {footerCms.governanceText}
            </p>
            <div className="pt-1">
              <a
                href={footerCms.footerSponsorLink}
                className="inline-flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 transition-all text-xs font-bold text-emerald-400 group"
              >
                {footerCms.footerSponsorLogoUrl ? (
                  <img src={footerCms.footerSponsorLogoUrl} alt={footerCms.footerSponsorName} className="h-7 w-7 rounded-full object-contain border border-emerald-500/50" />
                ) : null}
                <div>
                  <div className="text-[10px] text-amber-400 font-extrabold uppercase leading-tight">{footerCms.footerSponsorLabel}</div>
                  <div className="group-hover:underline">{footerCms.footerSponsorName}</div>
                </div>
              </a>
            </div>
          </div>

        </div>

        <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <p>{footerCms.copyrightText}</p>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm text-muted-foreground">{footerCms.developerCredit}</span>
            <a
              href={footerCms.developerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center transition-transform hover:scale-105"
              title="Visit developer"
            >
              <img src={footerCms.developerLogoUrl} alt="Developer" className="h-8 sm:h-10 w-auto object-contain drop-shadow-md" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
