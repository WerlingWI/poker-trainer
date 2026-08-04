import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  createInitialState,
  formatClock,
  remainingSeconds,
  removePlayer,
  resetTimebanks,
  startTurn,
  stopTurn,
  tickState,
  type ClockConfig,
} from '../clock';

const config: ClockConfig = { reactionSeconds: 10, timebankSeconds: 60 };

function withOnePlayer() {
  const state = addPlayer(createInitialState(), 'Alex', config);
  return { state, id: state.players[0].id };
}

describe('Spielerverwaltung', () => {
  it('fügt Spieler mit voller Timebank hinzu', () => {
    const state = addPlayer(createInitialState(), 'Bo', config);
    expect(state.players).toHaveLength(1);
    expect(state.players[0].timebankRemaining).toBe(60);
    expect(state.players[0].name).toBe('Bo');
  });

  it('ignoriert leere Namen', () => {
    expect(addPlayer(createInitialState(), '   ', config).players).toHaveLength(0);
  });

  it('vergibt eindeutige IDs', () => {
    let state = createInitialState();
    state = addPlayer(state, 'A', config);
    state = addPlayer(state, 'B', config);
    expect(state.players[0].id).not.toBe(state.players[1].id);
  });

  it('entfernt einen Spieler wieder', () => {
    const { state, id } = withOnePlayer();
    expect(removePlayer(state, id).players).toHaveLength(0);
  });

  it('setzt die Uhr zurück, wenn der aktive Spieler entfernt wird', () => {
    const { state, id } = withOnePlayer();
    const running = startTurn(state, id, config);
    const after = removePlayer(running, id);
    expect(after.phase).toBe('idle');
    expect(after.activePlayerId).toBeNull();
  });
});

describe('Reaktionsphase', () => {
  it('startet mit voller Reaktionszeit', () => {
    const { state, id } = withOnePlayer();
    const running = startTurn(state, id, config);
    expect(running.phase).toBe('reacting');
    expect(running.reactionRemaining).toBe(10);
  });

  it('zählt während der Reaktionszeit herunter, ohne die Timebank anzurühren', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 4, config);
    expect(running.phase).toBe('reacting');
    expect(running.reactionRemaining).toBeCloseTo(6, 6);
    expect(running.players[0].timebankRemaining).toBe(60);
  });

  it('handelt rechtzeitig: stopTurn beendet die Runde ohne Timebank-Verlust', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 3, config);
    running = stopTurn(running);
    expect(running.phase).toBe('idle');
    expect(running.players[0].timebankRemaining).toBe(60);
  });
});

describe('Übergang in die Timebank', () => {
  it('lässt den Überschuss beim Phasenwechsel nahtlos in die Timebank fließen', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    // 12 Sekunden bei 10 Sekunden Reaktionszeit: 2 Sekunden gehen in die Timebank.
    running = tickState(running, 12, config);
    expect(running.phase).toBe('timebank');
    expect(running.players[0].timebankRemaining).toBeCloseTo(58, 6);
  });

  it('zehrt die Timebank in mehreren Schritten weiter herunter', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 15, config); // 5s in die Timebank
    running = tickState(running, 20, config); // weitere 20s
    expect(running.phase).toBe('timebank');
    expect(running.players[0].timebankRemaining).toBeCloseTo(60 - 5 - 20, 6);
  });
});

describe('Aufgebrauchte Timebank', () => {
  it('kippt auf "abgelaufen", wenn die Timebank auf 0 fällt', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 10 + 60 + 5, config);
    expect(running.phase).toBe('expired');
    expect(running.players[0].timebankRemaining).toBe(0);
  });

  it('gibt ab dann nur noch die reine Reaktionszeit, ohne jede Gnadenfrist', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 10 + 60, config); // Timebank exakt aufgebraucht
    running = stopTurn(running);
    expect(running.players[0].timebankRemaining).toBe(0);

    // Neue Runde für denselben Spieler: Reaktionszeit läuft normal …
    running = startTurn(running, id, config);
    running = tickState(running, 9, config);
    expect(running.phase).toBe('reacting');

    // … aber sobald sie abläuft, geht es direkt auf "abgelaufen", nicht in die Timebank.
    running = tickState(running, 2, config);
    expect(running.phase).toBe('expired');
    expect(running.players[0].timebankRemaining).toBe(0);
  });

  it('tickt eine abgelaufene Uhr nicht weiter', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 100, config);
    expect(running.phase).toBe('expired');
    const again = tickState(running, 5, config);
    expect(again).toEqual(running);
  });
});

describe('Timebank zurücksetzen', () => {
  it('füllt alle Spieler wieder auf und geht in den Leerlauf', () => {
    const { state, id } = withOnePlayer();
    let running = startTurn(state, id, config);
    running = tickState(running, 30, config);
    const reset = resetTimebanks(running, config);
    expect(reset.phase).toBe('idle');
    expect(reset.activePlayerId).toBeNull();
    expect(reset.players[0].timebankRemaining).toBe(60);
  });
});

describe('Ohne aktiven Spieler oder im Leerlauf', () => {
  it('tickt nichts, solange niemand am Zug ist', () => {
    const state = createInitialState();
    expect(tickState(state, 5, config)).toEqual(state);
  });

  it('liefert im Leerlauf keine verbleibende Zeit', () => {
    expect(remainingSeconds(createInitialState())).toBeNull();
  });
});

describe('formatClock', () => {
  it('rundet auf und formatiert als m:ss', () => {
    expect(formatClock(9.4)).toBe('0:10');
    expect(formatClock(10)).toBe('0:10');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });
});
