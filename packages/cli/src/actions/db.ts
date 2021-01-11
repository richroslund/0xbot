import { DatabaseClient, dbList } from '@0x/lib';
import { SignedOrder } from '0x.js';
export class Database extends DatabaseClient {
  public constructor(database = 'keyv', collection = 'keyv') {
    super(database, collection);
  }
  public orders = dbList<SignedOrder>(this, 'orders');
}
