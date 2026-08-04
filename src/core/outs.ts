/**
 * Outs, Hilfs- und Gefahrenkarten – rein empirisch aus der Simulation.
 *
 * Die Simulation hält fest, wie hoch die eigene Equity ausfällt, *wenn* eine
 * bestimmte Karte als nächste Boardkarte kommt. Daraus ergibt sich für jede
 * unbekannte Karte ein Delta gegenüber der Gesamt-Equity. Der Vorteil dieser
 * Definition: die Outs-Zahl passt immer zur angezeigten Equity, statt aus einer
 * separaten Heuristik zu stammen.
 */

import { NUM_CARDS, type Card } from './cards';
import type { SimTotals } from './simulate';

export type ImpactKind = 'out' | 'good' | 'neutral' | 'bad';

export interface CardImpact {
  card: Card;
  /** Equity, wenn genau diese Karte als nächstes kommt. */
  equity: number;
  /** Differenz zur Gesamt-Equity, in Prozentpunkten als Dezimalzahl (0.1 = +10 pp). */
  delta: number;
  samples: number;
  kind: ImpactKind;
}

export interface OutsAnalysis {
  /** Alle unbekannten Karten, absteigend nach Delta. */
  impacts: CardImpact[];
  outs: CardImpact[];
  helpful: CardImpact[];
  dangerous: CardImpact[];
  /** Schneller Zugriff für die Deck-Heatmap. */
  byCard: Map<Card, CardImpact>;
  /** Falsch, wenn zu wenige Stichproben pro Karte vorliegen (sehr kleine Simulationen). */
  reliable: boolean;
  /** Wie viele Karten noch kommen: 2 nach dem Flop, 1 nach dem Turn, 0 am River. */
  cardsToCome: number;
}

/** Eine Karte gilt als Out, wenn sie die Equity um mindestens 10 Prozentpunkte hebt. */
const OUT_THRESHOLD = 0.1;
/** Deutlich hilfreich, aber kein Out. */
const GOOD_THRESHOLD = 0.03;
/** Ab hier wird die Karte als Gefahr markiert. */
const BAD_THRESHOLD = -0.05;
/** Unterhalb dieser Stichprobenzahl ist das Delta reines Rauschen. */
const MIN_SAMPLES = 40;

export function analyzeOuts(
  totals: SimTotals,
  baselineEquity: number,
  unknown: readonly Card[],
  cardsToCome: number,
): OutsAnalysis {
  const impacts: CardImpact[] = [];
  let minSamples = Number.POSITIVE_INFINITY;

  for (const card of unknown) {
    const samples = totals.perCardCount[card];
    if (samples < minSamples) minSamples = samples;
    if (samples === 0) continue;

    const equity = totals.perCardEquity[card] / samples;
    const delta = equity - baselineEquity;

    let kind: ImpactKind = 'neutral';
    if (samples >= MIN_SAMPLES) {
      if (delta >= OUT_THRESHOLD) kind = 'out';
      else if (delta >= GOOD_THRESHOLD) kind = 'good';
      else if (delta <= BAD_THRESHOLD) kind = 'bad';
    }

    impacts.push({ card, equity, delta, samples, kind });
  }

  impacts.sort((a, b) => b.delta - a.delta);

  const byCard = new Map<Card, CardImpact>();
  for (const impact of impacts) byCard.set(impact.card, impact);

  return {
    impacts,
    outs: impacts.filter((i) => i.kind === 'out'),
    helpful: impacts.filter((i) => i.kind === 'good'),
    dangerous: impacts.filter((i) => i.kind === 'bad').reverse(),
    byCard,
    reliable: impacts.length > 0 && minSamples >= MIN_SAMPLES,
    cardsToCome,
  };
}

export function emptyOutsAnalysis(cardsToCome = 0): OutsAnalysis {
  return {
    impacts: [],
    outs: [],
    helpful: [],
    dangerous: [],
    byCard: new Map(),
    reliable: false,
    cardsToCome,
  };
}

/**
 * Faustregel für die Anzeige: mit `outs` Outs und `cardsToCome` kommenden Karten
 * trifft man ungefähr `outs × 2` (eine Karte) bzw. `outs × 4` Prozent (zwei Karten).
 * Nur als Merkhilfe im Lernmodus – gerechnet wird immer mit der Simulation.
 */
export function ruleOfTwoAndFour(outs: number, cardsToCome: number): number {
  if (cardsToCome <= 0) return 0;
  return Math.min(1, (outs * (cardsToCome >= 2 ? 4 : 2)) / 100);
}

/** Exakte Trefferwahrscheinlichkeit für `outs` Outs bei `unknown` unbekannten Karten. */
export function hitProbability(outs: number, unknown: number, cardsToCome: number): number {
  if (outs <= 0 || cardsToCome <= 0 || unknown <= 0) return 0;
  let missAll = 1;
  for (let i = 0; i < cardsToCome; i++) {
    const remaining = unknown - i;
    if (remaining <= 0) break;
    missAll *= (remaining - outs) / remaining;
  }
  return 1 - Math.max(0, missAll);
}

export const TOTAL_CARDS = NUM_CARDS;
