import { Interface } from '@ethersproject/abi';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import { Address, BlockHeader, Log, Logger } from '../../types';
import { bigIntify, catchParseLogError } from '../../utils';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { DexParams, PoolState, PoolStateMap, SubgraphPool } from './types';
import { BunniV2Config } from './config';

import PoolManagerABI from '../../abi/bunni-v2/PoolManager.abi.json';
import BunniHubABI from '../../abi/bunni-v2/BunniHub.abi.json';
import BunniHookABI from '../../abi/bunni-v2/BunniHook.abi.json';
import BunniTokenABI from '../../abi/bunni-v2/BunniToken.abi.json';
import FloodPlainABI from '../../abi/bunni-v2/FloodPlain.abi.json';

import { queryPools } from './subgraph';
import _ from 'lodash';
import {
  deposit,
  DepositParams,
  withdraw,
  WithdrawParams,
} from './logic/BunniHubLogic';
import { IdleBalanceLibrary } from './lib/IdleBalance';
import { afterInitialize, beforeSwap } from './logic/BunniHookLogic';
import {
  updateHookState,
  updateHubState,
  updateLdfState,
  updateNextBid,
  updateObservations,
  updateSlot0,
  updateStateAfterDeposit,
  updateStateAfterOrderFulfilled,
  updateStateAfterSwap,
  updateStateAfterWithdraw,
  updateTopBid,
  updateTotalSupply,
  updateVaultSharePricesAtLastSwap,
} from './getOnChainState';
import { TickMath } from './lib/TickMath';
import { ZERO_BYTES_32, ZERO_BYTES_6 } from './lib/Constants';
import { _updateAmAmmWrite } from './logic/AmAmm';
import { NULL_ADDRESS } from '../../constants';
import { LDFType } from './ldf/LDFType';
import { getPools, initializePoolState } from './utils';

export class BunniV2EventPool extends StatefulEventSubscriber<PoolStateMap> {
  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<PoolStateMap>,
      log: Readonly<Log>,
      blockHeader: BlockHeader,
    ) => AsyncOrSync<DeepReadonly<PoolStateMap> | null>;
  } = {};

  ids: { [address: string]: string };
  interfaces: { [name: string]: Interface };
  logDecoders: { [name: string]: (log: Log) => any };
  addressesSubscribed: string[];
  subgraphURL: string;
  config: DexParams;

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
  ) {
    super(
      parentName,
      BunniV2Config.BunniV2[network].poolManager,
      dexHelper,
      logger,
    );

    this.config = BunniV2Config.BunniV2[network];

    this.ids = {
      [this.config.poolManager]: 'POOL_MANAGER',
      // ...Object.fromEntries(this.config.bunniHubs.map((bunniHub) => [bunniHub, 'BUNNI_HUB'])),
      // ...Object.fromEntries(this.config.bunniHooks.map((bunniHook) => [bunniHook.address, 'BUNNI_HOOK'])),
      // [this.config.floodPlain]: 'FLOOD_PLAIN',
    };

    this.interfaces = {
      ['POOL_MANAGER']: new Interface(PoolManagerABI),
      // ['BUNNI_HUB']: new Interface(BunniHubABI),
      // ['BUNNI_HOOK']: new Interface(BunniHookABI),
      // ['BUNNI_TOKEN']: new Interface(BunniTokenABI),
      // ['FLOOD_PLAIN']: new Interface(FloodPlainABI),
    };

    this.logDecoders = {
      ['POOL_MANAGER']: (log: Log) =>
        this.interfaces['POOL_MANAGER'].parseLog(log),
      // ['BUNNI_HUB']: (log: Log) => this.interfaces['BUNNI_HUB'].parseLog(log),
      // ['BUNNI_HOOK']: (log: Log) => this.interfaces['BUNNI_HOOK'].parseLog(log),
      // ['FLOOD_PLAIN']: (log: Log) => this.interfaces['FLOOD_PLAIN'].parseLog(log),
    };

    this.addressesSubscribed = [
      this.config.poolManager,
      // ...this.config.bunniHubs.map((bunniHub) => bunniHub),
      // ...this.config.bunniHooks.map((bunniHook) => bunniHook.address),
      // this.config.floodPlain,
    ];

    this.subgraphURL = this.config.subgraphURL;

    // Core Events
    this.handlers['Initialize'] = this.handleInitializeEvent.bind(this);
    // this.handlers['NewBunni'] = this.handleNewBunniEvent.bind(this);
    // this.handlers['Deposit'] = this.handleDepositEvent.bind(this);
    // this.handlers['Withdraw'] = this.handleWithdrawEvent.bind(this);
    // this.handlers['Swap'] = this.handleSwapEvent.bind(this);

    // // am-AMM Events
    // this.handlers['SubmitBid'] = this.handleSubmitBidEvent.bind(this);
    // this.handlers['DepositIntoTopBid'] = this.handleDepositIntoTopBidEvent.bind(this);
    // this.handlers['WithdrawFromTopBid'] = this.handleWithdrawFromTopBidEvent.bind(this);
    // this.handlers['DepositIntoNextBid'] = this.handleDepositIntoNextBidEvent.bind(this);
    // this.handlers['WithdrawFromNextBid'] = this.handleWithdrawFromNextBidEvent.bind(this);
    // this.handlers['SetBidPayload'] = this.handleSetBidPayloadEvent.bind(this);
    // this.handlers['IncreaseBidRent'] = this.handleIncreaseBidRentEvent.bind(this);

    // // Rebalancer Events
    // this.handlers['OrderEtched'] = this.handleOrderEtchedEvent.bind(this);
    // this.handlers['OrderFulfilled'] = this.handleOrderFulfilledEvent.bind(this);
  }

  protected async processLog(
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): Promise<DeepReadonly<PoolStateMap> | null> {
    try {
      const id = this.ids[log.address];
      const logDecoder = this.logDecoders[id];
      const event = logDecoder(log);
      if (event.name in this.handlers) {
        return await this.handlers[event.name](event, state, log, blockHeader);
      }
    } catch (e) {
      catchParseLogError(e, this.logger);
    }

    return null;
  }

  async generateState(
    blockNumber: number,
  ): Promise<DeepReadonly<PoolStateMap>> {
    let poolStateMap = Object.create({}) as PoolStateMap;

    const pools: SubgraphPool[] = await getPools(
      this.dexHelper,
      this.logger,
      this.subgraphURL,
      blockNumber,
    );

    pools.forEach(pool => {
      poolStateMap[pool.id.toLowerCase()] = initializePoolState(
        pool.id,
        pool.currency0.id,
        pool.currency1.id,
        bigIntify(pool.fee),
        bigIntify(pool.tickSpacing),
        pool.hooks,
      );
      // poolStateMap[pool.id.toLowerCase()].bunniHub = pool.bunniHub.id;
    });

    // const poolStates = Object.values(poolStateMap);

    // await Promise.all([
    //   // TODO the ones commented don't work with the new hooks....
    //   updateHubState(poolStates, blockNumber, this.interfaces['BUNNI_HUB'], this.dexHelper)
    //     .then(() => updateTotalSupply(poolStates, blockNumber, this.interfaces['BUNNI_TOKEN'], this.dexHelper)),
    //   updateHookState(poolStates, blockNumber, this.dexHelper, this.config),
    //     // .then(() => updateObservations(poolStates, blockNumber, this.interfaces['BUNNI_HOOK'], this.dexHelper)),
    //   updateSlot0(poolStates, blockNumber, this.interfaces['BUNNI_HOOK'], this.dexHelper),
    //   updateLdfState(poolStates, blockNumber, this.interfaces['BUNNI_HOOK'], this.dexHelper),
    //   updateVaultSharePricesAtLastSwap(poolStates, blockNumber, this.dexHelper, this.config),
    //   updateTopBid(poolStates, blockNumber, this.dexHelper, this.config),
    //   updateNextBid(poolStates, blockNumber, this.dexHelper, this.config),
    // ]);

    return poolStateMap;
  }

  async handleInitializeEvent(
    event: any,
    state: DeepReadonly<PoolStateMap>,
    log: Readonly<Log>,
    blockHeader: BlockHeader,
  ): Promise<DeepReadonly<PoolStateMap> | null> {
    const newState = _.cloneDeep(state) as PoolStateMap;

    // decode the event args
    const poolId = event.args.id.toLowerCase();
    const currency0 = event.args.currency0.toLowerCase();
    const currency1 = event.args.currency1.toLowerCase();
    const fee = bigIntify(event.args.fee);
    const tickSpacing = bigIntify(event.args.tickSpacing);
    const hooks = event.args.hooks.toLowerCase();
    const sqrtPriceX96 = bigIntify(event.args.sqrtPriceX96);
    const tick = bigIntify(event.args.tick);

    if (
      this.config.bunniHooks.some(
        bunniHook => bunniHook.address.toLowerCase() === hooks,
      )
    ) {
      const poolState = initializePoolState(
        poolId,
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks,
      );

      poolState.sqrtPriceX96 = sqrtPriceX96;
      poolState.tick = tick;

      newState[poolId] = poolState;
    }

    return newState;
  }

  // async handleNewBunniEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): Promise<DeepReadonly<PoolStateMap> | null> {
  //   const newState = _.cloneDeep(state) as PoolStateMap;

  //   const poolId = event.args.poolId.toLowerCase();
  //   const newPoolState = newState[poolId];
  //   newPoolState.bunniHub = log.address.toLowerCase();

  //   // await Promise.all([
  //   //   updateHubState([newPoolState], blockHeader.number, this.interfaces['BUNNI_HUB'], this.dexHelper),
  //   //   updateLdfState([newPoolState], blockHeader.number, this.interfaces['BUNNI_HOOK'], this.dexHelper),
  //   // ]);

  //   // const { slot0, observationState } = afterInitialize(
  //   //   newPoolState.sqrtPriceX96,
  //   //   newPoolState.tick,
  //   //   bigIntify(newPoolState.twapSecondsAgo),
  //   //   newPoolState.hookParams,
  //   //   bigIntify(blockHeader.timestamp)
  //   // );

  //   // newState[poolId] = {
  //   //   ...newPoolState,
  //   //   ...slot0,
  //   //   ...observationState
  //   // };

  //   return newState;
  // }

  // async handleDepositEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): Promise<DeepReadonly<PoolStateMap> | null> {
  //   const newState = _.cloneDeep(state) as PoolStateMap;

  //   const poolId = event.args.poolId.toLowerCase();
  //   const amount0 = bigIntify(event.args.amount0);
  //   const amount1 = bigIntify(event.args.amount1);
  //   const shares = bigIntify(event.args.shares);

  //   const params: DepositParams = {
  //     amount0Desired: amount0,
  //     amount1Desired: amount1,
  //     vaultFee0: 0n,
  //     vaultFee1: 0n,
  //   };

  //   let newPoolState = newState[poolId];

  //   try {
  //     // TODO
  //     // just mutate the actual state vs returning it
  //     newPoolState = deposit(
  //       newState[poolId],
  //       params,
  //       bigIntify(blockHeader.timestamp),
  //     );
  //   } catch (error) {
  //     console.warn(error);
  //     await updateStateAfterDeposit(
  //       newPoolState,
  //       blockHeader.number,
  //       this.interfaces['BUNNI_HUB'],
  //       this.interfaces['BUNNI_HOOK'],
  //       this.dexHelper
  //     );
  //   }

  //   // update the total supply (always 1e18 on the first deposit)
  //   newPoolState.totalSupply += newPoolState.totalSupply === 0n
  //     ? 1_000_000_000_000_000_000n
  //     : shares

  //   newState[poolId] = newPoolState;
  //   return newState;
  // }

  // async handleWithdrawEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): Promise<DeepReadonly<PoolStateMap> | null> {
  //   const newState = _.cloneDeep(state) as PoolStateMap;

  //   const poolId = event.args.poolId.toLowerCase();
  //   const shares = bigIntify(event.args.shares);

  //   const params: WithdrawParams = {
  //     shares: shares,
  //   };

  //   let newPoolState = newState[poolId];

  //   try {
  //     newPoolState = withdraw(
  //       newState[poolId],
  //       params,
  //     );
  //   } catch (error) {
  //     console.warn(error);
  //     console.log(poolId);
  //     await updateStateAfterWithdraw(
  //       newPoolState,
  //       blockHeader.number,
  //       this.interfaces['BUNNI_HUB'],
  //       this.dexHelper
  //     );
  //   }

  //   newPoolState.totalSupply -= shares;

  //   newState[poolId] = newPoolState;
  //   return newState;
  // }

  // async handleSwapEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): Promise<DeepReadonly<PoolStateMap> | null> {
  //   // PoolManager will also emit Swap events, but we only care about BunniHook
  //   if (this.config.bunniHooks.some((bunniHook) => bunniHook.address.toLowerCase() === log.address.toLowerCase())) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;

  //     const poolId = event.args.id.toLowerCase();
  //     const exactIn = event.args.exactIn;
  //     const zeroForOne = event.args.zeroForOne;
  //     const inputAmount = bigIntify(event.args.inputAmount);
  //     const outputAmount = bigIntify(event.args.outputAmount);

  //     try {
  //       beforeSwap(
  //         newState[poolId],
  //         bigIntify(blockHeader.number),
  //         bigIntify(blockHeader.timestamp),
  //         {
  //           zeroForOne,
  //           amountSpecified: exactIn ? -inputAmount : outputAmount,
  //           sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1n : TickMath.MAX_SQRT_PRICE - 1n
  //         },
  //         this.config
  //       );
  //     } catch (error) {
  //       console.warn(error);
  //       console.error(poolId);
  //       await updateStateAfterSwap(
  //         newState[poolId],
  //         blockHeader.number,
  //         this.interfaces['BUNNI_HUB'],
  //         this.interfaces['BUNNI_HOOK'],
  //         this.dexHelper,
  //         this.config
  //       );
  //     }

  //     return newState;
  //   }

  //   return state;
  // }

  // handleSubmitBidEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const manager = event.args.manager;
  //   const blockIdx = bigIntify(event.args.blockIdx);
  //   const payload = event.args.payload;
  //   const rent = bigIntify(event.args.rent);
  //   const deposit = bigIntify(event.args.deposit);

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       newPoolState.nextBid = { manager, blockIdx, payload, rent, deposit };
  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleDepositIntoTopBidEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const amount = bigIntify(event.args.amount);

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       newPoolState.topBid.deposit += amount;
  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleWithdrawFromTopBidEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const amount = bigIntify(event.args.amount);

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       newPoolState.topBid.deposit -= amount;
  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleDepositIntoNextBidEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const amount = bigIntify(event.args.amount);

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       newPoolState.nextBid.deposit += amount;
  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleWithdrawFromNextBidEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const amount = bigIntify(event.args.amount);

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       newPoolState.nextBid.deposit -= amount;
  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleSetBidPayloadEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const payload = event.args.payload;
  //   const topBid = event.args.topBid;

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       const relevantBid = topBid ? newPoolState.topBid : newPoolState.nextBid;
  //       relevantBid.payload = payload;

  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleIncreaseBidRentEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   const poolId = event.args.id.toLowerCase();
  //   const additionalRent = bigIntify(event.args.additionalRent);
  //   const updatedDeposit = bigIntify(event.args.updatedDeposit);
  //   const topBid: boolean = event.args.topBid;

  //   if (state[poolId]) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const newPoolState = newState[poolId];

  //     const hook = this.config.bunniHooks.find((bunniHook) =>
  //       bunniHook.address.toLowerCase() === newPoolState.key.hooks.toLowerCase()
  //     );

  //     if (hook) {
  //       _updateAmAmmWrite(
  //         newPoolState,
  //         bigIntify(blockHeader.number),
  //         hook.deploymentBlock,
  //         this.config.K
  //       );

  //       const relevantBid = topBid ? newPoolState.topBid : newPoolState.nextBid;
  //       relevantBid.rent += additionalRent;
  //       relevantBid.deposit = updatedDeposit;

  //       return newState;
  //     }
  //   }

  //   return state;
  // }

  // handleOrderEtchedEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): DeepReadonly<PoolStateMap> | null {
  //   // Only handle OrderEtched events from a known BunniHook
  //   const offerer: string = event.args.signedOrder.order.offerer;
  //   if (this.config.bunniHooks.some((bunniHook) => bunniHook.address.toLowerCase() === offerer.toLowerCase())) {
  //     const newState = _.cloneDeep(state) as PoolStateMap;
  //     const poolId = event.args.signedOrder.signature.toLowerCase();
  //     newState[poolId].rebalanceOrderHash = event.args.orderHash.toLowerCase();
  //     return newState;
  //   }

  //   return state;
  // }

  // async handleOrderFulfilledEvent(
  //   event: any,
  //   state: DeepReadonly<PoolStateMap>,
  //   log: Readonly<Log>,
  //   blockHeader: BlockHeader,
  // ): Promise<DeepReadonly<PoolStateMap> | null> {
  //   const newState = _.cloneDeep(state) as PoolStateMap;

  //   const orderHash = event.args.orderHash.toLowerCase();
  //   const poolState = Object.values(newState).find((pool) => pool.rebalanceOrderHash === orderHash);

  //   // TODO restrict this to only
  //   // pools with rebalancing enabled
  //   // so there is less RPC load
  //   await updateStateAfterOrderFulfilled(
  //     poolState ? [poolState] : Object.values(newState),
  //     blockHeader.number,
  //     this.interfaces['BUNNI_HUB'],
  //     this.interfaces['BUNNI_HOOK'],
  //     this.dexHelper
  //   );

  //   if (poolState) {
  //     poolState.rebalanceOrderHash = ZERO_BYTES_32;
  //   }

  //   return newState;
  // }
}
