import * as React from 'react';

export default function DashboardLoading() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center space-y-6 px-4 py-16 text-center">
      <div className="relative flex items-center justify-center p-6">
        <div className="h-44 w-44 sm:h-52 sm:w-52 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin shadow-[0_0_60px_rgba(245,158,11,0.35)]" />
        <img
          src="/logo.png"
          alt="Carrom Balu Official Logo"
          className="absolute h-32 w-32 sm:h-36 sm:w-36 object-contain drop-shadow-[0_0_35px_rgba(245,158,11,0.85)] animate-pulse"
        />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent tracking-wide">
          Loading CBOT Dashboard…
        </h3>
        <p className="text-xs text-muted-foreground font-semibold">
          Fetching live tournament data, teams, and match schedules
        </p>
      </div>
    </div>
  );
}
