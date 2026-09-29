'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEFAULT_WEBSITE_CMS, type WebsiteFooterCms } from '@/lib/website-cms';

type FooterProps = {
  footerCms?: WebsiteFooterCms;
  brandName?: string;
};

// Official YouTube Brand Icon compliant with YouTube Developer Branding Guidelines (height >= 20px)
function OfficialYouTubeIcon({ className = 'h-5 w-7 shrink-0' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 20"
      width="28"
      height="20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ minHeight: '20px', minWidth: '28px' }}
    >
      <path
        d="M27.42 3.08a3.52 3.52 0 0 0-2.48-2.49C22.75 0 14 0 14 0S5.25 0 3.06.59A3.52 3.52 0 0 0 .58 3.08C0 5.28 0 10 0 10s0 4.72.58 6.92a3.52 3.52 0 0 0 2.48 2.49C5.25 20 14 20 14 20s8.75 0 10.94-.59a3.52 3.52 0 0 0 2.48-2.49C28 14.72 28 10 28 10s0-4.72-.58-6.92Z"
        fill="#FF0000"
      />
      <polygon points="11.2,14.3 18.5,10 11.2,5.7" fill="#FFFFFF" />
    </svg>
  );
}

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
            <div className="pt-1">
              <a
                href="https://www.youtube.com/@CBOTworld"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-400 hover:text-red-300 text-xs font-bold transition-all group shadow-xs"
                title="Watch CBOT World Matches on YouTube"
              >
                <OfficialYouTubeIcon className="h-5 w-7 shrink-0 group-hover:scale-105 transition-transform" />
                <span>Watch on YouTube (@CBOTworld)</span>
              </a>
            </div>
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
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground/80">
              <Link href="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link href="/terms" className="hover:text-amber-500 transition-colors">Terms of Service</Link>
              <span>·</span>
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition-colors"
              >
                YouTube Terms of Service
              </a>
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
