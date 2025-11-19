import { SimpleExchange } from './simple-exchange';
import { IDexHelper } from '../dex-helper';
import { Utils } from '../utils';
import { Logger } from '../types';
import { IDexWithBlacklist, IDexWithRestriction } from './idex';

const ERRORS_CACHE_KEY = 'errors';
const RESTRICT_CHECK_INTERVAL_MS = 1000 * 60 * 3; // 3 min
const RESTRICT_COUNT_THRESHOLD = 3;
const RESTRICT_TTL_S = 10 * 60; // 10 min;

const RESTRICTED_CACHE_VALUE = 'restricted';
const BLACKLISTED_CACHE_VALUE = 'blacklisted';

const DEFAULT_BLACKLISTED_TTL_S = 180 * 60; // 3 hours
const DEFAULT_ENABLE_DEX_RESTRICTION = false;

type RestrictData = {
  count: number;
  addedDatetimeMs: number;
} | null;

type DexRestrictionOptions = {
  blacklistedTTL?: number;
  enableDexRestriction?: boolean;
  restrictCheckIntervalMs?: number;
  restrictCountThreshold?: number;
  restrictTtlS?: number;
};

export class SimpleExchangeWithRestrictions
  extends SimpleExchange
  implements IDexWithRestriction, IDexWithBlacklist
{
  protected readonly blacklistedTTL: number;
  protected readonly enableDexRestriction: boolean;

  protected restrictCheckIntervalMs: number;
  protected restrictCountThreshold: number;
  protected restrictTtlS: number;

  protected logger: Logger;

  constructor(
    protected readonly dexHelper: IDexHelper,
    public dexKey: string,
    options: DexRestrictionOptions = {},
  ) {
    super(dexHelper, dexKey);
    this.logger = dexHelper.getLogger(`${dexKey}-${this.network}`);

    this.blacklistedTTL = options.blacklistedTTL ?? DEFAULT_BLACKLISTED_TTL_S;
    this.enableDexRestriction =
      options.enableDexRestriction ?? DEFAULT_ENABLE_DEX_RESTRICTION;

    this.restrictCheckIntervalMs =
      options.restrictCheckIntervalMs ?? RESTRICT_CHECK_INTERVAL_MS;
    this.restrictCountThreshold =
      options.restrictCountThreshold ?? RESTRICT_COUNT_THRESHOLD;
    this.restrictTtlS = options.restrictTtlS ?? RESTRICT_TTL_S;
  }

  public hasDexRestriction(): this is IDexWithRestriction {
    return this.enableDexRestriction;
  }

  public hasBlacklist(): this is IDexWithBlacklist {
    return true; // make configurable if makes sense
  }

  public async isBlacklisted(address: string) {
    const cached = await this.dexHelper.cache.rawget(
      this.getBlacklistedCacheKey(address),
    );

    return Boolean(cached);
  }

  protected setBlacklist(addresses: string[]) {
    this.logger.info(`Blacklisting addresses: ${addresses.length}`);
    return this.dexHelper.cache.msetex(
      ...addresses
        .map(address => [
          this.getBlacklistedCacheKey(address),
          BLACKLISTED_CACHE_VALUE,
          this.blacklistedTTL,
        ])
        .flat(),
    );
  }

  public async addBlacklistedAddress(
    address: string,
    ttl = this.blacklistedTTL,
  ) {
    return this.dexHelper.cache
      .rawset(
        this.getBlacklistedCacheKey(address),
        BLACKLISTED_CACHE_VALUE,
        ttl,
      )
      .then(() => true);
  }

  public getBlacklistedCacheKey(address: string): string {
    return `${this.network}_${
      this.dexKey
    }_blacklisted_${address.toLowerCase()}`;
  }

  public getRestrictedCacheKey(): string {
    return `${this.network}_${this.dexKey}_restricted`;
  }

  async isRestricted(): Promise<boolean> {
    const cached = await this.dexHelper.cache.rawget(
      this.getRestrictedCacheKey(),
    );

    return Boolean(cached);
  }

  protected async restrict() {
    const errorsDataRaw = await this.dexHelper.cache.get(
      this.dexKey,
      this.network,
      ERRORS_CACHE_KEY,
    );

    const errorsData: RestrictData = Utils.Parse(errorsDataRaw);
    const ERRORS_TTL_S = Math.floor(this.restrictCheckIntervalMs / 1000);

    if (
      !errorsData ||
      errorsData?.addedDatetimeMs + this.restrictCheckIntervalMs < Date.now()
    ) {
      this.logger.warn(
        `${this.dexKey}-${this.network}: First encounter of error OR error occurred outside of threshold, setting up counter`,
      );
      const data: RestrictData = {
        count: 1,
        addedDatetimeMs: Date.now(),
      };
      await this.dexHelper.cache.setex(
        this.dexKey,
        this.network,
        ERRORS_CACHE_KEY,
        ERRORS_TTL_S,
        Utils.Serialize(data),
      );
      return;
    } else {
      if (errorsData.count + 1 >= this.restrictCountThreshold) {
        this.logger.warn(
          `${this.dexKey}-${this.network}: Restricting due to error count=${
            errorsData.count + 1
          } within ${this.restrictCheckIntervalMs / 1000 / 60} minutes`,
        );
        await this.dexHelper.cache.rawset(
          this.getRestrictedCacheKey(),
          RESTRICTED_CACHE_VALUE,
          this.restrictTtlS,
        );
      } else {
        this.logger.warn(
          `${this.dexKey}-${this.network}: Error count increased`,
        );
        const data: RestrictData = {
          count: errorsData.count + 1,
          addedDatetimeMs: errorsData.addedDatetimeMs,
        };
        await this.dexHelper.cache.setex(
          this.dexKey,
          this.network,
          ERRORS_CACHE_KEY,
          ERRORS_TTL_S,
          Utils.Serialize(data),
        );
      }
    }
  }
}
