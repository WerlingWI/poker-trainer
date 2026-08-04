/**
 * Zustand, der im localStorage überlebt.
 *
 * Bewusst defensiv: alles, was aus dem Speicher kommt, kann von einer älteren
 * Version stammen oder von Hand verändert worden sein. Passt die Version nicht
 * oder ist der Inhalt kein Objekt, wird sauber auf die Standardwerte
 * zurückgefallen, statt die App abstürzen zu lassen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Envelope<T> {
  version: number;
  data: T;
}

function read<T>(key: string, version: number, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== version) return fallback;
    if (typeof parsed.data !== 'object' || parsed.data === null) return fallback;
    // Fehlende Felder aus dem Standard ergänzen, damit neue Optionen keinen Reset erzwingen.
    return { ...fallback, ...parsed.data };
  } catch {
    return fallback;
  }
}

export function useLocalState<T extends object>(
  key: string,
  version: number,
  fallback: T,
): [T, (update: T | ((prev: T) => T)) => void, () => void] {
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState<T>(() => read(key, version, fallbackRef.current));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ version, data: value } satisfies Envelope<T>));
    } catch {
      // Privater Modus oder voller Speicher – die App funktioniert auch ohne Persistenz weiter.
    }
  }, [key, version, value]);

  const reset = useCallback(() => setValue(fallbackRef.current), []);

  return [value, setValue, reset];
}
