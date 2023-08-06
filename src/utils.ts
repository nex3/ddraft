export function swapInArray<T>(array: T[], element1: T, element2: T): void {
  for (let i = 0; i < array.length; i++) {
    if (array[i] === element1) {
      array[i] = element2;
    } else if (array[i] === element2) {
      array[i] = element1;
    }
  }
}
