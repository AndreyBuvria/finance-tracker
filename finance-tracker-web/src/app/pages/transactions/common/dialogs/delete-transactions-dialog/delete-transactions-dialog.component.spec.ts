import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import '@common/locale/locale.utils';
import { DeleteTransactionsDialogComponent } from './delete-transactions-dialog.component';
import { DeleteTransactionsDialogData } from './delete-transactions-dialog.model';

const visible = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

describe('DeleteTransactionsDialogComponent', () => {
  async function setup(data: DeleteTransactionsDialogData) {
    const close = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(DeleteTransactionsDialogComponent);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, close };
  }

  it('asks with the count and the signed total', async () => {
    const { el } = await setup({
      count: 3,
      total: { amount: 212, kind: 'expense' },
      includesImported: false,
    });
    expect(visible(el.querySelector('h2')?.textContent)).toBe(
      'Delete 3 transactions (−212,00 zł)?',
    );
    expect(el.querySelector('.hint')).toBeNull();
  });

  it('uses the singular and warns about imported rows', async () => {
    const { el } = await setup({
      count: 1,
      total: { amount: 24, kind: 'expense' },
      includesImported: true,
    });
    expect(visible(el.querySelector('h2')?.textContent)).toBe('Delete 1 transaction (−24,00 zł)?');
    expect(visible(el.querySelector('.hint')?.textContent)).toBe(
      "This won't be re-imported from the same statement.",
    );
  });

  it('confirms with true', async () => {
    const { el, close } = await setup({
      count: 1,
      total: { amount: 1, kind: 'income' },
      includesImported: false,
    });
    el.querySelector<HTMLButtonElement>('button.danger')!.click();
    expect(close).toHaveBeenCalledWith(true);
  });
});
