import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@common/config/api-config.token';
import { Observable } from 'rxjs';
import { Budget, BudgetRequest } from './budget.model';

/**
 * Budgets API (PLAN.md §7 "Budgets contract"). Only onboarding uses it so far; it moves to the
 * app-level `common/` when the Budgets page needs it too.
 */
@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/budgets`;

  /**
   * Sets the limit of `categoryId` for `month` ("YYYY-MM"). `null` removes it; then the API answers
   * 204 and this emits null.
   */
  setLimit(
    categoryId: string,
    month: string,
    limitAmount: number | null,
  ): Observable<Budget | null> {
    return this.http.put<Budget | null>(
      `${this.url}/${encodeURIComponent(categoryId)}`,
      { limitAmount } satisfies BudgetRequest,
      { params: { month } },
    );
  }
}
