'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Send, RefreshCw, Smartphone, Users, AlertCircle, CheckCircle2, Sparkles, MessageSquare } from 'lucide-react';
import { getPushNotificationStats, sendCustomPushNotification } from '@/lib/actions/pushNotificationActions';

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

      {/* ── Main Push Notification Form Card ──────────────────────────────── */}
      <Card className="border-amber-500/30 shadow-2xl">
        <CardHeader className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-500 animate-bounce" /> Send Custom Push Notification
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Broadcast mobile push notifications directly to all registered app users across Android &amp; iOS devices.
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
