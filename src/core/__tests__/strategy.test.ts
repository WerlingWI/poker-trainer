import { describe, expect, it } from 'vitest';
import { parseCard, type Card } from '../cards';
import { HandCategory } from '../evaluator';
import { computeOdds } from '../odds';
import {
  betOptions,
  buildPlan,
  computeImpliedOdds,
  preflopAdvice,
  type PlanInput,
} from '../strategy';

function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => parseCard(t) as Card);
}

function plan(overrides: Partial<PlanInput>) {
  const base: PlanInput = {
    equity: 0.5,
    odds: computeOdds(0.5, { pot: 100, call: 50, stack: 500 }),
    pot: 100,
    call: 50,
    stack: 500,
    madeCategory: null,
    hasDraw: false,
    hasBlocker: false,
  };
  const input = { ...base, ...overrides };
  return buildPlan({ ...input, odds: computeOdds(input.equity, { pot: input.pot, call: input.call, stack: input.stack }) });
}

describe('Implied Odds', () => {
  it('rechnet aus, wie viel später noch gewonnen werden muss', () => {
    // 20 % Gewinnchance, Pot 100, Call 50 → 50/0,2 − 50 − 100 = 100 Chips.
    const implied = computeImpliedOdds(0.2, 100, 50, 500);
    expect(implied?.needed).toBeCloseTo(100, 6);
    expect(implied?.feasible).toBe(true);
    expect(implied?.alreadyProfitable).toBe(false);
  });

  it('erkennt, wenn der Call schon ohne Implied Odds profitabel ist', () => {
    // 35 % Trefferchance bei 3:1 Pot Odds – der Call steht für sich.
    const implied = computeImpliedOdds(0.35, 150, 50, 500);
    expect(implied?.alreadyProfitable).toBe(true);
    expect(implied?.needed).toBe(0);
  });

  it('erkennt, wenn im Stack gar nicht mehr genug liegt', () => {
    const implied = computeImpliedOdds(0.1, 100, 50, 70);
    expect(implied?.needed).toBeGreaterThan(available(implied));
    expect(implied?.feasible).toBe(false);
  });

  it('liefert ohne Einsatz oder ohne Trefferchance nichts', () => {
    expect(computeImpliedOdds(0.2, 100, 0, 500)).toBeNull();
    expect(computeImpliedOdds(0, 100, 50, 500)).toBeNull();
  });
});

function available(implied: ReturnType<typeof computeImpliedOdds>): number {
  return implied ? implied.available : 0;
}

describe('Einsatzhöhen', () => {
  it('rechnet die nötige Fold Equity je Größe aus', () => {
    const options = betOptions(100, 500);
    const halfPot = options.find((o) => o.fraction === 0.5);
    // 50 in einen Pot von 100: 50 / 150 = 33,3 %.
    expect(halfPot?.size).toBe(50);
    expect(halfPot?.requiredFoldEquity).toBeCloseTo(1 / 3, 6);

    const potBet = options.find((o) => o.fraction === 1);
    expect(potBet?.requiredFoldEquity).toBeCloseTo(0.5, 6);
  });

  it('deckelt jede Größe auf den Stack', () => {
    for (const option of betOptions(500, 60)) {
      expect(option.size).toBeLessThanOrEqual(60);
    }
  });
});

describe('Spielplan', () => {
  it('empfiehlt ohne Einsatz einen Value Bet bei starker Hand', () => {
    const result = plan({ call: 0, equity: 0.82, madeCategory: HandCategory.FullHouse });
    expect(result.kind).toBe('value-bet');
    expect(result.suggested?.fraction).toBe(1);
  });

  it('empfiehlt bei knapper Führung einen dünnen Value Bet', () => {
    const result = plan({ call: 0, equity: 0.54, madeCategory: HandCategory.Pair });
    expect(result.kind).toBe('thin-value');
    expect(result.suggested?.fraction).toBe(0.33);
  });

  it('erkennt einen Bluff-Kandidaten mit Draw', () => {
    const result = plan({ call: 0, equity: 0.3, hasDraw: true });
    expect(result.kind).toBe('bluff');
    expect(result.detail).toMatch(/folden/);
  });

  it('hält den Pot klein, wenn nichts da ist', () => {
    const result = plan({ call: 0, equity: 0.25 });
    expect(result.kind).toBe('pot-control');
  });

  it('empfiehlt gegen einen Einsatz mit sehr starker Hand eine Erhöhung', () => {
    const result = plan({ equity: 0.85, madeCategory: HandCategory.Flush });
    expect(result.kind).toBe('value-bet');
    expect(result.title).toBe('Value Raise');
  });

  it('erkennt einen Bluff Catch mit mittelmäßiger fertiger Hand', () => {
    // Benötigt werden 33,3 % – ein Paar mit 40 % ist ein klassischer Bluff Catch.
    const result = plan({ equity: 0.4, madeCategory: HandCategory.Pair });
    expect(result.kind).toBe('bluff-catch');
  });

  it('verweist bei einem zu teuren Draw auf die Implied Odds', () => {
    const result = plan({ equity: 0.2, hasDraw: true, madeCategory: HandCategory.HighCard });
    expect(result.kind).toBe('give-up');
    expect(result.detail).toMatch(/Implied Odds/);
  });

  it('empfiehlt ohne Draw und ohne Equity das Aufgeben', () => {
    const result = plan({ equity: 0.15, madeCategory: HandCategory.HighCard });
    expect(result.kind).toBe('give-up');
    expect(result.title).toBe('Aufgeben');
  });
});

describe('Preflop-Beratung nach Position', () => {
  it('spielt Premium-Hände aus jeder Position', () => {
    expect(preflopAdvice(hand('Ah As'), 'UTG')?.playable).toBe(true);
    expect(preflopAdvice(hand('Ah As'), 'BTN')?.playable).toBe(true);
  });

  it('erlaubt am Button mehr als unter der Pistole', () => {
    const marginal = hand('9h 8h');
    expect(preflopAdvice(marginal, 'UTG')?.playable).toBe(false);
    expect(preflopAdvice(marginal, 'BTN')?.playable).toBe(true);
  });

  it('nennt das Perzentil der eigenen Hand', () => {
    const advice = preflopAdvice(hand('Ah Kh'), 'CO');
    expect(advice?.percentile).toBeLessThan(0.04);
    expect(advice?.text).toMatch(/besten/);
  });

  it('liefert ohne vollständige Hand nichts', () => {
    expect(preflopAdvice(hand('Ah'), 'BTN')).toBeNull();
  });
});
