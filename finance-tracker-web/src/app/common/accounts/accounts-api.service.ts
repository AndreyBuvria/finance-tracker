import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import { Account, AccountList, AccountRequest } from './account.model';

/** Accounts API (PLAN.md §7 "Accounts contract (agreed)"). */
@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/accounts`;

  list(includeArchived = false): Observable<AccountList> {
    return this.http.get<AccountList>(this.url, { params: { includeArchived } });
  }

  create(request: AccountRequest): Observable<Account> {
    return this.http.post<Account>(this.url, request);
  }

  update(id: string, request: AccountRequest): Observable<Account> {
    return this.http.put<Account>(`${this.url}/${encodeURIComponent(id)}`, request);
  }

  /** Archives the account (the API never hard-deletes it). */
  archive(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${encodeURIComponent(id)}/restore`, null);
  }
}
