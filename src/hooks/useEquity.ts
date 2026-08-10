/**
 * Startet die Monte-Carlo-Simulation in mehreren Web Workern und liefert
 * Fortschritt und Ergebnis an die Oberfläche.
 *
 * Der Lauf startet automatisch, sobald eine vollständige Hand eingegeben ist –
 * es gibt bewusst keinen "Berechnen"-Button. Eine Änderung während eines Laufs
 * bricht diesen sofort ab (Worker werden terminiert), damit nie ein veraltetes
 * Ergebnis angezeigt wird.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  emptyTotals,
  mergeTotals,
  toBreakdown,
  type EquityBreakdown,
  type SimInput,
  type SimTotals,
} from '../core/simulate';
import { isFullRange, rangeComboList, resolveRange } from '../core/range';
import { isSpotReady, opponentCount, type SpotState } from '../core/types';
import type { WorkerOutMessage, WorkerRunMessage } from '../workers/equity.worker';

/** Ein Kern bleibt für die Oberfläche frei; mehr als sechs Worker bringen kaum noch etwas. */
const WORKER_COUNT = Math.max(
  1,
  Math.min((globalThis.navigator?.hardwareConcurrency ?? 4) - 1, 6),
);

/** Wartezeit nach der letzten Eingabe, bevor gerechnet wird. */
const DEBOUNCE_MS = 220;

export interface EquityState {
  totals: SimTotals | null;
  breakdown: EquityBreakdown | null;
  /** 0..1 – speist den Ladebalken. */
  progress: number;
  running: boolean;
  durationMs: number;
  error: string | null;
  workers: number;
}

const IDLE: EquityState = {
  totals: null,
  breakdown: null,
  progress: 0,
  running: false,
  durationMs: 0,
  error: null,
  workers: WORKER_COUNT,
};

function createWorker(): Worker {
  return new Worker(new URL('../workers/equity.worker.ts', import.meta.url), { type: 'module' });
}

export function useEquity(spot: SpotState, iterations: number) {
  const [state, setState] = useState<EquityState>(IDLE);
  const workersRef = useRef<Worker[]>([]);
  const runIdRef = useRef(0);
  const [nonce, setNonce] = useState(0);

  const holeKey = spot.hole.join(',');
  const boardKey = spot.board.join(',');
  const opponents = opponentCount(spot);
  // Ohne Gegner gibt es nichts zu simulieren – der Pot geht kampflos an Hero,
  // das zeigt die Oberfläche direkt an, statt eine leere Rechnung zu starten.
  const ready = isSpotReady(spot) && spot.hole.length === 2 && opponents > 0;
  const opponentKey = JSON.stringify(spot.opponent);

  const input = useMemo<Omit<SimInput, 'seed' | 'iterations'> | null>(() => {
    if (!ready) return null;

    // Eine volle Range entspricht "zufällige Karten" – dann bleibt der schnellere
    // Weg ohne Kombo-Ziehung aktiv.
    const { range } = resolveRange(JSON.parse(opponentKey));
    const rangeCombos = isFullRange(range) ? undefined : rangeComboList(range);
    // Leere Range: es gibt nichts zu simulieren, die Oberfläche weist darauf hin.
    if (rangeCombos && rangeCombos.length === 0) return null;

    return {
      hole: holeKey.split(',').map(Number),
      board: boardKey ? boardKey.split(',').map(Number) : [],
      opponents,
      rangeCombos,
    };
    // holeKey/boardKey/opponentKey sind Strings und damit stabile Abhängigkeiten.
  }, [ready, holeKey, boardKey, opponents, opponentKey]);

  const stopWorkers = useCallback(() => {
    for (const worker of workersRef.current) worker.terminate();
    workersRef.current = [];
  }, []);

  useEffect(() => {
    if (!input) {
      stopWorkers();
      setState(IDLE);
      return;
    }

    const timer = setTimeout(() => {
      stopWorkers();

      const runId = ++runIdRef.current;
      const startedAt = performance.now();
      const workerCount = Math.min(WORKER_COUNT, Math.max(1, Math.floor(iterations / 5_000)));
      const share = Math.floor(iterations / workerCount);
      const progressPerWorker = new Array<number>(workerCount).fill(0);
      const merged = emptyTotals();
      let finished = 0;

      setState({ ...IDLE, running: true, workers: workerCount });

      for (let i = 0; i < workerCount; i++) {
        // Die letzte Portion bekommt den Rest, damit die Summe exakt stimmt.
        const portion = i === workerCount - 1 ? iterations - share * (workerCount - 1) : share;
        const worker = createWorker();
        workersRef.current.push(worker);

        worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
          const message = event.data;
          if (message.runId !== runIdRef.current) return; // Antwort eines abgebrochenen Laufs.

          if (message.type === 'progress') {
            progressPerWorker[i] = message.done;
            const done = progressPerWorker.reduce((a, b) => a + b, 0);
            setState((prev) => (prev.running ? { ...prev, progress: done / iterations } : prev));
            return;
          }

          if (message.type === 'error') {
            stopWorkers();
            setState({ ...IDLE, error: message.message });
            return;
          }

          mergeTotals(merged, message.totals);
          finished++;
          if (finished === workerCount) {
            stopWorkers();
            setState({
              totals: merged,
              breakdown: toBreakdown(merged),
              progress: 1,
              running: false,
              durationMs: performance.now() - startedAt,
              error: null,
              workers: workerCount,
            });
          }
        };

        const message: WorkerRunMessage = {
          type: 'run',
          runId,
          input: {
            ...input,
            iterations: portion,
            // Unterschiedlicher Seed pro Worker und pro Lauf.
            seed: (runId * 0x9e3779b1 + i * 0x85ebca6b + Date.now()) >>> 0,
          },
        };
        worker.postMessage(message);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [input, iterations, nonce, stopWorkers]);

  // Worker beim Verlassen der Seite aufräumen.
  useEffect(() => stopWorkers, [stopWorkers]);

  /** Erzwingt einen neuen Lauf mit frischen Zufallszahlen (Tastenkürzel "Leertaste"). */
  const rerun = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, rerun };
}
