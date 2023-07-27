import * as crypto from 'crypto';

import * as csv from 'csv-parse/sync';
import got from 'got';
import sampleSize from 'lodash/sampleSize.js';

import {Card} from './card.js';

const csvUrl =
  'https://cubecobra.com/cube/download/csv/5eae7a67a85ffb101d7fd244?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=undefined';

interface CsvCard {
  name: string;
  Set: string;
  'MTGO ID': string;
}

export class Cube {
  private _digest: string | undefined;

  private cardsByName: Record<string, Card> = {};

  static async load(): Promise<Cube> {
    return new Cube(
      (csv.parse(await got(csvUrl).text(), {columns: true}) as CsvCard[]).map(
        card => new Card(card.name, card.Set, card['MTGO ID'])
      )
    );
  }

  private constructor(private readonly cards: Card[]) {
    for (const card of cards) {
      this.cardsByName[card.name] = card;
    }
  }

  get digest(): string {
    if (this._digest !== undefined) return this._digest;

    const hash = crypto.createHash('md5');
    this.cards
      .map(({name}) => name)
      .sort()
      .forEach(name => hash.update(name));
    this._digest = hash.digest('hex');
    return this._digest;
  }

  getCard(name: string): Card {
    const card = this.cardsByName[name];
    if (card) return card;
    throw `Card ${name} isn't in the cube`;
  }

  getRandomCards(count: number): Card[] {
    return sampleSize(this.cards, count);
  }
}
