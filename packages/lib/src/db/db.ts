import { MongoClient, Db } from 'mongodb';

export const connectMongo = (url: string) => {
  return MongoClient.connect(url)
    .then(client => client.db())
    .catch(err => {
      console.log('mongo client connection errored', err);
      return undefined;
    });
};

export type MongoDbType = Db;

export class Repository<T extends { id?: string }> {
  private collection: string;
  private url: string;
  constructor(url: string, collection: string) {
    this.collection = collection;
    this.url = url;
  }
  public db = async () => await connectMongo(this.url);
  public get = async (filter: Partial<T>) => {
    const client = await this.db();
    if (!client) {
      console.warn('mongo client is null');
      return [];
    }
    return await client
      .collection(this.collection)
      .find(filter)
      .toArray();
  };
  public all = async () => {
    const client = await this.db();
    if (!client) {
      return undefined;
    }
    return client.collection(this.collection).find();
  };
  public update = async (id: string, value: T, upsert = false) => {
    const client = await this.db();
    if (!client) {
      return undefined;
    }
    const obj = { ...value, id };
    return await client.collection(this.collection).updateOne({ id }, { $set: obj }, { upsert });
  };
  public create = async (id: string, value: T) => {
    const client = await this.db();
    if (!client) {
      return undefined;
    }
    return await client.collection<T>(this.collection).insertOne({ ...value, id } as any);
  };
  public save = async (value: T, id: string) => {
    if (value.id) {
      await this.update(value.id, value, true);
      return value;
    } else {
      await this.create(id, value);
      return {
        ...value,
        id,
      };
    }
  };
}
