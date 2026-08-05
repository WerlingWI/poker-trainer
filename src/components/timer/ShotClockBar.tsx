import { activePlayer, formatClock } from '../../core/clock';
import type { useShotClock } from '../../hooks/useShotClock';
import { Button } from '../ui/Button';

const PHASE_LABEL: Record<string, string> = {
  idle: 'Bereit',
  reacting: 'Reaktionszeit',
  timebank: 'Timebank',
  expired: 'Zeit abgelaufen',
};

interface ShotClockBarProps {
  clock: ReturnType<typeof useShotClock>;
  onOpenPreGame: () => void;
}

/**
 * Kompakte Shot-Clock direkt auf der Analyse-Seite – während man eine Hand
 * durchrechnet, läuft am Tisch parallel die Uhr. Spieler und Zeiten werden im
 * Pre-Game-Fenster eingerichtet; hier geht es nur ums Starten, Stoppen und Ablesen.
 */
export function ShotClockBar({ clock, onOpenPreGame }: ShotClockBarProps) {
  const { state } = clock;
  const player = activePlayer(state);
  const seconds = clock.remainingSeconds;
  const urgent = seconds !== null && seconds <= 3;
  const { phase } = state;

  return (
    <section className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={[
              'shrink-0 text-3xl leading-none font-black tabular-nums transition-colors',
              phase === 'expired' || urgent
                ? 'animate-pulse text-loss'
                : phase === 'timebank'
                  ? 'text-tie'
                  : phase === 'reacting'
                    ? 'text-gold'
                    : 'text-muted',
            ].join(' ')}
          >
            {phase === 'idle' ? '–:–' : formatClock(seconds ?? 0)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold tracking-wide text-muted uppercase">
              {PHASE_LABEL[phase]}
              {player ? ` · ${player.name}` : ''}
            </div>
            {phase === 'expired' && (
              <div className="truncate text-xs font-semibold text-loss">Zeit ist um</div>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant={phase === 'idle' ? 'surface' : 'positive'}
          disabled={phase === 'idle'}
          onClick={clock.finishTurn}
        >
          Fertig
        </Button>
      </div>

      {state.players.length > 0 ? (
        <div className="mt-3 -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
          {state.players.map((p) => {
            const active = state.activePlayerId === p.id && phase !== 'idle';
            const low = p.timebankRemaining <= 10;
            return (
              <button
                key={p.id}
                onClick={() => clock.startTurn(p.id)}
                className={[
                  'flex min-h-11 shrink-0 flex-col items-center justify-center gap-0 rounded-xl border px-3 transition',
                  active
                    ? 'border-gold bg-gold/15'
                    : 'border-line bg-surface-2 hover:border-felt-line',
                ].join(' ')}
              >
                <span className="text-xs font-bold whitespace-nowrap">{p.name}</span>
                <span className={`text-[0.65rem] tabular-nums ${low ? 'text-loss' : 'text-muted'}`}>
                  {formatClock(p.timebankRemaining)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <button
          onClick={onOpenPreGame}
          className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-line text-xs text-muted transition hover:border-gold hover:text-gold"
        >
          Noch keine Spieler – im Pre-Game-Fenster hinzufügen
        </button>
      )}
    </section>
  );
}
