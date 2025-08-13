import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Contract } from 'web3-eth-contract';
import { Address, Log, Logger } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { getBigIntPow } from '../../utils';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { PoolState, PoolConfig } from './types';
import PsmABI from '../../abi/maker-psm/psm.json';
import VatABI from '../../abi/maker-psm/vat.json';

const vatInterface = new Interface(VatABI);
const psmInterface = new Interface(PsmABI);

const bigIntify = (b: any) => BigInt(b.toString());

async function getOnChainState(
  multiContract: Contract,
  poolConfigs: PoolConfig[],
  vatAddress: Address,
  blockNumber: number | 'latest',
): Promise<PoolState[]> {
  const callData = poolConfigs
    .map(c => [
      {
        target: c.psmAddress,
        callData: psmInterface.encodeFunctionData('tin', []),
      },
      {
        target: c.psmAddress,
        callData: psmInterface.encodeFunctionData('tout', []),
      },
      {
        target: vatAddress,
        callData: vatInterface.encodeFunctionData('ilks', [c.identifier]),
      },
    ])
    .flat();

  const res = await multiContract.methods
    .aggregate(callData)
    .call({}, blockNumber);

  let i = 0;
  return poolConfigs.map(c => {
    const tin = bigIntify(
      psmInterface.decodeFunctionResult('tin', res.returnData[i++])[0],
    );
    const tout = bigIntify(
      psmInterface.decodeFunctionResult('tout', res.returnData[i++])[0],
    );
    const ilks = vatInterface.decodeFunctionResult('ilks', res.returnData[i++]);
    const Art = bigIntify(ilks.Art);
    const line = bigIntify(ilks.line);
    const rate = bigIntify(ilks.rate);
    return {
      tin,
      tout,
      Art,
      line,
      rate,
    };
  });
}

export class MakerPsmEventPool extends StatefulEventSubscriber<PoolState> {
  handlers: {
    [event: string]: (event: any, pool: PoolState, log: Log) => PoolState;
  } = {};

  logDecoder: (log: Log) => any;

  to18ConversionFactor: bigint;
  bytes32Tout =
    '0x746f757400000000000000000000000000000000000000000000000000000000'; // bytes32('tout')
  bytes32Tin =
    '0x74696e0000000000000000000000000000000000000000000000000000000000'; // bytes32('tin')

  constructor(
    parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public poolConfig: PoolConfig,
    protected vatAddress: Address,
  ) {
    super(parentName, poolConfig.identifier, dexHelper, logger);

    this.logDecoder = (log: Log) => psmInterface.parseLog(log);
    this.addressesSubscribed = [poolConfig.psmAddress];
    this.to18ConversionFactor = getBigIntPow(18 - poolConfig.gem.decimals);

    // Add handlers
    this.handlers['File'] = this.handleFile.bind(this);
    this.handlers['SellGem'] = this.handleSellGem.bind(this);
    this.handlers['BuyGem'] = this.handleBuyGem.bind(this);
  }

  handleFile(event: any, pool: PoolState, log: Log): PoolState {
    if (event.args.what === this.bytes32Tin) {
      pool.tin = bigIntify(event.args.data);
    } else if (event.args.what === this.bytes32Tout) {
      pool.tout = bigIntify(event.args.data);
    }
    return pool;
  }

  handleSellGem(event: any, pool: PoolState, log: Log): PoolState {
    pool.Art += bigIntify(event.args.value) * this.to18ConversionFactor;
    return pool;
  }

  handleBuyGem(event: any, pool: PoolState, log: Log): PoolState {
    pool.Art -= bigIntify(event.args.value) * this.to18ConversionFactor;
    return pool;
  }

  getIdentifier(): string {
    return `${this.parentName}_${this.poolConfig.psmAddress}`.toLowerCase();
  }

  /**
   * The function is called every time any of the subscribed
   * addresses release log. The function accepts the current
   * state, updates the state according to the log, and returns
   * the updated state.
   * @param state - Current state of event subscriber
   * @param log - Log released by one of the subscribed addresses
   * @returns Updates state of the event subscriber after the log
   */
  protected processLog(
    state: DeepReadonly<PoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<PoolState> | null {
    try {
      const event = this.logDecoder(log);
      if (event.name in this.handlers) {
        return this.handlers[event.name](event, state, log);
      }
      return state;
    } catch (e) {
      this.logger.error(
        `Error_${this.parentName}_processLog could not parse the log with topic ${log.topics}:`,
        e,
      );
      return null;
    }
  }

  /**
   * The function generates state using on-chain calls. This
   * function is called to regenerate state if the event based
   * system fails to fetch events and the local state is no
   * more correct.
   * @param blockNumber - Blocknumber for which the state should
   * should be generated
   * @returns state of the event subscriber at blocknumber
   */
  async generateState(blockNumber: number): Promise<Readonly<PoolState>> {
    return (
      await getOnChainState(
        this.dexHelper.multiContract,
        [this.poolConfig],
        this.vatAddress,
        blockNumber,
      )
    )[0];
  }
}
