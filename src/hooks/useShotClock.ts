/**
 * Treibt die reine Zustandsmaschine aus `core/clock.ts` mit echter Zeit an.
 *
 * Bewusst `setInterval` statt `requestAnimationFrame`: rAF wird von Browsern in
 * Hintergrund-Tabs komplett angehalten – bei einer Poker-Uhr, die während des
 * Abends leicht mal in einem gesperrten Handy-Display oder einem anderen Tab
 * landet, würde die Zeit dann einfach stehen bleiben. `setInterval` läuft im
 * Hintergrund gedrosselt weiter (typischerweise ~1×/Sekunde), und weil jeder
 * Tick die tatsächlich vergangene Wanduhrzeit misst statt eine feste Schrittweite
 * anzunehmen, holt die Anzeige nach einer Drosselung sofort korrekt auf.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addPlayer as addPlayerPure,
  createInitialState,
  remainingSeconds,
  removePlayer as removePlayerPure,
  resetTimebanks,
  startTurn as startTurnPure,
  stopTurn,
  tickState,
  type ClockConfig,
  type ClockState,
} from '../core/clock';
import type { SoundName } from './useSound';

export function useShotClock(config: ClockConfig, play?: (name: SoundName) => void) {
  const [state, setState] = useState<ClockState>(createInitialState);

  // Immer aktuell, ohne dass der Tick-Effekt bei jeder Konfigurationsänderung neu starten muss.
  const configRef = useRef(config);
  configRef.current = config;

  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.phase === 'idle' || state.phase === 'expired') {
      lastTickRef.current = null;
      return;
    }

    lastTickRef.current = Date.now();
    // 100 ms für eine spürbar flüssige Anzeige; die tatsächlich vergangene Zeit
    // wird trotzdem über Date.now() gemessen, nicht über die Schrittweite selbst.
    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = (now - (lastTickRef.current ?? now)) / 1000;
      lastTickRef.current = now;
      setState((prev) => tickState(prev, delta, configRef.current));
    }, 100);

    return () => window.clearInterval(interval);
  }, [state.phase]);

  // Signalton beim Übergang in "abgelaufen" – nur einmal pro Ablauf, nicht bei jedem Re-Render.
  const buzzedRef = useRef(false);
  useEffect(() => {
    if (state.phase === 'expired') {
      if (!buzzedRef.current) {
        buzzedRef.current = true;
        play?.('buzzer');
      }
    } else {
      buzzedRef.current = false;
    }
  }, [state.phase, play]);

  // Countdown-Piep in den letzten drei Sekunden der jeweils laufenden Phase.
  const remaining = remainingSeconds(state);
  const remainingCeil = remaining !== null ? Math.ceil(remaining) : null;
  const lastTickedRef = useRef<number | null>(null);
  useEffect(() => {
    if (remainingCeil !== null && remainingCeil > 0 && remainingCeil <= 3) {
      if (lastTickedRef.current !== remainingCeil) {
        lastTickedRef.current = remainingCeil;
        play?.('tick');
      }
    } else {
      lastTickedRef.current = null;
    }
  }, [remainingCeil, play]);

  const startTurn = useCallback(
    (playerId: string) => setState((prev) => startTurnPure(prev, playerId, configRef.current)),
    [],
  );
  const finishTurn = useCallback(() => setState((prev) => stopTurn(prev)), []);
  const resetAll = useCallback(
    () => setState((prev) => resetTimebanks(prev, configRef.current)),
    [],
  );
  const addPlayer = useCallback(
    (name: string) => setState((prev) => addPlayerPure(prev, name, configRef.current)),
    [],
  );
  const removePlayer = useCallback(
    (id: string) => setState((prev) => removePlayerPure(prev, id)),
    [],
  );

  return { state, remainingSeconds: remaining, startTurn, finishTurn, resetAll, addPlayer, removePlayer };
}
