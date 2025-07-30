import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network } from '../../constants';

export const FluidDexLiteConfig: DexConfigMap<DexParams> = {
  FluidDexLite: {
    [Network.MAINNET]: {
      dexLiteAddress: '0xbED7f3036e2EA43BDBEDC95f1eDd0bB336F8eb2f',
    },
  },
};
