export class Card {
  static pileByCmc(cards: Card[]): Card[][] {
    if (cards.length === 0) return [];

    const cmcs: Card[][] = [];
    for (const card of cards) {
      const cmc = Math.min(card.cmc, 7);
      cmcs[cmc] ??= [];
      cmcs[cmc].push(card);
    }

    return cmcs.filter(cards => cards);
  }

  constructor(
    readonly name: string,
    readonly set: string,
    readonly cmc: number,
    readonly collectorNumber: string
  ) {}

  get url(): string {
    return `https://scryfall.com/card/${this.set}/${this.collectorNumber}`;
  }

  get imageUrl(): string {
    return `https://api.scryfall.com/cards/${this.set}/${this.collectorNumber}?format=image&version=png`;
  }
}
