/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { DummyDexHelper } from '../../dex-helper';
import { Network } from '../../constants';
import { UniswapV4Pool } from './uniswap-v4-pool';
import { UniswapV4Config } from './config';
import { Logger } from 'log4js';

// Pool configuration structure
interface PoolConfig {
  id: string;
  currency0: string;
  currency1: string;
  fee: string;
  hooks: string;
  tickSpacing: string;
}

// Test pools configuration
const testPoolsConfig: Record<number, PoolConfig[]> = {
  [Network.BASE]: [
    {
      id: '0x96d4b53a38337a5733179751781178a2613306063c511b78cd02684739288c0a',
      currency0: '0x0000000000000000000000000000000000000000', // Native ETH
      currency1: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // USDC
      fee: '500',
      hooks: '0x0000000000000000000000000000000000000000',
      tickSpacing: '10',
    },
    // Add more pools here as needed
  ],
  [Network.MAINNET]: [
    {
      id: '0x8aa4e11cbdf30eedc92100f4c8a31ff748e201d44712cc8c90d189edaa8e4e47',
      currency0: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
      currency1: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
      fee: '10',
      hooks: '0x0000000000000000000000000000000000000000',
      tickSpacing: '1',
    },
    // Add more pools here as needed
  ],
};

describe('UniswapV4Pool State Generation', () => {
  // Helper function to test pools for a given network
  const testNetworkPools = (network: Network, focusTests = false) => {
    const describeFn = focusTests ? describe.only : describe;

    describeFn(`${Network[network]} Network`, () => {
      const config = UniswapV4Config.UniswapV4[network];
      const pools = testPoolsConfig[network] || [];

      if (!config) {
        it('should skip tests when config is not available', () => {
          console.log(`No UniswapV4 config for ${Network[network]}`);
          expect(true).toBe(true);
        });
        return;
      }

      if (pools.length === 0) {
        it('should skip tests when no pools configured', () => {
          console.log(`No test pools configured for ${Network[network]}`);
          expect(true).toBe(true);
        });
        return;
      }

      pools.forEach((poolConfig, index) => {
        describe(`Pool ${index + 1}: ${poolConfig.id.substring(
          0,
          10,
        )}... (${poolConfig.currency0.substring(
          0,
          6,
        )}.../${poolConfig.currency1.substring(0, 6)}..., fee: ${
          poolConfig.fee
        })`, () => {
          let dexHelper: DummyDexHelper;
          let pool: UniswapV4Pool;
          let logger: Logger;

          beforeAll(async () => {
            dexHelper = new DummyDexHelper(network);
            logger = dexHelper.getLogger('UniswapV4Pool');

            // Initialize pool with test data
            pool = new UniswapV4Pool(
              dexHelper,
              'UniswapV4',
              network,
              config,
              logger,
              '',
              poolConfig.id,
              poolConfig.currency0,
              poolConfig.currency1,
              poolConfig.fee,
              poolConfig.hooks,
              0n, // sqrtPriceX96 - will be fetched from state
              '0', // tick - will be fetched from state
              poolConfig.tickSpacing,
            );

            await pool.initialize(await dexHelper.provider.getBlockNumber());
          });

          describe('State Generation Comparison', () => {
            jest.setTimeout(30000);

            it('should generate consistent state between subgraph and multicall methods', async () => {
              const blockNumber = await dexHelper.provider.getBlockNumber();

              console.log('Generating state using stateMulticall method...');
              const multicallState = await pool.generateState(blockNumber);

              console.log(`Testing state generation at block ${blockNumber}`);
              console.log(`Pool ID: ${poolConfig.id}`);
              console.log(
                `Currency0: ${poolConfig.currency0}, Currency1: ${poolConfig.currency1}`,
              );
              console.log(
                `Fee: ${poolConfig.fee}, TickSpacing: ${poolConfig.tickSpacing}`,
              );

              // Generate state using subgraph method
              console.log('Generating state using subgraph method...');
              const subgraphState = await pool.generateStateWithSubgraph(
                blockNumber,
              );

              // Only run multicall test if stateMulticall is configured
              if (!config.stateMulticall) {
                console.log(
                  'StateMulticall not configured for this network, skipping comparison',
                );
                expect(subgraphState).toBeDefined();
                expect(subgraphState.isValid).toBe(true);
                return;
              }

              // Compare basic pool properties
              expect(multicallState.id).toBe(subgraphState.id);
              expect(multicallState.token0).toBe(subgraphState.token0);
              expect(multicallState.token1).toBe(subgraphState.token1);
              expect(multicallState.fee).toBe(subgraphState.fee);
              expect(multicallState.hooks).toBe(subgraphState.hooks);
              expect(multicallState.tickSpacing).toBe(
                subgraphState.tickSpacing,
              );
              expect(multicallState.isValid).toBe(true);
              expect(subgraphState.isValid).toBe(true);

              // Compare slot0 data
              console.log('Comparing slot0 data...');
              expect(multicallState.slot0.sqrtPriceX96).toBe(
                subgraphState.slot0.sqrtPriceX96,
              );
              expect(multicallState.slot0.tick).toBe(subgraphState.slot0.tick);
              expect(multicallState.slot0.protocolFee).toBe(
                subgraphState.slot0.protocolFee,
              );
              expect(multicallState.slot0.lpFee).toBe(
                subgraphState.slot0.lpFee,
              );

              // Compare liquidity
              expect(multicallState.liquidity).toBe(subgraphState.liquidity);

              // Compare fee growth globals
              expect(multicallState.feeGrowthGlobal0X128).toBe(
                subgraphState.feeGrowthGlobal0X128,
              );
              expect(multicallState.feeGrowthGlobal1X128).toBe(
                subgraphState.feeGrowthGlobal1X128,
              );

              // Compare tick data
              console.log(
                `Comparing tick data - Subgraph: ${
                  Object.keys(subgraphState.ticks).length
                } ticks, Multicall: ${
                  Object.keys(multicallState.ticks).length
                } ticks`,
              );

              // The multicall method might return more or fewer ticks than subgraph
              // We'll check that all non-zero ticks from both methods match when they overlap
              const allTickKeys = new Set([
                ...Object.keys(subgraphState.ticks),
                ...Object.keys(multicallState.ticks),
              ]);

              let matchingTicks = 0;
              let differingTicks = 0;

              for (const tickKey of allTickKeys) {
                const subgraphTick = subgraphState.ticks[tickKey];
                const multicallTick = multicallState.ticks[tickKey];

                if (subgraphTick && multicallTick) {
                  // Both methods have this tick
                  expect(multicallTick.liquidityGross).toBe(
                    subgraphTick.liquidityGross,
                  );
                  expect(multicallTick.liquidityNet).toBe(
                    subgraphTick.liquidityNet,
                  );
                  matchingTicks++;
                } else if (subgraphTick && !multicallTick) {
                  console.log(
                    `Tick ${tickKey} exists in subgraph but not in multicall: liquidityGross=${subgraphTick.liquidityGross}, liquidityNet=${subgraphTick.liquidityNet}`,
                  );
                  differingTicks++;
                } else if (!subgraphTick && multicallTick) {
                  console.log(
                    `Tick ${tickKey} exists in multicall but not in subgraph: liquidityGross=${multicallTick.liquidityGross}, liquidityNet=${multicallTick.liquidityNet}`,
                  );
                  differingTicks++;
                }
              }

              console.log(
                `Tick comparison: ${matchingTicks} matching, ${differingTicks} differing`,
              );

              // Compare tick bitmap data
              console.log(
                `Comparing bitmap data - Subgraph: ${
                  Object.keys(subgraphState.tickBitmap).length
                } entries, Multicall: ${
                  Object.keys(multicallState.tickBitmap).length
                } entries`,
              );

              const allBitmapKeys = new Set([
                ...Object.keys(subgraphState.tickBitmap),
                ...Object.keys(multicallState.tickBitmap),
              ]);

              let matchingBitmaps = 0;
              let differingBitmaps = 0;

              for (const bitmapKey of allBitmapKeys) {
                const subgraphBitmap = subgraphState.tickBitmap[bitmapKey];
                const multicallBitmap = multicallState.tickBitmap[bitmapKey];

                if (
                  subgraphBitmap !== undefined &&
                  multicallBitmap !== undefined
                ) {
                  expect(multicallBitmap).toBe(subgraphBitmap);
                  matchingBitmaps++;
                } else {
                  differingBitmaps++;
                  if (
                    subgraphBitmap !== undefined &&
                    multicallBitmap === undefined
                  ) {
                    console.log(
                      `Bitmap ${bitmapKey} exists in subgraph (${subgraphBitmap}) but not in multicall`,
                    );
                  } else {
                    console.log(
                      `Bitmap ${bitmapKey} exists in multicall (${multicallBitmap}) but not in subgraph`,
                    );
                  }
                }
              }

              console.log(
                `Bitmap comparison: ${matchingBitmaps} matching, ${differingBitmaps} differing`,
              );

              // Log summary
              console.log(
                'State generation comparison completed successfully!',
              );
              console.log(`Pool liquidity: ${subgraphState.liquidity}`);
              console.log(`Current tick: ${subgraphState.slot0.tick}`);
              console.log(`SqrtPriceX96: ${subgraphState.slot0.sqrtPriceX96}`);
            }, 30000);
          });
        });
      });
    });
  };

  // Test Base network
  // testNetworkPools(Network.BASE);

  // Test Mainnet network with focus (only run these tests)
  testNetworkPools(Network.MAINNET);

  // You can add more networks here:
  // testNetworkPools(Network.OPTIMISM);
  // testNetworkPools(Network.ARBITRUM);
  // etc.
});
