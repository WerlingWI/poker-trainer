import { useMemo, useState } from 'react';
import {
  RANKS_DESC,
  RANK_LABELS,
  SUIT_DISPLAY_ORDER,
  SUIT_IS_RED,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  makeCard,
  type Card,
} from '../../core/cards';
import { Sheet } from '../ui/Sheet';
import { CardFace } from './CardFace';

interface CardPickerProps {
  open: boolean;
  onClose: () => void;
  /** Bereits vergebene Karten – werden ausgegraut und lassen sich nicht wählen. */
  used: readonly Card[];
  onPick: (card: Card) => void;
  title: string;
  compact: boolean;
  onToggleCompact: (compact: boolean) => void;
}

/**
 * Kartenwähler mit zwei Betriebsarten:
 *
 *  • "Schnell"  – erst der Wert, dann die Farbe. Sehr große Flächen, ideal am Handy.
 *  • "Raster"   – alle 52 Karten gleichzeitig sichtbar, wie im Spec beschrieben.
 *
 * In beiden Fällen gilt: eine bereits vergebene Karte ist ausgegraut und nicht wählbar,
 * doppelte Karten sind damit ausgeschlossen.
 */
export function CardPicker({
  open,
  onClose,
  used,
  onPick,
  title,
  compact,
  onToggleCompact,
}: CardPickerProps) {
  const [pendingRank, setPendingRank] = useState<number | null>(null);
  const usedSet = useMemo(() => new Set(used), [used]);

  const choose = (card: Card) => {
    if (usedSet.has(card)) return;
    onPick(card);
    setPendingRank(null);
  };

  const close = () => {
    setPendingRank(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={title}>
      <div className="mb-4 flex justify-center">
        <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
          {[
            { value: true, label: 'Schnell' },
            { value: false, label: 'Alle 52' },
          ].map((option) => (
            <button
              key={String(option.value)}
              onClick={() => onToggleCompact(option.value)}
              aria-pressed={compact === option.value}
              className={[
                'min-h-10 rounded-lg px-5 text-sm font-semibold transition',
                compact === option.value
                  ? 'bg-felt text-white'
                  : 'text-muted hover:bg-surface hover:text-ink',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {compact ? (
        <QuickPicker
          pendingRank={pendingRank}
          onRank={setPendingRank}
          onPick={choose}
          usedSet={usedSet}
        />
      ) : (
        <FullGrid onPick={choose} usedSet={usedSet} />
      )}
    </Sheet>
  );
}

function QuickPicker({
  pendingRank,
  onRank,
  onPick,
  usedSet,
}: {
  pendingRank: number | null;
  onRank: (rank: number | null) => void;
  onPick: (card: Card) => void;
  usedSet: Set<Card>;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm font-semibold text-muted">1. Wert</div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {RANKS_DESC.map((rank) => {
            // Ein Wert ist nur wählbar, solange mindestens eine Farbe davon frei ist.
            const available = SUIT_DISPLAY_ORDER.some((s) => !usedSet.has(makeCard(rank, s)));
            const active = pendingRank === rank;
            return (
              <button
                key={rank}
                disabled={!available}
                onClick={() => onRank(rank)}
                className={[
                  'min-h-14 rounded-xl border text-xl font-bold transition',
                  active
                    ? 'border-gold bg-gold text-[#20180a]'
                    : 'border-line bg-surface-2 text-ink hover:border-felt-line',
                  available ? '' : 'opacity-25',
                ].join(' ')}
              >
                {RANK_LABELS[rank]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-muted">2. Farbe</div>
        <div className="grid grid-cols-4 gap-2">
          {SUIT_DISPLAY_ORDER.map((suit) => {
            const card = pendingRank === null ? null : makeCard(pendingRank, suit);
            const disabled = card === null || usedSet.has(card);
            return (
              <button
                key={suit}
                disabled={disabled}
                onClick={() => card !== null && onPick(card)}
                aria-label={SUIT_NAMES[suit]}
                className={[
                  'flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border transition',
                  'border-line bg-surface-2 hover:border-felt-line disabled:opacity-25',
                  SUIT_IS_RED[suit] ? 'text-card-red' : 'text-ink',
                ].join(' ')}
              >
                <span className="text-3xl leading-none">{SUIT_SYMBOLS[suit]}</span>
                <span className="text-[0.7rem] text-muted">{SUIT_NAMES[suit]}</span>
              </button>
            );
          })}
        </div>
        {pendingRank === null && (
          <p className="mt-2 text-center text-sm text-muted">Wähle zuerst einen Wert.</p>
        )}
      </div>
    </div>
  );
}

function FullGrid({ onPick, usedSet }: { onPick: (card: Card) => void; usedSet: Set<Card> }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="w-max space-y-1.5">
        {SUIT_DISPLAY_ORDER.map((suit) => (
          <div key={suit} className="flex gap-1.5">
            {RANKS_DESC.map((rank) => {
              const card = makeCard(rank, suit);
              const isUsed = usedSet.has(card);
              return (
                <button
                  key={card}
                  disabled={isUsed}
                  aria-disabled={isUsed}
                  onClick={() => onPick(card)}
                  className="rounded-lg transition enabled:hover:-translate-y-1 enabled:hover:brightness-105 disabled:cursor-not-allowed"
                >
                  <CardFace card={card} size="xs" dimmed={isUsed} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
