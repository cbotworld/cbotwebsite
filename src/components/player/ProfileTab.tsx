'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { activateUserAccount, updateMyProfile } from '@/lib/actions/userActions';
import { getEditionProfileStatsForUser } from '@/lib/actions/playerScoreActions';
import AverageHistoryGraph from '@/components/player/AverageHistoryGraph';
import {
  UserCheck, MapPin, Phone, Mail, Shield,
  Users, Lock, CheckCircle2, AlertCircle, Eye, EyeOff,
  Pencil, X, Save, User, Calendar
} from 'lucide-react';
import { DEFAULT_WEBSITE_CMS } from '@/lib/website-cms';

interface ProfileTabProps {
  currentPlayer: any;
  currentTeam: any;
  shortName?: string;
  editionLabel?: string;
}

// Read-only display row
function InfoRow({ icon, label, value, placeholder }: { icon: React.ReactNode; label: string; value?: string | null; placeholder?: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</div>
        <div className={`text-sm mt-0.5 break-words whitespace-pre-line ${value ? 'font-semibold text-foreground' : 'text-muted-foreground/50 italic'}`}>
          {value || placeholder || '—'}
        </div>
      </div>
    </div>
  );
}

// Read-only locked row (organizer-controlled)
function LockedRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="text-muted-foreground/40 mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{label}</div>
          <Lock className="h-2.5 w-2.5 text-muted-foreground/30" />
        </div>
        <div className="text-sm font-semibold text-foreground/60 mt-0.5">{value || '—'}</div>
      </div>
    </div>
  );
}

export function ProfileTab({
  currentPlayer: p,
  currentTeam: team,
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
  editionLabel = DEFAULT_WEBSITE_CMS.site.editionLabel,
}: ProfileTabProps) {
  // ── Edit Profile State ───────────────────────────────────────────
  const [editing, setEditing] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Editable fields — pre-filled from organiser-set profile
  const [form, setForm] = React.useState({
    bio: p.bio || '',
    address: p.address || '',
    pincode: p.pincode || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    whatsApp: p.whatsApp || '',
    email: p.email || '',
    age: p.age ? String(p.age) : '',
    gender: p.gender || '',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    const res = await updateMyProfile({
      bio: form.bio,
      address: form.address,
      pincode: form.pincode,
      city: form.city,
      state: form.state,
      country: form.country,
      whatsApp: form.whatsApp,
      email: form.email,
      age: form.age ? parseInt(form.age, 10) : null,
      gender: form.gender,
    });
    if (res.success) {
      setSaveStatus({ ok: true, msg: '✅ Profile updated successfully!' });
      // Update local display values
      setTimeout(() => { setEditing(false); setSaveStatus(null); }, 2000);
    } else {
      setSaveStatus({ ok: false, msg: res.error || 'Failed to save.' });
    }
    setIsSaving(false);
  };

  // ── PIN Reset State ──────────────────────────────────────────────
  const [showPinSection, setShowPinSection] = React.useState(false);
  const [currentPin, setCurrentPin] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [pinStatus, setPinStatus] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [isPinLoading, setIsPinLoading] = React.useState(false);
  const [editionStats, setEditionStats] = React.useState<{
    wins: number;
    slams: number;
    averageBonuses: number;
    history: Array<{ effectiveFrom: string; average: number }>;
    editionTitle?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!p?.id) return;
    getEditionProfileStatsForUser(p.id).then((res) => setEditionStats(res)).catch(() => {});
  }, [p?.id]);

  const handlePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(null);
    if (!/^\d{4}$/.test(newPin)) { setPinStatus({ ok: false, msg: 'New PIN must be exactly 4 digits.' }); return; }
    if (newPin !== confirmPin) { setPinStatus({ ok: false, msg: 'New PIN and Confirm PIN do not match.' }); return; }
    if (currentPin === newPin) { setPinStatus({ ok: false, msg: 'New PIN must be different from your current PIN.' }); return; }
    setIsPinLoading(true);
    try {
      const res = await activateUserAccount(p.username, currentPin, newPin);
      if (res.success) {
        setPinStatus({ ok: true, msg: '✅ PIN updated! Use your new PIN at next login.' });
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
        setTimeout(() => setShowPinSection(false), 3000);
      } else {
        setPinStatus({ ok: false, msg: res.error || 'PIN update failed. Check your current PIN.' });
      }
    } catch { setPinStatus({ ok: false, msg: 'Something went wrong. Please try again.' }); }
    setIsPinLoading(false);
  };

  // ── Derived display values ───────────────────────────────────────
  const location =
    [
      form.address || p.address,
      [form.city || p.city, form.state || p.state, form.pincode || p.pincode].filter(Boolean).join(', '),
      form.country || p.country,
    ]
      .filter(Boolean)
      .join('\n') || null;
  const initials = (p.name || 'P').replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'P';

  return (
    <div className="space-y-5">

      {/* ── Player Identity Card ───────────────────────────────── */}
      <Card className="border-border overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-rose-500" />

        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Initials Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-400 text-xl flex-shrink-0 shadow-inner">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl font-black">{p.name}</h2>
                  {team && <Badge variant="carrom" className="text-[10px] px-2 font-black">{team.name}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground font-mono">@{p.username}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="text-[10px]"><UserCheck className="h-3 w-3 mr-1" />{p.role || 'PLAYER'}</Badge>
                  {p.isActivated && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Activated</Badge>}
                </div>
              </div>
            </div>

            {/* Edit / Cancel button */}
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditing(true); setSaveStatus(null); }}
                className="gap-1.5 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 flex-shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditing(false); setSaveStatus(null); }}
                className="gap-1.5 text-xs flex-shrink-0"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-0">

          {/* ── Tournament Team ──────────────────────────────────── */}
          {team && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4">
              {team.logo ? (
                <img src={team.logo} alt={team.name} className="w-12 h-12 rounded-xl object-contain border border-border bg-background" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-500 text-base">
                  {team.tag || team.name?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-400/70 mb-0.5">{`${shortName} ${editionLabel} — Your Team`}</div>
                <div className="font-black text-base">{team.name}</div>
                {team.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{team.description}</p>}
              </div>
              <Users className="h-5 w-5 text-amber-500/50 flex-shrink-0" />
            </div>
          )}

          {editionStats && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                This edition{editionStats.editionTitle ? ` — ${editionStats.editionTitle}` : ''}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-black">{editionStats.wins}</div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Wins</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{editionStats.slams}</div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Slams</div>
                </div>
                <div>
                  <div className="text-2xl font-black">{editionStats.averageBonuses}</div>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Target bonus</div>
                </div>
              </div>
              {editionStats.history?.length > 0 && (
                <AverageHistoryGraph history={editionStats.history} />
              )}
            </div>
          )}

          {/* ── EDIT FORM (inline) ──────────────────────────────── */}
          {editing ? (
            <form onSubmit={handleSave} className="space-y-5">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-400 font-semibold flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                Name, username, average &amp; target are set by the organiser and cannot be changed here.
              </div>

              {/* Locked fields shown as read-only */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <LockedRow icon={<User className="h-4 w-4" />} label="Full Name (Organiser-set)" value={p.name} />
                <LockedRow icon={<UserCheck className="h-4 w-4" />} label="Username (Organiser-set)" value={`@${p.username}`} />
                <LockedRow icon={<Shield className="h-4 w-4" />} label="Average (Organiser-set)" value={`${p.average || 0}`} />
                <LockedRow icon={<Shield className="h-4 w-4" />} label="Target (Organiser-set)" value={`${p.target || 0}`} />
              </div>

              <div className="border-t border-border/40 pt-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/70 mb-4">Your Editable Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bio */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Bio / About Me</label>
                    <textarea
                      value={form.bio}
                      onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                      rows={2}
                      placeholder="Tell CBOT about yourself..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Full address */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Full address</label>
                    <textarea
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      rows={3}
                      placeholder="House / flat, street, area, landmark"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                      required
                    />
                  </div>
                  {/* Pincode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Pincode</label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={e => setForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      placeholder="e.g. 600001"
                      required
                    />
                  </div>
                  {/* City */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">City / Town</label>
                    <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="e.g. Chennai" />
                  </div>
                  {/* State */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">State / Province</label>
                    <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Tamil Nadu" />
                  </div>
                  {/* Country */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Country</label>
                    <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. India" />
                  </div>
                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Gender</label>
                    <select
                      value={form.gender}
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      <option value="">Prefer not to say</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {/* Age */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Age</label>
                    <Input
                      type="number"
                      min={10} max={99}
                      value={form.age}
                      onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                      placeholder="e.g. 28"
                    />
                  </div>
                  {/* WhatsApp */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">WhatsApp / Phone</label>
                    <Input value={form.whatsApp} onChange={e => setForm(f => ({ ...f, whatsApp: e.target.value }))} placeholder="e.g. +91 98765 43210" />
                  </div>
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Email Address</label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. you@email.com" />
                  </div>
                </div>
              </div>

              {/* Status */}
              {saveStatus && (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-xs font-semibold border ${saveStatus.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  {saveStatus.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  {saveStatus.msg}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="carrom" size="sm" disabled={isSaving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />{isSaving ? 'Saving…' : 'Save Profile'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(false); setSaveStatus(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            /* ── READ VIEW ─────────────────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Personal Details</h3>
                {(form.bio || p.bio) && (
                  <div className="mb-3 py-2.5 border-b border-border/40">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Bio</div>
                    <p className="text-sm mt-0.5">{form.bio || p.bio}</p>
                  </div>
                )}
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Full address" value={location} placeholder="Not set" />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Age" value={form.age || (p.age ? String(p.age) : null)} placeholder="Not set" />
                <InfoRow icon={<Users className="h-4 w-4" />} label="Gender" value={form.gender || p.gender} placeholder="Not set" />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="WhatsApp / Phone" value={form.whatsApp || p.whatsApp} placeholder="Not set" />
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={form.email || p.email} placeholder="Not set" />
                {!location && !p.phone && !p.email && !p.bio && !p.age && !p.gender && (
                  <p className="text-sm text-muted-foreground/50 italic mt-2">
                    No personal details yet. Click <strong className="text-amber-400">Edit Profile</strong> to add yours.
                  </p>
                )}
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-3">Category History</h3>
                {p.rankingSnapshots && p.rankingSnapshots.length > 0 ? (
                  <div className="space-y-2">
                    {p.rankingSnapshots.map((snap: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 border border-border rounded-lg text-sm bg-muted/10">
                        <div>
                          <div className="font-bold text-xs">{new Date(snap.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-muted-foreground">ELO: {snap.rating}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{snap.category}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-3 border border-border rounded-lg bg-muted/10 text-center">
                    No past ranking history yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PIN Reset Card ──────────────────────────────────────── */}
      <Card className="border-border border-amber-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" /> Security — Reset PIN
          </CardTitle>
          <CardDescription className="text-xs">
            Change your 4-digit login PIN. You must enter your current PIN to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showPinSection ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              onClick={() => setShowPinSection(true)}
            >
              <Shield className="h-4 w-4" /> Change My PIN
            </Button>
          ) : (
            <form onSubmit={handlePinReset} className="space-y-4 max-w-sm">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Current PIN</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="pr-10 font-mono tracking-[0.3em] text-center text-lg"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">New PIN (4 digits)</label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="pr-10 font-mono tracking-[0.3em] text-center text-lg"
                    required
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Confirm New PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className={`font-mono tracking-[0.3em] text-center text-lg ${confirmPin && confirmPin !== newPin ? 'border-rose-500/60' : ''}`}
                  required
                />
                {confirmPin && confirmPin !== newPin && <p className="text-[11px] text-rose-400">PINs do not match</p>}
              </div>
              {pinStatus && (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-xs font-semibold border ${pinStatus.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                  {pinStatus.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                  {pinStatus.msg}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="carrom" size="sm" disabled={isPinLoading || currentPin.length < 4 || newPin.length < 4 || confirmPin !== newPin} className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />{isPinLoading ? 'Updating…' : 'Update PIN'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowPinSection(false); setPinStatus(null); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
