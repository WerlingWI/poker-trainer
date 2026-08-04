interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Einheit hinter dem Wert, z.B. "Chips". */
  suffix?: string;
}

/**
 * Zahleneingabe ohne Tastatur: zwei große Flächen und der Wert dazwischen.
 * Der Wert selbst ist zusätzlich ein echtes Zahlenfeld, falls jemand doch tippen möchte.
 */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 1_000_000,
  suffix,
}: StepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface">
        <button
          aria-label={`${label} verringern`}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="min-h-12 w-12 shrink-0 text-2xl leading-none text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        >
          −
        </button>

        <label className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            onChange={(event) => onChange(clamp(Number(event.target.value)))}
            className="w-full min-w-0 bg-transparent text-center text-lg font-bold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
        </label>

        <button
          aria-label={`${label} erhöhen`}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="min-h-12 w-12 shrink-0 text-2xl leading-none text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}
