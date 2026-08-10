import { useState } from 'react';
import { RangeMatrix } from '../range/RangeMatrix';
import { rangeFromPercent } from '../../core/range';
import { seatPositions, type Seats } from '../../core/table';
import { OPENING_RANGE_BY_POSITION } from '../../core/strategy';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

interface SeatSheetProps {
  /** Roher Sitzindex, oder `null` wenn kein Platz gerade bearbeitet wird. */
  rawIndex: number | null;
  onClose: () => void;
  seats: Seats;
  dealerSeat: number;
  onAdd: (rawIndex: number, name: string) => void;
  onToggleFold: (rawIndex: number) => void;
  onSetDealer: (rawIndex: number) => void;
  onRemove: (rawIndex: number) => void;
}

/**
 * Was passiert, wenn man auf einen Sitzplatz tippt: ein leerer Platz fragt nach
 * einem Namen, ein besetzter zeigt Fold/Dealer/Entfernen sowie – darauf kommt es
 * an – die Hände, die dieser Spieler aus seiner aktuellen Position üblicherweise
 * eröffnet, als Range-Matrix.
 */
export function SeatSheet({
  rawIndex,
  onClose,
  seats,
  dealerSeat,
  onAdd,
  onToggleFold,
  onSetDealer,
  onRemove,
}: SeatSheetProps) {
  const [nameInput, setNameInput] = useState('');
  const open = rawIndex !== null;
  const seat = rawIndex !== null ? seats[rawIndex] : null;
  const isHero = rawIndex === 0;

  const handleClose = () => {
    setNameInput('');
    onClose();
  };

  // --- Leerer Platz: nur Name eingeben (auch bei geschlossenem Sheet der
  // Standardfall, `open=false` sorgt dafür, dass `Sheet` dann nichts rendert). ---
  if (!seat) {
    const submit = () => {
      if (!nameInput.trim() || rawIndex === null) return;
      onAdd(rawIndex, nameInput);
      setNameInput('');
      onClose();
    };

    return (
      <Sheet open={open} onClose={handleClose} title={`Platz ${(rawIndex ?? 0) + 1} besetzen`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              autoFocus
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submit()}
              placeholder="Name des Spielers"
              className="min-h-12 flex-1 rounded-xl border border-line bg-surface px-4 text-base text-ink outline-none focus:border-felt-line"
            />
          </div>
          <Button block size="xl" variant="primary" onClick={submit} disabled={!nameInput.trim()}>
            Hinzufügen
          </Button>
        </div>
      </Sheet>
    );
  }

  // --- Besetzter Platz: Fold, Dealer, Range, Entfernen ------------------------
  const position = seatPositions(seats, dealerSeat).get(rawIndex as number);
  const isDealer = rawIndex === dealerSeat;
  const range = position ? rangeFromPercent(OPENING_RANGE_BY_POSITION[position.key]) : null;

  return (
    <Sheet open={open} onClose={handleClose} title={isHero ? 'Du' : seat.name}>
      <div className="space-y-5">
        {position && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold">
              {position.label} ({position.key})
            </span>
            {isDealer && (
              <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold text-muted">
                Dealer
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {!isHero && (
            <Button
              variant={seat.active ? 'negative' : 'positive'}
              onClick={() => {
                onToggleFold(rawIndex as number);
                onClose();
              }}
            >
              {seat.active ? 'Fold' : 'Zurückholen'}
            </Button>
          )}
          <Button
            variant="surface"
            disabled={isDealer}
            className={isHero ? 'col-span-2' : ''}
            onClick={() => {
              onSetDealer(rawIndex as number);
              onClose();
            }}
          >
            {isDealer ? 'Ist schon Dealer' : 'Dealer hierher'}
          </Button>
        </div>

        {range && position && (
          <div>
            <h3 className="mb-2 text-sm font-bold">
              Übliche Eröffnungsrange aus {position.label}
            </h3>
            <RangeMatrix range={range} />
            <p className="mt-2 text-xs leading-snug text-muted">
              Etwa die besten {(OPENING_RANGE_BY_POSITION[position.key] * 100).toFixed(0)} % aller
              Hände – ein Richtwert, kein Solver-Ergebnis, und hängt stark davon ab, wie{' '}
              {isHero ? 'du' : seat.name} tatsächlich spielt.
            </p>
          </div>
        )}

        {!isHero && (
          <Button
            variant="ghost"
            block
            onClick={() => {
              onRemove(rawIndex as number);
              onClose();
            }}
          >
            Vom Tisch entfernen
          </Button>
        )}
      </div>
    </Sheet>
  );
}
