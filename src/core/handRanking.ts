/**
 * Die 169 Starthand-Klassen und ihre Rangfolge.
 *
 * Eine Klasse fasst alle Karten-Kombinationen zusammen, die sich preflop gleich
 * verhalten: "AKs" sind die vier gleichfarbigen Ass-König-Kombinationen, "AKo"
 * die zwölf gemischtfarbigen, "AA" die sechs Ass-Paare. Zusammen 1326 Kombos.
 *
 * `RANKING` ordnet die Klassen von stark nach schwach. Die Reihenfolge wurde
 * **mit der Engine dieses Projekts berechnet**: Equity jeder Klasse heads-up
 * gegen eine zufällige Hand, 300.000 Simulationen pro Klasse. Der Test
 * `handRanking.test.ts` rechnet das nach und schlägt Alarm, wenn die Tabelle
 * nicht mehr zur Engine passt.
 *
 * Wichtig zur Einordnung: Das ist reine Kartenstärke im Duell. Am echten Tisch
 * kommen Spielbarkeit und Position dazu – Suited Connectors sind dort mehr wert,
 * als ihr Platz in dieser Liste vermuten lässt.
 */

import { RANK_CHARS, cardRank, cardSuit, makeCard, type Card } from './cards';

export const NUM_HAND_CLASSES = 169;
export const TOTAL_COMBOS = 1326;

/**
 * Index einer Handklasse: Paare liegen auf der Diagonalen (rang × 13 + rang),
 * suited oberhalb (hoch × 13 + niedrig), offsuit unterhalb (niedrig × 13 + hoch).
 */
export function handClassIndex(rankA: number, rankB: number, suited: boolean): number {
  const hi = rankA > rankB ? rankA : rankB;
  const lo = rankA > rankB ? rankB : rankA;
  if (hi === lo) return hi * 13 + hi;
  return suited ? hi * 13 + lo : lo * 13 + hi;
}

export function handClassOf(hole: readonly Card[]): number {
  return handClassIndex(
    cardRank(hole[0]),
    cardRank(hole[1]),
    cardSuit(hole[0]) === cardSuit(hole[1]),
  );
}

export function isPairClass(index: number): boolean {
  return Math.floor(index / 13) === index % 13;
}

export function isSuitedClass(index: number): boolean {
  return Math.floor(index / 13) > index % 13;
}

/** Wie viele der 1326 Kombinationen diese Klasse umfasst: Paar 6, suited 4, offsuit 12. */
export function combosInClass(index: number): number {
  if (isPairClass(index)) return 6;
  return isSuitedClass(index) ? 4 : 12;
}

export function handClassCode(index: number): string {
  const row = Math.floor(index / 13);
  const col = index % 13;
  if (row === col) return RANK_CHARS[row] + RANK_CHARS[col];
  const hi = Math.max(row, col);
  const lo = Math.min(row, col);
  return RANK_CHARS[hi] + RANK_CHARS[lo] + (row > col ? 's' : 'o');
}

/** Alle konkreten Kartenpaare einer Klasse, als [karte1, karte2]. */
export function combosOfClass(index: number): Array<[Card, Card]> {
  const row = Math.floor(index / 13);
  const col = index % 13;
  const combos: Array<[Card, Card]> = [];

  if (row === col) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        combos.push([makeCard(row, s1), makeCard(row, s2)]);
      }
    }
    return combos;
  }

  const hi = Math.max(row, col);
  const lo = Math.min(row, col);

  if (row > col) {
    for (let s = 0; s < 4; s++) combos.push([makeCard(hi, s), makeCard(lo, s)]);
    return combos;
  }

  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (s1 !== s2) combos.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  }
  return combos;
}

/** Klassen-Indizes von der stärksten zur schwächsten Hand. */
export const RANKING: readonly number[] = [
  168, 154, 140, 126, 112, 98, 84, 167, 70, 166, 165, 155, 164, 142, 129, 153, 56, 163, 116, 152,
  162, 151, 141, 161, 103, 128, 42, 139, 159, 150, 160, 90, 115, 138, 158, 77, 157, 149, 127, 137,
  51, 64, 148, 102, 125, 114, 156, 28, 38, 147, 136, 89, 146, 25, 124, 101, 113, 76, 12, 145, 135,
  144, 123, 63, 111, 14, 134, 88, 100, 50, 143, 133, 122, 110, 37, 132, 75, 87, 99, 24, 97, 131, 62,
  109, 121, 11, 0, 130, 49, 120, 86, 74, 96, 36, 119, 108, 118, 23, 73, 85, 61, 83, 95, 10, 117,
  107, 48, 106, 35, 82, 72, 60, 105, 94, 69, 22, 71, 104, 81, 59, 47, 9, 93, 68, 34, 92, 55, 58, 80,
  46, 21, 91, 57, 67, 8, 41, 45, 54, 33, 79, 44, 78, 20, 66, 43, 40, 53, 32, 7, 31, 27, 65, 29, 30,
  39, 52, 19, 18, 26, 6, 16, 17, 13, 15, 5, 3, 4, 2, 1,
];

/** Platz einer Klasse in der Rangliste (0 = AA). */
export const RANK_OF_CLASS: readonly number[] = (() => {
  const positions = new Array<number>(NUM_HAND_CLASSES).fill(0);
  RANKING.forEach((classIndex, position) => {
    positions[classIndex] = position;
  });
  return positions;
})();

/**
 * Anteil aller Kombinationen, die mindestens so stark sind wie diese Klasse.
 * "AKs liegt in den besten 2,6 %" – der Wert, den Spieler als Perzentil kennen.
 */
export const PERCENTILE_OF_CLASS: readonly number[] = (() => {
  const percentiles = new Array<number>(NUM_HAND_CLASSES).fill(0);
  let cumulative = 0;
  for (const classIndex of RANKING) {
    cumulative += combosInClass(classIndex);
    percentiles[classIndex] = cumulative / TOTAL_COMBOS;
  }
  return percentiles;
})();
