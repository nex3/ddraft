import chunk from 'lodash/chunk.js';

import {Card} from './card.js';
import {Cube} from './cube.js';
import {Database} from './db.js';

interface SerializedSeat {
  readonly drafted: string[];
  readonly sideboard: string[];
  readonly currentPack: string[];
  readonly unopenedPacks: string[][];
  readonly readTime: number | null;
}

interface Seat {
  readonly drafted: Card[];
  readonly sideboard: Card[];
  readonly currentPack: Card[];
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
          currentPack,
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
          currentPack: deserializeCards(seat.currentPack),
          unopenedPacks: seat.unopenedPacks.map(deserializeCards),
          readTime: seat.readTime ? new Date(seat.readTime) : null,
        }))
      );
    }
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
      response.deck_image = `/image/${this.cube.encodeCards(seat.drafted)}`;
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
    return this.seats[index].currentPack;
  }

  packNumber(index: number): number {
    this.checkSeatNumber(index);
    return 3 - this.seats[index].unopenedPacks.length;
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
        currentPack: serializeCards(seat.currentPack),
        unopenedPacks: seat.unopenedPacks.map(serializeCards),
        readTime: seat.readTime?.getTime() ?? null,
      }))
    );
  }
}

function serializeCards(cards: Card[]): string[] {
  return cards.map(({name}) => name);
}
