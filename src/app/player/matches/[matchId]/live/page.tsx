import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const revalidate = 0;

export default async function PlayerMatchLivePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login?callbackUrl=/dashboard/player');
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-3xl border border-amber-500/30 bg-card p-8 text-center space-y-4 shadow-lg">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">CBOT Live</div>
        <h1 className="text-2xl font-black tracking-tight">Go live only in the CBOT app</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Streaming is not available on the website. Open the CBOT mobile app, go to Matches, and tap GO LIVE for your match day.
        </p>
        <Link
          href="/dashboard/player"
          className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400"
        >
          Back to player dashboard
        </Link>
      </div>
    </div>
  );
}
