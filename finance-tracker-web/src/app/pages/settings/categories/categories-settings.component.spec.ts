import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryList } from '@common/categories/category.model';
import { delay, Observable, of, Subject, throwError } from 'rxjs';
import { CategoryDialogComponent } from '../common/dialogs/category-dialog/category-dialog.component';
import { DeleteCategoryDialogComponent } from '../common/dialogs/delete-category-dialog/delete-category-dialog.component';
import { MergeCategoryDialogComponent } from '../common/dialogs/merge-category-dialog/merge-category-dialog.component';
import { CATEGORIES, category } from '../testing/category-fixtures.utils';
import { CategoriesSettingsComponent } from './categories-settings.component';
import { CategoryActionsService } from './category-actions.service';
import { MergeToastComponent } from './merge-toast/merge-toast.component';

const visible = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Answers later, like the real API and dialogs (after the menu has returned focus). */
const later = <T>(value: T): Observable<T> => of(value).pipe(delay(1));

interface SetupOptions {
  list?: () => Observable<CategoryList>;
  /** What the opened dialog closes with. */
  dialogResult?: unknown;
  restore?: () => Observable<void>;
  archive?: () => Observable<void>;
}

describe('CategoriesSettingsComponent', () => {
  async function setup(options: SetupOptions = {}) {
    const api = {
      list: vi.fn(options.list ?? (() => of({ items: [...CATEGORIES] }))),
      archive: vi.fn(options.archive ?? (() => later(undefined))),
      restore: vi.fn(options.restore ?? (() => later(undefined))),
      delete: vi.fn(() => later(undefined)),
    };
    const dialog = {
      openDialogs: [],
      open: vi.fn(() => ({ afterClosed: () => later(options.dialogResult) })),
    };
    const undo$ = new Subject<void>();
    const snackBar = {
      open: vi.fn(() => ({ onAction: () => undo$ })),
      openFromComponent: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: CategoriesApiService, useValue: api },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    const fixture = TestBed.createComponent(CategoriesSettingsComponent);
    // Attached, so focus can be checked.
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    /** Waits for the delayed answers, then for rendering. */
    const stable = async () => {
      await new Promise((done) => setTimeout(done, 5));
      await fixture.whenStable();
    };
    const listNames = (index: number) =>
      Array.from(el.querySelectorAll('ul.list')[index]?.querySelectorAll('.name') ?? []).map((n) =>
        visible(n.textContent),
      );
    const row = (name: string) =>
      Array.from(el.querySelectorAll('app-category-row')).find(
        (r) => visible(r.querySelector('.name')?.textContent) === name,
      )!;
    /** Opens a row's "⋮" menu and returns its item labels and buttons. */
    const openMenu = async (name: string) => {
      row(name).querySelector<HTMLButtonElement>('.menu-button')!.click();
      await stable();
      const panels = document.querySelectorAll('.mat-mdc-menu-panel');
      const items = Array.from(
        panels[panels.length - 1].querySelectorAll<HTMLButtonElement>('[mat-menu-item]'),
      );
      return { labels: items.map((i) => visible(i.textContent)), items };
    };
    const choose = async (name: string, item: string) => {
      const { items } = await openMenu(name);
      items.find((i) => visible(i.textContent).endsWith(item))!.click();
      await stable();
    };
    const actions = () => fixture.debugElement.injector.get(CategoryActionsService);
    return {
      actions,
      fixture,
      el,
      stable,
      api,
      dialog,
      snackBar,
      undo$,
      listNames,
      row,
      openMenu,
      choose,
    };
  }

  afterEach(() => document.querySelectorAll('app-categories-settings').forEach((n) => n.remove()));

  it('lists expense and income categories with icon, name and transaction count', async () => {
    const { el, listNames, row } = await setup();
    expect(
      Array.from(el.querySelectorAll('h3.list-heading')).map((h) => visible(h.textContent)),
    ).toEqual(['Expense categories', 'Income categories']);
    expect(listNames(0)).toEqual(['Coffee', 'Dog', 'Eating out', 'Other']);
    expect(listNames(1)).toEqual(['Other income', 'Salary']);
    const coffee = row('Coffee');
    expect(visible(coffee.querySelector('.count')?.textContent)).toBe('34 transactions');
    const icon = coffee.querySelector<HTMLElement>('.icon')!;
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.style.backgroundColor).toBe('rgb(109, 76, 65)');
    expect(visible(icon.textContent)).toBe('local_cafe');
    expect(coffee.querySelector('.menu-button')?.getAttribute('aria-label')).toBe(
      'More actions for Coffee',
    );
  });

  it('shows a skeleton while loading, and the error with a retry that shows it again', async () => {
    const retry$ = new Subject<CategoryList>();
    let calls = 0;
    const { el, fixture } = await setup({
      list: () =>
        ++calls === 1 ? throwError(() => new HttpErrorResponse({ status: 500 })) : retry$,
    });
    el.querySelector<HTMLButtonElement>('app-load-error button')!.click();
    fixture.detectChanges();
    fixture.detectChanges();
    expect(el.querySelector('app-load-error')).toBeNull();
    expect(visible(el.querySelector('[role="status"]')?.textContent)).toBe('Loading categories…');
    expect(el.querySelector('.skeleton')).toBeTruthy();
    retry$.next({ items: [...CATEGORIES] });
    retry$.complete();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-category-row').length).toBeGreaterThan(0);
  });

  describe('row actions', () => {
    it('offers Rename, Hide and Merge into… for a default category', async () => {
      const { openMenu } = await setup();
      expect((await openMenu('Eating out')).labels).toEqual([
        'editRename',
        'visibility_offHide',
        'mergeMerge into…',
      ]);
    });

    it('offers Archive for a custom category with transactions, Delete without', async () => {
      const { openMenu } = await setup();
      expect((await openMenu('Coffee')).labels).toEqual([
        'editRename',
        'archiveArchive',
        'mergeMerge into…',
      ]);
      expect((await openMenu('Dog')).labels).toEqual([
        'editRename',
        'deleteDelete',
        'mergeMerge into…',
      ]);
    });

    it('lets the fallbacks only be renamed, and says why', async () => {
      const { openMenu, row } = await setup();
      const lock = row('Other').querySelector<HTMLElement>('.lock')!;
      expect(lock.getAttribute('aria-label')).toBe('Used as the fallback category');
      expect(lock.getAttribute('tabindex')).toBe('0');
      expect((await openMenu('Other')).labels).toEqual(['editRename']);
      expect(row('Eating out').querySelector('.lock')).toBeNull();
    });
  });

  it('hides a default category with Undo, and moves focus to its list', async () => {
    const { choose, api, snackBar, undo$, listNames, el, stable } = await setup();
    await choose('Eating out', 'Hide');
    expect(api.archive).toHaveBeenCalledWith('eating');
    expect(listNames(0)).toEqual(['Coffee', 'Dog', 'Other']);
    expect(snackBar.open).toHaveBeenCalledWith('Category hidden', 'Undo', { duration: 5000 });
    expect(document.activeElement).toBe(el.querySelector('#categories-expense-heading'));

    undo$.next();
    await stable();
    expect(api.restore).toHaveBeenCalledWith('eating');
    // Undo puts the row back and focuses its actions.
    expect(document.activeElement).toBe(el.querySelector('#category-actions-eating'));
    expect(listNames(0)).toEqual(['Coffee', 'Dog', 'Eating out', 'Other']);
    expect(snackBar.open).toHaveBeenLastCalledWith('Category restored', undefined, {
      duration: 5000,
    });
  });

  it('archives a custom category with transactions', async () => {
    const { choose, api, snackBar } = await setup();
    await choose('Coffee', 'Archive');
    expect(api.archive).toHaveBeenCalledWith('coffee');
    expect(snackBar.open).toHaveBeenCalledWith('Category archived', 'Undo', { duration: 5000 });
  });

  it('deletes after confirmation', async () => {
    const { choose, api, dialog, listNames, snackBar } = await setup({ dialogResult: true });
    await choose('Dog', 'Delete');
    expect(dialog.open).toHaveBeenCalledWith(
      DeleteCategoryDialogComponent,
      expect.objectContaining({ data: { category: expect.objectContaining({ id: 'dog' }) } }),
    );
    expect(api.delete).toHaveBeenCalledWith('dog');
    expect(listNames(0)).toEqual(['Coffee', 'Eating out', 'Other']);
    expect(document.activeElement?.id).toBe('categories-expense-heading');
    expect(snackBar.open).toHaveBeenCalledWith('Category deleted', undefined, { duration: 5000 });
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const { choose, api } = await setup({ dialogResult: false });
    await choose('Dog', 'Delete');
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('merges through the dialog and says what moved', async () => {
    const target = { ...CATEGORIES[0], transactionCount: 74 };
    const { choose, dialog, snackBar, el, row } = await setup({
      dialogResult: {
        status: 'merged',
        result: { transactionsMoved: 34, budgetsMoved: 1, rulesMoved: 0, target },
      },
    });
    await choose('Coffee', 'Merge into…');
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { targets: { name: string }[] } },
    ];
    expect(component).toBe(MergeCategoryDialogComponent);
    expect(config.data.targets.map((t) => t.name)).toEqual(['Dog', 'Eating out', 'Other']);
    expect(snackBar.openFromComponent).toHaveBeenCalledWith(MergeToastComponent, {
      data: expect.objectContaining({ transactionsMoved: 34, budgetsMoved: 1 }),
      duration: 5000,
    });
    expect(visible(row('Eating out').querySelector('.count')?.textContent)).toBe('74 transactions');
    expect(document.activeElement).toBe(el.querySelector('#category-actions-eating'));
  });

  it('adds a category from the dialog and focuses its row', async () => {
    const added = category({ id: 'kids', name: 'Kids', icon: 'child_care' });
    const { el, dialog, snackBar, listNames, stable } = await setup({
      dialogResult: { status: 'saved', category: added },
    });
    el.querySelector<HTMLButtonElement>('.add')!.click();
    await stable();
    expect(dialog.open).toHaveBeenCalledWith(CategoryDialogComponent, expect.anything());
    expect(listNames(0)).toContain('Kids');
    expect(snackBar.open).toHaveBeenCalledWith('Category added', undefined, { duration: 5000 });
    expect(document.activeElement).toBe(el.querySelector('#category-actions-kids'));
  });

  describe('hidden & archived', () => {
    it('is collapsed with a count, and restores a category', async () => {
      const { el, api, stable, listNames, snackBar } = await setup();
      const toggle = el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!;
      expect(visible(toggle.textContent)).toBe('expand_moreHidden & archived (1)');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      const hiddenList = el.querySelector<HTMLElement>('#hidden-categories-list')!;
      expect(hiddenList.hidden).toBe(true);

      toggle.click();
      await stable();
      expect(hiddenList.hidden).toBe(false);
      expect(visible(hiddenList.querySelector('.badge')?.textContent)).toBe('Hidden');
      hiddenList.querySelector<HTMLButtonElement>('.restore')!.click();
      await stable();
      expect(api.restore).toHaveBeenCalledWith('health');
      expect(listNames(0)).toContain('Health');
      expect(snackBar.open).toHaveBeenCalledWith('Category restored', undefined, {
        duration: 5000,
      });
      expect(document.activeElement?.id).toBe('category-actions-health');
    });

    it('shows the API message when the name is taken again', async () => {
      const { el, stable, snackBar } = await setup({
        restore: () =>
          throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { detail: 'A category with this name already exists. Rename it first.' },
              }),
          ),
      });
      el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!.click();
      await stable();
      el.querySelector<HTMLButtonElement>('#hidden-categories-list .restore')!.click();
      await stable();
      expect(snackBar.open).toHaveBeenCalledWith(
        'A category with this name already exists. Rename it first.',
        undefined,
        { duration: 5000 },
      );
    });
  });

  describe('deleting an archived custom category', () => {
    const mergedAway = category({ id: 'old', name: 'Coffee beans', isArchived: true });

    it('offers Delete only for an archived custom category without transactions', async () => {
      const { el, stable } = await setup({
        list: () => of({ items: [...CATEGORIES, mergedAway] }),
      });
      el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!.click();
      await stable();
      const rows = Array.from(el.querySelectorAll('#hidden-categories-list app-category-row'));
      const deletes = rows.map((r) => r.querySelector('.delete')?.getAttribute('aria-label'));
      expect(deletes).toEqual(['Delete Coffee beans', undefined]);
    });

    it('confirms, deletes and focuses the hidden section, or the list once it is empty', async () => {
      const { el, stable, api, dialog, snackBar } = await setup({
        dialogResult: true,
        list: () => of({ items: [...CATEGORIES, mergedAway] }),
      });
      el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!.click();
      await stable();
      el.querySelector<HTMLButtonElement>('#hidden-categories-list .delete')!.click();
      await stable();
      expect(dialog.open).toHaveBeenCalledWith(
        DeleteCategoryDialogComponent,
        expect.objectContaining({ data: { category: mergedAway } }),
      );
      expect(api.delete).toHaveBeenCalledWith('old');
      expect(snackBar.open).toHaveBeenCalledWith('Category deleted', undefined, {
        duration: 5000,
      });
      expect(document.activeElement?.id).toBe('hidden-categories-toggle');
    });

    it('focuses the type list when the hidden section is gone', async () => {
      const { el, stable } = await setup({
        dialogResult: true,
        list: () => of({ items: [...CATEGORIES.filter((c) => !c.isArchived), mergedAway] }),
      });
      el.querySelector<HTMLButtonElement>('#hidden-categories-toggle')!.click();
      await stable();
      el.querySelector<HTMLButtonElement>('#hidden-categories-list .delete')!.click();
      await stable();
      expect(el.querySelector('#hidden-categories-toggle')).toBeNull();
      expect(document.activeElement?.id).toBe('categories-expense-heading');
    });
  });

  it('focuses the hidden section toggle for a row inside the collapsed list', async () => {
    const { actions, stable, el } = await setup();
    actions().focusTarget.set({ kind: 'row', id: 'health' });
    await stable();
    expect(document.activeElement).toBe(el.querySelector('#hidden-categories-toggle'));
  });

  it('reloads when a category changed elsewhere (404)', async () => {
    const { choose, api, snackBar } = await setup({
      archive: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    });
    await choose('Eating out', 'Hide');
    expect(snackBar.open).toHaveBeenCalledWith('Something went wrong. Try again.', undefined, {
      duration: 5000,
    });
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('waits for a running change before another one', async () => {
    const pending = new Subject<void>();
    const { choose, api, el, actions, fixture } = await setup({ archive: () => pending });
    await choose('Eating out', 'Hide');
    fixture.detectChanges();
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.menu-button'));
    expect(buttons.every((b) => b.disabled)).toBe(true);
    actions().hide(CATEGORIES.find((c) => c.id === 'salary')!);
    expect(api.archive).toHaveBeenCalledTimes(1);
    pending.next();
    pending.complete();
    await fixture.whenStable();
    expect(buttons.filter((b) => b.isConnected).every((b) => !b.disabled)).toBe(true);
  });
});
