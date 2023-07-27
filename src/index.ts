import * as crypto from 'crypto';

import got from 'got';
import {parse} from 'csv-parse/sync';

import {Database} from './db.js';

const csvUrl =
  'https://cubecobra.com/cube/download/csv/5eae7a67a85ffb101d7fd244?primary=Color%20Category&secondary=Types-Multicolor&tertiary=Mana%20Value&quaternary=Alphabetical&showother=undefined';

interface CsvCard {
  name: string;
  Set: string;
  'MTGO ID': string;
}

console.log('Loading cube list...');

const [csv, db] = await Promise.all([
  (async () => parse(await got(csvUrl).text(), {columns: true}) as CsvCard[])(),
  Database.load(),
]);

const hash = crypto.createHash('md5');
csv
  .map(({name}) => name)
  .sort()
  .forEach(name => hash.update(name));
const digest = hash.digest('hex');

const oldDigest = db.get('digest');
if (oldDigest !== undefined && oldDigest !== digest) {
  console.log('Cube list outdated, resetting draft');
  await db.clear();
}

await db.set('digest', digest);
