import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountTypeEnum } from '@common/accounts/account-type.enum';
import { AccountRequest } from '@common/accounts/account.model';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { notBlankValidator } from '@common/forms/not-blank.utils';
import { trimmedMaxLengthValidator } from '@common/forms/trimmed-max-length.utils';
import { hasStatus, validationErrors } from '@common/http/problem-details.utils';
import { finalize } from 'rxjs';
import { ACCOUNT_NAME_MAX_LENGTH } from '@common/accounts/account-limits.constants';
import { ACCOUNT_TYPE_OPTIONS } from '../../constants/account-type.constants';
import {
  amountInputValidator,
  formatAmountInput,
  parseAmountInput,
} from '@common/formatting/amount-input.utils';
import { AccountDialogData, AccountDialogResult } from './account-dialog.model';

/** Fields the API can report validation errors on, matching the form control names. */
const SERVER_FIELDS = ['name', 'type', 'initialBalance'] as const;

/**
 * "Add account" / "Edit account" dialog (FEATURES.md F2, DESIGN.md "Accounts"). Saves through the
 * API itself and closes with the saved account.
 */
@Component({
  selector: 'app-account-dialog',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './account-dialog.component.html',
  styleUrl: './account-dialog.component.scss',
})
export class AccountDialogComponent {
  protected readonly typeOptions = ACCOUNT_TYPE_OPTIONS;
  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;

  private readonly data = inject<AccountDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef =
    inject<MatDialogRef<AccountDialogComponent, AccountDialogResult>>(MatDialogRef);
  private readonly api = inject(AccountsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** The account being edited; null when adding. */
  readonly account = this.data?.account ?? null;

  // Messages and their order match the API validators. No `maxlength` attribute: the browser
  // would silently cut pasted text instead of explaining.
  readonly form = inject(NonNullableFormBuilder).group({
    name: [
      this.account?.name ?? '',
      [notBlankValidator, trimmedMaxLengthValidator(ACCOUNT_NAME_MAX_LENGTH)],
    ],
    type: [this.account?.type ?? AccountTypeEnum.Card, Validators.required],
    currency: [{ value: this.account?.currency ?? 'PLN', disabled: true }],
    initialBalance: [
      this.account ? formatAmountInput(this.account.initialBalance) : '',
      amountInputValidator,
    ],
  });

  readonly submitting = signal(false);
  /**
   * A form-level error that doesn't belong to one field: an API message (e.g. about the currency)
   * or `generic` ("Something went wrong. Try again.").
   */
  readonly error = signal<{ message: string } | 'generic' | null>(null);

  submit(): void {
    if (this.submitting()) {
      return;
    }
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    const request = this.toRequest();
    this.submitting.set(true);
    const save$ = this.account
      ? this.api.update(this.account.id, request)
      : this.api.create(request);
    save$
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (account) => this.dialogRef.close({ status: 'saved', account }),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private toRequest(): AccountRequest {
    const { name, type, initialBalance } = this.form.getRawValue();
    const balance = parseAmountInput(initialBalance);
    return {
      name: name.trim(),
      type,
      currency: 'PLN',
      // A blank starting balance means 0 (the API default). PUT is a full replace, so always send it.
      initialBalance: balance.kind === 'ok' ? balance.value : 0,
    };
  }

  private handleError(error: unknown): void {
    if (this.account && hasStatus(error, 404)) {
      this.dialogRef.close({ status: 'notFound' });
      return;
    }
    if (hasStatus(error, 409)) {
      this.form.controls.name.setErrors({ duplicate: true });
      this.focusFirstInvalid();
      return;
    }
    const messages = validationErrors(error);
    const fieldErrors = SERVER_FIELDS.filter((field) => messages[field]);
    if (fieldErrors.length === 0) {
      // E.g. the currency message or a network error.
      this.error.set(messages['currency'] ? { message: messages['currency'] } : 'generic');
      return;
    }
    for (const field of fieldErrors) {
      this.form.controls[field].setErrors({ server: messages[field] });
      this.form.controls[field].markAsTouched();
    }
    this.focusFirstInvalid();
  }

  /**
   * Focuses the first invalid field once the error state is rendered (after a server error the
   * `ng-invalid` classes only appear on the next render).
   */
  private focusFirstInvalid(): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('input.ng-invalid, mat-button-toggle-group.ng-invalid button')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
