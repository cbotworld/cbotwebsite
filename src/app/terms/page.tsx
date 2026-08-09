import * as React from 'react';
import Link from 'next/link';
import { FileText, Shield, Scale, Clock, Award, ArrowLeft, Trophy } from 'lucide-react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions — CBOT (Carrom Balu Online Tournament)',
  description: 'Official Terms of Service, Tournament Rules, and Player Code of Conduct for CBOT.',
};

export default function TermsAndConditionsPage() {
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
              <FileText className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent tracking-tight">
                Terms & Conditions
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-semibold">
                CBOT Official Tournament Code of Conduct & Rules of Participation
              </p>
            </div>
          </div>
        </div>

        {/* Summary Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <Trophy className="h-4 w-4" /> Official Carrom Balu Cups
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All tournaments adhere to official multi-format round regulations (Singles, Doubles, Triples, Quadruples).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Clock className="h-4 w-4" /> 9:30 PM IST Daily Cutoff
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Team combi submissions lock strictly at 9:30 PM IST on event dates. No edits permitted past deadline.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <Scale className="h-4 w-4" /> Ethical Sportsmanship
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Strict fair play governance. Multi-accounting or unsportsmanlike behavior leads to immediate disqualification.
            </p>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8 bg-card/40 border border-border/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md">

          {/* Section 1: Acceptance of Terms & Tournament Governance */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" /> 1. Acceptance of Terms & Governance
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              By registering as a player, captain, or participant in the Carrom Balu Online Tournament (CBOT), you agree to abide by these Terms and Conditions. CBOT is founded, owned, and governed by <strong>Carrom Balu</strong>. All tournament directives are enforced with maximum sportsmanship and transparency.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 2: Player Registration & Credential Security */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" /> 2. Account Credentials & Security
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Each player is issued a Unique Username and 4-Digit Security PIN. Players and captains are responsible for maintaining the confidentiality of their PIN credentials. Sharing account credentials with unauthorized third parties or rival players is strictly prohibited.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 3: Daily Cutoff & Combi Submission Rules */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> 3. 9:30 PM IST Cutoff & Combi Locking
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              To maintain competitive fairness, daily team combi submissions must be saved by team captains prior to <strong>9:30 PM IST</strong> on each scheduled event day. Once 9:30 PM IST passes:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground pl-4 list-disc">
              <li>Combi lineups for that day are permanently locked and cannot be edited or resaved.</li>
              <li>An automated locked summary receipt is emailed at 9:45 PM IST to all captains and organizers.</li>
              <li>Late submissions will not be accepted under any circumstances to preserve match integrity.</li>
            </ul>
          </section>

          <hr className="border-border/40" />

          {/* Section 4: Player Code of Conduct & Anti-Cheating */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-500" /> 4. Player Code of Conduct & Anti-Cheating
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              CBOT maintains zero tolerance for unsportsmanlike behavior. Cheating, score falsification, multi-accounting, unapproved striker modifications, or abusive conduct towards fellow competitors or tournament officials will result in immediate disqualification, rating forfeiture, and permanent account suspension.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 5: Intellectual Property & Ownership */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> 5. Intellectual Property & Branding
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              All branding, logos, board pattern designs, tournament theme artwork, and software features of the CBOT platform are the exclusive intellectual property of Carrom Balu. Unauthorized reproduction or commercial exploitation is prohibited.
            </p>
          </section>

          <hr className="border-border/40" />

          {/* Section 6: Contact Information */}
          <section className="space-y-3">
            <h2 className="text-lg font-black text-amber-400 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" /> 6. Governance Enquiries
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              For any official tournament inquiries, disputes, or rule clarifications, please contact Tournament Director Carrom Balu at <strong className="text-amber-400">CBOTWORLD@GMAIL.COM</strong>.
            </p>
          </section>

        </div>

        {/* Footer Note */}
        <div className="text-center text-xs text-muted-foreground">
          Last Updated: August 2026 · Carrom Balu Online Tournament (CBOT) Terms & Conditions
        </div>

      </div>
    </div>
  );
}
