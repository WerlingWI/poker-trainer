import type { Card } from '../../core/cards';
import { STREET_LABELS, streetOf, type SpotState } from '../../core/types';
import { CardSlot } from '../cards/CardFace';

export type SlotTarget = { area: 'hole' | 'board'; index: number };

interface TableFeltProps {
  spot: SpotState;
  onSlotClick: (target: SlotTarget) => void;
  onRemove: (target: SlotTarget) => void;
  /** Karten, die zur besten Fünf-Karten-Hand gehören – werden hervorgehoben. */
  highlight?: readonly Card[];
  /** Der Slot, der als Nächstes gefüllt wird. */
  nextSlot: SlotTarget | null;
}

const BOARD_LABELS = ['Flop', 'Flop', 'Flop', 'Turn', 'River'];

/**
 * Der Pokertisch: eigene Karten links, Board rechts.
 * Auf schmalen Displays stapeln sich die beiden Bereiche untereinander.
 */
export function TableFelt({ spot, onSlotClick, onRemove, highlight, nextSlot }: TableFeltProps) {
  const highlightSet = new Set(highlight ?? []);
  const street = streetOf(spot.board.length);

  const isNext = (area: 'hole' | 'board', index: number) =>
    nextSlot?.area === area && nextSlot.index === index;

  return (
    <section
      aria-label="Pokertisch"
      className="relative overflow-hidden rounded-3xl border border-felt-line/40 p-4 sm:p-6"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, var(--color-felt) 0%, var(--color-felt-deep) 78%)',
        boxShadow: 'inset 0 2px 30px rgb(0 0 0 / 0.35), var(--shadow-lift)',
      }}
    >
      {/* Angedeutete Tischkante */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 rounded-[1.4rem] border border-white/10"
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div>
          <h2 className="mb-2 text-xs font-bold tracking-[0.15em] text-white/70 uppercase">
            Deine Karten
          </h2>
          <div className="flex gap-2">
            {[0, 1].map((index) => (
              <CardSlot
                key={index}
                card={spot.hole[index] ?? null}
                size="xl"
                label={index === 0 ? 'Karte 1' : 'Karte 2'}
                active={isNext('hole', index)}
                dealDelay={spot.hole[index] !== undefined ? index * 0.06 : undefined}
                ring={spot.hole[index] !== undefined && highlightSet.has(spot.hole[index]) ? 'gold' : null}
                onClick={() => onSlotClick({ area: 'hole', index })}
                onRemove={
                  spot.hole[index] !== undefined
                    ? () => onRemove({ area: 'hole', index })
                    : undefined
                }
              />
            ))}
          </div>
        </div>

        <div className="sm:flex-1">
          <h2 className="mb-2 text-xs font-bold tracking-[0.15em] text-white/70 uppercase">
            Board · {STREET_LABELS[street]}
          </h2>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((index) => {
              const card = spot.board[index] ?? null;
              // Der Flop wird immer zu dritt gelegt: Slot 3 und 4 erst danach freigeben.
              const locked = index >= 3 ? spot.board.length < index : false;
              return (
                <CardSlot
                  key={index}
                  card={card}
                  size="lg"
                  label={BOARD_LABELS[index]}
                  active={isNext('board', index)}
                  dealDelay={card !== null ? 0.12 + index * 0.06 : undefined}
                  ring={card !== null && highlightSet.has(card) ? 'gold' : null}
                  onClick={() => !locked && onSlotClick({ area: 'board', index })}
                  onRemove={card !== null ? () => onRemove({ area: 'board', index }) : undefined}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/50">
            Board leer lassen für eine reine Preflop-Analyse.
          </p>
        </div>
      </div>
    </section>
  );
}
