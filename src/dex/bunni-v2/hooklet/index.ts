import { NULL_ADDRESS } from '../../../constants';

export function hookletBeforeSwap(hooklet: string): {
  success: boolean;
  feeOverridden: boolean;
  fee: bigint;
  priceOverridden: boolean;
  sqrtPriceX96: bigint;
} {
  if (hooklet !== NULL_ADDRESS) {
    throw new Error(`Hooklet ${hooklet} not yet supported`);
  }

  return {
    success: true,
    feeOverridden: false,
    fee: 0n,
    priceOverridden: false,
    sqrtPriceX96: 0n,
  };
}

export function hookletBeforeSwapView(hooklet: string): {
  success: boolean;
  feeOverridden: boolean;
  fee: bigint;
  priceOverridden: boolean;
  sqrtPriceX96: bigint;
} {
  if (hooklet !== NULL_ADDRESS) {
    throw new Error(`Hooklet ${hooklet} not yet supported`);
  }

  return {
    success: true,
    feeOverridden: false,
    fee: 0n,
    priceOverridden: false,
    sqrtPriceX96: 0n,
  };
}

export function hookletAfterSwap(hooklet: string): { success: boolean } {
  if (hooklet !== NULL_ADDRESS) {
    throw new Error(`Hooklet ${hooklet} not yet supported`);
  }

  return { success: true };
}

export function hookletAfterSwapView(hooklet: string): { success: boolean } {
  if (hooklet !== NULL_ADDRESS) {
    throw new Error(`Hooklet ${hooklet} not yet supported`);
  }

  return { success: true };
}
