/**
 * Gegner-Ranges.
 *
 * Statt "der Gegner hält zwei zufällige Karten" lässt sich hier eine konkrete
 * Hand-Range hinterlegen. Die Simulation zieht dann nur noch Hände aus dieser
 * Range – das verändert Equity, Outs und Empfehlung erheblich und ist der
 * größte Realismus-Sprung gegenüber der Zufallsannahme.
 *
 * Eine Range ist ein `Uint8Array(169)`: 1 = Klasse gehört zur Range, 0 = nicht.
 */

import type { Card } from './cards';
import {
  NUM_HAND_CLASSES,
  RANKING,
  TOTAL_COMBOS,
  combosInClass,
  combosOfClass,
} from './handRanking';

export type Range = Uint8Array;

export function emptyRange(): Range {
  return new Uint8Array(NUM_HAND_CLASSES);
}

export function fullRange(): Range {
  return new Uint8Array(NUM_HAND_CLASSES).fill(1);
}

export function rangeCombos(range: Range): number {
  let total = 0;
  for (let i = 0; i < NUM_HAND_CLASSES; i++) if (range[i]) total += combosInClass(i);
  return total;
}

/** Anteil aller 1326 Kombinationen, den die Range abdeckt. */
export function rangePercent(range: Range): number {
  return rangeCombos(range) / TOTAL_COMBOS;
}

export function isFullRange(range: Range): boolean {
  for (let i = 0; i < NUM_HAND_CLASSES; i++) if (!range[i]) return false;
  return true;
}

/**
 * Die stärksten Hände, bis der gewünschte Anteil erreicht ist.
 * `percent` ist ein Anteil von 0..1; 0.15 ergibt eine typische "Top 15 %"-Range.
 */
export function rangeFromPercent(percent: number): Range {
  const range = emptyRange();
  const target = Math.max(0, Math.min(1, percent)) * TOTAL_COMBOS;
  let cumulative = 0;

  for (const classIndex of RANKING) {
    if (cumulative >= target) break;
    range[classIndex] = 1;
    cumulative += combosInClass(classIndex);
  }

  // Mindestens die stärkste Hand, damit nie eine leere Range entsteht.
  if (cumulative === 0) range[RANKING[0]] = 1;
  return range;
}

export function toggleClass(range: Range, classIndex: number): Range {
  const next = new Uint8Array(range);
  next[classIndex] = next[classIndex] ? 0 : 1;
  return next;
}

/**
 * Alle konkreten Kartenpaare der Range, flach als `c1 * 52 + c2` kodiert.
 * Die Simulation zieht daraus per Zufall und verwirft Paare, deren Karten
 * bereits vergeben sind.
 */
export function rangeComboList(range: Range): Uint16Array {
  const list: number[] = [];
  for (let classIndex = 0; classIndex < NUM_HAND_CLASSES; classIndex++) {
    if (!range[classIndex]) continue;
    for (const [a, b] of combosOfClass(classIndex)) list.push(a * 52 + b);
  }
  return Uint16Array.from(list);
}

export function decodeCombo(encoded: number): [Card, Card] {
  return [Math.floor(encoded / 52), encoded % 52];
}

// --- Presets ---------------------------------------------------------------

export interface RangePreset {
  key: string;
  label: string;
  description: string;
  percent: number;
}

/**
 * Übliche Ranges aus der Praxis, als Anteil der stärksten Hände.
 * Die Prozentwerte orientieren sich an gängigen Eröffnungs-Charts für
 * 6-Max-Spiele; sie sind Richtwerte, keine Solver-Ausgabe.
 */
export const RANGE_PRESETS: readonly RangePreset[] = [
  {
    key: 'utg',
    label: 'UTG Open',
    description: 'Enge Eröffnung aus früher Position – etwa die besten 12 %.',
    percent: 0.12,
  },
  {
    key: 'mp',
    label: 'MP Open',
    description: 'Mittlere Position, etwas weiter – etwa 17 %.',
    percent: 0.17,
  },
  {
    key: 'co',
    label: 'CO Open',
    description: 'Cutoff-Eröffnung – etwa 26 %.',
    percent: 0.26,
  },
  {
    key: 'btn',
    label: 'BTN Steal',
    description: 'Am Button wird weit eröffnet – etwa 45 %.',
    percent: 0.45,
  },
  {
    key: 'bb-defend',
    label: 'BB Defense',
    description: 'Der Big Blind verteidigt sehr weit, weil er schon gesetzt hat – etwa 40 %.',
    percent: 0.4,
  },
  {
    key: 'threebet',
    label: '3-Bet',
    description: 'Wer selbst erhöht hat, zeigt eine enge Range – etwa 6 %.',
    percent: 0.06,
  },
  {
    key: 'fourbet',
    label: '4-Bet',
    description: 'Sehr enge Range, meist Premium-Hände – etwa 3 %.',
    percent: 0.03,
  },
  {
    key: 'calling',
    label: 'Calling Station',
    description: 'Spieler, der fast alles mitgeht – etwa 60 %.',
    percent: 0.6,
  },
  {
    key: 'any',
    label: 'Zufällige Hand',
    description: 'Keine Annahme über den Gegner – alle 100 % der Hände.',
    percent: 1,
  },
];

// --- Ableitung aus Gegner-Statistiken --------------------------------------

/** Die vier Kennzahlen, die man einem Gegner am Tisch am ehesten ansieht. */
export interface OpponentStats {
  /** Voluntarily Put money In Pot: Anteil der Hände, die er freiwillig spielt. */
  vpip: number;
  /** Preflop Raise: Anteil der Hände, mit denen er preflop erhöht. */
  pfr: number;
  /** Anteil der Hände, mit denen er auf eine Erhöhung re-raist. */
  threeBet: number;
  /** Attempt To Steal: Anteil der Eröffnungen aus später Position. */
  ats: number;
}

export function defaultOpponentStats(): OpponentStats {
  // Werte eines soliden, leicht lockeren Gegners im Heimspiel.
  return { vpip: 28, pfr: 18, threeBet: 6, ats: 32 };
}

/** Die Aktion, die der Gegner in dieser Hand gezeigt hat. */
export type OpponentAction = 'unknown' | 'limp' | 'open' | 'steal' | 'threeBet';

export const OPPONENT_ACTIONS: ReadonlyArray<{ value: OpponentAction; label: string }> = [
  { value: 'unknown', label: 'unbekannt' },
  { value: 'limp', label: 'nur mitgegangen' },
  { value: 'open', label: 'eröffnet' },
  { value: 'steal', label: 'aus später Position eröffnet' },
  { value: 'threeBet', label: '3-Bet' },
];

export interface DerivedRange {
  range: Range;
  percent: number;
  explanation: string;
}

/**
 * Leitet aus den Gegner-Stats und seiner gezeigten Aktion eine Range ab.
 *
 * Die Zuordnung ist bewusst einfach und nachvollziehbar:
 * – hat er nur mitgegangen, spielt er den Teil seiner VPIP-Range, mit dem er *nicht* erhöht,
 * – hat er eröffnet, ist es seine PFR-Range (aus später Position die ATS-Range),
 * – hat er 3-gebettet, seine 3-Bet-Range.
 * Ohne bekannte Aktion wird die VPIP-Range angenommen.
 */
export function rangeFromStats(stats: OpponentStats, action: OpponentAction): DerivedRange {
  const vpip = clampPercent(stats.vpip);
  const pfr = Math.min(clampPercent(stats.pfr), vpip);

  switch (action) {
    case 'limp': {
      // Der Limp-Anteil ist der Teil der VPIP-Range, der nicht erhöht wird.
      // Diese Hände sind im Schnitt die schwächeren – abgebildet als Range in
      // VPIP-Breite, weil sich einzelne Hände daraus nicht sauber trennen lassen.
      const percent = Math.max(vpip - pfr, 0.03);
      return {
        range: rangeFromPercent(percent),
        percent,
        explanation: `Nur mitgegangen: VPIP ${format(vpip)} minus PFR ${format(pfr)} ergibt eine Limp-Range von rund ${format(percent)}.`,
      };
    }
    case 'open':
      return {
        range: rangeFromPercent(pfr),
        percent: pfr,
        explanation: `Er hat eröffnet – das entspricht seiner PFR-Range von ${format(pfr)}.`,
      };
    case 'steal': {
      const percent = clampPercent(stats.ats);
      return {
        range: rangeFromPercent(percent),
        percent,
        explanation: `Eröffnung aus später Position – seine Steal-Range (ATS) liegt bei ${format(percent)}.`,
      };
    }
    case 'threeBet': {
      const percent = clampPercent(stats.threeBet);
      return {
        range: rangeFromPercent(percent),
        percent,
        explanation: `3-Bet – dafür nutzt er nur rund ${format(percent)} seiner Hände.`,
      };
    }
    default:
      return {
        range: rangeFromPercent(vpip),
        percent: vpip,
        explanation: `Ohne bekannte Aktion wird seine VPIP-Range von ${format(vpip)} angenommen.`,
      };
  }
}

function clampPercent(value: number): number {
  return Math.max(0.01, Math.min(1, value / 100));
}

// --- Gegner-Modell ---------------------------------------------------------

/** Woher die Range des Gegners kommt. */
export type RangeMode = 'random' | 'preset' | 'stats' | 'custom';

export interface OpponentModel {
  mode: RangeMode;
  /** Schlüssel aus RANGE_PRESETS, wenn `mode === 'preset'`. */
  presetKey: string;
  stats: OpponentStats;
  action: OpponentAction;
  /** Von Hand gewählte Klassen-Indizes, wenn `mode === 'custom'`. */
  custom: number[];
}

export function defaultOpponentModel(): OpponentModel {
  return {
    mode: 'random',
    presetKey: 'co',
    stats: defaultOpponentStats(),
    action: 'open',
    custom: [],
  };
}

/** Übersetzt das Gegner-Modell in die konkrete Range, mit der simuliert wird. */
export function resolveRange(model: OpponentModel): DerivedRange {
  switch (model.mode) {
    case 'preset': {
      const preset = RANGE_PRESETS.find((p) => p.key === model.presetKey) ?? RANGE_PRESETS[2];
      return {
        range: rangeFromPercent(preset.percent),
        percent: preset.percent,
        explanation: preset.description,
      };
    }
    case 'stats':
      return rangeFromStats(model.stats, model.action);
    case 'custom': {
      const range = emptyRange();
      for (const classIndex of model.custom) {
        if (classIndex >= 0 && classIndex < NUM_HAND_CLASSES) range[classIndex] = 1;
      }
      const percent = rangePercent(range);
      return {
        range,
        percent,
        explanation: `Selbst gewählte Range mit ${rangeCombos(range)} von 1326 Kombinationen (${(percent * 100).toFixed(1).replace('.', ',')} %).`,
      };
    }
    default:
      return {
        range: fullRange(),
        percent: 1,
        explanation: 'Die Gegner halten zufällige Karten – keine Annahme über ihr Spiel.',
      };
  }
}

/** Leer gewählte Custom-Range: dann wird nicht simuliert, sondern gewarnt. */
export function isUsableRange(range: Range): boolean {
  return rangeCombos(range) > 0;
}

function format(fraction: number): string {
  return `${(fraction * 100).toFixed(0)} %`;
}
