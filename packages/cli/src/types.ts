export type ChangeDirections = -1 | 0 | 1;

export interface FibPosition {
  orders: string[];
  range: {
    lower: number;
    upper: number;
  };
}

export type PriceValues = Record<string, string | number | undefined>;
export type PriceChangeValues = { [P in keyof PriceValues]: ChangeDirections };
