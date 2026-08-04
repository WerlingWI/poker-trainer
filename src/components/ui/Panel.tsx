import { useState, type ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
  /** Aufklappbar machen – Standardzustand über `defaultOpen`. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  action?: ReactNode;
}

/** Abschnitt mit Überschrift. Optional zusammenklappbar, damit die Seite kurz bleibt. */
export function Panel({ title, children, collapsible, defaultOpen = true, action }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-4 py-1.5">
        {collapsible ? (
          <button
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex min-h-12 flex-1 items-center gap-2 text-left text-base font-bold"
          >
            <span
              aria-hidden="true"
              className={`text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            >
              ›
            </span>
            {title}
          </button>
        ) : (
          <h3 className="flex-1 py-1.5 text-base font-bold">{title}</h3>
        )}
        {action}
      </header>
      {open && <div className="px-4 pt-1 pb-4">{children}</div>}
    </section>
  );
}

interface ProgressBarProps {
  value: number;
  label: string;
}

/** Fortschritt der Simulation. Läuft flüssig, weil gerechnet wird woanders. */
export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-semibold text-muted">
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-gold border-t-transparent"
          />
          {label}
        </span>
        <span className="tabular-nums text-muted">{Math.round(value * 100)} %</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-150 ease-linear"
          style={{ width: `${Math.min(100, value * 100)}%` }}
        />
      </div>
    </div>
  );
}
