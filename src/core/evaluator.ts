/**
 * Schneller Hold'em-Evaluator.
 *
 * `evaluate()` bewertet 5 bis 7 Karten und liefert eine einzelne Ganzzahl, die
 * sich direkt mit `<` / `>` vergleichen lässt – gleiche Zahl bedeutet exakt
 * gleich starke Hand (Split Pot):
 *
 *   score = (kategorie << 20) | (t1 << 16) | (t2 << 12) | (t3 << 8) | (t4 << 4) | t5
 *
 * Die Tiebreaker t1..t5 sind Rangindizes 0..12, absteigend nach Bedeutung.
 * Im Hot Path wird nichts allokiert: die Zählerpuffer sind modulweit und werden
 * pro Aufruf zurückgesetzt. Das ist der Grund, warum 500.000 Simulationen mit
 * neun Gegnern in wenigen Sekunden durchlaufen.
 */

import { RANK_NAMES, SUIT_NAMES, cardRank, cardSuit, type Card } from './cards';
import { STRAIGHT_HIGH } from './tables';

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_LABELS: Record<number, string> = {
  0: 'Höchste Karte',
  1: 'Paar',
  2: 'Zwei Paare',
  3: 'Drilling',
  4: 'Straße',
  5: 'Flush',
  6: 'Full House',
  7: 'Vierling',
  8: 'Straight Flush',
};

/** Royal Flush ist kein eigener Score, sondern ein Straight Flush mit Ass als höchster Karte. */
export const ROYAL_FLUSH_LABEL = 'Royal Flush';

// Wiederverwendete Puffer – siehe Modul-Kommentar.
const rankCount = new Int32Array(13);
const suitCount = new Int32Array(4);
const suitMask = new Int32Array(4);

/**
 * Bewertet `n` Karten (5 ≤ n ≤ 7) aus `cards`. Nur die ersten `n` Einträge werden gelesen,
 * damit der Aufrufer einen festen Puffer wiederverwenden kann.
 */
export function evaluate(cards: ArrayLike<Card>, n: number): number {
  rankCount[0] = rankCount[1] = rankCount[2] = rankCount[3] = rankCount[4] = 0;
  rankCount[5] = rankCount[6] = rankCount[7] = rankCount[8] = rankCount[9] = 0;
  rankCount[10] = rankCount[11] = rankCount[12] = 0;
  suitCount[0] = suitCount[1] = suitCount[2] = suitCount[3] = 0;
  suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;

  let rankMask = 0;
  for (let i = 0; i < n; i++) {
    const c = cards[i];
    const r = c >> 2;
    const s = c & 3;
    rankCount[r]++;
    suitCount[s]++;
    suitMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // Bei höchstens sieben Karten kann nur eine Farbe fünfmal vorkommen.
  let flushSuit = -1;
  if (suitCount[0] >= 5) flushSuit = 0;
  else if (suitCount[1] >= 5) flushSuit = 1;
  else if (suitCount[2] >= 5) flushSuit = 2;
  else if (suitCount[3] >= 5) flushSuit = 3;

  if (flushSuit >= 0) {
    const sf = STRAIGHT_HIGH[suitMask[flushSuit]];
    if (sf) return (HandCategory.StraightFlush << 20) | ((sf - 1) << 16);
  }

  // Gruppen einmal absteigend einsammeln – dadurch ist pair1 > pair2 und trips1 > trips2.
  let quad = -1;
  let trips1 = -1;
  let trips2 = -1;
  let pair1 = -1;
  let pair2 = -1;
  for (let r = 12; r >= 0; r--) {
    const c = rankCount[r];
    if (c === 4) {
      if (quad < 0) quad = r;
    } else if (c === 3) {
      if (trips1 < 0) trips1 = r;
      else if (trips2 < 0) trips2 = r;
    } else if (c === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  if (quad >= 0) {
    return (HandCategory.FourOfAKind << 20) | (quad << 16) | (highestExcept(quad, -1) << 12);
  }

  if (trips1 >= 0 && (trips2 >= 0 || pair1 >= 0)) {
    // Der zweite Drilling zählt hier nur als Paar; der höhere von beiden gewinnt.
    const pairRank = trips2 > pair1 ? trips2 : pair1;
    return (HandCategory.FullHouse << 20) | (trips1 << 16) | (pairRank << 12);
  }

  if (flushSuit >= 0) {
    // Vierling und Full House bräuchten zusammen mit einem Flush mehr als sieben Karten,
    // deshalb ist es korrekt, den Flush erst hier – nach beiden Prüfungen – zu bewerten.
    let score = HandCategory.Flush << 20;
    let shift = 16;
    const m = suitMask[flushSuit];
    for (let r = 12; r >= 0 && shift >= 0; r--) {
      if (m & (1 << r)) {
        score |= r << shift;
        shift -= 4;
      }
    }
    return score;
  }

  const straight = STRAIGHT_HIGH[rankMask];
  if (straight) return (HandCategory.Straight << 20) | ((straight - 1) << 16);

  if (trips1 >= 0) {
    const k1 = highestExcept(trips1, -1);
    const k2 = highestExcept(trips1, k1);
    return (HandCategory.ThreeOfAKind << 20) | (trips1 << 16) | (k1 << 12) | (k2 << 8);
  }

  if (pair1 >= 0 && pair2 >= 0) {
    const kicker = highestExcept(pair1, pair2);
    return (HandCategory.TwoPair << 20) | (pair1 << 16) | (pair2 << 12) | (kicker << 8);
  }

  if (pair1 >= 0) {
    const k1 = highestExcept(pair1, -1);
    const k2 = highestExcept(pair1, k1);
    const k3 = highestExcept3(pair1, k1, k2);
    return (HandCategory.Pair << 20) | (pair1 << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4);
  }

  let score = HandCategory.HighCard << 20;
  let shift = 16;
  for (let r = 12; r >= 0 && shift >= 0; r--) {
    if (rankCount[r]) {
      score |= r << shift;
      shift -= 4;
    }
  }
  return score;
}

/** Höchster vorhandener Rang, der weder `skipA` noch `skipB` ist. 0, wenn es keinen gibt. */
function highestExcept(skipA: number, skipB: number): number {
  for (let r = 12; r >= 0; r--) {
    if (r !== skipA && r !== skipB && rankCount[r]) return r;
  }
  return 0;
}

function highestExcept3(skipA: number, skipB: number, skipC: number): number {
  for (let r = 12; r >= 0; r--) {
    if (r !== skipA && r !== skipB && r !== skipC && rankCount[r]) return r;
  }
  return 0;
}

export function scoreCategory(score: number): HandCategory {
  return (score >> 20) as HandCategory;
}

/** Anzeigename inklusive Sonderfall Royal Flush. */
export function scoreLabel(score: number): string {
  const category = scoreCategory(score);
  if (category === HandCategory.StraightFlush && ((score >> 16) & 0xf) === 12) {
    return ROYAL_FLUSH_LABEL;
  }
  return CATEGORY_LABELS[category];
}

export interface HandDescription {
  score: number;
  category: HandCategory;
  label: string;
  /** Die fünf Karten, aus denen die Hand tatsächlich besteht – für die Hervorhebung in der UI. */
  bestFive: Card[];
  /** Ausformulierte Beschreibung, z.B. "Zwei Paare, Damen und Achten". */
  detail: string;
}

/**
 * Ermittelt die beste Fünf-Karten-Kombination samt Beschreibung.
 * Läuft pro Analyse genau einmal (maximal 21 Kombinationen) und darf deshalb
 * bequem allokieren – im Gegensatz zu `evaluate()`.
 */
export function describeHand(cards: readonly Card[]): HandDescription {
  if (cards.length < 5) {
    throw new Error('describeHand benötigt mindestens 5 Karten');
  }

  let bestScore = -1;
  let bestCombo: Card[] = [];
  const combo: Card[] = [];

  const pick = (start: number): void => {
    if (combo.length === 5) {
      const score = evaluate(combo, 5);
      if (score > bestScore) {
        bestScore = score;
        bestCombo = [...combo];
      }
      return;
    }
    for (let i = start; i < cards.length; i++) {
      combo.push(cards[i]);
      pick(i + 1);
      combo.pop();
    }
  };
  pick(0);

  const category = scoreCategory(bestScore);
  return {
    score: bestScore,
    category,
    label: scoreLabel(bestScore),
    bestFive: bestCombo.sort((a, b) => cardRank(b) - cardRank(a) || cardSuit(b) - cardSuit(a)),
    detail: describeDetail(bestScore, category, bestCombo),
  };
}

const RANK_PLURAL = [
  'Zweien',
  'Dreien',
  'Vieren',
  'Fünfen',
  'Sechsen',
  'Siebenen',
  'Achten',
  'Neunen',
  'Zehnen',
  'Buben',
  'Damen',
  'Könige',
  'Asse',
];

function describeDetail(score: number, category: HandCategory, best: readonly Card[]): string {
  const t1 = (score >> 16) & 0xf;
  const t2 = (score >> 12) & 0xf;

  switch (category) {
    case HandCategory.StraightFlush:
      return t1 === 12
        ? 'Royal Flush – die bestmögliche Hand'
        : `Straight Flush bis ${RANK_NAMES[t1]}`;
    case HandCategory.FourOfAKind:
      return `Vier ${RANK_PLURAL[t1]}`;
    case HandCategory.FullHouse:
      return `Full House, ${RANK_PLURAL[t1]} über ${RANK_PLURAL[t2]}`;
    case HandCategory.Flush:
      return `${SUIT_NAMES[cardSuit(best[0])]}-Flush, ${RANK_NAMES[t1]} hoch`;
    case HandCategory.Straight:
      return `Straße bis ${RANK_NAMES[t1]}`;
    case HandCategory.ThreeOfAKind:
      return `Drilling ${RANK_PLURAL[t1]}`;
    case HandCategory.TwoPair:
      return `Zwei Paare, ${RANK_PLURAL[t1]} und ${RANK_PLURAL[t2]}`;
    case HandCategory.Pair:
      return `Ein Paar ${RANK_PLURAL[t1]}`;
    default:
      return `${RANK_NAMES[t1]} hoch`;
  }
}
