import {Cube} from './cube.js';
import {Database} from './db.js';

console.log('Loading cube list...');

const [cube, db] = await Promise.all([Cube.load(), Database.load()]);

const oldDigest = db.get('digest');
if (oldDigest !== undefined && oldDigest !== cube.digest) {
  console.log('Cube list outdated, resetting draft');
  await db.clear();
}

await db.set('digest', cube.digest);
