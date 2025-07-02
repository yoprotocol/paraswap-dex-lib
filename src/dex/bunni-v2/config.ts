import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';
import { Interface } from '@ethersproject/abi';

import BunniHookV1Abi from '../../abi/bunni-v2/BunniHook/BunniHookV1.abi.json';
import BunniHookV2Abi from '../../abi/bunni-v2/BunniHook/BunniHookV2.abi.json';
import BunniHookV3Abi from '../../abi/bunni-v2/BunniHook/BunniHookV3.abi.json';
import BunniHookV4Abi from '../../abi/bunni-v2/BunniHook/BunniHookV4.abi.json';

const BunniHookV1Interface = new Interface(BunniHookV1Abi);
const BunniHookV2Interface = new Interface(BunniHookV2Abi);
// const BunniHookV3Interface = new Interface();
const BunniHookV4Interface = new Interface(BunniHookV4Abi);
// const BunniHookV5Interface = new Interface();

export const BunniV2Config: DexConfigMap<DexParams> = {
  BunniV2: {
    [Network.MAINNET]: {
      poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
      quoter: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
      router: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
      bunniHubs: [
        '0x000000DCeb71f3107909b1b748424349bfde5493', // v1.0
        '0x000000000049C7bcBCa294E63567b4D21EB765f1', // v1.2.1
      ],
      bunniHooks: [
        {
          address: '0x0010d0D5dB05933Fa0D9F7038D365E1541a41888',
          deploymentBlock: 21747554n,
          interface: BunniHookV1Interface,
        }, // v1.0
        {
          address: '0x0000fE59823933AC763611a69c88F91d45F81888',
          deploymentBlock: 21841283n,
          interface: BunniHookV2Interface,
        }, // v1.1.1
        {
          address: '0x000052423c1dB6B7ff8641b85A7eEfc7B2791888',
          deploymentBlock: 22684594n,
          interface: BunniHookV4Interface,
        }, // v1.2.1
      ],
      floodPlain: '0x0000000000f0D1C07cA806aB9154199E2E627Ea6',
      subgraphURL: '5NFnHtgpdzB3JhVyiKQgnV9dZsewqJtX5HZfAT9Kg66r',
      K: 7200n,
    },
    [Network.ARBITRUM]: {
      poolManager: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32',
      quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
      router: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3',
      bunniHubs: [
        '0x000000DCeb71f3107909b1b748424349bfde5493', // v1.0
        '0x000000000049C7bcBCa294E63567b4D21EB765f1', // v1.2.1
      ],
      bunniHooks: [
        {
          address: '0x0010d0D5dB05933Fa0D9F7038D365E1541a41888',
          deploymentBlock: 301323951n,
          interface: BunniHookV1Interface,
        }, // v1.0
        {
          address: '0x0000fE59823933AC763611a69c88F91d45F81888',
          deploymentBlock: 305809312n,
          interface: BunniHookV2Interface,
        }, // v1.1.1
        {
          address: '0x0000EB22c45bDB564F985acE0B4d05a64fa71888',
          deploymentBlock: 351214280n,
          interface: BunniHookV4Interface,
        }, // v1.2.1
      ],
      floodPlain: '0x0000000000f0D1C07cA806aB9154199E2E627Ea6',
      subgraphURL: '96tZMr51QupqWYamom12Yki5AqCJEiHWbVUpzUpvu9oB',
      K: 345600n,
    },
    [Network.BASE]: {
      poolManager: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
      quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
      router: '0x6ff5693b99212da76ad316178a184ab56d299b43',
      bunniHubs: [
        '0x000000DCeb71f3107909b1b748424349bfde5493', // v1.0
        '0x000000000049C7bcBCa294E63567b4D21EB765f1', // v1.2.1
      ],
      bunniHooks: [
        {
          address: '0x0010d0D5dB05933Fa0D9F7038D365E1541a41888',
          deploymentBlock: 25786940n,
          interface: BunniHookV1Interface,
        }, // v1.0
        {
          address: '0x0000fE59823933AC763611a69c88F91d45F81888',
          deploymentBlock: 26352729n,
          interface: BunniHookV2Interface,
        }, // v1.1.1
        {
          address: '0x000052423c1dB6B7ff8641b85A7eEfc7B2791888',
          deploymentBlock: 31446454n,
          interface: BunniHookV4Interface,
        }, // v1.2.1
      ],
      floodPlain: '0x0000000000f0D1C07cA806aB9154199E2E627Ea6',
      subgraphURL: '3oawHiCt7L9wJTEY9DynwAEmoThy8bvRhuMZdaaAooqW',
      K: 43200n,
    },
  },
};

export const BunniHookVersions: Record<string, 'v0' | 'v1' | 'v4'> = {
  ['0x0010d0D5dB05933Fa0D9F7038D365E1541a41888'.toLowerCase()]: 'v0',
  ['0x0000fE59823933AC763611a69c88F91d45F81888'.toLowerCase()]: 'v1',
  ['0x000052423c1dB6B7ff8641b85A7eEfc7B2791888'.toLowerCase()]: 'v4',
  ['0x0000EB22c45bDB564F985acE0B4d05a64fa71888'.toLowerCase()]: 'v4',
};
