'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Lock, UserCheck, ArrowRight, ShieldCheck, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { activateUserAccount, resetUserPin } from '@/lib/actions/userActions';
import { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = React.useState('balumaster');
  const [pin, setPin] = React.useState('2905');
  const [role, setRole] = React.useState<UserRole>('ORGANIZER');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // Reset PIN & Activation Modal States
  const [resetModalOpen, setResetModalOpen] = React.useState(false);
  const [activateModalOpen, setActivateModalOpen] = React.useState(false);

  // Form states for modals
  const [resetUsername, setResetUsername] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [modalSuccessMsg, setModalSuccessMsg] = React.useState('');
  const [modalErrorMsg, setModalErrorMsg] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const res = await signIn('credentials', {
      username,
      pin,
      redirect: false,
    });

    if (res?.ok) {
      if (role === 'ORGANIZER') router.push('/dashboard/organizer');
      else if (role === 'CAPTAIN') router.push('/dashboard/captain');
      else router.push('/dashboard/player');
    } else {
      setErrorMsg(res?.error || 'Invalid Username or 4-Digit PIN');
      setLoading(false);
    }
  };

  const handleQuickDemoRole = (demoRole: UserRole, demoUsername: string, demoPin: string) => {
    setRole(demoRole);
    setUsername(demoUsername);
    setPin(demoPin);
    setErrorMsg('');
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg('');
    setModalSuccessMsg('');
    const res = await resetUserPin(resetUsername, newPin);
    if (res.success) {
      setModalSuccessMsg(res.message || 'PIN reset successfully!');
      setTimeout(() => {
        setResetModalOpen(false);
        setModalSuccessMsg('');
      }, 1500);
    } else {
      setModalErrorMsg(res.error || 'Failed to reset PIN');
    }
  };

  const handleActivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMsg('');
    setModalSuccessMsg('');
    const res = await activateUserAccount(resetUsername, pin, newPin);
    if (res.success) {
      setModalSuccessMsg(res.message || 'Account activated!');
      setTimeout(() => {
        setActivateModalOpen(false);
        setModalSuccessMsg('');
      }, 1500);
    } else {
      setModalErrorMsg(res.error || 'Activation failed');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      <Card className="w-full max-w-md border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">CBOT Portal Login</CardTitle>
          <CardDescription className="text-xs">
            Enter your unique Username and 4-digit PIN
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          
          {/* Quick Demo Credentials Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Quick Role Credentials Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={role === 'ORGANIZER' ? 'carrom' : 'outline'}
                size="sm"
                onClick={() => handleQuickDemoRole('ORGANIZER', 'balumaster', '2905')}
                className="text-[11px] font-bold py-2 h-auto flex flex-col items-center"
              >
                <span>Organizer</span>
                <span className="text-[9px] font-mono opacity-80">PIN: 2905</span>
              </Button>
              <Button
                type="button"
                variant={role === 'CAPTAIN' ? 'carrom' : 'outline'}
                size="sm"
                onClick={() => handleQuickDemoRole('CAPTAIN', 'striker_vikram', '1234')}
                className="text-[11px] font-bold py-2 h-auto flex flex-col items-center"
              >
                <span>Captain</span>
                <span className="text-[9px] font-mono opacity-80">PIN: 1234</span>
              </Button>
              <Button
                type="button"
                variant={role === 'PLAYER' ? 'carrom' : 'outline'}
                size="sm"
                onClick={() => handleQuickDemoRole('PLAYER', 'rajesh_cbot', '1111')}
                className="text-[11px] font-bold py-2 h-auto flex flex-col items-center"
              >
                <span>Player</span>
                <span className="text-[9px] font-mono opacity-80">PIN: 1111</span>
              </Button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold block mb-1">Unique Username</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 font-mono"
                  placeholder="e.g. striker_vikram"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">4-Digit Security PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="pl-9 font-mono tracking-widest text-lg font-bold"
                  placeholder="••••"
                  required
                />
              </div>
              <div className="flex justify-between text-[11px] mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResetUsername(username);
                    setResetModalOpen(true);
                  }}
                  className="text-amber-500 font-bold hover:underline"
                >
                  Forgot / Reset 4-Digit PIN?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetUsername(username);
                    setActivateModalOpen(true);
                  }}
                  className="text-emerald-500 font-bold hover:underline"
                >
                  First Time Login Activation?
                </button>
              </div>
            </div>

            <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
              {loading ? 'Verifying Credentials...' : 'Log In with Username & PIN'} <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
            New team captain?{' '}
            <Link href="/register" className="text-amber-500 font-bold hover:underline">
              Register New Team Roster
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* PIN Reset Dialog */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-500" /> Reset 4-Digit Security PIN
          </DialogTitle>
          <DialogDescription>
            Enter your username and a new 4-digit numeric PIN.
          </DialogDescription>
        </DialogHeader>

        {modalSuccessMsg ? (
          <div className="p-4 text-center space-y-2 text-emerald-500 font-bold text-xs bg-emerald-500/10 rounded-xl">
            <CheckCircle2 className="h-8 w-8 mx-auto" />
            <p>{modalSuccessMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleResetPinSubmit} className="space-y-4 py-2">
            {modalErrorMsg && <div className="text-xs text-rose-500 font-bold">{modalErrorMsg}</div>}
            <div>
              <label className="text-xs font-bold block mb-1">Username</label>
              <Input
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="e.g. rajesh_cbot"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">New 4-Digit PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 5555"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setResetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom">
                Update PIN
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Account Activation Dialog */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-emerald-500">
            <ShieldCheck className="h-5 w-5" /> Account Activation
          </DialogTitle>
          <DialogDescription>
            First-time login? Confirm your generated PIN and set a permanent 4-digit PIN.
          </DialogDescription>
        </DialogHeader>

        {modalSuccessMsg ? (
          <div className="p-4 text-center space-y-2 text-emerald-500 font-bold text-xs bg-emerald-500/10 rounded-xl">
            <CheckCircle2 className="h-8 w-8 mx-auto" />
            <p>{modalSuccessMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleActivateSubmit} className="space-y-4 py-2">
            {modalErrorMsg && <div className="text-xs text-rose-500 font-bold">{modalErrorMsg}</div>}
            <div>
              <label className="text-xs font-bold block mb-1">Username</label>
              <Input
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="e.g. arjun_das"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Generated Initial PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="3333"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Set Permanent 4-Digit PIN</label>
              <Input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="7777"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setActivateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="carrom">
                Activate Account
              </Button>
            </div>
          </form>
        )}
      </Dialog>

    </div>
  );
}
