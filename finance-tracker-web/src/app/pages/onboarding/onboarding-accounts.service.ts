import { inject, Injectable } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { Account, AccountRequest } from '@common/accounts/account.model';
import { ACCOUNT_NAME_MAX_LENGTH } from '@common/accounts/account-limits.constants';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import {
  amountInputValidator,
  formatAmountInput,
  parseAmountInput,
} from '@common/formatting/amount-input.utils';
import { notBlankValidator } from '@common/forms/not-blank.utils';
import { trimmedMaxLengthValidator } from '@common/forms/trimmed-max-length.utils';
import { hasStatus, validationErrors } from '@common/http/problem-details.utils';
import {
  catchError,
  concat,
  defer,
  map,
  Observable,
  of,
  startWith,
  tap,
  throwError,
  toArray,
} from 'rxjs';
import { ACCOUNT_SUGGESTIONS } from './common/constants/account-suggestions.constants';
import { AccountSuggestion, AccountSuggestionKey } from './common/models/account-suggestion.model';

/** Fields the API reports validation errors on, matching the form control names. */
const SERVER_FIELDS = ['name', 'initialBalance'] as const;

/**
 * Step 1 of onboarding, "Where do you keep your money?" (FEATURES.md F1): the chosen suggestions
 * with their names and balances, and saving them as accounts.
 *
 * Saving is idempotent, so going back and forward never creates duplicates: each suggestion
 * remembers the account it created (or, after a reload, the user's existing account of its type),
 * and a later save only updates what changed, creates what is new and archives what was
 * deselected. Lives as long as the onboarding page, so the step keeps its state.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- page-scoped: OnboardingComponent provides it, so its state starts and ends with the page.
@Injectable()
export class OnboardingAccountsService {
  private readonly api = inject(AccountsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly suggestions = ACCOUNT_SUGGESTIONS;

  readonly form = this.fb.group({
    /** Keys of the selected chips. */
    selected: this.fb.control<AccountSuggestionKey[]>([]),
    card: this.accountGroup('card'),
    savings: this.accountGroup('savings'),
    cash: this.accountGroup('cash'),
  });

  /** The account each suggestion stands for on the server, once created or adopted. */
  private readonly linked = new Map<AccountSuggestionKey, Account>();

  /**
   * The user's active accounts, loaded first: after a reload the accounts created before are adopted
   * by their suggestions (by type) instead of being created again.
   */
  readonly existing = rxResource({
    stream: () => this.api.list(false).pipe(tap((list) => this.adopt(list.items))),
  });

  constructor() {
    this.form.controls.selected.valueChanges
      .pipe(startWith(this.form.controls.selected.value), takeUntilDestroyed())
      .subscribe((selected) => this.enableSelected(selected));
  }

  /** The selected suggestions, in display order. */
  selectedSuggestions(selected: readonly AccountSuggestionKey[]): AccountSuggestion[] {
    return this.suggestions.filter((suggestion) => selected.includes(suggestion.key));
  }

  /**
   * Creates, updates or archives accounts so the server matches the form (a deselected account that
   * was already created is archived, FEATURES.md F1). Runs one request at a time and stops at the
   * first error: API messages are put on their fields (the duplicate-name 409 on the name), and the
   * error is passed on. What was saved before the error stays remembered, so trying again continues
   * where it stopped.
   *
   * A deselected account's name can be given to another one without a duplicate-name 409:
   * - a newly selected suggestion with a deselected account's name takes that account over (it is
   *   updated in place, with its new type and balance) instead of archiving it and creating a new
   *   one;
   * - the remaining deselected accounts are archived first while a created account stays selected
   *   (an active account always remains), so their names are free before the creates and renames;
   *   otherwise they are archived last;
   * - renames run before creates, so a renamed account's old name is free for a new one.
   */
  save(): Observable<void> {
    const selected = this.form.controls.selected.value;
    this.takeOverDeselectedNames(selected);
    const keepsCreatedAccount = selected.some((key) => this.linked.has(key));
    const updates: Observable<unknown>[] = [];
    const creates: Observable<unknown>[] = [];
    for (const suggestion of this.selectedSuggestions(selected)) {
      const account = this.linked.get(suggestion.key);
      const request = this.toRequest(suggestion);
      if (!account) {
        creates.push(this.create(suggestion, request));
      } else if (changed(account, request)) {
        updates.push(this.update(suggestion, account, request));
      }
    }
    const archives = this.deselectedLinked().map((suggestion) => this.archive(suggestion));
    // Renames go before creates, so a renamed account frees its old name for a new one.
    const requests = keepsCreatedAccount
      ? [...archives, ...updates, ...creates]
      : [...updates, ...creates, ...archives];
    return concat(...requests).pipe(
      toArray(),
      map(() => undefined),
    );
  }

  /**
   * Forgets the remembered accounts and loads them again, e.g. after the API said the user has no
   * active account (they were archived elsewhere), so the next save creates them anew.
   */
  resync(): void {
    this.linked.clear();
    this.existing.reload();
  }

  private accountGroup(key: AccountSuggestionKey) {
    const suggestion = ACCOUNT_SUGGESTIONS.find((s) => s.key === key)!;
    // No `maxlength` attribute: the browser would silently cut pasted text instead of explaining.
    return this.fb.group({
      name: [
        suggestion.label,
        [notBlankValidator, trimmedMaxLengthValidator(ACCOUNT_NAME_MAX_LENGTH)],
      ],
      initialBalance: ['', amountInputValidator],
    });
  }

  /** Only the selected suggestions are validated and sent. */
  private enableSelected(selected: readonly AccountSuggestionKey[]): void {
    for (const suggestion of this.suggestions) {
      const group = this.form.controls[suggestion.key];
      if (selected.includes(suggestion.key)) {
        group.enable({ emitEvent: false });
      } else {
        group.disable({ emitEvent: false });
      }
    }
  }

  /** Links each suggestion without an account to the user's first unlinked account of its type. */
  private adopt(accounts: readonly Account[]): void {
    const taken = new Set([...this.linked.values()].map((account) => account.id));
    const selected = new Set(this.form.controls.selected.value);
    for (const suggestion of this.suggestions) {
      if (this.linked.has(suggestion.key)) {
        continue;
      }
      const account = accounts.find((a) => a.type === suggestion.type && !taken.has(a.id));
      if (!account) {
        continue;
      }
      taken.add(account.id);
      this.linked.set(suggestion.key, account);
      selected.add(suggestion.key);
      // Fields the user already edited keep their (unsaved) text.
      const { name, initialBalance } = this.form.controls[suggestion.key].controls;
      if (!name.dirty) {
        name.setValue(account.name);
      }
      if (!initialBalance.dirty) {
        initialBalance.setValue(
          account.initialBalance ? formatAmountInput(account.initialBalance) : '',
        );
      }
    }
    this.form.controls.selected.setValue(
      this.suggestions.map((s) => s.key).filter((key) => selected.has(key)),
    );
  }

  private toRequest(suggestion: AccountSuggestion): AccountRequest {
    const { name, initialBalance } = this.form.controls[suggestion.key].getRawValue();
    const balance = parseAmountInput(initialBalance);
    return {
      name: name.trim(),
      type: suggestion.type,
      currency: 'PLN',
      // Optional: a blank balance means 0 (FEATURES.md F1).
      initialBalance: balance.kind === 'ok' ? balance.value : 0,
    };
  }

  private create(suggestion: AccountSuggestion, request: AccountRequest): Observable<Account> {
    return defer(() => this.api.create(request)).pipe(
      tap((account) => this.linked.set(suggestion.key, account)),
      catchError((error: unknown) => this.fail(suggestion, error)),
    );
  }

  private update(
    suggestion: AccountSuggestion,
    account: Account,
    request: AccountRequest,
  ): Observable<Account> {
    return defer(() => this.api.update(account.id, request)).pipe(
      tap((saved) => this.linked.set(suggestion.key, saved)),
      catchError((error: unknown) => {
        if (hasStatus(error, 404)) {
          // Deleted elsewhere meanwhile: create it again.
          this.linked.delete(suggestion.key);
          return this.create(suggestion, request);
        }
        return this.fail(suggestion, error);
      }),
    );
  }

  /**
   * Hands each deselected account to a newly selected suggestion that wants its name (compared
   * like the API: trimmed, ignoring case).
   */
  private takeOverDeselectedNames(selected: readonly AccountSuggestionKey[]): void {
    for (const suggestion of this.selectedSuggestions(selected)) {
      if (this.linked.has(suggestion.key)) {
        continue;
      }
      const name = this.toRequest(suggestion).name.toLocaleLowerCase();
      const holder = this.deselectedLinked().find(
        (h) => this.linked.get(h.key)!.name.toLocaleLowerCase() === name,
      );
      if (holder) {
        this.linked.set(suggestion.key, this.linked.get(holder.key)!);
        this.linked.delete(holder.key);
      }
    }
  }

  /**
   * Archives the account a deselected suggestion stands for (unless that already happened in this
   * save). A 409 (e.g. "You need at least one active account.") reloads the accounts and is passed
   * on for the step to show.
   */
  private archive(suggestion: AccountSuggestion): Observable<void> {
    return defer(() => {
      const account = this.linked.get(suggestion.key);
      if (!account) {
        return of(undefined);
      }
      return this.api.archive(account.id).pipe(
        catchError((error: unknown) => {
          if (hasStatus(error, 404)) {
            return of(undefined);
          }
          if (hasStatus(error, 409)) {
            // E.g. "You need at least one active account.": the server differs from what the step
            // remembers, so load it again (the account is selected again) instead of repeating
            // the same archive on every retry.
            this.resync();
          }
          return throwError(() => error);
        }),
        tap(() => this.linked.delete(suggestion.key)),
      );
    });
  }

  /** Suggestions that are no longer selected but still stand for an active account. */
  private deselectedLinked(): AccountSuggestion[] {
    const selected = this.form.controls.selected.value;
    return this.suggestions.filter(
      (suggestion) => this.linked.has(suggestion.key) && !selected.includes(suggestion.key),
    );
  }

  /** Puts the API's messages on the suggestion's fields, then passes the error on. */
  private fail(suggestion: AccountSuggestion, error: unknown): Observable<never> {
    const group = this.form.controls[suggestion.key];
    if (hasStatus(error, 409)) {
      group.controls.name.setErrors({ duplicate: true });
      group.controls.name.markAsTouched();
    } else {
      const messages = validationErrors(error);
      for (const field of SERVER_FIELDS) {
        if (messages[field]) {
          group.controls[field].setErrors({ server: messages[field] });
          group.controls[field].markAsTouched();
        }
      }
    }
    return throwError(() => error);
  }
}

function changed(account: Account, request: AccountRequest): boolean {
  return (
    account.name !== request.name ||
    account.type !== request.type ||
    account.initialBalance !== request.initialBalance
  );
}
