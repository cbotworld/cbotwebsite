'use client';

const COUNTRIES = [
  { name: 'India',     code: 'in' },
  { name: 'Singapore', code: 'sg' },
  { name: 'Malaysia',  code: 'my' },
  { name: 'Sri Lanka', code: 'lk' },
  { name: 'USA',       code: 'us' },
  { name: 'Maldives',  code: 'mv' },
  { name: 'Canada',    code: 'ca' },
  { name: 'UK',        code: 'gb' },
  { name: 'Italy',     code: 'it' },
  { name: 'France',    code: 'fr' },
];

// Triplicate for seamless infinite loop
const ITEMS = [...COUNTRIES, ...COUNTRIES, ...COUNTRIES];

export function CountryBanner() {
  return (
    <div
      className="relative w-full overflow-hidden border-b border-amber-500/20 bg-black/60 backdrop-blur-sm"
      style={{ position: 'sticky', top: 57, zIndex: 40 }}
    >
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #000 0%, transparent 100%)' }}
      />
      <div
        className="absolute right-0 top-0 h-full w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #000 0%, transparent 100%)' }}
      />

      <div
        className="flex items-center whitespace-nowrap"
        style={{ animation: 'marquee 28s linear infinite', willChange: 'transform' }}
      >
        {ITEMS.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2.5 px-5 py-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-amber-400 transition-colors cursor-default shrink-0"
          >
            <img
              src={`https://flagcdn.com/24x18/${c.code}.png`}
              srcSet={`https://flagcdn.com/48x36/${c.code}.png 2x`}
              width={24}
              height={18}
              alt={c.name}
              className="rounded-sm shadow object-cover"
              style={{ display: 'inline-block', flexShrink: 0 }}
            />
            {c.name}
            <span className="mx-1 text-amber-500/25 font-thin select-none">|</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
