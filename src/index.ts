import express from 'express';
import {Liquid} from 'liquidjs';

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

const liquid = new Liquid({
  cache: process.env.NODE_ENV === 'production',
  ownPropertyOnly: false,
});
app.engine('liquid', liquid.express());
app.set('views', './views');
app.set('view engine', 'liquid');

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

app.get('/cube/ddraft/pack/:seat', (req, res) => {
  const draft = Draft.loadOrCreate(cube, db);
  const seat = parseInt(req.params.seat);
  if (seat < 0 || seat >= Draft.numberOfSeats) {
    throw `Seat must be between 0 and ${Draft.numberOfSeats}`;
  }

  res.render('pack', {
    pack: draft.getPack(seat),
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Server started on port ${port}`);
});
