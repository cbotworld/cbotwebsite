import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-4">
      <h2 className="text-3xl font-black text-amber-400">404 - Page Not Found</h2>
      <p className="text-sm text-muted-foreground">The page you are looking for does not exist or has been moved.</p>
      <Link
        href="/"
        className="px-4 py-2 text-xs font-black bg-amber-500 text-slate-950 rounded-xl hover:bg-amber-400 transition-all"
      >
        Return to Home
      </Link>
    </div>
  );
}
