import _ from 'lodash';
import { getReservesInUnderlying } from '../lib/VaultMath';
import { PoolState } from '../types';
import { divWadUp, mulDiv, mulDivUp } from '../lib/Math';
import { RAW_TOKEN_RATIO_BASE } from '../lib/Constants';
import { IdleBalanceLibrary } from '../lib/IdleBalance';
import { queryTwap } from '../lib/QueryTwap';
import { LDFType } from '../ldf/LDFType';
import { queryLDF } from '../lib/QueryLDF';
import { NULL_ADDRESS } from '../../../constants';

export function deposit(
  state: PoolState,
  params: DepositParams,
  blockTimestamp: bigint,
): PoolState {
  const newState = _.cloneDeep(state);

  let amount0: bigint;
  let amount1: bigint;

  const depositReturnData: DepositLogicReturnData = _depositLogic(
    {
      state: newState,
      params: params,
      poolId: state.id,
      currentTick: state.tick,
      sqrtPriceX96: state.sqrtPriceX96,
    },
    blockTimestamp,
  );

  let reserveAmount0: bigint = depositReturnData.reserveAmount0;
  let reserveAmount1: bigint = depositReturnData.reserveAmount1;
  amount0 = depositReturnData.amount0;
  amount1 = depositReturnData.amount1;

  const rawAmount0: bigint =
    state.vault0 !== NULL_ADDRESS ? amount0 - reserveAmount0 : amount0;
  const rawAmount1: bigint =
    state.vault1 !== NULL_ADDRESS ? amount1 - reserveAmount1 : amount1;
  newState.rawBalance0 += rawAmount0;
  newState.rawBalance1 += rawAmount1;

  // TODO Support Fee on Transfer Tokens
  // The rawAmounts should technically be set using the deposit
  // unlock callback return values. These return values will always
  // match the rawAmounts above EXCEPT for tokens with a fee on
  // transfer.

  let amount0Spent: bigint = rawAmount0;
  let amount1Spent: bigint = rawAmount1;

  if (state.vault0 !== NULL_ADDRESS && reserveAmount0 !== 0n) {
    const { reserveChange, reserveChangeInUnderlying, amountSpent } =
      _depositVaultReserve(reserveAmount0, state.vault0);
    newState.reserve0 += reserveChange;
    reserveAmount0 = reserveChangeInUnderlying;
    amount0Spent += amountSpent;
  }

  if (state.vault1 !== NULL_ADDRESS && reserveAmount1 !== 0n) {
    const { reserveChange, reserveChangeInUnderlying, amountSpent } =
      _depositVaultReserve(reserveAmount1, state.vault1);
    newState.reserve1 += reserveChange;
    reserveAmount1 = reserveChangeInUnderlying;
    amount1Spent += amountSpent;
  }

  // update amount0 and amount1 to be the actual amounts added to the pool balance
  amount0 =
    state.vault0 !== NULL_ADDRESS ? rawAmount0 + reserveAmount0 : rawAmount0;
  amount1 =
    state.vault1 !== NULL_ADDRESS ? rawAmount1 + reserveAmount1 : rawAmount1;

  if (depositReturnData.balance0 === 0n && depositReturnData.balance1 === 0n) {
    if (state.idleBalance !== IdleBalanceLibrary.ZERO) {
      newState.idleBalance = IdleBalanceLibrary.ZERO;
    }
  } else {
    // TODO this logic has not been verified for correctness with actual data
    const { rawBalance, isToken0 } = IdleBalanceLibrary.fromIdleBalance(
      state.idleBalance,
    );
    const newBalance =
      rawBalance +
      (isToken0
        ? depositReturnData.balance0 === 0n
          ? amount0
          : mulDivUp(amount0, rawBalance, depositReturnData.balance0)
        : depositReturnData.balance1 === 0n
        ? amount1
        : mulDivUp(amount1, rawBalance, depositReturnData.balance1));

    if (newBalance !== rawBalance) {
      newState.idleBalance = IdleBalanceLibrary.toIdleBalance(
        newBalance,
        isToken0,
      );
    }
  }

  return newState;
}

export function withdraw(state: PoolState, params: WithdrawParams): PoolState {
  const newState = _.cloneDeep(state);

  let amount0: bigint;
  let amount1: bigint;

  // TODO logic needs updating to support pools with rehypo (can we use the ERC4626 DEX?)
  const reserveAmount0 = getReservesInUnderlying(
    mulDiv(state.reserve0, params.shares, state.totalSupply),
    state.vault0,
  );
  const reserveAmount1 = getReservesInUnderlying(
    mulDiv(state.reserve1, params.shares, state.totalSupply),
    state.vault1,
  );
  const rawAmount0 = mulDiv(
    state.rawBalance0,
    params.shares,
    state.totalSupply,
  );
  const rawAmount1 = mulDiv(
    state.rawBalance1,
    params.shares,
    state.totalSupply,
  );
  amount0 = reserveAmount0 + rawAmount0;
  amount1 = reserveAmount1 + rawAmount1;

  // update the idle balance
  const { rawBalance, isToken0 } = IdleBalanceLibrary.fromIdleBalance(
    state.idleBalance,
  );
  const newBalance =
    rawBalance - mulDiv(rawBalance, params.shares, state.totalSupply);
  if (newBalance !== rawBalance) {
    newState.idleBalance = IdleBalanceLibrary.toIdleBalance(
      newBalance,
      isToken0,
    );
  }

  if (state.vault0 !== NULL_ADDRESS && reserveAmount0 !== 0n) {
    const { reserveChange } = _withdrawVaultReserve(
      reserveAmount0,
      state.vault0,
    );
    newState.reserve0 -= reserveChange;
  }

  if (state.vault1 !== NULL_ADDRESS && reserveAmount1 !== 0n) {
    const { reserveChange } = _withdrawVaultReserve(
      reserveAmount1,
      state.vault1,
    );
    newState.reserve1 -= reserveChange;
  }

  // TODO Support Fee on Transfer Tokens
  // The rawAmounts should technically be set using the withdraw
  // unlock callback return values. These return values will always
  // match the rawAmounts above EXCEPT for tokens with a fee on
  // transfer.

  newState.rawBalance0 -= rawAmount0;
  newState.rawBalance1 -= rawAmount1;

  return newState;
}

export function hookHandleSwap(
  state: PoolState,
  zeroForOne: boolean,
  inputAmount: bigint,
  outputAmount: bigint,
): void {
  let stateRawBalance0: bigint = state.rawBalance0;
  let stateRawBalance1: bigint = state.rawBalance1;
  let stateReserve0: bigint = state.reserve0;
  let stateReserve1: bigint = state.reserve1;

  const inputToken = zeroForOne ? state.key.currency0 : state.key.currency1;
  const outputToken = zeroForOne ? state.key.currency1 : state.key.currency0;
  const initialReserve0: bigint = state.reserve0;
  const initialReserve1: bigint = state.reserve1;

  // pull input claim tokens from hook
  if (inputAmount !== 0n) {
    // zeroForOne ? state.rawBalance0 += inputAmount : state.rawBalance1 += inputAmount;
    zeroForOne
      ? (stateRawBalance0 += inputAmount)
      : (stateRawBalance1 += inputAmount);
    // then there is a transfer call that we can ignore
  }

  if (outputAmount !== 0n) {
    const outputRawBalance: bigint = zeroForOne
      ? state.rawBalance1
      : state.rawBalance0;
    const outputVault: string = zeroForOne ? state.vault1 : state.vault0;
    if (outputVault !== NULL_ADDRESS && outputRawBalance < outputAmount) {
      // TODO
      // _updateVaultReserveViaClaimTokens();
      // _updateBalance();
    }
    zeroForOne
      ? (stateRawBalance1 -= outputAmount)
      : (stateRawBalance0 -= outputAmount);
    // then transfer call that we can probably ignore
  }

  if (state.vault0 !== NULL_ADDRESS) {
    // _updateRawBalanceIfNeeded();
  }

  if (state.vault1 !== NULL_ADDRESS) {
    // _updateRawBalanceIfNeeded();
  }

  state.rawBalance0 = stateRawBalance0;
  state.rawBalance1 = stateRawBalance1;

  if (state.vault0 !== NULL_ADDRESS && initialReserve0 !== stateReserve0) {
    state.reserve0 = stateReserve0;
  }

  if (state.vault1 !== NULL_ADDRESS && initialReserve1 !== stateReserve1) {
    state.reserve1 = stateReserve1;
  }
}

/*
  Modified from the originally written solidity specifically
  to handle deposit events where the acutal emitted amounts
  are known. Replicating the solidity logic exactly will lead
  to incorrect values and should not be used unless further
  development deems it necessary.
*/
function _depositLogic(
  inputData: DepositLogicInputData,
  blockTimestamp: bigint,
): DepositLogicReturnData {
  const returnData: DepositLogicReturnData = {
    reserveAmount0: 0n,
    reserveAmount1: 0n,
    amount0: 0n,
    amount1: 0n,
    balance0: 0n,
    balance1: 0n,
  };

  const { reserveBalance0, reserveBalance1 } = {
    reserveBalance0: getReservesInUnderlying(
      inputData.state.reserve0,
      inputData.state.vault0,
    ),
    reserveBalance1: getReservesInUnderlying(
      inputData.state.reserve1,
      inputData.state.vault1,
    ),
  };

  returnData.amount0 = inputData.params.amount0Desired;
  returnData.amount1 = inputData.params.amount1Desired;
  returnData.balance0 = inputData.state.rawBalance0 + reserveBalance0;
  returnData.balance1 = inputData.state.rawBalance1 + reserveBalance1;

  const requiresLDF: boolean =
    returnData.balance0 === 0n && returnData.balance1 === 0n;

  if (requiresLDF) {
    const useTwap = inputData.state.twapSecondsAgo !== 0n;
    const arithmeticMeanTick = useTwap
      ? queryTwap(
          inputData.state,
          inputData.state.twapSecondsAgo,
          blockTimestamp,
        )
      : 0n;

    const { newLdfState } = queryLDF(
      inputData.state.key,
      inputData.sqrtPriceX96,
      inputData.currentTick,
      arithmeticMeanTick,
      inputData.state.liquidityDensityFunction,
      inputData.state.ldfParams,
      inputData.state.ldfState,
      inputData.params.amount0Desired,
      inputData.params.amount1Desired,
      IdleBalanceLibrary.ZERO,
    );

    if (inputData.state.ldfType === LDFType.DYNAMIC_AND_STATEFUL) {
      inputData.state.ldfState = newLdfState;
    }

    returnData.reserveAmount0 =
      returnData.amount0 -
      mulDiv(
        returnData.amount0,
        inputData.state.targetRawTokenRatio0,
        RAW_TOKEN_RATIO_BASE,
      );
    returnData.reserveAmount1 =
      returnData.amount1 -
      mulDiv(
        returnData.amount1,
        inputData.state.targetRawTokenRatio1,
        RAW_TOKEN_RATIO_BASE,
      );
  } else {
    const balance0 = returnData.balance0;
    const balance1 = returnData.balance1;

    returnData.reserveAmount0 =
      balance0 === 0n
        ? 0n
        : mulDiv(returnData.amount0, reserveBalance0, balance0);
    returnData.reserveAmount1 =
      balance1 === 0n
        ? 0n
        : mulDiv(returnData.amount1, reserveBalance1, balance1);
  }

  // modify reserveAmount0 using ERC4626::maxDeposit()
  if (
    inputData.state.vault0 !== NULL_ADDRESS &&
    returnData.reserveAmount0 !== 0n
  ) {
    // TODO use maxDeposit()
    const maxDeposit0: bigint = returnData.reserveAmount0;
    if (returnData.reserveAmount0 > maxDeposit0) {
      returnData.reserveAmount0 = maxDeposit0;
    }
  }

  // modify reserveAmount1 using ERC4626::maxDeposit()
  if (
    inputData.state.vault1 !== NULL_ADDRESS &&
    returnData.reserveAmount1 !== 0n
  ) {
    // TODO use maxDeposit()
    const maxDeposit1: bigint = returnData.reserveAmount1;
    if (returnData.reserveAmount1 > maxDeposit1) {
      returnData.reserveAmount1 = maxDeposit1;
    }
  }

  return returnData;
}

function _depositVaultReserve(
  amount: bigint,
  vault: string,
): {
  reserveChange: bigint;
  reserveChangeInUnderlying: bigint;
  amountSpent: bigint;
} {
  // TODO
  return { reserveChange: 0n, reserveChangeInUnderlying: 0n, amountSpent: 0n };
}

function _withdrawVaultReserve(
  amount: bigint,
  vault: string,
): { reserveChange: bigint } {
  // TODO
  return { reserveChange: 0n };
}

export type DepositParams = {
  amount0Desired: bigint;
  amount1Desired: bigint;
  vaultFee0: bigint;
  vaultFee1: bigint;
};

export type WithdrawParams = {
  shares: bigint;
};

export type DepositLogicInputData = {
  state: PoolState;
  params: DepositParams;
  poolId: string;
  currentTick: bigint;
  sqrtPriceX96: bigint;
};

export type DepositLogicReturnData = {
  reserveAmount0: bigint;
  reserveAmount1: bigint;
  amount0: bigint;
  amount1: bigint;
  balance0: bigint;
  balance1: bigint;
};
