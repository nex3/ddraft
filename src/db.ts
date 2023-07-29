import {packageDirectory} from 'pkg-dir';
import * as fs from 'fs';

const path = (await packageDirectory()) + '/db.json';

export type Data =
  | string
  | number
  | boolean
  | null
  | Data[]
  | {[key: string]: Data};

export class Database {
  static load(): Database {
    try {
      return new Database(
        JSON.parse(fs.readFileSync(path, 'utf8')) as Record<
          string,
          Readonly<Data>
        >
      );
    } catch (_) {
      return new Database({});
    }
  }

  private constructor(private data: Record<string, Readonly<Data>>) {}

  get(key: string): Readonly<Data> | undefined {
    return this.data[key];
  }

  set(key: string, value: Data): void {
    this.data[key] = Object.freeze(structuredClone(value));
    fs.writeFileSync(path, JSON.stringify(this.data));
  }

  clear(): void {
    this.data = {};
    fs.writeFileSync(path, '{}');
  }
}

export const db = Database.load();
