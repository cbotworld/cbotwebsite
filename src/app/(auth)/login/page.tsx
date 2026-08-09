'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Lock, UserCheck, ArrowRight, AlertCircle, Shield, FileText, CheckCircle2, HeartHandshake, Eye, Scale, Clock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [policyModalOpen, setPolicyModalOpen] = React.useState(false);
  const [activePolicyTab, setActivePolicyTab] = React.useState<'PRIVACY' | 'TERMS'>('PRIVACY');
  const [pendingLogin, setPendingLogin] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // Prefetch home screen & dashboards in background to eliminate route transit latency
    router.prefetch('/');
    router.prefetch('/dashboard/organizer');
    router.prefetch('/dashboard/captain');
    router.prefetch('/dashboard/player');
  }, [router]);

  const executeLogin = async () => {
    setLoading(true);
    setErrorMsg('');

    const res = await signIn('credentials', {
      username,
      pin,
      redirect: false,
    });

    if (res?.ok) {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        const role = sessionData?.user?.role || 'PLAYER';

        if (role === 'ORGANIZER' || role === 'SUPER_ADMIN') {
          router.replace('/dashboard/organizer');
        } else if (role === 'CAPTAIN') {
          router.replace('/dashboard/captain');
        } else {
          router.replace('/dashboard/player');
        }
      } catch (e) {
        router.replace('/dashboard');
      }
    } else {
      setErrorMsg('Invalid Username or 4-Digit PIN. Please verify your credentials and try again.');
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setPendingLogin(true);
      setActivePolicyTab('PRIVACY');
      setPolicyModalOpen(true);
      return;
    }
    executeLogin();
  };

  const handleAcceptAndContinue = () => {
    setAcceptedTerms(true);
    setPolicyModalOpen(false);
    if (pendingLogin) {
      setPendingLogin(false);
      executeLogin();
    }
  };

  const openPolicyModal = (tab: 'PRIVACY' | 'TERMS') => {
    setActivePolicyTab(tab);
    setPolicyModalOpen(true);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      {/* Whole Screen Hero Centered Loading Overlay via Portal */}
      {mounted && loading && createPortal(
        <div className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-150">
          <div className="relative flex items-center justify-center p-6">
            <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin shadow-[0_0_60px_rgba(245,158,11,0.35)]" />
            <img
              src="/logo.png"
              alt="Carrom Balu Official Logo"
              className="absolute h-32 w-32 sm:h-36 sm:w-36 object-contain drop-shadow-[0_0_35px_rgba(245,158,11,0.85)] animate-pulse"
            />
          </div>
          <div className="space-y-1.5 text-center max-w-sm px-4">
            <h3 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent tracking-wide">
              Verifying &amp; Logging In…
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              Authenticating credentials &amp; loading your CBOT dashboard
            </p>
          </div>
        </div>,
        document.body
      )}

      <Card className="w-full max-w-md border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">CBOT Portal Login</CardTitle>
          <CardDescription className="text-xs">
            Enter your unique Username and 4-digit PIN
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold block mb-1">Unique Username</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="e.g. carrom balu"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">4-Digit Security PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="pl-9 font-mono tracking-widest text-lg font-bold"
                  placeholder="••••"
                  required
                />
              </div>
            </div>

            {/* Checkbox & Policy Links */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-amber-500 cursor-pointer"
                />
                <label htmlFor="acceptTerms" className="text-[11px] text-muted-foreground leading-snug cursor-pointer select-none">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={() => openPolicyModal('TERMS')}
                    className="font-bold text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  >
                    Terms & Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => openPolicyModal('PRIVACY')}
                    className="font-bold text-amber-400 underline underline-offset-2 hover:text-amber-300"
                  >
                    Privacy Policy
                  </button>
                  .
                </label>
              </div>

              <div className="flex justify-center gap-3 pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => openPolicyModal('PRIVACY')}
                  className="text-muted-foreground hover:text-amber-400 flex items-center gap-1 font-semibold transition-colors"
                >
                  <Shield className="h-3.5 w-3.5 text-amber-500" /> Privacy Policy
                </button>
                <span className="text-border">•</span>
                <button
                  type="button"
                  onClick={() => openPolicyModal('TERMS')}
                  className="text-muted-foreground hover:text-amber-400 flex items-center gap-1 font-semibold transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-500" /> Terms & Conditions
                </button>
              </div>
            </div>

            <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-amber-950" /> Verifying Credentials...
                </>
              ) : (
                <>
                  Log In with Username & PIN <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* POLICY & TERMS POPUP MODAL */}
      <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
        <div className="space-y-4 text-left">
          {/* Header Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setActivePolicyTab('PRIVACY')}
              className={`flex items-center gap-2 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all ${
                activePolicyTab === 'PRIVACY'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="h-4 w-4 text-amber-500" /> Privacy Policy
            </button>

            <button
              type="button"
              onClick={() => setActivePolicyTab('TERMS')}
              className={`flex items-center gap-2 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all ${
                activePolicyTab === 'TERMS'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="h-4 w-4 text-amber-500" /> Terms & Conditions
            </button>
          </div>

          {pendingLogin && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Please review and accept the Privacy Policy & Terms before entering the dashboard.</span>
            </div>
          )}

          {/* Modal Body Content */}
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-6 text-xs leading-relaxed text-muted-foreground scrollbar-thin scrollbar-thumb-amber-500/20">
            {activePolicyTab === 'PRIVACY' ? (
              <div className="space-y-6">
                {/* Summary Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                      <Lock className="h-3.5 w-3.5" /> Zero Third-Party Sharing
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Your personal details are never sold, rented, or shared with third-party advertisers or external data brokers.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <Eye className="h-3.5 w-3.5" /> Confidential Competition Data
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Team combis, daily combis, and strategic match data remain strictly confidential until official cutoffs.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                      <HeartHandshake className="h-3.5 w-3.5" /> Pure Sportsmanship
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Player data is strictly used for tournament management—never weaponized or used against any team or player.
                    </p>
                  </div>
                </div>

                {/* Full Un-shortened Policy Sections */}
                <div className="space-y-6 bg-card/40 border border-border/60 rounded-2xl p-5 shadow-inner">
                  {/* Section 1: Ownership & Governance */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-amber-500" /> 1. Ownership &amp; Governance
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      This website and the Carrom Balu Online Tournament (CBOT) ecosystem are founded, owned, and operated by <strong className="text-foreground">Carrom Balu</strong>. Established in August 2020, CBOT is dedicated to connecting carrom enthusiasts worldwide under strict standards of integrity, transparency, and fair play.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 2: Data Collection & Tournament Purpose */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" /> 2. Data Collection &amp; Purpose
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      We collect limited personal information required solely for operating online carrom tournaments, including:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground pl-4 list-disc">
                      <li><strong className="text-foreground">Full Name &amp; Unique Username:</strong> Used for player registration, leaderboards, and match brackets.</li>
                      <li><strong className="text-foreground">Email Address &amp; WhatsApp Phone Number:</strong> Used exclusively for security PIN delivery, tournament schedule updates, and official match receipts.</li>
                      <li><strong className="text-foreground">Gender &amp; Age:</strong> Referenced for demographic sports statistics and tournament division categorizations.</li>
                      <li><strong className="text-foreground">Geographic Location (City, State, Country):</strong> Used for regional player rankings and national carrom representation.</li>
                    </ul>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 3: Third-Party Non-Disclosure */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-500" /> 3. Third-Party Non-Disclosure Guarantee
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your privacy is paramount. CBOT guarantees that your personal data (including email, phone number, and account information) is <strong className="text-amber-400">never sold, rented, leased, or shared</strong> with third-party advertisers, commercial sponsors, or marketing agencies under any circumstances.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 4: Confidentiality of Competition & Combi Data */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Eye className="h-4 w-4 text-amber-500" /> 4. Competition Data &amp; Combi Confidentiality
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Daily team combis, secret board pattern configurations, and captain combi submissions are treated as confidential competition data:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground pl-4 list-disc">
                      <li>Combi selections saved by captains are securely stored and hidden from rival teams prior to the official 9:30 PM IST daily cutoff.</li>
                      <li>Match combis are never leaked or exposed to external parties prior to official match commencement.</li>
                      <li>Official locked combi summary receipts are issued at 9:45 PM IST to captains and organizers simultaneously to guarantee equal transparency.</li>
                    </ul>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 5: Sportsmanship & Non-Adversarial Pledge */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4 text-amber-500" /> 5. Sportsmanship &amp; Non-Adversarial Data Pledge
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Carrom Balu and the CBOT organization adhere to the highest sportsmanlike principles. Competitor data, target scores, and average statistics are <strong className="text-amber-400">never weaponized, altered, or used against any team or player to cause them to lose or grant an unfair advantage to another team</strong>. All data processing is strictly objective, automated, and conducted on equal footing for all registered competitors.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 6: Security & Account Protection */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-amber-500" /> 6. Account Security &amp; Contact
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Player security PINs are protected using one-way cryptographic hashing (Bcrypt). If you have questions regarding your data or wish to update your profile details, please contact tournament management at <strong className="text-amber-400">CBOTWORLD@GMAIL.COM</strong>.
                    </p>
                  </section>
                </div>

                <div className="text-center text-[11px] text-muted-foreground">
                  Last Updated: August 2026 · Carrom Balu Online Tournament (CBOT) Official Privacy Policy
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Summary Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                      <Shield className="h-3.5 w-3.5" /> Official Carrom Balu Cups
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      All tournaments adhere to official multi-format round regulations (Singles, Doubles, Triples, Quadruples).
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                      <Clock className="h-3.5 w-3.5" /> 9:30 PM IST Daily Cutoff
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Team combi submissions lock strictly at 9:30 PM IST on event dates. No edits permitted past deadline.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                      <Scale className="h-3.5 w-3.5" /> Ethical Sportsmanship
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Strict fair play governance. Multi-accounting or unsportsmanlike behavior leads to immediate disqualification.
                    </p>
                  </div>
                </div>

                {/* Full Un-shortened Terms Sections */}
                <div className="space-y-6 bg-card/40 border border-border/60 rounded-2xl p-5 shadow-inner">
                  {/* Section 1: Acceptance of Terms & Governance */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" /> 1. Acceptance of Terms &amp; Governance
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      By registering as a player, captain, or participant in the Carrom Balu Online Tournament (CBOT), you agree to abide by these Terms and Conditions. CBOT is founded, owned, and governed by <strong className="text-foreground">Carrom Balu</strong>. All tournament directives are enforced with maximum sportsmanship and transparency.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 2: Player Registration & Credential Security */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-amber-500" /> 2. Account Credentials &amp; Security
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Each player is issued a Unique Username and 4-Digit Security PIN. Players and captains are responsible for maintaining the confidentiality of their PIN credentials. Sharing account credentials with unauthorized third parties or rival players is strictly prohibited.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 3: Daily Cutoff & Combi Submission Rules */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" /> 3. 9:30 PM IST Cutoff &amp; Combi Locking
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      To maintain competitive fairness, daily team combi submissions must be saved by team captains prior to <strong className="text-amber-400">9:30 PM IST</strong> on each scheduled event day. Once 9:30 PM IST passes:
                    </p>
                    <ul className="space-y-1.5 text-xs text-muted-foreground pl-4 list-disc">
                      <li>Combi lineups for that day are permanently locked and cannot be edited or resaved.</li>
                      <li>An automated locked summary receipt is emailed at 9:45 PM IST to all captains and organizers.</li>
                      <li>Late submissions will not be accepted under any circumstances to preserve match integrity.</li>
                    </ul>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 4: Player Code of Conduct & Anti-Cheating */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Scale className="h-4 w-4 text-amber-500" /> 4. Player Code of Conduct &amp; Anti-Cheating
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      CBOT maintains zero tolerance for unsportsmanlike behavior. Cheating, score falsification, multi-accounting, unapproved striker modifications, or abusive conduct towards fellow competitors or tournament officials will result in immediate disqualification, rating forfeiture, and permanent account suspension.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 5: Intellectual Property & Ownership */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-amber-500" /> 5. Intellectual Property &amp; Branding
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All branding, logos, board pattern designs, tournament theme artwork, and software features of the CBOT platform are the exclusive intellectual property of Carrom Balu. Unauthorized reproduction or commercial exploitation is prohibited.
                    </p>
                  </section>

                  <hr className="border-border/40" />

                  {/* Section 6: Contact Information */}
                  <section className="space-y-2">
                    <h4 className="text-sm font-black text-amber-400 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" /> 6. Governance Enquiries
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      For any official tournament inquiries, disputes, or rule clarifications, please contact Tournament Director Carrom Balu at <strong className="text-amber-400">CBOTWORLD@GMAIL.COM</strong>.
                    </p>
                  </section>
                </div>

                <div className="text-center text-[11px] text-muted-foreground">
                  Last Updated: August 2026 · Carrom Balu Online Tournament (CBOT) Terms &amp; Conditions
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-end border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPolicyModalOpen(false)}
              className="text-xs font-bold"
            >
              Close
            </Button>
            <Button
              type="button"
              variant="carrom"
              size="sm"
              onClick={handleAcceptAndContinue}
              className="text-xs font-bold gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Accept &amp; Continue to Dashboard
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
