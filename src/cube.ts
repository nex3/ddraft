import * as crypto from 'crypto';

import got from 'got';
import * as csv from 'csv-parse/sync';

const csvUrl =
  'https://cubecobra.com/cube/download/csv/5eae7a67a85ffb101d7fd244?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=undefined';

interface CsvCard {
  name: string;
  Set: string;
  'MTGO ID': string;
}

export class Cube {
  private _digest: string | undefined;

  static async load(): Promise<Cube> {
    return new Cube(
      csv.parse(await got(csvUrl).text(), {columns: true}) as CsvCard[]
    );
  }

  private constructor(private readonly cards: CsvCard[]) {}

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
}
