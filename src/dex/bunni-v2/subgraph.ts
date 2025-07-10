import { Logger } from 'log4js';
import { SUBGRAPH_TIMEOUT } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { SubgraphPool } from './types';

interface SubgraphTopPool {
  id: string;
  bunniToken: {
    rawBalance0: string;
    rawBalance1: string;
    reserve0: string;
    reserve1: string;
    vault0: {
      id: string;
      decimals: string;
      pricePerVaultShare: string;
    } | null;
    vault1: {
      id: string;
      decimals: string;
      pricePerVaultShare: string;
    } | null;
  };
  currency0: {
    id: string;
    decimals: string;
    price: string;
  };
  currency1: {
    id: string;
    decimals: string;
    price: string;
  };
  priceCurrency0: string;
  priceCurrency1: string;
}

export async function queryPools(
  dexHelper: IDexHelper,
  logger: Logger,
  subgraphURL: string,
  blockNumber: number,
  skip: number,
  first: number,
  latestBlock: boolean = false,
): Promise<SubgraphPool[]> {
  if (!subgraphURL) return [];

  const query = `query ($skip: Int!, $first: Int!) {
    pools (
      skip: $skip
      first: $first
      ${latestBlock ? '' : `block: { number: ${blockNumber}} `}
    ) {
      id
      currency0 { id }
      currency1 { id }
      fee
      tickSpacing
      hooks
    }
  }`;

  const res = await dexHelper.httpRequest.querySubgraph<{
    data: {
      pools: SubgraphPool[];
    };
    errors?: { message: string }[];
  }>(
    subgraphURL,
    {
      query,
      variables: { skip, first },
    },
    { timeout: SUBGRAPH_TIMEOUT },
  );

  if (res.errors && res.errors.length) {
    if (res.errors[0].message.includes('missing block')) {
      logger.info(
        `Subgraph missing block ${blockNumber}, fallback to the latest block...`,
      );
      return queryPools(
        dexHelper,
        logger,
        subgraphURL,
        blockNumber,
        skip,
        first,
        true,
      );
    } else {
      throw new Error(res.errors[0].message);
    }
  }

  return res.data.pools || [];
}

export async function queryAvailablePoolsForToken(
  dexHelper: IDexHelper,
  subgraphURL: string,
  tokenAddress: string,
): Promise<SubgraphTopPool[]> {
  const query = `
    query (
      $skip: Int,
      $first: Int,
    ) {
      pools (
        skip: $skip,
        first: $first,
        where: {
          and: [
            {
              or: [
                { currency0_: { id: "${tokenAddress.toLowerCase()}" } },
                { currency1_: { id: "${tokenAddress.toLowerCase()}" } },
              ]
            },
            { bunniToken_: { totalSupply_gt: 0 } }
          ]
          
        }
      ) {
        id
        bunniToken {
          rawBalance0
          rawBalance1
          reserve0
          reserve1
          vault0 {
            id
            decimals
            pricePerVaultShare
          }
          vault1 {
            id
            decimals
            pricePerVaultShare
          }
        }
        currency0 {
          id
          decimals
          price
        }
        currency1 {
          id
          decimals
          price
        }
        priceCurrency0
        priceCurrency1
      }
    }
  `;

  const result = await dexHelper.httpRequest.querySubgraph<{
    data: { pools: SubgraphTopPool[] };
    errors?: { message: string }[];
  }>(
    subgraphURL,
    {
      query,
      variables: { skip: 0, first: 1000 },
    },
    { timeout: SUBGRAPH_TIMEOUT },
  );

  if (result.errors && result.errors.length) {
    throw new Error(result.errors[0].message);
  }

  const subgraphTopPools: SubgraphTopPool[] = result.data.pools;
  return subgraphTopPools;
}
