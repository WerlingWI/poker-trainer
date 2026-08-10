# Poker Odds Trainer

Lern- und Analyse-App für Texas Hold'em. Hand eingeben, in Sekunden Equity, Pot Odds,
Outs, Implied Odds und eine begründete Empfehlung sehen.

**Die App dient ausschließlich dem Lernen und Analysieren.** Sie hat keinerlei Verbindung
zu Online-Poker-Seiten und rechnet vollständig lokal im Browser – es werden keine Daten
gesendet und nichts außerhalb des eigenen Geräts gespeichert.

## Schnellstart

```bash
npm install && npm run dev
```

Danach `http://localhost:5173` öffnen. `npm test` führt die Testsuite aus,
`npm run build` erzeugt den Produktions-Build.

## Was die App kann

**Analyse** – Zwei eigene Karten genügen; das Board ist optional. Die Simulation startet
automatisch, ohne Klick auf einen Berechnen-Knopf.

- **Der Pokertisch ist der Hauptfokus**: eine Ellipse mit Sitzplätzen rings herum, Hero fest
  unten in der Mitte. Ein Tipp auf einen leeren Platz besetzt ihn mit Namen, ein Tipp auf
  einen besetzten Platz öffnet Fold, „Dealer hierher" und die Range, die dieser Spieler aus
  seiner aktuellen Position üblicherweise eröffnet (13×13-Matrix, live aus Sitzordnung und
  Dealer-Position berechnet). „▶ Nächste Hand" schiebt den Button einen Platz weiter, hebt
  alle Folds auf und setzt Karten sowie Pot/Call auf die Blind-Grundstellung zurück. Foldet
  jeder Gegner, meldet die App den Pot kampflos gewonnen, statt sinnlos zu simulieren.
- **Pre-Game-Fenster** (Knopf oben auf der Analyse-Seite): Blinds und Startstack als
  antippbare Presets, an der Stakes-Auswahl von Plattformen wie GGPoker orientiert – dazu
  die Shot-Clock-Einstellungen und die Spielerliste für die Uhr. Lässt sich jederzeit erneut
  öffnen, auch mitten im Abend.
- **Shot-Clock direkt in der Analyse**: Jede Entscheidung beginnt mit einer festen
  Reaktionszeit (Standard 10 s). Läuft sie ab, ohne dass gehandelt wurde, zehrt automatisch
  die persönliche Timebank des Spielers weiter herunter – ein über den Abend endlicher
  Vorrat (Standard 60 s). Ist sie aufgebraucht, bleibt ab diesem Moment für jede künftige
  Entscheidung nur noch die reine Reaktionszeit, ohne weitere Verlängerung. Ein Tipp auf den
  Namen startet die Uhr; sie läuft über echte Wanduhrzeit statt fester Schrittweiten und
  bleibt so auch korrekt, wenn das Handy-Display kurz aus geht oder der Tab gewechselt wird.
- **Schnelleingabe während der Hand**: Pot, Call und Stack sind immer sichtbar, dazu
  Bet-Size-Chips (Check · ⅓ · ½ · ⅔ · Pot · All-in), die den Call direkt als Anteil vom
  aktuellen Pot setzen – schneller getippt als hochzuzählen.
- Gewinn-, Split- und Verlustwahrscheinlichkeit sowie Equity, als Kreis- und Balkendiagramm
- Pot Odds, benötigte Equity, EV des Calls, SPR
- Empfehlung: **CALL · FOLD · CHECK · ERHÖHEN · SETZEN · GRENZFALL** – jeweils mit den
  konkreten Zahlen als Begründung
- Spielplan: Value Bet, dünner Value Bet, Bluff, Bluff Catch oder aufgeben, samt
  Einsatzhöhen und der Fold Equity, die ein Bluff dieser Größe bräuchte
- Implied Odds: wie viel du auf späteren Straßen noch gewinnen musst, damit ein
  Draw-Call aufgeht – und ob dafür überhaupt genug im Stack liegt
- Draw-Erkennung: Flush Draw, Nut Flush Draw, Backdoor, OESD, Gutshot, doppelter Gutshot,
  Overcards, Blocker, sowie die fertige Hand
- Deck-Heatmap: für jede noch unbekannte Karte, wie sich die eigene Equity ändert, wenn
  genau sie als Nächstes kommt – daraus Outs, Hilfs- und Gefahrenkarten
- Position: Die eigene Position wird aus der Sitzordnung und dem Dealer-Platz abgeleitet und
  preflop mit der üblichen Eröffnungsbreite dieser Position verglichen

**Gegner-Ranges** – Statt gegen Zufallskarten lässt sich gegen eine konkrete Range rechnen:

| Modus | Bedeutung |
|---|---|
| Zufall | Keine Annahme – die Gegner halten beliebige Karten |
| Preset | UTG Open, CO, BTN Steal, BB Defense, 3-Bet, 4-Bet, Calling Station |
| Stats | Aus **VPIP**, **PFR**, **3-Bet %** und **ATS** wird die Range abgeleitet, passend zu der Aktion, die der Gegner gezeigt hat |
| Eigene | 13×13-Handmatrix zum Antippen, plus Schieber für „beste X %" |

Der Unterschied ist erheblich: AQo hat gegen zwei Zufallsgegner rund 47 % Equity –
gegen zwei 3-Bet-Ranges nur noch etwa 23 %.

**Lernen** – Zufällige, plausible Situationen; entscheide zwischen Call, Fold und Raise.
Danach die Auflösung mit Equity, benötigter Equity, Outs und Draws. Grenzfälle werden als
solche gewertet: Wo die Mathematik keine eindeutige Antwort gibt, zählen beide vertretbaren
Antworten. Auch Gegner-Ranges kommen vor, damit nicht nur Pot-Odds-Rechnen geübt wird.

**Statistik** – Lokal gespeichert: analysierte Hände, Ø-Equity, Trefferquote und Serie im
Lernmodus, Lieblingshände, Equity nach Handtyp und eine Hand-History mit Favoriten, aus der
sich jede Situation mit einem Tipp wiederherstellen lässt.

## Bedienung

Alles ist ohne Tastatur bedienbar – große Flächen, Bottom-Sheet-Kartenwähler, Tab-Leiste in
Daumenreichweite. Wer schneller sein will, tippt Karten direkt:

| Taste | Wirkung |
|---|---|
| `a k q j t 9 … 2` | Wert der Karte |
| `s h d c` | danach die Farbe: Pik, Herz, Karo, Kreuz |
| `Rücktaste` | letzte Karte entfernen |
| `Leertaste` | neu berechnen |
| `1` | Anzahl Simulationen durchschalten |
| `?` | Tastenkürzel anzeigen |

Dazu: helles und dunkles Design, optionale Soundeffekte (standardmäßig aus).

## Technik

React 19, TypeScript, Vite, TailwindCSS v4. Keine State-Library, keine Chart-Bibliothek,
keine Animations-Bibliothek – die einzigen Laufzeit-Abhängigkeiten sind `react` und
`react-dom`. Diagramme sind handgeschriebenes SVG, Animationen sind CSS.

```
src/
├── core/         reine Logik, kein React
│   ├── cards.ts        Karte = Zahl 0..51
│   ├── evaluator.ts    Bitmask-Evaluator, 5–7 Karten → vergleichbarer int32
│   ├── simulate.ts     Monte Carlo, mit oder ohne Gegner-Range
│   ├── handRanking.ts  die 169 Starthand-Klassen und ihre Rangfolge
│   ├── range.ts        Ranges, Presets, Ableitung aus Gegner-Stats
│   ├── table.ts         Sitzplätze, Dealer-Rotation, Positionsnamen, Tisch-Layout
│   ├── draws.ts        Draw-Erkennung
│   ├── outs.ts         Outs und Gefahrenkarten aus den Simulationsdaten
│   ├── odds.ts         Pot Odds, EV, Empfehlung
│   ├── strategy.ts     Implied Odds, Einsatzhöhen, Value/Bluff/Bluff-Catch
│   └── clock.ts         Shot-Clock: Reaktionszeit + Timebank als reine Zustandsmaschine
├── workers/      Rechen-Worker
├── hooks/        Worker-Pool, Persistenz, Tastatur, Sound, Shot-Clock (useShotClock)
├── components/   Pokertisch & Sitzplätze, Karten, Range-Matrix, Pre-Game, Ergebnisse, UI
└── screens/      Analyse (inkl. Tisch, Uhr & Pre-Game), Lernen, Statistik
```

### Geschwindigkeit

Der Evaluator arbeitet mit Bitmasken und allokiert im Hot Path nichts: Rangmaske,
Farbzähler und Straßen-Lookup ergeben direkt eine vergleichbare Ganzzahl. Die Simulation
läuft in bis zu sechs Web Workern parallel, jeder mit eigenem Seed. **500.000 Simulationen
gegen zwei Gegner brauchen so rund 100 ms**, und die Oberfläche bleibt währenddessen
bedienbar, weil auf dem Haupt-Thread nichts gerechnet wird.

### Wie die Zahlen zustande kommen

- **Equity** ist der Anteil am Pot über alle Simulationen: 1 bei Sieg, 1/k bei k-fachem
  Split, 0 bei Niederlage.
- **Outs** werden nicht geschätzt, sondern gemessen: Die Simulation hält fest, wie hoch die
  eigene Equity ausfällt, wenn eine bestimmte Karte als nächste kommt. Als Out zählt jede
  Karte ab +10 Prozentpunkten. Das sind oft mehr Karten als der Lehrbuchwert des reinen
  Draws – der steht daneben in der Draw-Liste.
- **Die Rangfolge der 169 Starthände** wurde mit der Engine dieses Projekts berechnet
  (Equity heads-up gegen eine zufällige Hand, 300.000 Simulationen pro Klasse). Der Test
  `range.test.ts` rechnet das nach.

### Grenzen des Modells

Die App weist an jeder Empfehlung darauf hin: Gerechnet wird gegen die eingestellte Range
(ohne Range: gegen zufällige Karten). **Fold Equity und das konkrete Spielverhalten der
Gegner sind nicht modelliert**, Implied Odds werden separat ausgewiesen und setzen voraus,
dass der Gegner beim Treffer wirklich zahlt. Die Range-Presets sind Richtwerte aus der
Praxis, keine Solver-Ausgaben.

## Tests

```bash
npm test
```

126 Tests, die wichtigsten:

- **Evaluator gegen ein unabhängiges Orakel** – 20.000 zufällige Sieben-Karten-Paare müssen
  dieselbe Rangordnung ergeben wie der ausführlich getestete, bewusst naive Referenz-Evaluator
  aus dem Projekt `poker-app` (mitkopiert unter `__tests__/oracle/`, klar als Testcode markiert).
- **Bekannte Werte** – AA gegen einen Zufallsgegner ≈ 85,2 %; Royal Flush, Wheel-Straße,
  Kicker-Vergleiche, garantierte Splits.
- **Ranges** – 169 Klassen decken exakt 1326 Kombinationen ab; einer Range werden nie
  bereits vergebene Karten ausgeteilt; zu enge Ranges brechen sauber ab statt zu verfälschen.
- **Determinismus** – gleicher Seed, gleiches Ergebnis.
