import { Pipe, PipeTransform } from '@angular/core';
import { MoneyKind } from '../formatting/money.model';
import { formatMoney } from '../formatting/money.utils';

/**
 * `{{ 1234.56 | money }}` → "1 234,56 zł"; `{{ 24 | money: 'expense' }}` → "−24,00 zł".
 * Color is never the only signal: the sign comes from the kind, the color from the template.
 */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number | null | undefined, kind: MoneyKind = 'plain'): string {
    return amount == null ? '' : formatMoney(amount, kind);
  }
}
