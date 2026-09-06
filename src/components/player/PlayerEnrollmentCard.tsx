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
  enrollmentNumber?: number | null;
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
              {initial.enrollmentNumber ? (
                <Badge className="bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                  Enrollment #{initial.enrollmentNumber}
                </Badge>
              ) : null}
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
            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
              {initial.edition.theme ? `${initial.edition.theme} · ` : ''}
              <span>Fee: <strong className="text-emerald-400">{formatEnrollmentFee(fee)}</strong></span>
              {initial.edition.organizerName ? (
                <span>· Organizer: <strong className="text-foreground">{initial.edition.organizerName}</strong></span>
              ) : null}
              {initial.enrolledAt ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                  <Clock className="h-3 w-3 text-emerald-400" />
                  <span>Enrolled: {formatEnrolledTimestamp(initial.enrolledAt)}</span>
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* First-Come First-Served & Multiple of 8 Policy Box */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              First-Come First-Served & Multiples of 8 Policy
            </span>
          </div>
          <p className="text-xs text-indigo-200/90 leading-relaxed">
            Tournament brackets are assembled strictly in <strong>multiples of 8</strong> (e.g. 8, 16, 24, 32 players) based on enrollment time. If final registrations exceed a complete multiple of 8, players beyond the cutoff can be cancelled by the organizer and the entry fee collected will be <strong>100% refunded</strong>.
          </p>
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

            {/* Payment Comments / Reference card */}
            <div className="rounded-xl border border-border/80 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" /> Comments / Payment Details
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
                    <Pencil className="h-3 w-3 mr-1" /> Edit Comments (phone number / payer name)
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
                    placeholder="Enter phone number paid & name of person who paid (e.g. 9876543210 - Rahul)"
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
                If you entered the wrong payment phone number or made a typo in the payer name, you can edit your comments above anytime. The organizer sees the updated comments immediately.
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
