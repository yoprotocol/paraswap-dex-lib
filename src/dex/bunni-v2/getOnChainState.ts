import { Interface } from '@ethersproject/abi';
import { PoolState } from './types';
import { IDexHelper } from '../../dex-helper';
import { bigIntify } from '../../utils';
import { multicall } from './utils';
import { DexParams } from './types';
import { BigNumber, BytesLike, ethers } from 'ethers';
import { BunniHookVersions } from './config';

export async function updateHubState(
  poolStates: PoolState[],
  blockNumber: number,
  bunniHubInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  const multiCallData = poolStates.map(poolState => {
    return {
      target: poolState.bunniHub,
      callData: bunniHubInterface.encodeFunctionData('poolState', [
        poolState.id,
      ]),
    };
  });

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const data = bunniHubInterface.decodeFunctionResult(
      'poolState',
      result[i].returnData,
    )[0];
    poolState.liquidityDensityFunction =
      data.liquidityDensityFunction.toLowerCase();
    poolState.bunniToken = data.bunniToken.toLowerCase();
    poolState.hooklet = data.hooklet.toLowerCase();
    poolState.twapSecondsAgo = bigIntify(data.twapSecondsAgo);
    poolState.ldfParams = data.ldfParams;
    poolState.hookParams = data.hookParams;
    poolState.vault0 = data.vault0.toLowerCase();
    poolState.vault1 = data.vault1.toLowerCase();
    poolState.ldfType = parseInt(data.ldfType);
    poolState.minRawTokenRatio0 = bigIntify(data.minRawTokenRatio0);
    poolState.targetRawTokenRatio0 = bigIntify(data.targetRawTokenRatio0);
    poolState.maxRawTokenRatio0 = bigIntify(data.maxRawTokenRatio0);
    poolState.minRawTokenRatio1 = bigIntify(data.minRawTokenRatio1);
    poolState.targetRawTokenRatio1 = bigIntify(data.targetRawTokenRatio1);
    poolState.maxRawTokenRatio1 = bigIntify(data.maxRawTokenRatio1);
    poolState.rawBalance0 = bigIntify(data.rawBalance0);
    poolState.rawBalance1 = bigIntify(data.rawBalance1);
    poolState.reserve0 = bigIntify(data.reserve0);
    poolState.reserve1 = bigIntify(data.reserve1);
    poolState.idleBalance = data.idleBalance;
  });
}

export async function updateHookState(
  poolStates: PoolState[],
  blockNumber: number,
  dexHelper: IDexHelper,
  config: DexParams,
): Promise<void> {
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], ["0xec8d8d7c033f92492ab5c18272bae93324d12a5c452db1e2da0c63deb9e24dcd", 6n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], ["0xec8d8d7c033f92492ab5c18272bae93324d12a5c452db1e2da0c63deb9e24dcd", 7n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 6n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 6n, 0n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 6n, 1n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 6n, 2n])))
  // console.log(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 7n])))
  // const x = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "uint256"], ["0x54ff1fd1d62f3bc6224082ecfdb3190a34e8428611b058ade19ce6c083cb608b", 7n]));
  // const y = BigNumber.from(x).add(1).toHexString();
  // console.log(y)

  const encodeGetState = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('getState', [s.key]);
  };
  const decodeGetState = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('getState', d);
  };

  const encodeExtsLoad = (i: Interface, s: PoolState) => {
    const observationsSlot = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [s.id, 6n]),
    );
    const statesSlot = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [s.id, 7n]),
    );
    const intermediateObservationSlot = BigNumber.from(statesSlot)
      .add(1)
      .toHexString();
    return i.encodeFunctionData('0xdbd035ff', [
      [observationsSlot, statesSlot, intermediateObservationSlot],
    ]); // TODO more slots?
  };
  const decodeExtsLoad = (i: Interface, d: BytesLike) => {
    console.log(d);
    const decoded = ethers.utils.defaultAbiCoder.decode(['bytes32[]'], d);
    console.log(decoded);

    const mask8 = BigNumber.from('0xff');
    const mask32 = BigNumber.from('0xffffffff');
    const mask56 = BigNumber.from('0x00ffffffffffffff');
    const mask160 = BigNumber.from(
      '0x00ffffffffffffffffffffffffffffffffffffffff',
    );

    // decode the ...
    // TODO not sure this is correct...
    const rawX = BigNumber.from(decoded[0][1]);
    const index = rawX.and(mask32);
    const cardinality = rawX.shr(32).and(mask32);
    const cardinalityNext = rawX.shr(64).and(mask32);
    console.log(index);
    console.log(cardinality);
    console.log(cardinalityNext);

    // const rawY = BigNumber.from(decoded[0][2]);
    // const blockTimestamp = obs.and(mask32);

    // const raw = BigNumber.from(d);
    // const UINT120_MASK = BigNumber.from("0xffffffffffffffffffffffffffffffff");
    // const initialized = raw.and(0xff).eq(1);
    // const sharePrice0 = raw.shr(8).and(UINT120_MASK);
    // const sharePrice1 = raw.shr(128).and(UINT120_MASK);
    // return {initialized, sharePrice0, sharePrice1 };
  };

  // const multiCallData = poolStates.map((poolState) => {
  //   return {
  //     target: poolState.key.hooks,
  //     callData: bunniHookInterface.encodeFunctionData('getState', [poolState.key])
  //   }
  // });

  const multiCallData = poolStates.reduce((callData, poolState) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      callData.push({
        target: poolState.key.hooks,
        callData:
          bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
            ? encodeGetState(bunniHookInterface, poolState)
            : encodeExtsLoad(bunniHookInterface, poolState),
      });
    }

    return callData;
  }, [] as { target: string; callData: string }[]);

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      const data =
        bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
          ? decodeGetState(bunniHookInterface, result[i].returnData)
          : decodeExtsLoad(bunniHookInterface, result[i].returnData);

      // poolState.initialized = data.initialized;
      // poolState.sharePrice0 = bigIntify(data.sharePrice0);
      // poolState.sharePrice1 = bigIntify(data.sharePrice1);
    }
  });

  // poolStates.forEach((poolState, i) => {
  //   const data = bunniHookInterface.decodeFunctionResult('getState', result[i].returnData)[0];
  //   poolState.index = bigIntify(data.index);
  //   poolState.cardinality = bigIntify(data.cardinality);
  //   poolState.cardinalityNext = bigIntify(data.cardinalityNext);
  //   poolState.intermediateObservation = {
  //     blockTimestamp: bigIntify(data.intermediateObservation.blockTimestamp),
  //     prevTick: bigIntify(data.intermediateObservation.prevTick),
  //     tickCumulative: bigIntify(data.intermediateObservation.tickCumulative),
  //     initialized: data.intermediateObservation.initialized,
  //   };
  //   poolState.observations = Array.from({ length: Number(data.cardinalityNext) }, () => ({
  //     blockTimestamp: 0n,
  //     prevTick: 0n,
  //     tickCumulative: 0n,
  //     initialized: false,
  //   }));
  // });
}

export async function updateSlot0(
  poolStates: PoolState[],
  blockNumber: number,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  const multiCallData = poolStates.map(poolState => {
    return {
      target: poolState.key.hooks,
      callData: bunniHookInterface.encodeFunctionData('slot0s', [poolState.id]),
    };
  });

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const data = bunniHookInterface.decodeFunctionResult(
      'slot0s',
      result[i].returnData,
    );
    poolState.sqrtPriceX96 = bigIntify(data.sqrtPriceX96);
    poolState.tick = bigIntify(data.tick);
    poolState.lastSwapTimestamp = bigIntify(data.lastSwapTimestamp);
    poolState.lastSurgeTimestamp = bigIntify(data.lastSurgeTimestamp);
  });
}

export async function updateLdfState(
  poolStates: PoolState[],
  blockNumber: number,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  const multiCallData = poolStates.map(poolState => {
    return {
      target: poolState.key.hooks,
      callData: bunniHookInterface.encodeFunctionData('ldfStates', [
        poolState.id,
      ]),
    };
  });

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const data = bunniHookInterface.decodeFunctionResult(
      'ldfStates',
      result[i].returnData,
    )[0];
    poolState.ldfState = data;
  });
}

export async function updateVaultSharePricesAtLastSwap(
  poolStates: PoolState[],
  blockNumber: number,
  dexHelper: IDexHelper,
  config: DexParams,
): Promise<void> {
  const encodeVaultSharePricesAtLastSwap = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('vaultSharePricesAtLastSwap', [s.id]);
  };
  const decodeVaultSharePricesAtLastSwap = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('vaultSharePricesAtLastSwap', d);
  };

  const encodeExtsLoad = (i: Interface, s: PoolState) => {
    const slot = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['bytes32', 'uint256'], [s.id, 11n]),
    );
    return i.encodeFunctionData('0x1e2eaeaf', [slot]);
  };
  const decodeExtsLoad = (i: Interface, d: BytesLike) => {
    const raw = BigNumber.from(d);
    const UINT120_MASK = BigNumber.from('0xffffffffffffffffffffffffffffffff');
    const initialized = raw.and(0xff).eq(1);
    const sharePrice0 = raw.shr(8).and(UINT120_MASK);
    const sharePrice1 = raw.shr(128).and(UINT120_MASK);
    return { initialized, sharePrice0, sharePrice1 };
  };

  const multiCallData = poolStates.reduce((callData, poolState) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      callData.push({
        target: poolState.key.hooks,
        callData:
          bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
            ? encodeVaultSharePricesAtLastSwap(bunniHookInterface, poolState)
            : encodeExtsLoad(bunniHookInterface, poolState),
      });
    }

    return callData;
  }, [] as { target: string; callData: string }[]);

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      const data =
        bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
          ? decodeVaultSharePricesAtLastSwap(
              bunniHookInterface,
              result[i].returnData,
            )
          : decodeExtsLoad(bunniHookInterface, result[i].returnData);

      poolState.initialized = data.initialized;
      poolState.sharePrice0 = bigIntify(data.sharePrice0);
      poolState.sharePrice1 = bigIntify(data.sharePrice1);
    }
  });
}

export async function updateTopBid(
  poolStates: PoolState[],
  blockNumber: number,
  dexHelper: IDexHelper,
  config: DexParams,
): Promise<void> {
  const encodeGetTopBid = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('getTopBid', [s.id]);
  };
  const decodeGetTopBid = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('getTopBid', d);
  };
  const encodeGetBid = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('getBid', [s.id, true]);
  };
  const decodeGetBid = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('getBid', d);
  };

  const multiCallData = poolStates.reduce((callData, poolState) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      callData.push({
        target: poolState.key.hooks,
        callData:
          bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
            ? encodeGetTopBid(bunniHookInterface, poolState)
            : encodeGetBid(bunniHookInterface, poolState),
      });
    }

    return callData;
  }, [] as { target: string; callData: string }[]);

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      const data = (
        bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
          ? decodeGetTopBid(bunniHookInterface, result[i].returnData)
          : decodeGetBid(bunniHookInterface, result[i].returnData)
      )[0];

      poolState.topBid = {
        manager: data.manager,
        blockIdx: bigIntify(data.blockIdx),
        payload: data.payload,
        rent: bigIntify(data.rent),
        deposit: bigIntify(data.deposit),
      };
    }
  });
}

export async function updateNextBid(
  poolStates: PoolState[],
  blockNumber: number,
  dexHelper: IDexHelper,
  config: DexParams,
): Promise<void> {
  const encodeGetNextBid = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('getNextBid', [s.id]);
  };
  const decodeGetNextBid = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('getNextBid', d);
  };
  const encodeGetBid = (i: Interface, s: PoolState) => {
    return i.encodeFunctionData('getBid', [s.id, false]);
  };
  const decodeGetBid = (i: Interface, d: BytesLike) => {
    return i.decodeFunctionResult('getBid', d);
  };

  const multiCallData = poolStates.reduce((callData, poolState) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      callData.push({
        target: poolState.key.hooks,
        callData:
          bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
            ? encodeGetNextBid(bunniHookInterface, poolState)
            : encodeGetBid(bunniHookInterface, poolState),
      });
    }

    return callData;
  }, [] as { target: string; callData: string }[]);

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const bunniHook = config.bunniHooks.find(
      hook => hook.address.toLowerCase() === poolState.key.hooks.toLowerCase(),
    );

    if (bunniHook !== undefined) {
      const bunniHookInterface = bunniHook.interface;
      const bunniHookVersion =
        BunniHookVersions[bunniHook.address.toLowerCase()];

      const data = (
        bunniHookVersion === 'v0' || bunniHookVersion === 'v1'
          ? decodeGetNextBid(bunniHookInterface, result[i].returnData)
          : decodeGetBid(bunniHookInterface, result[i].returnData)
      )[0];

      poolState.nextBid = {
        manager: data.manager,
        blockIdx: bigIntify(data.blockIdx),
        payload: data.payload,
        rent: bigIntify(data.rent),
        deposit: bigIntify(data.deposit),
      };
    }
  });
}

export async function updateTotalSupply(
  poolStates: PoolState[],
  blockNumber: number,
  bunniTokenInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  const multiCallData = poolStates.map(poolState => {
    return {
      target: poolState.bunniToken,
      callData: bunniTokenInterface.encodeFunctionData('totalSupply'),
    };
  });

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  poolStates.forEach((poolState, i) => {
    const data = bunniTokenInterface.decodeFunctionResult(
      'totalSupply',
      result[i].returnData,
    );
    poolState.totalSupply = bigIntify(data);
  });
}

export async function updateObservations(
  poolStates: PoolState[],
  blockNumber: number,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  const multiCallData = poolStates
    .map(poolState => {
      let multiCallData: { target: string; callData: string }[] = [];

      for (let i = 0n; i < poolState.cardinalityNext; i++) {
        multiCallData.push({
          target: poolState.key.hooks,
          callData: bunniHookInterface.encodeFunctionData('getObservation', [
            poolState.key,
            i,
          ]),
        });
      }

      return multiCallData;
    })
    .flat();

  const result = await multicall(multiCallData, blockNumber, dexHelper);

  let callIndex = 0;
  poolStates.forEach((poolState, i) => {
    for (let i = 0n; i < poolState.cardinalityNext; i++) {
      const data = bunniHookInterface.decodeFunctionResult(
        'getObservation',
        result[callIndex].returnData,
      )[0];
      poolState.observations[Number(i)] = {
        blockTimestamp: bigIntify(data.blockTimestamp),
        prevTick: bigIntify(data.prevTick),
        tickCumulative: bigIntify(data.tickCumulative),
        initialized: data.initialized,
      };
      callIndex++;
    }
  });
}

export async function updateStateAfterDeposit(
  state: PoolState,
  blockNumber: number,
  bunniHubInterface: Interface,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  await Promise.all([
    updateHubState([state], blockNumber, bunniHubInterface, dexHelper),
    updateLdfState([state], blockNumber, bunniHookInterface, dexHelper),
  ]);
}

export async function updateStateAfterWithdraw(
  state: PoolState,
  blockNumber: number,
  bunniHubInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  await Promise.all([
    updateHubState([state], blockNumber, bunniHubInterface, dexHelper),
  ]);
}

export async function updateStateAfterSwap(
  state: PoolState,
  blockNumber: number,
  bunniHubInterface: Interface,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
  config: DexParams,
): Promise<void> {
  await Promise.all([
    updateHubState([state], blockNumber, bunniHubInterface, dexHelper),
    updateHookState([state], blockNumber, dexHelper, config).then(() =>
      updateObservations([state], blockNumber, bunniHookInterface, dexHelper),
    ),
    updateSlot0([state], blockNumber, bunniHookInterface, dexHelper),
    updateLdfState([state], blockNumber, bunniHookInterface, dexHelper),
    updateVaultSharePricesAtLastSwap([state], blockNumber, dexHelper, config),
  ]);
}

export async function updateStateAfterOrderFulfilled(
  states: PoolState[],
  blockNumber: number,
  bunniHubInterface: Interface,
  bunniHookInterface: Interface,
  dexHelper: IDexHelper,
): Promise<void> {
  await Promise.all([
    updateHubState(states, blockNumber, bunniHubInterface, dexHelper),
    updateSlot0(states, blockNumber, bunniHookInterface, dexHelper),
  ]);
}
