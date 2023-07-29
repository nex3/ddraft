import * as fs from 'fs';
import * as url from 'url';

import bodyParser from 'body-parser';
import * as dotenv from 'dotenv';
import express from 'express';
import {Liquid} from 'liquidjs';

import {Card} from './card.js';
import {cube, Cube} from './cube.js';
import {db} from './db.js';
import {Draft} from './draft.js';
import {imageCache, CARD_WIDTH, CARD_HEIGHT} from './image_cache.js';

// Access environment variables from the .env file.
dotenv.config();

const app = express();

const prodPublic = url.fileURLToPath(new URL('public', import.meta.url));
const devPublic = url.fileURLToPath(
  new URL('../build/src/public', import.meta.url)
);
app.use(
  express.static(
    fs.existsSync(`${prodPublic}/style.css`) ? prodPublic : devPublic
  )
);
app.use(bodyParser.urlencoded({extended: false}));

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
    view: `/seat/${seat}`,
    choose: `/api/seat/${seat}`,
    swap: `/api/seat/${seat}/swap`,
    ...draft.seatImages(seat),
  });
});

app.get('/seat/:seat', (req, res) => {
  const draft = Draft.loadOrCreate(cube, db);
  const seat = parseInt(req.params.seat);
  const pack = draft.getPack(seat);
  res.render('pack', {
    pack,
    drafted: Card.pileByCmc(draft.getDrafted(seat)),
    sideboard: draft.getSideboard(seat),
    seatNumber: seat + 1,
    packNumber: draft.packNumber(seat),
    pickNumber: 16 - pack.length,
    packImage: `/image/${cube.encodeCards(pack)}`,
    packImageWidth: CARD_WIDTH * 5,
    packImageHeight: CARD_HEIGHT * Math.ceil(pack.length / 5),
  });
});

app.post('/api/seat/:seat', (req, res) => {
  const draft = Draft.loadOrCreate(cube, db);
  const seat = parseInt(req.params.seat);

  try {
    draft.pick(seat, req.body.card, req.body.sideboard);
  } catch (error) {
    if (typeof error !== 'string') throw error;
    return res.status(400).send({
      success: 'false',
      message: error.toString(),
    });
  }

  return res.status(200).send({
    success: 'true',
    ...draft.seatImages(seat),
  });
});

app.post('/api/seat/:seat/swap', (req, res) => {
  const draft = Draft.loadOrCreate(cube, db);
  const seat = parseInt(req.params.seat);

  try {
    draft.swap(seat, req.body.card);
  } catch (error) {
    if (typeof error !== 'string') throw error;
    return res.status(400).send({
      success: 'false',
      message: error.toString(),
    });
  }

  return res.status(200).send({
    success: 'true',
    ...draft.seatImages(seat),
  });
});

app.post('/cube/api/ddraft/reset', async (req, res) => {
  await Cube.reload();
  db.clear();
  imageCache.clear();
  return res.status(200).send({success: true});
});

app.get('/image/*?', async (req, res) => {
  res.writeHead(200, {'Content-Type': 'image/webp'});
  const buffer = await imageCache.fetch(
    (req.params as string[])[0] + ('cmc' in req.query ? '?cmc' : '')
  );
  res.end(buffer);
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Server started on port ${port}`);
});
