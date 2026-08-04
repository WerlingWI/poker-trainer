import { MODEL_CAVEAT, type Recommendation as Rec } from '../../core/odds';

const STYLES = {
  positive: {
    box: 'border-win/40 bg-win/10',
    text: 'text-win',
    icon: '✓',
  },
  negative: {
    box: 'border-loss/40 bg-loss/10',
    text: 'text-loss',
    icon: '✕',
  },
  neutral: {
    box: 'border-tie/40 bg-tie/10',
    text: 'text-tie',
    icon: '≈',
  },
};

/**
 * Das Empfehlungs-Banner. Die Entscheidung steht groß da, die Begründung
 * direkt darunter – und der Hinweis, was das Modell *nicht* weiß.
 */
export function RecommendationBanner({ recommendation }: { recommendation: Rec }) {
  const style = STYLES[recommendation.tone];

  return (
    <div className={`animate-pop rounded-2xl border p-5 ${style.box}`}>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-xl font-black ${style.text}`}
          style={{ borderColor: 'currentColor' }}
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <div className={`text-3xl leading-none font-black tracking-tight ${style.text}`}>
            {recommendation.headline}
          </div>
        </div>
      </div>

      <p className="mt-3 text-base leading-snug text-ink">{recommendation.reason}</p>
      <p className="mt-2 text-xs leading-snug text-muted">{MODEL_CAVEAT}</p>
    </div>
  );
}
