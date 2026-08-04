import { useMemo, useState } from 'react';
import { DrawList } from '../components/analysis/DrawList';
import { CardFace } from '../components/cards/CardFace';
import { ResultBars } from '../components/results/EquityDonut';
import { StatTile } from '../components/results/StatTile';
import { Button } from '../components/ui/Button';
import { Panel, ProgressBar } from '../components/ui/Panel';
import { unknownCards } from '../core/cards';
import { analyzeDraws } from '../core/draws';
import { computeOdds, formatRatio, pct, recommend, type Action } from '../core/odds';
import { analyzeOuts, hitProbability } from '../core/outs';
import { createScenario } from '../core/scenario';
import { cardsToCome, streetOf, STREET_LABELS, usedCards } from '../core/types';
import { useEquity } from '../hooks/useEquity';
import type { SoundName } from '../hooks/useSound';
import type { AppState } from '../state/appStorage';

/** Im Lernmodus reichen 30.000 Simulationen – das Ergebnis steht so gut wie sofort. */
const LEARN_ITERATIONS = 30_000;

type Answer = 'CALL' | 'FOLD' | 'RAISE';

const ANSWERS: Array<{ value: Answer; label: string; variant: 'positive' | 'negative' | 'neutral' }> = [
  { value: 'FOLD', label: 'Fold', variant: 'negative' },
  { value: 'CALL', label: 'Call', variant: 'positive' },
  { value: 'RAISE', label: 'Raise', variant: 'neutral' },
];

interface LearnScreenProps {
  app: AppState;
  onAnswer: (correct: boolean) => void;
  play: (name: SoundName) => void;
}

export function LearnScreen({ app, onAnswer, play }: LearnScreenProps) {
  const [scenario, setScenario] = useState(() => createScenario());
  const [answer, setAnswer] = useState<Answer | null>(null);

  const { spot, prompt, opponentNote } = scenario;
  const equity = useEquity(spot, LEARN_ITERATIONS);
  const value = equity.breakdown?.equity ?? 0;
  const odds = computeOdds(value, spot);
  const recommendation = recommend(value, odds);
  const street = streetOf(spot.board.length);
  const toCome = cardsToCome(spot.board.length);

  const draws = useMemo(() => analyzeDraws(spot.hole, spot.board), [spot.hole, spot.board]);

  // Wie im Analyse-Tab: Outs erst ab dem Flop, davor ist die nächste Karte kaum aussagekräftig.
  const showOuts = spot.board.length >= 3 && toCome > 0;

  const outs = useMemo(() => {
    if (!equity.totals || !equity.breakdown || !showOuts) return null;
    return analyzeOuts(equity.totals, equity.breakdown.equity, unknownCards(usedCards(spot)), toCome);
  }, [equity.totals, equity.breakdown, toCome, showOuts, spot]);

  const verdict = answer ? judge(answer, recommendation.action) : null;

  const submit = (choice: Answer) => {
    if (answer || equity.running || !equity.breakdown) return;
    const result = judge(choice, recommendation.action);
    setAnswer(choice);
    onAnswer(result.correct);
    play(result.correct ? 'win' : 'lose');
  };

  const next = () => {
    play('card');
    setAnswer(null);
    setScenario(createScenario());
  };

  const accuracy = app.learn.answered ? app.learn.correct / app.learn.answered : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Beantwortet" value={app.learn.answered} />
        <StatTile
          label="Trefferquote"
          value={`${pct(accuracy, 0)} %`}
          tone={accuracy >= 0.6 ? 'positive' : 'default'}
        />
        <StatTile label="Serie" value={app.learn.streak} hint={`Beste: ${app.learn.bestStreak}`} tone="gold" />
      </div>

      <section
        className="rounded-3xl border border-felt-line/40 p-5"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, var(--color-felt) 0%, var(--color-felt-deep) 78%)',
          boxShadow: 'inset 0 2px 30px rgb(0 0 0 / 0.35), var(--shadow-lift)',
        }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold tracking-wider text-white/80 uppercase">
            {STREET_LABELS[street]} · {spot.players - 1} Gegner
          </span>
          <span className="text-sm text-white/70">Stack {spot.stack}</span>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="mb-1.5 text-[0.65rem] font-bold tracking-[0.15em] text-white/60 uppercase">
              Deine Karten
            </div>
            <div className="flex gap-2">
              {spot.hole.map((card, index) => (
                <CardFace key={card} card={card} size="xl" dealDelay={index * 0.07} />
              ))}
            </div>
          </div>

          {spot.board.length > 0 && (
            <div>
              <div className="mb-1.5 text-[0.65rem] font-bold tracking-[0.15em] text-white/60 uppercase">
                Board
              </div>
              <div className="flex gap-2">
                {spot.board.map((card, index) => (
                  <CardFace key={card} card={card} size="lg" dealDelay={0.15 + index * 0.07} />
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-5 text-lg font-semibold text-white">{prompt}</p>
        <p className="mt-1 text-sm text-white/70">{opponentNote}</p>
      </section>

      {!answer && (
        <>
          {equity.running && <ProgressBar value={equity.progress} label="Situation wird bewertet" />}
          <div className="grid grid-cols-3 gap-3">
            {ANSWERS.map((option) => (
              <Button
                key={option.value}
                size="xl"
                variant={option.variant}
                disabled={equity.running || !equity.breakdown}
                onClick={() => submit(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-center text-sm text-muted">
            Entscheide zuerst – die Auflösung kommt danach.
          </p>
        </>
      )}

      {answer && verdict && equity.breakdown && (
        <>
          <div
            className={`animate-pop rounded-2xl border p-5 ${
              verdict.correct ? 'border-win/40 bg-win/10' : 'border-loss/40 bg-loss/10'
            }`}
          >
            <div
              className={`text-2xl font-black ${verdict.correct ? 'text-win' : 'text-loss'}`}
            >
              {verdict.title}
            </div>
            <p className="mt-2 text-base leading-snug">{verdict.explanation}</p>
            <p className="mt-2 text-base leading-snug text-ink">{recommendation.reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Deine Equity" value={`${pct(equity.breakdown.equity)} %`} tone="gold" />
            <StatTile label="Benötigt" value={`${pct(odds.requiredEquity)} %`} />
            <StatTile label="Pot Odds" value={formatRatio(odds.ratio)} />
            <StatTile
              label="Outs"
              value={outs ? outs.outs.length : '–'}
              hint={
                outs
                  ? `${pct(hitProbability(outs.outs.length, 52 - usedCards(spot).length, toCome), 0)} % Trefferchance`
                  : spot.board.length === 5
                    ? 'Board vollständig'
                    : 'erst ab dem Flop'
              }
            />
          </div>

          <Panel title="Warum">
            <div className="space-y-4">
              <ResultBars breakdown={equity.breakdown} />
              <DrawList draws={draws} />
            </div>
          </Panel>

          <Button block size="xl" variant="primary" onClick={next}>
            Nächste Hand
          </Button>
        </>
      )}
    </div>
  );
}

interface Verdict {
  correct: boolean;
  title: string;
  explanation: string;
}

/**
 * Bewertet die Antwort gegen die mathematische Empfehlung.
 *
 * Bewusst nachsichtig, wo die Mathematik selbst nicht eindeutig ist: bei einem
 * Grenzfall zählen Call und Fold beide, und wer bei einer Raise-Situation nur
 * callt, macht keinen Fehler – er lässt lediglich Value liegen.
 */
function judge(answer: Answer, best: Action): Verdict {
  if (best === 'MARGINAL') {
    if (answer === 'RAISE') {
      return {
        correct: false,
        title: 'Zu aggressiv',
        explanation:
          'Die Situation ist ein Grenzfall – Call und Fold sind beide vertretbar, eine Erhöhung ist es nicht.',
      };
    }
    return {
      correct: true,
      title: 'Richtig – Grenzfall',
      explanation: 'Hier gibt es keine eindeutige Antwort: Call und Fold sind beide vertretbar.',
    };
  }

  if (answer === best) {
    return { correct: true, title: 'Richtig!', explanation: 'Deine Entscheidung passt zur Mathematik.' };
  }

  if (best === 'RAISE' && answer === 'CALL') {
    return {
      correct: true,
      title: 'Richtig, aber zu passiv',
      explanation:
        'Ein Call ist nicht falsch – mit dieser Equity lässt du damit aber Gewinn auf dem Tisch liegen.',
    };
  }

  const reasons: Record<Action, string> = {
    CALL: 'Deine Equity liegt über der benötigten Equity – hier gehört ein Call hin.',
    FOLD: 'Deine Equity reicht nicht für die gebotenen Pot Odds – das ist ein Fold.',
    RAISE: 'Mit dieser Equity bist du klar vorn – hier gehört eine Erhöhung hin.',
    CHECK: 'Es kostet nichts weiterzuspielen – ein Fold verschenkt hier eine kostenlose Karte.',
    MARGINAL: '',
  };

  return { correct: false, title: 'Leider falsch', explanation: reasons[best] };
}
