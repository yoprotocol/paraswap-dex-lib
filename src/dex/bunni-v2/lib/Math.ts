import { WAD } from './Constants';

export function abs(x: bigint): bigint {
  return x > 0 ? x : -x;
}

export function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function mulDiv(a: bigint, b: bigint, c: bigint): bigint {
  return (a * b) / c;
}

export function mulDivUp(a: bigint, b: bigint, c: bigint): bigint {
  return (a * b + c - 1n) / c;
}

export function divUp(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

export function divWad(x: bigint, y: bigint): bigint {
  return (x * WAD) / y;
}

export function divWadUp(x: bigint, y: bigint): bigint {
  const product = x * WAD;
  const hasRemainder = product % y !== 0n;
  return product / y + (hasRemainder ? 1n : 0n);
}

export function mulWad(x: bigint, y: bigint): bigint {
  return (x * y) / WAD;
}

export function mulWadUp(x: bigint, y: bigint): bigint {
  const product = x * y;
  const hasRemainder = product % WAD !== 0n;
  return product / WAD + (hasRemainder ? 1n : 0n);
}

export function absDiff(
  x: bigint,
  y: bigint,
): { positive: boolean; diff: bigint } {
  const positive = x > y;
  const diff = positive ? x - y : y - x;
  return { positive, diff };
}

export function roundTick(
  currentTick: bigint,
  tickSpacing: bigint,
): { roundedTick: bigint; nextRoundedTick: bigint } {
  let compressed = currentTick / tickSpacing;
  if (currentTick < 0n && currentTick % tickSpacing !== 0n) compressed -= 1n;
  const roundedTick = compressed * tickSpacing;
  const nextRoundedTick = roundedTick + tickSpacing;
  return { roundedTick, nextRoundedTick };
}

export function roundTickSingle(
  currentTick: bigint,
  tickSpacing: bigint,
): bigint {
  let compressed = currentTick / tickSpacing;
  if (currentTick < 0n && currentTick % tickSpacing !== 0n) compressed -= 1n;
  return compressed * tickSpacing;
}

export function subReLU(x: bigint, y: bigint): bigint {
  return x > y ? x - y : 0n;
}

export function roundUpFullMulDivResult(
  x: bigint,
  y: bigint,
  d: bigint,
  resultRoundedDown: bigint,
): bigint {
  let result = resultRoundedDown;

  const mulMod = (x * y) % d;

  if (mulMod > 0n) {
    result = resultRoundedDown + 1n;
  }

  return result;
}

export function fullMulDiv(x: bigint, y: bigint, d: bigint) {
  return (x * y) / d;
  // // Lower 256 bits of x * y
  // let z = x * y;

  // // Check if we can do simple division
  // if ((x === 0n || z / x === y) && d !== 0n) {
  //   return z / d;
  // }

  // // Need to use full precision calculation
  // // Get the upper bits of the product using modular arithmetic
  // const MAX_UINT256 = 2n ** 256n - 1n;
  // const mm = (x * y) % (MAX_UINT256 + 1n);

  // // Calculate p1 (upper 256 bits of x * y)
  // // p1 = mm - (z + (mm < z ? 1 : 0))
  // const p1 = mm - (z + (mm < z ? 1n : 0n));

  // // Compute remainder using mulmod
  // const r = (x * y) % d;

  // // The least significant bit of d. t >= 1
  // const t = d & -d;

  // // Divide d by t (a power of two)
  // const dDivT = d / t;

  // // Start with a seed that is correct for four bits
  // let inv = 2n ^ (3n * dDivT);

  // // Newton-Raphson iteration to improve precision
  // inv = inv * (2n - dDivT * inv); // inverse mod 2^8
  // inv = inv * (2n - dDivT * inv); // inverse mod 2^16
  // inv = inv * (2n - dDivT * inv); // inverse mod 2^32
  // inv = inv * (2n - dDivT * inv); // inverse mod 2^64
  // inv = inv * (2n - dDivT * inv); // inverse mod 2^128

  // // Calculate final result with full precision

  // // Calculate (z - r) / t
  // const zMinusRDivT = (z - r) / t;

  // // Calculate (p1 - (r > z ? 1 : 0)) * ((-t / t) + 1)
  // const p1Term = (p1 - (r > z ? 1n : 0n)) * (((-t) / t) + 1n);

  // // Combine the terms
  // const numerator = p1Term | zMinusRDivT;

  // // Final multiplication by the refined inverse
  // z = numerator * ((2n - dDivT * inv) * inv);

  // return z;
}

export function fullMulDivUp(x: bigint, y: bigint, d: bigint): bigint {
  let z = fullMulDiv(x, y, d);

  // Solidity's `mulmod(x, y, d)` checks if there's a remainder.
  // If `(x * y) % d` is non-zero, it means we need to round up.
  // The `mulmod` opcode returns `(x * y) % d`.
  const product = x * y; // Compute the full product
  if (product % d !== 0n) {
    z += 1n; // Increment to achieve ceiling

    // Solidity's `iszero(z)` check after incrementing handles the case
    // where `z` was `MAX_UINT256` and adding 1 causes it to wrap around to `0`.
    // In BigInt, we just check if it exceeds `MAX_UINT256`.
    // if (z > MAX_UINT256) {
    //     throw new Error("FullMulDivFailed: Result overflows uint256 after rounding up");
    // }
  }
  return z;
  // let z = fullMulDiv(x, y, d);
  // const remainder = (x & y) % d;
  // if (remainder > 0n) {
  //   z += 1n;
  // }
  // return z;
}

export function rpow(x: bigint, y: bigint, b: bigint): bigint {
  if (y === 0n) return b;
  if (x === 0n) return 0n;

  let z = (y & 1n) === 1n ? x : b;
  const half = b / 2n;

  for (y = y >> 1n; y > 0n; y = y >> 1n) {
    const xx = x * x;
    x = (xx + half) / b;

    if (y & 1n) {
      z = (z * x + half) / b;
    }
  }

  return z;
}

export function dist(x: bigint, y: bigint): bigint {
  return x > y ? x - y : y - x;
}

export function expWad(x: bigint): bigint {
  // When the result is less than 0.5 we return zero.
  // This happens when x <= (log(1e-18) * 1e18) ~ -4.15e19
  if (x <= -41446531673892822313n) {
    return 0n;
  }

  // Check for overflow
  // When the result is greater than (2**255 - 1) / 1e18 we cannot represent it
  if (x >= 135305999368893231589n) {
    throw new Error('ExpOverflow');
  }

  // Convert to (-42, 136) * 2**96 for more intermediate precision and a binary basis
  // This base conversion is a multiplication by 1e18 / 2**96 = 5**18 / 2**78
  x = (x << 78n) / 5n ** 18n;

  // Reduce range of x to (-½ ln 2, ½ ln 2) * 2**96 by factoring out powers of two
  // such that exp(x) = exp(x') * 2**k, where k is an integer
  const ln2Times2Pow96 = 54916777467707473351141471128n;

  // k = round(x / log(2))
  const k = ((x << 96n) / ln2Times2Pow96 + (1n << 95n)) >> 96n;

  // x' = x - k * log(2)
  x = x - k * ln2Times2Pow96;

  // Evaluate using a (6, 7)-term rational approximation
  // p is made monic, we'll multiply by a scale factor later
  let y = x + 1346386616545796478920950773328n;
  y = ((y * x) >> 96n) + 57155421227552351082224309758442n;

  let p = y + x - 94201549194550492254356042504812n;
  p = ((p * y) >> 96n) + 28719021644029726153956944680412240n;
  p = p * x + (4385272521454847904659076985693276n << 96n);

  // We leave p in 2**192 basis so we don't need to scale it back up for the division
  let q = x - 2855989394907223263936484059900n;
  q = ((q * x) >> 96n) + 50020603652535783019961831881945n;
  q = ((q * x) >> 96n) - 533845033583426703283633433725380n;
  q = ((q * x) >> 96n) + 3604857256930695427073651918091429n;
  q = ((q * x) >> 96n) - 14423608567350463180887372962807573n;
  q = ((q * x) >> 96n) + 26449188498355588339934803723976023n;

  // Div without additional checks as q won't have zeros in the domain
  let r = p / q;

  // r should be in the range (0.09, 0.25) * 2*96
  // We now need to multiply r by:
  // - The scale factor s ≈ 6.031367120
  // - The 2**k factor from the range reduction
  // - The 1e18 / 2**96 factor for base conversion

  const scaleFactor = 3822833074963236453042738258902158003155416615667n;
  const shiftAmount = 195n - k;

  // Handle both positive and negative shift amounts
  if (shiftAmount >= 0) {
    r = (r * scaleFactor) >> shiftAmount;
  } else {
    r = (r * scaleFactor) << -shiftAmount;
  }

  return r;
}

export function xWadToRoundedTick(
  xWad: bigint,
  mu: bigint,
  tickSpacing: bigint,
  roundUp: boolean,
): bigint {
  let x = xWad / WAD;
  const hasRemainder = xWad % WAD !== 0n;

  if (roundUp) {
    if (xWad > 0n && hasRemainder) x += 1n;
  } else {
    if (xWad < 0n && hasRemainder) x -= 1n;
  }

  return x * tickSpacing + mu;
}

export function weightedSum(
  value0: bigint,
  weight0: bigint,
  value1: bigint,
  weight1: bigint,
): bigint {
  return (value0 * weight0 + value1 * weight1) / (weight0 + weight1);
}
