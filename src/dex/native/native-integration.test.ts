/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

process.env.API_KEY_NATIVE = process.env.API_KEY_NATIVE || 'test-native-key';

import { DummyDexHelper } from '../../dex-helper';
import { Network, SwapSide, CACHE_PREFIX } from '../../constants';
import { Native } from './native';
import { Tokens } from '../../../tests/constants-e2e';
import { BI_POWS } from '../../bigint-constants';

describe('Native Integration (unit cache based)', () => {
  const network = Network.MAINNET;
  const dexKey = 'Native';
  const dexHelper = new DummyDexHelper(network);
  const native = new Native(network, dexKey, dexHelper);
  const tokens = Tokens[network];

  const weth = tokens.WETH;
  const usdc = tokens.USDC;

  const orderbookCacheKey = `${CACHE_PREFIX}_${network}_${dexKey}_orderbook`;

  beforeAll(async () => {
    const mockOrderbook = [
      {
        base_symbol: 'WETH',
        base_address: weth.address.toLowerCase(),
        quote_symbol: 'USDC',
        quote_address: usdc.address.toLowerCase(),
        side: 'bid',
        minimum_in_base: 100000000000,
        levels: [
          [1, 3200],
          [5, 3195],
          [10, 3190],
        ],
      },
    ];

    await dexHelper.cache.rawset(
      orderbookCacheKey,
      JSON.stringify(mockOrderbook),
      60,
    );
  });

  it('getPoolIdentifiers SELL', async () => {
    const pools = await native.getPoolIdentifiers(weth, usdc, SwapSide.SELL, 0);
    const expectedPoolIdentifier = `native_${weth.address.toLowerCase()}_${usdc.address.toLowerCase()}_bid`;
    expect(pools.length).toBe(1);
    expect(pools[0]).toBe(expectedPoolIdentifier);
  });

  it('getPoolIdentifiers BUY', async () => {
    const pools = await native.getPoolIdentifiers(weth, usdc, SwapSide.BUY, 0);
    const expectedPoolIdentifier = `native_${weth.address.toLowerCase()}_${usdc.address.toLowerCase()}_bid`;
    expect(pools.length).toBe(1);
    expect(pools[0]).toBe(expectedPoolIdentifier);
  });

  it('getPricesVolume SELL', async () => {
    const amounts = [
      0n,
      1n * BI_POWS[weth.decimals],
      (15n * BI_POWS[weth.decimals]) / 10n,
      2n * BI_POWS[weth.decimals],
      20n * BI_POWS[weth.decimals],
    ];
    const poolPrices = await native.getPricesVolume(
      weth,
      usdc,
      amounts,
      SwapSide.SELL,
      0,
    );
    expect(poolPrices).not.toBeNull();
    expect(poolPrices![0].prices.length).toEqual(amounts.length);

    // Verify each price is correct based on orderbook levels:
    // levels: [[1, 3200], [5, 3195], [10, 3190]]
    // 0 WETH -> 0 USDC
    expect(poolPrices![0].prices[0]).toBe(0n);

    // 1 WETH -> 1 * 3200 = 3200 USDC = 3200 * 10^6
    expect(poolPrices![0].prices[1]).toBe(3200n * BI_POWS[usdc.decimals]);

    // 1.5 WETH -> 1 * 3200 + 0.5 * 3195 = 3200 + 1597.5 = 4797.5 USDC
    // = 4797.5 * 10^6 = 4797500000n
    expect(poolPrices![0].prices[2]).toBe(4797500000n);

    // 2 WETH -> 1 * 3200 + 1 * 3195 = 6395 USDC = 6395 * 10^6
    expect(poolPrices![0].prices[3]).toBe(6395n * BI_POWS[usdc.decimals]);

    // 20 WETH exceeds available depth (16 WETH total), expect 0 quote (unfillable)
    expect(poolPrices![0].prices[4]).toBe(0n);

    // Verify unit: 1 WETH -> 3200 USDC = 3200 * 10^6
    expect(poolPrices![0].unit).toBe(3200n * BI_POWS[usdc.decimals]);
  });

  it('getPricesVolume BUY', async () => {
    const unit = BI_POWS[usdc.decimals];
    const amounts = [0n, 4000n * unit, 40000n * unit, 60000n * unit];
    const poolPrices = await native.getPricesVolume(
      weth,
      usdc,
      amounts,
      SwapSide.BUY,
      0,
    );
    expect(poolPrices).not.toBeNull();
    expect(poolPrices![0].prices.length).toEqual(amounts.length);

    // For BUY side, prices array represents required WETH amounts
    expect(poolPrices![0].prices[0]).toBe(0n); // 0 USDC -> 0 WETH

    // 4,000 USDC consumes full first level (1 WETH @ 3200) plus part of second level
    const expectedBuyAmount1 = 1250391236306729264n; // ≈1.25039 WETH
    expect(poolPrices![0].prices[1]).toBe(expectedBuyAmount1);

    // 40,000 USDC consumes all first two levels and part of third level
    const expectedBuyAmount2 = 12528213166144200626n; // ≈12.5282 WETH
    expect(poolPrices![0].prices[2]).toBe(expectedBuyAmount2);

    // 60,000 USDC exceeds available quote depth (~51,075 USDC) -> expect 0
    expect(poolPrices![0].prices[3]).toBe(0n);

    // Verify unit: 1 USDC -> 1/3200 WETH = (1/3200) * 10^18 = 312500000000000n
    const expectedUnit = (BI_POWS[weth.decimals] * 1n) / 3200n;
    expect(poolPrices![0].unit).toBe(expectedUnit);
  });
});
