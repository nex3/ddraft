import {packageDirectory} from 'pkg-dir';
import * as fs from 'fs/promises';

const path = (await packageDirectory()) + '/db.json';

export type Data =
  | string
  | number
  | boolean
  | null
  | Data[]
  | {[key: string]: Data};

export class Database {
  static async load(): Promise<Database> {
    try {
      return new Database(
        JSON.parse(await fs.readFile(path, 'utf8')) as Record<
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

  async set(key: string, value: Data): Promise<void> {
    this.data[key] = Object.freeze(structuredClone(value));
    await fs.writeFile(path, JSON.stringify(this.data));
  }

  async clear(): Promise<void> {
    this.data = {};
    await fs.writeFile(path, '{}');
  }
}
