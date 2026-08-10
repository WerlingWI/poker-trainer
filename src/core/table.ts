/**
 * Der Tisch: Sitzplätze rings um Hero, Dealer-Button und die daraus folgenden
 * Positionsnamen (BTN, SB, BB, CO, …). Reine Logik, kein React.
 *
 * Ein Platz ist entweder besetzt (`Seat`) oder leer (`null`). Hero sitzt immer
 * fest auf Platz 0 und ist nie entfernbar – alle anderen Plätze lassen sich frei
 * besetzen, leeren, falten (für die aktuelle Hand) und der Dealer-Button lässt
 * sich auf jeden besetzten Platz legen.
 */

export interface Seat {
  id: string;
  name: string;
  /** false = in der laufenden Hand gefoldet. Wird bei `nextHand` zurückgesetzt. */
  active: boolean;
}

export type Seats = ReadonlyArray<Seat | null>;

/** Hero + bis zu neun Gegner – deckt sich mit der maximalen Gegnerzahl der Simulation. */
export const MAX_SEATS = 10;
export const HERO_NAME = 'Du';

function makeSeatId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createHeroSeat(): Seat {
  return { id: 'hero', name: HERO_NAME, active: true };
}

/** Frischer Tisch mit Hero auf Platz 0 und sonst leeren Plätzen. */
export function emptyTable(): Array<Seat | null> {
  const seats = new Array<Seat | null>(MAX_SEATS).fill(null);
  seats[0] = createHeroSeat();
  return seats;
}

export function addSeat(seats: Seats, rawIndex: number, name: string): Seats {
  if (rawIndex <= 0 || rawIndex >= seats.length) return seats;
  const next = [...seats];
  next[rawIndex] = { id: makeSeatId(), name: name.trim() || `Platz ${rawIndex + 1}`, active: true };
  return next;
}

export function removeSeat(seats: Seats, rawIndex: number): Seats {
  if (rawIndex <= 0 || rawIndex >= seats.length) return seats; // Hero bleibt immer.
  const next = [...seats];
  next[rawIndex] = null;
  return next;
}

export function toggleFold(seats: Seats, rawIndex: number): Seats {
  const seat = seats[rawIndex];
  if (!seat || rawIndex === 0) return seats; // Hero foldet in diesem Tool nicht.
  const next = [...seats];
  next[rawIndex] = { ...seat, active: !seat.active };
  return next;
}

/** Alle Folds aufheben – zu Beginn einer neuen Hand hat wieder jeder Karten. */
export function resetFolds(seats: Seats): Seats {
  return seats.map((s) => (s ? { ...s, active: true } : s));
}

export interface OccupiedSeat {
  rawIndex: number;
  seat: Seat;
}

/** Besetzte Plätze in Tischreihenfolge, beginnend bei Hero (Platz 0). */
export function occupiedSeatsInOrder(seats: Seats): OccupiedSeat[] {
  const result: OccupiedSeat[] = [];
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    if (seat) result.push({ rawIndex: i, seat });
  }
  return result;
}

/** Wie viele Gegner (nicht gefoldet, ohne Hero) aktuell in der Hand sind. */
export function activeOpponentCount(seats: Seats): number {
  let count = 0;
  for (let i = 1; i < seats.length; i++) {
    const seat = seats[i];
    if (seat?.active) count++;
  }
  return count;
}

/** Nächster besetzter Platz im Uhrzeigersinn ab `from` (exklusiv) – zum Weiterschieben des Buttons. */
export function nextOccupiedSeat(seats: Seats, from: number): number {
  const n = seats.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (seats[idx]) return idx;
  }
  return from;
}

/**
 * Startet eine neue Hand: Dealer-Button einen Platz weiterschieben und alle
 * Folds aufheben. Der Dealer bleibt stehen, wenn nur ein Platz besetzt ist.
 */
export function advanceHand(seats: Seats, dealerSeat: number): { seats: Seats; dealerSeat: number } {
  return { seats: resetFolds(seats), dealerSeat: nextOccupiedSeat(seats, dealerSeat) };
}

// --- Positionen --------------------------------------------------------------

export type PositionKey = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'MP' | 'LJ' | 'HJ' | 'CO';

export interface PositionInfo {
  key: PositionKey;
  label: string;
  /** Grobe Einordnung für den Hinweistext. */
  group: 'früh' | 'mittel' | 'spät' | 'blinds';
  hint: string;
}

export const POSITION_META: Record<PositionKey, Omit<PositionInfo, 'key'>> = {
  BTN: {
    label: 'Button',
    group: 'spät',
    hint: 'Beste Position – handelt nach dem Flop immer zuletzt.',
  },
  CO: { label: 'Cutoff', group: 'spät', hint: 'Späte Position, kann weiter aufmachen.' },
  HJ: { label: 'Hijack', group: 'mittel', hint: 'Mittlere Position.' },
  LJ: { label: 'Lojack', group: 'mittel', hint: 'Mittlere Position.' },
  MP: { label: 'Middle Position', group: 'mittel', hint: 'Mittlere Position.' },
  'UTG+1': { label: 'UTG+1', group: 'früh', hint: 'Frühe Position – enger spielen.' },
  UTG: {
    label: 'Under the Gun',
    group: 'früh',
    hint: 'Früheste Position – hier braucht es die stärksten Hände.',
  },
  SB: {
    label: 'Small Blind',
    group: 'blinds',
    hint: 'Handelt nach dem Flop als Erster – die unangenehmste Position.',
  },
  BB: {
    label: 'Big Blind',
    group: 'blinds',
    hint: 'Hat bereits gesetzt und bekommt deshalb bessere Pot Odds.',
  },
};

/** Positionsname nach Abstand zum Button: 0 = der Button selbst, 1 = Cutoff, … */
const BEFORE_BUTTON: PositionKey[] = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG'];

/**
 * Position eines Platzes, gezählt in "besetzte Plätze seit dem Button" (0 = Button).
 * `occupiedCount` ist die Zahl der besetzten Plätze insgesamt, `distanceFromButton`
 * wie viele besetzte Plätze zwischen Button und diesem Platz liegen (in Sitzrichtung).
 */
export function positionAtDistance(occupiedCount: number, distanceFromButton: number): PositionInfo {
  const seats = Math.max(2, occupiedCount);
  const offset = ((distanceFromButton % seats) + seats) % seats;

  let key: PositionKey;
  if (offset === 0) key = 'BTN';
  else if (offset === seats - 1) key = 'SB';
  else if (offset === seats - 2) key = 'BB';
  else key = BEFORE_BUTTON[Math.min(offset, BEFORE_BUTTON.length - 1)];

  return { key, ...POSITION_META[key] };
}

/** Positionen aller besetzten Plätze, als Map von Roh-Sitzindex auf Positionsinfo. */
export function seatPositions(seats: Seats, dealerSeat: number): Map<number, PositionInfo> {
  const order = occupiedSeatsInOrder(seats);
  const dealerOrderIndex = Math.max(
    0,
    order.findIndex((o) => o.rawIndex === dealerSeat),
  );
  const map = new Map<number, PositionInfo>();
  order.forEach((o, i) => {
    // Distanz "seit dem Button" in Sitzrichtung: Button minus eigener Platz.
    map.set(o.rawIndex, positionAtDistance(order.length, dealerOrderIndex - i));
  });
  return map;
}

export function heroPosition(seats: Seats, dealerSeat: number): PositionInfo {
  return seatPositions(seats, dealerSeat).get(0) ?? positionAtDistance(2, 0);
}

// --- Layout für die runde Tischdarstellung ------------------------------------

export interface SeatPoint {
  /** Prozentposition innerhalb des Tisch-Containers. */
  left: number;
  top: number;
}

/**
 * Verteilt `totalOccupied` Plätze auf eine Tisch-Ellipse: Hero fest unten in der
 * Mitte, alle anderen gleichmäßig auf einem Bogen über die Kopfseite verteilt.
 * Reine Geometrie, unabhängig von React – deshalb einfach testbar.
 */
export function seatLayoutPercent(totalOccupied: number): SeatPoint[] {
  if (totalOccupied <= 0) return [];
  const points: SeatPoint[] = [{ left: 50, top: 90 }];

  const rest = totalOccupied - 1;
  for (let k = 0; k < rest; k++) {
    const t = rest === 1 ? 0.5 : k / (rest - 1);
    const angleDeg = 205 - t * 230;
    const angleRad = (angleDeg * Math.PI) / 180;
    points.push({
      left: 50 + 45 * Math.cos(angleRad),
      top: 46 - 40 * Math.sin(angleRad),
    });
  }
  return points;
}
