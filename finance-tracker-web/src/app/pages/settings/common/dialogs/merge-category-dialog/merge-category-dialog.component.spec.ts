import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { MergeCategoryResult } from '@common/categories/category.model';
import { Observable, of, throwError } from 'rxjs';
import { CATEGORIES } from '../../../testing/category-fixtures.utils';
import { MergeCategoryDialogComponent } from './merge-category-dialog.component';

const visible = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const coffee = CATEGORIES.find((c) => c.id === 'coffee')!;
const targets = CATEGORIES.filter((c) => ['dog', 'eating', 'other'].includes(c.id));

describe('MergeCategoryDialogComponent', () => {
  async function setup(merge?: () => Observable<MergeCategoryResult>) {
    const result = { transactionsMoved: 34, budgetsMoved: 1, rulesMoved: 0, target: targets[0] };
    const api = { merge: vi.fn(merge ?? (() => of(result))) };
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { source: coffee, targets } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CategoriesApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(MergeCategoryDialogComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    const component = fixture.componentInstance;
    const submit = async () => {
      el.querySelector<HTMLButtonElement>('button.submit')!.click();
      await stable();
    };
    const errors = () =>
      Array.from(el.querySelectorAll('mat-error, .form-error')).map((e) => visible(e.textContent));
    return { fixture, el, stable, component, api, dialogRef, submit, errors, result };
  }

  it('asks what to merge into and confirms what moves', async () => {
    const { el, component, stable } = await setup();
    expect(visible(el.querySelector('h2')?.textContent)).toBe('Merge Coffee into…');
    expect(visible(el.querySelector('.question')?.textContent)).toBe('');
    component.form.controls.targetCategoryId.setValue('eating');
    await stable();
    expect(visible(el.querySelector('.question')?.textContent)).toBe(
      'Move 34 transactions and 1 budget to Eating out?',
    );
  });

  it('asks to merge when there is nothing to move', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: { source: { ...coffee, transactionCount: 0, budgetCount: 0 }, targets },
    });
    const { el, component, stable } = await setup();
    component.form.controls.targetCategoryId.setValue('eating');
    await stable();
    expect(visible(el.querySelector('.question')?.textContent)).toBe(
      'Merge Coffee into Eating out?',
    );
  });

  it('uses singular forms and leaves out what is not there', async () => {
    TestBed.overrideProvider(MAT_DIALOG_DATA, {
      useValue: { source: { ...coffee, transactionCount: 1, budgetCount: 0 }, targets },
    });
    const { el, component, stable } = await setup();
    component.form.controls.targetCategoryId.setValue('eating');
    await stable();
    expect(visible(el.querySelector('.question')?.textContent)).toBe(
      'Move 1 transaction to Eating out?',
    );
  });

  it('requires a target', async () => {
    const { submit, errors, api } = await setup();
    await submit();
    expect(errors()).toEqual(['Choose a category to merge into.']);
    expect(api.merge).not.toHaveBeenCalled();
  });

  it('merges and closes with what moved', async () => {
    const { component, submit, api, dialogRef, result } = await setup();
    component.form.controls.targetCategoryId.setValue('eating');
    await submit();
    expect(api.merge).toHaveBeenCalledWith('coffee', 'eating');
    expect(dialogRef.close).toHaveBeenCalledWith({ status: 'merged', result });
  });

  it('shows a target validation message on the field', async () => {
    const { component, submit, errors } = await setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { targetCategoryId: ['Choose an active category.'] } },
          }),
      ),
    );
    component.form.controls.targetCategoryId.setValue('eating');
    await submit();
    expect(errors()).toEqual(['Choose an active category.']);
  });

  it('shows the budget-too-large conflict', async () => {
    const message = 'Merging would make a monthly budget too large. Lower one of the limits first.';
    const { component, submit, errors, el } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: message } })),
    );
    component.form.controls.targetCategoryId.setValue('eating');
    await submit();
    expect(errors()).toEqual([message]);
    expect(el.querySelector('.form-error')?.getAttribute('role')).toBe('alert');
  });

  it('closes with notFound when a category is gone', async () => {
    const { component, submit, dialogRef } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    component.form.controls.targetCategoryId.setValue('eating');
    await submit();
    expect(dialogRef.close).toHaveBeenCalledWith({ status: 'notFound' });
  });
});
