import { DexConfigMap } from '../../types';
import { Network } from '../../constants';
import { DexParams } from './types';

export const UniswapV4PoolsList: Record<number, string[]> = {
  [Network.BASE]: [
    '0x96d4b53a38337a5733179751781178a2613306063c511b78cd02684739288c0a', // ETH <> USDC (fee 500)
    '0xf13203ddbf2c9816a79b656a1a952521702715d92fea465b84ae2ed6e94a7f22', // USDC <> USDT (fee 7)
    '0x12d76c5c8ec8edffd3c143995b0aa43fe44a6d71eb9113796272909e54b8e078', // USDC <> cbBTC (fee 500)
    '0xd3020570106c58635ff7f549659c4c310409c9a5d698cb826842bc8a39e3ce81', // USDC <> USDT (fee 20)
    '0x7681c00520c26da8d8970c21a65461c726f274068eb08743debc1178e697044e', // USDC <> USDT (fee 5)
    '0x179492f1f9c7b2e2518a01eda215baab8adf0b02dd3a90fe68059c0cac5686f5', // USDC <> cbBTC (fee 3000)
    '0xcdcbb476543e5c703f7562009cb4e2a6c543dc09fe740abf8be0c01c31c82884', // GHO <> USDC (fee 100)
    '0x90305e6043c0879a665262237e4643df9b48c1ba51aec5abe82c5d98f0da54bd', // USDC <> USDT (fee 11)
    // '0xd6ba4bdd2ebdde6b9beab0085f42f08bf69a80e515e399cf93716505c738169b', // WETH <> QE (fee 8388608)
    '0xe070797535b13431808f8fc81fdbe7b41362960ed0b55bc2b6117c49c51b7eb9', // ETH <> USDC (fee 3000)
    '0xaf15cd1f9c3874bbcfddfc2b544544612c9de8c8bae28ba21c129c6b286c1e19', // ETH <> USDC (fee 90)
    '0x438c7f6a3b32fdcf043ad3285dbc128486df894a1f3d448b1da38b2f2a1a43cb', // USDC <> KTA (fee 10000)
    // '0xbfadeecc6ae215a0ff707ac2dcb01055c89a8ff003046e883bc5e554ee7465fd', // WETH <> BaseShake (fee 30000)
    // '0x9cda3a1ca4814877cfc50f17cb3f428dd553a53bdb5836c6f181ff24574e4320', // WETH <> RETAKE (fee 8388608)
    // '0xa18262d729e388b0a67aa65c0dd2a096482b3a27058be5547a3235d053dd90b4', // GHO <> USDC (fee 500)
    '0x322d9aef3cf895da9e35b95b6c6e8f3c5e2a90b6d447a8bbb1ff2616b608a4d0', // USD₮0 <> USDC (fee 100)
    // '0x071526b476f0c45aaebdb6805b96405b8d29c1a47897ade98fbd410db0e3d4d8', // ETH <> USDC (fee 1500)
    // '0xaf2baac6d043d22f9ce14439228fbbf90c108a1dc809e32ad4e7e9e13fc941ac', // VIRTUAL <> USDC (fee 3000)
    '0xa0ab20a64f46b5676fe1542cb87b454e5104007689e0eef4212aa0cbe34933a1', // USDC <> USDbC (fee 10)
    // '0x5812d2e7e919cac3bfecec450911c8b2640234e5023864f2d31f3b6448f37687', // $COINS <> USDC (fee 3000)
    // '0x56a0cd87d81cc71184a4b2dd42964591bf351d0cfdded03f9bc75b7b559344ce', // USDC <> AERO (fee 10000)
    // '0x521bf7880c5e567eead09cd7fe67af2a60a21dfd79e8e49fd766e725b972aac2', // EURC <> USDC (fee 10)
    // '0x9fa78569c84e38a97d2d738329f21cd4fb21306768ca4e6bdd1e84e451ef6cdb', // WAI <> USDC (fee 10000)
    // '0xc58b1cb202c4650f52cbc51193783cb0c245419028bfe1bb00b786a9e0187372', // ETH <> USDC (fee 8388608)
    // '0x64db64264317af2fa1cc5a5deff9900dcf504d426580ab16dc59279b4ade4423', // EURC <> USDC (fee 500)
  ],
};

export const UniswapV4Config: DexConfigMap<DexParams> = {
  UniswapV4: {
    [Network.MAINNET]: {
      poolManager: '0x000000000004444c5dc75cB358380D2e3dE08A90',
      subgraphURL: 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G',
      quoter: '0x52f0e24d1c21c8a0cb1e5a5dd6198556bd9e1203',
      router: '0x66a9893cc07d91d95644aedd05d03f95e1dba8af',
      stateView: '0x7ffe42c4a5deea5b0fec41c94c136cf115597227',
      stateMulticall: '0xDCf1849caCdfF839f93682262a04915f83a9dB0e',
    },
    [Network.BASE]: {
      poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b',
      // subgraphURL: '7SP2t3PQd7LX19riCfwX5znhFdULjwRofQZtRZMJ8iW8',
      subgraphURL: 'HNCFA9TyBqpo5qpe6QreQABAA1kV8g46mhkCcicu6v2R',
      quoter: '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
      router: '0x6ff5693b99212da76ad316178a184ab56d299b43',
      stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
      skipPoolsWithUnconventionalFees: true,
      stateMulticall: '0x223c5fc295557f634979827728558424cf879d44',
    },
    [Network.OPTIMISM]: {
      poolManager: '0x9a13f98cb987694c9f086b1f5eb990eea8264ec3',
      subgraphURL: '6RBtsmGUYfeLeZsYyxyKSUiaA6WpuC69shMEQ1Cfuj9u',
      quoter: '0x1f3131a13296fb91c90870043742c3cdbff1a8d7',
      router: '0x851116d9223fabed8e56c0e6b8ad0c31d98b3507',
      stateView: '0xc18a3169788f4f75a170290584eca6395c75ecdb',
      stateMulticall: '0x4377Ead7BFC000711821934B72597bd700DD6E71',
    },
    [Network.ARBITRUM]: {
      poolManager: '0x360e68faccca8ca495c1b759fd9eee466db9fb32',
      subgraphURL: 'G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r',
      quoter: '0x3972c00f7ed4885e145823eb7c655375d275a1c5',
      router: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3',
      stateView: '0x76fd297e2d437cd7f76d50f01afe6160f86e9990',
      stateMulticall: '0x482cA248d91E08668efF568Ebb9805694D4DC396',
    },
    [Network.POLYGON]: {
      poolManager: '0x67366782805870060151383f4bbff9dab53e5cd6',
      subgraphURL: 'CwpebM66AH5uqS5sreKij8yEkkPcHvmyEs7EwFtdM5ND',
      quoter: '0xb3d5c3dfc3a7aebff71895a7191796bffc2c81b9',
      router: '0x1095692a6237d83c6a72f3f5efedb9a670c49223',
      stateView: '0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a',
      stateMulticall: '0xA97349A3e17463EA840867937605Bb1D80cd2EE3',
    },
    [Network.AVALANCHE]: {
      poolManager: '0x06380c0e0912312b5150364b9dc4542ba0dbbc85',
      subgraphURL: '49JxRo9FGxWpSf5Y5GKQPj5NUpX2HhpoZHpGzNEWQZjq',
      quoter: '0xbe40675bb704506a3c2ccfb762dcfd1e979845c2',
      router: '0x94b75331ae8d42c1b61065089b7d48fe14aa73b7',
      stateView: '0xc3c9e198c735a4b97e3e683f391ccbdd60b69286',
      stateMulticall: '0xf03feb5d6b26a68a773f1a77d7880fc5bdcc0581',
    },
    [Network.BSC]: {
      poolManager: '0x28e2ea090877bf75740558f6bfb36a5ffee9e9df',
      subgraphURL: '2qQpC8inZPZL4tYfRQPFGZhsE8mYzE67n5z3Yf5uuKMu',
      quoter: '0x9f75dd27d6664c475b90e105573e550ff69437b0',
      router: '0x1906c1d672b88cd1b9ac7593301ca990f94eae07',
      stateView: '0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4',
      stateMulticall: '0x3f5ef7d58ed47135d9911600c1dc1d0f8601b039',
    },
    [Network.UNICHAIN]: {
      poolManager: '0x1f98400000000000000000000000000000000004',
      subgraphURL: 'Bd8UnJU8jCRJKVjcW16GHM3FNdfwTojmWb3QwSAmv8Uc',
      quoter: '0x333e3c607b141b18ff6de9f258db6e77fe7491e0',
      router: '0xef740bf23acae26f6492b10de645d6b98dc8eaf3',
      stateView: '0x86e8631a016f9068c3f085faf484ee3f5fdee8f2',
      stateMulticall: '0xf03fEb5d6B26a68a773f1a77d7880fc5BDcc0581',
    },
  },
};
