import {
  RANKS_DESC,
  SUIT_DISPLAY_ORDER,
  cardLabel,
  makeCard,
  type Card,
} from '../../core/cards';
import type { CardImpact, ImpactKind, OutsAnalysis } from '../../core/outs';
import { CardFace } from '../cards/CardFace';

const KIND_RING: Record<ImpactKind, string> = {
  out: 'ring-2 ring-win shadow-[0_0_10px_-2px_var(--color-win)]',
  good: 'ring-2 ring-tie/70',
  neutral: '',
  bad: 'ring-2 ring-loss/80',
};

interface DeckHeatmapProps {
  analysis: OutsAnalysis;
  used: readonly Card[];
}

/**
 * Das verbleibende Deck als Wärmebild: Welche Karte hilft mir, welche hilft dem Gegner?
 *
 * Die Werte stammen direkt aus der Simulation – jede Karte zeigt, wie hoch die
 * eigene Equity ausfällt, *wenn* genau sie als nächstes kommt.
 */
export function DeckHeatmap({ analysis, used }: DeckHeatmapProps) {
  const usedSet = new Set(used);

  if (!analysis.reliable) {
    return (
      <p className="text-sm text-muted">
        {analysis.cardsToCome === 0
          ? 'Das Board ist vollständig – es kommt keine Karte mehr.'
          : 'Noch zu wenige Simulationen für eine belastbare Karten-Auswertung.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="w-max space-y-1">
          {SUIT_DISPLAY_ORDER.map((suit) => (
            <div key={suit} className="flex gap-1">
              {RANKS_DESC.map((rank) => {
                const card = makeCard(rank, suit);
                const impact = analysis.byCard.get(card);
                const isUsed = usedSet.has(card);
                return (
                  <div
                    key={card}
                    title={
                      impact
                        ? `${cardLabel(card)}: ${(impact.equity * 100).toFixed(0)} % Equity (${formatDelta(impact.delta)})`
                        : cardLabel(card)
                    }
                    className={`rounded-lg ${impact && !isUsed ? KIND_RING[impact.kind] : ''}`}
                  >
                    <CardFace card={card} size="xs" dimmed={isUsed} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <Legend color="var(--color-win)" text={`Out (${analysis.outs.length})`} />
        <Legend color="var(--color-tie)" text={`hilft (${analysis.helpful.length})`} />
        <Legend color="var(--color-loss)" text={`gefährlich (${analysis.dangerous.length})`} />
        <li>ausgegraut = bereits vergeben</li>
      </ul>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-3 rounded-full ring-2"
        style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
      />
      {text}
    </li>
  );
}

function formatDelta(delta: number): string {
  const value = (delta * 100).toFixed(0);
  return delta >= 0 ? `+${value} pp` : `${value} pp`;
}

/** Kompakte Kartenreihe mit Beschriftung – für "Deine Outs" und "Gefährliche Karten". */
export function ImpactRow({
  title,
  impacts,
  emptyText,
  ring,
}: {
  title: string;
  impacts: readonly CardImpact[];
  emptyText: string;
  ring: 'win' | 'loss';
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h4 className="text-sm font-bold">{title}</h4>
        <span className="text-sm text-muted tabular-nums">{impacts.length}</span>
      </div>
      {impacts.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {impacts.slice(0, 14).map((impact) => (
            <div
              key={impact.card}
              title={`${cardLabel(impact.card)}: ${formatDelta(impact.delta)}`}
              className="flex flex-col items-center gap-0.5"
            >
              <CardFace card={impact.card} size="sm" ring={ring} />
              <span
                className={`text-[0.65rem] font-bold tabular-nums ${
                  impact.delta >= 0 ? 'text-win' : 'text-loss'
                }`}
              >
                {formatDelta(impact.delta)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
