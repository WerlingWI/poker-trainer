/**
 * Zufällige, aber plausible Spielsituationen für den Lernmodus.
 *
 * Die Situationen sind absichtlich nicht gleichverteilt: eine reine Zufallshand
 * am River wäre in den meisten Fällen ein langweiliger Fold. Stattdessen werden
 * Straßen und Einsatzgrößen so gewählt, dass interessante Entscheidungen entstehen.
 */

import { NUM_CARDS, type Card } from './cards';
import { RANGE_PRESETS, defaultOpponentModel } from './range';
import { mulberry32 } from './simulate';
import { emptyTable, occupiedSeatsInOrder, type Seat } from './table';
import { defaultSpot, type SpotState } from './types';

/** Ein Tisch mit `count` besetzten Plätzen (Hero + count-1 namenlose Gegner). */
function buildSeats(count: number): Array<Seat | null> {
  const seats = emptyTable();
  for (let i = 1; i < count; i++) seats[i] = { id: `learn-${i}`, name: `Spieler ${i + 1}`, active: true };
  return seats;
}

export interface Scenario {
  spot: SpotState;
  /** Kurzer Situationstext über den Buttons, z.B. "Gegner setzt 20 in einen Pot von 30". */
  prompt: string;
  /** Beschreibt den Gegnertyp, gegen den gerechnet wird. */
  opponentNote: string;
}

/** Gegnertypen, die im Lernmodus vorkommen – "any" bleibt der Zufallsgegner. */
const SCENARIO_OPPONENTS = ['any', 'any', 'co', 'btn', 'utg', 'threebet', 'calling'];

const BET_FRACTIONS = [0.33, 0.5, 0.66, 0.75, 1];

export function createScenario(seed = (Math.random() * 0xffffffff) >>> 0): Scenario {
  const random = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => list[(random() * list.length) | 0];

  // Karten ziehen: 2 Hole + bis zu 5 Board, ohne Dopplung.
  const deck = Array.from({ length: NUM_CARDS }, (_, i) => i);
  for (let i = 0; i < 7; i++) {
    const j = i + ((random() * (deck.length - i)) | 0);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  // Flop und Turn sind lehrreicher als Preflop oder River – deshalb häufiger.
  const boardLength = pick([0, 3, 3, 3, 4, 4, 5]);
  const hole: Card[] = [deck[0], deck[1]];
  const board: Card[] = deck.slice(2, 2 + boardLength);

  const players = 2 + ((random() * 3) | 0); // 2 bis 4 Spieler
  const seats = buildSeats(players);
  const bigBlind = 2;
  const stack = pick([60, 80, 100, 150, 200]);

  // Pot aus einer groben, realistischen Vorgeschichte aufbauen.
  const basePot = boardLength === 0 ? bigBlind * 3 : bigBlind * pick([5, 7, 9, 12, 18]);
  const bet = Math.max(bigBlind, Math.round(basePot * pick(BET_FRACTIONS)));

  // Mal gegen einen konkreten Gegnertyp, mal gegen Zufallskarten – so wird auch
  // das Range-Denken geübt und nicht nur das Rechnen mit Pot Odds.
  const presetKey = pick(SCENARIO_OPPONENTS);
  const preset = RANGE_PRESETS.find((p) => p.key === presetKey);
  const opponent =
    presetKey === 'any'
      ? defaultOpponentModel()
      : { ...defaultOpponentModel(), mode: 'preset' as const, presetKey };

  const occupied = occupiedSeatsInOrder(seats);
  const spot: SpotState = {
    ...defaultSpot(),
    hole,
    board,
    seats,
    bigBlind,
    smallBlind: bigBlind / 2,
    dealerSeat: pick(occupied.map((o) => o.rawIndex)),
    pot: basePot + bet,
    call: Math.min(bet, stack),
    stack,
    opponent,
  };

  const opponents = players - 1;
  const prompt =
    boardLength === 0
      ? `${opponents === 1 ? 'Ein Gegner' : `${opponents} Gegner`} vor dir. Es kostet dich ${spot.call} Chips in einen Pot von ${spot.pot}.`
      : `Gegner setzt ${bet} in einen Pot von ${basePot}. Du zahlst ${spot.call}, um weiterzuspielen.`;

  const opponentNote =
    presetKey === 'any' || !preset
      ? 'Gegen unbekannte Gegner mit zufälligen Karten.'
      : `Gegnertyp: ${preset.label} – er spielt etwa die besten ${(preset.percent * 100).toFixed(0)} % aller Hände.`;

  return { spot, prompt, opponentNote };
}
