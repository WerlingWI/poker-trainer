/**
 * Monte-Carlo-Kern.
 *
 * Gegnerhände kommen entweder aus einer vorgegebenen Range oder – ohne Range –
 * gleichverteilt aus dem Reststapel. Der Loop allokiert nichts: Masken und
 * Auswertungspuffer werden einmal angelegt und pro Durchlauf nur zurückgesetzt.
 */

import { NUM_CARDS, type Card } from './cards';
import { evaluate, scoreCategory } from './evaluator';

export interface SimInput {
  /** Genau zwei eigene Karten. */
  hole: Card[];
  /** 0, 3, 4 oder 5 bekannte Boardkarten. */
  board: Card[];
  /** Anzahl Gegner, 1..9. */
  opponents: number;
  iterations: number;
  /** Startwert des RNG – gleiche Eingabe + gleicher Seed ⇒ identisches Ergebnis. */
  seed: number;
  /**
   * Erlaubte Gegner-Kombinationen als `karte1 * 52 + karte2`.
   * Fehlt das Feld, spielen die Gegner zufällige Karten.
   */
  rangeCombos?: Uint16Array;
}

export interface SimTotals {
  /** Tatsächlich ausgewertete Durchläufe. */
  iterations: number;
  wins: number;
  ties: number;
  losses: number;
  /** Summe der Anteile pro Durchlauf: 1 bei Sieg, 1/k bei k-fachem Split, 0 bei Niederlage. */
  equitySum: number;
  /** Aufsummierte Equity, wenn die nächste Boardkarte genau diese Karte ist. */
  perCardEquity: Float64Array;
  /** Wie oft diese Karte als nächste Boardkarte gezogen wurde. */
  perCardCount: Uint32Array;
  /** Verteilung der eigenen Endhand über die neun Kategorien. */
  categoryAll: Uint32Array;
  /** Davon die Fälle, in denen die Hand tatsächlich gewonnen hat. */
  categoryWin: Uint32Array;
  /**
   * Wahr, wenn die Range so eng ist, dass sich nicht genug Durchläufe austeilen
   * ließen – die Ergebnisse beruhen dann auf weniger Simulationen als angefordert.
   */
  aborted: boolean;
}

export function emptyTotals(): SimTotals {
  return {
    iterations: 0,
    wins: 0,
    ties: 0,
    losses: 0,
    equitySum: 0,
    perCardEquity: new Float64Array(NUM_CARDS),
    perCardCount: new Uint32Array(NUM_CARDS),
    categoryAll: new Uint32Array(9),
    categoryWin: new Uint32Array(9),
    aborted: false,
  };
}

/** Addiert ein Teilergebnis (z.B. von einem Worker) auf ein Gesamtergebnis. */
export function mergeTotals(target: SimTotals, part: SimTotals): SimTotals {
  target.iterations += part.iterations;
  target.wins += part.wins;
  target.ties += part.ties;
  target.losses += part.losses;
  target.equitySum += part.equitySum;
  target.aborted = target.aborted || part.aborted;
  for (let i = 0; i < NUM_CARDS; i++) {
    target.perCardEquity[i] += part.perCardEquity[i];
    target.perCardCount[i] += part.perCardCount[i];
  }
  for (let i = 0; i < 9; i++) {
    target.categoryAll[i] += part.categoryAll[i];
    target.categoryWin[i] += part.categoryWin[i];
  }
  return target;
}

/** Kleiner, schneller PRNG mit 32-Bit-Zustand. Deterministisch und pro Worker anders geseedet. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wie oft je Gegner ein Range-Kombo gezogen werden darf, bevor der Durchlauf verworfen wird. */
const MAX_COMBO_TRIES = 120;

/**
 * Führt bis zu `input.iterations` Simulationen aus.
 * `onProgress` meldet alle `progressEvery` fertigen Durchläufe den Stand.
 */
export function runSimulation(
  input: SimInput,
  onProgress?: (done: number) => void,
  progressEvery = 4096,
): SimTotals {
  const { hole, board, opponents, iterations, rangeCombos } = input;
  const totals = emptyTotals();
  const random = mulberry32(input.seed || 1);

  const missingBoard = 5 - board.length;
  if (2 + 2 * opponents + 5 > NUM_CARDS) {
    throw new Error('Zu viele Gegner für ein Deck mit 52 Karten');
  }
  if (rangeCombos && rangeCombos.length === 0) {
    throw new Error('Die Gegner-Range enthält keine einzige Hand');
  }

  // Karten, die schon zu Beginn jedes Durchlaufs vergeben sind.
  const baseUsed = new Uint8Array(NUM_CARDS);
  for (const c of hole) baseUsed[c] = 1;
  for (const c of board) baseUsed[c] = 1;

  const used = new Uint8Array(NUM_CARDS);
  const heroCards = new Uint8Array(7);
  const oppCards = new Uint8Array(7);
  const oppHoles = new Uint8Array(2 * opponents);

  heroCards[0] = hole[0];
  heroCards[1] = hole[1];
  for (let i = 0; i < board.length; i++) {
    heroCards[2 + i] = board[i];
    oppCards[2 + i] = board[i];
  }

  /** Zieht gleichverteilt eine noch freie Karte und markiert sie als vergeben. */
  const drawFree = (): number => {
    for (;;) {
      const card = (random() * NUM_CARDS) | 0;
      if (!used[card]) {
        used[card] = 1;
        return card;
      }
    }
  };

  const trackNextCard = missingBoard > 0;
  const comboCount = rangeCombos ? rangeCombos.length : 0;
  const maxAttempts = iterations * 20 + 1000;

  let completed = 0;
  let attempts = 0;

  while (completed < iterations && attempts < maxAttempts) {
    attempts++;
    used.set(baseUsed);

    // 1. Gegnerhände austeilen – entweder aus der Range oder zufällig.
    let dealt = true;
    if (rangeCombos) {
      for (let o = 0; o < opponents && dealt; o++) {
        let placed = false;
        for (let tries = 0; tries < MAX_COMBO_TRIES; tries++) {
          const encoded = rangeCombos[(random() * comboCount) | 0];
          const a = (encoded / 52) | 0;
          const b = encoded % 52;
          if (used[a] || used[b]) continue;
          used[a] = 1;
          used[b] = 1;
          oppHoles[o * 2] = a;
          oppHoles[o * 2 + 1] = b;
          placed = true;
          break;
        }
        // Range zu eng für so viele Gegner: Durchlauf verwerfen statt verfälschen.
        if (!placed) dealt = false;
      }
      if (!dealt) continue;
    } else {
      for (let i = 0; i < opponents * 2; i++) oppHoles[i] = drawFree();
    }

    // 2. Fehlende Boardkarten – identisch für Hero und alle Gegner.
    let nextBoardCard = -1;
    for (let i = 0; i < missingBoard; i++) {
      const card = drawFree();
      if (i === 0) nextBoardCard = card;
      heroCards[2 + board.length + i] = card;
      oppCards[2 + board.length + i] = card;
    }

    // 3. Auswerten.
    const heroScore = evaluate(heroCards, 7);
    const heroCategory = scoreCategory(heroScore);

    let bestOpp = -1;
    let tiedOpponents = 0;
    for (let o = 0; o < opponents; o++) {
      oppCards[0] = oppHoles[o * 2];
      oppCards[1] = oppHoles[o * 2 + 1];
      const oppScore = evaluate(oppCards, 7);
      if (oppScore > bestOpp) {
        bestOpp = oppScore;
        tiedOpponents = 1;
      } else if (oppScore === bestOpp) {
        tiedOpponents++;
      }
    }

    let share: number;
    if (heroScore > bestOpp) {
      totals.wins++;
      share = 1;
    } else if (heroScore === bestOpp) {
      totals.ties++;
      share = 1 / (tiedOpponents + 1);
    } else {
      totals.losses++;
      share = 0;
    }

    totals.equitySum += share;
    totals.categoryAll[heroCategory]++;
    if (share === 1) totals.categoryWin[heroCategory]++;

    if (trackNextCard && nextBoardCard >= 0) {
      totals.perCardEquity[nextBoardCard] += share;
      totals.perCardCount[nextBoardCard]++;
    }

    completed++;
    if (onProgress && completed % progressEvery === 0) onProgress(completed);
  }

  totals.iterations = completed;
  totals.aborted = completed < iterations;
  onProgress?.(completed);
  return totals;
}

/** Gewinn-/Split-/Verlustquoten und Equity aus den Rohzahlen. */
export interface EquityBreakdown {
  win: number;
  tie: number;
  loss: number;
  equity: number;
}

export function toBreakdown(totals: SimTotals): EquityBreakdown {
  const n = totals.iterations || 1;
  return {
    win: totals.wins / n,
    tie: totals.ties / n,
    loss: totals.losses / n,
    equity: totals.equitySum / n,
  };
}
