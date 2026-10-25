import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { category } from '../../../testing/category-fixtures.utils';
import { DeleteCategoryDialogComponent } from './delete-category-dialog.component';

describe('DeleteCategoryDialogComponent', () => {
  it('names the category and says what goes with it', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { category: category({ name: 'Dog' }) } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(DeleteCategoryDialogComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const text = (s: string) =>
      (el.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(text('h2')).toBe('Delete Dog?');
    expect(text('p')).toBe("Its budgets, rules and alerts are deleted too. This can't be undone.");
    expect(
      Array.from(el.querySelectorAll('button')).map((b) => (b.textContent ?? '').trim()),
    ).toEqual(['Cancel', 'Delete']);
  });
});
