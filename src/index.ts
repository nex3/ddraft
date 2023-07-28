import express from 'express';

import {Cube} from './cube.js';
import {Database} from './db.js';
import {Draft} from './draft.js';

console.log('Loading cube list...');

const cube = await Cube.load();
const db = Database.load();

const oldDigest = db.get('digest');
if (oldDigest !== undefined && oldDigest !== cube.digest) {
  console.log('Cube list outdated, resetting draft');
  db.clear();
}

db.set('digest', cube.digest);

const app = express();

app.get('/cube/api/ddraft/pack/moddy', (_, res) => {
  const draft = Draft.loadOrCreate(cube, db);
  const seat = draft.seatToShow();
  return res.status(200).send({
    success: 'true',
    view: `/cube/ddraft/pack/${seat}`,
    choose: `/cube/api/ddraft/pack/${seat}`,
    swap: `/cube/api/ddraft/draft/moddy/${seat}/swap`,
    ...draft.seatImages(seat),
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Server started on port ${port}`);
});
