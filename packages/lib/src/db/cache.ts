import Keyv from 'keyv';
import _ from 'lodash';
export class DatabaseClient {
  public client: Keyv;

  public constructor(database = 'keyv', collection = 'keyv') {
    this.client = new Keyv(`${process.env.MONGOCONNECTIONSTRING}/${database || 'keyv'}`, { collection: collection });
  }
  public async replace<T>(key: string, value: T) {
    try {
      return this.client.set(key, value);
    } catch (ex) {
      console.error('database save failed', ex);
    }
  }
  public async addValue<T>(key: string, subKey: string, value: T) {
    const existing = await this.client.get(key);

    return await this.replace(key, { ...existing, [subKey]: value });
  }
  public async add<T>(key: string, value: T) {
    const existing = await this.client.get(key);
    const updated = _.isArray(existing) ? [...existing, value] : _.concat([existing], [value]);
    return await this.replace(key, updated);
  }
  public async get<T>(key: string) {
    const existing = await this.client.get(key);
    return existing as T;
  }
}

export const dbList = <T>(db: DatabaseClient, key: string) => {
  return {
    add: async (val: T) => db.add<T>(key, val),
    get: async (filter?: (v: T) => boolean) => {
      const all = await db.get<T[]>(key);
      return filter ? _.filter(all, filter) : all;
    },
  };
};
