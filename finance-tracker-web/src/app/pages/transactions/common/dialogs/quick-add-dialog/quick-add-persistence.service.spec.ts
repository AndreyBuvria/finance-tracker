import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TransactionSourceEnum } from '@common/transactions/transaction-source.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import { TransactionsApiService } from '@common/transactions/transactions-api.service';
import { TransfersApiService } from '@common/transactions/transfers-api.service';
import { firstValueFrom, of } from 'rxjs';
import { IDS, transaction, transfer } from '../../../testing/transaction-fixtures.utils';
import { QuickAddFormValue } from '../../models/quick-add-form.model';
import { DeleteTransactionsDialogComponent } from '../delete-transactions-dialog/delete-transactions-dialog.component';
import { QuickAddPersistenceService } from './quick-add-persistence.service';

const VALUE: QuickAddFormValue = {
  type: TransactionTypeEnum.Expense,
  amount: '12,50',
  categoryId: IDS.groceries,
  merchant: ' Żabka ',
  note: '',
  date: new Date(2026, 9, 19),
  accountId: IDS.mbank,
  fromAccountId: IDS.mbank,
  toAccountId: IDS.savings,
};

describe('QuickAddPersistenceService', () => {
  function setup(confirmed?: boolean) {
    const transactionsApi = {
      create: vi.fn(() => of(transaction())),
      update: vi.fn(() => of(transaction())),
      delete: vi.fn(() => of(undefined)),
    };
    const transfersApi = {
      create: vi.fn(() => of(transfer())),
      update: vi.fn(() => of(transfer())),
      delete: vi.fn(() => of(undefined)),
    };
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(confirmed) })) };
    TestBed.configureTestingModule({
      providers: [
        { provide: TransactionsApiService, useValue: transactionsApi },
        { provide: TransfersApiService, useValue: transfersApi },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    return {
      service: TestBed.inject(QuickAddPersistenceService),
      transactionsApi,
      transfersApi,
      dialog,
    };
  }

  it('creates a transaction, or replaces the edited one', async () => {
    const { service, transactionsApi } = setup();
    await firstValueFrom(service.save(VALUE, null));
    expect(transactionsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12.5, merchant: 'Żabka', note: null }),
    );
    await firstValueFrom(service.save(VALUE, transaction({ id: 't9' })));
    expect(transactionsApi.update).toHaveBeenCalledWith('t9', expect.anything());
  });

  it('saves transfers through /transfers, by pair ID when editing', async () => {
    const { service, transfersApi } = setup();
    const value = { ...VALUE, type: TransactionTypeEnum.Transfer };
    await firstValueFrom(service.save(value, null));
    expect(transfersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ fromAccountId: IDS.mbank, toAccountId: IDS.savings }),
    );
    await firstValueFrom(service.save(value, transfer()));
    expect(transfersApi.update).toHaveBeenCalledWith('pair1', expect.anything());
  });

  it('confirms a delete with the amount and an import warning', async () => {
    const { service, dialog } = setup(true);
    const row = transaction({ source: TransactionSourceEnum.Csv });
    expect(await firstValueFrom(service.confirmDelete(row))).toBe(true);
    expect(dialog.open).toHaveBeenCalledWith(
      DeleteTransactionsDialogComponent,
      expect.objectContaining({
        data: { count: 1, total: { amount: 18.47, kind: 'expense' }, includesImported: true },
      }),
    );
  });

  it('treats a dismissed confirmation as "no"', async () => {
    const { service } = setup(undefined);
    expect(await firstValueFrom(service.confirmDelete(transaction()))).toBe(false);
  });

  it('deletes a transaction, or the whole transfer pair', async () => {
    const { service, transactionsApi, transfersApi } = setup();
    await firstValueFrom(service.delete(transaction()), { defaultValue: undefined });
    expect(transactionsApi.delete).toHaveBeenCalledWith('t1');
    await firstValueFrom(service.delete(transfer()), { defaultValue: undefined });
    expect(transfersApi.delete).toHaveBeenCalledWith('pair1');
  });
});
