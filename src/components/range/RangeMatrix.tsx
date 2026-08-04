import { RANKS_DESC } from '../../core/cards';
import {
  handClassCode,
  handClassIndex,
  isPairClass,
  isSuitedClass,
} from '../../core/handRanking';
import type { Range } from '../../core/range';

interface RangeMatrixProps {
  range: Range;
  /** Fehlt der Handler, ist die Matrix nur Anzeige (z.B. bei abgeleiteten Ranges). */
  onToggle?: (classIndex: number) => void;
  /** Eigene Hand hervorheben, damit man sieht, wo man selbst steht. */
  highlight?: number | null;
}

/**
 * Das Standard-Raster aller Poker-Tools: 13×13 Felder, Paare auf der Diagonale,
 * suited oben rechts, offsuit unten links.
 *
 * Die Zellen sind bewusst quadratisch und über die volle Breite gestreckt –
 * so bleibt das Raster auch auf dem Handy vollständig sichtbar und antippbar,
 * ohne dass horizontal gescrollt werden muss.
 */
export function RangeMatrix({ range, onToggle, highlight }: RangeMatrixProps) {
  return (
    <div className="w-full">
      {/* Auf dem Handy zieht das Raster über die Kastenpolsterung hinaus,
          damit die 13 Spalten spürbar größer werden. */}
      <div className="-mx-2 grid grid-cols-13 gap-px sm:mx-0 sm:gap-[2px]">
        {RANKS_DESC.map((rowRank, row) =>
          RANKS_DESC.map((colRank, col) => {
            const suited = row < col;
            const classIndex = handClassIndex(rowRank, colRank, suited);
            const selected = range[classIndex] === 1;
            const isHighlight = highlight === classIndex;
            // "AKs" – immer hohe Karte zuerst, unabhängig von Zeile und Spalte.
            const code = handClassCode(classIndex);

            return (
              <button
                key={`${row}-${col}`}
                disabled={!onToggle}
                onClick={() => onToggle?.(classIndex)}
                aria-pressed={selected}
                aria-label={`${handClassCode(classIndex)}${selected ? ' – in der Range' : ''}`}
                title={handClassCode(classIndex)}
                className={[
                  'flex aspect-square items-center justify-center rounded-[3px] text-[0.55rem] leading-none font-bold transition sm:text-[0.7rem]',
                  selected
                    ? isPairClass(classIndex)
                      ? 'bg-gold text-[#20180a]'
                      : isSuitedClass(classIndex)
                        ? 'bg-win text-[#05231a]'
                        : 'bg-felt-line text-white'
                    : 'bg-surface-2 text-muted',
                  isHighlight ? 'ring-2 ring-gold ring-offset-1 ring-offset-surface' : '',
                  onToggle ? 'hover:brightness-125' : 'cursor-default',
                ].join(' ')}
              >
                {code.slice(0, 2)}
                {/* Das s/o passt erst auf breiteren Displays mit ins Feld. */}
                <span className="hidden sm:inline">{code.slice(2)}</span>
              </button>
            );
          }),
        )}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-gold" /> Paare
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-win" /> suited
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-felt-line" /> offsuit
        </li>
      </ul>
    </div>
  );
}
