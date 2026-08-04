import { useMemo } from 'react';
import { handClassOf } from '../../core/handRanking';
import {
  OPPONENT_ACTIONS,
  RANGE_PRESETS,
  rangeCombos,
  rangeFromPercent,
  resolveRange,
  type OpponentModel,
  type RangeMode,
} from '../../core/range';
import type { Card } from '../../core/cards';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Stepper } from '../ui/Stepper';
import { RangeMatrix } from './RangeMatrix';

const MODES: ReadonlyArray<{ value: RangeMode; label: string }> = [
  { value: 'random', label: 'Zufall' },
  { value: 'preset', label: 'Preset' },
  { value: 'stats', label: 'Stats' },
  { value: 'custom', label: 'Eigene' },
];

interface OpponentProfileProps {
  model: OpponentModel;
  onChange: (model: OpponentModel) => void;
  /** Eigene Karten, um die eigene Hand im Raster zu markieren. */
  hole: readonly Card[];
}

/**
 * Der Gegner-Editor: Wer sitzt dir gegenüber und welche Hände spielt er?
 *
 * Vier Wege zum Ziel – Zufall (keine Annahme), fertige Presets, Ableitung aus
 * seinen Statistiken oder ein von Hand gezeichnetes Raster.
 */
export function OpponentProfile({ model, onChange, hole }: OpponentProfileProps) {
  const derived = useMemo(() => resolveRange(model), [model]);
  const highlight = hole.length === 2 ? handClassOf(hole) : null;
  const patch = (changes: Partial<OpponentModel>) => onChange({ ...model, ...changes });

  return (
    <div className="space-y-4">
      <Segmented
        label="Gegnermodell"
        value={model.mode}
        onChange={(mode) => {
          // Beim Wechsel auf "Eigene" die gerade sichtbare Range übernehmen,
          // damit man nicht bei null anfangen muss.
          if (mode === 'custom' && model.custom.length === 0) {
            patch({ mode, custom: [...derived.range].flatMap((on, i) => (on ? [i] : [])) });
          } else {
            patch({ mode });
          }
        }}
        options={MODES}
        dense
      />

      {model.mode === 'preset' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => patch({ presetKey: preset.key })}
              aria-pressed={model.presetKey === preset.key}
              className={[
                'min-h-14 rounded-xl border px-3 text-left transition',
                model.presetKey === preset.key
                  ? 'border-gold bg-gold/15'
                  : 'border-line bg-surface-2 hover:border-felt-line',
              ].join(' ')}
            >
              <div className="text-sm font-bold">{preset.label}</div>
              <div className="text-xs text-muted">{(preset.percent * 100).toFixed(0)} %</div>
            </button>
          ))}
        </div>
      )}

      {model.mode === 'stats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label="VPIP %"
              value={model.stats.vpip}
              min={1}
              max={100}
              onChange={(vpip) => patch({ stats: { ...model.stats, vpip } })}
            />
            <Stepper
              label="PFR %"
              value={model.stats.pfr}
              min={0}
              max={100}
              onChange={(pfr) => patch({ stats: { ...model.stats, pfr } })}
            />
            <Stepper
              label="3-Bet %"
              value={model.stats.threeBet}
              min={0}
              max={100}
              onChange={(threeBet) => patch({ stats: { ...model.stats, threeBet } })}
            />
            <Stepper
              label="ATS %"
              value={model.stats.ats}
              min={0}
              max={100}
              onChange={(ats) => patch({ stats: { ...model.stats, ats } })}
            />
          </div>

          <Segmented
            label="Was hat er in dieser Hand gemacht?"
            value={model.action}
            onChange={(action) => patch({ action })}
            options={OPPONENT_ACTIONS}
            dense
          />

          <p className="text-xs leading-snug text-muted">
            VPIP = wie oft er freiwillig mitspielt · PFR = wie oft er preflop erhöht · ATS = wie oft
            er aus später Position zu stehlen versucht. Je enger die Werte, desto stärker die
            Hände, gegen die du rechnest.
          </p>
        </div>
      )}

      {model.mode === 'custom' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">
              Schnell füllen: beste {Math.round(derived.percent * 100)} %
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={Math.max(1, Math.round(derived.percent * 100))}
              onChange={(event) => {
                const range = rangeFromPercent(Number(event.target.value) / 100);
                patch({ custom: [...range].flatMap((on, index) => (on ? [index] : [])) });
              }}
              className="h-11 w-full accent-[var(--color-gold)]"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => patch({ custom: [] })}>
              Leeren
            </Button>
            <Button
              size="sm"
              onClick={() =>
                patch({ custom: Array.from({ length: 169 }, (_, index) => index) })
              }
            >
              Alles
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface-2 p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold">
            Range: {(derived.percent * 100).toFixed(1).replace('.', ',')} %
          </span>
          <span className="text-xs text-muted tabular-nums">
            {rangeCombos(derived.range)} von 1326 Kombinationen
          </span>
        </div>
        <RangeMatrix
          range={derived.range}
          highlight={highlight}
          onToggle={
            model.mode === 'custom'
              ? (classIndex) => {
                  const set = new Set(model.custom);
                  if (set.has(classIndex)) set.delete(classIndex);
                  else set.add(classIndex);
                  patch({ custom: [...set].sort((a, b) => a - b) });
                }
              : undefined
          }
        />
        <p className="mt-2 text-xs leading-snug text-muted">{derived.explanation}</p>
        {model.mode !== 'custom' && (
          <p className="mt-1 text-xs text-muted">
            Zum Bearbeiten auf „Eigene" wechseln – die aktuelle Auswahl wird übernommen.
          </p>
        )}
      </div>
    </div>
  );
}
