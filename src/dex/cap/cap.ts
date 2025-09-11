import { AsyncOrSync } from 'ts-essentials';
import {
  Token,
  Address,
  ExchangePrices,
  PoolPrices,
  AdapterExchangeParam,
  PoolLiquidity,
  Logger,
  NumberAsString,
  DexExchangeParam,
} from '../../types';
import { SwapSide, Network, UNLIMITED_USD_LIQUIDITY } from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { getDexKeysWithNetwork } from '../../utils';
import { IDex } from '../../dex/idex';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { AllVaultConfigs, VaultConfig } from './types';
import {
  getLocalDeadlineAsFriendlyPlaceholder,
  SimpleExchange,
} from '../simple-exchange';
import { CapConfig } from './config';
import { CapPools } from './cap-pools';
import { BI_POWS } from '../../bigint-constants';
import { Interface } from '@ethersproject/abi';
import CapTokenAbi from './abis/CapToken.json';

export class Cap extends SimpleExchange implements IDex<VaultConfig> {
  public eventPools: CapPools;
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(CapConfig);

  logger: Logger;
  configs: AllVaultConfigs;

  constructor(
    readonly network: Network,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    public capIface = new Interface(CapTokenAbi),
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(dexKey);
    this.configs = CapConfig[dexKey][network];
    this.eventPools = new CapPools(
      dexKey,
      network,
      dexHelper,
      this.logger,
      this.configs,
    );
  }

  // Initialize pricing is called once in the start of
  // pricing service. It is intended to setup the integration
  // for pricing requests. It is optional for a DEX to
  // implement this function
  async initializePricing(blockNumber: number) {
    await this.eventPools.updateOraclePrices(blockNumber);
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
    _side: SwapSide,
    _blockNumber: number,
  ): Promise<string[]> {
    const mint = this._detectMint(srcToken, destToken, _side);
    if (mint) {
      return [this._poolKey(mint)];
    }
    const burn = this._detectBurn(srcToken, destToken, _side);
    if (burn) {
      return [this._poolKey(burn)];
    }
    return [];
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
  ): Promise<null | ExchangePrices<VaultConfig>> {
    const mint = this._detectMint(srcToken, destToken, side);
    const burn = this._detectBurn(srcToken, destToken, side);
    const poolKey = this._poolKey(mint ?? burn);
    const excludePoolKey = limitPools && !limitPools.includes(poolKey);

    // TODO:
    // - account for fees
    // - account for decimals

    if (mint && !excludePoolKey) {
      const vaultConfig = this.configs[mint.vault.address.toLowerCase()];
      return [
        {
          unit: BI_POWS[18],
          prices: amounts.map(
            amount =>
              this.eventPools.getAmountOut(
                vaultConfig,
                { mint: true, asset: mint.asset.address, amount },
                blockNumber,
              ).amount,
          ),
          gasCost: 250_000,
          data: this.configs[mint.vault.address.toLowerCase()],
          poolAddresses: [mint.vault.address.toLowerCase()],
          poolIdentifiers: [poolKey],
          exchange: this.dexKey,
        },
      ];
    }

    if (burn && !excludePoolKey) {
      const vaultConfig = this.configs[burn.vault.address.toLowerCase()];
      return [
        {
          unit: BI_POWS[18],
          prices: amounts.map(
            amount =>
              this.eventPools.getAmountOut(
                vaultConfig,
                { mint: false, asset: burn.asset.address, amount },
                blockNumber,
              ).amount,
          ),
          gasCost: 240_000,
          data: this.configs[burn.vault.address.toLowerCase()],
          poolAddresses: [burn.vault.address.toLowerCase()],
          poolIdentifiers: [poolKey],
          exchange: this.dexKey,
        },
      ];
    }

    // TODO: complete me!
    return null;
  }

  // Returns estimated gas cost of calldata for this DEX in multiSwap
  getCalldataGasCost(poolPrices: PoolPrices<VaultConfig>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  // Encode params required by the exchange adapter
  // V5: Used for multiSwap, buy & megaSwap
  // V6: Not used, can be left blank
  // Hint: abiCoder.encodeParameter() could be useful
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: VaultConfig,
    side: SwapSide,
  ): AdapterExchangeParam {
    return {
      targetExchange: data.vault.address,
      payload: '0x',
      networkFee: '0',
    };
  }

  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: VaultConfig,
    side: SwapSide,
  ): DexExchangeParam {
    const mint = this._detectMint(srcToken, destToken, side);
    if (mint) {
      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: true,
        exchangeData: this.capIface.encodeFunctionData('mint', [
          mint.asset.address,
          srcAmount,
          destAmount,
          recipient,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ]),
        targetExchange: mint.vault.address,
      };
    }

    const burn = this._detectBurn(srcToken, destToken, side);
    if (burn) {
      return {
        needWrapNative: this.needWrapNative,
        dexFuncHasRecipient: true,
        exchangeData: this.capIface.encodeFunctionData('burn', [
          burn.asset.address,
          srcAmount,
          destAmount,
          recipient,
          getLocalDeadlineAsFriendlyPlaceholder(),
        ]),
        targetExchange: burn.vault.address,
      };
    }

    throw new Error(`Vault address not found for ${srcToken} and ${destToken}`);
  }

  // This is called once before getTopPoolsForToken is
  // called for multiple tokens. This can be helpful to
  // update common state required for calculating
  // getTopPoolsForToken. It is optional for a DEX
  // to implement this
  async updatePoolState(): Promise<void> {}

  // Returns list of top pools based on liquidity. Max
  // limit number pools should be returned.
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    const _tokenAddress = tokenAddress.toLowerCase();

    for (const config of Object.values(this.configs)) {
      const vault = config.vault;
      const assets = Object.values(config.assets);

      if (_tokenAddress === vault.address.toLowerCase()) {
        return [
          {
            exchange: this.dexKey,
            address: vault.address,
            connectorTokens: assets.map(asset => ({
              address: asset.address,
              decimals: asset.decimals,
            })),
            liquidityUSD: UNLIMITED_USD_LIQUIDITY,
          },
        ];
      }

      for (const asset of assets) {
        if (_tokenAddress === asset.address.toLowerCase()) {
          return [
            {
              exchange: this.dexKey,
              address: asset.address,
              connectorTokens: [
                {
                  address: vault.address,
                  decimals: vault.decimals,
                },
              ],
              liquidityUSD: UNLIMITED_USD_LIQUIDITY,
            },
          ];
        }
      }
    }

    return [];
  }

  // This is optional function in case if your implementation has acquired any resources
  // you need to release for graceful shutdown. For example, it may be any interval timer
  releaseResources(): AsyncOrSync<void> {
    // TODO: complete me!
  }

  private _detectMint(
    srcToken: Token | string,
    destToken: Token | string,
    side: SwapSide,
  ): null | { vault: Token; asset: Token } {
    if (side === SwapSide.SELL) {
      return this._detectBurn(destToken, srcToken, SwapSide.BUY);
    }

    const _srcAddress = (
      typeof srcToken === 'string' ? srcToken : srcToken.address
    ).toLowerCase();
    const _destAddress = (
      typeof destToken === 'string' ? destToken : destToken.address
    ).toLowerCase();

    for (const config of Object.values(this.configs)) {
      const vault = config.vault;
      const assets = Object.values(config.assets);
      const srcAsset = assets.find(
        a => a.address.toLowerCase() === _srcAddress,
      );

      if (_destAddress === vault.address.toLowerCase() && srcAsset) {
        return { vault: vault, asset: srcAsset };
      }
    }

    return null;
  }

  private _detectBurn(
    srcToken: Token | string,
    destToken: Token | string,
    side: SwapSide,
  ): null | { vault: Token; asset: Token } {
    if (side === SwapSide.SELL) {
      return this._detectMint(destToken, srcToken, SwapSide.BUY);
    }

    const _srcAddress = (
      typeof srcToken === 'string' ? srcToken : srcToken.address
    ).toLowerCase();
    const _destAddress = (
      typeof destToken === 'string' ? destToken : destToken.address
    ).toLowerCase();
    // TODO: use side
    for (const config of Object.values(this.configs)) {
      const vault = config.vault;
      const assets = Object.values(config.assets);
      const destAsset = assets.find(
        a => a.address.toLowerCase() === _destAddress,
      );

      if (_srcAddress === vault.address.toLowerCase() && destAsset) {
        return { vault: vault, asset: destAsset };
      }
    }
    return null;
  }

  private _poolKey(params: { vault: Token } | null): string {
    return `${this.dexKey}_${params?.vault.address.toLowerCase() ?? ''}`;
  }
}
