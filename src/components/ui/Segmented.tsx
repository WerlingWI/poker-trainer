interface SegmentedProps<T extends string | number> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
  /** Kompaktere Variante für Leisten mit vielen Optionen. */
  dense?: boolean;
}

/** Große, gut treffbare Umschaltleiste – ersetzt überall Dropdowns und Checkboxen. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  dense,
}: SegmentedProps<T>) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          {label}
        </div>
      )}
      {/* Umbrechend statt überlaufend: Bei vielen oder langen Optionen rutschen
          einzelne Schalter auf schmalen Displays in die nächste Zeile. */}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={[
                'min-w-0 flex-1 basis-24 rounded-lg font-semibold transition',
                dense ? 'min-h-10 px-2 text-sm' : 'min-h-11 px-3 text-base',
                active
                  ? 'bg-felt text-white shadow-[var(--shadow-lift)]'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              ].join(' ')}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
