import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config.token';
import { BulkTransactionActionEnum } from './bulk-transaction-action.enum';
import { TransactionPage } from './transaction.model';
import { TransactionSortFieldEnum } from './transaction-sort.enum';
import { TransactionTypeEnum } from './transaction-type.enum';
import { TransactionsApiService } from './transactions-api.service';

describe('TransactionsApiService', () => {
  let api: TransactionsApiService;
  let http: HttpTestingController;

  const empty: TransactionPage = {
    items: [],
    page: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 0,
    totals: { income: 0, expenses: 0, net: 0 },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(TransactionsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists without parameters when no filter is set', () => {
    api.list().subscribe();
    const req = http.expectOne('/api/transactions');
    expect(req.request.method).toBe('GET');
    req.flush(empty);
  });

  it('sends every filter, repeats categoryId and writes decimals with a dot', () => {
    let result: TransactionPage | undefined;
    api
      .list({
        from: '2026-10-01',
        to: '2026-10-31',
        accountId: 'a1',
        categoryIds: ['c1', 'c2'],
        type: TransactionTypeEnum.Expense,
        minAmount: 10.5,
        maxAmount: 200,
        q: 'żabka',
        page: 2,
        pageSize: 50,
        sort: `-${TransactionSortFieldEnum.Amount}`,
      })
      .subscribe((page) => (result = page));
    const req = http.expectOne((r) => r.url === '/api/transactions');
    const params = req.request.params;
    expect(params.get('from')).toBe('2026-10-01');
    expect(params.get('to')).toBe('2026-10-31');
    expect(params.get('accountId')).toBe('a1');
    expect(params.getAll('categoryId')).toEqual(['c1', 'c2']);
    expect(params.get('type')).toBe('Expense');
    expect(params.get('minAmount')).toBe('10.5');
    expect(params.get('maxAmount')).toBe('200');
    expect(params.get('q')).toBe('żabka');
    expect(params.get('page')).toBe('2');
    expect(params.get('pageSize')).toBe('50');
    expect(params.get('sort')).toBe('-amount');
    req.flush(empty);
    expect(result).toEqual(empty);
  });

  it('leaves out empty filters', () => {
    api.list({ accountId: null, categoryIds: [], q: '', minAmount: null }).subscribe();
    http.expectOne('/api/transactions').flush(empty);
  });

  it('runs a bulk action', () => {
    let affected = 0;
    api
      .bulk({
        action: BulkTransactionActionEnum.Recategorize,
        transactionIds: ['t1', 't2'],
        categoryId: 'c1',
      })
      .subscribe((result) => (affected = result.affectedCount));
    const req = http.expectOne('/api/transactions/bulk');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      action: 'Recategorize',
      transactionIds: ['t1', 't2'],
      categoryId: 'c1',
    });
    req.flush({ affectedCount: 2 });
    expect(affected).toBe(2);
  });

  it('creates, replaces and deletes a transaction', () => {
    const request = {
      type: TransactionTypeEnum.Expense as const,
      amount: 24,
      date: '2026-10-19',
      accountId: 'a1',
      categoryId: 'c1',
      merchant: 'Bolt',
      note: null,
    };
    api.create(request).subscribe();
    const create = http.expectOne('/api/transactions');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});

    api.update('t1', request).subscribe();
    expect(http.expectOne('/api/transactions/t1').request.method).toBe('PUT');

    api.delete('t1').subscribe();
    expect(http.expectOne((r) => r.method === 'DELETE').request.url).toBe('/api/transactions/t1');
  });

  it('suggests merchants', () => {
    api.merchants('ża').subscribe();
    http.expectOne('/api/transactions/merchants?q=%C5%BCa&limit=10').flush({ items: [] });
  });
});
