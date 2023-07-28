import * as fs from 'fs';
import * as url from 'url';

import bodyParser from 'body-parser';
import express from 'express';
import got from 'got';
import {Liquid} from 'liquidjs';
import sharp from 'sharp';

import {Card} from './card.js';
import {Cube} from './cube.js';
import {Database} from './db.js';
import {Draft} from './draft.js';

console.log('Loading cube list...');

const CARD_WIDTH = 745;
const CARD_HEIGHT = 1040;

const cube = await Cube.load();
const db = Database.load();

const oldDigest = db.get('digest');
if (oldDigest !== undefined && oldDigest !== cube.digest) {
  console.log('Cube list outdated, resetting draft');
  db.clear();
}

db.set('digest', cube.digest);

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
    view: `/cube/ddraft/pack/${seat}`,
    choose: `/cube/api/ddraft/pack/${seat}`,
    swap: `/cube/api/ddraft/draft/moddy/${seat}/swap`,
    ...draft.seatImages(seat),
  });
});

app.get('/cube/ddraft/pack/:seat', (req, res) => {
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

app.post('/cube/api/ddraft/pack/:seat', (req, res) => {
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

app.get('/image/:cards', async (req, res) => {
  const cards = cube.decodeCards(req.params.cards);

  let image: sharp.Sharp;
  if ('cmc' in req.query) {
    const columns = Card.pileByCmc(cards);
    const verticalOffset = CARD_HEIGHT / 9;
    const depth = Math.max(...columns.map(column => column.length));
    image = sharp({
      create: {
        width: Math.round(CARD_WIDTH * columns.length),
        height: Math.round(CARD_HEIGHT + verticalOffset * (depth - 1)),
        channels: 3,
        background: {r: 255, g: 255, b: 255},
      },
    }).composite(
      await Promise.all(
        columns.flatMap((column, columnIndex) =>
          column.map(async (card, cardIndex) => {
            const url = new URL(card.imageUrl);
            url.searchParams.set('version', 'png');
            return {
              input: await got(url).buffer(),
              left: Math.round(CARD_WIDTH * columnIndex),
              top: Math.round(verticalOffset * cardIndex),
            };
          })
        )
      )
    );
  } else {
    const width = 5;
    const height = Math.ceil(cards.length / width);
    image = await sharp({
      create: {
        width: Math.round(CARD_WIDTH * width),
        height: Math.round(CARD_HEIGHT * height),
        channels: 3,
        background: {r: 255, g: 255, b: 255},
      },
    }).composite(
      await Promise.all(
        cards.map(async (card, index) => {
          const url = new URL(card.imageUrl);
          url.searchParams.set('version', 'png');
          return {
            input: await got(url).buffer(),
            left: Math.round(CARD_WIDTH * (index % width)),
            top: Math.round(CARD_HEIGHT * Math.floor(index / width)),
          };
        })
      )
    );
  }

  res.writeHead(200, {'Content-Type': 'image/webp'});
  res.end(await image.webp().toBuffer());
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
app.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Server started on port ${port}`);
});
