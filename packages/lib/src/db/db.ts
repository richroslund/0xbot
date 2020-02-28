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
