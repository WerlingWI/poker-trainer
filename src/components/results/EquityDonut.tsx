import type { EquityBreakdown } from '../../core/simulate';

interface EquityDonutProps {
  breakdown: EquityBreakdown;
  /** Während der Simulation wird der Wert laufend aktualisiert. */
  running?: boolean;
  size?: number;
}

const SEGMENTS = [
  { key: 'win' as const, label: 'Gewinn', color: 'var(--color-win)' },
  { key: 'tie' as const, label: 'Split', color: 'var(--color-tie)' },
  { key: 'loss' as const, label: 'Verlust', color: 'var(--color-loss)' },
];

/**
 * Handgezeichnetes SVG-Kreisdiagramm – kein Chart-Paket nötig.
 * Die Segmente werden über `stroke-dasharray` gezeichnet und animieren
 * sich beim Aktualisieren weich in ihre neue Länge.
 */
export function EquityDonut({ breakdown, running, size = 190 }: EquityDonutProps) {
  const stroke = size * 0.13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = SEGMENTS.map((segment) => {
    const value = breakdown[segment.key];
    const arc = { ...segment, value, length: value * circumference, offset };
    offset += value * circumference;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Gewinn ${(breakdown.win * 100).toFixed(1)} Prozent, Split ${(
            breakdown.tie * 100
          ).toFixed(1)} Prozent, Verlust ${(breakdown.loss * 100).toFixed(1)} Prozent`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth={stroke}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeLinecap="butt"
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              style={{ transition: 'stroke-dasharray 0.4s ease, stroke-dashoffset 0.4s ease' }}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[0.65rem] font-bold tracking-[0.15em] text-muted uppercase">
            Equity
          </span>
          <span
            className={`text-4xl leading-none font-black tabular-nums ${running ? 'opacity-70' : ''}`}
          >
            {(breakdown.equity * 100).toFixed(1)}
            <span className="text-xl">%</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {arcs.map((arc) => (
          <div key={arc.key} className="flex items-center gap-1.5 text-sm">
            <span
              aria-hidden="true"
              className="size-3 rounded-full"
              style={{ background: arc.color }}
            />
            <span className="text-muted">{arc.label}</span>
            <span className="font-bold tabular-nums">{(arc.value * 100).toFixed(1)} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ResultBarsProps {
  breakdown: EquityBreakdown;
}

/** Dieselben Zahlen als Balken – für alle, die Balken schneller lesen als Kreise. */
export function ResultBars({ breakdown }: ResultBarsProps) {
  return (
    <div className="space-y-3">
      {SEGMENTS.map((segment) => {
        const value = breakdown[segment.key];
        return (
          <div key={segment.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-muted">{segment.label}</span>
              <span className="text-lg font-bold tabular-nums">{(value * 100).toFixed(1)} %</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(0, value * 100)}%`, background: segment.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
