'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, KeyRound, Copy, CheckCircle2, AlertCircle, Mail, Phone, Lock, User, RefreshCw, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  // Form State
  const [step, setStep] = React.useState<1 | 2 | 3>(1); // 1: Form, 2: OTP, 3: Success
  const [name, setName] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [otp, setOtp] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [resendTimer, setResendTimer] = React.useState(0);

  // Success credentials state
  const [createdCreds, setCreatedCreds] = React.useState<{
    username: string;
    pin: string;
    name: string;
    email: string;
  } | null>(null);

  // Timer countdown for resend
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMsg('Security PIN must be a 4-digit number.');
      return;
    }
    if (pin !== confirmPin) {
      setErrorMsg('Security PIN and Confirm PIN do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP.');
      }
      setStep(2);
      setResendTimer(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to resend OTP.');
      }
      setResendTimer(60);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP & Create Account
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          name: name.trim(),
          mobile: mobile.trim(),
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid OTP verification code.');
      }

      setCreatedCreds({
        username: data.username,
        pin: data.pin || pin,
        name: data.user?.name || name,
        email: data.user?.email || email,
      });
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the OTP code.');
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = () => {
    if (!createdCreds) return;
    navigator.clipboard.writeText(`Username: ${createdCreds.username}\nPIN: ${createdCreds.pin}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      <Card className="w-full max-w-lg border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">
            {step === 3 ? 'Account Created!' : step === 2 ? 'Verify Email OTP' : 'Create CBOT Account'}
          </CardTitle>
          <CardDescription className="text-xs">
            {step === 3
              ? 'Your account has been verified & credentials emailed to you'
              : step === 2
              ? `Enter the 6-digit OTP code sent to ${email}`
              : 'Register your player account with Name, Mobile, Email & PIN'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 && (
            /* ── Step 1: Input Registration Details ───────────────────────────── */
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Karthik Burra"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Mobile / WhatsApp Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. player@example.com"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">4-Digit Security PIN *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-9 font-mono tracking-widest text-base font-bold"
                      placeholder="••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1">Confirm PIN *</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      maxLength={4}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="pl-9 font-mono tracking-widest text-base font-bold"
                      placeholder="••••"
                      required
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send Verification OTP'} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}

          {step === 2 && (
            /* ── Step 2: Input Email OTP ───────────────────────────────────────── */
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                A 6-digit verification code has been sent to <strong className="text-white">{email}</strong>. Please check your inbox.
              </div>

              <div>
                <label className="text-xs font-bold block mb-2 text-muted-foreground uppercase tracking-wider">
                  Enter 6-Digit Email OTP
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="font-mono text-center text-2xl font-black tracking-[12px] h-14"
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>

              <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
                {loading ? 'Verifying OTP...' : 'Verify OTP & Create Account'} <CheckCircle2 className="h-4 w-4 ml-1" />
              </Button>

              <div className="flex justify-between items-center text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  ← Edit Registration Info
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="text-amber-500 font-bold hover:underline disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && createdCreds && (
            /* ── Step 3: Success Screen ────────────────────────────────────────── */
            <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <h3 className="font-extrabold text-xl text-foreground">Welcome to CBOT, {createdCreds.name}!</h3>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Your account is verified! A copy of your login credentials has been sent to{' '}
                  <strong className="text-amber-400">{createdCreds.email}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border font-mono text-left text-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Generated Username:</span>
                  <span className="font-black text-amber-500 text-sm">{createdCreds.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Security PIN:</span>
                  <span className="font-black text-emerald-500 text-base">{createdCreds.pin}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button variant="carrom" onClick={copyCreds} className="w-full font-bold">
                  <Copy className="h-4 w-4 mr-1.5" /> {copied ? 'Copied Credentials!' : 'Copy Username & PIN'}
                </Button>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full font-bold">
                    Proceed to Login <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {step !== 3 && (
            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
              Already have an account?{' '}
              <Link href="/login" className="text-amber-500 font-bold hover:underline">
                Log In with Username & PIN
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
