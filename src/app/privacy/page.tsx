import * as React from 'react';
import Link from 'next/link';
import { Shield, Lock, Eye, HeartHandshake, CheckCircle2, ArrowLeft, UserCheck } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — CBOT (Carrom Balu Online Tournament)',
  description: 'Official Privacy Policy and Data Protection Charter for CBOT carrom enthusiasts worldwide.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Back Link & Header */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to CBOT Home
          </Link>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Shield className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent tracking-tight">
                CBOT Privacy Policy
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
                Data Protection Charter & Sportsmanship Integrity Commitment
              </p>
            </div>
          </div>
        </div>

        {/* Summary Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <Lock className="h-4 w-4" /> Zero Third-Party Sharing
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your personal details are never sold, rented, or shared with third-party advertisers or external data brokers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Eye className="h-4 w-4" /> Confidential Competition Data
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Team combis, daily combis, and strategic match data remain strictly confidential until official cutoffs.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <HeartHandshake className="h-4 w-4" /> Pure Sportsmanship
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Player data is strictly used for tournament management—never weaponized or used against any team or player.
            </p>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-8 bg-card/40 border border-border/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">

          {/* Section 1: Ownership & Tournament Governance */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-amber-500" /> 1. Ownership & Governance
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              This website and the Carrom Balu Online Tournament (CBOT) ecosystem are founded, owned, and operated by <strong>Carrom Balu</strong>. Established in August 2020, CBOT is dedicated to connecting carrom enthusiasts worldwide under strict standards of integrity, transparency, and fair play.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 2: Data Collection & Tournament Purpose */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> 2. Data Collection & Purpose
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We collect limited personal information required solely for operating online carrom tournaments, including:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground pl-4 list-disc">
              <li><strong>Full Name & Unique Username:</strong> Used for player registration, leaderboards, and match brackets.</li>
              <li><strong>Email Address & WhatsApp Phone Number:</strong> Used exclusively for security PIN delivery, tournament schedule updates, and official match receipts.</li>
              <li><strong>Gender & Age:</strong> Referenced for demographic sports statistics and tournament division categorizations.</li>
              <li><strong>Geographic Location (City, State, Country):</strong> Used for regional player rankings and national carrom representation.</li>
            </ul>
          </section>

          <hr className="border-border/40" />

          {/* Section 3: Third-Party Non-Disclosure */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" /> 3. Third-Party Non-Disclosure Guarantee
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your privacy is paramount. CBOT guarantees that your personal data (including email, phone number, and account information) is <strong>never sold, rented, leased, or shared</strong> with third-party advertisers, commercial sponsors, or marketing agencies under any circumstances.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 4: Confidentiality of Competition & Combi Data */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" /> 4. Competition Data & Combi Confidentiality
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Daily team combis, secret board pattern configurations, and captain combi submissions are treated as confidential competition data:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground pl-4 list-disc">
              <li>Combi selections saved by captains are securely stored and hidden from rival teams prior to the official 9:30 PM IST daily cutoff.</li>
              <li>Match combis are never leaked or exposed to external parties prior to official match commencement.</li>
              <li>Official locked combi summary receipts are issued at 9:45 PM IST to captains and organizers simultaneously to guarantee equal transparency.</li>
            </ul>
          </section>

          <hr className="border-border/40" />

          {/* Section 5: Sportsmanship & Non-Adversarial Pledge */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-amber-500" /> 5. Sportsmanship & Non-Adversarial Data Pledge
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Carrom Balu and the CBOT organization adhere to the highest sportsmanlike principles. Competitor data, target scores, and average statistics are <strong>never weaponized, altered, or used against any team or player to cause them to lose or grant an unfair advantage to another team</strong>. All data processing is strictly objective, automated, and conducted on equal footing for all registered competitors.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 6: Security & Account Protection */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-amber-500" /> 6. Account Security & Contact
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Player security PINs are protected using one-way cryptographic hashing (Bcrypt). If you have questions regarding your data or wish to update your profile details, please contact tournament management at <strong className="text-amber-400">CBOTWORLD@GMAIL.COM</strong>.
            </p>
          </section>

        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-muted-foreground">
          Last Updated: August 2026 · Carrom Balu Online Tournament (CBOT) Official Privacy Policy
        </div>

      </div>
    </div>
  );
}
