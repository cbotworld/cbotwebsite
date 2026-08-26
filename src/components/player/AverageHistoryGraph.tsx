'use client';

export default function AverageHistoryGraph({
  history,
  note,
}: {
  history: Array<{ effectiveFrom: string; average: number }>;
  note?: string;
}) {
  if (!history.length) return null;
  const max = Math.max(...history.map((x) => Number(x.average) || 0), 1);

  return (
    <div>
      <div className="text-[10px] font-black uppercase text-muted-foreground mb-1">Average history (lower is better)</div>
      <div className="flex items-end gap-1.5 h-24">
        {history.map((h) => {
          const height = Math.max(10, (Number(h.average) / max) * 88);
          return (
            <div key={h.effectiveFrom} className="flex-1 min-w-[2rem] flex flex-col items-center gap-1">
              <div
                className="w-full bg-emerald-400/80 rounded-t"
                style={{ height }}
                title={`${h.effectiveFrom}: ${h.average}`}
              />
              <div className="text-[9px] font-mono text-muted-foreground leading-tight">{h.average}</div>
              <div className="text-[8px] text-muted-foreground/70 leading-tight">{h.effectiveFrom.slice(5)}</div>
            </div>
          );
        })}
      </div>
      {note ? <p className="text-[10px] text-muted-foreground mt-2">{note}</p> : null}
    </div>
  );
}
