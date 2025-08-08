import { DeepReadonly } from 'ts-essentials';
import { FullRangePool, FullRangePoolState } from './full-range';
import { Quote } from './iface';

const GAS_COST_OF_UPDATING_ORACLE_SNAPSHOT = 10_000;

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

    if (fullRangeQuote.calculatedAmount !== 0n) {
      fullRangeQuote.gasConsumed += GAS_COST_OF_UPDATING_ORACLE_SNAPSHOT;
    }

    return fullRangeQuote;
  }
}
