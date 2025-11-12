import { SimpleExchange } from './simple-exchange';
import { IDexHelper } from '../dex-helper';

const BLACKLISTED_CACHE_VALUE = 'blacklisted';
const DEFAULT_BLACKLISTED_TTL = 180 * 60; // 3 hours

type DexRestrictionOptions = {
  blacklistedTTL?: number;
};

export class SimpleExchangeWithRestrictions extends SimpleExchange {
  protected readonly blacklistedTTL: number;

  constructor(
    protected readonly dexHelper: IDexHelper,
    public dexKey: string,
    options: DexRestrictionOptions = {},
  ) {
    super(dexHelper, dexKey);

    this.blacklistedTTL = options.blacklistedTTL ?? DEFAULT_BLACKLISTED_TTL;
  }

  public async isBlacklisted(address: string) {
    const cached = await this.dexHelper.cache.rawget(
      this.getBlacklistedCacheKey(address),
    );

    return cached === BLACKLISTED_CACHE_VALUE;
  }

  protected setBlacklist(addresses: string[]) {
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
    return `${this.dexHelper.config.data.network}_${
      this.dexKey
    }_blacklisted_${address.toLowerCase()}`;
  }
}
