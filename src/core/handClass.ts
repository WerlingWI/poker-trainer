/**
 * Einordnung der Starthand – Grundlage für die Statistik "Equity nach Handtyp"
 * und für die Preflop-Erklärung, wenn es noch keine Draws gibt.
 */

import { RANK_CHARS, RANK_LABELS, cardRank, cardSuit, type Card } from './cards';

export type HandClassKey =
  | 'pocket-pair'
  | 'suited-ace'
  | 'suited-broadway'
  | 'suited-connector'
  | 'suited-other'
  | 'offsuit-broadway'
  | 'offsuit-ace'
  | 'offsuit-other';

export interface HandClass {
  key: HandClassKey;
  label: string;
  description: string;
}

export const HAND_CLASS_ORDER: HandClassKey[] = [
  'pocket-pair',
  'suited-ace',
  'suited-broadway',
  'suited-connector',
  'suited-other',
  'offsuit-broadway',
  'offsuit-ace',
  'offsuit-other',
];

export const HAND_CLASS_LABELS: Record<HandClassKey, string> = {
  'pocket-pair': 'Pocket Pair',
  'suited-ace': 'Suited Ace',
  'suited-broadway': 'Suited Broadway',
  'suited-connector': 'Suited Connector',
  'suited-other': 'Suited, sonstige',
  'offsuit-broadway': 'Broadway offsuit',
  'offsuit-ace': 'Ass offsuit',
  'offsuit-other': 'Offsuit, sonstige',
};

const BROADWAY_MIN = 8; // Zehn und höher

export function classifyHand(hole: readonly Card[]): HandClass {
  if (hole.length < 2) {
    return { key: 'offsuit-other', label: 'Unbekannt', description: '' };
  }

  const [a, b] = hole;
  const high = Math.max(cardRank(a), cardRank(b));
  const low = Math.min(cardRank(a), cardRank(b));
  const suited = cardSuit(a) === cardSuit(b);
  const gap = high - low;

  if (high === low) {
    return {
      key: 'pocket-pair',
      label: 'Pocket Pair',
      description: `Ein Paar ${RANK_LABELS[high]} schon vor dem Flop – du triffst in etwa jedem achten Flop ein Set.`,
    };
  }

  if (suited) {
    if (high === 12) {
      return {
        key: 'suited-ace',
        label: 'Suited Ace',
        description: 'Ass suited: jeder Flush, den du triffst, ist der höchstmögliche.',
      };
    }
    if (low >= BROADWAY_MIN) {
      return {
        key: 'suited-broadway',
        label: 'Suited Broadway',
        description: 'Zwei hohe Karten in einer Farbe – hohe Paare plus Flush- und Straßenpotenzial.',
      };
    }
    if (gap <= 2) {
      return {
        key: 'suited-connector',
        label: 'Suited Connector',
        description: 'Verbundene Karten in einer Farbe – wenig Showdown-Wert, aber starke Draws.',
      };
    }
    return {
      key: 'suited-other',
      label: 'Suited',
      description: 'Gleiche Farbe – das gibt etwas zusätzliche Flush-Chance.',
    };
  }

  if (low >= BROADWAY_MIN) {
    return {
      key: 'offsuit-broadway',
      label: 'Broadway offsuit',
      description: 'Zwei hohe Karten – stark, wenn du triffst, aber ohne Flush-Potenzial.',
    };
  }
  if (high === 12) {
    return {
      key: 'offsuit-ace',
      label: 'Ass offsuit',
      description: 'Ein Ass mit schwacher zweiter Karte – Vorsicht bei Kicker-Problemen.',
    };
  }
  return {
    key: 'offsuit-other',
    label: 'Offsuit',
    description: 'Weder verbunden noch gleichfarbig – die schwächste Kategorie.',
  };
}

/** Standard-Notation: "AKs", "T9o", "77". */
export function handCode(hole: readonly Card[]): string {
  if (hole.length < 2) return '';
  const [a, b] = hole;
  const high = Math.max(cardRank(a), cardRank(b));
  const low = Math.min(cardRank(a), cardRank(b));
  if (high === low) return RANK_CHARS[high] + RANK_CHARS[low];
  return RANK_CHARS[high] + RANK_CHARS[low] + (cardSuit(a) === cardSuit(b) ? 's' : 'o');
}
