import { NULL_ADDRESS } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { Address, Logger } from '../../types';
import { ZERO_BYTES_32, ZERO_BYTES_6 } from './lib/Constants';
import { queryPools } from './subgraph';
import { PoolState, SubgraphPool } from './types';

export async function getPools(
  dexHelper: IDexHelper,
  logger: Logger,
  subgraphURL: string,
  blockNumber: number,
): Promise<SubgraphPool[]> {
  let skip = 0;
  let first = 1000;
  let pools: SubgraphPool[] = [];

  let currentPools = await queryPools(
    dexHelper,
    logger,
    subgraphURL,
    blockNumber,
    skip * first,
    first,
  );

  pools = pools.concat(currentPools);

  while (currentPools.length === first) {
    skip++;
    currentPools = await queryPools(
      dexHelper,
      logger,
      subgraphURL,
      blockNumber,
      skip * first,
      first,
    );

    pools = pools.concat(currentPools);
  }

  return pools;
}

export function initializePoolState(
  id: string,
  currency0: Address,
  currency1: Address,
  fee: bigint,
  tickSpacing: bigint,
  hooks: Address,
): PoolState {
  return {
    id: id.toLowerCase(),
    key: {
      currency0: currency0.toLowerCase(),
      currency1: currency1.toLowerCase(),
      fee,
      tickSpacing,
      hooks: hooks.toLowerCase(),
    },
    liquidityDensityFunction: '',
    bunniHub: '',
    bunniToken: '',
    hooklet: '',
    twapSecondsAgo: 0n,
    ldfParams: '',
    hookParams: '',
    vault0: '',
    vault1: '',
    ldfType: 0,
    minRawTokenRatio0: 0n,
    targetRawTokenRatio0: 0n,
    maxRawTokenRatio0: 0n,
    minRawTokenRatio1: 0n,
    targetRawTokenRatio1: 0n,
    maxRawTokenRatio1: 0n,
    rawBalance0: 0n,
    rawBalance1: 0n,
    reserve0: 0n,
    reserve1: 0n,
    idleBalance: ZERO_BYTES_32,
    totalSupply: 0n,
    ldfState: '',
    sqrtPriceX96: 0n,
    tick: 0n,
    lastSwapTimestamp: 0n,
    lastSurgeTimestamp: 0n,
    index: 0n,
    cardinality: 0n,
    cardinalityNext: 0n,
    intermediateObservation: {
      blockTimestamp: 0n,
      prevTick: 0n,
      tickCumulative: 0n,
      initialized: false,
    },
    observations: [],
    initialized: false,
    sharePrice0: 0n,
    sharePrice1: 0n,
    topBid: {
      manager: NULL_ADDRESS,
      blockIdx: 0n,
      payload: ZERO_BYTES_6,
      rent: 0n,
      deposit: 0n,
    },
    nextBid: {
      manager: NULL_ADDRESS,
      blockIdx: 0n,
      payload: ZERO_BYTES_6,
      rent: 0n,
      deposit: 0n,
    },
    rebalanceOrderHash: ZERO_BYTES_32,
  };
}

export async function multicall(
  multiCallData: { target: string; callData: string }[],
  blockNumber: number,
  dexHelper: IDexHelper,
): Promise<any> {
  const maxSize = 2500000; // 2.5mb

  function estimateSize(callData: any) {
    const jsonString = JSON.stringify(callData);
    return jsonString.length;
  }

  const totalSize = estimateSize(multiCallData);

  if (totalSize <= maxSize) {
    return await dexHelper.multiContract.methods
      .tryAggregate(true, multiCallData)
      .call({}, blockNumber);
  }

  const itemSize =
    multiCallData.length > 0 ? estimateSize(multiCallData[0]) : 0;
  const itemsPerChunk = Math.max(1, Math.floor(2000000 / (itemSize * 1.5)));

  const chunks = [];
  for (let i = 0; i < multiCallData.length; i += itemsPerChunk) {
    chunks.push(multiCallData.slice(i, i + itemsPerChunk));
  }

  const allResults = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const chunkResults = await dexHelper.multiContract.methods
        .tryAggregate(true, chunk)
        .call({}, blockNumber);

      allResults.push(...chunkResults);
    } catch (error) {
      console.log(error);
      if (chunk.length === 1) {
        throw error;
      } else if (chunk.length > 1) {
        const subChunkSize = Math.ceil(chunk.length / 2);
        const subChunks = [
          chunk.slice(0, subChunkSize),
          chunk.slice(subChunkSize),
        ];

        for (const subChunk of subChunks) {
          const subResults = await dexHelper.multiContract.methods
            .tryAggregate(true, subChunk)
            .call({}, blockNumber);
          allResults.push(...subResults);
        }
      }
    }
  }

  return allResults;
}
