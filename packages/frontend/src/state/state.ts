import { combineReducers } from 'redux';
import { OrderBookAndBestPriceType, PopulatedSignedZrxOrders, EtherscanGasPrices, Balances, ProductTicker } from '@0x/lib';
import { getType, ActionType } from 'typesafe-actions';

import { createAction } from 'typesafe-actions';
import { SignedOrder } from '0x.js';
import { comparePrices } from '../utilities';
export type withChange<T> = T & { changed?: number };
export interface MeshBestPriceState {
  bid?: withChange<PopulatedSignedZrxOrders>;
  ask?: withChange<PopulatedSignedZrxOrders>;
}
export interface MeshState {
  best: MeshBestPriceState;
  isFetching: boolean;
  bids: PopulatedSignedZrxOrders[];
  asks: PopulatedSignedZrxOrders[];
}
export interface AppState {
  mesh: MeshState;
  address: string | null;
  addresses: string[];
  orders: {
    error?: string;
    success?: boolean;
  };
  gas: {
    prices?: {
      [K in keyof EtherscanGasPrices]: number;
    };
    isFetching: boolean;
    price?: number;
  };
  balances: Partial<Balances> & {
    isFetching: boolean;
  };
  ticker: {
    [symbol: string]: ProductTicker & { lastPrice: number };
  };
}
export const State: AppState = {
  gas: {
    isFetching: false,
  },
  orders: {},
  mesh: {
    best: {},
    isFetching: false,
    bids: [],
    asks: [],
  },
  address: null,
  addresses: [],
  balances: {
    isFetching: false,
  },
  ticker: {},
};

export const actions = {
  requestMeshPrices: createAction(`@mesh/request/bestprices`)(),
  receiveMeshPrices: createAction(`@mesh/receive/bestprices`)<OrderBookAndBestPriceType>(),
  setAddress: createAction(`setAddress`)<{ addresses: string[]; address: string }>(),
  fillOrderStarted: createAction(`@order/fill`)<{ transaction: string }>(),
  fillOrderErrored: createAction(`@order/error`)<{ error: any }>(),
  fillOrderFinished: createAction(`@order/fill/created`)(),
  requestGasPrices: createAction(`@gas/prices/request`)(),
  receiveGasPrices: createAction(`@gas/prices/receive`)<EtherscanGasPrices>(),
  setGasPrice: createAction(`@gas/setprice`)<number>(),
  receiveBalances: createAction(`@balances/receive`)<Balances>(),
  receiveTicker: createAction(`@ticker/receive`)<{ symbol: string; ticker: ProductTicker }>(),
  order: {
    created: createAction(`@order/created`)<{ order: SignedOrder }>(),
  },
};

export type AppActions = ActionType<typeof actions>;

export const reducer = combineReducers<AppState, AppActions>({
  orders: (state = State.orders, action) => {
    switch (action.type) {
      case getType(actions.fillOrderErrored): {
        return { ...state, error: action.payload.error, success: false };
      }
      case getType(actions.fillOrderStarted): {
        return { ...state, success: true, error: undefined };
      }
      default:
        return state;
    }
  },
  ticker: (state = State.ticker, action) => {
    switch (action.type) {
      case getType(actions.receiveTicker): {
        const lastPrice = parseFloat(action.payload.ticker.price);
        return { ...state, [action.payload.symbol]: { ...action.payload.ticker, lastPrice } };
      }
      default:
        return state;
    }
  },
  balances: (state = State.balances, action) => {
    switch (action.type) {
      case getType(actions.receiveBalances): {
        return { ...state, isFetching: false, ...action.payload };
      }
      default:
        return state;
    }
  },
  gas: (state = State.gas, action) => {
    switch (action.type) {
      case getType(actions.requestGasPrices): {
        return { ...state, isFetching: true };
      }
      case getType(actions.receiveGasPrices): {
        const { SafeGasPrice, ProposeGasPrice, LastBlock } = {
          SafeGasPrice: parseFloat(action.payload.SafeGasPrice),
          ProposeGasPrice: parseFloat(action.payload.ProposeGasPrice),
          LastBlock: parseFloat(action.payload.LastBlock),
        };
        let price = state.price;
        if (price !== undefined) {
          price = price === state.prices?.SafeGasPrice ? SafeGasPrice : price === state.prices?.ProposeGasPrice ? ProposeGasPrice : price;
        }

        return {
          ...state,
          prices: {
            SafeGasPrice,
            ProposeGasPrice,
            LastBlock,
          },
          price,
          isFetching: false,
        };
      }
      case getType(actions.setGasPrice): {
        return { ...state, price: action.payload };
      }
      default:
        return state;
    }
  },
  address: (state = State.address, action) => {
    switch (action.type) {
      case getType(actions.setAddress): {
        return action.payload.address;
      }
      default:
        return state;
    }
  },
  addresses: (state = State.addresses, action) => {
    switch (action.type) {
      case getType(actions.setAddress): {
        return action.payload.addresses;
      }
      default:
        return state;
    }
  },

  mesh: (state = State.mesh, action) => {
    switch (action.type) {
      case getType(actions.requestMeshPrices):
        return { ...state, isFetching: true };
      case getType(actions.receiveMeshPrices): {
        const { bid, ask } = action.payload.best;
        const existing = state.best;
        const bidValue: withChange<PopulatedSignedZrxOrders> | undefined = bid ? { changed: comparePrices(bid?.price, existing.bid?.price), ...bid } : undefined;
        return {
          ...state,
          bids: action.payload.bids,
          asks: action.payload.asks,
          best: {
            bid: bidValue,
            ask: ask ? { ...ask, changed: comparePrices(ask?.price, existing.ask?.price) } : undefined,
          },
        };
      }

      default:
        return state;
    }
  },
});
