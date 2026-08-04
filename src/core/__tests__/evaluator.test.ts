import { describe, expect, it } from 'vitest';
import { parseCard, type Card } from '../cards';
import { HandCategory, describeHand, evaluate, scoreCategory, scoreLabel } from '../evaluator';
import { mulberry32 } from '../simulate';
import { compareOracle, evaluateBestHand, toOracleCard } from './oracle/handEvaluatorOracle';

/** Hilfsfunktion: "As Kh Qd Jc Ts" → Kartenindizes. */
function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => {
    const card = parseCard(t);
    if (card === null) throw new Error(`Ungültige Karte im Test: ${t}`);
    return card;
  });
}

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

describe('evaluate – bekannte Rankings', () => {
  it('erkennt den Royal Flush', () => {
    const cards = hand('As Ks Qs Js Ts 2h 3d');
    expect(scoreCategory(evaluate(cards, 7))).toBe(HandCategory.StraightFlush);
    expect(scoreLabel(evaluate(cards, 7))).toBe('Royal Flush');
  });

  it('erkennt die Wheel-Straße A-2-3-4-5 mit der Fünf als höchster Karte', () => {
    const wheel = evaluate(hand('Ah 2d 3c 4s 5h Kd Qc'), 7);
    const sixHigh = evaluate(hand('2d 3c 4s 5h 6h Kd Qc'), 7);
    expect(scoreCategory(wheel)).toBe(HandCategory.Straight);
    expect(sixHigh).toBeGreaterThan(wheel);
  });

  it('wertet den Straight Flush über den Vierling', () => {
    const straightFlush = evaluate(hand('5s 6s 7s 8s 9s 2h 2d'), 7);
    const quads = evaluate(hand('Ah Ad Ac As Kh Qd 2c'), 7);
    expect(straightFlush).toBeGreaterThan(quads);
  });

  it('entscheidet den Vierling über den Kicker', () => {
    const withAce = evaluate(hand('7h 7d 7c 7s Ah 2d 3c'), 7);
    const withKing = evaluate(hand('7h 7d 7c 7s Kh 2d 3c'), 7);
    expect(withAce).toBeGreaterThan(withKing);
  });

  it('entscheidet zwei Paare über den Kicker', () => {
    const better = evaluate(hand('Ah Ad Kh Kd Qs 2c 3h'), 7);
    const worse = evaluate(hand('Ah Ad Kh Kd Js 2c 3h'), 7);
    expect(better).toBeGreaterThan(worse);
  });

  it('vergleicht Flushes anhand aller fünf Karten', () => {
    const better = evaluate(hand('Ah Kh Qh Jh 9h 2d 3c'), 7);
    const worse = evaluate(hand('Ah Kh Qh Jh 8h 2d 3c'), 7);
    expect(better).toBeGreaterThan(worse);
  });

  it('erkennt gleich starke Hände als exakt gleich (Split Pot)', () => {
    // Beide Spieler nutzen dasselbe Board, die eigenen Karten spielen nicht mit.
    const a = evaluate(hand('2c 3d As Ks Qs Js Ts'), 7);
    const b = evaluate(hand('4c 5d As Ks Qs Js Ts'), 7);
    expect(a).toBe(b);
  });

  it('wertet das Full House über den Flush', () => {
    const fullHouse = evaluate(hand('9h 9d 9c 4s 4h Kd 2c'), 7);
    const flush = evaluate(hand('Ah Kh 9h 4h 2h Qd 3c'), 7);
    expect(fullHouse).toBeGreaterThan(flush);
  });
});

describe('evaluate – Abgleich mit dem Referenz-Evaluator aus poker-app', () => {
  it('liefert für 20.000 zufällige Sieben-Karten-Paare dieselbe Rangordnung', () => {
    const random = mulberry32(20_260_804);
    const deck = Array.from({ length: 52 }, (_, i) => i);
    let compared = 0;

    for (let round = 0; round < 20_000; round++) {
      // 14 Karten ziehen: zwei disjunkte Sieben-Karten-Hände.
      for (let i = 0; i < 14; i++) {
        const j = i + ((random() * (52 - i)) | 0);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const a = deck.slice(0, 7);
      const b = deck.slice(7, 14);

      const fast = sign(evaluate(a, 7) - evaluate(b, 7));
      const oracle = sign(
        compareOracle(evaluateBestHand(a.map(toOracleCard)), evaluateBestHand(b.map(toOracleCard))),
      );

      if (fast !== oracle) {
        throw new Error(
          `Abweichung bei Runde ${round}: schnell=${fast}, Orakel=${oracle}\n` +
            `A=${a.join(',')}\nB=${b.join(',')}`,
        );
      }
      compared++;
    }

    expect(compared).toBe(20_000);
  });

  it('stimmt auch bei Fünf-Karten-Händen mit dem Orakel überein', () => {
    const random = mulberry32(7);
    const deck = Array.from({ length: 52 }, (_, i) => i);

    for (let round = 0; round < 5_000; round++) {
      for (let i = 0; i < 10; i++) {
        const j = i + ((random() * (52 - i)) | 0);
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      const a = deck.slice(0, 5);
      const b = deck.slice(5, 10);

      expect(sign(evaluate(a, 5) - evaluate(b, 5))).toBe(
        sign(
          compareOracle(
            evaluateBestHand(a.map(toOracleCard)),
            evaluateBestHand(b.map(toOracleCard)),
          ),
        ),
      );
    }
  });
});

describe('describeHand', () => {
  it('gibt die fünf tatsächlich benutzten Karten zurück', () => {
    const result = describeHand(hand('As Ks Qs Js Ts 2h 3d'));
    expect(result.bestFive).toHaveLength(5);
    expect(result.bestFive.map((c) => c)).toEqual(hand('As Ks Qs Js Ts'));
    expect(result.label).toBe('Royal Flush');
  });

  it('beschreibt zwei Paare mit beiden Rängen', () => {
    const result = describeHand(hand('Qh Qd 8c 8s 3h 2d 5c'));
    expect(result.category).toBe(HandCategory.TwoPair);
    expect(result.detail).toBe('Zwei Paare, Damen und Achten');
  });

  it('beschreibt die Straße über die höchste Karte', () => {
    const result = describeHand(hand('9h 8d 7c 6s 5h 2d 2c'));
    expect(result.detail).toBe('Straße bis Neun');
  });
});
