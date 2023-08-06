import * as crypto from 'crypto';

import * as base64 from 'byte-base64';
import * as csv from 'csv-parse/sync';
import got from 'got';
import sampleSize from 'lodash/sampleSize.js';
import sortBy from 'lodash/sortBy.js';
import varint from 'varint';

import {Card} from './card.js';
import {db} from './db.js';

const csvUrl =
  'https://cubecobra.com/cube/download/csv/5eae7a67a85ffb101d7fd244?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=undefined';

interface CsvCard {
  name: string;
  Set: string;
  'Collector Number': string;
  'MTGO ID': string;
  CMC: string;
}

export class Cube {
  readonly cards: Card[];

  private _digest: string | undefined;

  private readonly cardsByName: Record<string, Card> = {};

  private readonly indexesByCard = new Map<Card, number>();

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
    return new Cube(
      await Promise.all(
        (csv.parse(await got(csvUrl).text(), {columns: true}) as CsvCard[]).map(
          async card => {
            let cmc = parseInt(card.CMC);
            if (Number.isNaN(cmc)) {
              cmc = (
                (await got(
                  `https://api.scryfall.com/cards/${card.Set}/` +
                    card['Collector Number']
                ).json()) as Record<string, unknown>
              )['cmc'] as number;
            }

            let mtgoId = parseInt(card['MTGO ID']);
            if (Number.isNaN(mtgoId)) {
              const query = new URLSearchParams('unique=prints');
              query.set('q', `!"${card.name}" in:mtgo`);
              const prints = (
                (await got(
                  `https://api.scryfall.com/cards/search?${query}`
                ).json()) as Record<string, unknown>
              )['data'] as Record<string, unknown>[];
              mtgoId = prints.find(print => print['mtgo_id'])![
                'mtgo_id'
              ] as number;
            }

            return new Card(
              card.name,
              card.Set,
              cmc,
              card['Collector Number'],
              mtgoId
            );
          }
        )
      )
    );
  }

  private constructor(cards: Card[]) {
    this.cards = sortBy(cards, card => card.name);
    for (let i = 0; i < cards.length; i++) {
      const card = this.cards[i];
      this.cardsByName[card.name] = card;
      this.indexesByCard.set(card, i);
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
      buffer.push(...varint.encode(this.indexesByCard.get(card)!));
    }
    return base64
      .bytesToBase64(buffer)
      .replaceAll(/\+/g, '.')
      .replaceAll(/\//g, '_');
  }

  decodeCards(encoded: string): Card[] {
    const bytes = base64.base64ToBytes(
      encoded.replaceAll(/\./g, '+').replaceAll(/_/g, '/')
    );
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
