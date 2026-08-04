import { describe, expect, it } from 'vitest';
import { cardSuit, parseCard, unknownCards, type Card } from '../cards';
import { analyzeOuts, hitProbability, ruleOfTwoAndFour } from '../outs';
import { mergeTotals, runSimulation, toBreakdown } from '../simulate';

function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => {
    const card = parseCard(t);
    if (card === null) throw new Error(`Ungültige Karte im Test: ${t}`);
    return card;
  });
}

function equityOf(holeText: string, boardText: string, opponents: number, iterations = 200_000) {
  const hole = hand(holeText);
  const board = boardText ? hand(boardText) : [];
  const totals = runSimulation({ hole, board, opponents, iterations, seed: 12345 });
  return toBreakdown(totals).equity;
}

describe('runSimulation – Referenzwerte', () => {
  it('gibt Assen gegen einen zufälligen Gegner rund 85 % Equity', () => {
    // Der klassische, überall veröffentlichte Wert für AA gegen eine Zufallshand.
    expect(equityOf('Ah Ad', '', 1)).toBeCloseTo(0.852, 2);
  });

  it('senkt die Equity von Assen gegen neun Gegner deutlich', () => {
    const nine = equityOf('Ah Ad', '', 9, 100_000);
    expect(nine).toBeGreaterThan(0.27);
    expect(nine).toBeLessThan(0.36);
  });

  it('bewertet AKs besser als AKo', () => {
    const suited = equityOf('Ah Kh', '', 1);
    const offsuit = equityOf('Ah Kd', '', 1);
    expect(suited).toBeGreaterThan(offsuit);
    expect(suited - offsuit).toBeLessThan(0.05); // Der Vorteil ist real, aber klein.
  });

  it('erkennt einen sicheren Split, wenn das Board die Hand ist', () => {
    // Royal Flush auf dem Board: alle Spieler teilen immer.
    const totals = runSimulation({
      hole: hand('2c 3d'),
      board: hand('As Ks Qs Js Ts'),
      opponents: 3,
      iterations: 2_000,
      seed: 99,
    });
    const result = toBreakdown(totals);
    expect(result.tie).toBe(1);
    expect(result.equity).toBeCloseTo(0.25, 5);
  });

  it('gewinnt mit der Nuts am River immer', () => {
    const totals = runSimulation({
      hole: hand('As Ks'),
      board: hand('Qs Js Ts 4d 3c'),
      opponents: 5,
      iterations: 2_000,
      seed: 4,
    });
    expect(toBreakdown(totals).win).toBe(1);
  });

  it('liefert bei gleichem Seed exakt dasselbe Ergebnis', () => {
    const input = { hole: hand('Th 9h'), board: hand('8h 7d 2c'), opponents: 2, iterations: 20_000 };
    const a = runSimulation({ ...input, seed: 777 });
    const b = runSimulation({ ...input, seed: 777 });
    const c = runSimulation({ ...input, seed: 778 });

    expect(a.equitySum).toBe(b.equitySum);
    expect(a.equitySum).not.toBe(c.equitySum);
  });

  it('addiert Teilergebnisse korrekt zusammen', () => {
    const input = { hole: hand('Ah Ad'), board: [], opponents: 1, iterations: 10_000 };
    const whole = runSimulation({ ...input, iterations: 20_000, seed: 1 });
    const merged = mergeTotals(
      runSimulation({ ...input, seed: 1 }),
      runSimulation({ ...input, seed: 1 }),
    );

    expect(merged.iterations).toBe(whole.iterations);
    // Zwei identisch geseedete Hälften ergeben genau das doppelte Zwischenergebnis.
    expect(merged.wins).toBe(2 * runSimulation({ ...input, seed: 1 }).wins);
  });

  it('meldet den Fortschritt in aufsteigender Reihenfolge bis zum Ende', () => {
    const reported: number[] = [];
    runSimulation(
      { hole: hand('Ah Ad'), board: [], opponents: 1, iterations: 5_000, seed: 3 },
      (done) => reported.push(done),
      1_000,
    );
    expect(reported[0]).toBe(1_000);
    expect(reported.at(-1)).toBe(5_000);
    expect([...reported].sort((a, b) => a - b)).toEqual(reported);
  });
});

describe('analyzeOuts', () => {
  it('erkennt alle neun Flush-Karten als Outs', () => {
    const hole = hand('7h 6h');
    const board = hand('Ah Kh 2c');
    const totals = runSimulation({ hole, board, opponents: 3, iterations: 200_000, seed: 555 });
    const unknown = unknownCards([...hole, ...board]);
    const analysis = analyzeOuts(totals, toBreakdown(totals).equity, unknown, 2);

    const hearts = unknown.filter((c) => cardSuit(c) === 2);
    expect(hearts).toHaveLength(9);

    const outCards = new Set(analysis.outs.map((o) => o.card));
    for (const heart of hearts) {
      expect(outCards.has(heart), `Herz-Karte ${heart} fehlt in den Outs`).toBe(true);
    }
    expect(analysis.reliable).toBe(true);
  });

  it('markiert Karten, die dem Gegner helfen, als gefährlich', () => {
    // Top Pair auf einem Board mit drei Karo – jede weitere Karo-Karte ist schlecht für uns.
    const hole = hand('As Kc');
    const board = hand('Ac 8d 4d');
    const totals = runSimulation({ hole, board, opponents: 4, iterations: 200_000, seed: 31 });
    const unknown = unknownCards([...hole, ...board]);
    const analysis = analyzeOuts(totals, toBreakdown(totals).equity, unknown, 2);

    expect(analysis.dangerous.length).toBeGreaterThan(0);
    // Die gefährlichsten Karten sind überwiegend Karo.
    const topDanger = analysis.dangerous.slice(0, 5);
    expect(topDanger.filter((i) => cardSuit(i.card) === 1).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Outs-Hilfsrechnungen', () => {
  it('rechnet die exakte Trefferwahrscheinlichkeit für neun Outs aus', () => {
    // Flush Draw am Flop: 1 - (38/47 × 37/46) ≈ 35 %.
    expect(hitProbability(9, 47, 2)).toBeCloseTo(0.35, 2);
    // Am Turn bleibt nur eine Karte: 9/46 ≈ 19,6 %.
    expect(hitProbability(9, 46, 1)).toBeCloseTo(0.196, 3);
  });

  it('bildet die 2-und-4-Regel als Näherung ab', () => {
    expect(ruleOfTwoAndFour(9, 2)).toBeCloseTo(0.36, 5);
    expect(ruleOfTwoAndFour(9, 1)).toBeCloseTo(0.18, 5);
    expect(ruleOfTwoAndFour(9, 0)).toBe(0);
  });
});
