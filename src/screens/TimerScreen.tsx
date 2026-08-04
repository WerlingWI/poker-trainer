import { useState } from 'react';
import { activePlayer, formatClock, type ClockConfig } from '../core/clock';
import { useShotClock } from '../hooks/useShotClock';
import type { SoundName } from '../hooks/useSound';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { Stepper } from '../components/ui/Stepper';

interface TimerScreenProps {
  config: ClockConfig;
  onConfigChange: (config: ClockConfig) => void;
  play: (name: SoundName) => void;
}

const PHASE_LABEL: Record<string, string> = {
  idle: 'Bereit',
  reacting: 'Reaktionszeit',
  timebank: 'Timebank',
  expired: 'Zeit abgelaufen',
};

/**
 * Shot-Clock für den Tisch: Jede Entscheidung startet mit der Reaktionszeit.
 * Läuft sie ab, ohne dass gehandelt wurde, zehrt automatisch die persönliche
 * Timebank des Spielers weiter herunter. Ist dessen Timebank aufgebraucht,
 * bleibt ihm ab dann nur noch die reine Reaktionszeit – ohne Verlängerung.
 */
export function TimerScreen({ config, onConfigChange, play }: TimerScreenProps) {
  const clock = useShotClock(config, play);
  const [nameInput, setNameInput] = useState('');
  const player = activePlayer(clock.state);
  const { phase } = clock.state;

  const seconds = clock.remainingSeconds;
  const urgent = seconds !== null && seconds <= 3;

  const addPlayer = () => {
    if (!nameInput.trim()) return;
    clock.addPlayer(nameInput);
    setNameInput('');
  };

  return (
    <div className="space-y-4">
      <section
        className="rounded-3xl border border-felt-line/40 p-6"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, var(--color-felt) 0%, var(--color-felt-deep) 78%)',
          boxShadow: 'inset 0 2px 30px rgb(0 0 0 / 0.35), var(--shadow-lift)',
        }}
      >
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="text-xs font-bold tracking-[0.2em] text-white/70 uppercase">
            {PHASE_LABEL[phase]}
            {player ? ` · ${player.name}` : ''}
          </span>
          <span
            className={[
              'text-8xl leading-none font-black tabular-nums transition-colors',
              phase === 'expired'
                ? 'animate-pulse text-loss'
                : urgent
                  ? 'animate-pulse text-loss'
                  : phase === 'timebank'
                    ? 'text-tie'
                    : 'text-white',
            ].join(' ')}
          >
            {phase === 'idle' ? '–:–' : formatClock(seconds ?? 0)}
          </span>
          {phase === 'timebank' && player && (
            <span className="text-sm text-white/70">
              Timebank von {player.name}: {formatClock(player.timebankRemaining)} übrig
            </span>
          )}
          {phase === 'idle' && (
            <span className="text-sm text-white/60">
              Tippe unten auf einen Spieler, um seinen Zug zu starten.
            </span>
          )}
          {phase === 'expired' && (
            <span className="text-sm font-semibold text-loss">
              Reaktionszeit und Timebank sind aufgebraucht.
            </span>
          )}
        </div>

        <Button
          block
          size="xl"
          variant={phase === 'idle' ? 'surface' : 'positive'}
          disabled={phase === 'idle'}
          onClick={clock.finishTurn}
        >
          Fertig
        </Button>
      </section>

      <Panel title="Spieler">
        <div className="space-y-3">
          {clock.state.players.length === 0 && (
            <p className="text-sm text-muted">
              Noch keine Spieler – unten Namen eintragen und hinzufügen.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {clock.state.players.map((p) => {
              const active = clock.state.activePlayerId === p.id && phase !== 'idle';
              const low = p.timebankRemaining <= 10;
              return (
                <div key={p.id} className="group relative">
                  <button
                    onClick={() => clock.startTurn(p.id)}
                    className={[
                      'min-h-14 rounded-xl border px-4 pr-8 text-left transition',
                      active
                        ? 'border-gold bg-gold/15'
                        : 'border-line bg-surface-2 hover:border-felt-line',
                    ].join(' ')}
                  >
                    <div className="text-sm font-bold">{p.name}</div>
                    <div className={`text-xs tabular-nums ${low ? 'text-loss' : 'text-muted'}`}>
                      Timebank {formatClock(p.timebankRemaining)}
                    </div>
                  </button>
                  <button
                    onClick={() => clock.removePlayer(p.id)}
                    aria-label={`${p.name} entfernen`}
                    className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full text-muted before:absolute before:-inset-2.5 before:content-[''] hover:text-loss"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

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
      </Panel>

      <Panel title="Einstellungen" collapsible defaultOpen={false}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label="Reaktionszeit"
              value={config.reactionSeconds}
              min={3}
              max={60}
              suffix="Sek."
              onChange={(reactionSeconds) => onConfigChange({ ...config, reactionSeconds })}
            />
            <Stepper
              label="Timebank pro Spieler"
              value={config.timebankSeconds}
              min={0}
              max={600}
              step={10}
              suffix="Sek."
              onChange={(timebankSeconds) => onConfigChange({ ...config, timebankSeconds })}
            />
          </div>
          <p className="text-sm leading-snug text-muted">
            Jede Entscheidung beginnt mit {config.reactionSeconds} Sekunden Reaktionszeit. Läuft
            diese ab, ohne dass gehandelt wurde, zehrt automatisch die persönliche Timebank des
            Spielers weiter herunter – ein über den Abend endlicher Vorrat von{' '}
            {config.timebankSeconds} Sekunden. Ist sie aufgebraucht, bleiben ab diesem Moment nur
            noch die {config.reactionSeconds} Sekunden Reaktionszeit pro Entscheidung, ohne jede
            weitere Verlängerung. Neue Werte gelten erst nach „Alle Timebanks zurücksetzen".
          </p>
        </div>
      </Panel>
    </div>
  );
}
