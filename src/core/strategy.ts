/**
 * Der Teil, der über die reine Equity hinausgeht: Implied Odds, Einsatzhöhen,
 * und die Einordnung, ob eine Situation nach Value Bet, Bluff oder Bluff Catch ruft.
 *
 * Alle Formeln stehen im Klartext daneben, damit man die Empfehlung nachrechnen
 * und nicht nur glauben muss.
 */

import { HandCategory } from './evaluator';
import { PERCENTILE_OF_CLASS, handClassOf } from './handRanking';
import type { Odds } from './odds';
import type { Card } from './cards';
import type { PositionKey } from './table';

// --- Implied Odds ----------------------------------------------------------

export interface ImpliedOdds {
  /** Wie viele Chips du auf späteren Straßen zusätzlich gewinnen musst. */
  needed: number;
  /** Was der Gegner überhaupt noch bezahlen kann. */
  available: number;
  /** Reicht der verbleibende Stack für die nötigen Implied Odds? */
  feasible: boolean;
  winChance: number;
  /** Der Call rechnet sich schon ohne Implied Odds. */
  alreadyProfitable: boolean;
}

/**
 * Ein Call ist +EV, wenn gilt:
 *
 *   p × (Pot + X) − (1 − p) × Call ≥ 0
 *
 * Gewinnst du, bekommst du den Pot plus X von späteren Straßen; der eigene Call
 * kommt dabei zurück und ist kein Gewinn. Verlierst du, ist der Call weg.
 * Aufgelöst nach X:
 *
 *   X ≥ Call / p − Call − Pot
 *
 * Für `p` wird die simulierte Equity eingesetzt, nicht die reine Trefferchance:
 * einen Draw zu treffen heißt noch nicht, die Hand auch zu gewinnen.
 */
export function computeImpliedOdds(
  winChance: number,
  pot: number,
  call: number,
  stack: number,
): ImpliedOdds | null {
  if (winChance <= 0 || call <= 0) return null;

  const effectiveCall = Math.min(call, stack);
  const needed = effectiveCall / winChance - effectiveCall - pot;
  const available = Math.max(0, stack - effectiveCall);

  return {
    needed: Math.max(0, needed),
    available,
    feasible: needed <= available,
    winChance,
    alreadyProfitable: needed <= 0,
  };
}

// --- Einsatzhöhen ----------------------------------------------------------

export interface BetOption {
  /** Anteil vom Pot, z.B. 0.66 für zwei Drittel. */
  fraction: number;
  label: string;
  size: number;
  /**
   * Wie oft der Gegner folden muss, damit ein reiner Bluff dieser Größe
   * ohne jede Equity profitabel ist: Einsatz / (Pot + Einsatz).
   */
  requiredFoldEquity: number;
}

const BET_FRACTIONS: ReadonlyArray<{ fraction: number; label: string }> = [
  { fraction: 0.33, label: '⅓ Pot' },
  { fraction: 0.5, label: '½ Pot' },
  { fraction: 0.66, label: '⅔ Pot' },
  { fraction: 1, label: 'Pot' },
];

export function betOptions(pot: number, stack: number): BetOption[] {
  return BET_FRACTIONS.map(({ fraction, label }) => {
    const size = Math.min(Math.round(pot * fraction), stack);
    return {
      fraction,
      label,
      size,
      requiredFoldEquity: pot + size > 0 ? size / (pot + size) : 0,
    };
  }).filter((option) => option.size > 0);
}

// --- Spielplan -------------------------------------------------------------

export type PlanKind = 'value-bet' | 'thin-value' | 'bluff' | 'bluff-catch' | 'pot-control' | 'give-up';

export interface StrategyPlan {
  kind: PlanKind;
  title: string;
  detail: string;
  /** Vorgeschlagene Einsatzhöhe, falls die Situation nach einem Einsatz ruft. */
  suggested?: BetOption;
  options: BetOption[];
  tone: 'positive' | 'negative' | 'neutral';
}

export interface PlanInput {
  equity: number;
  odds: Odds;
  pot: number;
  call: number;
  stack: number;
  /** Kategorie der aktuell fertigen Hand, falls ein Board liegt. */
  madeCategory: HandCategory | null;
  /** Hat die Hand einen Draw (Flush, Straße, Overcards)? */
  hasDraw: boolean;
  /** Blockt die Hand die stärksten Gegnerhände? */
  hasBlocker: boolean;
}

/**
 * Ordnet die Situation einer der klassischen Kategorien zu und schlägt eine
 * Einsatzhöhe vor. Bewusst regelbasiert und erklärbar – kein Solver.
 */
export function buildPlan(input: PlanInput): StrategyPlan {
  const { equity, odds, pot, call, stack, madeCategory, hasDraw, hasBlocker } = input;
  const options = betOptions(pot, stack);
  const pick = (fraction: number) =>
    options.reduce((best, option) =>
      Math.abs(option.fraction - fraction) < Math.abs(best.fraction - fraction) ? option : best,
    );

  // --- Niemand hat gesetzt: Value Bet, Bluff oder Kontrolle? ---------------
  if (call <= 0) {
    if (equity >= 0.78) {
      const suggested = pick(1);
      return {
        kind: 'value-bet',
        title: 'Value Bet',
        detail: `Mit ${percent(equity)} Equity bist du fast immer vorne. Setze groß – schwächere Hände zahlen hier noch.`,
        suggested,
        options,
        tone: 'positive',
      };
    }
    if (equity >= 0.6) {
      const suggested = pick(0.5);
      return {
        kind: 'value-bet',
        title: 'Value Bet',
        detail: `${percent(equity)} Equity reichen für einen Einsatz. Halbe Potgröße hält schwächere Hände im Pot.`,
        suggested,
        options,
        tone: 'positive',
      };
    }
    if (equity >= 0.5) {
      const suggested = pick(0.33);
      return {
        kind: 'thin-value',
        title: 'Dünner Value Bet',
        detail: `Bei ${percent(equity)} Equity bist du knapp vorne. Klein setzen holt noch Value, ohne dich gegen bessere Hände zu überdehnen.`,
        suggested,
        options,
        tone: 'neutral',
      };
    }
    if ((hasDraw || hasBlocker) && equity <= 0.4) {
      const suggested = pick(0.66);
      return {
        kind: 'bluff',
        title: 'Bluff-Kandidat',
        detail: `Zum Mitgehen reicht es nicht, aber ${hasBlocker ? 'du blockst seine stärksten Hände' : 'du hast noch Outs'}. Bei ${suggested.label} muss er in ${percent(suggested.requiredFoldEquity)} der Fälle folden, damit sich der Bluff allein rechnet.`,
        suggested,
        options,
        tone: 'neutral',
      };
    }
    return {
      kind: 'pot-control',
      title: 'Pot klein halten',
      detail: `Mit ${percent(equity)} Equity und ohne Draw gibt es hier nichts zu holen – checken und eine kostenlose Karte nehmen.`,
      options,
      tone: 'neutral',
    };
  }

  // --- Es liegt ein Einsatz: Erhöhen, Bluff Catch oder aufgeben? -----------
  if (equity >= 0.75) {
    const suggested = pick(0.75);
    return {
      kind: 'value-bet',
      title: 'Value Raise',
      detail: `${percent(equity)} Equity gegen einen Einsatz – erhöhen und den Pot aufbauen, solange er noch bezahlt.`,
      suggested,
      options,
      tone: 'positive',
    };
  }

  const isMadeHand = madeCategory !== null && madeCategory >= HandCategory.Pair;
  const marginal = madeCategory !== null && madeCategory <= HandCategory.TwoPair;

  if (isMadeHand && marginal && equity >= odds.requiredEquity) {
    return {
      kind: 'bluff-catch',
      title: 'Bluff Catch',
      detail: `Deine Hand schlägt keine starke Hand mehr, gewinnt aber gegen jeden Bluff. Du brauchst ${percent(odds.requiredEquity)} und hast ${percent(equity)} – der Call lohnt sich, solange er auch mal ohne etwas setzt.`,
      options,
      tone: 'neutral',
    };
  }

  if (hasDraw && equity < odds.requiredEquity) {
    return {
      kind: 'give-up',
      title: 'Draw ohne Preis',
      detail: `Die direkten Pot Odds reichen nicht (${percent(equity)} gegen ${percent(odds.requiredEquity)} nötig). Ob der Call trotzdem passt, entscheiden die Implied Odds unten.`,
      options,
      tone: 'negative',
    };
  }

  if (equity < odds.requiredEquity) {
    return {
      kind: 'give-up',
      title: 'Aufgeben',
      detail: `${percent(equity)} Equity gegen ${percent(odds.requiredEquity)} benötigte – ohne Draw und ohne Blocker gibt es keinen Grund weiterzuspielen.`,
      options,
      tone: 'negative',
    };
  }

  return {
    kind: 'bluff-catch',
    title: 'Knapper Call',
    detail: `Du liegst mit ${percent(equity)} knapp über den benötigten ${percent(odds.requiredEquity)}. Mitgehen, aber den Pot nicht selbst vergrößern.`,
    options,
    tone: 'neutral',
  };
}

// --- Position & Preflop ----------------------------------------------------

/** Übliche Eröffnungsbreite je Position (Anteil der stärksten Hände) im 6-Max. */
export const OPENING_RANGE_BY_POSITION: Record<PositionKey, number> = {
  UTG: 0.12,
  'UTG+1': 0.15,
  MP: 0.17,
  LJ: 0.19,
  HJ: 0.22,
  CO: 0.26,
  BTN: 0.45,
  SB: 0.35,
  BB: 0.4,
};

export interface PreflopAdvice {
  /** Perzentil der eigenen Hand, 0..1 – kleiner ist besser. */
  percentile: number;
  /** Empfohlene Eröffnungsbreite für diese Position. */
  openingWidth: number;
  playable: boolean;
  text: string;
}

export function preflopAdvice(hole: readonly Card[], position: PositionKey): PreflopAdvice | null {
  if (hole.length < 2) return null;

  const percentile = PERCENTILE_OF_CLASS[handClassOf(hole)];
  const openingWidth = OPENING_RANGE_BY_POSITION[position];
  const playable = percentile <= openingWidth;

  const text = playable
    ? `Deine Hand gehört zu den besten ${percent(percentile)} aller Starthände. Aus dieser Position eröffnest du etwa die besten ${percent(openingWidth)} – das ist also eine klare Raise-Hand.`
    : `Deine Hand liegt bei den besten ${percent(percentile)}, aus dieser Position solltest du aber nur rund die besten ${percent(openingWidth)} eröffnen. Ohne guten Grund gehört sie hier weg.`;

  return { percentile, openingWidth, playable, text };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1).replace('.', ',')} %`;
}
