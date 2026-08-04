import type { ImpliedOdds, StrategyPlan } from '../../core/strategy';

const TONES = {
  positive: 'border-win/40 bg-win/10 text-win',
  negative: 'border-loss/40 bg-loss/10 text-loss',
  neutral: 'border-tie/40 bg-tie/10 text-tie',
};

interface StrategyPanelProps {
  plan: StrategyPlan;
  implied: ImpliedOdds | null;
}

/**
 * Der Spielplan: Value Bet, Bluff, Bluff Catch oder aufgeben – jeweils mit der
 * passenden Einsatzhöhe und der Fold Equity, die ein Bluff dieser Größe braucht.
 */
export function StrategyPanel({ plan, implied }: StrategyPanelProps) {
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${TONES[plan.tone]}`}>
        <div className="text-xl font-black">{plan.title}</div>
        <p className="mt-1.5 text-sm leading-snug text-ink">{plan.detail}</p>
      </div>

      {plan.options.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold">
            Einsatzhöhen{plan.suggested ? ' – Vorschlag hervorgehoben' : ''}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {plan.options.map((option) => {
              const isSuggested = plan.suggested?.fraction === option.fraction;
              return (
                <div
                  key={option.fraction}
                  className={[
                    'rounded-xl border p-3 text-center',
                    isSuggested ? 'border-gold bg-gold/10' : 'border-line bg-surface-2',
                  ].join(' ')}
                >
                  <div className="text-xs font-semibold text-muted">{option.label}</div>
                  <div className="text-xl font-black tabular-nums">{option.size}</div>
                  <div className="mt-1 text-[0.7rem] leading-tight text-muted">
                    Bluff braucht
                    <br />
                    <span className="font-bold tabular-nums">
                      {(option.requiredFoldEquity * 100).toFixed(0)} % Folds
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-snug text-muted">
            „Bluff braucht X % Folds" heißt: So oft muss der Gegner aufgeben, damit sich ein
            Einsatz dieser Größe schon allein durch sein Folden rechnet – Einsatz geteilt durch
            (Pot + Einsatz).
          </p>
        </div>
      )}

      {implied && !implied.alreadyProfitable && (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <h4 className="text-sm font-bold">Implied Odds</h4>
          <p className="mt-1.5 text-sm leading-snug text-muted">
            Die direkten Pot Odds reichen nicht. Damit sich der Call trotzdem lohnt, musst du auf
            den späteren Straßen im Schnitt noch{' '}
            <strong className="text-ink tabular-nums">{Math.round(implied.needed)} Chips</strong>{' '}
            zusätzlich gewinnen. Im Stack sind dafür noch{' '}
            <strong className="text-ink tabular-nums">{Math.round(implied.available)}</strong>{' '}
            vorhanden.
          </p>
          <p
            className={`mt-2 text-sm font-bold ${implied.feasible ? 'text-win' : 'text-loss'}`}
          >
            {implied.feasible
              ? 'Machbar – wenn er dir beim Treffer noch etwas bezahlt.'
              : 'Nicht machbar – so viel liegt gar nicht mehr auf dem Tisch.'}
          </p>
          <p className="mt-1 text-xs leading-snug text-muted">
            Implied Odds setzen voraus, dass der Gegner beim Treffer wirklich zahlt. Gegen einen
            vorsichtigen Spieler bekommst du weniger, als die Rechnung verspricht.
          </p>
        </div>
      )}
    </div>
  );
}
