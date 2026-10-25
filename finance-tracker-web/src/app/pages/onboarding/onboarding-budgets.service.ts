import { inject, Injectable } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder } from '@angular/forms';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { toMonthKey } from '@common/date/iso-date.utils';
import { amountInputValidator } from '@common/formatting/amount-input.utils';
import { validationErrors } from '@common/http/problem-details.utils';
import { ClockService } from '@common/time/clock.service';
import { catchError, concat, defer, map, Observable, tap, throwError, toArray } from 'rxjs';
import { BudgetsApiService } from './common/budgets/budgets-api.service';
import { BudgetCategoryKey } from './common/constants/budget-categories.constants';
import {
  BudgetCategoryRow,
  budgetCategoryRows,
  limitFromInput,
  nonNegativeAmountValidator,
} from './utils/budget-limit.utils';

/**
 * Step 2 of onboarding, "Set a monthly budget" (FEATURES.md F1): a limit field for each of the 5
 * most common categories, saved for the current Europe/Warsaw month. Only limits that changed
 * since the last save are sent, so going back and forward repeats nothing; clearing a saved limit
 * removes it. Lives as long as the onboarding page, so the step keeps its state.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- page-scoped: OnboardingComponent provides it, so its state starts and ends with the page.
@Injectable()
export class OnboardingBudgetsService {
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly budgetsApi = inject(BudgetsApiService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** The current month in Europe/Warsaw (PLAN.md §6 "Dates"), as "YYYY-MM". */
  readonly month = toMonthKey(inject(ClockService).businessToday());

  /** Empty limit fields, keyed by the category's `systemKey`. */
  readonly form = this.fb.group({
    groceries: this.limitControl(),
    eating_out: this.limitControl(),
    transport: this.limitControl(),
    shopping: this.limitControl(),
    entertainment: this.limitControl(),
  } satisfies Record<BudgetCategoryKey, unknown>);

  /** The rows to show: the 5 categories, found by `systemKey` among the active expense ones. */
  readonly rows = rxResource({
    stream: () =>
      this.categoriesApi
        .list({ type: CategoryTypeEnum.Expense })
        .pipe(map((list) => budgetCategoryRows(list.items))),
  });

  /** The limit last saved per category ID (null: none). */
  private readonly saved = new Map<string, number | null>();

  /**
   * Saves the limits that changed, one request at a time. Stops at the first error: an API message
   * goes on its field (and the error is passed on).
   */
  save(): Observable<void> {
    const rows = this.rows.hasValue() ? this.rows.value() : [];
    const requests = rows.flatMap((row) => {
      const limit = limitFromInput(this.form.controls[row.key].value);
      return limit === (this.saved.get(row.category.id) ?? null) ? [] : [this.setLimit(row, limit)];
    });
    return concat(...requests).pipe(
      toArray(),
      map(() => undefined),
    );
  }

  private limitControl() {
    return this.fb.control('', [amountInputValidator, nonNegativeAmountValidator]);
  }

  private setLimit(row: BudgetCategoryRow, limit: number | null): Observable<unknown> {
    return defer(() => this.budgetsApi.setLimit(row.category.id, this.month, limit)).pipe(
      tap(() => this.saved.set(row.category.id, limit)),
      catchError((error: unknown) => {
        // Messages come on `limitAmount` (or on the category, e.g. "This category is hidden. …").
        const message = Object.values(validationErrors(error))[0];
        if (message) {
          const control = this.form.controls[row.key];
          control.setErrors({ server: message });
          control.markAsTouched();
        }
        return throwError(() => error);
      }),
    );
  }
}
