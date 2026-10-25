import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-config.token';
import {
  Category,
  CategoryList,
  CategoryListQuery,
  CategoryRequest,
  MergeCategoryResult,
  TopCategoriesQuery,
} from './category.model';

/** Categories API (PLAN.md §7 "Categories contract (agreed)"). */
@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/categories`;

  list(query: CategoryListQuery = {}): Observable<CategoryList> {
    let params = new HttpParams().set('includeArchived', query.includeArchived ?? false);
    if (query.type) {
      params = params.set('type', query.type);
    }
    return this.http.get<CategoryList>(this.url, { params });
  }

  /** The most used active categories of the last 90 days (quick add grid). */
  top(query: TopCategoriesQuery = {}): Observable<CategoryList> {
    let params = new HttpParams().set('limit', query.limit ?? 8);
    if (query.type) {
      params = params.set('type', query.type);
    }
    return this.http.get<CategoryList>(`${this.url}/top`, { params });
  }

  create(request: CategoryRequest): Observable<Category> {
    return this.http.post<Category>(this.url, request);
  }

  /** Full replace: send the current icon, color and type too. */
  update(id: string, request: CategoryRequest): Observable<Category> {
    return this.http.put<Category>(this.byId(id), request);
  }

  /** Deletes a custom category without transactions, with its budgets, rules and alerts. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(this.byId(id));
  }

  /** Hides a default category or archives a custom one (idempotent). */
  archive(id: string): Observable<void> {
    return this.http.post<void>(`${this.byId(id)}/archive`, null);
  }

  restore(id: string): Observable<void> {
    return this.http.post<void>(`${this.byId(id)}/restore`, null);
  }

  /** Moves everything of `id` into `targetCategoryId`, then archives `id`. */
  merge(id: string, targetCategoryId: string): Observable<MergeCategoryResult> {
    return this.http.post<MergeCategoryResult>(`${this.byId(id)}/merge`, { targetCategoryId });
  }

  private byId(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
