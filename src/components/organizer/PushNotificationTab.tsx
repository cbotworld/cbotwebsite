'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Send, RefreshCw, Smartphone, Users, AlertCircle, CheckCircle2, Sparkles, MessageSquare } from 'lucide-react';
import {
  getPushNotificationStats,
  sendCustomPushNotification,
  previewAutoNotifications,
  triggerAutoNotifications,
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
      const res = await getPushNotificationStats();
      setStats(res);
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
              <Sparkles className="h-5 w-5 text-cyan-400" /> Auto Push Notifications System
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Automated daily match reminders, score cutoff alerts, captain combi warnings, and result celebrations scheduled via Vercel Cron.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1">
              <div className="font-extrabold text-amber-400">4:00 PM – 7:00 PM IST</div>
              <div className="font-bold text-foreground">⚔️ Go Live &amp; Match Alert</div>
              <p className="text-[11px] text-muted-foreground">Alerts players with their real opponent for today&apos;s fixture.</p>
            </div>

            <div className="p-3 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-1">
              <div className="font-extrabold text-orange-400">8:00 PM – 8:30 PM IST</div>
              <div className="font-bold text-foreground">📝 Score Cutoff Reminder</div>
              <p className="text-[11px] text-muted-foreground">Reminds unscored players to record their day score before 9:00 PM.</p>
            </div>

            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1">
              <div className="font-extrabold text-rose-400">9:00 PM – 9:25 PM IST</div>
              <div className="font-bold text-foreground">⚡ Captain Combi Warning</div>
              <p className="text-[11px] text-muted-foreground">Warns captains of unsubmitted lineups for today&apos;s match before 9:30 PM lock.</p>
            </div>

            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <div className="font-extrabold text-emerald-400">9:35 PM IST</div>
              <div className="font-bold text-foreground">🏆 Match Results &amp; Standings</div>
              <p className="text-[11px] text-muted-foreground">Celebrates actual match victory/defeat and reports updated standings.</p>
            </div>
          </div>

          {/* Test & Preview Panel */}
          <div className="rounded-2xl border border-border p-4 bg-muted/20 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Test Dispatch or Preview Auto Push Logic
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
                  <option value="auto">Auto (Current IST Time)</option>
                  <option value="golive">Go Live &amp; Match Alert (4-7 PM)</option>
                  <option value="score">Score Cutoff Reminder (8-8:30 PM)</option>
                  <option value="combi">Captain Combi Warning (9-9:25 PM)</option>
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
