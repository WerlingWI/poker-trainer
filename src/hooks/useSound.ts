/**
 * Kurze Sounds, direkt per WebAudio erzeugt – keine Audiodateien, keine Lizenzfragen.
 * Standardmäßig aus; der AudioContext entsteht erst beim ersten Ton nach einer
 * Nutzeraktion, wie es die Browser verlangen.
 */

import { useCallback, useEffect, useRef } from 'react';

export type SoundName = 'card' | 'chip' | 'click' | 'win' | 'lose' | 'tick' | 'buzzer';

interface Voice {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Zielfrequenz am Ende – erzeugt den kleinen Auf- oder Abschwung. */
  slideTo?: number;
}

const VOICES: Record<SoundName, Voice> = {
  card: { frequency: 1200, duration: 0.06, type: 'triangle', gain: 0.05, slideTo: 700 },
  chip: { frequency: 520, duration: 0.08, type: 'square', gain: 0.035, slideTo: 380 },
  click: { frequency: 880, duration: 0.03, type: 'sine', gain: 0.03 },
  win: { frequency: 660, duration: 0.22, type: 'sine', gain: 0.06, slideTo: 1320 },
  lose: { frequency: 400, duration: 0.22, type: 'sine', gain: 0.05, slideTo: 180 },
  // Kurzer Piep für die letzten Sekunden der Shot-Clock.
  tick: { frequency: 1000, duration: 0.05, type: 'sine', gain: 0.045 },
  // Tiefer, rauer Ton für "Zeit abgelaufen" – bewusst unangenehmer als die übrigen Sounds.
  buzzer: { frequency: 220, duration: 0.5, type: 'sawtooth', gain: 0.06, slideTo: 140 },
};

export function useSound(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  return useCallback(
    (name: SoundName) => {
      if (!enabled) return;
      try {
        contextRef.current ??= new AudioContext();
        const ctx = contextRef.current;
        if (ctx.state === 'suspended') void ctx.resume();

        const voice = VOICES[name];
        const now = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const amp = ctx.createGain();

        oscillator.type = voice.type;
        oscillator.frequency.setValueAtTime(voice.frequency, now);
        if (voice.slideTo) {
          oscillator.frequency.exponentialRampToValueAtTime(voice.slideTo, now + voice.duration);
        }

        // Weiche Hüllkurve, damit kein Knacken entsteht.
        amp.gain.setValueAtTime(0.0001, now);
        amp.gain.exponentialRampToValueAtTime(voice.gain, now + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, now + voice.duration);

        oscillator.connect(amp).connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(now + voice.duration + 0.02);
      } catch {
        // Audio ist reine Zugabe – ein Fehler darf die App nie stören.
      }
    },
    [enabled],
  );
}
