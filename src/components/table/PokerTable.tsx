import type { ReactNode } from 'react';
import {
  occupiedSeatsInOrder,
  seatLayoutPercent,
  seatPositions,
  type Seats,
} from '../../core/table';
import { Button } from '../ui/Button';

interface PokerTableProps {
  seats: Seats;
  dealerSeat: number;
  /** Karten (Hero-Hand + Board) – werden in der Mitte des Tisches gerendert. */
  children: ReactNode;
  onSeatTap: (rawIndex: number) => void;
  onNextHand: () => void;
}

/**
 * Der Tisch selbst: eine Ellipse mit Sitzplätzen rings herum, Hero fest unten
 * in der Mitte. Ein Tipp auf einen Platz öffnet die Sitzplatz-Aktionen (leer:
 * Spieler hinzufügen; besetzt: folden, Dealer setzen, Range ansehen, entfernen).
 * Die Karten (Hole Cards + Board) sitzen als Kinder in der Tischmitte.
 */
export function PokerTable({ seats, dealerSeat, children, onSeatTap, onNextHand }: PokerTableProps) {
  const occupied = occupiedSeatsInOrder(seats);
  const positions = seatPositions(seats, dealerSeat);

  // Leere Plätze werden nur bis knapp nach dem letzten besetzten Platz angeboten
  // (plus etwas Reserve) – so wächst der Tisch organisch mit, statt sofort alle
  // neun möglichen Plätze leer anzuzeigen.
  const lastOccupied = Math.max(0, ...occupied.map((o) => o.rawIndex));
  const emptySlots = Array.from({ length: seats.length - 1 }, (_, k) => k + 1)
    .filter((rawIndex) => !seats[rawIndex] && rawIndex <= lastOccupied + 2)
    .slice(0, 3);

  // Ein gemeinsames Layout für besetzte und angebotene leere Plätze, damit sich
  // nichts überlappt: die ersten Punkte gehen an die besetzten Plätze, der Rest
  // an die leeren "+"-Buttons.
  const layout = seatLayoutPercent(occupied.length + emptySlots.length);
  const occupiedLayout = layout.slice(0, occupied.length);
  const emptyLayout = layout.slice(occupied.length);

  return (
    <div className="space-y-3">
      <div
        // Bewusst keine reine Ellipse (rounded-[50%]) – die würde die Ecken so
        // scharf abschneiden, dass Sitzplätze nahe der Bogenenden über den
        // grünen Filz hinausragen könnten. 46% wirkt weiterhin oval, lässt aber
        // genug Fläche in den Ecken für die äußersten Sitzplätze.
        className="relative mx-auto aspect-[4/3] w-full max-w-xl overflow-visible rounded-[46%] border border-felt-line/40"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, var(--color-felt) 0%, var(--color-felt-deep) 85%)',
          boxShadow: 'inset 0 2px 40px rgb(0 0 0 / 0.4), var(--shadow-lift)',
        }}
      >
        {/* Kartenbereich in der Mitte, etwas kleiner als der Tisch, damit rundherum Platz für die Sitze bleibt. */}
        <div className="absolute inset-[16%] flex items-center justify-center rounded-3xl">
          <div className="w-full">{children}</div>
        </div>

        {occupied.map((o, i) => {
          const point = occupiedLayout[i];
          if (!point) return null;
          return (
            <SeatAvatar
              key={o.rawIndex}
              name={o.seat.name}
              active={o.seat.active}
              isHero={o.rawIndex === 0}
              isDealer={o.rawIndex === dealerSeat}
              position={positions.get(o.rawIndex)?.key}
              point={point}
              onClick={() => onSeatTap(o.rawIndex)}
            />
          );
        })}

        {emptySlots.map((rawIndex, i) => {
          const point = emptyLayout[i];
          if (!point) return null;
          return (
            <button
              key={rawIndex}
              onClick={() => onSeatTap(rawIndex)}
              aria-label={`Platz ${rawIndex + 1} – Spieler hinzufügen`}
              className="absolute flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-white/25 text-xl text-white/40 transition hover:border-gold hover:text-gold"
              style={{ left: `${point.left}%`, top: `${point.top}%` }}
            >
              +
            </button>
          );
        })}
      </div>

      <Button block variant="surface" onClick={onNextHand}>
        ▶ Nächste Hand
      </Button>
    </div>
  );
}

interface SeatAvatarProps {
  name: string;
  active: boolean;
  isHero: boolean;
  isDealer: boolean;
  position?: string;
  point: { left: number; top: number };
  onClick: () => void;
}

function SeatAvatar({ name, active, isHero, isDealer, position, point, onClick }: SeatAvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      aria-label={`${name}${position ? ` – ${position}` : ''}${!active ? ' – gefoldet' : ''}`}
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${point.left}%`, top: `${point.top}%` }}
    >
      <div className="relative flex flex-col items-center gap-0.5">
        <div
          className={[
            'flex size-12 items-center justify-center rounded-full border-2 text-sm font-black transition sm:size-14',
            isHero
              ? 'border-gold bg-gold/20 text-gold'
              : active
                ? 'border-white/50 bg-surface text-ink'
                : 'border-white/15 bg-surface/40 text-muted opacity-50',
          ].join(' ')}
        >
          {initials || '?'}
          {!active && (
            <span aria-hidden="true" className="absolute text-lg text-loss">
              ╱
            </span>
          )}
        </div>

        {isDealer && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-gold text-[0.6rem] font-black text-[#20180a] shadow">
            D
          </span>
        )}

        <span className="max-w-16 truncate text-[0.65rem] font-semibold text-white/90">
          {isHero ? 'Du' : name}
        </span>
        {position && (
          <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[0.6rem] font-bold text-white/70">
            {position}
          </span>
        )}
      </div>
    </button>
  );
}
