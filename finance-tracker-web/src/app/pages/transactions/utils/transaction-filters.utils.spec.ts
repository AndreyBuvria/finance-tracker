import { convertToParamMap } from '@angular/router';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import {
  clearedFilters,
  defaultFilters,
  hasActiveFilters,
  parseFilters,
  toListQuery,
  toQueryParams,
} from './transaction-filters.utils';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const GROCERIES = '22222222-2222-4222-8222-222222222222';
const TRANSPORT = '33333333-3333-4333-8333-333333333333';
const CURRENT = new Date(2026, 9, 1);

const parse = (params: Record<string, string | string[]>) =>
  parseFilters(convertToParamMap(params), CURRENT);

describe('parseFilters', () => {
  it('defaults to the current month, newest first, page 1 and no filters', () => {
    expect(parse({})).toEqual(defaultFilters(CURRENT));
    expect(parse({}).sort).toBe('-date');
  });

  it('reads every filter from the URL', () => {
    expect(
      parse({
        month: '2026-09',
        from: '2026-09-01',
        to: '2026-09-15',
        account: ACCOUNT,
        category: [GROCERIES, TRANSPORT],
        type: 'Expense',
        min: '10.5',
        max: '200',
        q: '  żabka ',
        page: '3',
        sort: 'amount',
      }),
    ).toEqual({
      month: new Date(2026, 8, 1),
      from: '2026-09-01',
      to: '2026-09-15',
      accountId: ACCOUNT,
      categoryIds: [GROCERIES, TRANSPORT],
      type: TransactionTypeEnum.Expense,
      minAmount: 10.5,
      maxAmount: 200,
      q: 'żabka',
      page: 3,
      sort: 'amount',
    });
  });

  it('ignores unreadable values instead of failing', () => {
    expect(
      parse({
        month: '2026-13',
        from: '2026-02-30',
        account: 'abc',
        category: ['nope', GROCERIES, GROCERIES],
        type: 'Refund',
        min: '-5',
        max: '1,5',
        page: '0',
        sort: 'price',
      }),
    ).toEqual({ ...defaultFilters(CURRENT), categoryIds: [GROCERIES] });
  });

  it('drops a range end or a maximum that comes before its start', () => {
    const filters = parse({ from: '2026-10-10', to: '2026-10-01', min: '50', max: '10' });
    expect(filters.from).toBe('2026-10-10');
    expect(filters.to).toBeNull();
    expect(filters.minAmount).toBe(50);
    expect(filters.maxAmount).toBeNull();
  });

  it('limits the search to 100 characters', () => {
    expect(parse({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('toQueryParams', () => {
  it('always writes the month and leaves out the other defaults', () => {
    expect(toQueryParams(defaultFilters(CURRENT))).toEqual({ month: '2026-10' });
  });

  it('round-trips through the URL', () => {
    const filters = parse({
      month: '2026-09',
      account: ACCOUNT,
      category: [GROCERIES],
      type: 'Income',
      min: '0',
      max: '99.99',
      q: 'bolt',
      page: '2',
      sort: '-amount',
    });
    const params = toQueryParams(filters);
    expect(params).toEqual({
      month: '2026-09',
      account: ACCOUNT,
      category: [GROCERIES],
      type: 'Income',
      min: '0',
      max: '99.99',
      q: 'bolt',
      page: '2',
      sort: '-amount',
    });
    expect(parseFilters(convertToParamMap(params), CURRENT)).toEqual(filters);
  });
});

describe('toListQuery', () => {
  it('sends the whole month as from/to', () => {
    expect(toListQuery(defaultFilters(new Date(2026, 1, 1)))).toMatchObject({
      from: '2026-02-01',
      to: '2026-02-28',
      page: 1,
      pageSize: 50,
      sort: '-date',
      q: null,
    });
  });

  it('sends the date range instead of the month when set', () => {
    const query = toListQuery({ ...defaultFilters(CURRENT), from: '2026-01-05', to: null });
    expect(query.from).toBe('2026-01-05');
    expect(query.to).toBeNull();
  });

  it('passes the other filters through', () => {
    const query = toListQuery({
      ...defaultFilters(CURRENT),
      accountId: ACCOUNT,
      categoryIds: [GROCERIES],
      type: TransactionTypeEnum.Transfer,
      minAmount: 1,
      maxAmount: 2,
      q: 'x',
    });
    expect(query).toMatchObject({
      accountId: ACCOUNT,
      categoryIds: [GROCERIES],
      type: 'Transfer',
      minAmount: 1,
      maxAmount: 2,
      q: 'x',
    });
  });
});

describe('hasActiveFilters / clearedFilters', () => {
  it('does not count the month, page or sort as filters', () => {
    expect(
      hasActiveFilters({ ...defaultFilters(new Date(2026, 0, 1)), page: 4, sort: 'amount' }),
    ).toBe(false);
  });

  it.each([
    { from: '2026-10-01' },
    { accountId: ACCOUNT },
    { categoryIds: [GROCERIES] },
    { type: TransactionTypeEnum.Income },
    { minAmount: 0 },
    { maxAmount: 5 },
    { q: 'x' },
  ])('counts %o', (change) => {
    expect(hasActiveFilters({ ...defaultFilters(CURRENT), ...change })).toBe(true);
  });

  it('clears the filters but keeps the month and sort', () => {
    const filters = parse({ month: '2026-09', q: 'x', type: 'Expense', page: '2', sort: 'amount' });
    expect(clearedFilters(filters)).toEqual({
      ...defaultFilters(new Date(2026, 8, 1)),
      sort: 'amount',
    });
  });
});
