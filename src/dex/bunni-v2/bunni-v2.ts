import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  SimpleExchangeParam,
  PoolLiquidity,
  Logger,
  DexExchangeParam,
} from '../../types';
import {
  SwapSide,
  Network,
  ETHER_ADDRESS,
  NULL_ADDRESS,
  MAX_UINT,
  MAX_INT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { bigIntify, getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { BunniV2Data, PoolState, PoolStateMap } from './types';
import { SimpleExchange } from '../simple-exchange';
import { BunniV2Config } from './config';
import { BunniV2EventPool } from './bunni-v2-pool';
// import { ZERO_ADDRESS } from './lib/Constants';
import V4QuoterABI from '../../abi/bunni-v2/V4Quoter.abi.json';
import { Interface } from '@ethersproject/abi';
import { MultiResult } from '../../lib/multi-wrapper';
import { BytesLike } from 'ethers';
import { generalDecoder } from '../../lib/decoders';
import { BI_POWS } from '../../bigint-constants';
import { quoteSwap } from './logic/BunniQuoter';
import { queryAvailablePoolsForToken } from './subgraph';
import _ from 'lodash';
import { TickMath } from './lib/TickMath';
import {
  swapExactInputSingleCalldata,
  swapExactOutputSingleCalldata,
} from './encoder';

export class BunniV2 extends SimpleExchange implements IDex<BunniV2Data> {
  protected eventPools: BunniV2EventPool;

  readonly hasConstantPriceLargeAmounts = false;
  // TODO: set true here if protocols works only with wrapped asset
  readonly needWrapNative = false;

  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(BunniV2Config);

  logger: Logger;
  quoterInterface: Interface;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.quoterInterface = new Interface(V4QuoterABI);

    this.eventPools = new BunniV2EventPool(
      dexKey,
      network,
      dexHelper,
      this.logger,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    // TODO: complete me!
    await this.eventPools.initialize(blockNumber);
  }

  // Legacy: was only used for V5
  // Returns the list of contract adapters (name and index)
  // for a buy/sell. Return null if there are no adapters.
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return null;
  }

  // Returns list of pool identifiers that can be used
  // for a given swap. poolIdentifiers must be unique
  // across DEXes. It is recommended to use
  // ${dexKey}_${poolAddress} as a poolIdentifier
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    let srcTokenAddress = srcToken.address.toLowerCase();
    let destTokenAddress = destToken.address.toLowerCase();
    if (isETHAddress(srcTokenAddress)) srcTokenAddress = NULL_ADDRESS;
    if (isETHAddress(destTokenAddress)) destTokenAddress = NULL_ADDRESS;

    const poolState = this.eventPools.getState(blockNumber);

    if (poolState === null) return [];
    return this.findPoolIdentifiersWithTokens(
      poolState,
      srcTokenAddress,
      destTokenAddress,
    );
  }

  findPoolIdentifiersWithTokens(
    pools: DeepReadonly<PoolStateMap>,
    tokenA: string,
    tokenB: string,
  ): string[] {
    return Object.entries(pools)
      .filter(([, poolState]) => {
        return this.hasTokens(poolState, [tokenA, tokenB]);
      })
      .map(([, poolState]) => `BunniV2_${poolState.id}`);
  }

  hasTokens(pool: DeepReadonly<PoolState>, tokens: string[]): boolean {
    return tokens.every(
      token => pool.key.currency0 === token || pool.key.currency1 === token,
    );
  }

  // Returns pool prices for amounts.
  // If limitPools is defined only pools in limitPools
  // should be used. If limitPools is undefined then
  // any pools can be used.
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<BunniV2Data>> {
    console.log('check');
    const _src = isETHAddress(srcToken.address)
      ? NULL_ADDRESS
      : srcToken.address.toLowerCase();
    const _dest = isETHAddress(destToken.address)
      ? NULL_ADDRESS
      : destToken.address.toLowerCase();

    const poolStates = this.eventPools.getState(blockNumber);
    console.log(poolStates);
    if (poolStates === null) return []; // TODO i think so...??

    const pools = Object.values(poolStates).filter(poolState => {
      return this.hasTokens(poolState, [_src, _dest]);
      // && poolState.totalSupply > 0n;
    }) as PoolState[];

    const poolIdSet = new Set((limitPools ?? []).map(id => id));
    const availablePools =
      limitPools && limitPools.length
        ? pools.filter(pool => poolIdSet.has(`BunniV2_${pool.id}`))
        : pools;

    const pricesPromises = availablePools.map(async pool => {
      let prices: bigint[] | null;
      const zeroForOne: boolean =
        pool.key.currency0.toLowerCase() === _src.toLowerCase() ? true : false;

      try {
        prices = await this.getOnChainPrices(
          zeroForOne,
          amounts,
          pool,
          side,
          blockNumber,
        );
      } catch (error) {
        console.warn(error);
        prices = null;
      }

      // try {
      //   // attempt to quote the swap locally
      //   prices = this.getOffChainPrices(
      //     zeroForOne,
      //     amounts,
      //     pool,
      //     side,
      //     bigIntify(blockNumber)
      //   );
      // } catch (error) {
      //   console.warn(error);
      //   // revert to fetching prices via RPC
      //   prices = await this.getOnChainPrices(
      //     zeroForOne,
      //     amounts,
      //     pool,
      //     side,
      //     blockNumber
      //   );
      // }

      if (prices === null) {
        return null;
      }

      if (SwapSide.BUY && prices[prices.length - 1] === 0n) {
        return null;
      }

      if (prices.every(price => price === 0n)) {
        return null;
      }

      return {
        unit: BI_POWS[destToken.decimals],
        prices,
        data: {
          exchange: this.dexKey,
          poolKey: pool.key,
          zeroForOne: zeroForOne,
        },
        exchange: this.dexKey,
        gasCost: 100_000, // TODO
        poolIdentifier: pool.id,
      };
    });

    const prices = await Promise.all(pricesPromises);
    return prices.filter(res => res !== null);
  }

  // getOffChainPrices(
  //   zeroForOne: boolean,
  //   amounts: bigint[],
  //   pool: PoolState,
  //   side: SwapSide,
  //   blockNumber: bigint
  // ): bigint[] {
  //   const quotes = amounts.map((amount) => {
  //     return quoteSwap(
  //       pool,
  //       {
  //         zeroForOne,
  //         amountSpecified: side === SwapSide.SELL
  //           ? -amount
  //           : amount,
  //         sqrtPriceLimitX96: zeroForOne
  //           ? TickMath.MIN_SQRT_PRICE + 1n
  //           : TickMath.MAX_SQRT_PRICE - 1n,
  //       },
  //       blockNumber,
  //       BunniV2Config.BunniV2[this.network]
  //     )
  //   });

  //   return quotes.map((quote) => (
  //     side === SwapSide.SELL ? quote.outputAmount : quote.inputAmount
  //   ));
  // }

  async getOnChainPrices(
    zeroForOne: boolean,
    amounts: bigint[],
    pool: PoolState,
    side: SwapSide,
    blockNumber: number,
  ): Promise<bigint[]> {
    const funcName =
      side === SwapSide.SELL
        ? 'quoteExactInputSingle'
        : 'quoteExactOutputSingle';

    const callData = amounts.map(amount => {
      return {
        target: BunniV2Config.BunniV2[this.network].quoter,
        callData: this.quoterInterface.encodeFunctionData(funcName, [
          [pool.key, zeroForOne, amount, '0x'],
        ]),
        decodeFunction: (
          result: MultiResult<BytesLike> | BytesLike,
        ): bigint => {
          // amountOut, gasEstimate
          return generalDecoder(result, ['uint256', 'uint256'], 0n, value =>
            BigInt(value[0].toString()),
          );
        },
      };
    });

    const results = await this.dexHelper.multiWrapper.tryAggregate(
      false,
      callData,
      blockNumber,
    );

    return results.map(result => (result.success ? result.returnData : 0n));
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<BunniV2Data>): number | number[] {
    // TODO: update if there is any payload in getAdapterParam
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  getDexParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    recipient: Address,
    data: BunniV2Data,
    side: SwapSide,
  ): DexExchangeParam {
    let exchangeData: string;
    if (side === SwapSide.SELL) {
      exchangeData = swapExactInputSingleCalldata(
        srcToken,
        destToken,
        data.poolKey,
        data.zeroForOne,
        BigInt(srcAmount),
        // destMinAmount (can be 0 on dex level)
        0n,
        recipient,
      );
    } else {
      exchangeData = swapExactOutputSingleCalldata(
        srcToken,
        destToken,
        data.poolKey,
        data.zeroForOne,
        BigInt(destAmount),
        recipient,
      );
    }

    // return null as any;

    return {
      needWrapNative: this.needWrapNative,
      sendEthButSupportsInsertFromAmount: true,
      dexFuncHasRecipient: true,
      exchangeData,
      targetExchange: BunniV2Config.BunniV2[this.network].router,
      permit2Approval: true,
      returnAmountPos: undefined,
    };
  }

  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: BunniV2Data,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { exchange } = data;

    const payload = '';

    return {
      targetExchange: exchange,
      payload,
      networkFee: '0',
    };
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {
    // TODO: complete me!
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    let _tokenAddress = tokenAddress.toLowerCase();
    if (isETHAddress(_tokenAddress)) _tokenAddress = NULL_ADDRESS;

    const availablePoolsForToken = await queryAvailablePoolsForToken(
      this.dexHelper,
      BunniV2Config.BunniV2[this.network].subgraphURL,
      _tokenAddress,
    );

    // TODO
    // instead of relying on the vault pricePerVaultShare values
    // from the subgraph which can be stale, we can query them
    // via RPC to get the most accurate liquidityUSD values.

    if (!availablePoolsForToken) {
      this.logger.error(
        `Error_${this.dexKey}_Subgraph: couldn't fetch the pools from the subgraph`,
      );
      return [];
    }

    const connectors: PoolLiquidity[] = availablePoolsForToken.map(pool => {
      const connectorAddress =
        _tokenAddress.toLowerCase() === pool.currency0.id.toLowerCase()
          ? pool.currency1.id.toLowerCase()
          : pool.currency0.id.toLowerCase();

      const connectorDecimals =
        _tokenAddress.toLowerCase() === pool.currency0.id.toLowerCase()
          ? parseInt(pool.currency1.decimals)
          : parseInt(pool.currency0.decimals);

      const rawBalance0 = parseFloat(pool.bunniToken.rawBalance0);
      const rawBalance1 = parseFloat(pool.bunniToken.rawBalance1);

      const reserveBalance0 = pool.bunniToken.vault0
        ? parseFloat(pool.bunniToken.reserve0) *
          parseFloat(pool.bunniToken.vault0.pricePerVaultShare)
        : 0;
      const reserveBalance1 = pool.bunniToken.vault1
        ? parseFloat(pool.bunniToken.reserve1) *
          parseFloat(pool.bunniToken.vault1.pricePerVaultShare)
        : 0;

      const totalBalance0 = rawBalance0 + reserveBalance0;
      const totalBalance1 = rawBalance1 + reserveBalance1;

      let liquidity0 = 0;
      if (parseFloat(pool.currency0.price) > 0) {
        liquidity0 = totalBalance0 * parseFloat(pool.currency0.price);
      } else if (parseFloat(pool.currency1.price) > 0) {
        liquidity0 =
          totalBalance0 *
          parseFloat(pool.priceCurrency1) *
          parseFloat(pool.currency1.price);
      } else {
        // TODO what do we do here (i.e. neither token has a USD price from the subgraph)?
      }

      let liquidity1 = 0;
      if (parseFloat(pool.currency1.price) > 0) {
        liquidity1 = totalBalance1 * parseFloat(pool.currency1.price);
      } else if (parseFloat(pool.currency0.price) > 0) {
        liquidity1 =
          totalBalance1 *
          parseFloat(pool.priceCurrency0) *
          parseFloat(pool.currency0.price);
      } else {
        // TODO what do we do here (i.e. neither token has a USD price from the subgraph)?
      }

      return {
        exchange: this.dexKey,
        address: BunniV2Config.BunniV2[this.network].poolManager,
        connectorTokens: [
          { address: connectorAddress, decimals: connectorDecimals },
        ],
        liquidityUSD: liquidity0 + liquidity1,
      };
    });

    const pools = _.orderBy(connectors, ['liquidityUSD'], ['desc']).slice(
      0,
      limit,
    );
    return pools;
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }
}
