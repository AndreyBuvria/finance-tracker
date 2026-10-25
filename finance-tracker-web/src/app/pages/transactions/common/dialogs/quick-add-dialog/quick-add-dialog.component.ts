import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { parseIsoDate } from '@common/date/iso-date.utils';
import { amountInputValidator, formatAmountInput } from '@common/formatting/amount-input.utils';
import { trimmedMaxLengthValidator } from '@common/forms/trimmed-max-length.utils';
import { hasStatus } from '@common/http/problem-details.utils';
import { ClockService } from '@common/time/clock.service';
import { MerchantSuggestion, Transaction } from '@common/transactions/transaction.model';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { filter, finalize, startWith, switchMap } from 'rxjs';
import {
  applyQuickAddType,
  categoryFits,
  differentAccountsValidator,
  positiveAmountValidator,
} from '../../../utils/quick-add-form.utils';
import { applyServerErrors } from '../../../utils/server-errors.utils';
import { MERCHANT_MAX_LENGTH, NOTE_MAX_LENGTH } from '../../constants/transaction-limits.constants';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
} from '../../constants/transaction-type.constants';
import { FormError } from '../../models/form-error.model';
import { LastAccountService } from '../../storage/last-account.service';
import { CategoryGridComponent } from './category-grid/category-grid.component';
import { DateFieldComponent } from './date-field/date-field.component';
import { QuickAddLoadStateComponent } from './load-state/quick-add-load-state.component';
import { MerchantFieldComponent } from './merchant-field/merchant-field.component';
import { QuickAddDialogData, QuickAddDialogResult } from './quick-add-dialog.model';
import { QuickAddListsService } from './quick-add-lists.service';
import { QuickAddPersistenceService } from './quick-add-persistence.service';
import { TransferAccountsComponent } from './transfer-accounts/transfer-accounts.component';

/**
 * Quick add (FEATURES.md F3/F4, DESIGN.md "Quick add dialog"): Expense / Income / Transfer, the
 * amount focused first, a category grid, merchant with suggestions, date chips and the last used
 * account. "Save" closes; "Save and add another" keeps type, date and account. The same dialog edits
 * a transaction ("Edit transaction", with Note and Delete). Saves through the API itself
 * (`QuickAddPersistenceService`); Save stays disabled until the accounts and categories are loaded.
 */
@Component({
  selector: 'app-quick-add-dialog',
  imports: [
    CategoryGridComponent,
    DateFieldComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MerchantFieldComponent,
    QuickAddLoadStateComponent,
    ReactiveFormsModule,
    TransferAccountsComponent,
  ],
  providers: [QuickAddListsService],
  templateUrl: './quick-add-dialog.component.html',
  styleUrl: './quick-add-dialog.component.scss',
})
export class QuickAddDialogComponent {
  private readonly data = inject<QuickAddDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef =
    inject<MatDialogRef<QuickAddDialogComponent, QuickAddDialogResult>>(MatDialogRef);
  private readonly persistence = inject(QuickAddPersistenceService);
  private readonly lastAccount = inject(LastAccountService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Each transaction added (Quick add only), also with "Save and add another". */
  readonly added = output<Transaction>();

  protected readonly types = TRANSACTION_TYPES;
  protected readonly typeLabels = TRANSACTION_TYPE_LABELS;
  protected readonly typeEnum = TransactionTypeEnum;
  protected readonly noteMaxLength = NOTE_MAX_LENGTH;

  /** The transaction being edited; null for Quick add. */
  readonly editing = this.data?.transaction ?? null;
  /** Europe/Warsaw today (PLAN.md §6 "Dates"). */
  readonly today = inject(ClockService).businessToday();

  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    type: [this.editing?.type ?? TransactionTypeEnum.Expense],
    amount: [
      this.editing ? formatAmountInput(this.editing.amount) : '',
      [positiveAmountValidator, amountInputValidator],
    ],
    categoryId: [this.editing?.category?.id ?? '', Validators.required],
    merchant: [this.editing?.merchant ?? '', trimmedMaxLengthValidator(MERCHANT_MAX_LENGTH)],
    note: [this.editing?.note ?? '', trimmedMaxLengthValidator(NOTE_MAX_LENGTH)],
    date: this.fb.control<Date | null>(
      this.editing ? parseIsoDate(this.editing.date) : this.today,
      Validators.required,
    ),
    accountId: [
      this.editing?.transfer ? '' : (this.editing?.account.id ?? ''),
      Validators.required,
    ],
    fromAccountId: [this.editing?.transfer?.fromAccount.id ?? '', Validators.required],
    toAccountId: [
      this.editing?.transfer?.toAccount.id ?? '',
      [Validators.required, differentAccountsValidator],
    ],
  });

  readonly type = toSignal(
    this.form.controls.type.valueChanges.pipe(startWith(this.form.controls.type.value)),
    { requireSync: true },
  );
  readonly isTransfer = computed(() => this.type() === TransactionTypeEnum.Transfer);
  /** The separate Note is part of the full edit form and of transfers (FEATURES.md F3/F4). */
  readonly showNote = computed(() => this.isTransfer() || this.editing !== null);

  readonly submitting = signal(false);
  readonly deleting = signal(false);
  readonly busy = computed(() => this.submitting() || this.deleting());
  /** A form-level error: an API message without a field, or `generic`. */
  readonly error = signal<FormError | null>(null);

  /** Accounts and categories, with their loading state. */
  readonly lists = inject(QuickAddListsService);
  readonly loading = this.lists.loading;
  readonly loadFailed = this.lists.loadFailed;

  /** The lists the form needs are there. */
  readonly ready = computed(() => !this.loading() && !this.loadFailed());
  /** Save waits for the lists the form needs. */
  readonly saveDisabled = computed(() => this.busy() || !this.ready());

  constructor() {
    this.lists.connect(this.type);
    this.applyType(this.form.controls.type.value);
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((type) => this.applyType(type));
    this.form.controls.fromAccountId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.toAccountId.updateValueAndValidity());

    // Quick add: the last used account once the accounts are known (FEATURES.md F3).
    effect(() => {
      const accounts = this.lists.accounts;
      if (this.editing || !accounts.hasValue()) {
        return;
      }
      const ids = accounts.value().items.map((account) => account.id);
      untracked(() => {
        const c = this.form.controls;
        const account = this.lastAccount.pick(ids);
        if (!c.accountId.value) {
          c.accountId.setValue(account);
        }
        if (!c.fromAccountId.value) {
          c.fromAccountId.setValue(account);
        }
      });
    });

    this.focusAmount();
  }

  /** Pre-selects the merchant's last category unless the user picked one (FEATURES.md F3). */
  useMerchant(suggestion: MerchantSuggestion): void {
    const control = this.form.controls.categoryId;
    const category = suggestion.lastCategory;
    if (category && !control.dirty && !control.value && categoryFits(this.type(), category.type)) {
      control.setValue(category.id);
    }
  }

  /** Loads again whatever failed. */
  retryLoad(): void {
    this.lists.retry();
  }

  submit(addAnother = false): void {
    if (this.saveDisabled()) {
      return;
    }
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.persistence
      .save(value, this.editing)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (transaction) => {
          if (this.editing) {
            this.dialogRef.close({ status: 'updated', transaction });
            return;
          }
          this.lastAccount.set(this.isTransfer() ? value.fromAccountId : value.accountId);
          this.added.emit(transaction);
          if (addAnother) {
            this.startAnother();
          } else {
            this.dialogRef.close();
          }
        },
        error: (error: unknown) => this.handleError(error),
      });
  }

  /** Delete with confirmation (edit only). */
  delete(): void {
    const transaction = this.editing;
    if (!transaction || this.busy()) {
      return;
    }
    this.persistence
      .confirmDelete(transaction)
      .pipe(
        filter((confirmed) => confirmed),
        switchMap(() => {
          this.deleting.set(true);
          return this.persistence
            .delete(transaction)
            .pipe(finalize(() => this.deleting.set(false)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => this.dialogRef.close({ status: 'deleted', transaction }),
        error: (error: unknown) =>
          hasStatus(error, 404)
            ? this.dialogRef.close({ status: 'notFound' })
            : this.error.set('generic'),
      });
  }

  /**
   * "Save and add another" (FEATURES.md F3): keeps type, date and account; clears amount and
   * merchant, and the category, so a past merchant's category can be pre-selected again.
   */
  private startAnother(): void {
    const c = this.form.controls;
    c.amount.reset('');
    c.merchant.reset('');
    c.categoryId.reset('');
    c.note.reset('');
    this.focusAmount();
  }

  /** Shows the fields of the type; switching expense ↔ income drops a category that doesn't fit. */
  private applyType(type: TransactionTypeEnum): void {
    const c = this.form.controls;
    applyQuickAddType(
      c,
      type,
      this.showNote(),
      this.findCategory(c.categoryId.value)?.type ?? null,
    );
  }

  private findCategory(id: string) {
    if (!id) {
      return null;
    }
    if (this.editing?.category?.id === id) {
      return this.editing.category;
    }
    const all = this.lists.allCategories;
    return (all.hasValue() ? all.value() : []).find((category) => category.id === id);
  }

  private handleError(error: unknown): void {
    if (this.editing && hasStatus(error, 404)) {
      this.dialogRef.close({ status: 'notFound' });
      return;
    }
    const formError = applyServerErrors(this.form.controls, error);
    if (formError) {
      this.error.set(formError);
      return;
    }
    this.focusFirstInvalid();
  }

  private focusAmount(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>('input.amount-input')?.focus(),
      { injector: this.injector },
    );
  }

  /**
   * Focuses the first invalid field once the error state is rendered (after a server error the
   * `ng-invalid` classes only appear on the next render).
   */
  private focusFirstInvalid(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            'input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid, ' +
              'app-category-grid.invalid button',
          )
          ?.focus(),
      { injector: this.injector },
    );
  }
}
