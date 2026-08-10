import { describe, expect, it } from 'vitest';
import {
  MAX_SEATS,
  activeOpponentCount,
  addSeat,
  advanceHand,
  createHeroSeat,
  emptyTable,
  heroPosition,
  nextOccupiedSeat,
  occupiedSeatsInOrder,
  positionAtDistance,
  removeSeat,
  resetFolds,
  seatLayoutPercent,
  seatPositions,
  toggleFold,
  type Seat,
} from '../table';

/** n Plätze am Stück besetzt (Hero + n-1 Gegner), Rest leer – wie ein "voller" Tisch ohne Lücken. */
function fullTable(n: number): Array<Seat | null> {
  const seats = emptyTable();
  for (let i = 1; i < n; i++) seats[i] = { id: `s${i}`, name: `P${i}`, active: true };
  return seats;
}

describe('Sitzplatzverwaltung', () => {
  it('startet mit Hero auf Platz 0 und sonst leer', () => {
    const seats = emptyTable();
    expect(seats).toHaveLength(MAX_SEATS);
    expect(seats[0]).toEqual(createHeroSeat());
    expect(seats.slice(1).every((s) => s === null)).toBe(true);
  });

  it('besetzt und leert Plätze', () => {
    let seats = addSeat(emptyTable(), 2, 'Alex');
    expect(seats[2]?.name).toBe('Alex');
    expect(seats[2]?.active).toBe(true);

    seats = removeSeat(seats, 2);
    expect(seats[2]).toBeNull();
  });

  it('lässt Hero nicht entfernen oder überschreiben', () => {
    const seats = emptyTable();
    expect(removeSeat(seats, 0)[0]).not.toBeNull();
    expect(addSeat(seats, 0, 'Jemand')[0]?.name).toBe('Du');
  });

  it('vergibt einen Platzhalternamen, wenn kein Name eingegeben wurde', () => {
    const seats = addSeat(emptyTable(), 3, '   ');
    expect(seats[3]?.name).toBe('Platz 4');
  });

  it('foldet und holt zurück, ohne den Namen zu verlieren', () => {
    let seats = addSeat(emptyTable(), 1, 'Bo');
    seats = toggleFold(seats, 1);
    expect(seats[1]?.active).toBe(false);
    expect(seats[1]?.name).toBe('Bo');
    seats = toggleFold(seats, 1);
    expect(seats[1]?.active).toBe(true);
  });

  it('foldet Hero nicht', () => {
    const seats = emptyTable();
    expect(toggleFold(seats, 0)[0]?.active).toBe(true);
  });

  it('setzt alle Folds zurück', () => {
    let seats = addSeat(emptyTable(), 1, 'Bo');
    seats = addSeat(seats, 2, 'Cee');
    seats = toggleFold(seats, 1);
    seats = toggleFold(seats, 2);
    seats = resetFolds(seats);
    expect(seats[1]?.active).toBe(true);
    expect(seats[2]?.active).toBe(true);
  });
});

describe('Besetzte Plätze & Gegnerzahl', () => {
  it('listet besetzte Plätze in Tischreihenfolge, Lücken übersprungen', () => {
    let seats = addSeat(emptyTable(), 3, 'C');
    seats = addSeat(seats, 1, 'A');
    const order = occupiedSeatsInOrder(seats);
    expect(order.map((o) => o.rawIndex)).toEqual([0, 1, 3]);
  });

  it('zählt nur aktive Gegner, nicht Hero und nicht Gefoldete', () => {
    let seats = addSeat(emptyTable(), 1, 'A');
    seats = addSeat(seats, 2, 'B');
    seats = toggleFold(seats, 2);
    expect(activeOpponentCount(seats)).toBe(1);
  });

  it('zählt 0 Gegner an einem leeren Tisch', () => {
    expect(activeOpponentCount(emptyTable())).toBe(0);
  });
});

describe('Dealer weiterschieben', () => {
  it('findet den nächsten besetzten Platz und überspringt Lücken', () => {
    let seats = addSeat(emptyTable(), 1, 'A');
    seats = addSeat(seats, 4, 'B');
    expect(nextOccupiedSeat(seats, 0)).toBe(1);
    expect(nextOccupiedSeat(seats, 1)).toBe(4);
    expect(nextOccupiedSeat(seats, 4)).toBe(0); // läuft rund um den Tisch
  });

  it('bleibt stehen, wenn nur ein Platz besetzt ist', () => {
    expect(nextOccupiedSeat(emptyTable(), 0)).toBe(0);
  });

  it('advanceHand schiebt den Button weiter und hebt alle Folds auf', () => {
    let seats = addSeat(emptyTable(), 1, 'A');
    seats = addSeat(seats, 2, 'B');
    seats = toggleFold(seats, 1);

    const result = advanceHand(seats, 0);
    expect(result.dealerSeat).toBe(1);
    expect(result.seats[1]?.active).toBe(true);
  });
});

describe('Positionen', () => {
  it('reproduziert die Positionsnamen für einen lückenlosen Tisch', () => {
    // Deckt sich mit den alten heroPosition(players, dealerSeat)-Fällen.
    expect(heroPosition(fullTable(6), 0).key).toBe('BTN'); // Hero ist selbst Dealer
    expect(heroPosition(fullTable(6), 5).key).toBe('SB'); // Dealer sitzt direkt vor Hero
    expect(heroPosition(fullTable(6), 4).key).toBe('BB');
    expect(heroPosition(fullTable(6), 1).key).toBe('CO'); // Dealer sitzt direkt hinter Hero
    expect(heroPosition(fullTable(6), 2).key).toBe('HJ');
    expect(heroPosition(fullTable(9), 6).key).toBe('UTG');
    expect(heroPosition(fullTable(2), 0).key).toBe('BTN');
    expect(heroPosition(fullTable(2), 1).key).toBe('SB');
  });

  it('rechnet Lücken im Sitzplan korrekt heraus', () => {
    // Hero (0), leer (1,2), Gegner auf 3 und 7 – nur besetzte Plätze zählen für die Position.
    // Tischreihenfolge ist Hero → A → B → (zurück zu Hero). Dealer sitzt auf A:
    // im Uhrzeigersinn direkt danach kommt B (Small Blind), dann Hero (Big Blind).
    let seats = addSeat(emptyTable(), 3, 'A');
    seats = addSeat(seats, 7, 'B');
    const positions = seatPositions(seats, 3);
    expect(positions.get(3)?.key).toBe('BTN');
    expect(positions.get(7)?.key).toBe('SB');
    expect(positions.get(0)?.key).toBe('BB');
  });

  it('heads-up: der Dealer ist gleichzeitig Small Blind', () => {
    expect(positionAtDistance(2, 0).key).toBe('BTN');
    expect(positionAtDistance(2, 1).key).toBe('SB');
  });
});

describe('Tisch-Layout', () => {
  it('platziert Hero fest unten in der Mitte', () => {
    expect(seatLayoutPercent(4)[0]).toEqual({ left: 50, top: 90 });
  });

  it('liefert für jeden besetzten Platz genau einen Punkt', () => {
    for (const n of [1, 2, 3, 5, 9, 10]) {
      expect(seatLayoutPercent(n)).toHaveLength(n);
    }
  });

  it('setzt den einzigen Gegner bei Heads-up oben in die Mitte', () => {
    const [, opponent] = seatLayoutPercent(2);
    expect(opponent.left).toBeCloseTo(50, 0);
    expect(opponent.top).toBeLessThan(50);
  });

  it('verteilt mehrere Gegner symmetrisch links und rechts', () => {
    const points = seatLayoutPercent(3).slice(1);
    const [left, right] = points;
    expect(left.left).toBeLessThan(50);
    expect(right.left).toBeGreaterThan(50);
    expect(left.top).toBeCloseTo(right.top, 5);
  });

  it('liefert für einen leeren Tisch keine Punkte', () => {
    expect(seatLayoutPercent(0)).toEqual([]);
  });
});
