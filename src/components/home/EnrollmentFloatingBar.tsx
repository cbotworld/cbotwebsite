'use client';

import * as React from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  enrollCurrentUser,
  getMyEnrollmentForEdition,
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
  organizerName?: string | null;
};

type Step = 'confirm' | 'enrolling' | 'done' | 'already';

export default function EnrollmentFloatingBar({ edition }: { edition: RegistrationEdition }) {
  const { data: session, status } = useSession();
  const [dismissed, setDismissed] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>('confirm');
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [transactionId, setTransactionId] = React.useState('');
  const [alreadyEnrolled, setAlreadyEnrolled] = React.useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = React.useState(false);

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
  const paymentQrUrl = edition.paymentQrUrl?.trim() || '';
  const paymentUpiLink = edition.paymentUpiLink?.trim() || '';
  const hasPaymentDetails = Boolean(paymentQrUrl || paymentUpiLink);
  const canSubmit = !isPaid || (hasPaymentDetails && txnReady);

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
    setCopied(false);
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
    if (!paymentUpiLink) return;
    try {
      await navigator.clipboard.writeText(paymentUpiLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy UPI link. Please copy it manually.');
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
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <p className="text-xs font-black uppercase tracking-wide text-amber-400">
                  Payment details
                </p>
                {hasPaymentDetails ? (
                  <>
                    {paymentQrUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={paymentQrUrl}
                          alt="Payment QR code"
                          className="h-44 w-44 rounded-xl border border-border object-contain bg-white p-2"
                        />
                        <p className="text-[11px] text-muted-foreground text-center">
                          Scan this QR to pay {formatEnrollmentFee(fee)}
                        </p>
                      </div>
                    ) : null}
                    {paymentUpiLink ? (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">UPI / Payment link</p>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs break-all font-medium">
                          {paymentUpiLink}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => void handleCopyUpi()}>
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            {copied ? 'Copied' : 'Copy link'}
                          </Button>
                          {/^https?:\/\//i.test(paymentUpiLink) || paymentUpiLink.startsWith('upi://') ? (
                            <a
                              href={paymentUpiLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 rounded-md border border-border h-8 px-3 text-xs font-bold hover:bg-white/5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Open link
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      Pay the organizer using the details above, then enter your UPI transaction ID.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                        UPI transaction ID <span className="text-rose-400">*</span>
                      </label>
                      <Input
                        value={transactionId}
                        onChange={(e) => {
                          setTransactionId(e.target.value);
                          if (error) setError('');
                        }}
                        placeholder="Enter UPI transaction / reference ID"
                        className="h-9 text-xs font-semibold bg-background border-amber-500/40 focus:border-amber-500"
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-amber-200/90">
                    Payment QR / UPI link has not been added by the organizer yet. Please contact the organizer before enrolling.
                  </p>
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
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Successfully enrolled</p>
              <h3 className="text-2xl font-black text-foreground flex items-center justify-center gap-2">
                Welcome, {playerName}! <Sparkles className="h-5 w-5 text-amber-400" />
              </h3>
              <p className="text-sm text-emerald-200/90 font-semibold max-w-sm mx-auto">
                {successMessage || `You're in for ${edition.title}.`}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Need to fix your UPI transaction ID? Update it anytime from your player dashboard.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link
                href="/dashboard/player"
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md px-3 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Go to Dashboard
              </Link>
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
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">Already enrolled</p>
              <h3 className="text-xl font-black text-foreground">You are already enrolled</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {playerName}, you&apos;re already registered for <strong className="text-foreground">{edition.title}</strong>
                {' '}(Edition #{edition.number}).
              </p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Entered the wrong UPI transaction ID? Edit it from your player dashboard.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link
                href="/dashboard/player"
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-md px-3 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950"
              >
                <LayoutDashboard className="h-3.5 w-3.5" /> Edit on Dashboard
              </Link>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
