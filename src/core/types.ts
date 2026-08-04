/** Gemeinsame Zustandstypen der App und die Ableitungen rund um Positionen. */

import type { Card } from './cards';
import { defaultOpponentModel, type OpponentModel } from './range';

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
  /** Spieler insgesamt, inklusive dir selbst (2..10). */
  players: number;
  smallBlind: number;
  bigBlind: number;
  /** Sitzplatz des Dealers, 0..players-1. Du selbst sitzt immer auf Platz 0. */
  dealerSeat: number;
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
  return {
    hole: [],
    board: [],
    players: 3,
    smallBlind: 1,
    bigBlind: 2,
    dealerSeat: 1,
    pot: 6,
    call: 2,
    stack: 100,
    raisePreflop: 0,
    raisePostflop: 0,
    opponent: defaultOpponentModel(),
  };
}

/** Anzahl Gegner, die in der Simulation berücksichtigt werden. */
export function opponentCount(spot: SpotState): number {
  return Math.max(1, Math.min(9, spot.players - 1));
}

export type PositionKey = 'BTN' | 'SB' | 'BB' | 'UTG' | 'UTG+1' | 'MP' | 'LJ' | 'HJ' | 'CO';

export interface PositionInfo {
  key: PositionKey;
  label: string;
  /** Grobe Einordnung für den Hinweistext. */
  group: 'früh' | 'mittel' | 'spät' | 'blinds';
  hint: string;
}

/**
 * Positionsname nach Abstand zum Button: Index 0 ist der Button selbst,
 * Index 1 der Spieler direkt davor (Cutoff) und so weiter.
 */
const BEFORE_BUTTON: PositionKey[] = ['BTN', 'CO', 'HJ', 'LJ', 'MP', 'UTG+1', 'UTG'];

/**
 * Ermittelt die eigene Position. Der Hero sitzt auf Platz 0, die Plätze sind in
 * Spielrichtung nummeriert; `dealerSeat` ist der Platz des Dealers.
 */
export function heroPosition(players: number, dealerSeat: number): PositionInfo {
  const seats = Math.max(2, players);
  const offset = ((dealerSeat % seats) + seats) % seats;

  let key: PositionKey;
  if (offset === 0) {
    key = 'BTN'; // Hero ist selbst Dealer.
  } else if (offset === seats - 1) {
    key = 'SB'; // Dealer sitzt direkt vor dem Hero.
  } else if (offset === seats - 2) {
    key = 'BB';
  } else {
    // Der Dealer sitzt `offset` Plätze hinter dem Hero, also ist der Hero
    // `offset` Plätze vor dem Button.
    key = BEFORE_BUTTON[Math.min(offset, BEFORE_BUTTON.length - 1)];
  }

  return { key, ...POSITION_META[key] };
}

const POSITION_META: Record<PositionKey, Omit<PositionInfo, 'key'>> = {
  BTN: {
    label: 'Button',
    group: 'spät',
    hint: 'Beste Position – du handelst nach dem Flop immer zuletzt.',
  },
  CO: { label: 'Cutoff', group: 'spät', hint: 'Späte Position, du kannst weiter aufmachen.' },
  HJ: { label: 'Hijack', group: 'mittel', hint: 'Mittlere Position.' },
  LJ: { label: 'Lojack', group: 'mittel', hint: 'Mittlere Position.' },
  MP: { label: 'Middle Position', group: 'mittel', hint: 'Mittlere Position.' },
  'UTG+1': { label: 'UTG+1', group: 'früh', hint: 'Frühe Position – spiele enger.' },
  UTG: {
    label: 'Under the Gun',
    group: 'früh',
    hint: 'Früheste Position – hier brauchst du die stärksten Hände.',
  },
  SB: {
    label: 'Small Blind',
    group: 'blinds',
    hint: 'Du handelst nach dem Flop als Erster – die unangenehmste Position.',
  },
  BB: {
    label: 'Big Blind',
    group: 'blinds',
    hint: 'Du hast bereits gesetzt und bekommst deshalb bessere Pot Odds.',
  },
};

/** Alle bereits vergebenen Karten – für die Sperrung im Kartenwähler. */
export function usedCards(spot: SpotState): Card[] {
  return [...spot.hole, ...spot.board];
}

export function isSpotReady(spot: SpotState): boolean {
  return spot.hole.length === 2 && (spot.board.length === 0 || spot.board.length >= 3);
}
