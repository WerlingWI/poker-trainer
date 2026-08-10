import { useState } from 'react';
import { CardFace } from '../components/cards/CardFace';
import { StatTile } from '../components/results/StatTile';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { HAND_CLASS_LABELS, HAND_CLASS_ORDER } from '../core/handClass';
import { pct } from '../core/odds';
import { emptyTable, type Seat } from '../core/table';
import { defaultSpot, streetOf, STREET_LABELS, type SpotState } from '../core/types';
import { averageEquity, favouriteHands, type AppState, type HistoryEntry } from '../state/appStorage';

interface StatsScreenProps {
  app: AppState;
  onToggleFavorite: (id: string) => void;
  onRemove: (id: string) => void;
  onRestore: (spot: SpotState) => void;
  onReset: () => void;
}

export function StatsScreen({
  app,
  onToggleFavorite,
  onRemove,
  onRestore,
  onReset,
}: StatsScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const accuracy = app.learn.answered ? app.learn.correct / app.learn.answered : 0;
  const favorites = favouriteHands(app);
  const maxCount = favorites[0]?.[1] ?? 1;

  const classRows = HAND_CLASS_ORDER.map((key) => ({
    key,
    label: HAND_CLASS_LABELS[key],
    ...app.byClass[key],
  })).filter((row) => row.count > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Analysierte Hände" value={app.handsAnalyzed} />
        <StatTile
          label="Ø Equity"
          value={`${pct(averageEquity(app), 1)} %`}
          tone="gold"
          hint="über alle Analysen"
        />
        <StatTile
          label="Lernmodus"
          value={`${app.learn.correct}/${app.learn.answered}`}
          hint={`${pct(accuracy, 0)} % richtig`}
          tone={accuracy >= 0.6 ? 'positive' : 'default'}
        />
        <StatTile label="Beste Serie" value={app.learn.bestStreak} tone="gold" />
      </div>

      <Panel title="Equity nach Handtyp">
        {classRows.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Hände analysiert.</p>
        ) : (
          <ul className="space-y-2.5">
            {classRows.map((row) => {
              const average = row.equitySum / row.count;
              return (
                <li key={row.key} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate text-muted">{row.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-gold transition-[width] duration-500"
                      style={{ width: `${average * 100}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right font-bold tabular-nums">
                    {pct(average, 0)} %
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">
                    ×{row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Lieblingshände">
        {favorites.length === 0 ? (
          <p className="text-sm text-muted">Noch keine Hände analysiert.</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map(([code, count]) => (
              <li key={code} className="flex items-center gap-3">
                <span className="w-14 shrink-0 rounded-lg bg-surface-2 px-2 py-1 text-center font-black">
                  {code}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-felt-line"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-sm text-muted tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Hand-History (${app.history.length})`}>
        {app.history.length === 0 ? (
          <p className="text-sm text-muted">
            Jede fertig gerechnete Hand landet hier – mit einem Tipp holst du sie zurück.
          </p>
        ) : (
          <ul className="space-y-2">
            {app.history.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                onToggleFavorite={() => onToggleFavorite(entry.id)}
                onRemove={() => onRemove(entry.id)}
                onRestore={() => onRestore(toSpot(entry))}
              />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Daten">
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Alles wird ausschließlich in diesem Browser gespeichert. Nichts verlässt dein Gerät.
          </p>
          {confirmReset ? (
            <div className="flex gap-2">
              <Button
                variant="negative"
                block
                onClick={() => {
                  onReset();
                  setConfirmReset(false);
                }}
              >
                Wirklich alles löschen
              </Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button variant="surface" block onClick={() => setConfirmReset(true)}>
              Statistik &amp; History zurücksetzen
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function HistoryRow({
  entry,
  onToggleFavorite,
  onRemove,
  onRestore,
}: {
  entry: HistoryEntry;
  onToggleFavorite: () => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-2.5">
      <button
        onClick={onRestore}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        aria-label={`Hand ${entry.code} wieder laden`}
      >
        <span className="flex shrink-0 gap-1">
          {entry.hole.map((card) => (
            <CardFace key={card} card={card} size="xs" />
          ))}
        </span>
        <span className="hidden shrink-0 gap-1 sm:flex">
          {entry.board.map((card) => (
            <CardFace key={card} card={card} size="xs" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">
            {entry.code} · {pct(entry.equity, 1)} % Equity
          </span>
          <span className="block truncate text-xs text-muted">
            {STREET_LABELS[streetOf(entry.board.length)]} · {entry.players - 1} Gegner · Pot{' '}
            {entry.pot}
          </span>
        </span>
      </button>

      <button
        onClick={onToggleFavorite}
        aria-label={entry.favorite ? 'Favorit entfernen' : 'Als Favorit merken'}
        aria-pressed={entry.favorite}
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-xl transition ${
          entry.favorite ? 'text-gold' : 'text-muted hover:text-gold'
        }`}
      >
        {entry.favorite ? '★' : '☆'}
      </button>
      <button
        onClick={onRemove}
        aria-label="Eintrag löschen"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-lg text-muted transition hover:text-danger"
      >
        ×
      </button>
    </li>
  );
}

/** History-Eintrag zurück in eine vollständige Situation verwandeln. */
function toSpot(entry: HistoryEntry): SpotState {
  // Über den Standard-Spot gelegt, damit später ergänzte Felder (z.B. das
  // Gegnermodell) auch bei alten Einträgen gesetzt sind. Die History kennt nur
  // die Spielerzahl, keine Namen – für die Wiederherstellung reichen anonyme Plätze.
  const seats: Array<Seat | null> = emptyTable();
  for (let i = 1; i < entry.players; i++) {
    seats[i] = { id: `restored-${i}`, name: `Spieler ${i + 1}`, active: true };
  }

  return {
    ...defaultSpot(),
    hole: [...entry.hole],
    board: [...entry.board],
    seats,
    dealerSeat: entry.players > 1 ? 1 : 0,
    pot: entry.pot,
    call: entry.call,
    stack: entry.stack,
  };
}
