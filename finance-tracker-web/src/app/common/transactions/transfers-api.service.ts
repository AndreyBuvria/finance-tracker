import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import { Transaction, TransferRequest } from './transaction.model';

/** Transfers between own accounts (PLAN.md §7 "Transfers contract (agreed)"). */
@Injectable({ providedIn: 'root' })
export class TransfersApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/transfers`;

  /** Creates both sides; returns the Out row with `transfer` set. */
  create(request: TransferRequest): Observable<Transaction> {
    return this.http.post<Transaction>(this.url, request);
  }

  /** Updates both sides together. */
  update(transferPairId: string, request: TransferRequest): Observable<Transaction> {
    return this.http.put<Transaction>(`${this.url}/${encodeURIComponent(transferPairId)}`, request);
  }

  delete(transferPairId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(transferPairId)}`);
  }
}
