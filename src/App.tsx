import { useCallback, useEffect, useState } from 'react';
import { defaultSpot, type SpotState } from './core/types';
import { useLocalState } from './hooks/useLocalState';
import { useShotClock } from './hooks/useShotClock';
import { useSound } from './hooks/useSound';
import { AnalyzerScreen } from './screens/AnalyzerScreen';
import { LearnScreen } from './screens/LearnScreen';
import { StatsScreen } from './screens/StatsScreen';
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  defaultAppState,
  recordAnswer,
  recordHand,
  removeHistoryEntry,
  toggleFavorite,
} from './state/appStorage';

type TabKey = 'analyse' | 'lernen' | 'statistik';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'analyse', label: 'Analyse', icon: '♠' },
  { key: 'lernen', label: 'Lernen', icon: '◎' },
  { key: 'statistik', label: 'Statistik', icon: '▤' },
];

export default function App() {
  const [app, setApp, resetApp] = useLocalState(STORAGE_KEY, STORAGE_VERSION, defaultAppState());
  const [spot, setSpot] = useState<SpotState>(defaultSpot);
  const [tab, setTab] = useState<TabKey>('analyse');
  const play = useSound(app.sound);
  // Eine einzige Uhr für die ganze Session – lebt hier oben, damit das Pre-Game-Fenster
  // (Spieler hinzufügen) und die Anzeige in der Analyse dieselbe Instanz teilen.
  const clock = useShotClock(app.clock, play);

  // Theme auf das <html>-Element schreiben – dort greifen die CSS-Variablen.
  useEffect(() => {
    document.documentElement.dataset.theme = app.theme;
  }, [app.theme]);

  const handleFinishedRun = useCallback(
    (finished: SpotState, equity: number) => setApp((prev) => recordHand(prev, finished, equity)),
    [setApp],
  );

  const handleAnswer = useCallback(
    (correct: boolean) => setApp((prev) => recordAnswer(prev, correct)),
    [setApp],
  );

  const restoreSpot = useCallback((restored: SpotState) => {
    setSpot(restored);
    setTab('analyse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-2xl leading-none text-gold">
              ♠
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight font-black">Poker Odds Trainer</h1>
              <p className="truncate text-[0.7rem] text-muted">
                Lernen &amp; Analysieren – alles lokal im Browser
              </p>
            </div>
          </div>

          <div className="ml-auto flex gap-1">
            <IconToggle
              active={app.sound}
              onClick={() => setApp((prev) => ({ ...prev, sound: !prev.sound }))}
              label={app.sound ? 'Ton ausschalten' : 'Ton einschalten'}
            >
              {app.sound ? '♪' : '♪̸'}
            </IconToggle>
            <IconToggle
              active={app.theme === 'light'}
              onClick={() =>
                setApp((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))
              }
              label={app.theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
            >
              {app.theme === 'dark' ? '☀' : '☾'}
            </IconToggle>
          </div>
        </div>

        {/* Tabs auf dem Desktop oben, auf dem Handy unten – siehe Leiste am Seitenende. */}
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 sm:flex">
          {TABS.map((item) => (
            <TabButton
              key={item.key}
              active={tab === item.key}
              onClick={() => setTab(item.key)}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-4 pb-28 sm:pb-10">
        {tab === 'analyse' && (
          <AnalyzerScreen
            spot={spot}
            setSpot={setSpot}
            app={app}
            setApp={setApp}
            onFinishedRun={handleFinishedRun}
            play={play}
            clock={clock}
          />
        )}
        {tab === 'lernen' && <LearnScreen app={app} onAnswer={handleAnswer} play={play} />}
        {tab === 'statistik' && (
          <StatsScreen
            app={app}
            onToggleFavorite={(id) => setApp((prev) => toggleFavorite(prev, id))}
            onRemove={(id) => setApp((prev) => removeHistoryEntry(prev, id))}
            onRestore={restoreSpot}
            onReset={resetApp}
          />
        )}
      </main>

      {/* Tab-Leiste am unteren Rand: auf dem Handy immer in Daumenreichweite. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 border-t border-line bg-bg/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        {TABS.map((item) => (
          <TabButton
            key={item.key}
            active={tab === item.key}
            onClick={() => setTab(item.key)}
            icon={item.icon}
            label={item.label}
            stacked
          />
        ))}
      </nav>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  stacked,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  stacked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex flex-1 items-center justify-center gap-2 rounded-xl font-bold transition',
        stacked ? 'min-h-14 flex-col gap-0.5 text-xs' : 'min-h-11 px-5 text-base',
        active ? 'bg-felt text-white' : 'text-muted hover:bg-surface-2 hover:text-ink',
      ].join(' ')}
    >
      <span aria-hidden="true" className={stacked ? 'text-lg leading-none' : ''}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function IconToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex size-11 items-center justify-center rounded-xl border text-lg transition ${
        active
          ? 'border-gold/50 bg-gold/15 text-gold'
          : 'border-line bg-surface text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
