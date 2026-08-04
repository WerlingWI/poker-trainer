import { describe, expect, it } from 'vitest';
import { computeOdds, formatRatio, recommend } from '../odds';
import { classifyHand, handCode } from '../handClass';
import { defaultSpot, heroPosition, streetOf } from '../types';
import { parseCard, type Card } from '../cards';

function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => parseCard(t) as Card);
}

describe('computeOdds', () => {
  it('rechnet die benötigte Equity aus Pot und Call', () => {
    // 50 in einen Pot von 100 zu zahlen heißt: 50 von 150 ⇒ 33,3 %.
    const odds = computeOdds(0.5, { pot: 100, call: 50, stack: 500 });
    expect(odds.requiredEquity).toBeCloseTo(1 / 3, 6);
    expect(odds.ratio).toBe(2);
    expect(formatRatio(odds.ratio)).toBe('2,0 : 1');
  });

  it('berechnet den EV eines Calls', () => {
    // 50 % Equity auf einen Pot von 150 nach dem Call: 0,5 × 150 − 50 = +25.
    expect(computeOdds(0.5, { pot: 100, call: 50, stack: 500 }).ev).toBeCloseTo(25, 6);
    // Ohne ausreichende Equity wird der EV negativ.
    expect(computeOdds(0.2, { pot: 100, call: 50, stack: 500 }).ev).toBeCloseTo(-20, 6);
  });

  it('deckelt den Call auf den effektiven Stack', () => {
    const odds = computeOdds(0.5, { pot: 100, call: 500, stack: 80 });
    expect(odds.effectiveCall).toBe(80);
    expect(odds.isAllIn).toBe(true);
    expect(odds.requiredEquity).toBeCloseTo(80 / 180, 6);
  });

  it('liefert bei einem Call von 0 keine geforderte Equity', () => {
    const odds = computeOdds(0.4, { pot: 100, call: 0, stack: 200 });
    expect(odds.requiredEquity).toBe(0);
    expect(odds.spr).toBe(2);
  });
});

describe('recommend', () => {
  const spot = { pot: 100, call: 50, stack: 500 };

  it('empfiehlt Fold, wenn die Equity klar unter den Pot Odds liegt', () => {
    const rec = recommend(0.2, computeOdds(0.2, spot));
    expect(rec.action).toBe('FOLD');
    expect(rec.tone).toBe('negative');
  });

  it('empfiehlt Call, wenn die Equity klar über den Pot Odds liegt', () => {
    const rec = recommend(0.45, computeOdds(0.45, spot));
    expect(rec.action).toBe('CALL');
  });

  it('empfiehlt Erhöhen bei sehr hoher Equity', () => {
    expect(recommend(0.8, computeOdds(0.8, spot)).action).toBe('RAISE');
  });

  it('nennt knappe Fälle beim Namen, statt eine Entscheidung vorzutäuschen', () => {
    // Benötigt werden 33,3 % – 34 % liegt innerhalb der Sicherheitszone.
    expect(recommend(0.34, computeOdds(0.34, spot)).action).toBe('MARGINAL');
  });

  it('empfiehlt Check statt Fold, wenn nichts zu zahlen ist', () => {
    const free = { pot: 100, call: 0, stack: 500 };
    expect(recommend(0.2, computeOdds(0.2, free)).action).toBe('CHECK');
    expect(recommend(0.8, computeOdds(0.8, free)).action).toBe('RAISE');
  });

  it('begründet jede Empfehlung mit konkreten Zahlen', () => {
    const rec = recommend(0.45, computeOdds(0.45, spot));
    expect(rec.reason).toMatch(/45[,.]0 %/);
    expect(rec.reason).toMatch(/33[,.]3 %/);
  });
});

describe('Handklassen', () => {
  it('erkennt Pocket Pairs', () => {
    expect(classifyHand(hand('7h 7d')).key).toBe('pocket-pair');
    expect(handCode(hand('7h 7d'))).toBe('77');
  });

  it('unterscheidet suited und offsuit', () => {
    expect(handCode(hand('Ah Kh'))).toBe('AKs');
    expect(handCode(hand('Ah Kd'))).toBe('AKo');
    expect(classifyHand(hand('Ah Kh')).key).toBe('suited-ace');
    expect(classifyHand(hand('Kh Qh')).key).toBe('suited-broadway');
    expect(classifyHand(hand('8h 7h')).key).toBe('suited-connector');
    expect(classifyHand(hand('Kd Qh')).key).toBe('offsuit-broadway');
    expect(classifyHand(hand('Ad 4h')).key).toBe('offsuit-ace');
    expect(classifyHand(hand('9d 4h')).key).toBe('offsuit-other');
  });
});

describe('Tisch-Ableitungen', () => {
  it('benennt die Straße nach der Anzahl Boardkarten', () => {
    expect(streetOf(0)).toBe('preflop');
    expect(streetOf(3)).toBe('flop');
    expect(streetOf(4)).toBe('turn');
    expect(streetOf(5)).toBe('river');
  });

  it('leitet die eigene Position aus dem Dealerplatz ab', () => {
    // Hero sitzt auf Platz 0.
    expect(heroPosition(6, 0).key).toBe('BTN'); // Hero ist selbst Dealer
    expect(heroPosition(6, 5).key).toBe('SB'); // Dealer sitzt direkt vor Hero
    expect(heroPosition(6, 4).key).toBe('BB');
    expect(heroPosition(6, 1).key).toBe('CO'); // Dealer sitzt direkt hinter Hero
    expect(heroPosition(6, 2).key).toBe('HJ');
    expect(heroPosition(9, 6).key).toBe('UTG');
    expect(heroPosition(2, 0).key).toBe('BTN');
    expect(heroPosition(2, 1).key).toBe('SB');
  });

  it('liefert einen sinnvollen Standard-Spot', () => {
    const spot = defaultSpot();
    expect(spot.players).toBeGreaterThanOrEqual(2);
    expect(spot.pot).toBeGreaterThan(0);
    expect(spot.hole).toHaveLength(0);
  });
});
