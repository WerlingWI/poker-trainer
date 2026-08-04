/**
 * TESTCODE – NICHT IN DER APP VERWENDEN.
 *
 * Referenz-Evaluator, übernommen aus dem bestehenden Projekt
 * `poker-app/apps/server/src/game/engine/hand-evaluator.ts` (plus der Typen aus
 * `poker-app/packages/shared/src/poker/`). Dort ist er vollständig unit-getestet.
 *
 * Er ist bewusst naiv – er zählt alle 21 Fünf-Karten-Kombinationen einzeln aus und
 * allokiert dabei kräftig. Genau deshalb taugt er nicht für Monte Carlo, aber sehr
 * gut als unabhängiges Orakel: Wenn der schnelle Bitmask-Evaluator dieselbe
 * Rangordnung liefert wie diese offensichtlich korrekte Implementierung, stimmt er.
 */

export enum OracleHandRank {
  HIGH_CARD = 0,
  PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
  ROYAL_FLUSH = 9,
}

export interface OracleCard {
  suit: number;
  /** 2..14, wobei 14 das Ass ist – wie im Original. */
  rank: number;
}

export interface OracleResult {
  rank: OracleHandRank;
  tiebreakers: number[];
}

/** Übersetzt eine Trainer-Karte (0..51) in die Objektform des Orakels. */
export function toOracleCard(card: number): OracleCard {
  return { suit: card & 3, rank: (card >> 2) + 2 };
}

export function compareOracle(a: OracleResult, b: OracleResult): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function evaluateBestHand(cards: OracleCard[]): OracleResult {
  if (cards.length < 5) throw new Error('evaluateBestHand requires at least 5 cards');

  let best: OracleResult | null = null;
  for (const combo of fiveCardCombinations(cards)) {
    const result = evaluateFiveCardHand(combo);
    if (!best || compareOracle(result, best) > 0) best = result;
  }
  return best as OracleResult;
}

export function evaluateFiveCardHand(cards: OracleCard[]): OracleResult {
  if (cards.length !== 5) throw new Error('evaluateFiveCardHand requires exactly 5 cards');

  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const ranks = sorted.map((c) => c.rank);
  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const straightHigh = getStraightHighCard(ranks);
  const isStraight = straightHigh !== null;

  const rankCounts = new Map<number, number>();
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  const groups = [...rankCounts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isStraight && isFlush) {
    const rank =
      straightHigh === 14 ? OracleHandRank.ROYAL_FLUSH : OracleHandRank.STRAIGHT_FLUSH;
    return { rank, tiebreakers: [straightHigh as number] };
  }

  if (groups[0][1] === 4) {
    return { rank: OracleHandRank.FOUR_OF_A_KIND, tiebreakers: [groups[0][0], groups[1][0]] };
  }

  if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    return { rank: OracleHandRank.FULL_HOUSE, tiebreakers: [groups[0][0], groups[1][0]] };
  }

  if (isFlush) return { rank: OracleHandRank.FLUSH, tiebreakers: [...ranks] };
  if (isStraight) return { rank: OracleHandRank.STRAIGHT, tiebreakers: [straightHigh as number] };

  if (groups[0][1] === 3) {
    return {
      rank: OracleHandRank.THREE_OF_A_KIND,
      tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
    };
  }

  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    return {
      rank: OracleHandRank.TWO_PAIR,
      tiebreakers: [groups[0][0], groups[1][0], groups[2][0]],
    };
  }

  if (groups[0][1] === 2) {
    return {
      rank: OracleHandRank.PAIR,
      tiebreakers: [groups[0][0], ...groups.slice(1).map((g) => g[0])],
    };
  }

  return { rank: OracleHandRank.HIGH_CARD, tiebreakers: [...ranks] };
}

function getStraightHighCard(ranksDesc: number[]): number | null {
  const unique = [...new Set(ranksDesc)];
  if (unique.length !== 5) return null;

  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
    return 5;
  }

  for (let i = 0; i < 4; i++) {
    if (unique[i] - unique[i + 1] !== 1) return null;
  }
  return unique[0];
}

function fiveCardCombinations(cards: OracleCard[]): OracleCard[][] {
  const results: OracleCard[][] = [];
  const combo: OracleCard[] = [];

  function backtrack(start: number): void {
    if (combo.length === 5) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < cards.length; i++) {
      combo.push(cards[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }

  backtrack(0);
  return results;
}
