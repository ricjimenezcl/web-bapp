import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface LocationSuggestion {
  text: string;
  place_name: string;
  lat: number;
  lon: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly http = inject(HttpClient);
  
  // ✅ Cache para reducir requests
  private readonly searchCache = new Map<string, {
    data: LocationSuggestion[],
    timestamp: number
  }>();
  
  private readonly reverseCache = new Map<string, {
    data: string,
    timestamp: number
  }>();
  
  private readonly SEARCH_CACHE_TTL = 5 * 60 * 1000;  // 5 min
  private readonly REVERSE_CACHE_TTL = 10 * 60 * 1000; // 10 min
  private readonly MAX_CACHE_SIZE = 100;

  // Ubicación seleccionada por el usuario (para filtrar proveedores/servicios)
  private selectedLocation: { lat: number; lon: number; name: string } | null = null;

  /**
   * Busca ubicaciones en Chile usando Geoapify API
   * @param query Texto de búsqueda (ej: "Santiago", "Providencia")
   * @returns Observable con sugerencias de ubicación
   * ✅ Con cache para reducir requests
   */
  searchLocations(query: string): Observable<LocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    // ✅ Cache check
    const cacheKey = query.toLowerCase().trim();
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_TTL) {
      console.log('[Cache HIT] Search:', cacheKey);
      return of(cached.data);
    }

    // Usa GET /api/v1/providers/geocoding/search (Nominatim + caché Redis 7 días)
    const url = `${environment.apiUrl}/providers/geocoding/search`;

    return this.http.get<any>(url, {
      params: { q: query, country: 'cl' }
    }).pipe(
      map(response => {
        const raw: any[] = response.results ?? [];
        if (raw.length === 0) return [];

        const results: LocationSuggestion[] = raw.map(r => ({
          text:       r.text || r.place_name.split(',')[0].trim(),
          place_name: r.place_name,
          lat:        r.center[1],
          lon:        r.center[0],
        }));

        this.searchCache.set(cacheKey, { data: results, timestamp: Date.now() });

        if (this.searchCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.searchCache.keys().next().value;
          this.searchCache.delete(firstKey);
        }

        return results;
      }),
      catchError(() => of(this.getMockLocations(query))),
      shareReplay(1)
    );
  }

  /**
   * Extrae el nombre de la ciudad/comuna del resultado de Geoapify
   */
  private extractCityName(feature: any): string {
    const props = feature.properties;
    return props.city || props.district || props.locality || props.name;
  }

  /**
   * Guarda la ubicación seleccionada por el usuario
   * Esta ubicación se usará para filtrar servicios/proveedores cercanos
   */
  setSelectedLocation(location: LocationSuggestion): void {
    this.selectedLocation = {
      lat: location.lat,
      lon: location.lon,
      name: location.text
    };
    console.log('🌍 Ubicación guardada en servicio:', this.selectedLocation);
  }

  /**
   * Obtiene la ubicación seleccionada por el usuario
   * @returns Ubicación seleccionada o null si usa ubicación actual
   */
  getSelectedLocation(): { lat: number; lon: number; name: string } | null {
    return this.selectedLocation;
  }

  /**
   * Limpia la ubicación seleccionada (volver a usar ubicación actual)
   */
  clearSelectedLocation(): void {
    this.selectedLocation = null;
    console.log('🌍 Ubicación seleccionada limpiada, usando ubicación actual');
  }

  /**
   * Mock de ubicaciones como fallback
   * Se usa si la API falla o no hay API key configurada
   */
  private getMockLocations(query: string): LocationSuggestion[] {
    const allCommunes: LocationSuggestion[] = [
      { text: 'Santiago Centro', place_name: 'Santiago, Región Metropolitana, Chile', lat: -33.4372, lon: -70.6506 },
      { text: 'Providencia', place_name: 'Providencia, Región Metropolitana, Chile', lat: -33.4269, lon: -70.6109 },
      { text: 'Las Condes', place_name: 'Las Condes, Región Metropolitana, Chile', lat: -33.4166, lon: -70.5833 },
      { text: 'Vitacura', place_name: 'Vitacura, Región Metropolitana, Chile', lat: -33.391, lon: -70.571 },
      { text: 'Lo Barnechea', place_name: 'Lo Barnechea, Región Metropolitana, Chile', lat: -33.351, lon: -70.511 },
      { text: 'Ñuñoa', place_name: 'Ñuñoa, Región Metropolitana, Chile', lat: -33.4569, lon: -70.5969 },
      { text: 'La Reina', place_name: 'La Reina, Región Metropolitana, Chile', lat: -33.4447, lon: -70.5386 },
      { text: 'Maipú', place_name: 'Maipú, Región Metropolitana, Chile', lat: -33.511, lon: -70.761 },
      { text: 'Puente Alto', place_name: 'Puente Alto, Región Metropolitana, Chile', lat: -33.611, lon: -70.581 },
      { text: 'La Florida', place_name: 'La Florida, Región Metropolitana, Chile', lat: -33.521, lon: -70.591 },
    ];

    const queryLower = query.toLowerCase();
    return allCommunes
      .filter(loc => 
        loc.text.toLowerCase().includes(queryLower) || 
        loc.place_name.toLowerCase().includes(queryLower)
      )
      .slice(0, 8);
  }

  /**
   * Obtiene la ubicación actual del usuario usando el navegador
   * (Requiere permisos de geolocalización)
   */
  getCurrentPosition(): Observable<GeolocationPosition | null> {
    return new Observable(observer => {
      if (!navigator.geolocation) {
        console.warn('Geolocation no soportada en este navegador');
        observer.next(null);
        observer.complete();
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          observer.next(position);
          observer.complete();
        },
        error => {
          console.error('Error obteniendo ubicación:', error);
          observer.next(null);
          observer.complete();
        }
      );
    });
  }

  /**
   * Geocodificación inversa: obtiene el nombre de lugar desde coordenadas
   * ✅ Con cache para reducir requests
   */
  reverseGeocode(lat: number, lon: number): Observable<string> {
    // ✅ Cache check
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.REVERSE_CACHE_TTL) {
      console.log('[Cache HIT] Reverse:', cacheKey);
      return of(cached.data);
    }

    console.log('[Cache MISS] Reverse:', cacheKey);
    
    // ✅ Usar proxy backend
    const url = `${environment.apiUrl}/geocoding/reverse`;

    return this.http.get<any>(url, {
      params: {
        lat: lat.toString(),
        lon: lon.toString(),
        type: 'city',
        lang: 'es'
      }
    }).pipe(
      map(response => {
        let cityName = 'Ubicación actual';
        if (response.features && response.features.length > 0) {
          cityName = this.extractCityName(response.features[0]);
        }
        
        // ✅ Guardar en cache
        this.reverseCache.set(cacheKey, {
          data: cityName,
          timestamp: Date.now()
        });
        
        // ✅ Cleanup
        if (this.reverseCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.reverseCache.keys().next().value;
          this.reverseCache.delete(firstKey);
        }
        
        return cityName;
      }),
      catchError(() => of('Ubicación actual')),
      shareReplay(1)
    );
  }
}
