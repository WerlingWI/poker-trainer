import { describe, expect, it } from 'vitest';
import { makeCard, parseCard, type Card } from '../cards';
import {
  NUM_HAND_CLASSES,
  PERCENTILE_OF_CLASS,
  RANKING,
  TOTAL_COMBOS,
  combosInClass,
  combosOfClass,
  handClassCode,
  handClassIndex,
  handClassOf,
} from '../handRanking';
import {
  defaultOpponentModel,
  rangeComboList,
  rangeCombos,
  rangeFromPercent,
  rangeFromStats,
  rangePercent,
  resolveRange,
  RANGE_PRESETS,
} from '../range';
import { runSimulation, toBreakdown } from '../simulate';

function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => parseCard(t) as Card);
}

describe('Handklassen', () => {
  it('deckt genau 169 Klassen und 1326 Kombinationen ab', () => {
    let combos = 0;
    const seen = new Set<string>();
    for (let i = 0; i < NUM_HAND_CLASSES; i++) {
      combos += combosInClass(i);
      expect(combosOfClass(i)).toHaveLength(combosInClass(i));
      seen.add(handClassCode(i));
    }
    expect(combos).toBe(TOTAL_COMBOS);
    expect(seen.size).toBe(NUM_HAND_CLASSES);
    expect(RANKING).toHaveLength(NUM_HAND_CLASSES);
    expect(new Set(RANKING).size).toBe(NUM_HAND_CLASSES);
  });

  it('ordnet Karten der richtigen Klasse zu', () => {
    expect(handClassCode(handClassOf(hand('Ah As')))).toBe('AA');
    expect(handClassCode(handClassOf(hand('Ah Kh')))).toBe('AKs');
    expect(handClassCode(handClassOf(hand('Kd Ah')))).toBe('AKo');
    expect(handClassCode(handClassOf(hand('7c 2d')))).toBe('72o');
  });

  it('erzeugt für jede Klasse ausschließlich passende Kombinationen', () => {
    for (let i = 0; i < NUM_HAND_CLASSES; i++) {
      for (const [a, b] of combosOfClass(i)) {
        expect(a).not.toBe(b);
        expect(handClassOf([a, b])).toBe(i);
      }
    }
  });

  it('setzt die Paare auf die Diagonale', () => {
    expect(handClassIndex(12, 12, false)).toBe(12 * 13 + 12);
    expect(handClassIndex(12, 11, true)).toBe(12 * 13 + 11);
    expect(handClassIndex(12, 11, false)).toBe(11 * 13 + 12);
  });
});

describe('Rangliste', () => {
  it('führt die Asse an und die Sieben-Zwei offsuit ans Ende', () => {
    expect(handClassCode(RANKING[0])).toBe('AA');
    expect(handClassCode(RANKING[1])).toBe('KK');
    expect(handClassCode(RANKING[RANKING.length - 1])).toBe('32o');
  });

  it('stimmt noch mit der Engine überein – die Equity fällt über die Liste hinweg', () => {
    // Die Tabelle wurde aus genau dieser Simulation erzeugt (300k pro Klasse).
    // Hier wird mit gröberer Auflösung nachgerechnet: über je zehn Plätze hinweg
    // muss die Equity monoton fallen, sonst passt die Tabelle nicht mehr.
    const equities = RANKING.filter((_, position) => position % 10 === 0).map((classIndex) => {
      const [a, b] = combosOfClass(classIndex)[0];
      const totals = runSimulation({
        hole: [a, b],
        board: [],
        opponents: 1,
        iterations: 60_000,
        seed: 4242 + classIndex,
      });
      return toBreakdown(totals).equity;
    });

    for (let i = 1; i < equities.length; i++) {
      expect(
        equities[i],
        `Platz ${i * 10} ist stärker als Platz ${(i - 1) * 10}`,
      ).toBeLessThan(equities[i - 1]);
    }
  });

  it('gibt AA das beste und 32o das schlechteste Perzentil', () => {
    expect(PERCENTILE_OF_CLASS[handClassOf(hand('Ah As'))]).toBeCloseTo(6 / 1326, 6);
    expect(PERCENTILE_OF_CLASS[handClassOf(hand('3h 2d'))]).toBeCloseTo(1, 6);
  });
});

describe('Ranges', () => {
  it('trifft die gewünschte Breite ungefähr', () => {
    for (const percent of [0.05, 0.15, 0.3, 0.5]) {
      const actual = rangePercent(rangeFromPercent(percent));
      // Ranges springen in Klassen-Schritten, deshalb eine Toleranz von 3 Punkten.
      expect(Math.abs(actual - percent)).toBeLessThan(0.03);
    }
  });

  it('enthält bei einer engen Range nur Premium-Hände', () => {
    const range = rangeFromPercent(0.03);
    expect(range[handClassOf(hand('Ah As'))]).toBe(1);
    expect(range[handClassOf(hand('Kh Ks'))]).toBe(1);
    expect(range[handClassOf(hand('7h 2d'))]).toBe(0);
    expect(range[handClassOf(hand('9h 8h'))]).toBe(0);
  });

  it('erzeugt eine Kombo-Liste passender Länge ohne Dopplungen', () => {
    const range = rangeFromPercent(0.1);
    const list = rangeComboList(range);
    expect(list.length).toBe(rangeCombos(range));
    expect(new Set(list).size).toBe(list.length);
    for (const encoded of list) {
      const a = Math.floor(encoded / 52);
      const b = encoded % 52;
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(52);
      expect(range[handClassOf([a, b])]).toBe(1);
    }
  });

  it('leitet aus Gegner-Stats plausible Breiten ab', () => {
    const stats = { vpip: 28, pfr: 18, threeBet: 6, ats: 35 };
    expect(rangeFromStats(stats, 'open').percent).toBeCloseTo(0.18, 5);
    expect(rangeFromStats(stats, 'steal').percent).toBeCloseTo(0.35, 5);
    expect(rangeFromStats(stats, 'threeBet').percent).toBeCloseTo(0.06, 5);
    expect(rangeFromStats(stats, 'unknown').percent).toBeCloseTo(0.28, 5);
    // Limp = VPIP minus PFR.
    expect(rangeFromStats(stats, 'limp').percent).toBeCloseTo(0.1, 5);
  });

  it('deckelt PFR auf VPIP – niemand erhöht öfter, als er überhaupt mitspielt', () => {
    const stats = { vpip: 15, pfr: 40, threeBet: 5, ats: 20 };
    expect(rangeFromStats(stats, 'open').percent).toBeCloseTo(0.15, 5);
  });

  it('löst jedes Gegnermodell in eine nutzbare Range auf', () => {
    expect(rangePercent(resolveRange(defaultOpponentModel()).range)).toBe(1);

    for (const preset of RANGE_PRESETS) {
      const resolved = resolveRange({ ...defaultOpponentModel(), mode: 'preset', presetKey: preset.key });
      expect(rangeCombos(resolved.range)).toBeGreaterThan(0);
    }

    const custom = resolveRange({
      ...defaultOpponentModel(),
      mode: 'custom',
      custom: [handClassOf(hand('Ah As'))],
    });
    expect(rangeCombos(custom.range)).toBe(6);
  });
});

describe('Simulation gegen eine Range', () => {
  it('senkt die Equity, wenn der Gegner nur Premium-Hände spielt', () => {
    const premium = rangeComboList(rangeFromPercent(0.03));

    // Asse bleiben auch gegen eine enge Range stark, verlieren aber Equity.
    const aces = hand('Ah Ad');
    const acesRandom = toBreakdown(
      runSimulation({ hole: aces, board: [], opponents: 1, iterations: 100_000, seed: 5 }),
    ).equity;
    const acesVsPremium = toBreakdown(
      runSimulation({
        hole: aces,
        board: [],
        opponents: 1,
        iterations: 100_000,
        seed: 5,
        rangeCombos: premium,
      }),
    ).equity;
    expect(acesRandom).toBeGreaterThan(0.84);
    expect(acesVsPremium).toBeLessThan(acesRandom - 0.03);

    // Eine mittelmäßige Hand bricht gegen dieselbe Range dagegen völlig ein.
    const broadway = hand('Ah Qd');
    const broadwayRandom = toBreakdown(
      runSimulation({ hole: broadway, board: [], opponents: 1, iterations: 100_000, seed: 6 }),
    ).equity;
    const broadwayVsPremium = toBreakdown(
      runSimulation({
        hole: broadway,
        board: [],
        opponents: 1,
        iterations: 100_000,
        seed: 6,
        rangeCombos: premium,
      }),
    ).equity;
    expect(broadwayRandom).toBeGreaterThan(0.6);
    expect(broadwayVsPremium).toBeLessThan(0.4);
  });

  it('hebt die Equity einer schwachen Hand, wenn der Gegner sehr weit spielt', () => {
    const hole = hand('9h 8h');
    const vsTight = runSimulation({
      hole,
      board: [],
      opponents: 1,
      iterations: 100_000,
      seed: 9,
      rangeCombos: rangeComboList(rangeFromPercent(0.05)),
    });
    const vsLoose = runSimulation({
      hole,
      board: [],
      opponents: 1,
      iterations: 100_000,
      seed: 9,
      rangeCombos: rangeComboList(rangeFromPercent(0.8)),
    });

    expect(toBreakdown(vsLoose).equity).toBeGreaterThan(toBreakdown(vsTight).equity + 0.05);
  });

  it('teilt einer Range niemals Karten aus, die schon vergeben sind', () => {
    // Der Gegner spielt ausschließlich Asse – wir halten selbst zwei davon.
    const onlyAces = resolveRange({
      ...defaultOpponentModel(),
      mode: 'custom',
      custom: [handClassOf([makeCard(12, 0), makeCard(12, 1)])],
    }).range;

    const totals = runSimulation({
      hole: [makeCard(12, 0), makeCard(12, 1)],
      board: [],
      opponents: 1,
      iterations: 5_000,
      seed: 3,
      rangeCombos: rangeComboList(onlyAces),
    });

    // Ihm bleibt nur das eine Ass-Paar aus den beiden Assen, die wir nicht halten.
    // Fast immer ein Split – außer das Board bringt vier Karten einer Farbe,
    // dann entscheidet, wer das passende Ass hält. Die Lage ist dabei symmetrisch.
    expect(totals.iterations).toBe(5_000);
    const result = toBreakdown(totals);
    expect(result.tie).toBeGreaterThan(0.93);
    expect(Math.abs(totals.wins - totals.losses)).toBeLessThan(60);
  });

  it('bricht sauber ab, wenn die Range für so viele Gegner zu eng ist', () => {
    const totals = runSimulation({
      hole: hand('7h 2d'),
      board: [],
      opponents: 9,
      iterations: 2_000,
      seed: 11,
      // Nur Asse: neun Gegner können daraus unmöglich alle eine Hand bekommen.
      rangeCombos: rangeComboList(rangeFromPercent(0.005)),
    });
    expect(totals.aborted).toBe(true);
    expect(totals.iterations).toBeLessThan(2_000);
  });
});
