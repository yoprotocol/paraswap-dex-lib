import { BunniHookVersions } from '../config';
import { hookletAfterSwapView, hookletBeforeSwapView } from '../hooklet';
import { LDFType } from '../ldf/LDFType';
import {
  MAX_INT_128,
  MIN_INT_128,
  SWAP_FEE_BASE,
  ZERO_BYTES_32,
} from '../lib/Constants';
import { queryLDF } from '../lib/QueryLDF';
import { queryTwap } from '../lib/QueryTwap';
import { TickMath } from '../lib/TickMath';
import { getReservesInUnderlying } from '../lib/VaultMath';
import {
  BunniComputeSwapInput,
  DexParams,
  PoolState,
  SwapParams,
} from '../types';
import { _shouldSurgeFromVaults, decodeParams } from './BunniHookLogic';

import * as v0 from '../hooks/v0/BunniSwapMath';
import * as v1 from '../hooks/v1/BunniSwapMath';
import { abs, max, min, mulDivUp } from '../lib/Math';
import { computeDynamicSwapFee, computeSurgeFee } from '../lib/FeeMath';
import { getTopBid } from './AmAmm';
import { decodeAmAmmPayload } from '../lib/AmAmmPayload';
import { NULL_ADDRESS } from '../../../constants';

export function quoteSwap(
  state: PoolState,
  params: SwapParams,
  blockNumber: bigint,
  config: DexParams,
): {
  success: boolean;
  updatedSqrtPriceX96: bigint;
  updatedTick: bigint;
  inputAmount: bigint;
  outputAmount: bigint;
  swapFee: bigint;
  totalLiquidity: bigint;
} {
  // TODO check if this is indeed valid for blockTimestamp
  const blockTimestamp = BigInt(Math.floor(Date.now() / 1e3));

  let success: boolean = false;
  let updatedSqrtPriceX96: bigint = 0n;
  let updatedTick: bigint = 0n;
  let inputAmount: bigint = 0n;
  let outputAmount: bigint = 0n;
  let swapFee: bigint = 0n;
  let totalLiquidity: bigint = 0n;

  // get pool state
  let sqrtPriceX96 = state.sqrtPriceX96;
  let currentTick = state.tick;
  let lastSwapTimestamp = state.lastSwapTimestamp;
  let lastSurgeTimestamp = state.lastSurgeTimestamp;

  // hooklet call
  const {
    success: success_,
    feeOverridden,
    fee: feeOverride,
    priceOverridden,
    sqrtPriceX96: sqrtPriceX96Override,
  } = hookletBeforeSwapView(state.hooklet);

  if (!success_) {
    return _falsyReturnValues();
  }

  // override price if needed
  if (priceOverridden) {
    sqrtPriceX96 = sqrtPriceX96Override;
    currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96Override);
  }

  // ensure swap makes sense
  if (
    sqrtPriceX96 === 0n ||
    (params.zeroForOne &&
      (params.sqrtPriceLimitX96 >= sqrtPriceX96 ||
        params.sqrtPriceLimitX96 <= TickMath.MIN_SQRT_PRICE)) ||
    (!params.zeroForOne &&
      (params.sqrtPriceLimitX96 <= sqrtPriceX96 ||
        params.sqrtPriceLimitX96 >= TickMath.MAX_SQRT_PRICE)) ||
    params.amountSpecified > MAX_INT_128 ||
    params.amountSpecified < MIN_INT_128
  ) {
    return _falsyReturnValues();
  }

  // compute total token balances
  const [reserveBalance0, reserveBalance1] = [
    getReservesInUnderlying(state.reserve0, state.vault0),
    getReservesInUnderlying(state.reserve1, state.vault1),
  ];
  const [balance0, balance1] = [
    state.rawBalance0 + reserveBalance0,
    state.rawBalance1 + reserveBalance1,
  ];

  // if it's an exact output swap, exit if the requested output is greater than the balance
  const exactIn: boolean = params.amountSpecified < 0n;
  if (
    !exactIn &&
    -params.amountSpecified > (params.zeroForOne ? balance1 : balance0)
  ) {
    return _falsyReturnValues();
  }

  // decode hook params
  const hookParams = decodeParams(state.hookParams);

  // get TWAP values
  const arithmeticMeanTick =
    state.twapSecondsAgo !== 0n
      ? queryTwap(state, state.twapSecondsAgo, blockTimestamp)
      : 0n;
  const feeMeanTick =
    !feeOverridden && hookParams.feeTwapSecondsAgo !== 0n
      ? queryTwap(state, hookParams.feeTwapSecondsAgo, blockTimestamp)
      : 0n;

  // query the LDF to get total liquidity and token densities
  const ldfState =
    state.ldfType === LDFType.DYNAMIC_AND_STATEFUL
      ? state.ldfState
      : ZERO_BYTES_32;
  let {
    totalLiquidity: totalLiquidity_,
    liquidityDensityOfRoundedTickX96,
    activeBalance0: currentActiveBalance0,
    activeBalance1: currentActiveBalance1,
    shouldSurge,
  } = queryLDF(
    state.key,
    sqrtPriceX96,
    currentTick,
    arithmeticMeanTick,
    state.liquidityDensityFunction,
    state.ldfParams,
    ldfState,
    balance0,
    balance1,
    state.idleBalance,
  );
  shouldSurge = shouldSurge && state.ldfType !== LDFType.STATIC;
  totalLiquidity = totalLiquidity_;

  // ensure the current active balance of the requested output token is not zero
  if (
    (params.zeroForOne && currentActiveBalance1 === 0n) ||
    (!params.zeroForOne && currentActiveBalance0 === 0n) ||
    totalLiquidity === 0n ||
    (!exactIn &&
      abs(params.amountSpecified) >
        (params.zeroForOne ? currentActiveBalance1 : currentActiveBalance0))
  ) {
    return _falsyReturnValues();
  }

  // check surge based on vault share prices
  shouldSurge =
    shouldSurge ||
    _shouldSurgeFromVaults(state, hookParams, reserveBalance0, reserveBalance1);

  // compute swap result
  ({ updatedSqrtPriceX96, updatedTick, inputAmount, outputAmount } =
    __computeSwap({
      key: state.key,
      totalLiquidity,
      liquidityDensityOfRoundedTickX96,
      currentActiveBalance0,
      currentActiveBalance1,
      sqrtPriceX96,
      currentTick,
      liquidityDensityFunction: state.liquidityDensityFunction,
      arithmeticMeanTick,
      ldfParams: state.ldfParams,
      ldfState,
      swapParams: params,
    }));

  // exit if it's an exact output swap and outputAmount < params.amountSpecified
  // ensure swap never moves price in the opposite direction
  // ensure the inputAmount is non-zero when it's an exact output swap
  if (
    (!exactIn && outputAmount < abs(params.amountSpecified)) ||
    (params.zeroForOne && updatedSqrtPriceX96 > sqrtPriceX96) ||
    (!params.zeroForOne && updatedSqrtPriceX96 < sqrtPriceX96) ||
    outputAmount === 0n ||
    inputAmount === 0n
  ) {
    return _falsyReturnValues();
  }

  if (shouldSurge) {
    const timeSinceLastSwap = blockTimestamp - lastSwapTimestamp;
    lastSurgeTimestamp =
      timeSinceLastSwap >= hookParams.surgeFeeAutostartThreshold
        ? lastSwapTimestamp + hookParams.surgeFeeAutostartThreshold
        : blockTimestamp;
  }

  // get am-AMM state
  let amAmmSwapFee: bigint = 0n;
  let amAmmManager: string = NULL_ADDRESS;
  if (hookParams.amAmmEnabled) {
    const topBid = getTopBid(state, blockNumber, config);
    const { swapFee0For1, swapFee1For0 } = decodeAmAmmPayload(topBid.payload);
    amAmmManager = topBid.manager;
    amAmmSwapFee = params.zeroForOne ? swapFee0For1 : swapFee1For0;
  }

  // charge swap fee
  let swapFeeAmount: bigint = 0n;
  const useAmAmmFee = hookParams.amAmmEnabled && amAmmManager !== NULL_ADDRESS;
  const hookFeesBaseSwapFee = feeOverridden
    ? feeOverride
    : computeDynamicSwapFee(
        updatedSqrtPriceX96,
        feeMeanTick,
        lastSurgeTimestamp,
        hookParams.feeMin,
        hookParams.feeMax,
        hookParams.feeQuadraticMultiplier,
        hookParams.surgeFeeHalfLife,
        blockTimestamp,
      );
  swapFee = useAmAmmFee
    ? max(
        amAmmSwapFee,
        computeSurgeFee(
          lastSurgeTimestamp,
          hookParams.surgeFeeHalfLife,
          blockTimestamp,
        ),
      )
    : hookFeesBaseSwapFee;

  if (exactIn) {
    swapFeeAmount = mulDivUp(outputAmount, swapFee, SWAP_FEE_BASE);
    if (useAmAmmFee) {
      // TODO
    }
    outputAmount -= swapFeeAmount;

    const actualInputAmount = max(-params.amountSpecified, inputAmount);
    inputAmount = actualInputAmount;
  } else {
    swapFeeAmount = mulDivUp(inputAmount, swapFee, SWAP_FEE_BASE - swapFee);
    if (useAmAmmFee) {
      // TODO
    }
    inputAmount += swapFeeAmount;

    const actualOutputAmount = min(params.amountSpecified, outputAmount);
    outputAmount = actualOutputAmount;
  }

  ({ success } = hookletAfterSwapView(state.hooklet));

  return {
    success,
    updatedSqrtPriceX96,
    updatedTick,
    inputAmount,
    outputAmount,
    swapFee,
    totalLiquidity,
  };
}

function __computeSwap(input: BunniComputeSwapInput): {
  updatedSqrtPriceX96: bigint;
  updatedTick: bigint;
  inputAmount: bigint;
  outputAmount: bigint;
} {
  const version = BunniHookVersions[input.key.hooks.toLowerCase()];
  const module = version === 'v0' ? v0 : v1;
  return module.computeSwap(input);
}

function _falsyReturnValues(): {
  success: boolean;
  updatedSqrtPriceX96: bigint;
  updatedTick: bigint;
  inputAmount: bigint;
  outputAmount: bigint;
  swapFee: bigint;
  totalLiquidity: bigint;
} {
  return {
    success: false,
    updatedSqrtPriceX96: 0n,
    updatedTick: 0n,
    inputAmount: 0n,
    outputAmount: 0n,
    swapFee: 0n,
    totalLiquidity: 0n,
  };
}
