'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cookie, X, Check } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'cbot_cookie_consent_v1';

export function CookieConsent() {
  const [showBanner, setShowBanner] = React.useState(false);

  React.useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        // Small timeout so it slides in smoothly after initial page render
        const timer = setTimeout(() => setShowBanner(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // LocalStorage unavailable (e.g. privacy mode)
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    } catch {}
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Cookie and Privacy Consent"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-slate-950/95 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl text-foreground text-xs space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Cookie className="h-4 w-4 text-amber-400" />
            </div>
            <span>Cookie &amp; Privacy Notice</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
            aria-label="Dismiss cookie notice"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          We use essential cookies and local storage to manage secure logins, tournament settings, and facilitate live YouTube match streams in accordance with our{' '}
          <Link
            href="/privacy"
            className="text-amber-400 underline font-semibold hover:text-amber-300"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleAccept}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shadow-md shadow-amber-500/20"
          >
            <Check className="h-3.5 w-3.5 stroke-[3]" />
            <span>Accept All</span>
          </button>
          <Link
            href="/privacy"
            className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground font-bold text-xs transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
