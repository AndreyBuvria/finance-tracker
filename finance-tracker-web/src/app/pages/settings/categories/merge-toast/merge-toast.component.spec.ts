import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { MergeCategoryResult } from '@common/categories/category.model';
import { category } from '../../testing/category-fixtures.utils';
import { MergeToastComponent } from './merge-toast.component';

describe('MergeToastComponent', () => {
  async function render(moved: Partial<MergeCategoryResult>): Promise<string> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAT_SNACK_BAR_DATA,
          useValue: {
            transactionsMoved: 0,
            budgetsMoved: 0,
            rulesMoved: 0,
            target: category({ name: 'Eating out' }),
            ...moved,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(MergeToastComponent);
    await fixture.whenStable();
    return ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('says what moved, with plural forms', async () => {
    expect(await render({ transactionsMoved: 34, budgetsMoved: 1 })).toBe(
      'Moved 34 transactions and 1 budget to Eating out',
    );
    expect(await render({ transactionsMoved: 1 })).toBe('Moved 1 transaction to Eating out');
    expect(await render({ budgetsMoved: 2 })).toBe('Moved 2 budgets to Eating out');
    expect(await render({ transactionsMoved: 2, budgetsMoved: 0, rulesMoved: 1 })).toBe(
      'Moved 2 transactions, 0 budgets and 1 rule to Eating out',
    );
  });

  it('says where it went when nothing moved', async () => {
    expect(await render({})).toBe('Merged into Eating out');
  });
});
