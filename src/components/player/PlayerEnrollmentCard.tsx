'use client';

import * as React from 'react';
import { CheckCircle2, CreditCard, Loader2, PartyPopper, Pencil, Save, X, Clock, Info, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { updateMyPaymentTransactionId } from '@/lib/actions/tournamentSlotActions';
import { formatEnrollmentFee } from '@/lib/tournament-slots';

export type PlayerEnrollmentInfo = {
  participantId: string;
  status?: string | null;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  paymentTransactionId?: string | null;
  paymentMethod?: string | null;
  enrolledAt?: string | Date | null;
  edition: {
    id: string;
    title: string;
    number: number;
    theme?: string | null;
    enrollmentFee?: number | null;
    status?: string | null;
    organizerName?: string | null;
  };
};

export function PlayerEnrollmentCard({
  enrollment: initial,
}: {
  enrollment: PlayerEnrollmentInfo;
}) {
  const fee = Number(initial?.edition?.enrollmentFee ?? initial?.paymentAmount) || 0;
  const isPaid = fee > 0;
  const [txnId, setTxnId] = React.useState(initial?.paymentTransactionId || '');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(initial?.paymentTransactionId || '');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  if (!initial || !initial.edition) return null;

  const startEdit = () => {
    setDraft(txnId);
    setEditing(true);
    setError('');
    setMessage('');
  };

  const cancelEdit = () => {
    setDraft(txnId);
    setEditing(false);
    setError('');
  };

  const saveTxn = async () => {
    const next = draft.trim();
    if (!next) {
      setError('Payment reference / Transaction ID is required.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const res = await updateMyPaymentTransactionId(initial.edition.id, next);
    if (res.success) {
      setTxnId(res.participant?.paymentTransactionId || next);
      setEditing(false);
      setMessage('Payment reference ID updated successfully.');
    } else {
      setError(res.error || 'Could not update transaction ID.');
    }
    setBusy(false);
  };

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-emerald-500/5 overflow-hidden shadow-lg shadow-amber-500/5">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black">
                <PartyPopper className="h-3.5 w-3.5 mr-1" /> Enrolled for Next Edition
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold">
                Edition #{initial.edition.number}
              </Badge>
              {initial.paymentStatus === 'VERIFIED' ? (
                <Badge className="bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[10px] font-black uppercase tracking-wider">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" /> Payment Verified
                </Badge>
              ) : null}
              {initial.paymentMethod === 'ALTERNATE_UPI' ? (
                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
                  Paid to: Alternate Payment UPI
                </Badge>
              ) : initial.paymentMethod === 'PRIMARY_UPI' || isPaid ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                  Paid to: Primary Payment UPI
                </Badge>
              ) : null}
            </div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              {initial.edition.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {initial.edition.theme ? `${initial.edition.theme} · ` : ''}
              Fee: <strong className="text-emerald-400">{formatEnrollmentFee(fee)}</strong>
              {initial.edition.organizerName
                ? ` · Organizer: ${initial.edition.organizerName}`
                : ''}
            </p>
          </div>
        </div>

        {isPaid ? (
          <>
            {/* Organizer Crosscheck / Verification Notice */}
            {initial.paymentStatus === 'VERIFIED' ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Payment Verified & Enrollment Confirmed
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                  The organizer has crosschecked and verified your payment reference. Your official enrollment for <strong>{initial.edition.title}</strong> is confirmed. Keep your striker chalked!
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/25 text-amber-300 border border-amber-500/40">
                    <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                    Payment Verification in Progress
                  </span>
                </div>
                <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
                  Your enrollment details and payment reference have been received. The organizer will crosscheck and verify the payment. If there are any issues with your payment reference, the organizer will contact you directly. Thank you so much!
                </p>
              </div>
            )}

            {/* Payment Reference / Transaction ID card */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> UPI Transaction ID / Payment Reference
                  </p>
                  {initial.paymentMethod === 'ALTERNATE_UPI' ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Alternate UPI
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Primary UPI
                    </span>
                  )}
                </div>
                {!editing ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    onClick={startEdit}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit UPI Transaction ID (if entered wrong)
                  </Button>
                ) : null}
              </div>

              {!editing ? (
                <div className="p-3 rounded-lg bg-background border border-border/60">
                  <p className="font-mono text-sm font-bold text-sky-300 break-all">
                    {txnId || '— not set —'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Enter correct payment reference / UPI transaction ID"
                    className="h-9 text-xs font-semibold bg-background border-amber-500/40"
                    autoComplete="off"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="carrom"
                      className="h-8 text-xs font-black"
                      disabled={busy}
                      onClick={() => void saveTxn()}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={cancelEdit}
                    >
                      <X className="h-3.5 w-3.5 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              )}
              {error ? <p className="text-xs font-semibold text-rose-400">{error}</p> : null}
              {message ? <p className="text-xs font-semibold text-emerald-400">{message}</p> : null}
              <p className="text-[11px] text-muted-foreground">
                If you entered the wrong UPI transaction ID or made a typo, you can edit it above anytime. The organizer sees the updated reference immediately.
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase">
              <ShieldCheck className="h-4 w-4" /> Free Tournament Enrollment Confirmed
            </div>
            <p className="text-xs text-emerald-200/90 font-medium">
              This edition is free to enter. Your registration is confirmed.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
