import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';
import { hasStatus, problemDetail } from '@common/http/problem-details.utils';
import { filter, finalize, Observable } from 'rxjs';
import { CategoryDialogComponent } from '../common/dialogs/category-dialog/category-dialog.component';
import {
  CategoryDialogData,
  CategoryDialogResult,
} from '../common/dialogs/category-dialog/category-dialog.model';
import { DeleteCategoryDialogComponent } from '../common/dialogs/delete-category-dialog/delete-category-dialog.component';
import { MergeCategoryDialogComponent } from '../common/dialogs/merge-category-dialog/merge-category-dialog.component';
import {
  MergeCategoryDialogData,
  MergeCategoryDialogResult,
} from '../common/dialogs/merge-category-dialog/merge-category-dialog.model';
import { CategoryListService } from './category-list.service';
import { MergeToastComponent } from './merge-toast/merge-toast.component';

/** Toasts, including "Category hidden · Undo" (5 seconds, as for accounts). */
const TOAST_DURATION_MS = 5000;

const DIALOG_SIZE = { width: '520px', maxWidth: 'calc(100vw - 32px)' };

/** Where focus goes after an action, once the list shows the change. */
export type CategoryFocusTarget =
  /** The row's "⋮" menu button (the row is still or again in a list). */
  | { readonly kind: 'row'; readonly id: string }
  /** The heading of a type's list (the row left it). */
  | { readonly kind: 'list'; readonly type: CategoryTypeEnum }
  /** The "Hidden & archived" toggle (a row left that list), or the type's heading without it. */
  | { readonly kind: 'hidden'; readonly type: CategoryTypeEnum };

/**
 * The actions of Settings → Categories (FEATURES.md F5): add/edit (dialog), hide or archive (toast
 * with Undo, which restores), restore, delete (confirmation) and merge (dialog). Applies each
 * result to the list and asks the section to move focus where it makes sense. Errors end in a
 * toast with the API's message. Lives as long as the section.
 */
// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- section-scoped: CategoriesSettingsComponent provides it, so its subscriptions end with the section.
@Injectable()
export class CategoryActionsService {
  private readonly api = inject(CategoriesApiService);
  private readonly list = inject(CategoryListService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  /** A request is running: the row actions wait. */
  readonly busy = signal(false);
  /** Where the section should move focus next (it clears it once done). */
  readonly focusTarget = signal<CategoryFocusTarget | null>(null);

  /** "Add category", or "Edit category" (the "Rename" action) for `category`. */
  edit(category?: Category): void {
    this.dialog
      .open<CategoryDialogComponent, CategoryDialogData, CategoryDialogResult>(
        CategoryDialogComponent,
        { ...DIALOG_SIZE, data: { category } },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if (result.status === 'notFound') {
          this.changedElsewhere();
          return;
        }
        this.list.put(result.category);
        this.toast(
          category
            ? $localize`:@@settings.categories.toast.updated:Category updated`
            : $localize`:@@settings.categories.toast.added:Category added`,
        );
        this.focusTarget.set({ kind: 'row', id: result.category.id });
      });
  }

  /** Hides a default or archives a custom category; the toast's Undo restores it. */
  hide(category: Category): void {
    this.run(
      () => this.api.archive(category.id),
      () => {
        this.list.setArchived(category.id, true);
        this.focusTarget.set({ kind: 'list', type: category.type });
        const message = category.systemKey
          ? $localize`:@@settings.categories.toast.hidden:Category hidden`
          : $localize`:@@settings.categories.toast.archived:Category archived`;
        this.snackBar
          .open(message, $localize`:@@common.action.undo:Undo`, { duration: TOAST_DURATION_MS })
          .onAction()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => this.restore(category));
      },
    );
  }

  restore(category: Category): void {
    this.run(
      () => this.api.restore(category.id),
      () => {
        this.list.setArchived(category.id, false);
        this.toast($localize`:@@settings.categories.toast.restored:Category restored`);
        this.focusTarget.set({ kind: 'row', id: category.id });
      },
    );
  }

  /**
   * Deletes a custom category without transactions (active, or archived e.g. after a merge), after
   * confirmation.
   */
  delete(category: Category): void {
    this.dialog
      .open<DeleteCategoryDialogComponent, { category: Category }, boolean>(
        DeleteCategoryDialogComponent,
        { ...DIALOG_SIZE, data: { category } },
      )
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() =>
        this.run(
          () => this.api.delete(category.id),
          () => {
            this.list.remove(category.id);
            this.toast($localize`:@@settings.categories.toast.deleted:Category deleted`);
            this.focusTarget.set({
              kind: category.isArchived ? 'hidden' : 'list',
              type: category.type,
            });
          },
        ),
      );
  }

  /** "Merge into…": the dialog merges; the toast says what moved. */
  merge(category: Category): void {
    this.dialog
      .open<MergeCategoryDialogComponent, MergeCategoryDialogData, MergeCategoryDialogResult>(
        MergeCategoryDialogComponent,
        { ...DIALOG_SIZE, data: { source: category, targets: this.list.mergeTargets(category) } },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (!result) {
          return;
        }
        if (result.status === 'notFound') {
          this.changedElsewhere();
          return;
        }
        this.list.merged(category.id, result.result.target);
        this.snackBar.openFromComponent(MergeToastComponent, {
          data: result.result,
          duration: TOAST_DURATION_MS,
        });
        this.focusTarget.set({ kind: 'row', id: result.result.target.id });
      });
  }

  /** Runs one request; a 409 shows the API's message, anything else the generic one. */
  private run(request: () => Observable<void>, success: () => void): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    request()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: success,
        error: (error: unknown) => {
          if (hasStatus(error, 404)) {
            this.changedElsewhere();
            return;
          }
          this.toast(
            problemDetail(error, 409) ??
              $localize`:@@common.error.generic:Something went wrong. Try again.`,
          );
        },
      });
  }

  /** Deleted or changed in another tab: say so and show the current list. */
  private changedElsewhere(): void {
    this.toast($localize`:@@common.error.generic:Something went wrong. Try again.`);
    this.list.categories.reload();
  }

  private toast(message: string): void {
    this.snackBar.open(message, undefined, { duration: TOAST_DURATION_MS });
  }
}
