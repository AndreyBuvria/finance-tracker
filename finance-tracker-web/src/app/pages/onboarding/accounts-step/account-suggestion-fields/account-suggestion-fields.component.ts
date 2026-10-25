import { Component, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ACCOUNT_NAME_MAX_LENGTH } from '@common/accounts/account-limits.constants';
import { map, startWith, switchMap } from 'rxjs';
import { AccountSuggestion } from '../../common/models/account-suggestion.model';

interface FieldErrors {
  readonly name: ValidationErrors;
  readonly balance: ValidationErrors;
}

/** The fields of one selected suggestion. */
export type AccountSuggestionGroup = FormGroup<{
  name: FormControl<string>;
  initialBalance: FormControl<string>;
}>;

/**
 * Name and optional current balance of a selected step 1 suggestion (FEATURES.md F1), grouped
 * under the suggestion's label, with the Accounts messages (F2).
 */
@Component({
  selector: 'app-account-suggestion-fields',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './account-suggestion-fields.component.html',
  styleUrl: './account-suggestion-fields.component.scss',
})
export class AccountSuggestionFieldsComponent {
  readonly suggestion = input.required<AccountSuggestion>();
  readonly group = input.required<AccountSuggestionGroup>();

  protected readonly nameMaxLength = ACCOUNT_NAME_MAX_LENGTH;

  /**
   * The fields' errors, followed through the group's events: errors set from outside (API
   * messages) then still re-render this component.
   */
  protected readonly errors = toSignal(
    toObservable(this.group).pipe(
      switchMap((group) =>
        group.events.pipe(
          startWith(null),
          map((): FieldErrors => ({
            name: group.controls.name.errors ?? {},
            balance: group.controls.initialBalance.errors ?? {},
          })),
        ),
      ),
    ),
    { initialValue: { name: {}, balance: {} } as FieldErrors },
  );
}
