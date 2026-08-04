import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'gold';
}

const TONES = {
  default: 'text-ink',
  positive: 'text-win',
  negative: 'text-loss',
  gold: 'text-gold',
};

/** Eine große Zahl mit Beschriftung – das Grundelement der Ergebnisanzeige. */
export function StatTile({ label, value, hint, tone = 'default' }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-[0.7rem] font-bold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl leading-tight font-black tabular-nums ${TONES[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs leading-snug text-muted">{hint}</div>}
    </div>
  );
}
