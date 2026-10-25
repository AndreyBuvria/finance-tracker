import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-config.token';
import { CategoriesApiService } from './categories-api.service';
import { CategoryTypeEnum } from './category-type.enum';

describe('CategoriesApiService', () => {
  let api: CategoriesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    api = TestBed.inject(CategoriesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists active categories by default', () => {
    api.list().subscribe();
    const req = http.expectOne('/api/categories?includeArchived=false');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });

  it('lists archived ones and one type on request', () => {
    api.list({ includeArchived: true, type: CategoryTypeEnum.Income }).subscribe();
    http.expectOne('/api/categories?includeArchived=true&type=Income').flush({ items: [] });
  });

  it('lists the top categories of a type', () => {
    api.top({ type: CategoryTypeEnum.Expense }).subscribe();
    http.expectOne('/api/categories/top?limit=8&type=Expense').flush({ items: [] });
  });

  describe('writes', () => {
    const request = { name: 'Dog', type: CategoryTypeEnum.Expense, icon: 'pets', color: '#6d4c41' };

    it('creates and replaces a category', () => {
      api.create(request).subscribe();
      const create = http.expectOne('/api/categories');
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual(request);
      create.flush({});

      api.update('c 1', request).subscribe();
      const update = http.expectOne('/api/categories/c%201');
      expect(update.request.method).toBe('PUT');
      expect(update.request.body).toEqual(request);
      update.flush({});
    });

    it('deletes, archives and restores a category', () => {
      api.delete('c1').subscribe();
      expect(http.expectOne('/api/categories/c1').request.method).toBe('DELETE');
      api.archive('c1').subscribe();
      expect(http.expectOne('/api/categories/c1/archive').request.method).toBe('POST');
      api.restore('c1').subscribe();
      expect(http.expectOne('/api/categories/c1/restore').request.method).toBe('POST');
    });

    it('merges a category into another one', () => {
      let moved = 0;
      api.merge('c1', 'c2').subscribe((result) => (moved = result.transactionsMoved));
      const req = http.expectOne('/api/categories/c1/merge');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ targetCategoryId: 'c2' });
      req.flush({ transactionsMoved: 34, budgetsMoved: 1, rulesMoved: 0, target: {} });
      expect(moved).toBe(34);
    });
  });
});
