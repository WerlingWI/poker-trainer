import { Stepper } from '../ui/Stepper';
import type { SpotState } from '../../core/types';

interface QuickBetBarProps {
  spot: SpotState;
  setSpot: (update: SpotState | ((prev: SpotState) => SpotState)) => void;
}

const BET_PRESETS: ReadonlyArray<{ label: string; fraction: number }> = [
  { label: 'Check', fraction: 0 },
  { label: '⅓ Pot', fraction: 1 / 3 },
  { label: '½ Pot', fraction: 0.5 },
  { label: '⅔ Pot', fraction: 2 / 3 },
  { label: 'Pot', fraction: 1 },
];

/**
 * Immer sichtbare Schnelleingabe für die Zahlen, die sich während einer Hand
 * laufend ändern. Die Bet-Size-Chips setzen den Call direkt als Anteil vom
 * aktuellen Pot – am Tisch schneller getippt als über den Stepper hochzuzählen.
 */
export function QuickBetBar({ spot, setSpot }: QuickBetBarProps) {
  const update = (patch: Partial<SpotState>) => setSpot((prev) => ({ ...prev, ...patch }));
  const step = Math.max(1, spot.bigBlind);

  /**
   * Liest Pot und Stack aus `prev`, nicht aus der Closure: Tippt man zwei
   * Bet-Size-Chips kurz hintereinander, hat React für den ersten Klick noch
   * nicht neu gerendert – ein Lesen aus der äußeren `spot`-Variable würde dann
   * beide Klicks mit demselben veralteten Pot rechnen.
   */
  const setCallFraction = (fraction: number) => {
    setSpot((prev) => ({ ...prev, call: Math.min(prev.stack, Math.round(prev.pot * fraction)) }));
  };

  const setAllIn = () => setSpot((prev) => ({ ...prev, call: prev.stack }));

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stepper label="Pot" value={spot.pot} min={0} step={step} onChange={(pot) => update({ pot })} />
        <Stepper label="Call" value={spot.call} min={0} step={step} onChange={(call) => update({ call })} />
        <Stepper
          label="Stack"
          value={spot.stack}
          min={0}
          step={step * 5}
          onChange={(stack) => update({ stack })}
        />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
          Call schnell setzen
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {BET_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setCallFraction(preset.fraction)}
              className="min-h-11 rounded-lg border border-line bg-surface-2 text-sm font-bold text-ink transition hover:border-felt-line hover:bg-felt/10"
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={setAllIn}
            className="col-span-1 min-h-11 rounded-lg border border-loss/50 bg-loss/10 text-sm font-bold text-loss transition hover:bg-loss/20"
          >
            All-in
          </button>
        </div>
      </div>
    </section>
  );
}
