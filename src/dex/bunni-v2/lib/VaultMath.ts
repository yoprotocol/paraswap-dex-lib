import { NULL_ADDRESS } from '../../../constants';

export function getReservesInUnderlying(
  reserveAmount: bigint,
  vault: string,
): bigint {
  if (vault !== NULL_ADDRESS) {
    throw new Error(`Rehypothecation for vault ${vault} not yet supported`);
  }

  // TODO when there is a vault we need to return the ERC4626::previewRedeem() value
  return vault === NULL_ADDRESS ? reserveAmount : reserveAmount;
}
