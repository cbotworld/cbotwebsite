import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="relative flex items-center justify-center p-6">
        <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
        <img
          src="/logo.png"
          alt="Loading Dashboard"
          className="absolute h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-xl animate-pulse"
        />
      </div>
      <div className="space-y-2 text-center mt-4">
        <h3 className="text-xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
          Loading Dashboard...
        </h3>
        <p className="text-xs text-muted-foreground font-semibold">
          Fetching live tournament data and team standings
        </p>
      </div>
    </div>
  );
}
