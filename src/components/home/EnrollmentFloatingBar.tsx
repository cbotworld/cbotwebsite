'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Trophy,
  X,
  Loader2,
  CreditCard,
  CheckCircle2,
  Copy,
  ExternalLink,
  User,
  Shield,
  PartyPopper,
  Sparkles,
  LayoutDashboard,
  ArrowRightLeft,
  Phone,
  Users,
  Search,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  enrollCurrentUser,
  getMyEnrollmentForEdition,
  getPublicEditionEnrolledPlayers,
} from '@/lib/actions/tournamentSlotActions';
import { formatEnrollmentFee } from '@/lib/tournament-slots';
import { toCalendarDate } from '@/lib/combi-cutoff';

type RegistrationEdition = {
  id: string;
  title: string;
  number: number;
  theme?: string | null;
  enrollmentFee?: number | null;
  registrationEndDate?: string | Date | null;
  paymentQrUrl?: string | null;
  paymentUpiLink?: string | null;
  paymentPhoneNumber?: string | null;
  intlPaymentQrUrl?: string | null;
  intlPaymentUpiLink?: string | null;
  intlPaymentPhone?: string | null;
  enrolledCount?: number;
  organizerName?: string | null;
};

type Step = 'confirm' | 'enrolling' | 'done' | 'already';

function formatEnrolledTimestamp(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getPlayerInitials(name?: string | null, username?: string | null): string {
  const raw = (name || username || '').trim();
  if (!raw) return 'PL';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0].replace(/[^a-zA-Z0-9]/g, '')[0];
    const second = parts[1].replace(/[^a-zA-Z0-9]/g, '')[0];
    if (first && second) return (first + second).toUpperCase();
  }
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length >= 2) return clean.slice(0, 2);
  if (clean.length === 1) return (clean + clean);
  return 'PL';
}

export default function EnrollmentFloatingBar({ edition }: { edition: RegistrationEdition }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [dismissed, setDismissed] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>('confirm');
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [copiedUpi, setCopiedUpi] = React.useState(false);
  const [copiedPhone, setCopiedPhone] = React.useState(false);
  const [transactionId, setTransactionId] = React.useState('');
  const [alreadyEnrolled, setAlreadyEnrolled] = React.useState(false);
  const [myParticipant, setMyParticipant] = React.useState<any>(null);
  const [checkingEnrollment, setCheckingEnrollment] = React.useState(false);
  const [paymentOption, setPaymentOption] = React.useState<'IN' | 'INTL'>('IN');

  // Enrolled players roster state
  const [rosterOpen, setRosterOpen] = React.useState(false);
  const [rosterLoading, setRosterLoading] = React.useState(false);
  const [enrolledPlayers, setEnrolledPlayers] = React.useState<any[]>([]);
  const [rosterCount, setRosterCount] = React.useState(edition.enrolledCount ?? 0);
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleOpenRosterModal = async () => {
    setRosterOpen(true);
    setSearchQuery('');
    setRosterLoading(true);
    const res = await getPublicEditionEnrolledPlayers(edition.id);
    if (res.success && res.players) {
      setEnrolledPlayers(res.players);
      setRosterCount(res.totalCount ?? res.players.length);
    }
    setRosterLoading(false);
  };

  const filteredPlayers = React.useMemo(() => {
    if (!searchQuery.trim()) return enrolledPlayers;
    const q = searchQuery.toLowerCase().trim();
    return enrolledPlayers.filter((p) => {
      const name = String(p.user?.name || '').toLowerCase();
      const username = String(p.user?.username || '').toLowerCase();
      const city = String(p.user?.city || '').toLowerCase();
      return name.includes(q) || username.includes(q) || city.includes(q);
    });
  }, [enrolledPlayers, searchQuery]);

  const handleGoToDashboard = () => {
    setModalOpen(false);
    router.push('/dashboard/player');
  };

  const fee = Number(edition.enrollmentFee) || 0;
  const isPaid = fee > 0;
  const txnReady = !isPaid || transactionId.trim().length > 0;
  const cutoff = edition.registrationEndDate
    ? toCalendarDate(edition.registrationEndDate)
    : null;
  const playerName =
    session?.user?.name?.trim() ||
    (session?.user as { username?: string } | undefined)?.username?.trim() ||
    'Player';
  const organizerName = edition.organizerName?.trim() || 'Organizer';
  
  const inPaymentQrUrl = edition.paymentQrUrl?.trim() || '';
  const inPaymentUpiLink = edition.paymentUpiLink?.trim() || '';
  const inPaymentPhone = edition.paymentPhoneNumber?.trim() || '';
  const intlPaymentQrUrl = edition.intlPaymentQrUrl?.trim() || '';
  const intlPaymentUpiLink = edition.intlPaymentUpiLink?.trim() || '';
  const intlPaymentPhone = edition.intlPaymentPhone?.trim() || '';

  const currentQrUrl = paymentOption === 'IN' ? inPaymentQrUrl : intlPaymentQrUrl;
  const currentUpiLink = paymentOption === 'IN' ? inPaymentUpiLink : intlPaymentUpiLink;
  const currentPhone = paymentOption === 'IN' ? inPaymentPhone : intlPaymentPhone;
  const hasAnyPaymentDetails = Boolean(
    inPaymentQrUrl || inPaymentUpiLink || inPaymentPhone || intlPaymentQrUrl || intlPaymentUpiLink || intlPaymentPhone
  );
  const hasCurrentPaymentDetails = Boolean(currentQrUrl || currentUpiLink || currentPhone);
  const canSubmit = !isPaid || (hasAnyPaymentDetails && txnReady);

  const getDirectPaymentUrl = () => {
    if (!currentUpiLink) return '';
    const trimmed = currentUpiLink.trim();
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('upi://')) {
      return trimmed;
    }
    if (paymentOption === 'IN') {
      const pa = encodeURIComponent(trimmed);
      const pn = encodeURIComponent(organizerName || 'CBOT Organizer');
      const am = fee > 0 ? `&am=${encodeURIComponent(fee.toString())}` : '';
      return `upi://pay?pa=${pa}&pn=${pn}${am}&cu=INR`;
    }
    return '';
  };

  const directPaymentUrl = getDirectPaymentUrl();

  React.useEffect(() => {
    if (status !== 'authenticated') {
      setAlreadyEnrolled(false);
      setMyParticipant(null);
      return;
    }
    let cancelled = false;
    const userId = (session?.user as any)?.id;
    (async () => {
      setCheckingEnrollment(true);
      const res = await getMyEnrollmentForEdition(edition.id, userId);
      if (!cancelled && res.success) {
        setAlreadyEnrolled(Boolean(res.enrolled));
        setMyParticipant(res.participant || null);
        if (res.enrolled) {
          setStep('already');
        }
      }
      if (!cancelled) setCheckingEnrollment(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, edition.id, session?.user]);

  // Only show on Website Home page ('/') - do NOT show on dashboard pages (player/organizer/captain) or other routes
  if (pathname !== '/') return null;

  // If dismissed - do NOT show this new edition enroll floating box
  if (dismissed) return null;

  const openModal = async () => {
    setError('');
    setCopiedUpi(false);
    setCopiedPhone(false);
    setTransactionId('');

    if (alreadyEnrolled) {
      setStep('already');
      setModalOpen(true);
      return;
    }

    if (status !== 'authenticated') {
      setStep('confirm');
      setModalOpen(true);
      return;
    }

    setCheckingEnrollment(true);
    const userId = (session?.user as any)?.id;
    const res = await getMyEnrollmentForEdition(edition.id, userId);
    setCheckingEnrollment(false);
    if (res.success && res.enrolled) {
      setAlreadyEnrolled(true);
      setMyParticipant(res.participant || null);
      setStep('already');
      setModalOpen(true);
      return;
    }
    setAlreadyEnrolled(false);
    setMyParticipant(null);
    setStep('confirm');
    setModalOpen(true);
  };

  const handleCopyUpi = async () => {
    if (!currentUpiLink) return;
    try {
      await navigator.clipboard.writeText(currentUpiLink);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      setError('Could not copy payment link. Please copy it manually.');
    }
  };

  const handleCopyPhone = async () => {
    if (!currentPhone) return;
    try {
      await navigator.clipboard.writeText(currentPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      setError('Could not copy phone number. Please copy it manually.');
    }
  };

  const handleEnroll = async () => {
    if (status !== 'authenticated') {
      setModalOpen(false);
      return;
    }
    if (isPaid && !transactionId.trim()) {
      setError('Enter your UPI transaction ID to continue.');
      return;
    }
    setError('');
    setStep('enrolling');
    const res = await enrollCurrentUser(
      edition.id,
      transactionId.trim(),
      paymentOption === 'IN' ? 'PRIMARY_UPI' : 'ALTERNATE_UPI'
    );
    if (res.success) {
      setAlreadyEnrolled(true);
      setStep('done');
      setSuccessMessage(res.message || 'You are enrolled!');
    } else if ((res.error || '').toLowerCase().includes('already enrolled')) {
      setAlreadyEnrolled(true);
      setStep('already');
    } else {
      setStep('confirm');
      setError(res.error || 'Enrollment failed.');
    }
  };

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 p-2 sm:p-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 rounded-2xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-emerald-500/20 p-3 sm:px-5 sm:py-4">
            
            {/* Top row on mobile, Left on desktop */}
            <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0 flex-1">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border ${alreadyEnrolled ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'}`}>
                  {alreadyEnrolled ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                      {alreadyEnrolled ? (
                        <>
                          <span>✓ You are Enrolled</span>
                          {myParticipant?.enrollmentNumber ? (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black text-[9.5px]">
                              #{myParticipant.enrollmentNumber}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        'Registration Open'
                      )}
                    </p>
                    {cutoff && !alreadyEnrolled ? (
                      <span className="text-[10px] text-muted-foreground hidden xs:inline">
                        · Closes {cutoff}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                    {edition.title} · Edition #{edition.number}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    {alreadyEnrolled ? (
                      <span className="text-emerald-300 font-semibold">Click to view registration receipt & status</span>
                    ) : (
                      <>
                        Fee: <strong className="text-emerald-400 font-bold">{formatEnrollmentFee(fee)}</strong>
                        {cutoff ? <span className="xs:hidden"> · Closes {cutoff}</span> : ''}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Close Button on mobile */}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="sm:hidden p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Action Buttons: 2-column full width on mobile, inline on desktop */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {/* Secondary Action: View Enrolled Players */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial text-[11px] sm:text-xs font-black border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg"
                onClick={() => void handleOpenRosterModal()}
              >
                <Users className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="truncate">Players</span>
                {rosterCount > 0 ? (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30 shrink-0">
                    {rosterCount}
                  </span>
                ) : null}
              </Button>

              {status === 'authenticated' ? (
                <Button
                  variant={alreadyEnrolled ? 'outline' : 'carrom'}
                  size="sm"
                  className={`flex-1 sm:flex-initial text-[11px] sm:text-xs font-black h-8 px-3 ${
                    alreadyEnrolled
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200'
                      : ''
                  }`}
                  disabled={checkingEnrollment}
                  onClick={() => void openModal()}
                >
                  {checkingEnrollment ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : alreadyEnrolled ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400 shrink-0" />
                      <span>My Enrollment</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="h-3 w-3 mr-1 shrink-0" /> Enroll Now
                    </>
                  )}
                </Button>
              ) : (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent('/')}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md h-8 px-3 text-[11px] sm:text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 hover:from-amber-400 hover:to-amber-600 shadow-lg shadow-amber-500/30 border border-amber-300/30"
                >
                  Login to Enroll
                </Link>
              )}

              {/* Close button on desktop */}
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="hidden sm:inline-flex p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-emerald-400" /> Enroll in {edition.title}
          </DialogTitle>
          <DialogDescription>
            Edition #{edition.number}
            {edition.theme ? ` · ${edition.theme}` : ''}
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Player
                </span>
                <span className="font-bold text-right truncate">{playerName}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> Organizer
                </span>
                <span className="font-bold text-right truncate">{organizerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrollment fee</span>
                <span className="font-black text-emerald-400">{formatEnrollmentFee(fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Queue Position</span>
                <span className="font-black text-amber-400">Enrollment #{rosterCount + 1}</span>
              </div>
              {cutoff && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registration closes</span>
                  <span className="font-bold">{cutoff}</span>
                </div>
              )}
            </div>

            {/* First-Come First-Served & Multiple of 8 Rule Notice */}
            <div className="rounded-xl border border-indigo-500/35 bg-indigo-500/10 p-3 text-xs text-indigo-200 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-black text-indigo-300 text-[11px] uppercase tracking-wider">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <span>First-Come, First-Served & Multiples of 8 Rule</span>
              </div>
              <p className="text-[11px] text-indigo-200/90 leading-normal">
                Players are admitted strictly on a first-come, first-served basis in <strong>multiples of 8</strong> (e.g. 8, 16, 24, 32). If you enroll late and registrations exceed a full multiple of 8, your enrollment can be cancelled by the organizer and your entry fee will be <strong>100% refunded</strong>.
              </p>
            </div>

            {isPaid && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                    Payment details
                  </p>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Fee: <strong className="text-emerald-400">{formatEnrollmentFee(fee)}</strong>
                  </span>
                </div>

                {/* Segmented Toggle: Primary vs Alternate */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-background/80 rounded-lg border border-border/70 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOption('IN');
                      setCopiedUpi(false);
                      setCopiedPhone(false);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
                      paymentOption === 'IN'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <span>🇮🇳</span>
                    <span>Primary</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOption('INTL');
                      setCopiedUpi(false);
                      setCopiedPhone(false);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
                      paymentOption === 'INTL'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    <span>Alternate Option</span>
                  </button>
                </div>

                {hasCurrentPaymentDetails ? (
                  <>
                    {currentQrUrl ? (
                      <div className="flex flex-col items-center gap-2 pt-1">
                        <img
                          src={currentQrUrl}
                          alt={paymentOption === 'IN' ? 'Primary Payment QR code' : 'Alternate Payment QR code'}
                          className="h-44 w-44 rounded-xl border border-border object-contain bg-white p-2 shadow-inner"
                        />
                        <p className="text-[11px] text-muted-foreground text-center">
                          Scan this {paymentOption === 'IN' ? 'UPI' : 'Payment'} QR to pay {formatEnrollmentFee(fee)}
                        </p>
                      </div>
                    ) : null}

                    {currentUpiLink ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase">
                            {paymentOption === 'IN' ? 'UPI ID / Payment Link' : 'Alternate UPI ID / Link'}
                          </p>
                          {directPaymentUrl && (
                            <span className="text-[10px] text-amber-400 font-medium">
                              Tap to open UPI app
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {directPaymentUrl ? (
                            <a
                              href={directPaymentUrl}
                              target={directPaymentUrl.startsWith('http') ? '_blank' : '_self'}
                              rel="noopener noreferrer"
                              className="group flex-1 flex items-center justify-between gap-2.5 rounded-lg border border-amber-500/40 bg-background/80 hover:bg-amber-500/10 hover:border-amber-500 px-3 py-2 text-xs font-semibold text-foreground transition-all shadow-sm cursor-pointer"
                            >
                              <span className="break-all font-mono text-amber-300 group-hover:text-amber-200">
                                {currentUpiLink}
                              </span>
                              <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded shadow-sm group-hover:bg-amber-400 transition-colors">
                                <ExternalLink className="h-3 w-3" />
                                Open UPI
                              </span>
                            </a>
                          ) : (
                            <div className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs break-all font-mono text-amber-300">
                              {currentUpiLink}
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0 border-border hover:border-amber-500"
                            onClick={() => void handleCopyUpi()}
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {currentPhone ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">
                          {paymentOption === 'IN' ? 'Payment Phone (GPay / PhonePe / Paytm)' : 'Alternate Phone (GPay / PhonePe / Paytm)'}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs font-semibold text-foreground">
                            <span className="font-mono text-amber-300 flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              {currentPhone}
                            </span>
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              GPay · PhonePe · Paytm
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs text-muted-foreground hover:text-foreground shrink-0 border-border hover:border-amber-500"
                            onClick={() => void handleCopyPhone()}
                            title="Copy Phone Number"
                          >
                            {copiedPhone ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <p className="text-[11px] text-muted-foreground">
                      Pay the organizer using the details above, then enter the payment phone number and payer name (or UPI Ref) below.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        Comments (Phone Number & Payer Name) <span className="text-rose-400">*</span>
                      </label>
                      <Input
                        value={transactionId}
                        onChange={(e) => {
                          setTransactionId(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="Enter phone number paid & name of person who paid (e.g. 9876543210 - Rahul)"
                        className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500"
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-xs text-amber-200/90 font-medium leading-relaxed">
                      {paymentOption === 'INTL'
                        ? '🔄 Alternate payment details have not been added yet by the organizer. You can switch to the 🇮🇳 Primary payment option above or contact the organizer.'
                        : '🇮🇳 Primary payment QR / UPI link has not been added yet by the organizer. Please contact the organizer before enrolling.'}
                    </p>
                    {hasAnyPaymentDetails && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                          Comments (Phone Number & Payer Name) <span className="text-rose-400">*</span>
                        </label>
                        <Input
                          value={transactionId}
                          onChange={(e) => {
                            setTransactionId(e.target.value);
                            if (error) setError('');
                          }}
                          placeholder="Enter phone number paid & name of person who paid (e.g. 9876543210 - Rahul)"
                          className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500"
                          autoComplete="off"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              {canSubmit ? (
                <Button
                  type="button"
                  variant="carrom"
                  size="sm"
                  className="font-black"
                  onClick={() => void handleEnroll()}
                >
                  {isPaid ? (
                    <>
                      <CreditCard className="h-3.5 w-3.5 mr-1" /> I&apos;ve Paid — Enroll
                    </>
                  ) : (
                    'Confirm Enrollment'
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {step === 'enrolling' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mx-auto" />
            <p className="text-sm font-bold">Enrolling {playerName}…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="relative overflow-hidden py-8 text-center space-y-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.25),transparent_55%)]" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-400/40 shadow-lg shadow-emerald-500/30">
              <PartyPopper className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="relative space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Registration Details Received</p>
              <h3 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
                Welcome, {playerName}! <Sparkles className="h-5 w-5 text-amber-400" />
              </h3>
              <p className="text-sm text-emerald-200/90 font-medium max-w-md mx-auto leading-relaxed">
                {isPaid
                  ? 'Your enrollment details and payment reference have been submitted. The organizer will crosscheck and verify the payment. If there are any issues, the organizer will contact you. Thank you so much!'
                  : `You are enrolled in ${edition.title}. Thank you so much!`}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                You can review your enrollment and update your payment reference ID anytime from your Player Dashboard.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={handleGoToDashboard}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md px-4 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-600"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Go to Player Dashboard
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}

        {step === 'already' && (
          <div className="relative overflow-hidden py-8 text-center space-y-4">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.2),transparent_55%)]" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/40 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="relative space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                  {myParticipant?.paymentStatus === 'VERIFIED' ? 'Payment Verified' : 'Already Enrolled'}
                </span>
                {myParticipant?.paymentStatus === 'VERIFIED' ? (
                  <Badge className="bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase">
                    ✅ Verified by Organizer
                  </Badge>
                ) : null}
                {myParticipant?.enrollmentNumber ? (
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                    Enrollment #{myParticipant.enrollmentNumber}
                  </Badge>
                ) : null}
              </div>
              <h3 className="text-xl font-black text-foreground">You are registered for {edition.title}</h3>
              <p className="text-sm text-emerald-200/90 max-w-md mx-auto leading-relaxed">
                {myParticipant?.paymentStatus === 'VERIFIED'
                  ? `Your payment has been verified by the organizer. You are officially confirmed for Edition #${edition.number}!`
                  : isPaid
                    ? 'Your enrollment details and payment reference have been received. The organizer will crosscheck and verify the payment.'
                    : `You are registered for Edition #${edition.number}. Thank you so much!`}
              </p>
              {myParticipant?.paymentTransactionId ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-border text-xs font-mono">
                  <span className="text-muted-foreground font-sans text-[11px] font-bold">Comments / Paid:</span>
                  <span className="text-sky-300 font-bold">{myParticipant.paymentTransactionId}</span>
                </div>
              ) : null}
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={handleGoToDashboard}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md px-4 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-600"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Go to Player Dashboard
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── ENROLLED PLAYERS ROSTER MODAL ────────────────────────────────────── */}
      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                Enrolled Players · Edition #{edition.number}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {edition.title} {rosterCount > 0 ? `· ${rosterCount} player${rosterCount === 1 ? '' : 's'} registered so far` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* FCFS Multiples of 8 Rule & Bracket Indicator */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-black text-indigo-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <span>First-Come, First-Served (Multiples of 8)</span>
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {rosterCount > 0 ? (
                  rosterCount % 8 === 0
                    ? `Full ${rosterCount / 8}x8 Bracket (${rosterCount} slots filled)`
                    : `Next 8-bracket: ${Math.ceil(rosterCount / 8) * 8} slots (${(Math.ceil(rosterCount / 8) * 8) - rosterCount} needed)`
                ) : '8 slots per bracket'}
              </span>
            </div>
            <p className="text-[11px] text-indigo-200/85 leading-relaxed">
              Numbered in chronological order of enrollment. Registrations beyond the final confirmed multiple of 8 are subject to organizer cancellation with a <strong>100% refund</strong>.
            </p>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search enrolled players by name, username, or city..."
              className="pl-9 h-9 text-xs bg-background/60 border-border"
            />
          </div>

          {/* Player list */}
          {rosterLoading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-muted-foreground font-bold">Loading enrolled players list…</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-border p-6 space-y-2">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-black text-foreground">
                {searchQuery ? 'No matching players found.' : 'No players enrolled yet.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {searchQuery
                  ? 'Try searching with a different name or keyword.'
                  : 'Be the first striker to register for this edition!'}
              </p>
            </div>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredPlayers.map((p, idx) => (
                <div
                  key={p.id || idx}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-card/60 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 via-amber-600/20 to-amber-700/25 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider select-none shadow-sm">
                      {getPlayerInitials(p.user?.name, p.user?.username)}
                      <span className="absolute -top-1.5 -left-1.5 px-1 py-0.2 rounded-md bg-amber-500 text-slate-950 text-[9px] font-black shadow-sm leading-tight border border-amber-300">
                        #{p.enrollmentNumber || (idx + 1)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-foreground truncate">
                          {p.user?.name || p.user?.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          @{p.user?.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                        {p.user?.city || p.user?.country ? (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground/70" />
                            {[p.user.city, p.user.country].filter(Boolean).join(', ')}
                          </span>
                        ) : null}
                        {p.enrolledAt ? (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            <Clock className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                            <span>{formatEnrolledTimestamp(p.enrolledAt)}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {p.category ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[9px] font-bold border-amber-500/30 text-amber-300">
                        {p.category}
                      </Badge>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground font-semibold">
              Total: <strong className="text-amber-400">{rosterCount}</strong> player{rosterCount === 1 ? '' : 's'} enrolled
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold"
                onClick={() => setRosterOpen(false)}
              >
                Close
              </Button>
              {!alreadyEnrolled ? (
                <Button
                  type="button"
                  variant="carrom"
                  size="sm"
                  className="h-8 text-xs font-black"
                  onClick={() => {
                    setRosterOpen(false);
                    void openModal();
                  }}
                >
                  <Trophy className="h-3.5 w-3.5 mr-1" /> Enroll Now
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
