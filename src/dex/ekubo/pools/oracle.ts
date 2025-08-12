import { DeepReadonly } from 'ts-essentials';
import { FullRangePool, FullRangePoolState } from './full-range';
import { Quote } from './iface';

const BASE_GAS_COST_OF_ONE_ORACLE_SWAP = 32_000;

export class OraclePool extends FullRangePool {
  protected override _quote(
    amount: bigint,
    isToken1: boolean,
    state: DeepReadonly<FullRangePoolState.Object>,
    sqrtRatioLimit?: bigint,
  ): Quote {
    const fullRangeQuote = super._quote(
      amount,
      isToken1,
      state,
      sqrtRatioLimit,
    );

    fullRangeQuote.gasConsumed = BASE_GAS_COST_OF_ONE_ORACLE_SWAP;

    return fullRangeQuote;
  }
}
