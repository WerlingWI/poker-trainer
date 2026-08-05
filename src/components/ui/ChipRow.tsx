interface ChipOption<T> {
  value: T;
  label: string;
  sub?: string;
}

interface ChipRowProps<T extends string | number> {
  label: string;
  options: ReadonlyArray<ChipOption<T>>;
  /** `null`, wenn der aktuelle Wert keinem Preset entspricht (z.B. eigene Eingabe). */
  value: T | null;
  onChange: (value: T) => void;
}

/**
 * Horizontal scrollende Preset-Chips, wie man sie von der Stake-/Buy-in-Auswahl
 * aus GGPoker & Co. kennt: ein Tipp genügt, kein Aufklappen nötig. Auf breiten
 * Displays bricht die Reihe stattdessen um, damit nichts abgeschnitten wirkt.
 */
export function ChipRow<T extends string | number>({ label, options, value, onChange }: ChipRowProps<T>) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              style={{ scrollSnapAlign: 'start' }}
              className={[
                'flex min-h-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-4 text-center transition',
                active
                  ? 'border-gold bg-gold/15 text-gold'
                  : 'border-line bg-surface-2 text-ink hover:border-felt-line',
              ].join(' ')}
            >
              <span className="text-base leading-none font-black">{option.label}</span>
              {option.sub && <span className="text-[0.65rem] text-muted">{option.sub}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
