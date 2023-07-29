import got from 'got';
import {LRUCache} from 'lru-cache';
import sharp from 'sharp';

import {Card} from './card.js';
import {cube} from './cube.js';

export const CARD_WIDTH = 745;
export const CARD_HEIGHT = 1040;

export const imageCache = new LRUCache<string, Buffer>({
  max: 15,
  fetchMethod: async key => {
    let image: sharp.Sharp;
    if (key.endsWith('?cmc')) {
      const cards = cube.decodeCards(key.substring(0, key.length - 4));
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
      const cards = cube.decodeCards(key);
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

    return await image.webp().toBuffer();
  },
});
