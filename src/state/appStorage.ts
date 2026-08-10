/**
 * Alles, was die App lokal speichert: Einstellungen, Statistik, Hand-History.
 * Ein einziger Schlüssel, eine Version – Migration ist dadurch trivial.
 */

import type { Card } from '../core/cards';
import { defaultClockConfig, type ClockConfig } from '../core/clock';
import { HAND_CLASS_ORDER, classifyHand, handCode, type HandClassKey } from '../core/handClass';
import { occupiedSeatsInOrder } from '../core/table';
import type { SpotState } from '../core/types';

export const STORAGE_KEY = 'pokerTrainer';
export const STORAGE_VERSION = 1;

export type ThemeName = 'dark' | 'light';

export interface ClassStat {
  count: number;
  equitySum: number;
}

export interface LearnStat {
  answered: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

export interface HistoryEntry {
  id: string;
  at: number;
  hole: Card[];
  board: Card[];
  players: number;
  pot: number;
  call: number;
  stack: number;
  equity: number;
  code: string;
  favorite: boolean;
}

export interface AppState {
  theme: ThemeName;
  sound: boolean;
  iterations: number;
  /** Kompakter Kartenwähler (erst Farbe, dann Wert) statt des 52er-Grids. */
  compactPicker: boolean;
  handsAnalyzed: number;
  equitySum: number;
  byClass: Record<HandClassKey, ClassStat>;
  handCounts: Record<string, number>;
  learn: LearnStat;
  history: HistoryEntry[];
  /** Reaktionszeit + Timebank-Vorrat für die Shot-Clock. Die Spielerliste selbst ist nicht persistiert. */
  clock: ClockConfig;
}

export const MAX_HISTORY = 50;

export function defaultAppState(): AppState {
  const byClass = {} as Record<HandClassKey, ClassStat>;
  for (const key of HAND_CLASS_ORDER) byClass[key] = { count: 0, equitySum: 0 };

  return {
    theme: 'dark',
    sound: false,
    iterations: 100_000,
    // Auf schmalen Displays ist der zweistufige Wähler angenehmer, auf großen
    // passt das 52er-Raster bequem hin. Danach entscheidet der Nutzer selbst.
    compactPicker: globalThis.matchMedia?.('(max-width: 640px)').matches ?? false,
    handsAnalyzed: 0,
    equitySum: 0,
    byClass,
    handCounts: {},
    learn: { answered: 0, correct: 0, streak: 0, bestStreak: 0 },
    history: [],
    clock: defaultClockConfig(),
  };
}

/**
 * Verbucht eine fertig gerechnete Hand in Statistik und History.
 * Wird nur einmal pro abgeschlossener Simulation aufgerufen.
 */
export function recordHand(state: AppState, spot: SpotState, equity: number): AppState {
  const code = handCode(spot.hole);
  const classKey = classifyHand(spot.hole).key;
  const previous = state.byClass[classKey] ?? { count: 0, equitySum: 0 };

  const entry: HistoryEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    hole: [...spot.hole],
    board: [...spot.board],
    players: occupiedSeatsInOrder(spot.seats).length,
    pot: spot.pot,
    call: spot.call,
    stack: spot.stack,
    equity,
    code,
    favorite: false,
  };

  // Favoriten bleiben erhalten, auch wenn die History überläuft.
  const favorites = state.history.filter((h) => h.favorite);
  const others = state.history.filter((h) => !h.favorite);
  const history = [entry, ...favorites, ...others].slice(0, MAX_HISTORY);

  return {
    ...state,
    handsAnalyzed: state.handsAnalyzed + 1,
    equitySum: state.equitySum + equity,
    byClass: {
      ...state.byClass,
      [classKey]: { count: previous.count + 1, equitySum: previous.equitySum + equity },
    },
    handCounts: { ...state.handCounts, [code]: (state.handCounts[code] ?? 0) + 1 },
    history,
  };
}

export function toggleFavorite(state: AppState, id: string): AppState {
  return {
    ...state,
    history: state.history.map((h) => (h.id === id ? { ...h, favorite: !h.favorite } : h)),
  };
}

export function removeHistoryEntry(state: AppState, id: string): AppState {
  return { ...state, history: state.history.filter((h) => h.id !== id) };
}

export function recordAnswer(state: AppState, correct: boolean): AppState {
  const streak = correct ? state.learn.streak + 1 : 0;
  return {
    ...state,
    learn: {
      answered: state.learn.answered + 1,
      correct: state.learn.correct + (correct ? 1 : 0),
      streak,
      bestStreak: Math.max(state.learn.bestStreak, streak),
    },
  };
}

/** Durchschnittliche Equity über alle analysierten Hände. */
export function averageEquity(state: AppState): number {
  return state.handsAnalyzed ? state.equitySum / state.handsAnalyzed : 0;
}

/** Die häufigsten Hände, absteigend – "Lieblingshände" in der Statistik. */
export function favouriteHands(state: AppState, limit = 6): Array<[string, number]> {
  return Object.entries(state.handCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}
