import { useState } from 'react';
import type { ClockConfig } from '../../core/clock';
import type { SpotState } from '../../core/types';
import type { useShotClock } from '../../hooks/useShotClock';
import { Button } from '../ui/Button';
import { ChipRow } from '../ui/ChipRow';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

interface PreGameSheetProps {
  open: boolean;
  onClose: () => void;
  spot: SpotState;
  setSpot: (update: SpotState | ((prev: SpotState) => SpotState)) => void;
  clockConfig: ClockConfig;
  onClockConfigChange: (config: ClockConfig) => void;
  clock: ReturnType<typeof useShotClock>;
}

interface BlindPreset {
  sb: number;
  bb: number;
}

const BLIND_PRESETS: readonly BlindPreset[] = [
  { sb: 0.5, bb: 1 },
  { sb: 1, bb: 2 },
  { sb: 2, bb: 5 },
  { sb: 5, bb: 10 },
  { sb: 10, bb: 20 },
  { sb: 25, bb: 50 },
];

const blindKey = (sb: number, bb: number) => `${sb}-${bb}`;
const formatBlind = (n: number) => n.toString().replace('.', ',');

const STACK_MULTIPLES = [40, 60, 100, 150, 200, 300];
const REACTION_PRESETS = [5, 10, 15, 20, 30];
const TIMEBANK_PRESETS = [30, 60, 90, 120, 180];

/**
 * Alles, was vor der ersten Hand feststehen sollte – an der Stakes-/Buy-in-Auswahl
 * von Plattformen wie GGPoker orientiert: große Presets zum Antippen statt langem
 * Tippen in Zahlenfeldern. Wer am Tisch sitzt, Dealer und Fold regelt der Pokertisch
 * selbst; hier geht es nur um Blinds, Startstack und die Shot-Clock. Lässt sich
 * jederzeit erneut öffnen, auch mitten im Abend, wenn die Blinds steigen.
 */
export function PreGameSheet({
  open,
  onClose,
  spot,
  setSpot,
  clockConfig,
  onClockConfigChange,
  clock,
}: PreGameSheetProps) {
  const [nameInput, setNameInput] = useState('');
  const update = (patch: Partial<SpotState>) => setSpot((prev) => ({ ...prev, ...patch }));

  const currentBlindKey = blindKey(spot.smallBlind, spot.bigBlind);
  const applyBlinds = (key: string) => {
    const preset = BLIND_PRESETS.find((p) => blindKey(p.sb, p.bb) === key);
    if (!preset) return;
    // Neue Blinds heißen auch: frischer Pot, wie zu Beginn einer neuen Hand.
    update({ smallBlind: preset.sb, bigBlind: preset.bb, pot: preset.bb * 3, call: preset.bb });
  };

  const currentStackMultiple = spot.bigBlind > 0 ? Math.round(spot.stack / spot.bigBlind) : null;

  const addPlayer = () => {
    if (!nameInput.trim()) return;
    clock.addPlayer(nameInput);
    setNameInput('');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Vor dem Spiel">
      <div className="space-y-6">
        <ChipRow
          label="Blinds"
          value={currentBlindKey}
          options={BLIND_PRESETS.map((p) => ({
            value: blindKey(p.sb, p.bb),
            label: `${formatBlind(p.sb)}/${formatBlind(p.bb)}`,
          }))}
          onChange={applyBlinds}
        />

        <ChipRow
          label="Startstack"
          value={currentStackMultiple}
          options={STACK_MULTIPLES.map((multiple) => ({
            value: multiple,
            label: `${multiple} BB`,
            sub: String(Math.round(multiple * spot.bigBlind)),
          }))}
          onChange={(multiple) =>
            setSpot((prev) => ({ ...prev, stack: Math.round(multiple * prev.bigBlind) }))
          }
        />

        <div className="space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4">
          <h3 className="text-sm font-bold">Shot-Clock</h3>

          <ChipRow
            label="Reaktionszeit"
            value={clockConfig.reactionSeconds}
            options={REACTION_PRESETS.map((s) => ({ value: s, label: `${s}s` }))}
            onChange={(reactionSeconds) => onClockConfigChange({ ...clockConfig, reactionSeconds })}
          />
          <ChipRow
            label="Timebank pro Spieler"
            value={clockConfig.timebankSeconds}
            options={TIMEBANK_PRESETS.map((s) => ({ value: s, label: `${s}s` }))}
            onChange={(timebankSeconds) =>
              onClockConfigChange({ ...clockConfig, timebankSeconds })
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label="Reaktionszeit (eigen)"
              value={clockConfig.reactionSeconds}
              min={3}
              max={60}
              suffix="Sek."
              onChange={(reactionSeconds) => onClockConfigChange({ ...clockConfig, reactionSeconds })}
            />
            <Stepper
              label="Timebank (eigen)"
              value={clockConfig.timebankSeconds}
              min={0}
              max={600}
              step={10}
              suffix="Sek."
              onChange={(timebankSeconds) =>
                onClockConfigChange({ ...clockConfig, timebankSeconds })
              }
            />
          </div>

          <p className="text-xs leading-snug text-muted">
            Jede Entscheidung beginnt mit der Reaktionszeit. Läuft sie ab, zehrt automatisch die
            Timebank weiter – ein über den Abend endlicher Vorrat. Ist sie aufgebraucht, bleibt
            ab dann nur noch die reine Reaktionszeit, ohne weitere Verlängerung.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">Spieler für die Uhr</h3>

          {clock.state.players.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {clock.state.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 py-2 pr-2 pl-3 text-sm"
                >
                  <span className="font-semibold">{p.name}</span>
                  <button
                    onClick={() => clock.removePlayer(p.id)}
                    aria-label={`${p.name} entfernen`}
                    className="flex size-7 items-center justify-center rounded-full text-muted hover:text-loss"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addPlayer()}
              placeholder="Name des Spielers"
              className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none focus:border-felt-line"
            />
            <Button onClick={addPlayer} disabled={!nameInput.trim()}>
              Hinzufügen
            </Button>
          </div>

          {clock.state.players.length > 0 && (
            <Button variant="surface" block onClick={clock.resetAll}>
              Alle Timebanks zurücksetzen
            </Button>
          )}
        </div>

        <Button block size="xl" variant="primary" onClick={onClose}>
          Fertig
        </Button>
      </div>
    </Sheet>
  );
}
