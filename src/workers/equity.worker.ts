/**
 * Rechen-Worker. Hält die Oberfläche frei, während Monte Carlo läuft.
 *
 * Pro Lauf werden mehrere dieser Worker gestartet, die sich die Iterationen teilen.
 * Jeder bekommt einen eigenen Seed, damit die Teilläufe unabhängig sind.
 */

import { runSimulation, type SimInput, type SimTotals } from '../core/simulate';

export interface WorkerRunMessage {
  type: 'run';
  runId: number;
  input: SimInput;
}

export type WorkerOutMessage =
  | { type: 'progress'; runId: number; done: number }
  | { type: 'done'; runId: number; totals: SimTotals }
  | { type: 'error'; runId: number; message: string };

const post = (message: WorkerOutMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<WorkerRunMessage>) => {
  const { type, runId, input } = event.data;
  if (type !== 'run') return;

  try {
    const totals = runSimulation(input, (done) => post({ type: 'progress', runId, done }));
    post({ type: 'done', runId, totals });
  } catch (error) {
    post({ type: 'error', runId, message: (error as Error).message });
  }
};
