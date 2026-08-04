/**
 * Pot Odds, EV und die daraus abgeleitete Empfehlung.
 *
 * Bewusste Grenze des Modells: Gegner halten zufällige Karten, es gibt keine
 * Implied Odds und keine Fold Equity. Die App weist darauf sichtbar hin, statt
 * eine Genauigkeit vorzutäuschen, die eine reine Equity-Rechnung nicht hat.
 */

export type Action = 'CALL' | 'FOLD' | 'CHECK' | 'RAISE' | 'MARGINAL';

export interface Odds {
  /** Anteil, den der Call am entstehenden Pot ausmacht = benötigte Equity. */
  requiredEquity: number;
  /** Verhältnis Pot zu Call, z.B. 3 bei 3:1. */
  ratio: number;
  /** Erwartungswert eines Calls in Chips. */
  ev: number;
  /** Stack-to-Pot-Ratio – Kontext dafür, wie viel Spielraum nach dem Call bleibt. */
  spr: number;
  /** Der Call ist durch den effektiven Stack gedeckelt. */
  effectiveCall: number;
  isAllIn: boolean;
}

export interface Spot {
  pot: number;
  call: number;
  /** Effektiver Stack – begrenzt, was tatsächlich bezahlt werden kann. */
  stack: number;
}

export function computeOdds(equity: number, spot: Spot): Odds {
  const effectiveCall = Math.max(0, Math.min(spot.call, spot.stack));
  const pot = Math.max(0, spot.pot);
  const totalPot = pot + effectiveCall;

  const requiredEquity = totalPot > 0 ? effectiveCall / totalPot : 0;
  const ratio = effectiveCall > 0 ? pot / effectiveCall : Number.POSITIVE_INFINITY;
  // Gewinnt man, bekommt man den Pot inklusive des eigenen Calls; verliert man, ist der Call weg.
  const ev = equity * totalPot - effectiveCall;
  const spr = pot > 0 ? Math.max(0, spot.stack - effectiveCall) / pot : 0;

  return {
    requiredEquity,
    ratio,
    ev,
    spr,
    effectiveCall,
    isAllIn: spot.call >= spot.stack && spot.stack > 0,
  };
}

export interface Recommendation {
  action: Action;
  /** Große Überschrift im Banner. */
  headline: string;
  /** Ein Satz Begründung – immer mit den konkreten Zahlen. */
  reason: string;
  tone: 'positive' | 'negative' | 'neutral';
}

/** Ab hier lohnt sich eine Value-Erhöhung. */
const RAISE_EQUITY = 0.7;
/** Ab hier lohnt sich ein Check-Raise-Gedanke ohne offenen Einsatz. */
const BET_EQUITY = 0.65;
/** Sicherheitsabstand, damit knappe Fälle nicht als klare Entscheidung verkauft werden. */
const CALL_MARGIN = 0.03;
const FOLD_MARGIN = 0.02;

export function recommend(equity: number, odds: Odds): Recommendation {
  const eq = pct(equity);
  const need = pct(odds.requiredEquity);

  if (odds.effectiveCall <= 0) {
    if (equity >= BET_EQUITY) {
      return {
        action: 'RAISE',
        headline: 'SETZEN',
        reason: `Mit ${eq} % Equity bist du klar vorne – hier holst du Value, statt zu checken.`,
        tone: 'positive',
      };
    }
    return {
      action: 'CHECK',
      headline: 'CHECK',
      reason: `Es kostet nichts weiterzuspielen. Deine Equity liegt bei ${eq} %.`,
      tone: 'neutral',
    };
  }

  if (equity >= RAISE_EQUITY) {
    return {
      action: 'RAISE',
      headline: 'ERHÖHEN',
      reason: `${eq} % Equity gegen nur ${need} % benötigte Equity – ein Call lässt hier Geld liegen.`,
      tone: 'positive',
    };
  }

  if (equity >= odds.requiredEquity + CALL_MARGIN) {
    return {
      action: 'CALL',
      headline: 'CALL',
      reason: `Du brauchst ${need} % und hast ${eq} % – der Call bringt im Schnitt ${signed(odds.ev)} Chips.`,
      tone: 'positive',
    };
  }

  if (equity <= odds.requiredEquity - FOLD_MARGIN) {
    return {
      action: 'FOLD',
      headline: 'FOLD',
      reason: `Du bräuchtest ${need} %, hast aber nur ${eq} % – der Call kostet im Schnitt ${signed(odds.ev)} Chips.`,
      tone: 'negative',
    };
  }

  return {
    action: 'MARGINAL',
    headline: 'GRENZFALL',
    reason: `${eq} % Equity gegen ${need} % benötigte Equity – zu knapp für eine klare Antwort; hier entscheidet der Gegner.`,
    tone: 'neutral',
  };
}

/** Hinweis auf die Modellgrenzen – wird unter jeder Empfehlung angezeigt. */
export const MODEL_CAVEAT =
  'Gerechnet wird gegen zufällige Gegnerhände. Implied Odds, Fold Equity und das ' +
  'konkrete Spielverhalten deiner Gegner sind nicht enthalten.';

export function pct(value: number, digits = 1): string {
  return (value * 100).toFixed(digits);
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

/** "3,2 : 1" – die klassische Schreibweise der Pot Odds. */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '–';
  return `${ratio.toFixed(1).replace('.', ',')} : 1`;
}
