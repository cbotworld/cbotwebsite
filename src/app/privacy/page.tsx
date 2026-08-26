import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { Metadata } from 'next';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getWebsiteCmsContent();
  return {
    title: `Privacy Policy — ${site.shortName}`,
    description: `Privacy Policy for ${site.shortName} (${site.organizationName}).`,
  };
}

export default async function PrivacyPolicyPage() {
  const { site } = await getWebsiteCmsContent();

  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 bg-card/40 border border-border/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-6">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 animate-pulse">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-muted-foreground">
              Last Updated: August 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            {`${site.organizationName} (${site.shortName}) is committed to protecting your privacy. This policy outlines how we handle player and participant information.`}
          </p>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">Information We Collect</h2>
            <p>
              We collect your name, username, email, WhatsApp phone number, and location solely to manage your registrations, standings, schedules, and profile on the tournament leaderboard.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">How We Use Your Data</h2>
            <p>
              Your data is used exclusively to facilitate fair-play tournament matchups, verify match streams, and distribute match login PIN notifications.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">Data Protection & Sharing</h2>
            <p>
              We guarantee that your personal information is stored securely and is <strong>never shared, sold, or rented</strong> to third-party sponsors, advertisers, or external organizations.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">Contact Us</h2>
            <p>
              If you have any questions or wish to delete your account, please email us directly at <span className="text-amber-400 font-bold">cbotworld@gmail.com</span>.
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="pt-4 border-t border-border/40">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Home
          </Link>
        </div>

      </div>
    </div>
  );
}
