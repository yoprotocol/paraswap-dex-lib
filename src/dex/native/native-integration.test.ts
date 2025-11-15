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
        minimum_in_base: 0.01,
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
    expect(pools.length).toBeGreaterThan(0);
  });

  it('getPoolIdentifiers BUY', async () => {
    const pools = await native.getPoolIdentifiers(weth, usdc, SwapSide.BUY, 0);
    expect(pools.length).toBeGreaterThan(0);
  });

  it('getPricesVolume SELL', async () => {
    const amounts = [
      0n,
      1n * BI_POWS[weth.decimals],
      2n * BI_POWS[weth.decimals],
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
  });

  it('getPricesVolume BUY', async () => {
    const unit = BI_POWS[usdc.decimals];
    const amounts = [0n, 40n * unit, 80n * unit];
    const poolPrices = await native.getPricesVolume(
      weth,
      usdc,
      amounts,
      SwapSide.BUY,
      0,
    );
    expect(poolPrices).not.toBeNull();
    expect(poolPrices![0].prices.length).toEqual(amounts.length);
  });
});
