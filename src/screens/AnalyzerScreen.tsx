import { useEffect, useMemo, useRef, useState } from 'react';
import { DeckHeatmap, ImpactRow } from '../components/analysis/DeckHeatmap';
import { DrawList } from '../components/analysis/DrawList';
import { CardPicker } from '../components/cards/CardPicker';
import { PreGameSheet } from '../components/pregame/PreGameSheet';
import { OpponentProfile } from '../components/range/OpponentProfile';
import { EquityDonut, ResultBars } from '../components/results/EquityDonut';
import { RecommendationBanner } from '../components/results/Recommendation';
import { StatTile } from '../components/results/StatTile';
import { StrategyPanel } from '../components/results/StrategyPanel';
import { QuickBetBar } from '../components/table/QuickBetBar';
import { TableFelt, type SlotTarget } from '../components/table/TableFelt';
import { ShotClockBar } from '../components/timer/ShotClockBar';
import { Button } from '../components/ui/Button';
import { Panel, ProgressBar } from '../components/ui/Panel';
import { Segmented } from '../components/ui/Segmented';
import { Stepper } from '../components/ui/Stepper';
import { unknownCards, type Card } from '../core/cards';
import { analyzeDraws } from '../core/draws';
import { CATEGORY_LABELS, describeHand } from '../core/evaluator';
import { classifyHand, handCode } from '../core/handClass';
import { computeOdds, formatRatio, pct, recommend } from '../core/odds';
import { analyzeOuts, emptyOutsAnalysis, hitProbability } from '../core/outs';
import { resolveRange } from '../core/range';
import { buildPlan, computeImpliedOdds, preflopAdvice } from '../core/strategy';
import {
  cardsToCome,
  heroPosition,
  opponentCount,
  usedCards,
  type SpotState,
} from '../core/types';
import { useCardHotkeys } from '../hooks/useHotkeys';
import { useEquity } from '../hooks/useEquity';
import type { useShotClock } from '../hooks/useShotClock';
import type { SoundName } from '../hooks/useSound';
import type { AppState } from '../state/appStorage';

export const ITERATION_OPTIONS = [10_000, 50_000, 100_000, 500_000] as const;

interface AnalyzerScreenProps {
  spot: SpotState;
  setSpot: (update: SpotState | ((prev: SpotState) => SpotState)) => void;
  app: AppState;
  setApp: (update: AppState | ((prev: AppState) => AppState)) => void;
  onFinishedRun: (spot: SpotState, equity: number) => void;
  play: (name: SoundName) => void;
  clock: ReturnType<typeof useShotClock>;
}

export function AnalyzerScreen({
  spot,
  setSpot,
  app,
  setApp,
  onFinishedRun,
  play,
  clock,
}: AnalyzerScreenProps) {
  const [picker, setPicker] = useState<SlotTarget | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showPreGame, setShowPreGame] = useState(false);

  const equity = useEquity(spot, app.iterations);
  const used = usedCards(spot);
  const opponents = opponentCount(spot);
  const toCome = cardsToCome(spot.board.length);

  // --- Karten setzen und entfernen ----------------------------------------
  const nextFreeSlot = useMemo(() => nextFreeSlotOf(spot), [spot.hole.length, spot.board.length]);

  /**
   * Der Zielplatz wird *innerhalb* des State-Updates aus dem jeweils aktuellen
   * Stand bestimmt. Sonst würden mehrere schnell hintereinander getippte Karten
   * alle im selben, veralteten Slot landen.
   */
  const placeCard = (card: Card, target: SlotTarget | null) => {
    play('card');
    setSpot((prev) => {
      if (prev.hole.includes(card) || prev.board.includes(card)) return prev;
      const slot = target ?? nextFreeSlotOf(prev);
      if (!slot) return prev;

      if (slot.area === 'hole') {
        const hole = [...prev.hole];
        hole[Math.min(slot.index, 1)] = card;
        return { ...prev, hole };
      }
      const board = [...prev.board];
      board[Math.min(slot.index, board.length)] = card;
      return { ...prev, board };
    });
    setPicker(null);
  };

  const removeCard = (target: SlotTarget) => {
    play('click');
    setSpot((prev) => {
      if (target.area === 'hole') {
        return { ...prev, hole: prev.hole.filter((_, i) => i !== target.index) };
      }
      // Boardkarten rutschen nach – ein Loch im Flop gibt es im echten Spiel nicht.
      return { ...prev, board: prev.board.filter((_, i) => i !== target.index) };
    });
  };

  const removeLast = () => {
    if (spot.board.length) removeCard({ area: 'board', index: spot.board.length - 1 });
    else if (spot.hole.length) removeCard({ area: 'hole', index: spot.hole.length - 1 });
  };

  const cycleIterations = () => {
    const index = ITERATION_OPTIONS.indexOf(app.iterations as (typeof ITERATION_OPTIONS)[number]);
    const next = ITERATION_OPTIONS[(index + 1) % ITERATION_OPTIONS.length];
    setApp((prev) => ({ ...prev, iterations: next }));
  };

  const pendingRank = useCardHotkeys({
    enabled: picker === null && !showHelp,
    onCard: (card) => placeCard(card, null),
    onBackspace: removeLast,
    onRerun: equity.rerun,
    onCycleIterations: cycleIterations,
    onToggleHelp: () => setShowHelp((value) => !value),
  });

  // --- Auswertung ----------------------------------------------------------
  const odds = computeOdds(equity.breakdown?.equity ?? 0, spot);
  const recommendation = recommend(equity.breakdown?.equity ?? 0, odds);
  const draws = useMemo(() => analyzeDraws(spot.hole, spot.board), [spot.hole, spot.board]);
  const handClass = classifyHand(spot.hole);

  const bestHand = useMemo(() => {
    const cards = [...spot.hole, ...spot.board];
    return cards.length >= 5 ? describeHand(cards) : null;
  }, [spot.hole, spot.board]);

  // Die Heatmap zeigt die *nächste* Boardkarte. Vor dem Flop wäre das die erste
  // Flopkarte – wenig aussagekräftig, weil danach noch vier weitere folgen.
  const showCardImpacts = spot.board.length >= 3 && toCome > 0;

  const outs = useMemo(() => {
    if (!equity.totals || !equity.breakdown || !showCardImpacts) return emptyOutsAnalysis(toCome);
    return analyzeOuts(equity.totals, equity.breakdown.equity, unknownCards(used), toCome);
    // `used` ändert sich mit jeder Karte, `equity.totals` mit jedem Lauf.
  }, [equity.totals, equity.breakdown, toCome, showCardImpacts, used.join(',')]);

  // --- Strategie: Implied Odds, Einsatzhöhen, Value/Bluff/Bluff-Catch -------
  const position = heroPosition(spot.players, spot.dealerSeat);
  const preflop = spot.board.length === 0 ? preflopAdvice(spot.hole, position.key) : null;
  const opponentRange = useMemo(() => resolveRange(spot.opponent), [spot.opponent]);

  const hitChance = showCardImpacts
    ? hitProbability(outs.outs.length, 52 - used.length, toCome)
    : 0;

  const implied = useMemo(
    () => computeImpliedOdds(hitChance, spot.pot, spot.call, spot.stack),
    [hitChance, spot.pot, spot.call, spot.stack],
  );

  const plan = useMemo(
    () =>
      buildPlan({
        equity: equity.breakdown?.equity ?? 0,
        odds,
        pot: spot.pot,
        call: spot.call,
        stack: spot.stack,
        madeCategory: bestHand?.category ?? null,
        hasDraw: draws.some((draw) => draw.tone === 'draw'),
        hasBlocker: draws.some((draw) => draw.key === 'flush-blocker'),
      }),
    [equity.breakdown, odds, spot.pot, spot.call, spot.stack, bestHand, draws],
  );

  const winningHands = useMemo(() => {
    if (!equity.totals) return [];
    const total = equity.totals.iterations || 1;
    return [...equity.totals.categoryWin]
      .map((wins, category) => ({ category, share: wins / total }))
      .filter((entry) => entry.share > 0.005)
      .sort((a, b) => b.share - a.share);
  }, [equity.totals]);

  /*
   * Verbuchen in Statistik und History – aber erst, wenn die Situation ein paar
   * Sekunden unverändert steht. Sonst landet jeder Zwischenstand beim Eingeben
   * einer Hand als eigener Eintrag (erst die zwei Karten, dann der Flop, dann der Turn).
   */
  const recordedKey = useRef<string>('');
  useEffect(() => {
    if (equity.running || !equity.breakdown) return;
    const key = `${spot.hole.join(',')}|${spot.board.join(',')}|${opponents}`;
    if (recordedKey.current === key) return;

    const equityValue = equity.breakdown.equity;
    const timer = setTimeout(() => {
      recordedKey.current = key;
      onFinishedRun(spot, equityValue);
      play(equityValue >= 0.5 ? 'win' : 'lose');
    }, 2_500);
    return () => clearTimeout(timer);
    // `spot` bewusst nicht als Abhängigkeit: Pot-/Call-Änderungen lösen keinen neuen Lauf aus.
  }, [equity.running, equity.breakdown, opponents]);

  const ready = spot.hole.length === 2;

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowPreGame(true)}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 text-sm font-bold text-gold transition hover:bg-gold/15"
      >
        <span aria-hidden="true">⚙</span> Vor dem Spiel – Blinds, Spieler &amp; Uhr einrichten
      </button>

      <ShotClockBar clock={clock} onOpenPreGame={() => setShowPreGame(true)} />

      <TableFelt
        spot={spot}
        nextSlot={picker ?? nextFreeSlot}
        highlight={bestHand?.bestFive}
        onSlotClick={(target) => setPicker(target)}
        onRemove={removeCard}
      />

      {ready && <QuickBetBar spot={spot} setSpot={setSpot} />}

      {pendingRank !== null && (
        <p className="text-center text-sm text-gold">
          Wert erfasst – jetzt die Farbe tippen (s = Pik, h = Herz, d = Karo, c = Kreuz).
        </p>
      )}

      {!ready ? (
        <EmptyState />
      ) : (
        <>
          {equity.running && (
            <ProgressBar
              value={equity.progress}
              label={`${app.iterations.toLocaleString('de-DE')} Simulationen · ${equity.workers} Kerne`}
            />
          )}

          {equity.error && (
            <p className="rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">
              {equity.error}
            </p>
          )}

          {equity.breakdown && (
            <>
              <section className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
                <EquityDonut breakdown={equity.breakdown} running={equity.running} />
                <div className="space-y-4">
                  <ResultBars breakdown={equity.breakdown} />
                  {!equity.running && (
                    <p className="text-xs leading-snug text-muted">
                      {equity.totals?.iterations.toLocaleString('de-DE')} Simulationen in{' '}
                      {Math.round(equity.durationMs)} ms · gegen {opponents}{' '}
                      {opponents === 1 ? 'Gegner' : 'Gegner'}
                      {spot.opponent.mode === 'random'
                        ? ' mit zufälligen Karten'
                        : ` aus einer Range von ${(opponentRange.percent * 100).toFixed(1).replace('.', ',')} %`}
                    </p>
                  )}
                </div>
              </section>

              <RecommendationBanner recommendation={recommendation} />

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Pot Odds"
                  value={formatRatio(odds.ratio)}
                  hint={`${spot.call} zahlen für einen Pot von ${spot.pot}`}
                />
                <StatTile
                  label="Benötigte Equity"
                  value={`${pct(odds.requiredEquity)} %`}
                  hint={`Du hast ${pct(equity.breakdown.equity)} %`}
                  tone={
                    equity.breakdown.equity >= odds.requiredEquity ? 'positive' : 'negative'
                  }
                />
                <StatTile
                  label="Outs"
                  value={showCardImpacts ? outs.outs.length : '–'}
                  hint={
                    showCardImpacts
                      ? `${pct(hitProbability(outs.outs.length, 52 - used.length, toCome), 0)} % Trefferchance`
                      : spot.board.length === 5
                        ? 'Board vollständig'
                        : 'erst ab dem Flop'
                  }
                  tone="gold"
                />
                <StatTile
                  label="EV des Calls"
                  value={`${odds.ev >= 0 ? '+' : ''}${odds.ev.toFixed(1)}`}
                  hint={`SPR ${odds.spr.toFixed(1)}${odds.isAllIn ? ' · All-in' : ''}`}
                  tone={odds.ev >= 0 ? 'positive' : 'negative'}
                />
              </div>
            </>
          )}

          {equity.breakdown && (
            <Panel title="Spielplan">
              <StrategyPanel plan={plan} implied={implied} />
            </Panel>
          )}

          <Panel title="Was du hast">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-surface-2 px-3 py-1.5 text-lg font-black">
                  {handCode(spot.hole)}
                </span>
                <span className="text-sm text-muted">
                  {handClass.label} · {handClass.description}
                </span>
              </div>

              {preflop && (
                <div
                  className={`rounded-xl border p-3 text-sm leading-snug ${
                    preflop.playable
                      ? 'border-win/40 bg-win/10'
                      : 'border-loss/40 bg-loss/10'
                  }`}
                >
                  <div className="mb-1 font-bold">
                    Position: {position.label} ({position.key})
                  </div>
                  {preflop.text}
                </div>
              )}

              <DrawList draws={draws} />
              {winningHands.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold">Womit du gewinnst</h4>
                  <ul className="space-y-1.5">
                    {winningHands.map((entry) => (
                      <li key={entry.category} className="flex items-center gap-3 text-sm">
                        <span className="w-32 shrink-0 text-muted">
                          {CATEGORY_LABELS[entry.category]}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className="block h-full rounded-full bg-win"
                            style={{ width: `${entry.share * 100}%` }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right font-bold tabular-nums">
                          {pct(entry.share, 1)} %
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>

          {showCardImpacts && (
            <Panel title={`Welche Karte hilft dir? (${toCome === 2 ? 'Turn' : 'River'})`}>
              <div className="space-y-5">
                <p className="text-sm leading-snug text-muted">
                  Jede Karte zeigt, wie sich deine Equity ändert, wenn genau sie als Nächstes
                  kommt. Als Out zählt hier alles ab +10 Prozentpunkten – das sind oft mehr
                  Karten als der Lehrbuchwert des reinen Draws, weil auch ein zweites Paar oder
                  ein Drilling dich nach vorne bringen kann.
                </p>
                <DeckHeatmap analysis={outs} used={used} />
                <ImpactRow
                  title="Deine Outs"
                  impacts={outs.outs}
                  emptyText="Keine Karte hebt deine Equity deutlich – du bist entweder schon vorn oder chancenlos."
                  ring="win"
                />
                <ImpactRow
                  title="Gefährliche Karten"
                  impacts={outs.dangerous}
                  emptyText="Keine Karte schadet dir nennenswert."
                  ring="loss"
                />
              </div>
            </Panel>
          )}
        </>
      )}

      <Panel
        title="Gegner"
        collapsible
        defaultOpen={false}
        action={
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold tabular-nums text-muted">
            {spot.opponent.mode === 'random'
              ? 'zufällig'
              : `${(opponentRange.percent * 100).toFixed(0)} %`}
          </span>
        }
      >
        <OpponentProfile
          model={spot.opponent}
          hole={spot.hole}
          onChange={(opponent) => setSpot((prev) => ({ ...prev, opponent }))}
        />
      </Panel>

      <Panel title="Situation" collapsible defaultOpen={false}>
        <SpotSettings spot={spot} setSpot={setSpot} />
      </Panel>

      <Panel title="Simulation" collapsible defaultOpen={false}>
        <div className="space-y-4">
          <Segmented
            label="Anzahl Simulationen"
            value={app.iterations}
            onChange={(iterations) => setApp((prev) => ({ ...prev, iterations }))}
            options={ITERATION_OPTIONS.map((value) => ({
              value,
              label: value >= 1000 ? `${value / 1000}k` : String(value),
            }))}
            dense
          />
          <p className="text-xs text-muted">
            Mehr Simulationen bedeuten weniger Rauschen. Gerechnet wird in {equity.workers}{' '}
            Hintergrund-Prozessen, die Oberfläche bleibt dabei bedienbar.
          </p>
          <Button block onClick={equity.rerun} disabled={!ready}>
            Neu berechnen
          </Button>
        </div>
      </Panel>

      <div className="text-center">
        <button
          onClick={() => setShowHelp(true)}
          className="min-h-11 px-4 text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
          Tastenkürzel anzeigen
        </button>
      </div>

      <CardPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.area === 'hole' ? 'Deine Karte wählen' : 'Boardkarte wählen'}
        used={used}
        compact={app.compactPicker}
        onToggleCompact={(compactPicker) => setApp((prev) => ({ ...prev, compactPicker }))}
        onPick={(card) => placeCard(card, picker)}
      />

      <ShortcutHelp open={showHelp} onClose={() => setShowHelp(false)} />

      <PreGameSheet
        open={showPreGame}
        onClose={() => setShowPreGame(false)}
        spot={spot}
        setSpot={setSpot}
        clockConfig={app.clock}
        onClockConfigChange={(clockConfig) => setApp((prev) => ({ ...prev, clock: clockConfig }))}
        clock={clock}
      />
    </div>
  );
}

/** Der nächste zu füllende Platz: erst die beiden eigenen Karten, dann das Board. */
function nextFreeSlotOf(spot: SpotState): SlotTarget | null {
  if (spot.hole.length < 2) return { area: 'hole', index: spot.hole.length };
  if (spot.board.length < 5) return { area: 'board', index: spot.board.length };
  return null;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line p-8 text-center">
      <p className="text-lg font-semibold">Wähle deine zwei Karten</p>
      <p className="mt-1 text-sm text-muted">
        Sobald beide liegen, rechnet die App automatisch. Board ist optional.
      </p>
    </div>
  );
}

function SpotSettings({
  spot,
  setSpot,
}: {
  spot: SpotState;
  setSpot: (update: SpotState | ((prev: SpotState) => SpotState)) => void;
}) {
  const position = heroPosition(spot.players, spot.dealerSeat);
  const update = (patch: Partial<SpotState>) => setSpot((prev) => ({ ...prev, ...patch }));

  return (
    <div className="space-y-4">
      <Stepper
        label="Spieler am Tisch (inkl. dir)"
        value={spot.players}
        min={2}
        max={10}
        onChange={(players) =>
          update({ players, dealerSeat: Math.min(spot.dealerSeat, players - 1) })
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <Stepper label="Small Blind" value={spot.smallBlind} min={0} onChange={(smallBlind) => update({ smallBlind })} />
        <Stepper label="Big Blind" value={spot.bigBlind} min={1} onChange={(bigBlind) => update({ bigBlind })} />
      </div>

      <div>
        <Stepper
          label="Dealer sitzt … Plätze nach dir"
          value={spot.dealerSeat}
          min={0}
          max={spot.players - 1}
          onChange={(dealerSeat) => update({ dealerSeat })}
        />
        <p className="mt-1.5 text-sm text-muted">
          Deine Position: <strong className="text-gold">{position.label}</strong> – {position.hint}
        </p>
      </div>

      <p className="text-xs text-muted">
        Pot, Call und Stack stellst du direkt oben in der Schnelleingabe ein – hier geht es nur um
        Blinds, Position und die Einsatzhistorie.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Stepper
          label="Raise preflop"
          value={spot.raisePreflop}
          min={0}
          step={spot.bigBlind}
          onChange={(raisePreflop) => update({ raisePreflop })}
        />
        <Stepper
          label="Raise postflop"
          value={spot.raisePostflop}
          min={0}
          step={spot.bigBlind}
          onChange={(raisePostflop) => update({ raisePostflop })}
        />
      </div>
      <p className="text-xs text-muted">
        Die Raise-Felder sind reine Notizen zur Vorgeschichte – in die Rechnung gehen Pot, Call
        und Stack ein.
      </p>
    </div>
  );
}

function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows: Array<[string, string]> = [
    ['A K D B 10 9 … 2', 'Wert der Karte tippen'],
    ['s h d c', 'danach die Farbe: Pik, Herz, Karo, Kreuz'],
    ['Rücktaste', 'letzte Karte entfernen'],
    ['Leertaste', 'neu berechnen'],
    ['1', 'Anzahl Simulationen durchschalten'],
    ['Esc', 'Eingabe abbrechen'],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="animate-rise relative w-full max-w-md rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-lg font-bold">Tastenkürzel</h2>
        <dl className="space-y-2">
          {rows.map(([keys, text]) => (
            <div key={keys} className="flex items-baseline justify-between gap-4 text-sm">
              <dt className="rounded-md bg-surface-2 px-2 py-1 font-mono text-xs">{keys}</dt>
              <dd className="flex-1 text-right text-muted">{text}</dd>
            </div>
          ))}
        </dl>
        <Button block className="mt-4" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </div>
  );
}
