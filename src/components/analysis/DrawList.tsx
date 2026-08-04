import type { DrawInfo } from '../../core/draws';

const TONE_STYLES = {
  made: 'border-win/40 bg-win/10 text-win',
  draw: 'border-gold/40 bg-gold/10 text-gold',
  info: 'border-line bg-surface-2 text-muted',
};

/** Zeigt, *warum* die Equity so ausfällt: fertige Hand, Draws, Overcards, Blocker. */
export function DrawList({ draws }: { draws: readonly DrawInfo[] }) {
  if (!draws.length) {
    return (
      <p className="text-sm text-muted">
        Vor dem Flop gibt es noch keine Draws – lege ein Board, um die Analyse zu sehen.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {draws.map((draw) => (
        <li
          key={draw.key}
          className={`animate-rise rounded-xl border p-3 ${TONE_STYLES[draw.tone]}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-bold">{draw.label}</span>
            {draw.outs !== undefined && (
              <span className="shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-xs font-bold tabular-nums">
                {draw.outs} Outs
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-snug text-ink/80">{draw.description}</p>
        </li>
      ))}
    </ul>
  );
}
