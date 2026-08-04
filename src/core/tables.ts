/**
 * Vorberechnete Lookup-Tabellen für den Evaluator.
 * Werden einmal beim Modul-Import gebaut (8192 Einträge, ~µs) und danach nur gelesen.
 */

/**
 * Index: 13-Bit-Rangmaske (Bit i gesetzt = Rang i vorhanden, 0 = Zwei … 12 = Ass).
 * Wert:  höchster Rang einer enthaltenen Straße **+ 1**, oder 0 wenn keine Straße.
 *
 * Das "+1" erlaubt die Prüfung `if (STRAIGHT_HIGH[mask])`, ohne dass die Straße
 * mit der Zwei als niedrigstem Rang (Wert 0) fälschlich als "keine Straße" gilt.
 * Die Wheel A-2-3-4-5 wird als Straße mit High-Card Fünf geführt.
 */
export const STRAIGHT_HIGH = buildStraightTable();

function buildStraightTable(): Uint8Array {
  const table = new Uint8Array(1 << 13);

  for (let mask = 0; mask < table.length; mask++) {
    // Von oben nach unten suchen, damit die höchste Straße gewinnt.
    for (let high = 12; high >= 4; high--) {
      const run = 0b11111 << (high - 4);
      if ((mask & run) === run) {
        table[mask] = high + 1;
        break;
      }
    }
    if (table[mask]) continue;

    // Wheel: Ass (12) zusammen mit 2,3,4,5 (Bits 0..3) – High-Card ist die Fünf (Rang 3).
    const wheel = (1 << 12) | 0b1111;
    if ((mask & wheel) === wheel) table[mask] = 3 + 1;
  }

  return table;
}
