import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { errorId } from '@common/http/problem-details.utils';
import { LoadErrorComponent } from '@infrastructure/feedback/load-error/load-error.component';
import { HIDDEN_CATEGORIES_TOGGLE_ID } from './categories-settings.constants';
import { CategoryActionsService, CategoryFocusTarget } from './category-actions.service';
import { CategoryListService } from './category-list.service';
import { categoryActionsId, CategoryRowComponent } from './category-row/category-row.component';
import { HiddenCategoriesComponent } from './hidden-categories/hidden-categories.component';

/**
 * Settings → Categories (FEATURES.md F5, DESIGN.md screen 7): "Add category", the expense and
 * income lists, and the collapsed "Hidden & archived" section. After an action, focus moves to the
 * changed row, or to its list's heading when the row left the list.
 */
@Component({
  selector: 'app-categories-settings',
  imports: [
    CategoryRowComponent,
    HiddenCategoriesComponent,
    LoadErrorComponent,
    MatButtonModule,
    MatIconModule,
  ],
  providers: [CategoryListService, CategoryActionsService],
  templateUrl: './categories-settings.component.html',
  styleUrl: './categories-settings.component.scss',
})
export class CategoriesSettingsComponent {
  protected readonly list = inject(CategoryListService);
  protected readonly actions = inject(CategoryActionsService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  protected readonly categoryType = CategoryTypeEnum;

  readonly loadErrorId = computed(() => errorId(this.list.categories.error()));

  constructor() {
    effect(() => {
      const target = this.actions.focusTarget();
      if (target) {
        untracked(() => this.focus(target));
      }
    });
  }

  headingId(type: CategoryTypeEnum): string {
    return `categories-${type.toLowerCase()}-heading`;
  }

  /** Focuses the target once the list shows the change, then forgets it. */
  private focus(target: CategoryFocusTarget): void {
    afterNextRender(
      () => {
        this.elementFor(target)?.focus();
        this.actions.focusTarget.set(null);
      },
      { injector: this.injector },
    );
  }

  /**
   * - a row: its actions, unless it sits in the collapsed hidden list: then that list's toggle;
   * - a list: its heading;
   * - the hidden list: its toggle, or the type's heading once the list is gone.
   */
  private elementFor(target: CategoryFocusTarget): HTMLElement | null {
    const byId = (id: string) => this.document.getElementById(id);
    switch (target.kind) {
      case 'row': {
        const actions = byId(categoryActionsId(target.id));
        return actions && !actions.closest('[hidden]')
          ? actions
          : byId(HIDDEN_CATEGORIES_TOGGLE_ID);
      }
      case 'list':
        return byId(this.headingId(target.type));
      case 'hidden':
        return byId(HIDDEN_CATEGORIES_TOGGLE_ID) ?? byId(this.headingId(target.type));
    }
  }
}
