/**
 * Tastatur-Schnelleingabe.
 *
 * Karten werden getippt wie im Poker-Jargon: erst der Wert, dann die Farbe –
 * "a" "s" ergibt das Pik-Ass. Die App bleibt vollständig ohne Tastatur bedienbar;
 * das hier ist reine Beschleunigung für Vielnutzer.
 */

import { useEffect, useRef, useState } from 'react';
import { makeCard, type Card } from '../core/cards';

const RANK_KEYS: Record<string, number> = {
  '2': 0,
  '3': 1,
  '4': 2,
  '5': 3,
  '6': 4,
  '7': 5,
  '8': 6,
  '9': 7,
  t: 8,
  '0': 8, // "10" endet auf der Null – beide Tasten führen zur Zehn.
  j: 9,
  q: 10,
  k: 11,
  a: 12,
};

const SUIT_KEYS: Record<string, number> = {
  c: 0, // Kreuz (clubs)
  k: 0,
  d: 1, // Karo (diamonds)
  h: 2, // Herz
  s: 3, // Pik (spades)
  p: 3,
};

export interface HotkeyHandlers {
  onCard: (card: Card) => void;
  onBackspace: () => void;
  onRerun: () => void;
  onCycleIterations: () => void;
  onToggleHelp: () => void;
  enabled: boolean;
}

/** Liefert den aktuell angefangenen Rang, damit die UI ihn anzeigen kann. */
export function useCardHotkeys(handlers: HotkeyHandlers): number | null {
  const [pendingRank, setPendingRank] = useState<number | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Spiegelt `pendingRank`, damit der Tastatur-Handler den aktuellen Wert lesen kann,
  // ohne die Karte in einem State-Updater zu setzen (dort sind Nebenwirkungen tabu).
  const pendingRef = useRef<number | null>(null);
  pendingRef.current = pendingRank;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const current = handlersRef.current;
      if (!current.enabled) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      const key = event.key.toLowerCase();

      if (key === 'escape') {
        pendingRef.current = null;
        setPendingRank(null);
        return;
      }
      if (key === 'backspace' || key === 'delete') {
        event.preventDefault();
        pendingRef.current = null;
        setPendingRank(null);
        current.onBackspace();
        return;
      }
      if (key === ' ') {
        event.preventDefault();
        current.onRerun();
        return;
      }
      if (key === '1') {
        current.onCycleIterations();
        return;
      }
      if (key === '?') {
        current.onToggleHelp();
        return;
      }

      // Ist bereits ein Wert angefangen, wird die Taste als Farbe gelesen.
      const rank = pendingRef.current;
      if (rank !== null && key in SUIT_KEYS) {
        pendingRef.current = null;
        setPendingRank(null);
        current.onCard(makeCard(rank, SUIT_KEYS[key]));
        return;
      }
      if (key in RANK_KEYS) {
        pendingRef.current = RANK_KEYS[key];
        setPendingRank(RANK_KEYS[key]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return pendingRank;
}
