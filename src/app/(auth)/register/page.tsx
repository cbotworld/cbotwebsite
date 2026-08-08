'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ArrowRight, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import { generateUserCredentials } from '@/lib/actions/userActions';
import { UserRole } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<UserRole>('CAPTAIN');
  const [name, setName] = React.useState('');
  const [teamName, setTeamName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const [generatedCreds, setGeneratedCreds] = React.useState<{
    username: string;
    pin: string;
    name: string;
  } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await generateUserCredentials({ name, role });
    if (res.success && res.credentials) {
      setGeneratedCreds(res.credentials);
    }
    setLoading(false);
  };

  const copyCreds = () => {
    if (!generatedCreds) return;
    navigator.clipboard.writeText(`Username: ${generatedCreds.username}\nPIN: ${generatedCreds.pin}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 carrom-grid-pattern">
      <Card className="w-full max-w-lg border-amber-500/30 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-2 text-center">
          <img src="/logo.png" alt="Carrom Balu Official Logo" className="mx-auto h-20 w-20 object-contain drop-shadow-xl" />
          <CardTitle className="text-2xl font-black">Register CBOT Competitor</CardTitle>
          <CardDescription className="text-xs">
            Generate your unique Username and 4-Digit PIN
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {generatedCreds ? (
            <div className="p-6 space-y-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
              <CheckCircle2 className="h-10 w-10 text-amber-500 mx-auto" />
              <div>
                <h3 className="font-extrabold text-lg text-foreground">Welcome to CBOT, {generatedCreds.name}!</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Save your generated login credentials to access your dashboard.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border font-mono text-left text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Unique Username:</span>
                  <span className="font-black text-amber-500 text-sm">{generatedCreds.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Generated 4-Digit PIN:</span>
                  <span className="font-black text-emerald-500 text-base">{generatedCreds.pin}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button variant="carrom" onClick={copyCreds} className="w-full font-bold">
                  <Copy className="h-4 w-4 mr-1.5" /> {copied ? 'Copied Credentials!' : 'Copy Username & PIN'}
                </Button>
                <Link href="/login" className="block">
                  <Button variant="outline" className="w-full font-bold">
                    Proceed to Login Page <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-bold block mb-1">Select Primary Role</label>
                <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  <option value="CAPTAIN">Team Captain (Manage team roster & submit scores)</option>
                  <option value="PLAYER">Player (Individual Carrom competitor)</option>
                  <option value="ORGANIZER">Tournament Organizer (Host & direct tournaments)</option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">Full Competitor Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vikram R"
                  required
                />
              </div>

              {role === 'CAPTAIN' && (
                <div>
                  <label className="text-xs font-bold block mb-1">Team Franchise Name</label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Striker Kings"
                    required
                  />
                </div>
              )}

              <Button type="submit" variant="carrom" className="w-full font-bold justify-center" disabled={loading}>
                {loading ? 'Generating Account...' : 'Generate Username & 4-Digit PIN'} <KeyRound className="h-4 w-4 ml-1" />
              </Button>
            </form>
          )}

          <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
            Already have credentials?{' '}
            <Link href="/login" className="text-amber-500 font-bold hover:underline">
              Log In with Username & PIN
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
