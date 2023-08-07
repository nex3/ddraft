import chunk from 'lodash/chunk.js';
import includes from 'lodash/includes.js';
import pull from 'lodash/pull.js';

import {Card} from './card.js';
import {Cube} from './cube.js';
import {Database} from './db.js';
import * as utils from './utils.js';

interface SerializedSeat {
  readonly drafted: string[];
  readonly sideboard: string[];
  readonly packBacklog: string[][];
  readonly unopenedPacks: string[][];
  readonly readTime: number | null;
}

interface Seat {
  readonly drafted: Card[];
  readonly sideboard: Card[];
  readonly packBacklog: Card[][];
  readonly unopenedPacks: Card[][];
  readTime: Date | null;
}

export class Draft {
  static numberOfSeats = 8;

  static loadOrCreate(cube: Cube, db: Database): Draft {
    const serialized = db.get('seats') as SerializedSeat[] | undefined;
    if (serialized === undefined) {
      const packs = chunk(
        cube.getRandomCards(15 * 3 * Draft.numberOfSeats),
        15
      );
      const seats: Seat[] = chunk(packs, 3).map(
        ([currentPack, ...unopenedPacks]) => ({
          drafted: [],
          sideboard: [],
          packBacklog: [currentPack],
          unopenedPacks,
          readTime: null,
        })
      );

      const draft = new Draft(cube, db, seats);
      draft.save();
      return draft;
    } else {
      const deserializeCards = (names: string[]): Card[] =>
        names.map(name => cube.getCard(name));

      return new Draft(
        cube,
        db,
        serialized.map(seat => ({
          drafted: deserializeCards(seat.drafted),
          sideboard: deserializeCards(seat.sideboard),
          packBacklog: seat.packBacklog.map(deserializeCards),
          unopenedPacks: seat.unopenedPacks.map(deserializeCards),
          readTime: seat.readTime ? new Date(seat.readTime) : null,
        }))
      );
    }
  }

  get isDone(): boolean {
    return this.seats.every(
      seat => seat.drafted.length + seat.sideboard.length === 45
    );
  }

  get deckUrls(): Record<string, unknown>[] {
    return [...Array(Draft.numberOfSeats).keys()].map(i => {
      const drafted = this.cube.encodeCards(this.getDrafted(i));
      const sideboard = this.cube.encodeCards(this.getSideboard(i));
      const name = `Seat ${i + 1}`;
      const params = new URLSearchParams();
      params.set('sb', sideboard);
      params.set('n', name);
      return {name, deck: `/deck/${drafted}?${params}`, seat: `/seat/${i}`};
    });
  }

  private constructor(
    private cube: Cube,
    private db: Database,
    private seats: Seat[]
  ) {}

  /// Find the seat with the fewest picks that's been seen least recently.
  seatToShow(): number {
    const {index} = this.seats
      .map((seat, index) => ({...seat, index}))
      .reduce((best, next) => {
        const bestCount = best.drafted.length + best.sideboard.length;
        const nextCount = next.drafted.length + next.sideboard.length;
        if (bestCount < nextCount) return best;
        if (nextCount < bestCount) return next;

        if (best.readTime) {
          if (next.readTime && best.readTime < next.readTime) return best;
          return next;
        } else {
          return best;
        }
      });

    this.seats[index].readTime = new Date();
    this.save();
    return index;
  }

  seatImages(index: number): Record<string, string> {
    const response: Record<string, string> = {};

    const seat = this.seats[index];
    if (seat.drafted.length > 0) {
      response.deck_image = `/image/${this.cube.encodeCards(seat.drafted)}?cmc`;
    }

    if (seat.sideboard.length > 0) {
      response.sideboard_image = `/image/${this.cube.encodeCards(
        seat.sideboard
      )}`;
    }

    return response;
  }

  getPack(index: number): Card[] {
    this.checkSeatNumber(index);
    return this.seats[index].packBacklog[0] ?? [];
  }

  getDrafted(index: number): Card[] {
    this.checkSeatNumber(index);
    return this.seats[index].drafted;
  }

  getSideboard(index: number): Card[] {
    this.checkSeatNumber(index);
    return this.seats[index].sideboard;
  }

  packNumber(index: number): number {
    this.checkSeatNumber(index);
    return 3 - this.seats[index].unopenedPacks.length;
  }

  pick(index: number, name: string, sideboard: boolean): void {
    this.checkSeatNumber(index);
    const seat = this.seats[index];
    const pack = seat.packBacklog[0];
    if (!pack) {
      throw `Seat ${index} doesn't have a pack to pick from.`;
    }

    const pick = this.chooseCard(pack, name);
    pull(pack, pick);
    seat.packBacklog.shift();
    (sideboard ? seat.sideboard : seat.drafted).push(pick);

    if (pack.length === 0) {
      if (seat.unopenedPacks.length > 0) {
        seat.packBacklog.push(seat.unopenedPacks.shift()!);
      }
    } else {
      const direction = seat.unopenedPacks.length === 1 ? 1 : -1;
      let nextSeatIndex = index + direction;
      if (nextSeatIndex < 0) nextSeatIndex += 8;
      if (nextSeatIndex > 7) nextSeatIndex -= 8;

      const nextSeat = this.seats[nextSeatIndex];
      nextSeat.packBacklog.push(pack);
    }

    this.save();
  }

  swap(index: number, name: string): void {
    this.checkSeatNumber(index);
    const seat = this.seats[index];

    const card = this.chooseCard([...seat.drafted, ...seat.sideboard], name);
    if (includes(seat.drafted, card)) {
      pull(seat.drafted, card);
      seat.sideboard.push(card);
    } else {
      pull(seat.sideboard, card);
      seat.drafted.push(card);
    }

    this.save();
  }

  fixCards(name1: string, name2: string): void {
    const card1 = this.chooseCard(this.cube.cards, name1);
    const card2 = this.chooseCard(this.cube.cards, name2);
    if (card1 === card2) throw "Can't swap a card with itself!";

    for (const seat of this.seats) {
      utils.swapInArray(seat.drafted, card1, card2);
      utils.swapInArray(seat.sideboard, card1, card2);
      for (const pack of [...seat.packBacklog, ...seat.unopenedPacks]) {
        utils.swapInArray(pack, card1, card2);
      }
    }

    this.save();
  }

  private chooseCard(cards: Card[], name: string): Card {
    const originalName = name;
    name = name.toLowerCase();

    const nonContiguousMatches = [];
    const contiguousMatches = [];
    for (const card of cards) {
      const cardName = card.name.toLowerCase();
      if (cardName === name) return card;

      if (cardName.includes(name)) {
        nonContiguousMatches.push(card);
        contiguousMatches.push(card);
      } else if (containsChars(cardName, name)) {
        nonContiguousMatches.push(card);
      }
    }

    if (contiguousMatches.length === 1) return contiguousMatches[0];
    if (nonContiguousMatches.length === 1) return nonContiguousMatches[0];

    if (nonContiguousMatches.length === 0) {
      throw `None of these cards has a name matching "${originalName}".`;
    } else {
      const matches =
        contiguousMatches.length > 1 ? contiguousMatches : nonContiguousMatches;

      throw (
        'Multiple of these cards have names matching ' +
        `"${originalName}": ` +
        matches.map(card => card.name).join(', ')
      );
    }
  }

  private checkSeatNumber(seat: number): void {
    if (seat < 0 || seat >= Draft.numberOfSeats) {
      throw `Seat must be between 0 and ${Draft.numberOfSeats}`;
    }
  }

  save(): void {
    this.db.set(
      'seats',
      this.seats.map(seat => ({
        drafted: serializeCards(seat.drafted),
        sideboard: serializeCards(seat.sideboard),
        packBacklog: seat.packBacklog.map(serializeCards),
        unopenedPacks: seat.unopenedPacks.map(serializeCards),
        readTime: seat.readTime?.getTime() ?? null,
      }))
    );
  }
}

// Returns whether `superstring` contains all of the characters of `substring`
// in order, but not necessarily contiguously.
function containsChars(superstring: string, substring: string) {
  let superstringIndex = 0;
  let substringIndex = 0;
  for (;;) {
    if (substringIndex === substring.length) {
      return true;
    } else if (superstringIndex === superstring.length) {
      return false;
    }

    if (
      superstring.charCodeAt(superstringIndex) ===
      substring.charCodeAt(substringIndex)
    ) {
      substringIndex++;
    }
    superstringIndex++;
  }
}

function serializeCards(cards: Card[]): string[] {
  return cards.map(({name}) => name);
}
