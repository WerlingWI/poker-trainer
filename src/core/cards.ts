/**
 * Kartenrepräsentation.
 *
 * Eine Karte ist eine einzelne Zahl 0..51:
 *   rank = card >> 2   (0 = Zwei … 12 = Ass)
 *   suit = card & 3    (0 = Kreuz, 1 = Karo, 2 = Herz, 3 = Pik)
 *
 * Dadurch passen ganze Decks in ein `Uint8Array` und der Monte-Carlo-Kern
 * kommt im Hot Path ohne Objekt-Allokationen aus.
 */

/** Eine Karte als Index 0..51. */
export type Card = number;

export const NUM_CARDS = 52;
export const NUM_RANKS = 13;
export const NUM_SUITS = 4;

/**
 * Index 0..12 → Aufdruck auf der Karte. Die Zehn steht bewusst als "10" da, nicht als "T";
 * Bube, Dame und König behalten die international übliche Beschriftung J/Q/K.
 */
export const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** Ausgeschriebene Namen für Fließtext ("Nur eine Dame vervollständigt deine Straße"). */
export const RANK_NAMES = [
  'Zwei',
  'Drei',
  'Vier',
  'Fünf',
  'Sechs',
  'Sieben',
  'Acht',
  'Neun',
  'Zehn',
  'Bube',
  'Dame',
  'König',
  'Ass',
];

/** Kurzform für kompakte Stellen (Handcodes wie "AKs"). */
export const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
export const SUIT_NAMES = ['Kreuz', 'Karo', 'Herz', 'Pik'];
export const SUIT_CHARS = ['c', 'd', 'h', 's'];
export const SUIT_IS_RED = [false, true, true, false];

/** Reihenfolge, in der die Farben im Karten-Grid erscheinen: ♠ ♥ ♦ ♣. */
export const SUIT_DISPLAY_ORDER = [3, 2, 1, 0];

/** Ränge von Ass abwärts – Anzeigereihenfolge im Karten-Grid. */
export const RANKS_DESC = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

export function makeCard(rank: number, suit: number): Card {
  return (rank << 2) | suit;
}

export function cardRank(card: Card): number {
  return card >> 2;
}

export function cardSuit(card: Card): number {
  return card & 3;
}

/** Kompakter, stabiler Code wie "As" (Ass Pik) oder "Th" (Zehn Herz). Für Persistenz und Tests. */
export function cardCode(card: Card): string {
  return RANK_CHARS[cardRank(card)] + SUIT_CHARS[cardSuit(card)];
}

/** Für den Menschen lesbar, z.B. "10 ♥". */
export function cardLabel(card: Card): string {
  return `${RANK_LABELS[cardRank(card)]} ${SUIT_SYMBOLS[cardSuit(card)]}`;
}

/** Ausgeschrieben, z.B. "Herz-Zehn" – wird in den Erklärtexten verwendet. */
export function cardName(card: Card): string {
  return `${SUIT_NAMES[cardSuit(card)]}-${RANK_LABELS[cardRank(card)]}`;
}

/**
 * Parst "As", "Th", "10h", "ad" … zu einem Kartenindex. Gibt `null` zurück,
 * wenn der Text keine gültige Karte ist (z.B. bei Eingaben aus dem localStorage).
 */
export function parseCard(text: string): Card | null {
  const t = text.trim().toLowerCase();
  if (t.length < 2) return null;

  const suitChar = t[t.length - 1];
  const suit = SUIT_CHARS.indexOf(suitChar);
  if (suit < 0) return null;

  const rankPart = t.slice(0, -1);
  const rank = rankPart === '10' ? 8 : RANK_CHARS.findIndex((c) => c.toLowerCase() === rankPart);
  if (rank < 0) return null;

  return makeCard(rank, suit);
}

/** Alle 52 Karten in Indexreihenfolge. Wird nie mutiert. */
export const FULL_DECK: readonly Card[] = Array.from({ length: NUM_CARDS }, (_, i) => i);

/** Liefert alle Karten, die weder auf der Hand noch auf dem Board liegen. */
export function unknownCards(known: readonly Card[]): Card[] {
  const used = new Uint8Array(NUM_CARDS);
  for (const c of known) used[c] = 1;
  const rest: Card[] = [];
  for (let c = 0; c < NUM_CARDS; c++) if (!used[c]) rest.push(c);
  return rest;
}

/** Sortiert absteigend nach Rang (bei Gleichstand nach Farbe) – rein für die Anzeige. */
export function sortForDisplay(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => cardRank(b) - cardRank(a) || cardSuit(b) - cardSuit(a));
}
