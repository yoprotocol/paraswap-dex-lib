import { max, min } from '../../lib/Math';
import { SqrtPriceMath } from '../../lib/SqrtPriceMath';

export function getSqrtPriceTarget(
  zeroForOne: boolean,
  sqrtPriceNextX96: bigint,
  sqrtPriceLimitX96: bigint,
): bigint {
  return zeroForOne
    ? max(sqrtPriceNextX96, sqrtPriceLimitX96)
    : min(sqrtPriceNextX96, sqrtPriceLimitX96);
}

export function computeSwapStep(
  sqrtPriceCurrentX96: bigint,
  sqrtPriceTargetX96: bigint,
  liquidity: bigint,
  amountRemaining: bigint,
): { sqrtPriceNextX96: bigint; amountIn: bigint; amountOut: bigint } {
  let sqrtPriceNextX96: bigint = 0n;
  let amountIn: bigint = 0n;
  let amountOut: bigint = 0n;

  const zeroForOne: boolean = sqrtPriceCurrentX96 >= sqrtPriceTargetX96;
  const exactIn: boolean = amountRemaining < 0n;

  if (exactIn) {
    const amountRemainingAbs: bigint = -amountRemaining;
    amountIn = zeroForOne
      ? SqrtPriceMath.getAmount0Delta(
          sqrtPriceTargetX96,
          sqrtPriceCurrentX96,
          liquidity,
          true,
        )
      : SqrtPriceMath.getAmount1Delta(
          sqrtPriceCurrentX96,
          sqrtPriceTargetX96,
          liquidity,
          true,
        );

    if (amountRemainingAbs >= amountIn) {
      sqrtPriceNextX96 = sqrtPriceTargetX96;
    } else {
      amountIn = amountRemainingAbs;
      sqrtPriceNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
        sqrtPriceCurrentX96,
        liquidity,
        amountRemainingAbs,
        zeroForOne,
      );
    }

    amountOut = zeroForOne
      ? SqrtPriceMath.getAmount1Delta(
          sqrtPriceNextX96,
          sqrtPriceCurrentX96,
          liquidity,
          false,
        )
      : SqrtPriceMath.getAmount0Delta(
          sqrtPriceCurrentX96,
          sqrtPriceNextX96,
          liquidity,
          false,
        );
  } else {
    amountOut = zeroForOne
      ? SqrtPriceMath.getAmount1Delta(
          sqrtPriceTargetX96,
          sqrtPriceCurrentX96,
          liquidity,
          false,
        )
      : SqrtPriceMath.getAmount0Delta(
          sqrtPriceCurrentX96,
          sqrtPriceTargetX96,
          liquidity,
          false,
        );

    if (amountRemaining >= amountOut) {
      sqrtPriceNextX96 = sqrtPriceTargetX96;
    } else {
      amountOut = amountRemaining;
      sqrtPriceNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
        sqrtPriceCurrentX96,
        liquidity,
        amountOut,
        zeroForOne,
      );
    }

    amountIn = zeroForOne
      ? SqrtPriceMath.getAmount0Delta(
          sqrtPriceNextX96,
          sqrtPriceCurrentX96,
          liquidity,
          true,
        )
      : SqrtPriceMath.getAmount1Delta(
          sqrtPriceCurrentX96,
          sqrtPriceNextX96,
          liquidity,
          true,
        );
  }

  return { sqrtPriceNextX96, amountIn, amountOut };
}
