export class Card {
  constructor(
    readonly name: string,
    readonly set: string,
    readonly id: string
  ) {}

  get imageUrl(): string {
    const url = new URL(
      'https://api.scryfall.com/cards/named?format=image&version=png'
    );
    url.searchParams.append('exact', this.name);
    url.searchParams.append('set', this.set);
    return url.href;
  }
}
