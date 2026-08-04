import {
  RANK_LABELS,
  SUIT_IS_RED,
  SUIT_SYMBOLS,
  cardLabel,
  cardRank,
  cardSuit,
  type Card,
} from '../../core/cards';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Breite der Karte in rem. Alle Schriftgrößen im Inneren sind in `em` relativ
 * dazu angegeben – eine Karte skaliert dadurch als Ganzes, ohne dass
 * Randabstände oder Symbole aus dem Verhältnis laufen.
 */
const WIDTH_REM: Record<CardSize, number> = {
  xs: 1.75,
  sm: 2.6,
  md: 3.5,
  lg: 4.6,
  xl: 5.8,
};

/** Klassisches Spielkartenformat. */
const ASPECT = 1.4;

interface CardFaceProps {
  card: Card;
  size?: CardSize;
  /** Abgeschwächt darstellen – z.B. bereits vergebene Karten im Wähler. */
  dimmed?: boolean;
  /** Farbiger Rahmen, etwa für Outs oder die fünf zählenden Karten. */
  ring?: 'win' | 'tie' | 'loss' | 'gold' | null;
  /** Verzögerung der Austeil-Animation in Sekunden. */
  dealDelay?: number;
  className?: string;
}

export function CardFace({
  card,
  size = 'md',
  dimmed,
  ring = null,
  dealDelay,
  className = '',
}: CardFaceProps) {
  const rank = cardRank(card);
  const suit = cardSuit(card);
  const width = WIDTH_REM[size];
  const isRed = SUIT_IS_RED[suit];

  const ringClass = ring
    ? {
        win: 'ring-2 ring-win',
        tie: 'ring-2 ring-tie',
        loss: 'ring-2 ring-loss',
        gold: 'ring-2 ring-gold',
      }[ring]
    : '';

  return (
    <div
      role="img"
      aria-label={cardLabel(card)}
      className={[
        'relative shrink-0 select-none rounded-[0.18em] border border-black/15',
        'shadow-[var(--shadow-card)] transition',
        dimmed ? 'opacity-25 saturate-50' : '',
        dealDelay !== undefined ? 'animate-deal' : '',
        ringClass,
        className,
      ].join(' ')}
      style={{
        width: `${width}rem`,
        height: `${width * ASPECT}rem`,
        // Alle Innenmaße hängen an dieser Basisgröße.
        fontSize: `${width * 0.3}rem`,
        borderRadius: `${width * 0.13}rem`,
        background: 'linear-gradient(160deg, #ffffff 0%, var(--color-card) 55%, #eceae4 100%)',
        color: isRed ? 'var(--color-card-red)' : 'var(--color-card-ink)',
        animationDelay: dealDelay !== undefined ? `${dealDelay}s` : undefined,
        perspective: '600px',
      }}
    >
      <div className="absolute top-[0.14em] left-[0.2em] flex flex-col items-center leading-none">
        <span className="text-[1em] font-bold tracking-tight">{RANK_LABELS[rank]}</span>
        <span className="text-[0.85em] leading-none">{SUIT_SYMBOLS[suit]}</span>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[2.1em] leading-none opacity-90">{SUIT_SYMBOLS[suit]}</span>
      </div>

      {/* Gespiegelter Eckindex – das kennt man von echten Karten. */}
      <div className="absolute right-[0.2em] bottom-[0.14em] flex rotate-180 flex-col items-center leading-none">
        <span className="text-[1em] font-bold tracking-tight">{RANK_LABELS[rank]}</span>
        <span className="text-[0.85em] leading-none">{SUIT_SYMBOLS[suit]}</span>
      </div>
    </div>
  );
}

interface CardSlotProps {
  card?: Card | null;
  size?: CardSize;
  label?: string;
  onClick?: () => void;
  onRemove?: () => void;
  dealDelay?: number;
  ring?: CardFaceProps['ring'];
  /** Hebt den Slot hervor, der als Nächstes gefüllt wird. */
  active?: boolean;
}

/**
 * Platz für genau eine Karte. Leer ist er eine gestrichelte Fläche, gefüllt zeigt
 * er die Karte mit einem kleinen Entfernen-Knopf.
 */
export function CardSlot({
  card,
  size = 'lg',
  label,
  onClick,
  onRemove,
  dealDelay,
  ring,
  active,
}: CardSlotProps) {
  const width = WIDTH_REM[size];

  if (card === null || card === undefined) {
    return (
      <button
        onClick={onClick}
        aria-label={label ? `${label} auswählen` : 'Karte auswählen'}
        className={[
          'flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition',
          active
            ? 'border-gold bg-gold/10 text-gold'
            : 'border-white/20 bg-black/15 text-white/40 hover:border-gold/60 hover:text-gold',
        ].join(' ')}
        style={{ width: `${width}rem`, height: `${width * ASPECT}rem` }}
      >
        <span className="text-2xl leading-none">+</span>
        {label && <span className="px-1 text-center text-[0.65rem] leading-tight">{label}</span>}
      </button>
    );
  }

  return (
    <div className="group relative shrink-0">
      <button
        onClick={onClick}
        aria-label={`${cardLabel(card)} – austauschen`}
        className="block transition hover:-translate-y-0.5"
      >
        <CardFace card={card} size={size} dealDelay={dealDelay} ring={ring} />
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`${cardLabel(card)} entfernen`}
          /* Sichtbar klein, damit die Karte im Vordergrund bleibt – die Trefferfläche
             wird per Pseudo-Element auf 48 px erweitert. */
          className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-lg leading-none text-muted shadow-[var(--shadow-lift)] transition before:absolute before:-inset-2.5 before:content-[''] hover:bg-danger hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Kartenrückseite – für den Stapel "verbleibendes Deck". */
export function CardBack({ size = 'sm' }: { size?: CardSize }) {
  const width = WIDTH_REM[size];
  return (
    <div
      aria-hidden="true"
      className="shrink-0 rounded-[0.18em] border border-black/30 shadow-[var(--shadow-card)]"
      style={{
        width: `${width}rem`,
        height: `${width * ASPECT}rem`,
        borderRadius: `${width * 0.13}rem`,
        background:
          'repeating-linear-gradient(45deg, #7f1d2b 0 4px, #9b2333 4px 8px), var(--color-felt-deep)',
      }}
    />
  );
}
