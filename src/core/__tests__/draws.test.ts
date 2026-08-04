import { describe, expect, it } from 'vitest';
import { parseCard, type Card } from '../cards';
import { analyzeDraws } from '../draws';

function hand(text: string): Card[] {
  return text.split(/\s+/).map((t) => parseCard(t) as Card);
}

function keys(hole: string, board: string): string[] {
  return analyzeDraws(hand(hole), hand(board)).map((d) => d.key);
}

function find(hole: string, board: string, key: string) {
  return analyzeDraws(hand(hole), hand(board)).find((d) => d.key === key);
}

describe('analyzeDraws', () => {
  it('liefert vor dem Flop nichts', () => {
    expect(analyzeDraws(hand('Ah Kh'), [])).toHaveLength(0);
  });

  it('erkennt den Flush Draw mit neun Outs', () => {
    const draw = find('7h 6h', 'Ah Kh 2c', 'flush-draw');
    expect(draw?.outs).toBe(9);
  });

  it('erkennt den Nut Flush Draw', () => {
    expect(keys('Ah 6h', 'Kh 7h 2c')).toContain('nut-flush-draw');
    // Mit der Sechs statt dem Ass ist es kein Nut Draw mehr.
    expect(keys('6h 5h', 'Kh 7h 2c')).toContain('flush-draw');
  });

  it('ignoriert einen Flush Draw, der allein auf dem Board liegt', () => {
    expect(keys('As Kc', 'Qh 7h 2h')).not.toContain('flush-draw');
  });

  it('erkennt den Open Ended Straight Draw mit acht Outs', () => {
    const draw = find('9h 8d', '7c 6s 2h', 'oesd');
    expect(draw?.outs).toBe(8);
  });

  it('erkennt den Gutshot mit vier Outs', () => {
    const draw = find('9h 8d', '6c 5s 2h', 'gutshot');
    expect(draw?.outs).toBe(4);
  });

  it('unterscheidet den doppelten Gutshot vom Open End', () => {
    // 5-7-8-9-J: die Sechs und die Zehn vervollständigen je eine Straße,
    // aber es liegen keine vier Karten in Folge.
    const result = keys('9h 8d', 'Jc 7s 5h');
    expect(result).toContain('double-gutshot');
    expect(result).not.toContain('oesd');
    expect(find('9h 8d', 'Jc 7s 5h', 'double-gutshot')?.outs).toBe(8);
  });

  it('meldet keinen Straight Draw, wenn die Straße schon fertig ist', () => {
    const result = keys('9h 8d', '7c 6s 5h');
    expect(result).not.toContain('oesd');
    expect(result).not.toContain('gutshot');
  });

  it('meldet keinen Straight Draw, der nur aus Boardkarten besteht', () => {
    expect(keys('Ah 2d', '7c 8s 9h')).not.toContain('oesd');
  });

  it('erkennt Overcards ohne Treffer', () => {
    const draw = find('Ah Kd', '7c 5s 2h', 'overcards');
    expect(draw?.label).toBe('Zwei Overcards');
    expect(draw?.outs).toBe(6);
  });

  it('nennt keine Overcards, wenn die Hand bereits ein Paar getroffen hat', () => {
    expect(keys('Ah Kd', 'Ac 5s 2h')).not.toContain('overcards');
  });

  it('erkennt den Nut-Flush-Blocker', () => {
    expect(keys('Ah Kd', 'Qh 7h 2c')).toContain('flush-blocker');
  });

  it('beschreibt die fertige Hand und unterscheidet Set von Trips', () => {
    const set = find('7h 7d', '7c Ks 2h', 'made-hand');
    expect(set?.label).toBe('Set');
    const trips = find('7h Ad', '7c 7s 2h', 'made-hand');
    expect(trips?.label).toBe('Trips');
  });

  it('erkennt den Backdoor Flush Draw nur am Flop', () => {
    expect(keys('Ah 6h', 'Kh 7d 2c')).toContain('backdoor-flush');
    expect(keys('Ah 6h', 'Kh 7d 2c 3s')).not.toContain('backdoor-flush');
  });
});
