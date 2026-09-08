import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, catchError, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MainCategory, ServiceCategory, Subcategory, Service } from '../models/provider.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private _categories$: Observable<MainCategory[]> | null = null;

  getMainCategories(): Observable<MainCategory[]> {
    this._categories$ ??= this.http.get<MainCategory[]>(`${this.api}/categories/main-categories`)
      .pipe(
        catchError(err => {
          this._categories$ = null; // limpiar caché en error para que el próximo intento reintente la petición
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    return this._categories$;
  }

  getCategoryWithServices(id: number): Observable<MainCategory> {
    return this.http.get<MainCategory>(`${this.api}/categories/main-categories/${id}`);
  }

  getServices(params?: { category_id?: number; main_category_id?: number }): Observable<ServiceCategory[]> {
    const queryParams: any = {};
    if (params?.category_id) {
      queryParams.main_category_id = params.category_id;
    } else if (params?.main_category_id) {
      queryParams.main_category_id = params.main_category_id;
    }
    return this.http.get<ServiceCategory[]>(`${this.api}/categories/services`, { params: queryParams });
  }

  getServiceCatalog(query?: string): Observable<ServiceCategory[]> {
    let params = new HttpParams();
    const normalizedQuery = (query ?? '').trim();
    if (normalizedQuery.length > 0) {
      params = params.set('q', normalizedQuery);
    }

    return this.http.get<Array<{
      id: number;
      name: string;
      description?: string | null;
      icon?: string | null;
      subcategory_id: number;
      service_category_id?: number | null;
    }>>(`${this.api}/categories/services-catalog`, { params }).pipe(
      map(services => services
        .map(service => ({
          id: service.service_category_id ?? service.id,
          name: service.name,
          description: service.description ?? '',
          icon: service.icon ?? '',
          main_category_id: 0,
        }))
      )
    );
  }

  getSubcategories(mainCategoryId: number): Observable<Subcategory[]> {
    return this.http.get<Subcategory[]>(
      `${this.api}/categories/main-categories/${mainCategoryId}/subcategories`
    ).pipe(shareReplay(1));
  }

  getServicesBySubcategory(subcategoryId: number): Observable<Service[]> {
    return this.http.get<Service[]>(
      `${this.api}/categories/subcategories/${subcategoryId}/services`
    );
  }
}
