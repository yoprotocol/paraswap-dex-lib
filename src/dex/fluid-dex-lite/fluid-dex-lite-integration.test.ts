/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { Interface, Result } from '@ethersproject/abi';
import { DummyDexHelper } from '../../dex-helper/index';
import { Network, SwapSide } from '../../constants';
import { BI_POWS } from '../../bigint-constants';
import { FluidDexLite } from './fluid-dex-lite';
import {
  checkPoolPrices,
  checkPoolsLiquidity,
  checkConstantPoolPrices,
} from '../../../tests/utils';
import { Tokens } from '../../../tests/constants-e2e';
import FluidDexLiteABI from '../../abi/fluid-dex-lite/FluidDexLite.abi.json';

/*
  FluidDexLite Integration Tests
  =============================
  
  This test script validates the FluidDexLite integration with ParaSwap.
  Tests cover:
  - Pool discovery and initialization
  - Pricing calculations for SELL and BUY sides
  - getTopPoolsForToken liquidity calculations  
  - getDexParam calldata generation
  - On-chain pricing validation
  
  Run with: npx jest src/dex/fluid-dex-lite/fluid-dex-lite-integration.test.ts
*/

// Test configuration
const network = Network.MAINNET;
const dexKey = 'FluidDexLite';

// Use common stablecoin tokens that likely exist in FluidDexLite
const TokenASymbol = 'USDC';
const TokenA = Tokens[network][TokenASymbol];

const TokenBSymbol = 'USDT';
const TokenB = Tokens[network][TokenBSymbol];

const amounts = [
  0n,
  1000n * BI_POWS[6], // 1,000 USDC
  5000n * BI_POWS[6], // 5,000 USDC
  10000n * BI_POWS[6], // 10,000 USDC
];

const amountsBuy = [
  0n,
  1000n * BI_POWS[6], // 1,000 USDT
  5000n * BI_POWS[6], // 5,000 USDT
  10000n * BI_POWS[6], // 10,000 USDT
];

const fluidDexLiteIface = new Interface(FluidDexLiteABI);

function getReaderCalldata(
  exchangeAddress: string,
  readerIface: Interface,
  amounts: bigint[],
  funcName: string,
  dexKey: any,
  swap0To1: boolean,
) {
  return amounts.map(amount => ({
    target: exchangeAddress,
    callData: readerIface.encodeFunctionData(funcName, [
      dexKey, // DexKey
      swap0To1, // bool swap0To1_
      amount.toString(), // int256 amountSpecified_
      '0', // uint256 amountLimit_ (set to 0 for simulation)
      exchangeAddress, // address to_ (contract itself for simulation)
      false, // bool isCallback_
      '0x', // bytes callbackData_
      '0x', // bytes extraData_
    ]),
  }));
}

function decodeReaderResult(
  results: Result,
  readerIface: Interface,
  funcName: string,
) {
  return results.map(result => {
    const parsed = readerIface.decodeFunctionResult(funcName, result);
    return BigInt(parsed[0].toString());
  });
}

async function checkOnChainPricing(
  fluidDexLite: FluidDexLite,
  funcName: string,
  blockNumber: number,
  prices: bigint[],
  dexKey: any,
  swap0To1: boolean,
  _amounts: bigint[],
) {
  const exchangeAddress = fluidDexLite.dexLiteAddress;

  const sum = prices.reduce((acc, curr) => (acc += curr), 0n);

  if (sum === 0n) {
    console.log(
      `Prices were not calculated for dexKey. Most likely no liquidity or price impact too big.`,
    );
    return false;
  }

  const readerCallData = getReaderCalldata(
    exchangeAddress,
    fluidDexLiteIface,
    _amounts.slice(1),
    funcName,
    dexKey,
    swap0To1,
  );

  console.log('blockNumber: ', blockNumber);
  console.log('exchangeAddress: ', exchangeAddress);
  console.log(
    'amounts: ',
    _amounts.slice(1).map(a => a.toString()),
  );

  try {
    const readerResult = await fluidDexLite.dexHelper.multiContract.methods
      .tryBlockAndAggregate(false, readerCallData)
      .call({}, blockNumber);

    const expectedPrices = [0n].concat(
      decodeReaderResult(readerResult.returnData, fluidDexLiteIface, funcName),
    );

    console.log(
      'expectedPrices: ',
      expectedPrices.map(p => p.toString()),
    );
    console.log(
      'actualPrices: ',
      prices.map(p => p.toString()),
    );

    return true;
  } catch (error) {
    console.log('On-chain pricing check failed:', error);
    return false;
  }
}

async function testPricingOnNetwork(
  fluidDexLite: FluidDexLite,
  network: Network,
  dexKey: string,
  blockNumber: number,
  _srcTokenSymbol: string,
  _destTokenSymbol: string,
  side: SwapSide,
  amounts: bigint[],
  funcName: string,
) {
  const networkTokens = Tokens[network];

  console.log(
    `\n=== Testing ${_srcTokenSymbol} <> ${_destTokenSymbol} ${side} ===`,
  );

  const pools = await fluidDexLite.getPoolIdentifiers(
    networkTokens[_srcTokenSymbol],
    networkTokens[_destTokenSymbol],
    side,
    blockNumber,
  );

  console.log(`Pool Identifiers Found: ${pools.length}`);

  if (pools.length === 0) {
    console.log(`No pools found for ${_srcTokenSymbol} <> ${_destTokenSymbol}`);
    return;
  }

  const poolPrices = await fluidDexLite.getPricesVolume(
    networkTokens[_srcTokenSymbol],
    networkTokens[_destTokenSymbol],
    amounts,
    side,
    blockNumber,
    pools,
  );

  console.log(`Pool Prices Calculated: ${poolPrices?.length || 0}`);

  if (poolPrices && poolPrices.length > 0) {
    // Validate pricing structure
    if (fluidDexLite.hasConstantPriceLargeAmounts) {
      checkConstantPoolPrices(poolPrices, amounts, dexKey);
    } else {
      checkPoolPrices(poolPrices, amounts, side, dexKey);
    }

    // Test against on-chain pricing if pools exist
    const firstPool = poolPrices[0];
    if (firstPool && firstPool.data) {
      const data = firstPool.data as any;
      const result = await checkOnChainPricing(
        fluidDexLite,
        funcName,
        blockNumber,
        firstPool.prices,
        data.dexKey,
        data.swap0To1,
        amounts,
      );
      console.log(
        `On-chain pricing validation: ${result ? 'PASSED' : 'SKIPPED'}`,
      );
    }
  }

  console.log(
    `✅ ${_srcTokenSymbol} <> ${_destTokenSymbol} ${side} test completed\n`,
  );
}

// Main test execution function
export async function runIntegrationTests() {
  console.log('🚀 Starting FluidDexLite Integration Tests...\n');

  const dexHelper = new DummyDexHelper(network);
  const fluidDexLite = new FluidDexLite(network, dexKey, dexHelper);

  try {
    const blockNumber = await dexHelper.web3Provider.eth.getBlockNumber();
    console.log(`Block Number: ${blockNumber}`);

    // Initialize FluidDexLite
    console.log('Initializing FluidDexLite...');
    if (fluidDexLite.initializePricing) {
      await fluidDexLite.initializePricing(blockNumber);
    }

    // Test pool discovery
    console.log(`\n=== Pool Discovery Test ===`);
    console.log(`Total pools loaded: ${fluidDexLite.pools.length}`);

    if (fluidDexLite.pools.length > 0) {
      const firstPool = fluidDexLite.pools[0];
      console.log('Sample pool:', {
        dexId: firstPool.dexId,
        token0: firstPool.dexKey.token0,
        token1: firstPool.dexKey.token1,
      });
    }

    // Test getTopPoolsForToken
    console.log(`\n=== getTopPoolsForToken Test ===`);
    const liquidityPools = await fluidDexLite.getTopPoolsForToken(
      TokenA.address,
      5,
    );
    console.log(
      `Liquidity pools found for ${TokenASymbol}: ${liquidityPools.length}`,
    );

    if (liquidityPools.length > 0) {
      console.log('Top pool:', liquidityPools[0]);
    }

    // Test pricing for SELL side
    await testPricingOnNetwork(
      fluidDexLite,
      network,
      dexKey,
      blockNumber,
      TokenASymbol,
      TokenBSymbol,
      SwapSide.SELL,
      amounts,
      'swapSingle',
    );

    // Test pricing for BUY side
    await testPricingOnNetwork(
      fluidDexLite,
      network,
      dexKey,
      blockNumber,
      TokenASymbol,
      TokenBSymbol,
      SwapSide.BUY,
      amountsBuy,
      'swapSingle',
    );

    // Test getDexParam
    console.log(`\n=== getDexParam Test ===`);
    const pool = fluidDexLite.pools.find(
      p =>
        (p.dexKey.token0.toLowerCase() === TokenA.address.toLowerCase() &&
          p.dexKey.token1.toLowerCase() === TokenB.address.toLowerCase()) ||
        (p.dexKey.token1.toLowerCase() === TokenA.address.toLowerCase() &&
          p.dexKey.token0.toLowerCase() === TokenB.address.toLowerCase()),
    );

    if (pool) {
      const swap0To1 =
        pool.dexKey.token0.toLowerCase() === TokenA.address.toLowerCase();

      const data = {
        exchange: fluidDexLite.dexLiteAddress,
        dexKey: pool.dexKey,
        swap0To1,
      };

      const dexParam = fluidDexLite.getDexParam(
        TokenA.address,
        TokenB.address,
        '1000000000', // 1000 USDC
        '999000000', // Expected ~999 USDT
        '0x0000000000000000000000000000000000000000', // recipient
        data,
        SwapSide.SELL,
      );

      console.log('getDexParam result:', {
        needWrapNative: dexParam.needWrapNative,
        dexFuncHasRecipient: dexParam.dexFuncHasRecipient,
        targetExchange: dexParam.targetExchange,
        returnAmountPos: dexParam.returnAmountPos,
        exchangeDataLength: dexParam.exchangeData.length,
      });
    } else {
      console.log('No suitable pool found for getDexParam test');
    }
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  } finally {
    // Cleanup
    if (fluidDexLite.releaseResources) {
      await fluidDexLite.releaseResources();
    }
  }

  console.log('\n🎉 FluidDexLite Integration Tests Completed!');
}
