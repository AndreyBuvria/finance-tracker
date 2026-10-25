import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AccountsApiService } from '@common/accounts/accounts-api.service';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { of, Subject } from 'rxjs';
import { CATEGORIES } from '../../../testing/transaction-fixtures.utils';
import { QuickAddListsService } from './quick-add-lists.service';

interface TopList {
  items: typeof CATEGORIES;
}

describe('QuickAddListsService', () => {
  function setup() {
    const top: Record<string, Subject<TopList>> = {};
    const categoriesApi = {
      top: vi.fn(({ type }: { type: CategoryTypeEnum }) => (top[type] = new Subject<TopList>())),
      list: vi.fn(() => of({ items: CATEGORIES.filter((c) => !c.isArchived) })),
    };
    TestBed.configureTestingModule({
      providers: [
        QuickAddListsService,
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: AccountsApiService, useValue: { list: () => of({ items: [], netWorth: 0 }) } },
      ],
    });
    const lists = TestBed.inject(QuickAddListsService);
    const type = signal(TransactionTypeEnum.Expense);
    lists.connect(type);
    TestBed.tick();
    const names = () => lists.topTiles().map((c) => c.name);
    /** Answers the pending tiles request (a resource takes its first value asynchronously). */
    const resolve = async (categoryType: CategoryTypeEnum, names: string[]) => {
      top[categoryType].next({ items: CATEGORIES.filter((c) => names.includes(c.name)) });
      top[categoryType].complete();
      await new Promise((done) => setTimeout(done));
      TestBed.tick();
    };
    return { lists, type, names, resolve, categoriesApi };
  }

  it('is loading until the most used categories arrive the first time', async () => {
    const { lists, resolve } = setup();
    expect(lists.loading()).toBe(true);
    await resolve(CategoryTypeEnum.Expense, ['Transport']);
    expect(lists.loading()).toBe(false);
  });

  it("stands in the type's categories while a type switch reloads the tiles, without loading", async () => {
    const { lists, type, names, resolve, categoriesApi } = setup();
    await resolve(CategoryTypeEnum.Expense, ['Transport']);
    expect(names()).toEqual(['Transport']);

    type.set(TransactionTypeEnum.Income);
    TestBed.tick();
    expect(categoriesApi.top).toHaveBeenLastCalledWith({ limit: 8, type: 'Income' });
    expect(lists.loading()).toBe(false);
    expect(names()).toEqual(['Salary', 'Other income']);

    await resolve(CategoryTypeEnum.Income, ['Other income']);
    expect(names()).toEqual(['Other income']);
  });

  it('asks for no tiles for a transfer', async () => {
    const { type, categoriesApi, lists, resolve } = setup();
    await resolve(CategoryTypeEnum.Expense, ['Transport']);
    type.set(TransactionTypeEnum.Transfer);
    TestBed.tick();
    expect(categoriesApi.top).toHaveBeenCalledTimes(1);
    expect(lists.loading()).toBe(false);
  });
});
