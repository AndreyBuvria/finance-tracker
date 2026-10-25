import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { toIsoDate } from '@common/date/iso-date.utils';
import { parseAmountInput } from '@common/formatting/amount-input.utils';
import { TransactionRequest, TransferRequest } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { QuickAddFormValue } from '../common/models/quick-add-form.model';

/**
 * Error `amountNotPositive` ("Enter an amount greater than 0.") for a blank, zero or negative
 * amount. Unreadable text is left to `amountInputValidator`.
 */
export const positiveAmountValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const result = parseAmountInput(control.value ?? '');
  if (result.kind === 'empty' || (result.kind === 'ok' && result.value <= 0)) {
    return { amountNotPositive: true };
  }
  return null;
};

/**
 * Error `sameAccounts` ("Choose two different accounts.") on the "To" account when it equals the
 * sibling `fromAccountId`. Revalidate it when "From" changes.
 */
export const differentAccountsValidator: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const from = control.parent?.get('fromAccountId')?.value as string | undefined;
  return control.value && from && control.value === from ? { sameAccounts: true } : null;
};

/** Whether a category of this type may be used for this transaction type (PLAN.md §6). */
export function categoryFits(type: TransactionTypeEnum, categoryType: CategoryTypeEnum): boolean {
  return type === TransactionTypeEnum.Income || categoryType === CategoryTypeEnum.Expense;
}

/** Trimmed text, or null when blank. */
function optionalText(text: string): string | null {
  return text.trim() || null;
}

function amountOf(text: string): number {
  const result = parseAmountInput(text);
  return result.kind === 'ok' ? result.value : 0;
}

/** Body of POST/PUT /transactions from a valid expense or income form. */
export function toTransactionRequest(value: QuickAddFormValue): TransactionRequest {
  return {
    type:
      value.type === TransactionTypeEnum.Income
        ? TransactionTypeEnum.Income
        : TransactionTypeEnum.Expense,
    amount: amountOf(value.amount),
    date: value.date ? toIsoDate(value.date) : '',
    accountId: value.accountId,
    categoryId: value.categoryId,
    merchant: optionalText(value.merchant),
    note: optionalText(value.note),
  };
}

/** Body of POST/PUT /transfers from a valid transfer form. */
export function toTransferRequest(value: QuickAddFormValue): TransferRequest {
  return {
    fromAccountId: value.fromAccountId,
    toAccountId: value.toAccountId,
    amount: amountOf(value.amount),
    date: value.date ? toIsoDate(value.date) : '',
    note: optionalText(value.note),
  };
}

/** The Quick add controls whose availability depends on the transaction type. */
export interface QuickAddTypeControls {
  readonly categoryId: FormControl<string>;
  readonly merchant: FormControl<string>;
  readonly accountId: FormControl<string>;
  readonly fromAccountId: FormControl<string>;
  readonly toAccountId: FormControl<string>;
  readonly note: FormControl<string>;
}

/**
 * Enables the fields of `type` and disables the others (disabled fields aren't validated):
 * category, merchant and account for expense/income; from/to accounts for transfers. The note is
 * kept only where it is shown (`showNote`); a hidden one is cleared so it is never sent. A chosen
 * category that doesn't fit the type (`categoryType`, if known) is dropped.
 */
export function applyQuickAddType(
  controls: QuickAddTypeControls,
  type: TransactionTypeEnum,
  showNote: boolean,
  categoryType: CategoryTypeEnum | null,
): void {
  const transfer = type === TransactionTypeEnum.Transfer;
  const toggle = (control: FormControl<string>, enabled: boolean) =>
    enabled ? control.enable({ emitEvent: false }) : control.disable({ emitEvent: false });
  [controls.categoryId, controls.merchant, controls.accountId].forEach((c) => toggle(c, !transfer));
  [controls.fromAccountId, controls.toAccountId].forEach((c) => toggle(c, transfer));
  if (!showNote) {
    // getRawValue() includes disabled controls, so clear it too.
    controls.note.reset('', { emitEvent: false });
  }
  toggle(controls.note, showNote);
  if (categoryType && !categoryFits(type, categoryType)) {
    controls.categoryId.reset('');
  }
}
