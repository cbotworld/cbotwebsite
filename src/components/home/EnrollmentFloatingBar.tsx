'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export default function EnrollmentFloatingBar({ edition }: { edition: RegistrationEdition }) {
  const router = useRouter();
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
      return;
    }
    let cancelled = false;
    (async () => {
      setCheckingEnrollment(true);
      const res = await getMyEnrollmentForEdition(edition.id);
      if (!cancelled && res.success) {
        setAlreadyEnrolled(Boolean(res.enrolled));
      }
      if (!cancelled) setCheckingEnrollment(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, edition.id]);

  if (dismissed) return null;

  const openModal = async () => {
    setError('');
    setCopiedUpi(false);
    setCopiedPhone(false);
    setTransactionId('');
    setModalOpen(true);

    if (status !== 'authenticated') return;

    setCheckingEnrollment(true);
    const res = await getMyEnrollmentForEdition(edition.id);
    setCheckingEnrollment(false);
    if (res.success && res.enrolled) {
      setAlreadyEnrolled(true);
      setStep('already');
      return;
    }
    setAlreadyEnrolled(false);
    setStep('confirm');
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
    const res = await enrollCurrentUser(edition.id, transactionId.trim());
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
      <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-md shadow-2xl shadow-emerald-500/20 px-4 py-3 sm:px-5 sm:py-4">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <Trophy className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                {alreadyEnrolled ? 'You are enrolled' : 'Registration Open'}
              </p>
              <p className="text-sm font-bold text-foreground truncate">
                {edition.title} · Edition #{edition.number}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Fee: {formatEnrollmentFee(fee)}
                {cutoff ? ` · Closes ${cutoff}` : ''}
              </p>
            </div>
            {/* Secondary Action: View Enrolled Players */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs font-black shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 gap-1.5 h-8 px-3 rounded-lg"
              onClick={() => void handleOpenRosterModal()}
            >
              <Users className="h-3.5 w-3.5 text-amber-400" />
              <span>Enrolled Players</span>
              {rosterCount > 0 ? (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                  {rosterCount}
                </span>
              ) : null}
            </Button>

            {status === 'authenticated' ? (
              <Button
                variant="carrom"
                size="sm"
                className="text-xs font-black shrink-0"
                disabled={checkingEnrollment}
                onClick={() => void openModal()}
              >
                {checkingEnrollment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : alreadyEnrolled ? (
                  'View Enrollment'
                ) : (
                  'Enroll Now'
                )}
              </Button>
            ) : (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent('/')}`}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-8 px-3 text-xs font-black shrink-0 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 hover:from-amber-400 hover:to-amber-600 shadow-lg shadow-amber-500/30 border border-amber-300/30"
              >
                Login to Enroll
              </Link>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
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
              {cutoff && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registration closes</span>
                  <span className="font-bold">{cutoff}</span>
                </div>
              )}
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
                      Pay the organizer using the details above, then enter your payment reference / transaction ID below.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        Transaction / Reference ID <span className="text-rose-400">*</span>
                      </label>
                      <Input
                        value={transactionId}
                        onChange={(e) => {
                          setTransactionId(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder={paymentOption === 'IN' ? 'Enter UPI transaction / UTR ID' : 'Enter payment reference / transaction ID'}
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
                          Transaction / Reference ID <span className="text-rose-400">*</span>
                        </label>
                        <Input
                          value={transactionId}
                          onChange={(e) => {
                            setTransactionId(e.target.value);
                            if (error) setError('');
                          }}
                          placeholder="Enter payment reference / transaction ID"
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
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,0.2),transparent_55%)]" />
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 border border-amber-400/40">
              <CheckCircle2 className="h-8 w-8 text-amber-300" />
            </div>
            <div className="relative space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Already Enrolled</p>
              <h3 className="text-xl font-black text-foreground">You are registered for {edition.title}</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isPaid
                  ? 'Your enrollment details are registered. The organizer will crosscheck and verify the payment details. If there are any issues, the organizer will contact you. Thank you so much!'
                  : `You are registered for Edition #${edition.number}. Thank you so much!`}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Need to edit or check your payment reference ID? View it anytime on your Player Dashboard.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                onClick={handleGoToDashboard}
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md px-4 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-600"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> View on Dashboard
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
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-black text-xs">
                      {p.user?.image ? (
                        <img
                          src={p.user.image}
                          alt={p.user.name || p.user.username}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ) : (
                        (p.user?.name?.[0] || p.user?.username?.[0] || 'P').toUpperCase()
                      )}
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
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5 text-muted-foreground/70" />
                            {new Date(p.enrolledAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                            })}
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
