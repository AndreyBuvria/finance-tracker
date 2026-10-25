import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config.token';
import { TransferRequest } from './transaction.model';
import { TransfersApiService } from './transfers-api.service';

describe('TransfersApiService', () => {
  let api: TransfersApiService;
  let http: HttpTestingController;
  const request: TransferRequest = {
    fromAccountId: 'a1',
    toAccountId: 'a2',
    amount: 1000,
    date: '2026-10-19',
    note: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(TransfersApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates, updates and deletes a transfer pair', () => {
    api.create(request).subscribe();
    const create = http.expectOne('/api/transfers');
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(request);
    create.flush({});

    api.update('p1', request).subscribe();
    const update = http.expectOne('/api/transfers/p1');
    expect(update.request.method).toBe('PUT');
    update.flush({});

    api.delete('p1').subscribe();
    expect(http.expectOne('/api/transfers/p1').request.method).toBe('DELETE');
  });
});
