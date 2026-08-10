/** Gemeinsame Zustandstypen der App. Sitzplätze und Positionen leben in `./table`. */

import type { Card } from './cards';
import { defaultOpponentModel, type OpponentModel } from './range';
import { MAX_SEATS, activeOpponentCount, createHeroSeat, type Seat, type Seats } from './table';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export const STREET_LABELS: Record<Street, string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

export function streetOf(boardLength: number): Street {
  if (boardLength >= 5) return 'river';
  if (boardLength === 4) return 'turn';
  if (boardLength >= 3) return 'flop';
  return 'preflop';
}

/** Wie viele Karten noch aufgedeckt werden. */
export function cardsToCome(boardLength: number): number {
  return Math.max(0, 5 - boardLength);
}

/** Die komplette Eingabe einer Situation – wird auch so in History und localStorage abgelegt. */
export interface SpotState {
  hole: Card[];
  board: Card[];
  /** Sitzplätze rings um den Tisch. Platz 0 ist immer Hero, `null` = leerer Platz. */
  seats: Seats;
  /** Roher Sitzindex, auf dem der Dealer-Button liegt. Zeigt immer auf einen besetzten Platz. */
  dealerSeat: number;
  smallBlind: number;
  bigBlind: number;
  pot: number;
  call: number;
  stack: number;
  /** Optionale Einsatzhistorie – fließt in die Pot-Berechnung der Schnellaktionen ein. */
  raisePreflop: number;
  raisePostflop: number;
  /** Woraus die Gegnerhände in der Simulation gezogen werden. */
  opponent: OpponentModel;
}

export function defaultSpot(): SpotState {
  const seats = new Array<Seat | null>(MAX_SEATS).fill(null);
  seats[0] = createHeroSeat();
  seats[1] = { id: 'seat-1', name: 'Spieler 2', active: true };
  seats[2] = { id: 'seat-2', name: 'Spieler 3', active: true };

  return {
    hole: [],
    board: [],
    seats,
    dealerSeat: 1,
    smallBlind: 1,
    bigBlind: 2,
    pot: 6,
    call: 2,
    stack: 100,
    raisePreflop: 0,
    raisePostflop: 0,
    opponent: defaultOpponentModel(),
  };
}

/** Anzahl Gegner, die in der Simulation berücksichtigt werden – gefoldete zählen nicht mit. */
export function opponentCount(spot: SpotState): number {
  return Math.min(9, activeOpponentCount(spot.seats));
}

/** Alle bereits vergebenen Karten – für die Sperrung im Kartenwähler. */
export function usedCards(spot: SpotState): Card[] {
  return [...spot.hole, ...spot.board];
}

export function isSpotReady(spot: SpotState): boolean {
  return spot.hole.length === 2 && (spot.board.length === 0 || spot.board.length >= 3);
}
