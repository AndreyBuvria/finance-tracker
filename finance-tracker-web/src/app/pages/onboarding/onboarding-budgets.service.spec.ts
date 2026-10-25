import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { CategoryTypeEnum } from '@common/categories/category-type.enum';
import { Category } from '@common/categories/category.model';
import { provideFakeClock } from '@common/time/testing/fake-clock.service';
import { firstValueFrom, of, throwError } from 'rxjs';
import { BudgetsApiService } from './common/budgets/budgets-api.service';
import { OnboardingBudgetsService } from './onboarding-budgets.service';

const category = (systemKey: string): Category => ({
  id: `id-${systemKey}`,
  name: systemKey,
  type: CategoryTypeEnum.Expense,
  icon: 'category',
  color: '#2e7d32',
  systemKey,
  isArchived: false,
  isProtected: false,
  transactionCount: 0,
  budgetCount: 0,
});

describe('OnboardingBudgetsService', () => {
  function setup(now = '2026-10-31T23:30:00Z') {
    const categoriesApi = {
      list: vi.fn(() =>
        of({
          items: [
            'groceries',
            'eating_out',
            'transport',
            'housing',
            'shopping',
            'entertainment',
          ].map(category),
        }),
      ),
    };
    const budgetsApi = { setLimit: vi.fn(() => of(null)) };
    TestBed.configureTestingModule({
      providers: [
        OnboardingBudgetsService,
        provideFakeClock(now),
        { provide: CategoriesApiService, useValue: categoriesApi },
        { provide: BudgetsApiService, useValue: budgetsApi },
      ],
    });
    const service = TestBed.inject(OnboardingBudgetsService);
    TestBed.tick();
    const save = () => firstValueFrom(service.save(), { defaultValue: undefined });
    return { service, categoriesApi, budgetsApi, save };
  }

  it('shows the five expense categories, found by systemKey', () => {
    const { service, categoriesApi } = setup();
    expect(categoriesApi.list).toHaveBeenCalledWith({ type: 'Expense' });
    expect(service.rows.value()?.map((row) => row.key)).toEqual([
      'groceries',
      'eating_out',
      'transport',
      'shopping',
      'entertainment',
    ]);
  });

  it('uses the current month in Europe/Warsaw', () => {
    // 23:30 UTC on 31 Oct is already 1 Nov in Warsaw.
    expect(setup().service.month).toBe('2026-11');
  });

  it('saves only the filled-in limits', async () => {
    const { service, budgetsApi, save } = setup();
    service.form.controls.groceries.setValue('1 200,50');
    service.form.controls.transport.setValue('150');
    await save();
    expect(budgetsApi.setLimit.mock.calls).toEqual([
      ['id-groceries', '2026-11', 1200.5],
      ['id-transport', '2026-11', 150],
    ]);
  });

  it('sends nothing again for unchanged limits and removes a cleared one', async () => {
    const { service, budgetsApi, save } = setup();
    service.form.controls.groceries.setValue('600');
    await save();
    await save();
    expect(budgetsApi.setLimit).toHaveBeenCalledTimes(1);

    service.form.controls.groceries.setValue('');
    await save();
    expect(budgetsApi.setLimit).toHaveBeenLastCalledWith('id-groceries', '2026-11', null);
  });

  it('puts an API message on its field', async () => {
    const { service, budgetsApi, save } = setup();
    budgetsApi.setLimit.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { limitAmount: ['Enter a smaller amount.'] } },
          }),
      ),
    );
    service.form.controls.shopping.setValue('5');
    await expect(save()).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(service.form.controls.shopping.getError('server')).toBe('Enter a smaller amount.');
  });
});
