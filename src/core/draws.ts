/**
 * Draw-Erkennung – liefert die *Sprache* zu den Zahlen aus der Simulation.
 *
 * Die Outs-Zahlen hier sind die klassischen Lehrbuchwerte (Flush Draw 9, OESD 8,
 * Gutshot 4). Die maßgebliche Outs-Zahl der App kommt aus `outs.ts` und wird
 * empirisch aus der Simulation gewonnen; beide sollten übereinstimmen.
 */

import { RANK_NAMES, SUIT_NAMES, cardRank, cardSuit, type Card } from './cards';
import { HandCategory, describeHand } from './evaluator';
import { STRAIGHT_HIGH } from './tables';

export interface DrawInfo {
  key: string;
  label: string;
  description: string;
  /** Klassische Outs dieses Draws, falls definiert. */
  outs?: number;
  tone: 'made' | 'draw' | 'info';
}

/**
 * Analysiert die eigene Hand gegen das Board.
 * Bei leerem Board (Preflop) gibt es keine Draws – dort liefert `handClass.ts` die Einordnung.
 */
export function analyzeDraws(hole: readonly Card[], board: readonly Card[]): DrawInfo[] {
  const draws: DrawInfo[] = [];
  if (hole.length < 2 || board.length < 3) return draws;

  const all = [...hole, ...board];
  const made = describeHand(all);
  const holeRanks = hole.map(cardRank);
  const boardRanks = board.map(cardRank);

  draws.push(makeHandInfo(made, holeRanks));

  const moreCardsComing = board.length < 5;

  // --- Flush-Draws ---------------------------------------------------------
  const suitTotal = [0, 0, 0, 0];
  const suitHole = [0, 0, 0, 0];
  for (const c of all) suitTotal[cardSuit(c)]++;
  for (const c of hole) suitHole[cardSuit(c)]++;

  for (let s = 0; s < 4; s++) {
    if (!suitHole[s]) continue; // Ein Draw allein auf dem Board gehört nicht uns.

    if (moreCardsComing && suitTotal[s] === 4) {
      const nut = isNutFlushDraw(s, hole, board);
      draws.push({
        key: nut ? 'nut-flush-draw' : 'flush-draw',
        label: nut ? 'Nut Flush Draw' : 'Flush Draw',
        description: nut
          ? `Eine weitere ${SUIT_NAMES[s]}-Karte gibt dir den höchstmöglichen Flush – gegen einen anderen Flush gewinnst du immer.`
          : `Eine weitere ${SUIT_NAMES[s]}-Karte gibt dir den Flush.`,
        outs: 9,
        tone: 'draw',
      });
    } else if (board.length === 3 && suitTotal[s] === 3) {
      draws.push({
        key: 'backdoor-flush',
        label: 'Backdoor Flush Draw',
        description: `Du brauchst Turn *und* River in ${SUIT_NAMES[s]} – das passiert nur in etwa 4 % der Fälle.`,
        tone: 'info',
      });
    }
  }

  // --- Straight-Draws ------------------------------------------------------
  if (moreCardsComing && made.category < HandCategory.Straight) {
    const straightDraw = findStraightDraw(holeRanks, boardRanks);
    if (straightDraw) draws.push(straightDraw);
  }

  // --- Overcards -----------------------------------------------------------
  if (made.category <= HandCategory.HighCard) {
    const maxBoard = Math.max(...boardRanks);
    const overcards = holeRanks.filter((r) => r > maxBoard);
    if (overcards.length) {
      draws.push({
        key: 'overcards',
        label: overcards.length === 2 ? 'Zwei Overcards' : 'Eine Overcard',
        description: `${overcards
          .map((r) => RANK_NAMES[r])
          .join(' und ')} ${overcards.length === 2 ? 'liegen' : 'liegt'} über dem Board – ein Treffer gibt dir das Top Pair.`,
        outs: overcards.length * 3,
        tone: 'draw',
      });
    }
  }

  // --- Blocker -------------------------------------------------------------
  for (let s = 0; s < 4; s++) {
    const holdsAce = hole.some((c) => cardSuit(c) === s && cardRank(c) === 12);
    if (holdsAce && suitTotal[s] >= 3 && suitHole[s] === 1) {
      draws.push({
        key: 'flush-blocker',
        label: 'Nut-Flush-Blocker',
        description: `Du hältst das ${SUIT_NAMES[s]}-Ass – niemand am Tisch kann den Nut Flush haben.`,
        tone: 'info',
      });
    }
  }

  return draws;
}

/** Beschreibt die aktuell fertige Hand und unterscheidet Set von Trips. */
function makeHandInfo(
  made: ReturnType<typeof describeHand>,
  holeRanks: readonly number[],
): DrawInfo {
  let label = made.label;
  if (made.category === HandCategory.ThreeOfAKind && holeRanks[0] === holeRanks[1]) {
    label = 'Set';
  } else if (made.category === HandCategory.ThreeOfAKind) {
    label = 'Trips';
  }

  return {
    key: 'made-hand',
    label,
    description: made.detail,
    tone: made.category >= HandCategory.Pair ? 'made' : 'info',
  };
}

/**
 * Prüft, ob wir die höchste noch verfügbare Karte dieser Farbe halten.
 * Karten oberhalb unserer, die bereits auf dem Board liegen, zählen nicht als Gefahr.
 */
function isNutFlushDraw(suit: number, hole: readonly Card[], board: readonly Card[]): boolean {
  for (let r = 12; r >= 0; r--) {
    const card = (r << 2) | suit;
    if (hole.includes(card)) return true;
    if (!board.includes(card)) return false; // Diese höhere Karte könnte ein Gegner halten.
  }
  return false;
}

/**
 * Sucht Straight-Draws. Ein Rang zählt nur, wenn die dadurch entstehende Straße
 * mindestens eine unserer Handkarten benutzt – eine Straße rein auf dem Board
 * ist kein eigener Draw.
 */
function findStraightDraw(
  holeRanks: readonly number[],
  boardRanks: readonly number[],
): DrawInfo | null {
  let mask = 0;
  for (const r of holeRanks) mask |= 1 << r;
  for (const r of boardRanks) mask |= 1 << r;
  if (STRAIGHT_HIGH[mask]) return null; // Straße schon fertig.

  const completing: number[] = [];
  for (let r = 0; r < 13; r++) {
    if (mask & (1 << r)) continue;
    const high = STRAIGHT_HIGH[mask | (1 << r)];
    if (!high) continue;
    if (usesOwnCard(high - 1, holeRanks)) completing.push(r);
  }
  if (!completing.length) return null;

  const outs = completing.length * 4;
  const ranks = completing.map((r) => RANK_NAMES[r]).join(', ');

  if (completing.length === 1) {
    return {
      key: 'gutshot',
      label: 'Gutshot',
      description: `Nur eine ${ranks} vervollständigt deine Straße – das sind 4 Outs.`,
      outs,
      tone: 'draw',
    };
  }

  const openEnded = hasFourInARow(mask);
  return {
    key: openEnded ? 'oesd' : 'double-gutshot',
    label: openEnded ? 'Open Ended Straight Draw' : 'Doppelter Gutshot',
    description: `${ranks} vervollständigen deine Straße – das sind ${outs} Outs.`,
    outs,
    tone: 'draw',
  };
}

/** Liegt mindestens eine unserer Karten in der Straße mit High-Card-Rang `high`? */
function usesOwnCard(high: number, holeRanks: readonly number[]): boolean {
  // Wheel: High-Card ist die Fünf (Rang 3), das Ass (12) gehört mit dazu.
  const members = high === 3 ? [12, 3, 2, 1, 0] : [high, high - 1, high - 2, high - 3, high - 4];
  return holeRanks.some((r) => members.includes(r));
}

/** Vier aufeinanderfolgende Ränge ⇒ echtes Open End statt doppeltem Gutshot. */
function hasFourInARow(mask: number): boolean {
  for (let low = 0; low <= 9; low++) {
    const run = 0b1111 << low;
    if ((mask & run) === run) return true;
  }
  return false;
}
