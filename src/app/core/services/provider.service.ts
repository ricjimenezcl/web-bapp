import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, map, switchMap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProviderProfile, ServiceProvider, ProviderStats, ProviderWorkingHours } from '../models/provider.model';

@Injectable({ providedIn: 'root' })
export class ProviderService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private _profile  = signal<ProviderProfile | null>(null);
  private _services = signal<ServiceProvider[]>([]);
  private _stats    = signal<ProviderStats | null>(null);
  private _loading  = signal<boolean>(false);

  readonly profile  = this._profile.asReadonly();
  readonly services = this._services.asReadonly();
  readonly stats    = this._stats.asReadonly();
  readonly loading  = this._loading.asReadonly();

  getMyProfile(): Observable<ProviderProfile> {
    return this.http.get<ProviderProfile>(`${this.api}/providers/me`).pipe(
      tap(p => this._profile.set(p))
    );
  }

  getProviderProfile(id: number): Observable<ProviderProfile> {
    return this.http.get<ProviderProfile>(`${this.api}/providers/${id}`);
  }

  /**
   * Obtiene el perfil completo del proveedor incluyendo todos sus servicios.
   * Endpoint: GET /providers/{id}/detailed
   * Respuesta incluye: id, full_name, bio, rating_avg, total_reviews, services[], etc.
   */
  getProviderDetailedProfile(id: number): Observable<ProviderProfile> {
    return this.http.get<ProviderProfile>(`${this.api}/providers/${id}/detailed`);
  }

  updateProfile(data: Partial<ProviderProfile>): Observable<ProviderProfile> {
    return this.http.patch<ProviderProfile>(`${this.api}/providers/me`, data).pipe(
      tap(p => this._profile.set(p))
    );
  }

  getMyServices(): Observable<ServiceProvider[]> {
    return this.http.get<ProviderProfile>(`${this.api}/providers/me`).pipe(
      switchMap(profile => 
        this.http.get<any[]>(`${this.api}/providers/services/${profile.id}`).pipe(
          map(items => items.map(item => ({
            ...item,
            avatar: item.provider?.avatar || item.avatar,
            full_name: item.provider?.full_name || item.full_name
          } as ServiceProvider))),
          tap(s => this._services.set(s))
        )
      ),
      catchError(err => {
        console.error('Error loading provider services:', err);
        return of([]);
      })
    );
  }

  getProviderServices(id: number): Observable<ServiceProvider[]> {
    return this.http.get<any[]>(`${this.api}/providers/services/${id}`).pipe(
      map(items => items.map(item => ({
        ...item,
        avatar: item.provider?.avatar || item.avatar,
        full_name: item.provider?.full_name || item.full_name
      } as ServiceProvider)))
    );
  }

  /**
   * Crea un servicio nuevo.
   * El payload debe usar los nombres de campo del backend (español):
   *   servicio, categoria, nombre_prestador, fono, detalle, direccion, lat, lng, id_contacto
   */
  createService(data: Record<string, unknown>): Observable<ServiceProvider> {
    return this.http.post<ServiceProvider>(`${this.api}/providers/services`, data).pipe(
      tap(s => this._services.update(list => [...list, s]))
    );
  }

  /**
   * Actualiza un servicio existente.
   * Endpoint: PUT /providers/{providerId}/services/{serviceId}
   * Requiere provider_id además del service_id.
   */
  updateService(providerId: number, serviceId: number, data: Partial<ServiceProvider>): Observable<ServiceProvider> {
    return this.http.put<ServiceProvider>(
      `${this.api}/providers/${providerId}/services/${serviceId}`, data
    ).pipe(
      tap(updated => this._services.update(list =>
        list.map(s => s.id === serviceId ? { ...s, ...updated } : s)
      ))
    );
  }

  /**
   * Guarda la disponibilidad horaria de un servicio específico.
   * Endpoint: POST /providers/{providerId}/services/{serviceProviderId}/schedules
   * Tabla: service_availability (usada por el sistema de reservas para available-slots)
   */
  saveServiceSchedule(
    providerId: number,
    serviceProviderId: number,
    data: { day_of_week: number; start_time: string; end_time: string; is_available: boolean }
  ): Observable<any> {
    return this.http.post(
      `${this.api}/providers/${providerId}/services/${serviceProviderId}/schedules`,
      data
    );
  }

  deleteService(serviceId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/providers/services/${serviceId}`).pipe(
      tap(() => this._services.update(list => list.filter(s => s.id !== serviceId)))
    );
  }

  getMyStats(): Observable<ProviderStats> {
    return this.http.get<ProviderProfile>(`${this.api}/providers/me`).pipe(
      switchMap(profile => 
        this.http.get<ProviderStats>(`${this.api}/providers/${profile.id}/stats`)
      ),
      tap(s => this._stats.set(s))
    );
  }

  getNearbyProviders(lat: number, lng: number, radius: number = 10): Observable<ServiceProvider[]> {
    return this.http.get<any[]>(`${this.api}/providers/nearby`, {
      params: { lat: String(lat), lng: String(lng), radius: String(radius) }
    }).pipe(
      map(items => items.map(item => ({
        ...item,
        avatar: item.provider?.avatar || item.avatar,
        full_name: item.provider?.full_name || item.full_name
      } as ServiceProvider)))
    );
  }

  getNearbyProvidersByServiceId(
    lat: number, 
    lng: number, 
    radius: number, 
    serviceId: number,
    skip: number = 0,
    limit: number = 10
  ): Observable<ServiceProvider[]> {
    return this.http.get<any[]>(
      `${this.api}/providers/nearby/service/${serviceId}`,
      {
        params: {
          lat: String(lat),
          lng: String(lng),
          radius: String(radius),
          skip: String(skip),
          limit: String(limit)
        }
      }
    ).pipe(
      map(items => items.map(item => ({
        ...item,
        // Aplanar avatar y full_name del objeto provider anidado al nivel superior
        avatar: item.provider?.avatar || item.avatar,
        full_name: item.provider?.full_name || item.full_name,
        // Incluir campo de disponibilidad (conectado/desconectado)
        is_available: item.is_available ?? true,
        // Incluir rating, reviews e hourly_rate (pueden venir del backend)
        rating_avg: item.rating_avg ?? undefined,
        total_reviews: item.total_reviews ?? undefined,
        hourly_rate: item.hourly_rate ?? undefined,
        // El backend retorna campos planos; construir objeto service_category
        service_category: item.service_category ?? (item.service_category_name ? {
          id: item.service_id,
          name: item.service_category_name,
          icon: item.service_icon ?? null
        } : undefined),
        distance_km: item.distance ?? item.distance_km,
        // Incluir descripción si está disponible
        description: item.description ?? undefined
      } as ServiceProvider))),
      catchError(err => {
        console.error('Error fetching nearby providers by service:', err);
        return of([]);
      })
    );
  }

  searchProviders(params: {
    category_id?: number;
    query?: string;
  }): Observable<ServiceProvider[]> {
    // Validación: mínimo 2 caracteres (backend requiere min_length=2)
    if (!params.query || params.query.length < 2) return of([]);
    return this.http.get<any[]>(`${this.api}/providers/text-search`, { params: { q: params.query } }).pipe(
      map(items => items.map(item => ({
        ...item,
        // Aplanar avatar y full_name del objeto provider anidado
        avatar: item.provider?.avatar || item.avatar,
        full_name: item.provider?.full_name || item.full_name,
        // Incluir campo de disponibilidad (conectado/desconectado)
        is_available: item.is_available ?? true,
        // Incluir rating, reviews e hourly_rate
        rating_avg: item.rating_avg ?? undefined,
        total_reviews: item.total_reviews ?? undefined,
        hourly_rate: item.hourly_rate ?? undefined,
        // Construir objeto service_category si no viene estructura
        service_category: item.service_category ?? (item.service_category_name ? {
          id: item.service_id,
          name: item.service_category_name,
          icon: item.service_icon ?? null
        } : undefined),
        // Incluir distancia y descripción
        distance_km: item.distance ?? item.distance_km,
        description: item.description ?? undefined
      } as ServiceProvider))),
      catchError(err => {
        console.error('Error searching providers:', err);
        return of([]);
      })
    );
  }

  validateIdentity(formData: FormData): Observable<any> {
    return this.http.post(`${this.api}/providers/validate-identity`, formData);
  }

  // Working hours
  getMyWorkingHours(): Observable<ProviderWorkingHours[]> {
    return this.http.get<ProviderWorkingHours[]>(`${this.api}/working-hours/me`);
  }

  saveWorkingHours(data: ProviderWorkingHours): Observable<ProviderWorkingHours> {
    return this.http.post<ProviderWorkingHours>(`${this.api}/working-hours/me`, data);
  }

  getProviderWorkingHours(providerId: number): Observable<ProviderWorkingHours[]> {
    return this.http.get<ProviderWorkingHours[]>(`${this.api}/working-hours/provider/${providerId}`);
  }

  /** Obtiene los schedules de un servicio publicado (ServiceAvailability) — fallback si ProviderWorkingHours está vacío */
  getServiceSchedules(providerId: number, serviceProviderId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/providers/${providerId}/services/${serviceProviderId}/schedules`);
  }

  /** Slots disponibles por servicio — retorna {time, available}[] con estado real de reservas */
  getAvailableSlotsByService(
    providerId: number,
    serviceProviderId: number,
    date: string
  ): Observable<{ date: string; service_provider_id: number; slots: { time: string; available: boolean }[] }> {
    return this.http.get<any>(
      `${this.api}/providers/${providerId}/services/${serviceProviderId}/available-slots`,
      { params: { date } }
    );
  }
}
