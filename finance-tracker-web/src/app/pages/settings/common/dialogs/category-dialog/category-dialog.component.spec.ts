import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoriesApiService } from '@common/categories/categories-api.service';
import { Category } from '@common/categories/category.model';
import { Observable, of, throwError } from 'rxjs';
import { category } from '../../../testing/category-fixtures.utils';
import { CategoryDialogComponent } from './category-dialog.component';
import { CategoryDialogData } from './category-dialog.model';

const visible = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('CategoryDialogComponent', () => {
  async function setup(data: CategoryDialogData = {}, save?: () => Observable<Category>) {
    const saved = category({ id: 'new', name: 'Dog' });
    const api = {
      create: vi.fn(save ?? (() => of(saved))),
      update: vi.fn(save ?? (() => of(saved))),
    };
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: CategoriesApiService, useValue: api },
      ],
    });
    const fixture = TestBed.createComponent(CategoryDialogComponent);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const stable = () => fixture.whenStable();
    const name = () => el.querySelector<HTMLInputElement>('input[formcontrolname="name"]')!;
    const type = (value: string) => {
      name().value = value;
      name().dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      el.querySelector<HTMLButtonElement>('button.submit')!.click();
      await stable();
    };
    const errors = () =>
      Array.from(el.querySelectorAll('mat-error, .field-error, .form-error')).map((e) =>
        visible(e.textContent),
      );
    const radio = (label: string) =>
      el.querySelector<HTMLInputElement>(`input[type="radio"][aria-label="${label}"]`)!;
    return { fixture, el, stable, api, dialogRef, name, type, submit, errors, radio };
  }

  afterEach(() => document.querySelectorAll('app-category-dialog').forEach((n) => n.remove()));

  it('adds a category with name, type, icon and color', async () => {
    const { el, type, radio, submit, api, dialogRef, stable } = await setup();
    expect(visible(el.querySelector('h2')?.textContent)).toBe('Add category');
    expect(el.querySelectorAll('app-icon-picker input[type="radio"]')).toHaveLength(40);
    expect(el.querySelectorAll('app-color-picker input[type="radio"]')).toHaveLength(12);
    type('  Bonus ');
    el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();
    radio('Pets').click();
    radio('Green').click();
    await stable();
    await submit();
    expect(api.create).toHaveBeenCalledWith({
      name: 'Bonus',
      type: 'Income',
      icon: 'pets',
      color: '#2e7d32',
    });
    expect(dialogRef.close).toHaveBeenCalledWith({
      status: 'saved',
      category: expect.objectContaining({ id: 'new' }),
    });
  });

  it('starts with the neutral icon and color, and names every option', async () => {
    const { radio } = await setup();
    expect(radio('Other').checked).toBe(true);
    expect(radio('Blue grey').checked).toBe(true);
  });

  it('explains a missing or too long name, and focuses it', async () => {
    const { type, submit, errors, name, api } = await setup();
    await submit();
    expect(errors()).toEqual(['Enter a category name.']);
    expect(document.activeElement).toBe(name());
    type('x'.repeat(31));
    await submit();
    expect(errors()).toEqual(['Name can be at most 30 characters.']);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('renames a default category but keeps its type, with the reason', async () => {
    const groceries = category({ id: 'g', name: 'Groceries', systemKey: 'groceries' });
    const { el, type, submit, api } = await setup({ category: groceries });
    expect(visible(el.querySelector('h2')?.textContent)).toBe('Edit category');
    const toggles = Array.from(el.querySelectorAll('mat-button-toggle button'));
    expect(toggles.every((t) => t.hasAttribute('disabled'))).toBe(true);
    expect(visible(el.querySelector('#category-type-hint')?.textContent)).toBe(
      "The type of a default category can't be changed.",
    );
    type('Food');
    await submit();
    expect(api.update).toHaveBeenCalledWith('g', {
      name: 'Food',
      type: 'Expense',
      icon: 'category',
      color: '#546e7a',
    });
  });

  it('keeps the type of a custom category in use', async () => {
    const coffee = category({ id: 'c', name: 'Coffee', transactionCount: 3 });
    const { el } = await setup({ category: coffee });
    expect(visible(el.querySelector('#category-type-hint')?.textContent)).toBe(
      "This category is already in use, so its type can't be changed.",
    );
  });

  it('lets an unused custom category change its type', async () => {
    const dog = category({ id: 'd', name: 'Dog' });
    const { el } = await setup({ category: dog });
    const toggles = Array.from(el.querySelectorAll('mat-button-toggle button'));
    expect(toggles.some((t) => t.hasAttribute('disabled'))).toBe(false);
    expect(el.querySelector('#category-type-hint')).toBeNull();
  });

  it('shows the duplicate-name message on the name', async () => {
    const { type, submit, errors, name } = await setup({}, () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'A category with this name already exists.' },
          }),
      ),
    );
    type('Groceries');
    await submit();
    expect(errors()).toEqual(['A category with this name already exists.']);
    expect(document.activeElement).toBe(name());
  });

  it('shows a type conflict on the type when the type was changed', async () => {
    const dog = category({ id: 'd', name: 'Dog' });
    const { el, submit, errors, stable } = await setup({ category: dog }, () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: "This category is already in use, so its type can't be changed." },
          }),
      ),
    );
    el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();
    await stable();
    await submit();
    expect(errors()).toEqual(["This category is already in use, so its type can't be changed."]);
  });

  it('puts a duplicate name on Name even when the type was changed too', async () => {
    const dog = category({ id: 'd', name: 'Dog' });
    const { el, type, submit, errors, name, stable } = await setup({ category: dog }, () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'A category with this name already exists.' },
          }),
      ),
    );
    type('Salary');
    el.querySelectorAll<HTMLButtonElement>('mat-button-toggle button')[1].click();
    await stable();
    await submit();
    expect(errors()).toEqual(['A category with this name already exists.']);
    expect(document.activeElement).toBe(name());
  });

  it('shows API validation messages on their fields', async () => {
    const { type, submit, errors } = await setup({}, () =>
      throwError(
        () =>
          new HttpErrorResponse({ status: 400, error: { errors: { icon: ['Choose an icon.'] } } }),
      ),
    );
    type('Dog');
    await submit();
    expect(errors()).toEqual(['Choose an icon.']);
  });

  it('closes with notFound when the edited category is gone', async () => {
    const { submit, dialogRef } = await setup({ category: category({ id: 'x', name: 'X' }) }, () =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await submit();
    expect(dialogRef.close).toHaveBeenCalledWith({ status: 'notFound' });
  });
});
