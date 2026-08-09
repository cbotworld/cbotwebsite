import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="relative flex items-center justify-center p-6">
        <div className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
        <img
          src="/logo.png"
          alt="Loading Organizer Dashboard"
          className="absolute h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-xl animate-pulse"
        />
      </div>
      <div className="space-y-2 text-center mt-4">
        <h3 className="text-xl font-black bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 bg-clip-text text-transparent">
          Loading Organizer Dashboard...
        </h3>
        <p className="text-xs text-muted-foreground font-semibold">
          Fetching system data and player registry
        </p>
      </div>
    </div>
  );
}
