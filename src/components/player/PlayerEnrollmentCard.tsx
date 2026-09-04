'use client';

import * as React from 'react';
import { CheckCircle2, CreditCard, Loader2, PartyPopper, Pencil, Save, X } from 'lucide-react';
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
  const fee = Number(initial.edition.enrollmentFee ?? initial.paymentAmount) || 0;
  const isPaid = fee > 0;
  const [txnId, setTxnId] = React.useState(initial.paymentTransactionId || '');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(txnId);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

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
      setError('UPI transaction ID is required.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const res = await updateMyPaymentTransactionId(initial.edition.id, next);
    if (res.success) {
      setTxnId(res.participant?.paymentTransactionId || next);
      setEditing(false);
      setMessage('UPI transaction ID updated.');
    } else {
      setError(res.error || 'Could not update transaction ID.');
    }
    setBusy(false);
  };

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-amber-500/5 overflow-hidden">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black">
                <PartyPopper className="h-3.5 w-3.5 mr-1" /> Successfully enrolled
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold">
                Edition #{initial.edition.number}
              </Badge>
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
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-black uppercase tracking-wide text-amber-400 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> UPI transaction ID
              </p>
              {!editing ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] font-bold border-amber-500/40 text-amber-300"
                  onClick={startEdit}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              ) : null}
            </div>

            {!editing ? (
              <p className="font-mono text-sm font-semibold text-sky-300 break-all">
                {txnId || '— not set —'}
              </p>
            ) : (
              <div className="space-y-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Enter correct UPI transaction / reference ID"
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
              If you entered the wrong ID during enrollment, update it here. Organizers see this on Enrolled Players.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This is a free enrollment — no UPI transaction ID required.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
