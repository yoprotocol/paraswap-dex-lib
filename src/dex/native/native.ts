import BigNumber from 'bignumber.js';
import { assert } from 'ts-essentials';
import { BN_0, BN_1, getBigNumberPow } from '../../bignumber-constants';
import { CACHE_PREFIX, Network, SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { IDex } from '../../dex/idex';
import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  ExchangeTxInfo,
  Logger,
  NumberAsString,
  OptimalSwapExchange,
  PoolLiquidity,
  PoolPrices,
  PreprocessTransactionOptions,
  SimpleExchangeParam,
  Token,
} from '../../types';
import { getDexKeysWithNetwork, isETHAddress } from '../../utils';
import { SimpleExchange } from '../simple-exchange';
import { RateFetcher } from './rate-fetcher';
import { NativeConfig } from './config';
import {
  NativeData,
  NativeFirmQuoteResponse,
  NativeOrderbookEntry,
  NativeRateFetcherConfig,
  NativeTxRequest,
} from './types';
import {
  NATIVE_API_URL,
  NATIVE_FIRM_QUOTE_EXPIRY_S,
  NATIVE_FIRM_QUOTE_VERSION,
  NATIVE_GAS_COST,
  NATIVE_ORDERBOOK_CACHE_TTL_S,
  NATIVE_ORDERBOOK_POLLING_INTERVAL_MS,
} from './constants';
import { SpecialDex } from '../../executor/types';

export class Native extends SimpleExchange implements IDex<NativeData> {
  readonly isStatePollingDex = true;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;
  readonly needsSequentialPreprocessing = true;
  private tokenCache: Map<string, Token> = new Map();

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(NativeConfig);

  private logger: Logger;
  private rateFetcher: RateFetcher;
  private orderbookCacheKey: string;
  private nativeApiKey: string;
  private chainName: string;
  private routerAddress: Address;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
  ) {
    super(dexHelper, dexKey);

    const dexConfig = NativeConfig[this.dexKey]?.[network];
    assert(
      dexConfig,
      `${this.dexKey}-${network}: Missing network configuration for Native`,
    );

    this.routerAddress = dexConfig.routerAddress;
    this.chainName = dexConfig.chainName;

    this.logger = dexHelper.getLogger(`${dexKey}-${network}`);

    const apiKey = dexHelper.config.data.nativeApiKey;
    assert(
      apiKey && apiKey.length > 0,
      'Native API key is not specified. Please set API_KEY_NATIVE',
    );
    this.nativeApiKey = apiKey;

    this.orderbookCacheKey = `${CACHE_PREFIX}_${network}_${dexKey}_orderbook`;

    const rateFetcherConfig: NativeRateFetcherConfig = {
      rateConfig: {
        orderbookReqParams: {
          url: `${NATIVE_API_URL}/orderbook`,
          params: {
            chain: this.chainName,
          },
          headers: {
            apikey: this.nativeApiKey,
          },
        },
        orderbookCacheKey: this.orderbookCacheKey,
        orderbookCacheTTLSecs: NATIVE_ORDERBOOK_CACHE_TTL_S,
        orderbookIntervalMs: NATIVE_ORDERBOOK_POLLING_INTERVAL_MS,
      },
    };

    this.rateFetcher = new RateFetcher(
      this.dexHelper,
      this.logger,
      rateFetcherConfig,
    );
  }

  async initializePricing(_blockNumber: number): Promise<void> {
    if (!this.dexHelper.config.isSlave) {
      this.rateFetcher.start();
    }
  }

  releaseResources(): void {
    this.rateFetcher.stop();
  }

  getAdapters(): { name: string; index: number }[] | null {
    return null;
  }

  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    _side: SwapSide,
    _blockNumber: number,
  ): Promise<string[]> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    this.cacheToken(_srcToken);
    this.cacheToken(_destToken);

    if (_srcToken.address === _destToken.address) {
      return [];
    }

    const entries = await this.getEntriesForPair(
      _srcToken.address,
      _destToken.address,
    );

    return entries.map(entry => this.serializePoolIdentifier(entry));
  }

  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    _blockNumber: number,
    limitPools?: string[],
  ): Promise<ExchangePrices<NativeData> | null> {
    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    this.cacheToken(_srcToken);
    this.cacheToken(_destToken);

    if (_srcToken.address === _destToken.address) {
      return null;
    }

    const orderbook = await this.getCachedOrderbook();
    if (!orderbook) {
      return null;
    }

    let entries = await this.getEntriesForPair(
      _srcToken.address,
      _destToken.address,
      orderbook,
    );

    if (limitPools && limitPools.length > 0) {
      entries = entries.filter(entry =>
        limitPools.includes(this.serializePoolIdentifier(entry)),
      );
    }

    if (entries.length === 0) {
      return null;
    }

    const poolPrices = entries
      .map(entry =>
        this.buildPoolPrices(entry, _srcToken, _destToken, amounts, side),
      )
      .filter((price): price is PoolPrices<NativeData> => price !== null);

    return poolPrices.length ? poolPrices : null;
  }

  getTokenFromAddress(address: Address): Token {
    const cached = this.tokenCache.get(address.toLowerCase());
    if (cached) {
      return cached;
    }
    return {
      address,
      decimals: 18,
    };
  }

  private cacheToken(token: Token) {
    this.tokenCache.set(token.address.toLowerCase(), token);
  }

  getCalldataGasCost(_: PoolPrices<NativeData>): number | number[] {
    return NATIVE_GAS_COST;
  }

  async preProcessTransaction(
    optimalSwapExchange: OptimalSwapExchange<NativeData>,
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    options: PreprocessTransactionOptions,
  ): Promise<[OptimalSwapExchange<NativeData>, ExchangeTxInfo]> {
    if (side !== SwapSide.SELL) {
      throw new Error(`${this.dexKey}-${this.network}: BUY not supported`);
    }

    const _srcToken = this.dexHelper.config.wrapETH(srcToken);
    const _destToken = this.dexHelper.config.wrapETH(destToken);

    const amountIn = BigInt(optimalSwapExchange.srcAmount);
    const formattedAmount = this.formatAmountForApi(
      amountIn,
      _srcToken.decimals,
    );

    const shouldUseExecutorRecipient =
      !!options.executionContractAddress && isETHAddress(destToken.address);

    const executionAddress = shouldUseExecutorRecipient
      ? options.executionContractAddress!.toLowerCase()
      : options.recipient.toLowerCase();

    const response = await this.fetchFirmQuote({
      src_chain: this.chainName,
      dst_chain: this.chainName,
      token_in: _srcToken.address.toLowerCase(),
      token_out: _destToken.address.toLowerCase(),
      amount: formattedAmount,
      from_address: executionAddress,
      version: NATIVE_FIRM_QUOTE_VERSION,
      expiry_time: NATIVE_FIRM_QUOTE_EXPIRY_S.toString(),
    });

    if (!response?.success || !response.txRequest) {
      throw new Error(
        `${this.dexKey}-${this.network}: Firm quote failed ${
          response?.errorMessage || ''
        }`,
      );
    }

    if (
      response.txRequest.value &&
      response.txRequest.value !== '0' &&
      response.txRequest.value !== '0x0'
    ) {
      throw new Error(
        `${this.dexKey}-${this.network}: Non-zero tx value is not supported`,
      );
    }

    const deadline =
      response.orders?.[0]?.deadlineTimestamp !== undefined
        ? BigInt(response.orders[0].deadlineTimestamp)
        : undefined;

    return [
      {
        ...optimalSwapExchange,
        destAmount: response.amountOut,
        data: {
          quote: response,
        },
      },
      {
        deadline,
      },
    ];
  }

  getAdapterParam(
    _srcToken: Address,
    _destToken: Address,
    _srcAmount: NumberAsString,
    _destAmount: NumberAsString,
    data: NativeData,
    _side: SwapSide,
  ): AdapterExchangeParam {
    const txRequest = data.quote?.txRequest;
    assert(
      txRequest,
      `${this.dexKey}-${this.network}: Missing txRequest for adapter param`,
    );

    const { target, calldata, value } = this.normalizeTxRequest(txRequest);

    return {
      targetExchange: target,
      payload: calldata,
      networkFee: value,
    };
  }

  async getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: NativeData,
    _side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const txRequest = data.quote?.txRequest;
    assert(
      txRequest,
      `${this.dexKey}-${this.network}: Missing txRequest for simple param`,
    );

    const { calldata, target, value } = this.normalizeTxRequest(txRequest);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      calldata,
      target,
      undefined,
      value,
    );
  }

  getDexParam(
    _srcToken: Address,
    _destToken: Address,
    _srcAmount: NumberAsString,
    _destAmount: NumberAsString,
    _recipient: Address,
    data: NativeData,
    _side: SwapSide,
  ): DexExchangeParam {
    const txRequest = data.quote?.txRequest;
    assert(
      txRequest,
      `${this.dexKey}-${this.network}: Missing txRequest for dex param`,
    );

    const { calldata, target } = this.normalizeTxRequest(txRequest);

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: true,
      exchangeData: calldata,
      targetExchange: target,
      swappedAmountNotPresentInExchangeData: true,
      returnAmountPos: undefined,
    };
  }

  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const orderbook = await this.getCachedOrderbook();
    if (!orderbook) {
      return [];
    }

    const lowerToken = tokenAddress.toLowerCase();
    return orderbook
      .filter(entry => entry.base_address === lowerToken)
      .slice(0, limit)
      .map(entry => ({
        exchange: this.dexKey,
        address: this.routerAddress,
        connectorTokens: [
          {
            address: entry.quote_address,
            decimals: 0,
          },
        ],
        liquidityUSD: 0,
      }));
  }

  private async getEntriesForPair(
    baseAddress: Address,
    quoteAddress: Address,
    customOrderbook?: NativeOrderbookEntry[] | null,
  ): Promise<NativeOrderbookEntry[]> {
    const orderbook = customOrderbook ?? (await this.getCachedOrderbook());
    if (!orderbook) {
      return [];
    }

    const base = baseAddress.toLowerCase();
    const quote = quoteAddress.toLowerCase();

    return orderbook.filter(
      entry =>
        entry.side === 'bid' &&
        entry.base_address === base &&
        entry.quote_address === quote,
    );
  }

  private buildPoolPrices(
    entry: NativeOrderbookEntry,
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
  ): PoolPrices<NativeData> | null {
    if (!entry.levels.length) {
      return null;
    }

    const dividerSrc = getBigNumberPow(srcToken.decimals);
    const dividerDest = getBigNumberPow(destToken.decimals);

    const priceResults: bigint[] = [];
    let unitQuote: BigNumber | null = null;

    if (side === SwapSide.SELL) {
      const minAmount = entry.minimum_in_base
        ? new BigNumber(entry.minimum_in_base).dividedBy(dividerSrc)
        : BN_0;

      for (const amount of amounts) {
        if (amount === 0n) {
          priceResults.push(0n);
          continue;
        }

        const amountBn = new BigNumber(amount.toString()).dividedBy(dividerSrc);
        if (minAmount.gt(0) && amountBn.lt(minAmount)) {
          return null;
        }

        const quote = this.computeSellQuote(entry, amountBn);
        if (!quote) {
          return null;
        }

        priceResults.push(this.toBigInt(quote, destToken.decimals));
      }

      unitQuote = this.computeSellQuote(entry, BN_1) || BN_0;
    } else {
      const minQuoteAmount = this.computeMinQuoteAmount(
        entry,
        srcToken.decimals,
      );

      for (const amount of amounts) {
        if (amount === 0n) {
          priceResults.push(0n);
          continue;
        }

        const amountBn = new BigNumber(amount.toString()).dividedBy(
          dividerDest,
        );

        if (minQuoteAmount.gt(0) && amountBn.lt(minQuoteAmount)) {
          return null;
        }

        const requiredBase = this.computeBuyQuote(entry, amountBn);
        if (!requiredBase) {
          return null;
        }

        priceResults.push(this.toBigInt(requiredBase, srcToken.decimals));
      }

      unitQuote = this.computeBuyQuote(entry, BN_1) || BN_0;
    }

    return {
      exchange: this.dexKey,
      data: { quote: undefined },
      poolIdentifiers: [this.serializePoolIdentifier(entry)],
      poolAddresses: [this.routerAddress],
      gasCost: NATIVE_GAS_COST,
      prices: priceResults,
      unit: this.toBigInt(
        unitQuote,
        side === SwapSide.SELL ? destToken.decimals : srcToken.decimals,
      ),
    };
  }

  private computeSellQuote(
    entry: NativeOrderbookEntry,
    amount: BigNumber,
  ): BigNumber | null {
    if (amount.lte(0)) {
      return BN_0;
    }

    let remaining = amount;
    let output = new BigNumber(0);

    for (const level of entry.levels) {
      const levelAmount = new BigNumber(level[0]);
      const levelPrice = new BigNumber(level[1]);
      if (levelAmount.lte(0) || levelPrice.lte(0)) {
        continue;
      }

      const fill = BigNumber.minimum(levelAmount, remaining);
      output = output.plus(fill.multipliedBy(levelPrice));
      remaining = remaining.minus(fill);

      if (remaining.lte(0)) {
        return output;
      }
    }

    return null;
  }

  private computeBuyQuote(
    entry: NativeOrderbookEntry,
    requiredQuoteAmount: BigNumber,
  ): BigNumber | null {
    if (requiredQuoteAmount.lte(0)) {
      return BN_0;
    }

    let remaining = requiredQuoteAmount;
    let requiredBase = new BigNumber(0);

    for (const level of entry.levels) {
      const baseAmount = new BigNumber(level[0]);
      const price = new BigNumber(level[1]);
      if (baseAmount.lte(0) || price.lte(0)) {
        continue;
      }

      const levelQuote = baseAmount.multipliedBy(price);
      const quoteToUse = BigNumber.minimum(levelQuote, remaining);
      const baseNeeded = quoteToUse.dividedBy(price);
      requiredBase = requiredBase.plus(baseNeeded);
      remaining = remaining.minus(quoteToUse);

      if (remaining.lte(0)) {
        return requiredBase;
      }
    }

    return null;
  }

  private computeMinQuoteAmount(
    entry: NativeOrderbookEntry,
    baseTokenDecimals: number,
  ): BigNumber {
    if (!entry.minimum_in_base || entry.minimum_in_base <= 0) {
      return BN_0;
    }

    const firstLevelPrice = entry.levels[0]?.[1];
    if (!firstLevelPrice || firstLevelPrice <= 0) {
      return BN_0;
    }

    const normalizedMinBase = new BigNumber(entry.minimum_in_base).dividedBy(
      getBigNumberPow(baseTokenDecimals),
    );

    return normalizedMinBase.multipliedBy(firstLevelPrice);
  }

  private serializePoolIdentifier(entry: NativeOrderbookEntry): string {
    return `${this.dexKey}_${entry.base_address}_${entry.quote_address}_${entry.side}`.toLowerCase();
  }

  private async getCachedOrderbook(): Promise<NativeOrderbookEntry[] | null> {
    let cached = await this.dexHelper.cache.rawget(this.orderbookCacheKey);
    if (!cached) {
      await this.rateFetcher.fetchOnce();
      cached = await this.dexHelper.cache.rawget(this.orderbookCacheKey);
      if (!cached) {
        return null;
      }
    }

    try {
      const parsed = JSON.parse(cached) as NativeOrderbookEntry[];
      return parsed.map(entry => ({
        ...entry,
        base_address: entry.base_address.toLowerCase(),
        quote_address: entry.quote_address.toLowerCase(),
        side: entry.side === 'ask' ? 'ask' : 'bid',
      }));
    } catch (error) {
      this.logger.error(
        `${this.dexKey}-${this.network}: Failed to parse cached orderbook`,
        error,
      );
      return null;
    }
  }

  private toBigInt(amount: BigNumber, decimals: number): bigint {
    if (amount.lte(0)) {
      return 0n;
    }
    return BigInt(
      amount
        .multipliedBy(getBigNumberPow(decimals))
        .decimalPlaces(0, BigNumber.ROUND_DOWN)
        .toFixed(0),
    );
  }

  private formatAmountForApi(amount: bigint, decimals: number): string {
    const divider = getBigNumberPow(decimals);
    const formatted = new BigNumber(amount.toString())
      .dividedBy(divider)
      .decimalPlaces(decimals, BigNumber.ROUND_DOWN)
      .toFixed();

    return formatted.replace(/\.0+$/, '');
  }

  private async fetchFirmQuote(
    params: Record<string, string>,
  ): Promise<NativeFirmQuoteResponse> {
    const response =
      await this.dexHelper.httpRequest.request<NativeFirmQuoteResponse>({
        method: 'GET',
        url: `${NATIVE_API_URL}/firm-quote`,
        params,
        headers: {
          apikey: this.nativeApiKey,
        },
      });

    return response.data;
  }

  private normalizeTxRequest(txRequest: NativeTxRequest) {
    const target = txRequest.target || this.routerAddress;
    const calldata = txRequest.calldata.startsWith('0x')
      ? txRequest.calldata
      : `0x${txRequest.calldata}`;
    const value =
      txRequest.value !== undefined && txRequest.value !== null
        ? txRequest.value
        : '0';

    return {
      target,
      calldata,
      value,
    };
  }
}
