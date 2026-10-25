import { Component, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MerchantSuggestion } from '@common/transactions/transaction.model';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
} from 'rxjs';
import {
  MERCHANT_DEBOUNCE_MS,
  MERCHANT_MAX_LENGTH,
} from '../../../constants/transaction-limits.constants';
import { SEARCH_MAX_LENGTH } from '../../../constants/transactions-page.constants';
import { controlState } from '../../../../utils/control-state.utils';

/**
 * "Merchant or note" with suggestions from past merchants (FEATURES.md F3). Choosing one reports
 * it, so the dialog can pre-select its last-used category. Failed suggestions just show none.
 */
@Component({
  selector: 'app-merchant-field',
  imports: [MatAutocompleteModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <mat-form-field subscriptSizing="dynamic">
      <mat-label i18n="@@transactions.quickAdd.merchant">Merchant or note</mat-label>
      <input
        matInput
        autocomplete="off"
        [formControl]="control()"
        [matAutocomplete]="suggestions"
      />
      <mat-autocomplete
        #suggestions="matAutocomplete"
        [displayWith]="display"
        (optionSelected)="choose($event.option.value)"
      >
        @for (suggestion of options(); track suggestion.merchant) {
          <mat-option [value]="suggestion">{{ suggestion.merchant }}</mat-option>
        }
      </mat-autocomplete>
      @let errors = state().errors;
      @if (errors?.['maxlength']) {
        <mat-error i18n="@@transactions.quickAdd.merchant.tooLong"
          >Merchant can be at most {{ maxLength }} characters.</mat-error
        >
      } @else if (errors?.['server']; as message) {
        <mat-error>{{ message }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: `
    :host {
      display: block;
    }

    mat-form-field {
      width: 100%;
    }
  `,
})
export class MerchantFieldComponent {
  private readonly api = inject(TransactionsApiService);

  readonly control = input.required<FormControl<string>>();
  readonly suggestionChosen = output<MerchantSuggestion>();

  protected readonly maxLength = MERCHANT_MAX_LENGTH;
  /** Re-renders on errors set from outside (API messages), not only on typing. */
  protected readonly state = controlState(this.control, '');

  readonly options = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) => control.valueChanges.pipe(startWith(control.value))),
      // A chosen option briefly sets the suggestion object itself.
      map((value: unknown) => (typeof value === 'string' ? value.trim() : '')),
      debounceTime(MERCHANT_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((q) =>
        // The API takes at most 100 characters; a longer merchant has no suggestions anyway.
        q.length > SEARCH_MAX_LENGTH
          ? of([] as MerchantSuggestion[])
          : this.api.merchants(q).pipe(
              map((list) => list.items),
              catchError(() => of([] as MerchantSuggestion[])),
            ),
      ),
    ),
    { initialValue: [] as MerchantSuggestion[] },
  );

  /** The input shows the merchant name, also while an option is being chosen. */
  readonly display = (value: MerchantSuggestion | string | null): string =>
    typeof value === 'string' ? value : (value?.merchant ?? '');

  choose(suggestion: MerchantSuggestion): void {
    this.control().setValue(suggestion.merchant);
    this.suggestionChosen.emit(suggestion);
  }
}
