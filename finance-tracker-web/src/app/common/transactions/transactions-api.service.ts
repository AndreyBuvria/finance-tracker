import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import {
  BulkTransactionRequest,
  BulkTransactionResult,
  MerchantList,
  Transaction,
  TransactionListQuery,
  TransactionPage,
  TransactionRequest,
} from './transaction.model';

/** Transactions API (PLAN.md §7 "Transactions contract (agreed)"). */
@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/transactions`;

  /** One page plus the count and footer totals of the whole filtered set. */
  list(query: TransactionListQuery = {}): Observable<TransactionPage> {
    return this.http.get<TransactionPage>(this.url, { params: toListParams(query) });
  }

  create(request: TransactionRequest): Observable<Transaction> {
    return this.http.post<Transaction>(this.url, request);
  }

  /** Full replace of an expense or income. */
  update(id: string, request: TransactionRequest): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.url}/${encodeURIComponent(id)}`, request);
  }

  /** Deletes a transaction; a transfer row deletes the whole pair. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  /** Past merchants for autocomplete (prefix matches first, then most recent). */
  merchants(q: string, limit = 10): Observable<MerchantList> {
    return this.http.get<MerchantList>(`${this.url}/merchants`, { params: { q, limit } });
  }

  /** Deletes or recategorizes the selected transactions, all or nothing. */
  bulk(request: BulkTransactionRequest): Observable<BulkTransactionResult> {
    return this.http.post<BulkTransactionResult>(`${this.url}/bulk`, request);
  }
}

/** Query string of `GET /transactions`; empty filters are left out. Decimals use a dot. */
function toListParams(query: TransactionListQuery): HttpParams {
  let params = new HttpParams();
  const set = (name: string, value: string | number | null | undefined) => {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(name, value);
    }
  };
  set('from', query.from);
  set('to', query.to);
  set('accountId', query.accountId);
  for (const id of query.categoryIds ?? []) {
    params = params.append('categoryId', id);
  }
  set('type', query.type);
  set('minAmount', query.minAmount);
  set('maxAmount', query.maxAmount);
  set('q', query.q);
  set('page', query.page);
  set('pageSize', query.pageSize);
  set('sort', query.sort);
  return params;
}
