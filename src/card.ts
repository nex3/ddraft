export class Card {
  constructor(
    readonly name: string,
    readonly set: string,
    readonly id: string
  ) {}

  get url(): string {
    const url = new URL('https://scryfall.com/search');
    url.searchParams.append('q', `e:${this.set} "${this.name}"`);
    return url.href;
  }

  get imageUrl(): string {
    const url = new URL(
      'https://api.scryfall.com/cards/named?format=image&version=png'
    );
    url.searchParams.append('exact', this.name);
    url.searchParams.append('set', this.set);
    return url.href;
  }
}
