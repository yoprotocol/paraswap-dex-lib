import { Address } from '../../types';

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: bigint;
  tickSpacing: bigint;
  hooks: Address;
};

export type PoolState = {
  id: string;
  key: PoolKey;
};

export type PoolStateMap = { [poolId: string]: PoolState };

export type BunniV2Data = {
  path: {
    tokenIn: Address;
    tokenOut: Address;
    zeroForOne: boolean;
    pool: PoolState;
  }[];
};

export type DexParams = {
  WETH: Address;
  poolManager: Address;
  quoter: Address;
  router: Address;
  bunniHubs: Address[];
  bunniHooks: Address[];
  subgraphURL: string;
};

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

export type SubgraphPool = {
  id: string;
  bunniToken: {
    totalSupply: string;
  };
  currency0: {
    id: string;
  };
  currency1: {
    id: string;
  };
  fee: string;
  tickSpacing: string;
  hooks: string;
};
