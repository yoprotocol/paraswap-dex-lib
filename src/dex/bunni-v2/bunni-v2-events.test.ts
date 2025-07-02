/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import { BunniV2EventPool } from './bunni-v2-pool';
import { Network } from '../../constants';
import { Address } from '../../types';
import { DummyDexHelper } from '../../dex-helper/index';
import { testEventSubscriber } from '../../../tests/utils-events';
import { PoolState, PoolStateMap } from './types';

/*
  README
  ======

  This test script adds unit tests for BunniV2 event based
  system. This is done by fetching the state on-chain before the
  event block, manually pushing the block logs to the event-subscriber,
  comparing the local state with on-chain state.

  Most of the logic for testing is abstracted by `testEventSubscriber`.
  You need to do two things to make the tests work:

  1. Fetch the block numbers where certain events were released. You
  can modify the `./scripts/fetch-event-blocknumber.ts` to get the
  block numbers for different events. Make sure to get sufficient
  number of blockNumbers to cover all possible cases for the event
  mutations.

  2. Complete the implementation for fetchPoolState function. The
  function should fetch the on-chain state of the event subscriber
  using just the blocknumber.

  The template tests only include the test for a single event
  subscriber. There can be cases where multiple event subscribers
  exist for a single DEX. In such cases additional tests should be
  added.

  You can run this individual test script by running:
  `npx jest src/dex/<dex-name>/<dex-name>-events.test.ts`

  (This comment should be removed from the final implementation)
*/

jest.setTimeout(50 * 1000);

async function fetchPoolState(
  bunniV2EventPool: BunniV2EventPool,
  blockNumber: number,
): Promise<PoolStateMap> {
  return (await bunniV2EventPool.generateState(blockNumber)) as PoolStateMap;
}

function compareState(poolState: PoolState, expectedPoolState: PoolState) {
  expect(poolState.id).toEqual(expectedPoolState.id);
  expect(poolState.key.currency0).toEqual(expectedPoolState.key.currency0);
  expect(poolState.key.currency1).toEqual(expectedPoolState.key.currency1);
  expect(poolState.key.fee).toEqual(expectedPoolState.key.fee);
  expect(poolState.key.tickSpacing).toEqual(expectedPoolState.key.tickSpacing);
  expect(poolState.key.hooks).toEqual(expectedPoolState.key.hooks);

  // expect(poolState.liquidityDensityFunction).toEqual(expectedPoolState.liquidityDensityFunction);
  // expect(poolState.bunniHub).toEqual(expectedPoolState.bunniHub);
  // expect(poolState.bunniToken).toEqual(expectedPoolState.bunniToken);
  // expect(poolState.hooklet).toEqual(expectedPoolState.hooklet);
  // expect(poolState.twapSecondsAgo).toEqual(expectedPoolState.twapSecondsAgo);
  // expect(poolState.ldfParams).toEqual(expectedPoolState.ldfParams);
  // expect(poolState.hookParams).toEqual(expectedPoolState.hookParams);
  // expect(poolState.vault0).toEqual(expectedPoolState.vault0);
  // expect(poolState.vault1).toEqual(expectedPoolState.vault1);
  // expect(poolState.ldfType).toEqual(expectedPoolState.ldfType);
  // expect(poolState.minRawTokenRatio0).toEqual(expectedPoolState.minRawTokenRatio0);
  // expect(poolState.targetRawTokenRatio0).toEqual(expectedPoolState.targetRawTokenRatio0);
  // expect(poolState.maxRawTokenRatio0).toEqual(expectedPoolState.maxRawTokenRatio0);
  // expect(poolState.minRawTokenRatio1).toEqual(expectedPoolState.minRawTokenRatio1);
  // expect(poolState.targetRawTokenRatio1).toEqual(expectedPoolState.targetRawTokenRatio1);
  // expect(poolState.maxRawTokenRatio1).toEqual(expectedPoolState.maxRawTokenRatio1);

  // expect(poolState.rawBalance0).toEqual(expectedPoolState.rawBalance0);
  // expect(poolState.rawBalance1).toEqual(expectedPoolState.rawBalance1);
  // expect(poolState.reserve0).toEqual(expectedPoolState.reserve0);
  // expect(poolState.reserve1).toEqual(expectedPoolState.reserve1);
  // expect(poolState.idleBalance).toEqual(expectedPoolState.idleBalance);
  // expect(poolState.totalSupply).toEqual(expectedPoolState.totalSupply);
  // expect(poolState.ldfState).toEqual(expectedPoolState.ldfState);

  // expect(poolState.sqrtPriceX96).toEqual(expectedPoolState.sqrtPriceX96);
  // expect(poolState.tick).toEqual(expectedPoolState.tick);
  // expect(poolState.lastSwapTimestamp).toEqual(expectedPoolState.lastSwapTimestamp);
  // expect(poolState.lastSurgeTimestamp).toEqual(expectedPoolState.lastSurgeTimestamp);

  // expect(poolState.index).toEqual(expectedPoolState.index);
  // expect(poolState.cardinality).toEqual(expectedPoolState.cardinality);
  // expect(poolState.cardinalityNext).toEqual(expectedPoolState.cardinalityNext);
  // expect(poolState.intermediateObservation.blockTimestamp).toEqual(expectedPoolState.intermediateObservation.blockTimestamp);
  // expect(poolState.intermediateObservation.prevTick).toEqual(expectedPoolState.intermediateObservation.prevTick);
  // expect(poolState.intermediateObservation.tickCumulative).toEqual(expectedPoolState.intermediateObservation.tickCumulative);
  // expect(poolState.intermediateObservation.initialized).toEqual(expectedPoolState.intermediateObservation.initialized);

  // expect(poolState.observations.length).toEqual(expectedPoolState.observations.length);

  // poolState.observations.forEach((observation, i) => {
  //   expect(observation.blockTimestamp).toEqual(expectedPoolState.observations[i].blockTimestamp);
  //   expect(observation.prevTick).toEqual(expectedPoolState.observations[i].prevTick);
  //   expect(observation.tickCumulative).toEqual(expectedPoolState.observations[i].tickCumulative);
  //   expect(observation.initialized).toEqual(expectedPoolState.observations[i].initialized);
  // });

  // expect(poolState.initialized).toEqual(expectedPoolState.initialized);
  // expect(poolState.sharePrice0).toEqual(expectedPoolState.sharePrice0);
  // expect(poolState.sharePrice1).toEqual(expectedPoolState.sharePrice1);

  // expect(poolState.topBid.manager).toEqual(expectedPoolState.topBid.manager);
  // expect(poolState.topBid.blockIdx).toEqual(expectedPoolState.topBid.blockIdx);
  // expect(poolState.topBid.payload).toEqual(expectedPoolState.topBid.payload);
  // expect(poolState.topBid.rent).toEqual(expectedPoolState.topBid.rent);
  // expect(poolState.topBid.deposit).toEqual(expectedPoolState.topBid.deposit);

  // expect(poolState.nextBid.manager).toEqual(expectedPoolState.nextBid.manager);
  // expect(poolState.nextBid.blockIdx).toEqual(expectedPoolState.nextBid.blockIdx);
  // expect(poolState.nextBid.payload).toEqual(expectedPoolState.nextBid.payload);
  // expect(poolState.nextBid.rent).toEqual(expectedPoolState.nextBid.rent);
  // expect(poolState.nextBid.deposit).toEqual(expectedPoolState.nextBid.deposit);

  // @dev there is no way to fetch the rebalanceOrderHash via RPC
  // expect(poolState.rebalanceOrderHash).toEqual(expectedPoolState.rebalanceOrderHash);
}

describe('BunniV2 EventPool', function () {
  const dexKey = 'BunniV2';

  describe('MAINNET', function () {
    const network = Network.MAINNET;
    const dexHelper = new DummyDexHelper(network);
    const logger = dexHelper.getLogger(dexKey);
    let bunniV2Pool: BunniV2EventPool;

    beforeEach(async () => {
      bunniV2Pool = new BunniV2EventPool(dexKey, network, dexHelper, logger);
    });

    describe('Test Pool 1', function () {
      // UNIFORM LDF (NO REHYPOTHECATION)
      const poolId =
        '0x9148f00424c4b40a9ec4b03912f091138e9e91a60980550ed97ed7f9dc998cb5';

      const eventsToTest: { [eventName: string]: number[] } = {
        ['Initialize']: [21747679],
        // ['Deposit']: [
        //   21747693, 21747872, 21775921, 21775993, 21776260, 21776294, 21776319,
        //   21776350, 21776376, 21776399, 21776754, 21778402, 21780934, 21781343,
        //   21782648, 21783597, 21795629, 21796696, 21797642, 21799255, 21800801,
        //   21824932, 21829291, 21835097, 21843942, 21869191, 21877918, 21886472,
        //   21902084, 21906958, 21923343, 22035024
        // ],
        // ['Withdraw']: [
        //   21777142, 21786928, 21807217, 21830341, 21865129, 21877299, 21880088,
        //   21911898, 21938790, 21962081, 22008368, 22031914, 22110795
        // ],
        // ['Swap']: [
        //   21748493, 21749611, 21750961, 21751093, 21751512, 21751550, 21752670,
        //   21753746, 21753747, 21753802, 21754328, 21756079, 21756454, 21760509,
        //   21760717, 21762744, 21762782, 21763493, 21766103, 21766888, 21767069,
        //   21769111, 21769266, 21769434, 21769438, 21769842, 21769845, 21769846,
        //   21771570, 21773983, 21774231, 21774235, 21774235, 21774235, 21774915,
        //   21774993, 21775988, 21776189, 21776191, 21776193, 21776249, 21776249,
        //   21776284, 21776311, 21776396, 21776793, 21776793, 21776793, 21777038,
        //   21777151, 21777209, 21777303, 21777303, 21777303, 21777872, 21777880,
        //   21777880, 21777886, 21777887, 21778334, 21778355, 21780673, 21782197,
        //   21782431, 21783593, 21783706, 21783863, 21783878, 21784640, 21785598,
        //   21785812, 21786996, 21788646, 21789307, 21789387, 21790292, 21790298,
        //   21791032, 21791347, 21791835, 21791883, 21794385, 21794493, 21794493,
        //   21794493, 21794509, 21794984, 21795712, 21799243, 21799733, 21800795,
        //   21805472, 21807244, 21808037, 21809403, 21810253, 21810275, 21811821,
        //   21811994, 21813109
        // ]
      };

      const stateCompare = (
        state: PoolStateMap,
        expectedState: PoolStateMap,
      ) => {
        const poolState = state[poolId];
        const expectedPoolState = expectedState[poolId];
        poolState
          ? compareState(poolState, expectedPoolState)
          : expect(poolState).toEqual(expectedPoolState);
      };

      Object.keys(eventsToTest).forEach((event: string) => {
        eventsToTest[event].forEach(blockNumber => {
          it(`${event}:${blockNumber} - should return correct state`, async function () {
            await testEventSubscriber(
              bunniV2Pool,
              bunniV2Pool.addressesSubscribed,
              (_blockNumber: number) =>
                fetchPoolState(bunniV2Pool, _blockNumber),
              blockNumber,
              `${dexKey}_${poolId}`,
              dexHelper.provider,
              stateCompare,
            );
          });
        });
      });
    });

    describe('Test Pool 2', function () {
      // CARPETED DOUBLE GEOMETRIC LDF (NO REHYPOTHECATION)
      const poolId =
        '0x3c320987c8d01209c70485bbfabb81bab60fb01bf1407952a4e4791ebf7a9da4';

      const eventsToTest: { [eventName: string]: number[] } = {
        ['Initialize']: [22409866],
        // ['Deposit']: [
        //   22409916, 22409930, 22410294
        // ],
        // ['Withdraw']: [],
        // ['Swap']: [
        //   22512893, 22512879, 22511108, 22490720, 22484389, 22482828, 22477306,
        //   22470885, 22470842, 22469779, 22468911, 22463675, 22462742, 22460228,
        //   22457176, 22446050, 22437540, 22437530, 22437524, 22437500, 22437489,
        //   22437456, 22427293, 22419556, 22419080, 22409961, 22409955
        // ]
      };

      const stateCompare = (
        state: PoolStateMap,
        expectedState: PoolStateMap,
      ) => {
        const poolState = state[poolId];
        const expectedPoolState = expectedState[poolId];
        poolState
          ? compareState(poolState, expectedPoolState)
          : expect(poolState).toEqual(expectedPoolState);
      };

      Object.keys(eventsToTest).forEach((event: string) => {
        eventsToTest[event].forEach(blockNumber => {
          it(`${event}:${blockNumber} - should return correct state`, async function () {
            await testEventSubscriber(
              bunniV2Pool,
              bunniV2Pool.addressesSubscribed,
              (_blockNumber: number) =>
                fetchPoolState(bunniV2Pool, _blockNumber),
              blockNumber,
              `${dexKey}_${poolId}`,
              dexHelper.provider,
              stateCompare,
            );
          });
        });
      });
    });

    // describe('Test Pool 3', function () {
    //   const poolId = '0x413535983fcfe0f1a036d497cd402bfdbc24661bf46d048e7df24e97c3e99008';

    //   const eventsToTest: { [eventName: string]: number[] } = {
    //     ['Initialize']: [
    //       // 22182083,
    //     ],
    //     ['Deposit']: [
    //       // 22182093, 22190112, 22219353, 22219359, 22219364, 22219390, 22221233,
    //       // 22222441, 22222456, 22222466, 22222470, 22231585, 22234304, 22252864,
    //       // 22305515, 22311034
    //     ],
    //     ['Withdraw']: [
    //       // 22230816, 22243912, 22287917, 22288303, 22323649, 22323741, 22323921,
    //       // 22347145
    //     ],
    //     ['Swap']: [
    //       // 22221255, 22224480, 22225117, 22225159, 22225342, 22225404, 22225709,
    //       // 22227166, 22227699, 22230616, 22230689, 22230705, 22230743, 22231167,
    //       // 22234302, 22238088, 22239300, 22240273, 22241824, 22242260, 22243857,
    //       // 22244160, 22244433, 22244454, 22244555, 22244620, 22245856, 22245981,
    //       // 22247402, 22248726, 22249250, 22249647, 22251647, 22252672, 22252716,
    //       // 22253885, 22253932, 22255577, 22257611, 22259960, 22260031, 22264736,
    //       // 22265146, 22265169, 22269108, 22269471, 22269559, 22271752, 22272980,
    //       // 22275220, 22275724, 22276748, 22276790, 22280971, 22280972, 22281202,
    //       // 22281223, 22281886, 22281894, 22282178, 22282291, 22282854, 22282873,
    //       // 22283264, 22287403, 22292460, 22294471, 22297741, 22298354, 22299831,
    //       // 22301879, 22310175, 22314730, 22316685, 22318245, 22318542, 22320776,
    //       // 22321463, 22323248, 22323821, 22323844, 22324388, 22331052, 22332116,
    //       // 22332821, 22335228, 22335234, 22335277, 22335292, 22335324, 22335327,
    //       // 22335446, 22335499, 22335754, 22335776, 22336084, 22336356, 22337854,
    //       // 22338375, 22338407, 22338506, 22339711, 22339933, 22340075, 22340138,
    //       // 22341903, 22342020, 22343784, 22344658, 22345049, 22345096, 22345124,
    //       // 22345128, 22345198, 22345397, 22345588, 22345627, 22345692, 22345722,
    //       // 22346160, 22346246, 22346850, 22347064, 22347583
    //     ]
    //   };

    //   const stateCompare = (state: PoolStateMap, expectedState: PoolStateMap) => {
    //     const poolState = state[poolId];
    //     const expectedPoolState = expectedState[poolId];
    //     poolState
    //       ? compareState(poolState, expectedPoolState)
    //       : expect(poolState).toEqual(expectedPoolState);
    //   }

    //   Object.keys(eventsToTest).forEach((event: string) => {
    //     eventsToTest[event].forEach((blockNumber) => {
    //       it(`${event}:${blockNumber} - should return correct state`, async function () {
    //         await testEventSubscriber(
    //           bunniV2Pool,
    //           bunniV2Pool.addressesSubscribed,
    //           (_blockNumber: number) => fetchPoolState(bunniV2Pool, _blockNumber),
    //           blockNumber,
    //           `${dexKey}_${poolId}`,
    //           dexHelper.provider,
    //           stateCompare
    //         )
    //       });
    //     });
    //   });

    // });
  });

  // describe('BASE', function () {
  //   const network = Network.BASE;
  //   const dexHelper = new DummyDexHelper(network);
  //   const logger = dexHelper.getLogger(dexKey);
  //   let bunniV2Pool: BunniV2EventPool;

  //   beforeEach(async () => {
  //     bunniV2Pool = new BunniV2EventPool(
  //       dexKey,
  //       network,
  //       dexHelper,
  //       logger,
  //     );
  //   });

  //   describe('Test Pool 1', function () {
  //     // DOUBLE GEOMETRIC LDF (NO REHYPOTHECATION)
  //     const poolId = '0x3af40ff5c4c5507ca8a4fa6f5b7b662202dafa590612960c3eb382ab2bb6ee01';

  //     const eventsToTest: { [eventName: string]: number[] } = {
  //       ['Initialize']: [
  //         27536768
  //       ],
  //       ['Deposit']: [
  //         27536988
  //       ],
  //       ['Withdraw']: [],
  //       ['Swap']: [
  //         27537150, 27537151, 28800617, 28808272, 28808275, 30429432
  //       ]
  //     };

  //     const stateCompare = (state: PoolStateMap, expectedState: PoolStateMap) => {
  //       const poolState = state[poolId];
  //       const expectedPoolState = expectedState[poolId];
  //       poolState
  //         ? compareState(poolState, expectedPoolState)
  //         : expect(poolState).toEqual(expectedPoolState);
  //     }

  //     Object.keys(eventsToTest).forEach((event: string) => {
  //       eventsToTest[event].forEach((blockNumber) => {
  //         it(`${event}:${blockNumber} - should return correct state`, async function () {
  //           await testEventSubscriber(
  //             bunniV2Pool,
  //             bunniV2Pool.addressesSubscribed,
  //             (_blockNumber: number) => fetchPoolState(bunniV2Pool, _blockNumber),
  //             blockNumber,
  //             `${dexKey}_${poolId}`,
  //             dexHelper.provider,
  //             stateCompare
  //           )
  //         });
  //       });
  //     });

  //   });

  //   describe('Test Pool 2', function () {
  //     // CARPETED GEOMETRIC LDF (NO REHYPOTHECATION)
  //     const poolId = '0xc7c1bf4fe8914d424e98065a1b8a580fd409b3b92a2752b49cb4824680dd78b7';

  //     const eventsToTest: { [eventName: string]: number[] } = {
  //       ['Initialize']: [
  //         26633622
  //       ],
  //       ['Deposit']: [
  //         26633686, 26633746
  //       ],
  //       ['Withdraw']: [
  //         26664125
  //       ],
  //       ['Swap']: [
  //         26633725, 26633732, 26662498, 26662887
  //       ],
  //       ['Rebalanced']: [
  //         26662503
  //       ]
  //     };

  //     const stateCompare = (state: PoolStateMap, expectedState: PoolStateMap) => {
  //       const poolState = state[poolId];
  //       const expectedPoolState = expectedState[poolId];
  //       poolState
  //         ? compareState(poolState, expectedPoolState)
  //         : expect(poolState).toEqual(expectedPoolState);
  //     }

  //     Object.keys(eventsToTest).forEach((event: string) => {
  //       eventsToTest[event].forEach((blockNumber) => {
  //         it(`${event}:${blockNumber} - should return correct state`, async function () {
  //           await testEventSubscriber(
  //             bunniV2Pool,
  //             bunniV2Pool.addressesSubscribed,
  //             (_blockNumber: number) => fetchPoolState(bunniV2Pool, _blockNumber),
  //             blockNumber,
  //             `${dexKey}_${poolId}`,
  //             dexHelper.provider,
  //             stateCompare
  //           )
  //         });
  //       });
  //     });
  //   });

  // });
});
