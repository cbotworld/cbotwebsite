import { SCORE_EDIT_RULES, SCORE_EDIT_RULES_TITLE } from '@/lib/score-edit-policy';

export function ScoreEditRules({
  note,
}: {
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs space-y-1.5">
      <div className="font-black uppercase tracking-wide text-amber-400">{SCORE_EDIT_RULES_TITLE}</div>
      <ul className="space-y-0.5 text-muted-foreground font-semibold">
        {SCORE_EDIT_RULES.map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
      {note ? <p className="text-foreground/90 font-medium pt-0.5">{note}</p> : null}
    </div>
  );
}
