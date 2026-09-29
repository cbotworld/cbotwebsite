export const dynamic = 'force-dynamic';
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
            {`${site.organizationName} (${site.shortName}) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and process your personal information and data accessed through third-party services.`}
          </p>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">1. Information We Collect</h2>
            <p>
              We collect player profile information (name, username, email, WhatsApp phone number, and location) solely to manage tournament registrations, standings, schedules, leaderboard rankings, and match communication.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">2. YouTube API Services & Integration</h2>
            <p>
              Our application uses <strong>YouTube API Services</strong> to facilitate tournament live streaming, generate official match broadcasts, verify fair-play match gameplay, and archive match recordings.
            </p>
            <p>
              By using these features and our application, you acknowledge and agree that you are also bound by the{' '}
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
              For more information about how Google collects and uses your data, please review the{' '}
              <a
                href="http://www.google.com/policies/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold underline hover:text-amber-300"
              >
                Google Privacy Policy
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">3. YouTube Data Access, Storage & Deletion</h2>
            <p>
              When organizers and authorized tournament creators connect YouTube, our application accesses YouTube broadcast and stream metadata (such as broadcast title, live stream status, RTMP ingestion URL, stream keys, and video IDs) solely to initialize match streams and display live video feeds to viewers.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Data Storage:</strong> We do not store sensitive private Google credentials permanently. OAuth tokens are stored in an encrypted database strictly for the duration of the tournament broadcast session.
              </li>
              <li>
                <strong>Data Retention & Deletion:</strong> Broadcast identifiers are retained only as long as required for tournament record-keeping. You may request immediate deletion of any associated account data or stored video records at any time by contacting{' '}
                <a href="mailto:cbotworld@gmail.com" className="text-amber-400 font-bold underline">
                  cbotworld@gmail.com
                </a>
                .
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">4. Revocation of Access to Google & YouTube Data</h2>
            <p>
              You can revoke our application&apos;s access to your Google and YouTube account data at any time via the official{' '}
              <a
                href="https://security.google.com/settings/security/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 font-bold underline hover:text-amber-300"
              >
                Google Security Settings Permissions Page
              </a>
              .
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">5. Device Information, Cookies & Local Storage (Policy III.A.2g)</h2>
            <p>
              Our API Client and application store, access, and collect information directly or indirectly on or from users&apos; devices, including by placing, accessing, or recognizing cookies, local storage, session identifiers, and similar technologies on users&apos; browsers and mobile devices.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Purpose of Storage:</strong> We use cookies and device local storage to manage authentication sessions, remember user preferences, maintain live stream configurations, and ensure secure platform operations.
              </li>
              <li>
                <strong>Third-Party Technologies:</strong> We also allow third parties, specifically Google and YouTube API Services, to place, access, or recognize cookies and similar technologies on users&apos; devices or browsers when users interact with embedded video streams, broadcasts, or YouTube player components in accordance with the{' '}
                <a
                  href="http://www.google.com/policies/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 font-bold underline hover:text-amber-300"
                >
                  Google Privacy Policy
                </a>
                .
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">6. Data Protection & Sharing</h2>
            <p>
              We guarantee that your personal information is stored securely and is <strong>never shared, sold, or rented</strong> to third-party advertisers, data brokers, or external commercial organizations.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">7. Account Deletion & Data Rights</h2>
            <p>
              You have full control over your data. You can delete your account directly at any time inside the mobile application via <strong>Profile → Delete Account</strong> or by contacting us via email.
            </p>
            <p>
              Account deletion is immediate and permanent: your profile, login credentials, match scores, statistics, and tournament history are erased completely from our database.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-bold text-foreground">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, YouTube API data handling, or wish to delete your account, please email us directly at{' '}
              <a href="mailto:cbotworld@gmail.com" className="text-amber-400 font-bold underline">
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
            href="/terms"
            className="font-bold text-muted-foreground hover:text-amber-400 transition-colors"
          >
            Terms of Service →
          </Link>
        </div>

      </div>
    </div>
  );
}
