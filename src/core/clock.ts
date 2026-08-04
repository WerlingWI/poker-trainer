/**
 * Shot-Clock für Live-Pokerabende.
 *
 * Jede Entscheidung beginnt mit einer festen Reaktionszeit (Standard 10 Sekunden).
 * Läuft die ab, ohne dass gehandelt wurde, zehrt automatisch die persönliche
 * Timebank des Spielers weiter herunter – ein über den ganzen Abend endlicher
 * Vorrat. Ist die Timebank eines Spielers aufgebraucht, bleibt ihm ab diesem
 * Moment für jede künftige Entscheidung nur noch die reine Reaktionszeit, ohne
 * weitere Verlängerung.
 *
 * Reine Logik, kein React, kein Timer-Interval – das übernimmt `useShotClock`.
 */

export interface ClockConfig {
  reactionSeconds: number;
  timebankSeconds: number;
}

export function defaultClockConfig(): ClockConfig {
  return { reactionSeconds: 10, timebankSeconds: 60 };
}

export interface PlayerClock {
  id: string;
  name: string;
  /** Verbleibende Timebank in Sekunden, kann bis auf 0 sinken. */
  timebankRemaining: number;
}

export type ClockPhase = 'idle' | 'reacting' | 'timebank' | 'expired';

export interface ClockState {
  activePlayerId: string | null;
  phase: ClockPhase;
  /** Nur in Phase "reacting" relevant. */
  reactionRemaining: number;
  players: PlayerClock[];
}

export function createInitialState(): ClockState {
  return { activePlayerId: null, phase: 'idle', reactionRemaining: 0, players: [] };
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addPlayer(state: ClockState, name: string, config: ClockConfig): ClockState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const player: PlayerClock = { id: makeId(), name: trimmed, timebankRemaining: config.timebankSeconds };
  return { ...state, players: [...state.players, player] };
}

export function removePlayer(state: ClockState, id: string): ClockState {
  const players = state.players.filter((p) => p.id !== id);
  // Entfernt man den gerade aktiven Spieler, gibt es nichts mehr, dessen Uhr laufen könnte.
  if (state.activePlayerId === id) {
    return { ...state, players, activePlayerId: null, phase: 'idle', reactionRemaining: 0 };
  }
  return { ...state, players };
}

/** Startet die Uhr für einen Spieler – immer mit voller Reaktionszeit, unabhängig von der vorigen Runde. */
export function startTurn(state: ClockState, playerId: string, config: ClockConfig): ClockState {
  if (!state.players.some((p) => p.id === playerId)) return state;
  return {
    ...state,
    activePlayerId: playerId,
    phase: 'reacting',
    reactionRemaining: config.reactionSeconds,
  };
}

/** Der Spieler hat rechtzeitig gehandelt – die Uhr hält an, seine Timebank bleibt unangetastet. */
export function stopTurn(state: ClockState): ClockState {
  if (state.phase === 'idle') return state;
  return { ...state, phase: 'idle', reactionRemaining: 0 };
}

export function resetTimebanks(state: ClockState, config: ClockConfig): ClockState {
  return {
    ...state,
    phase: 'idle',
    activePlayerId: null,
    reactionRemaining: 0,
    players: state.players.map((p) => ({ ...p, timebankRemaining: config.timebankSeconds })),
  };
}

/**
 * Lässt `deltaSeconds` Zeit vergehen. In der Reaktionsphase zählt die Reaktionszeit
 * herunter; läuft sie in diesem Schritt ab, fließt der Überschuss direkt in die
 * Timebank-Phase weiter – dadurch geht kein Sekundenbruchteil beim Phasenwechsel
 * verloren. Ist die Timebank eines Spielers bereits vor der Runde leer, kippt die
 * Uhr nach der Reaktionszeit ohne jede Gnadenfrist direkt auf "abgelaufen".
 */
export function tickState(state: ClockState, deltaSeconds: number, config: ClockConfig): ClockState {
  if (deltaSeconds <= 0) return state;
  if (state.phase === 'idle' || state.phase === 'expired' || !state.activePlayerId) return state;

  if (state.phase === 'reacting') {
    const remaining = state.reactionRemaining - deltaSeconds;
    if (remaining > 0) return { ...state, reactionRemaining: remaining };
    return tickState({ ...state, phase: 'timebank', reactionRemaining: 0 }, -remaining, config);
  }

  // phase === 'timebank'
  const player = state.players.find((p) => p.id === state.activePlayerId);
  if (!player) return { ...state, phase: 'idle' };

  const remaining = player.timebankRemaining - deltaSeconds;
  if (remaining > 0) {
    return {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, timebankRemaining: remaining } : p)),
    };
  }
  return {
    ...state,
    phase: 'expired',
    players: state.players.map((p) => (p.id === player.id ? { ...p, timebankRemaining: 0 } : p)),
  };
}

/** Die Sekunden, die gerade auf der Uhr stehen – je nach Phase Reaktionszeit oder Timebank. */
export function remainingSeconds(state: ClockState): number | null {
  if (state.phase === 'reacting') return state.reactionRemaining;
  if (state.phase === 'timebank') {
    return state.players.find((p) => p.id === state.activePlayerId)?.timebankRemaining ?? null;
  }
  return null;
}

export function activePlayer(state: ClockState): PlayerClock | null {
  return state.players.find((p) => p.id === state.activePlayerId) ?? null;
}

/** "0:07" – aufgerundet, damit die Anzeige beim Start nie schon bei 9 statt 10 beginnt. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
