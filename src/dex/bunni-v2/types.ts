import { Interface } from '@ethersproject/abi';
import { Address } from '../../types';

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: bigint;
  tickSpacing: bigint;
  hooks: Address;
};

export type Observation = {
  blockTimestamp: bigint;
  prevTick: bigint;
  tickCumulative: bigint;
  initialized: boolean;
};

export type VaultSharePrices = {
  initialized: boolean;
  sharePrice0: bigint;
  sharePrice1: bigint;
};

export type CorePoolState = {
  id: string;
  key: PoolKey;
};

export type ImmutablePoolState = {
  liquidityDensityFunction: Address;
  bunniHub: Address;
  bunniToken: Address;
  hooklet: Address;
  twapSecondsAgo: bigint;
  ldfParams: string;
  hookParams: string;
  vault0: Address;
  vault1: Address;
  ldfType: number;
  minRawTokenRatio0: bigint;
  targetRawTokenRatio0: bigint;
  maxRawTokenRatio0: bigint;
  minRawTokenRatio1: bigint;
  targetRawTokenRatio1: bigint;
  maxRawTokenRatio1: bigint;
};

export type MutablePoolState = {
  rawBalance0: bigint;
  rawBalance1: bigint;
  reserve0: bigint;
  reserve1: bigint;
  idleBalance: string;
  totalSupply: bigint;
  ldfState: string;
};

export type Slot0 = {
  sqrtPriceX96: bigint;
  tick: bigint;
  lastSwapTimestamp: bigint;
  lastSurgeTimestamp: bigint;
};

export type ObservationState = {
  index: bigint;
  cardinality: bigint;
  cardinalityNext: bigint;
  intermediateObservation: Observation;
  observations: Observation[];
};

export type HubStorage = {
  // TODO
};

export type HookStorage = {
  // observations: Observation[];
  // state: ObservationState;
  // vaultSharePricesAtLastSwap: VaultSharePrices;
  // ldfState: string;
  // slot0: Slot0;
  // rebalanceOrderHash: string | null;
  // rebalanceOrder: {
  //   offer: [{
  //     token: string;
  //     amount: bigint;
  //   }],
  //   consideration: {
  //     token: string;
  //     amount: bigint
  //   }
  // } | null;
  rebalanceOrderHash: string;
};

export type Bid = {
  manager: string;
  blockIdx: bigint;
  payload: string;
  rent: bigint;
  deposit: bigint;
};

export type AmAmmStorage = {
  topBid: Bid;
  nextBid: Bid;
};

export type PoolState = CorePoolState &
  ImmutablePoolState &
  MutablePoolState &
  Slot0 &
  ObservationState &
  VaultSharePrices &
  AmAmmStorage &
  HookStorage;

export type PoolStateMap = { [poolId: string]: PoolState };
export type CorePoolStateMap = { [poolId: string]: CorePoolState };

export type BunniV2Data = {
  // TODO: BunniV2Data is the dex data that is
  // returned by the API that can be used for
  // tx building. The data structure should be minimal.
  // Complete me!
  exchange: Address;
  poolKey: PoolKey;
  zeroForOne: boolean;
};

export type DexParams = {
  poolManager: Address;
  quoter: Address;
  router: Address;
  // bunniHub: Address;
  bunniHubs: Address[];
  bunniHooks: {
    address: Address;
    deploymentBlock: bigint;
    interface: Interface;
  }[];
  floodPlain: Address;
  subgraphURL: string;
  K: bigint;
};

export type BunniComputeSwapInput = {
  key: PoolKey;
  totalLiquidity: bigint;
  liquidityDensityOfRoundedTickX96: bigint;
  currentActiveBalance0: bigint;
  currentActiveBalance1: bigint;
  sqrtPriceX96: bigint;
  currentTick: bigint;
  liquidityDensityFunction: string;
  arithmeticMeanTick: bigint;
  ldfParams: string;
  ldfState: string;
  swapParams: SwapParams;
};

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

export type SubgraphPool = {
  id: string;
  bunniHub: {
    id: string;
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
