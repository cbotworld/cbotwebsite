export const dynamic = 'force-dynamic';
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { Metadata } from 'next';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getWebsiteCmsContent();
  return {
    title: `Terms of Service — ${site.shortName}`,
    description: `Terms of Service for ${site.shortName} (${site.organizationName}).`,
  };
}

export default async function TermsOfServicePage() {
  const { site } = await getWebsiteCmsContent();

  return (
    <div className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 bg-card/40 border border-border/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-6">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-muted-foreground">
              Last Updated: August 2026
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <p>
            {`Welcome to ${site.organizationName} (${site.shortName}). By accessing or using our tournament platform, website, and associated mobile applications, you agree to comply with and be bound by these Terms of Service.`}
          </p>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">1. Eligibility & Fair Play</h2>
            <p>
              Participants must provide accurate information during registration. All tournament matches are conducted under strict fair-play rules. Any manipulation of scores, unsporting behavior, or breach of tournament guidelines will result in disqualification.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">2. YouTube API Services & Third-Party Terms</h2>
            <p>
              Our application uses <strong>YouTube API Services</strong> to facilitate match video streaming, live broadcasts, and tournament video archiving.
            </p>
            <p>
              By accessing or using YouTube-enabled live stream features on our platform, you agree to be bound by the{' '}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold underline hover:text-amber-300"
              >
                YouTube Terms of Service
              </a>
              .
            </p>
            <p>
              Please also review the{' '}
              <a
                href="http://www.google.com/policies/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold underline hover:text-amber-300"
              >
                Google Privacy Policy
              </a>{' '}
              and our{' '}
              <Link href="/privacy" className="text-amber-400 font-bold underline hover:text-amber-300">
                Privacy Policy
              </Link>{' '}
              for details on data handling.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">3. User Conduct & Content</h2>
            <p>
              Users streaming matches or uploading video content agree not to broadcast any inappropriate, copyrighted (non-fair use), or offensive material. We reserve the right to terminate broadcast access or remove content violating these terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">4. Account Termination & Revocation</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate tournament regulations. Users who connect their Google/YouTube accounts may revoke permissions at any time via{' '}
              <a
                href="https://security.google.com/settings/security/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold underline hover:text-amber-300"
              >
                Google Security Settings
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">5. Contact Information</h2>
            <p>
              For any questions regarding these Terms of Service, please contact us at{' '}
              <a href="mailto:cbotworld@gmail.com" className="text-amber-400 font-bold">
                cbotworld@gmail.com
              </a>
              .
            </p>
          </div>
        </div>

        {/* Back link */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Home
          </Link>
          <Link
            href="/privacy"
            className="font-bold text-muted-foreground hover:text-amber-400 transition-colors"
          >
            ← Privacy Policy
          </Link>
        </div>

      </div>
    </div>
  );
}
