/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { testEventSubscriber } from '../../../tests/utils-events';
import { Network } from '../../constants';
import { DummyDexHelper } from '../../dex-helper/index';
import { DEX_KEY, EKUBO_CONFIG } from './config';
import {
  BasePool,
  BasePoolState,
  findNearestInitializedTickIndex,
} from './pools/base';
import { EkuboPool } from './pools/iface';
import { OraclePool } from './pools/oracle';
import { TwammPool } from './pools/twamm';
import { PoolConfig, PoolKey } from './pools/utils';
import { contractsFromDexParams } from './utils';
import { MevResistPool } from './pools/mev-resist';

jest.setTimeout(50 * 1000);

type EventMappings = Record<string, [EkuboPool<unknown>[], number][]>;

// Rather incomplete but only used for tests
function isBasePoolState(value: unknown): value is BasePoolState.Object {
  return typeof value === 'object' && value !== null && 'sortedTicks' in value;
}

function stateCompare(actual: unknown, expected: unknown) {
  if (!isBasePoolState(actual) || !isBasePoolState(expected)) {
    expect(actual).toStrictEqual(expected);
    return;
  }

  const [lowCheckedTickActual, highCheckedTickActual] =
    actual.checkedTicksBounds;
  const [lowCheckedTickExpected, highCheckedTickExpected] =
    expected.checkedTicksBounds;

  const [sameLowCheckedTicks, sameHighCheckedTicks] = [
    lowCheckedTickActual === lowCheckedTickExpected,
    highCheckedTickActual === highCheckedTickExpected,
  ];

  if (sameLowCheckedTicks && sameHighCheckedTicks) {
    expect(actual).toStrictEqual(expected);
    return;
  }

  expect(actual.sqrtRatio).toStrictEqual(expected.sqrtRatio);
  expect(actual.activeTick).toStrictEqual(expected.activeTick);
  expect(actual.liquidity).toStrictEqual(expected.liquidity);

  /**
   * The checked tick ranges differ between the two states at this point.
   * In order to still compare the tick arrays, we thus have to exclude the liquidity cutoff ticks
   * from the comparison (if they differ), as well as any other ticks that could've only
   * been discovered in one of the two checked tick ranges.
   */

  let lowTickIndexActual: number, lowTickIndexExpected: number;

  if (sameLowCheckedTicks) {
    [lowTickIndexActual, lowTickIndexExpected] = [0, 0];
  } else if (lowCheckedTickActual > lowCheckedTickExpected) {
    lowTickIndexActual = 1;
    lowTickIndexExpected =
      findNearestInitializedTickIndex(
        expected.sortedTicks,
        lowCheckedTickActual,
      )! + 1;
  } else {
    lowTickIndexExpected = 1;
    lowTickIndexActual =
      findNearestInitializedTickIndex(
        actual.sortedTicks,
        lowCheckedTickExpected,
      )! + 1;
  }

  let highTickIndexActual: number, highTickIndexExpected: number;

  if (sameHighCheckedTicks) {
    [highTickIndexActual, highTickIndexExpected] = [
      actual.sortedTicks.length,
      expected.sortedTicks.length,
    ];
  } else if (highCheckedTickActual > highCheckedTickExpected) {
    highTickIndexExpected = expected.sortedTicks.length - 1;

    let tickIndex = findNearestInitializedTickIndex(
      actual.sortedTicks,
      highCheckedTickExpected,
    )!;
    highTickIndexActual =
      actual.sortedTicks[tickIndex].number === highCheckedTickExpected
        ? tickIndex
        : tickIndex + 1;
  } else {
    highTickIndexActual = actual.sortedTicks.length - 1;

    let tickIndex = findNearestInitializedTickIndex(
      expected.sortedTicks,
      highCheckedTickActual,
    )!;
    highTickIndexExpected =
      expected.sortedTicks[tickIndex].number === highCheckedTickActual
        ? tickIndex
        : tickIndex + 1;
  }

  expect(
    actual.sortedTicks.slice(lowTickIndexActual, highTickIndexActual),
  ).toStrictEqual(
    expected.sortedTicks.slice(lowTickIndexExpected, highTickIndexExpected),
  );
}

describe('Ekubo Mainnet', function () {
  const network = Network.MAINNET;
  const dexHelper = new DummyDexHelper(network);
  const config = EKUBO_CONFIG[DEX_KEY][network];
  const contracts = contractsFromDexParams(config, dexHelper.provider);
  const logger = dexHelper.getLogger(DEX_KEY);

  const baseEthUsdcPoolKey = new PoolKey(
    0n,
    0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48n,
    new PoolConfig(5982, 55340232221128654n, 0n),
  );

  const oracleUsdcPoolKey = new PoolKey(
    0n,
    0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48n,
    new PoolConfig(0, 0n, BigInt(config.oracle)),
  );

  const twammEthUsdcPoolKey = new PoolKey(
    0n,
    0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48n,
    new PoolConfig(0, 9223372036854775n, BigInt(config.twamm)),
  );

  const mevResistEkuboEbUsdPoolKey = new PoolKey(
    0x04c46e830bb56ce22735d5d8fc9cb90309317d0fn,
    0x09fd37d9aa613789c517e76df1c53aece2b60df4n,
    new PoolConfig(500, 1844674407370955n, BigInt(config.mevResist)),
  );

  const mevResistEkuboBoldPoolKey = new PoolKey(
    0x04c46e830bb56ce22735d5d8fc9cb90309317d0fn,
    0x6440f144b7e50d6a8439336510312d2f54beb01dn,
    new PoolConfig(1998, 18446744073709552n, BigInt(config.mevResist)),
  );

  const commonArgs = [DEX_KEY, dexHelper, logger, contracts] as const;

  function newPool<S>(
    constructor: {
      new (...args: [...typeof commonArgs, PoolKey]): EkuboPool<S>;
    },
    poolKey: PoolKey,
  ): EkuboPool<unknown> {
    return new constructor(...commonArgs, poolKey) as EkuboPool<unknown>;
  }

  const eventsToTest: EventMappings = {
    Swapped: [
      [
        [newPool(BasePool, baseEthUsdcPoolKey)],
        22048500, // https://etherscan.io/tx/0xc401cc3007a2c0efd705c4c0dee5690ce8592858476b32cda8a4b000ceda0f24
      ],
      [
        [newPool(OraclePool, oracleUsdcPoolKey)],
        22063200, // https://etherscan.io/tx/0xe689fb49b9627504d014a9b4663a6f0ec38ebfdc5642e261bb4bcd229d58206d
      ],
      [
        [newPool(TwammPool, twammEthUsdcPoolKey)],
        22281995, // https://etherscan.io/tx/0xc3ad7616eb5c9aeef51a49e2ce9c945778387f3110f9f66916f38db4d551ac05
      ],
      [
        [newPool(MevResistPool, mevResistEkuboEbUsdPoolKey)],
        23121533, // https://etherscan.io/tx/0xeab6fdc4a5ced72796e515f340fa0399746f882dffdfac8c3c8a8a12f1292e76
      ],
    ],
    PositionUpdated: [
      [
        [newPool(MevResistPool, mevResistEkuboBoldPoolKey)],
        23120060, // https://etherscan.io/tx/0x9d40d6bea754800683783caf42dca60acfcc8e0e5abecd9f3658ba71f7e08935
      ],
    ],
    OrderUpdated: [
      [
        [newPool(TwammPool, twammEthUsdcPoolKey)],
        22232621, // https://etherscan.io/tx/0x99479c8426fb328ec3245c625fb7edfbb4bb4dd2a2fbfcd027fc513962cca193
      ],
    ],
    VirtualOrdersExecuted: [
      [
        [newPool(TwammPool, twammEthUsdcPoolKey)],
        22995949, // https://etherscan.io/tx/0xbc9390f6712296bceed6efa909e61f943fbf897412d3cd8d491120706fadcde1
      ],
    ],
  };

  Object.entries(eventsToTest).forEach(([eventName, eventDetails]) => {
    describe(eventName, () => {
      for (const [pools, blockNumber] of eventDetails) {
        describe(blockNumber, () => {
          for (const pool of pools) {
            it(`State of ${pool.key.string_id}`, async function () {
              await testEventSubscriber(
                pool,
                pool.addressesSubscribed,
                async (blockNumber: number) => pool.generateState(blockNumber),
                blockNumber,
                `${DEX_KEY}_${pool.key.string_id}`,
                dexHelper.provider,
                stateCompare,
              );
            });
          }
        });
      }
    });
  });
});
