import { MoneyKind } from '@common/formatting/money.model';

/** An amount with the sign it is shown with. */
export interface SignedTotal {
  readonly amount: number;
  readonly kind: MoneyKind;
}
