import { Params, ParamMap } from '@angular/router';
import { parseIsoDate, parseMonthKey, toIsoDate, toMonthKey } from '@common/date/iso-date.utils';
import { endOfMonth } from '@common/date/month.utils';
import { TransactionListQuery, TransactionSort } from '@common/transactions/transaction.model';
import { TransactionSortFieldEnum } from '@common/transactions/transaction-sort.enum';
import { TransactionTypeEnum } from '@common/transactions/transaction-type.enum';
import {
  DEFAULT_TRANSACTION_SORT,
  SEARCH_MAX_LENGTH,
  TRANSACTION_QUERY_PARAMS as P,
  TRANSACTIONS_PAGE_SIZE,
} from '../common/constants/transactions-page.constants';
import { TransactionFilters } from '../common/models/transaction-filters.model';

/** IDs are GUIDs; anything else in a hand-edited URL is ignored instead of failing the request. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Amounts in the URL use a dot and at most 2 decimals: "12.5". */
const URL_AMOUNT = /^\d{1,13}(\.\d{1,2})?$/;
const PAGE = /^[1-9]\d{0,5}$/;

const SORT_FIELDS = new Set<string>(Object.values(TransactionSortFieldEnum));
const TYPES = new Set<string>(Object.values(TransactionTypeEnum));

/** Filters for the given month, with nothing else set. */
export function defaultFilters(month: Date): TransactionFilters {
  return {
    month,
    from: null,
    to: null,
    accountId: null,
    categoryIds: [],
    type: null,
    minAmount: null,
    maxAmount: null,
    q: '',
    page: 1,
    sort: DEFAULT_TRANSACTION_SORT,
  };
}

/**
 * Reads the page state from the URL. Missing or unreadable values fall back to their defaults (the
 * current month, newest first, page 1), so a mistyped link still shows a sensible list.
 */
export function parseFilters(params: ParamMap, currentMonth: Date): TransactionFilters {
  const text = (name: string) => params.get(name)?.trim() ?? '';
  const id = (value: string) => (ID.test(value) ? value : null);

  const from = parseIsoDate(text(P.from)) ? text(P.from) : null;
  let to = parseIsoDate(text(P.to)) ? text(P.to) : null;
  if (from && to && to < from) {
    to = null;
  }
  const minAmount = parseUrlAmount(text(P.min));
  let maxAmount = parseUrlAmount(text(P.max));
  if (minAmount !== null && maxAmount !== null && maxAmount < minAmount) {
    maxAmount = null;
  }
  const type = text(P.type);
  const sort = text(P.sort);

  return {
    month: parseMonthKey(text(P.month)) ?? currentMonth,
    from,
    to,
    accountId: id(text(P.account)),
    categoryIds: [
      ...new Set(params.getAll(P.category).map((value) => id(value.trim()) ?? '')),
    ].filter(Boolean),
    type: TYPES.has(type) ? (type as TransactionTypeEnum) : null,
    minAmount,
    maxAmount,
    q: text(P.q).slice(0, SEARCH_MAX_LENGTH).trim(),
    page: PAGE.test(text(P.page)) ? Number(text(P.page)) : 1,
    sort: isSort(sort) ? sort : DEFAULT_TRANSACTION_SORT,
  };
}

/**
 * The URL query params for `filters`. The month is always written, so a copied link shows the same
 * month later; other defaults are left out so URLs stay short.
 */
export function toQueryParams(filters: TransactionFilters): Params {
  const params: Params = {};
  const set = (name: string, value: string | readonly string[] | null) => {
    if (value !== null && value !== '' && !(Array.isArray(value) && value.length === 0)) {
      params[name] = value;
    }
  };
  set(P.month, toMonthKey(filters.month));
  set(P.from, filters.from);
  set(P.to, filters.to);
  set(P.account, filters.accountId);
  set(P.category, filters.categoryIds);
  set(P.type, filters.type);
  set(P.min, filters.minAmount === null ? null : String(filters.minAmount));
  set(P.max, filters.maxAmount === null ? null : String(filters.maxAmount));
  set(P.q, filters.q);
  set(P.page, filters.page === 1 ? null : String(filters.page));
  set(P.sort, filters.sort === DEFAULT_TRANSACTION_SORT ? null : filters.sort);
  return params;
}

/** The `GET /transactions` query: the date range when set, otherwise the whole month. */
export function toListQuery(filters: TransactionFilters): TransactionListQuery {
  const hasRange = hasDateRange(filters);
  return {
    from: hasRange ? filters.from : toIsoDate(filters.month),
    to: hasRange ? filters.to : toIsoDate(endOfMonth(filters.month)),
    accountId: filters.accountId,
    categoryIds: filters.categoryIds,
    type: filters.type,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    q: filters.q || null,
    page: filters.page,
    pageSize: TRANSACTIONS_PAGE_SIZE,
    sort: filters.sort,
  };
}

/** A date range replaces the month. */
export function hasDateRange(filters: TransactionFilters): boolean {
  return filters.from !== null || filters.to !== null;
}

/** Whether any filter shown as a removable chip is set (everything but month, page and sort). */
export function hasActiveFilters(filters: TransactionFilters): boolean {
  const defaults = defaultFilters(filters.month);
  return (
    filters.from !== defaults.from ||
    filters.to !== defaults.to ||
    filters.accountId !== defaults.accountId ||
    filters.categoryIds.length > 0 ||
    filters.type !== defaults.type ||
    filters.minAmount !== defaults.minAmount ||
    filters.maxAmount !== defaults.maxAmount ||
    filters.q !== defaults.q
  );
}

/** "Clear filters": removes every chip filter, keeps the month and the sort order. */
export function clearedFilters(filters: TransactionFilters): TransactionFilters {
  return { ...defaultFilters(filters.month), sort: filters.sort };
}

function parseUrlAmount(text: string): number | null {
  return URL_AMOUNT.test(text) ? Number(text) : null;
}

function isSort(value: string): value is TransactionSort {
  return SORT_FIELDS.has(value.startsWith('-') ? value.slice(1) : value);
}
