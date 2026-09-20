import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MainCategory, ServiceCategory } from '../models/provider.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private _categories$: Observable<MainCategory[]> | null = null;

  getMainCategories(): Observable<MainCategory[]> {
    if (!this._categories$) {
      this._categories$ = this.http.get<MainCategory[]>(`${this.api}/categories/main-categories`)
        .pipe(shareReplay(1));
    }
    return this._categories$;
  }

  getCategoryWithServices(id: number): Observable<MainCategory> {
    return this.http.get<MainCategory>(`${this.api}/categories/main-categories/${id}`);
  }

  getServices(params?: { category_id?: number; main_category_id?: number }): Observable<ServiceCategory[]> {
    // Soportar ambos nombres de parámetro por compatibilidad
    const queryParams: any = {};
    if (params?.category_id) {
      queryParams.main_category_id = params.category_id;
    } else if (params?.main_category_id) {
      queryParams.main_category_id = params.main_category_id;
    }
    return this.http.get<ServiceCategory[]>(`${this.api}/categories/services`, { params: queryParams });
  }
}
