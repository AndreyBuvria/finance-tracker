import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config.token';
import { AccountTypeEnum } from './account-type.enum';
import { Account, AccountRequest } from './account.model';
import { AccountsApiService } from './accounts-api.service';

describe('AccountsApiService', () => {
  let api: AccountsApiService;
  let http: HttpTestingController;

  const account: Account = {
    id: 'a1',
    name: 'mBank card',
    type: AccountTypeEnum.Card,
    currency: 'PLN',
    initialBalance: 100,
    balance: 2340.15,
    isArchived: false,
  };
  const request: AccountRequest = {
    name: 'mBank card',
    type: AccountTypeEnum.Card,
    currency: 'PLN',
    initialBalance: 100,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(AccountsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists accounts, with archived ones on request', () => {
    let netWorth = 0;
    api.list(true).subscribe((list) => (netWorth = list.netWorth));
    const req = http.expectOne('/api/accounts?includeArchived=true');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [account], netWorth: 2340.15 });
    expect(netWorth).toBe(2340.15);

    api.list().subscribe();
    http.expectOne('/api/accounts?includeArchived=false').flush({ items: [], netWorth: 0 });
  });

  it('creates an account', () => {
    api.create(request).subscribe();
    const req = http.expectOne('/api/accounts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(account);
  });

  it('replaces an account', () => {
    api.update('a1', request).subscribe();
    const req = http.expectOne('/api/accounts/a1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(request);
    req.flush(account);
  });

  it('archives and restores an account', () => {
    api.archive('a1').subscribe();
    expect(http.expectOne('/api/accounts/a1').request.method).toBe('DELETE');

    api.restore('a1').subscribe();
    expect(http.expectOne('/api/accounts/a1/restore').request.method).toBe('POST');
  });
});
