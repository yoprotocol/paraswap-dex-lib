/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import {
  Tokens,
  Holders,
  NativeTokenSymbols,
} from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

/*
  README
  ======

  This test script should add e2e tests for BunniV2. The tests
  should cover as many cases as possible. Most of the DEXes follow
  the following test structure:
    - DexName
      - ForkName + Network
        - ContractMethod
          - ETH -> Token swap
          - Token -> ETH swap
          - Token -> Token swap

  The template already enumerates the basic structure which involves
  testing simpleSwap, multiSwap, megaSwap contract methods for
  ETH <> TOKEN and TOKEN <> TOKEN swaps. You should replace tokenA and
  tokenB with any two highly liquid tokens on BunniV2 for the tests
  to work. If the tokens that you would like to use are not defined in
  Tokens or Holders map, you can update the './tests/constants-e2e'

  Other than the standard cases that are already added by the template
  it is highly recommended to add test cases which could be specific
  to testing BunniV2 (Eg. Tests based on poolType, special tokens,
  etc).

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-e2e.test.ts`

  e2e tests use the Tenderly fork api. Please add the following to your
  .env file:
  TENDERLY_TOKEN=Find this under Account>Settings>Authorization.
  TENDERLY_ACCOUNT_ID=Your Tenderly account name.
  TENDERLY_PROJECT=Name of a Tenderly project you have created in your
  dashboard.

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

function testForNetwork(
  network: Network,
  dexKey: string,
  tokenASymbol: string,
  tokenBSymbol: string,
  tokenAAmount: string,
  tokenBAmount: string,
) {
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );
  const tokens = Tokens[network];
  const holders = Holders[network];

  const sideToContractMethods = new Map([
    [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
    [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
  ]);

  describe(`${network}`, () => {
    sideToContractMethods.forEach((contractMethods, side) =>
      describe(`${side}`, () => {
        contractMethods.forEach((contractMethod: ContractMethod) => {
          describe(`${contractMethod}`, () => {
            it(
              `${tokenASymbol} -> ${tokenBSymbol}`,
              async () => {
                await testE2E(
                  tokens[tokenASymbol],
                  tokens[tokenBSymbol],
                  holders[tokenASymbol],
                  side === SwapSide.SELL ? tokenAAmount : tokenBAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              },
              100 * 1000,
            );
            it(
              `${tokenBSymbol} -> ${tokenASymbol}`,
              async () => {
                await testE2E(
                  tokens[tokenBSymbol],
                  tokens[tokenASymbol],
                  holders[tokenBSymbol],
                  side === SwapSide.SELL ? tokenBAmount : tokenAAmount,
                  side,
                  dexKey,
                  contractMethod,
                  network,
                  provider,
                );
              },
              100 * 1000,
            );
          });
        });
      }),
    );
  });
}

describe('BunniV2 E2E', () => {
  const dexKey = 'BunniV2';

  describe('Mainnet', () => {
    const network = Network.MAINNET;

    describe('USR -> USDC', () => {
      const tokenASymbol: string = 'USR';
      const tokenBSymbol: string = 'USDC';

      const tokenAAmount: string = '10000000000000000000000';
      const tokenBAmount: string = '10000000000';

      testForNetwork(
        network,
        dexKey,
        tokenASymbol,
        tokenBSymbol,
        tokenAAmount,
        tokenBAmount,
      );
    });

    // describe('ETH -> wstETH', () => {
    //   const tokenASymbol: string = 'ETH';
    //   const tokenBSymbol: string = 'wstETH';

    //   const tokenAAmount: string = '10000000000000000';
    //   const tokenBAmount: string = '10000000000000000';

    //   testForNetwork(
    //     network,
    //     dexKey,
    //     tokenASymbol,
    //     tokenBSymbol,
    //     tokenAAmount,
    //     tokenBAmount,
    //   );
    // });
  });

  // describe('Arbitrum', () => {
  //   const network = Network.ARBITRUM;

  //   describe.skip('USDC -> USDT', () => {
  //     const tokenASymbol: string = 'USDC';
  //     const tokenBSymbol: string = 'USDT';

  //     const tokenAAmount: string = '100000000';
  //     const tokenBAmount: string = '100000000';

  //     testForNetwork(
  //       network,
  //       dexKey,
  //       tokenASymbol,
  //       tokenBSymbol,
  //       tokenAAmount,
  //       tokenBAmount,
  //     );
  //   });

  // });

  // describe('Base', () => {
  //   const network = Network.BASE;

  //   describe.skip('ETH -> USDC', () => {
  //     const tokenASymbol: string = 'ETH';
  //     const tokenBSymbol: string = 'USDC';

  //     const tokenAAmount: string = '1000000000000000000';
  //     const tokenBAmount: string = '100000000';

  //     testForNetwork(
  //       network,
  //       dexKey,
  //       tokenASymbol,
  //       tokenBSymbol,
  //       tokenAAmount,
  //       tokenBAmount,
  //     );
  //   });

  // });
});
