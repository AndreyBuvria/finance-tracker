import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MergeCategoryResult } from '@common/categories/category.model';

/**
 * Toast after a merge (FEATURES.md F5): "Moved 34 transactions and 1 budget to Eating out", or
 * "Merged into Eating out" when nothing moved. A component, so the counts are ICU plurals.
 */
@Component({
  selector: 'app-merge-toast',
  template: `
    @let moved = result.transactionsMoved;
    @let budgets = result.budgetsMoved;
    @let rules = result.rulesMoved;
    @let target = result.target.name;
    @if (rules > 0) {
      <ng-container i18n="@@settings.categories.toast.mergedWithRules"
        >Moved {moved, plural, =1 {1 transaction} other {{{ moved }} transactions}},
        {budgets, plural, =1 {1 budget} other {{{ budgets }} budgets}} and
        {rules, plural, =1 {1 rule} other {{{ rules }} rules}} to {{ target }}</ng-container
      >
    } @else if (moved > 0 && budgets > 0) {
      <ng-container i18n="@@settings.categories.toast.merged"
        >Moved {moved, plural, =1 {1 transaction} other {{{ moved }} transactions}} and
        {budgets, plural, =1 {1 budget} other {{{ budgets }} budgets}} to {{ target }}</ng-container
      >
    } @else if (moved > 0) {
      <ng-container i18n="@@settings.categories.toast.mergedTransactions"
        >Moved {moved, plural, =1 {1 transaction} other {{{ moved }} transactions}} to
        {{ target }}</ng-container
      >
    } @else if (budgets > 0) {
      <ng-container i18n="@@settings.categories.toast.mergedBudgets"
        >Moved {budgets, plural, =1 {1 budget} other {{{ budgets }} budgets}} to
        {{ target }}</ng-container
      >
    } @else {
      <ng-container i18n="@@settings.categories.toast.mergedNothing"
        >Merged into {{ target }}</ng-container
      >
    }
  `,
  styles: `
    :host {
      display: block;
      color: var(--mat-snack-bar-supporting-text-color);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class MergeToastComponent {
  protected readonly result = inject<MergeCategoryResult>(MAT_SNACK_BAR_DATA);
}
