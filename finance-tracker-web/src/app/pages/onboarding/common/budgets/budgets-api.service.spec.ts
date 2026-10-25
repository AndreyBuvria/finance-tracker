import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@common/config/api-config.token';
import { BudgetsApiService } from './budgets-api.service';

describe('BudgetsApiService', () => {
  let api: BudgetsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(BudgetsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sets the limit of a category for a month', () => {
    let saved: unknown;
    api.setLimit('c1', '2026-10', 600).subscribe((budget) => (saved = budget));
    const req = http.expectOne('/api/budgets/c1?month=2026-10');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ limitAmount: 600 });
    req.flush({ categoryId: 'c1', month: '2026-10', limitAmount: 600 });
    expect(saved).toEqual({ categoryId: 'c1', month: '2026-10', limitAmount: 600 });
  });

  it('removes a limit with null (204)', () => {
    let saved: unknown = 'pending';
    api.setLimit('c1', '2026-10', null).subscribe((budget) => (saved = budget));
    const req = http.expectOne('/api/budgets/c1?month=2026-10');
    expect(req.request.body).toEqual({ limitAmount: null });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(saved).toBeNull();
  });
});
