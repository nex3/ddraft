export class Card {
  constructor(
    readonly name: string,
    readonly set: string,
    readonly collectorNumber: string,
    readonly index: number
  ) {}

  get url(): string {
    return `https://scryfall.com/card/${this.set}/${this.collectorNumber}`;
  }

  get imageUrl(): string {
    return `https://api.scryfall.com/cards/${this.set}/${this.collectorNumber}?format=image&version=png`;
  }
}
