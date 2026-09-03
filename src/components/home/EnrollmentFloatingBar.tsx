'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Trophy, X, Loader2, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { enrollCurrentUser } from '@/lib/actions/tournamentSlotActions';
import { formatEnrollmentFee } from '@/lib/tournament-slots';
import { toCalendarDate } from '@/lib/combi-cutoff';

type RegistrationEdition = {
  id: string;
  title: string;
  number: number;
  theme?: string | null;
  enrollmentFee?: number | null;
  registrationEndDate?: string | Date | null;
};

export default function EnrollmentFloatingBar({ edition }: { edition: RegistrationEdition }) {
  const { data: session, status } = useSession();
  const [dismissed, setDismissed] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [step, setStep] = React.useState<'confirm' | 'paying' | 'done'>('confirm');
  const [error, setError] = React.useState('');
  const [successMessage, setSuccessMessage] = React.useState('');

  const fee = Number(edition.enrollmentFee) || 0;
  const cutoff = edition.registrationEndDate
    ? toCalendarDate(edition.registrationEndDate)
    : null;

  if (dismissed) return null;

  const handleEnroll = async () => {
    if (status !== 'authenticated') {
      setModalOpen(false);
      return;
    }
    setError('');
    if (fee > 0) {
      setStep('paying');
      await new Promise((r) => setTimeout(r, 1200));
    }
    const res = await enrollCurrentUser(edition.id);
    if (res.success) {
      setStep('done');
      setSuccessMessage(res.message || 'You are enrolled!');
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
              <p className="text-xs font-black text-emerald-400 uppercase tracking-wide">Registration Open</p>
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
                onClick={() => {
                  setStep('confirm');
                  setError('');
                  setModalOpen(true);
                }}
              >
                Enroll Now
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
            {fee > 0 && (
              <p className="text-xs text-muted-foreground">
                You will complete a demo payment step. No real charge is made in this preview flow.
              </p>
            )}
            {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="carrom" size="sm" className="font-black" onClick={() => void handleEnroll()}>
                {fee > 0 ? (
                  <>
                    <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay & Enroll
                  </>
                ) : (
                  'Confirm Enrollment'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'paying' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mx-auto" />
            <p className="text-sm font-bold">Processing demo payment of {formatEnrollmentFee(fee)}…</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="font-black text-emerald-300">{successMessage}</p>
            <Button type="button" variant="carrom" size="sm" onClick={() => setModalOpen(false)}>
              Done
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
