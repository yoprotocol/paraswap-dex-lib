/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { StaticJsonRpcProvider } from '@ethersproject/providers';
import {
  Holders,
  NativeTokenSymbols,
  Tokens,
} from '../../../tests/constants-e2e';
import { testE2E } from '../../../tests/utils-e2e';
import { generateConfig } from '../../config';
import { ContractMethod, Network, SwapSide } from '../../constants';

function testForNetwork(
  network: Network,
  dexKey: string,
  nativeTokenAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];
  const nativeTokenSymbol = NativeTokenSymbols[network];

  const sideToContractMethods = new Map([
    [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
    [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
  ]);

  const tokensToTest = [
    [
      {
        symbol: 'WBTC',
        amount: '100000000',
        withNative: true,
      },
      {
        symbol: 'cbBTC',
        amount: '100000000',
        withNative: false,
      },
    ],
    [
      {
        symbol: 'USDC',
        amount: '10000000',
        withNative: false,
      },
      {
        symbol: 'USDT',
        amount: '10000000',
        withNative: true,
      },
    ],
  ];

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            function test(
              srcTokenSymbol: string,
              destTokenSymbol: string,
              amount: string,
              side: SwapSide,
            ) {
              return testE2E(
                tokens[srcTokenSymbol],
                tokens[destTokenSymbol],
                holders[srcTokenSymbol],
                amount,
                side,
                dexKey,
                contractMethod,
                network,
                provider,
              );
            }

            tokensToTest.forEach(([tokenA, tokenB]) => {
              it(`${tokenA.symbol} -> ${tokenB.symbol}`, () =>
                test(
                  tokenA.symbol,
                  tokenB.symbol,
                  side === SwapSide.SELL ? tokenA.amount : tokenB.amount,
                  side,
                ));
              it(`${tokenB.symbol} -> ${tokenA.symbol}`, () =>
                test(
                  tokenB.symbol,
                  tokenA.symbol,
                  side === SwapSide.SELL ? tokenB.amount : tokenA.amount,
                  side,
                ));

              if (tokenA.withNative) {
                it(`${tokenA.symbol} -> ${nativeTokenSymbol}`, () =>
                  test(
                    tokenA.symbol,
                    nativeTokenSymbol,
                    side === SwapSide.SELL ? tokenA.amount : nativeTokenAmount,
                    side,
                  ));
                it(`${nativeTokenSymbol} -> ${tokenA.symbol}`, () =>
                  test(
                    nativeTokenSymbol,
                    tokenA.symbol,
                    side === SwapSide.SELL ? nativeTokenAmount : tokenA.amount,
                    side,
                  ));
              }

              if (tokenB.withNative) {
                it(`${tokenB.symbol} -> ${nativeTokenSymbol}`, () =>
                  test(
                    tokenB.symbol,
                    nativeTokenSymbol,
                    side === SwapSide.SELL ? tokenB.amount : nativeTokenAmount,
                    side,
                  ));
                it(`${nativeTokenSymbol} -> ${tokenB.symbol}`, () =>
                  test(
                    nativeTokenSymbol,
                    tokenB.symbol,
                    side === SwapSide.SELL ? nativeTokenAmount : tokenB.amount,
                    side,
                  ));
              }
            });
          });
        });
      }),
    );
  });
}

describe('Ekubo E2E', () => {
  const dexKey = 'Ekubo';

  describe('Mainnet', () => {
    const network = Network.MAINNET;
    const nativeTokenAmount = '1000000000000000';

    testForNetwork(network, dexKey, nativeTokenAmount);
  });
});
