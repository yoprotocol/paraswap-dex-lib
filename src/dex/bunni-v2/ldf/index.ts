import { PoolKey } from '../types';
import { CarpetedDoubleGeometricDistribution } from './CarpetedDoubleGeometricDistribution';
import { CarpetedGeometricDistribution } from './CarpetedGeometricDistribution';
import { DoubleGeometricDistribution } from './DoubleGeometricDistribution';
import { GeometricDistribution } from './GeometricDistribution';
import { UniformDistribution } from './UniformDistribution';

const LiquidityDensityFunctions: Record<string, any> = {
  // v0
  ['0x000000cbf474e46BcB1645269FB94F28D5335aa1'.toLowerCase()]:
    UniformDistribution,
  ['0x000000bd1923F78A0118625ed5205d737cf1c5b1'.toLowerCase()]:
    GeometricDistribution,
  ['0x0000003CE2EFF799B2624274f2535199Ca101E8D'.toLowerCase()]:
    DoubleGeometricDistribution,
  ['0x0000006Aa40D08Cca1257A5e565949755351642F'.toLowerCase()]:
    CarpetedGeometricDistribution,
  ['0x0000007014931f1ECD91Ed2D0f461Cc924Db21Ed'.toLowerCase()]:
    CarpetedDoubleGeometricDistribution,
  // ['0x0000000219D78901418Db393969C7F275E5880dB'.toLowerCase()]: BuyTheDipGeometricDistribution,

  // v1
  ['0x00000000e1a2E630CD50F94aEC05a2ce6CAf8b47'.toLowerCase()]:
    UniformDistribution,
  ['0x000000002A6e7022D123EAB81BA9fa19AA9D2069'.toLowerCase()]:
    GeometricDistribution,
  ['0x00000000C2786A29f2669faE8d0D4CaF7776AEa5'.toLowerCase()]:
    DoubleGeometricDistribution,
  ['0x00000000B66022c7e4Ff478EcB16600BA8a1E37A'.toLowerCase()]:
    CarpetedGeometricDistribution,
  ['0x00000000765f7E6236e75B9B9a5118557c18e0fE'.toLowerCase()]:
    CarpetedDoubleGeometricDistribution,
  // ['0x000000003691653855719A5722Eb10f6d9636936'.toLowerCase()]: BuyTheDipGeometricDistribution,
};

// TODO fix type?
export function _query(
  key: PoolKey,
  roundedTick: bigint,
  twapTick: bigint,
  spotPriceTick: bigint,
  ldfParams: string,
  ldfState: string,
  liquidityDensityFunction: string,
): any {
  const module =
    LiquidityDensityFunctions[liquidityDensityFunction.toLowerCase()];

  if (!module) {
    throw new Error(
      `LiquidityDensityFunction ${liquidityDensityFunction} not yet supported`,
    );
  }

  return module.query(
    key,
    roundedTick,
    twapTick,
    spotPriceTick,
    ldfParams,
    ldfState,
  );
}

// TODO fix type?
export function _computeSwap(
  key: PoolKey,
  inverseCumulativeAmountInput: bigint,
  totalLiquidity: bigint,
  zeroForOne: boolean,
  exactIn: boolean,
  twapTick: bigint,
  spotPriceTick: bigint,
  ldfParams: string,
  ldfState: string,
  liquidityDensityFunction: string,
): any {
  const module =
    LiquidityDensityFunctions[liquidityDensityFunction.toLowerCase()];

  if (!module) {
    throw new Error(
      `LiquidityDensityFunction ${liquidityDensityFunction} not yet supported`,
    );
  }

  return module.computeSwap(
    key,
    inverseCumulativeAmountInput,
    totalLiquidity,
    zeroForOne,
    exactIn,
    twapTick,
    spotPriceTick,
    ldfParams,
    ldfState,
  );
}
