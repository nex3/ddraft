import * as crypto from 'crypto';
import varint from 'varint';
import * as base64 from 'byte-base64';

import * as csv from 'csv-parse/sync';
import got from 'got';
import sampleSize from 'lodash/sampleSize.js';

import {Card} from './card.js';
import {db} from './db.js';

const csvUrl =
  'https://cubecobra.com/cube/download/csv/5eae7a67a85ffb101d7fd244?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=undefined';

interface CsvCard {
  name: string;
  Set: string;
  'Collector Number': string;
  CMC: string;
}

export class Cube {
  private _digest: string | undefined;

  private cardsByName: Record<string, Card> = {};

  static async reload(): Promise<void> {
    console.log('Loading cube list...');
    cube = await Cube.load();

    const oldDigest = db.get('digest');
    if (oldDigest !== undefined && oldDigest !== cube.digest) {
      console.log('Cube list outdated, resetting draft');
      db.clear();
    }

    db.set('digest', cube.digest);
  }

  static async load(): Promise<Cube> {
    let index = 0;
    return new Cube(
      (csv.parse(await got(csvUrl).text(), {columns: true}) as CsvCard[]).map(
        card =>
          new Card(
            card.name,
            card.Set,
            parseInt(card.CMC),
            card['Collector Number'],
            index++
          )
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

  encodeCards(cards: Card[]): string {
    const buffer: number[] = [];
    for (const card of cards) {
      buffer.push(...varint.encode(card.index));
    }
    return base64.bytesToBase64(buffer);
  }

  decodeCards(encoded: string): Card[] {
    const bytes = base64.base64ToBytes(encoded);
    const cards: Card[] = [];
    for (let i = 0; i < bytes.length; ) {
      const index = varint.decode(bytes, i);
      i += varint.decode.bytes!;
      cards.push(this.cards[index]);
    }
    return cards;
  }
}

console.log('Loading cube list...');
export let cube = await Cube.load();

const oldDigest = db.get('digest');
if (oldDigest !== undefined && oldDigest !== cube.digest) {
  console.log('Cube list outdated, resetting draft');
  db.clear();
}

db.set('digest', cube.digest);
