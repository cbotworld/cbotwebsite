'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Send, RefreshCw, Smartphone, Users, AlertCircle, CheckCircle2, Sparkles, MessageSquare, Clock, Copy, Check } from 'lucide-react';
import {
  getPushNotificationStats,
  sendCustomPushNotification,
  previewAutoNotifications,
  triggerAutoNotifications,
  getTodayNotificationSlotsAction,
} from '@/lib/actions/pushNotificationActions';

export function PushNotificationTab() {
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [stats, setStats] = React.useState<{
    totalTokens: number;
    usersCount: number;
    iosCount: number;
    androidCount: number;
  } | null>(null);

  const [slotsData, setSlotsData] = React.useState<{
    editionTitle?: string;
    dayNumber?: number;
    currentTimeIst?: string;
    slots: Array<{
      key: string;
      type: string;
      name: string;
      timeWindowIst: string;
      description: string;
      status: 'SENT' | 'DUE' | 'UPCOMING' | 'PASSED';
      dispatchedAt: string | null;
      sentCount: number;
    }>;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);

  // Form State
  const [title, setTitle] = React.useState('CBOT Announcement 🏆');
  const [message, setMessage] = React.useState('Hi {name}, Welcome to Cbotworld');
  const [target, setTarget] = React.useState<'ALL' | 'PLAYERS' | 'CAPTAINS'>('ALL');

  // Feedback State
  const [statusMsg, setStatusMsg] = React.useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchStats = React.useCallback(async () => {
    setLoadingStats(true);
    try {
      const [res, sRes] = await Promise.all([
        getPushNotificationStats(),
        getTodayNotificationSlotsAction().catch(() => null),
      ]);
      setStats(res);
      if (sRes) setSlotsData(sRes);
    } catch (err: any) {
      console.error('Failed to load push stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!title.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a notification title.' });
      return;
    }

    if (!message.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter a notification message.' });
      return;
    }

    if (!confirm(`Are you sure you want to send this push notification to all users (${stats?.totalTokens || 0} registered devices)?`)) {
      return;
    }

    setSending(true);
    try {
      const res = await sendCustomPushNotification({
        title: title.trim(),
        message: message.trim(),
        target,
      });

      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `🎉 ${res.message} (Targeted ${res.totalTokens} device token(s))`,
        });
        // Refresh stats (in case invalid tokens were deleted)
        fetchStats();
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Failed to send push notification.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error dispatching push notification.' });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (tmplTitle: string, tmplMsg: string) => {
    setTitle(tmplTitle);
    setMessage(tmplMsg);
  };

  // Auto Push Notification State
  const [autoDay, setAutoDay] = React.useState<number>(1);
  const [autoType, setAutoType] = React.useState<'auto' | 'golive' | 'score' | 'combi' | 'results'>('auto');
  const [loadingAuto, setLoadingAuto] = React.useState(false);
  const [autoPreviewResult, setAutoPreviewResult] = React.useState<any | null>(null);

  const handleAutoPreview = async () => {
    setLoadingAuto(true);
    setStatusMsg(null);
    try {
      const res = await previewAutoNotifications({
        dayNumber: autoDay,
        type: autoType,
      });
      setAutoPreviewResult(res);
      setStatusMsg({
        type: 'success',
        text: `🔍 Preview: Generated ${res.notificationsCount} notification(s) for Day ${res.dayNumber} (${res.typeSent}).`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to preview auto notifications.' });
    } finally {
      setLoadingAuto(false);
    }
  };

  const handleAutoDispatch = async () => {
    if (!confirm(`Are you sure you want to DISPATCH live push notifications for Day ${autoDay} (${autoType}) to all matching players/captains?`)) {
      return;
    }
    setLoadingAuto(true);
    setStatusMsg(null);
    try {
      const res = await triggerAutoNotifications({
        dayNumber: autoDay,
        type: autoType,
      });
      setAutoPreviewResult(res);
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `🚀 Dispatched: Sent ${res.results.sent} push notification(s) for Day ${res.dayNumber} (${res.typeSent}).`,
        });
        fetchStats();
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Failed to dispatch auto notifications.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Error triggering auto notifications.' });
    } finally {
      setLoadingAuto(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Stats Summary Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-amber-500/30 bg-card/60 backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Registered Devices</div>
              <div className="text-3xl font-black text-amber-500 mt-1">{stats ? stats.totalTokens : '...'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-emerald-500/30 bg-card/60 backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Users Reachable</div>
              <div className="text-3xl font-black text-emerald-500 mt-1">{stats ? stats.usersCount : '...'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-blue-500/30 bg-card/60 backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Android Tokens</div>
              <div className="text-3xl font-black text-blue-400 mt-1">{stats ? stats.androidCount : '...'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-purple-500/30 bg-card/60 backdrop-blur-md">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">iOS Tokens</div>
              <div className="text-3xl font-black text-purple-400 mt-1">{stats ? stats.iosCount : '...'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Status Message Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-3 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ── Auto Push Notification Schedule & Test Card ───────────────────── */}
      <Card className="border-cyan-500/30 shadow-xl bg-gradient-to-br from-cyan-500/5 via-card to-background">
        <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-400" /> Auto Push Notifications Schedule &amp; Slot Tracker
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Automated daily match reminders, score cutoff alerts, captain combi warnings, and result celebrations (Day {slotsData?.dayNumber || autoDay} • Current Time: {slotsData?.currentTimeIst || 'IST'}).
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchStats}
              disabled={loadingStats}
              className="text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingStats ? 'animate-spin' : ''}`} /> Refresh Status
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Live Daily Notification Slots Timeline */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" /> Today&apos;s 7 Scheduled Notification Windows (IST)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(slotsData?.slots || []).map((slot) => {
                const isSent = slot.status === 'SENT';
                const isDue = slot.status === 'DUE';
                const isPassed = slot.status === 'PASSED';

                return (
                  <div
                    key={slot.key}
                    className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col justify-between gap-2.5 ${
                      isSent
                        ? 'border-emerald-500/40 bg-emerald-500/5 shadow-xs'
                        : isDue
                        ? 'border-amber-500/50 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30'
                        : isPassed
                        ? 'border-border/60 bg-muted/20 opacity-80'
                        : 'border-border bg-card/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-mono text-[11px] font-bold text-muted-foreground">
                          {slot.timeWindowIst}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isSent
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isDue
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : isPassed
                              ? 'bg-muted text-muted-foreground border border-border'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          }`}
                        >
                          {isSent ? '✓ SENT' : isDue ? '⚡ DUE NOW' : isPassed ? 'PASSED' : 'UPCOMING'}
                        </span>
                      </div>

                      <div className="font-black text-foreground text-sm">{slot.name}</div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {slot.description}
                      </p>

                      {isSent && slot.dispatchedAt && (
                        <div className="mt-2 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent at {new Date(slot.dispatchedAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true, hour: '2-digit', minute: '2-digit' })} IST
                          {slot.sentCount > 0 ? ` (${slot.sentCount} devices)` : ''}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/40 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loadingAuto}
                        onClick={async () => {
                          setAutoType(slot.type as any);
                          setAutoDay(slotsData?.dayNumber || 1);
                          await handleAutoPreview();
                        }}
                        className="h-7 text-[10px] font-bold px-2.5 flex-1"
                      >
                        Preview
                      </Button>

                      <Button
                        type="button"
                        variant={isDue ? 'carrom' : 'outline'}
                        size="sm"
                        disabled={loadingAuto}
                        onClick={async () => {
                          if (!confirm(`Dispatch "${slot.name}" now to all targeted players/captains?`)) return;
                          setLoadingAuto(true);
                          try {
                            const res = await triggerAutoNotifications({
                              dayNumber: slotsData?.dayNumber || 1,
                              type: slot.type as any,
                              force: true,
                            });
                            setAutoPreviewResult(res);
                            if (res.success) {
                              setStatusMsg({
                                type: 'success',
                                text: `🚀 Dispatched "${slot.name}": Sent ${res.results.sent} push notification(s).`,
                              });
                              fetchStats();
                            } else {
                              setStatusMsg({ type: 'error', text: res.message || 'Failed to dispatch.' });
                            }
                          } catch (err: any) {
                            setStatusMsg({ type: 'error', text: err.message || 'Error triggering slot.' });
                          } finally {
                            setLoadingAuto(false);
                          }
                        }}
                        className="h-7 text-[10px] font-bold px-2.5 flex-1"
                      >
                        <Send className="h-3 w-3 mr-1" /> Send Now
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* External Cron / Webhook URL Card */}
          <div className="rounded-2xl border border-cyan-500/20 p-4 bg-cyan-500/5 space-y-2">
            <div className="text-xs font-bold text-cyan-400 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> High-Reliability External Cron Webhook
              </span>
              <span className="text-[10px] text-muted-foreground">Self-Healing / Multi-Layer Automation</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Auto-dispatches are scheduled via <strong>GitHub Actions</strong> and <strong>Vercel Crons</strong>. You can also paste this webhook URL into any free cron service (e.g. <code>cron-job.org</code> / <code>EasyCron</code>) to trigger checks every 5–10 minutes:
            </p>
            <div className="flex items-center gap-2 bg-background/80 border border-border p-2 rounded-xl text-xs font-mono">
              <span className="text-muted-foreground select-all truncate flex-1">
                https://www.cbotworld.com/api/cron/notifications?type=auto&amp;secret=cbot_cron_secret_2026
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    'https://www.cbotworld.com/api/cron/notifications?type=auto&secret=cbot_cron_secret_2026',
                  );
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2500);
                }}
                className="h-7 px-2.5 text-xs font-bold shrink-0 text-cyan-400 hover:text-cyan-300"
              >
                {copiedWebhook ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copiedWebhook ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Test & Preview Panel */}
          <div className="rounded-2xl border border-border p-4 bg-muted/20 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Custom Tournament Day Test / Preview
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="text-[11px] font-bold block mb-1 text-muted-foreground">Tournament Day</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={autoDay}
                  onChange={(e) => setAutoDay(parseInt(e.target.value, 10) || 1)}
                  className="h-9 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1 text-muted-foreground">Notification Type</label>
                <select
                  value={autoType}
                  onChange={(e) => setAutoType(e.target.value as any)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-bold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="auto">Auto (Current IST Time Slot)</option>
                  <option value="golive">Go Live &amp; Match Alert (4:00 PM / 7:00 PM)</option>
                  <option value="score">Score Cutoff Reminder (8:00 PM / 8:40 PM)</option>
                  <option value="combi">Captain Combi Warning (9:00 PM / 9:20 PM)</option>
                  <option value="results">Match Results &amp; Standings (9:35 PM)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoPreview}
                  disabled={loadingAuto}
                  className="h-9 font-bold text-xs flex-1"
                >
                  {loadingAuto ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  🔍 Preview Payloads
                </Button>

                <Button
                  type="button"
                  variant="carrom"
                  size="sm"
                  onClick={handleAutoDispatch}
                  disabled={loadingAuto}
                  className="h-9 font-bold text-xs flex-1"
                >
                  {loadingAuto ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  🚀 Dispatch Live
                </Button>
              </div>
            </div>

            {/* Preview Output Samples */}
            {autoPreviewResult?.samplePayloads && autoPreviewResult.samplePayloads.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-bold text-muted-foreground">
                  Sample Notification Payloads ({autoPreviewResult.samplePayloads.length} shown of {autoPreviewResult.notificationsCount} total):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {autoPreviewResult.samplePayloads.map((p: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-card border border-border text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-cyan-400">{p.userName} ({p.teamName})</span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{p.type}</span>
                      </div>
                      <div className="font-extrabold text-foreground">{p.title}</div>
                      <p className="text-[11px] text-muted-foreground">{p.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Main Custom Push Notification Form Card ───────────────────────── */}
      <Card className="border-amber-500/30 shadow-2xl">
        <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500 animate-bounce" /> Send Custom Push Notification
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Broadcast custom push notifications directly to all registered app users across Android &amp; iOS devices.
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loadingStats}
            className="text-xs font-bold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin' : ''}`} /> Refresh Devices
          </Button>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Quick Presets / Templates */}
          <div>
            <label className="text-xs font-bold block mb-2 text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Quick Message Presets
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-semibold hover:border-amber-500/50"
                onClick={() => applyTemplate('Welcome to CBOT 🏆', 'Hi {name}, Welcome to Cbotworld')}
              >
                👋 Welcome Message
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-semibold hover:border-amber-500/50"
                onClick={() => applyTemplate('Live Stream Active 🎥', 'Hi {name}, live streams are now active! Tune in to watch live matches.')}
              >
                🎥 Live Stream Alert
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs font-semibold hover:border-amber-500/50"
                onClick={() => applyTemplate('Tournament Schedule Update 📅', 'Hi {name}, new match fixtures and day schedules have been published!')}
              >
                📅 Schedule Update
              </Button>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Target Audience */}
            <div>
              <label className="text-xs font-bold block mb-1.5">Target Audience</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={target === 'ALL' ? 'carrom' : 'outline'}
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => setTarget('ALL')}
                >
                  All App Users
                </Button>
                <Button
                  type="button"
                  variant={target === 'PLAYERS' ? 'carrom' : 'outline'}
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => setTarget('PLAYERS')}
                >
                  Players Only
                </Button>
                <Button
                  type="button"
                  variant={target === 'CAPTAINS' ? 'carrom' : 'outline'}
                  size="sm"
                  className="font-bold text-xs"
                  onClick={() => setTarget('CAPTAINS')}
                >
                  Captains Only
                </Button>
              </div>
            </div>

            {/* Notification Title */}
            <div>
              <label className="text-xs font-bold block mb-1">Notification Title *</label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Welcome to CBOT 🏆"
                className="font-semibold"
                required
              />
            </div>

            {/* Notification Message Text */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold">Custom Push Message *</label>
                <span className="text-[11px] text-amber-400/80">Use <code className="bg-muted px-1.5 py-0.5 rounded text-amber-300 font-mono">{'{name}'}</code> to personalize</span>
              </div>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. Hi {name}, Welcome to Cbotworld"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              />
            </div>

            {/* Live Preview Card */}
            <div className="p-4 rounded-2xl bg-card/80 border border-amber-500/20 space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-amber-400" /> Phone Notification Preview
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 shadow-md flex gap-3 items-start">
                <img src="/logo.png" alt="App Icon" className="h-7 w-7 rounded-lg shrink-0 mt-0.5 object-cover" />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200 truncate">{title || 'Notification Title'}</span>
                    <span className="text-[10px] text-slate-400">now</span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">
                    {message.replace(/\{name\}/gi, 'Karthik Burra') || 'Notification message...'}
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="carrom"
              className="w-full font-black py-6 text-base justify-center shadow-lg shadow-amber-500/20"
              disabled={sending}
            >
              {sending ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> Sending Push Notification...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" /> Send Push Notification to All Users
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
