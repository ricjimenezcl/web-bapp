import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';

// Formato que devuelve GET /api/v1/providers/geocoding/search (Nominatim/Mapbox)
interface NominatimResponse {
  source: 'api' | 'cache';
  results: NominatimResult[];
}

interface NominatimResult {
  place_name: string;   // "Av. Providencia 1234, Providencia, Santiago"
  text: string;         // "Av. Providencia"  (nombre de calle sin número)
  address: string;      // "1234"             (número de casa)
  center: [number, number]; // [lon, lat]
  relevance: number;
  place_type: string[];
}

export interface AddressSuggestion {
  id: string;
  formatted: string;
  displayText: string;
  context: string;
  lat: number;
  lon: number;
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class GeoapifyService {
  private readonly http = inject(HttpClient);

  // Cache local (el backend ya tiene caché Redis 7 días, pero evitamos peticiones redundantes)
  private readonly autocompleteCache = new Map<string, {
    data: AddressSuggestion[];
    timestamp: number;
  }>();

  private readonly reverseCache = new Map<string, {
    data: string;
    timestamp: number;
  }>();

  private readonly AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000;  // 5 min
  private readonly REVERSE_CACHE_TTL      = 10 * 60 * 1000; // 10 min
  private readonly MAX_CACHE_SIZE         = 100;

  /**
   * Autocompletado de direcciones limitado a Chile.
   * Usa GET /api/v1/providers/geocoding/search (Nominatim + caché Redis 7 días).
   */
  autocompleteAddress(query: string): Observable<AddressSuggestion[]> {
    if (!query || query.length < 3) {
      return of([]);
    }

    const cacheKey = query.toLowerCase().trim();
    const cached = this.autocompleteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.AUTOCOMPLETE_CACHE_TTL) {
      return of(cached.data);
    }

    const url = `${environment.apiUrl}/providers/geocoding/search`;
    return this.http.get<NominatimResponse>(url, {
      params: { q: query, country: 'cl' }
    }).pipe(
      map(response => {
        const results = this.transformNominatimResults(response.results || []);

        this.autocompleteCache.set(cacheKey, { data: results, timestamp: Date.now() });
        if (this.autocompleteCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.autocompleteCache.keys().next().value!;
          this.autocompleteCache.delete(firstKey);
        }

        return results;
      })
    );
  }

  /**
   * Geocodificación inversa: coordenadas → dirección formateada.
   * Usa GET /api/v1/geocoding/reverse (proxy Geoapify — no existe equivalente en backend).
   */
  reverseGeocode(lat: number, lon: number): Observable<string> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.REVERSE_CACHE_TTL) {
      return of(cached.data);
    }

    const url = `${environment.apiUrl}/geocoding/reverse`;
    return this.http.get<any>(url, {
      params: { lat: lat.toString(), lon: lon.toString() }
    }).pipe(
      map(response => {
        const firstResult = response.features?.[0];
        const address = firstResult?.properties?.formatted || 'Ubicación desconocida';

        this.reverseCache.set(cacheKey, { data: address, timestamp: Date.now() });
        if (this.reverseCache.size > this.MAX_CACHE_SIZE) {
          const firstKey = this.reverseCache.keys().next().value!;
          this.reverseCache.delete(firstKey);
        }

        return address;
      })
    );
  }

  /**
   * Transforma resultados Nominatim/Mapbox → AddressSuggestion.
   *
   * Nominatim result:
   *   { place_name, text, address, center: [lon, lat], relevance, place_type }
   */
  private transformNominatimResults(results: NominatimResult[]): AddressSuggestion[] {
    return results.map((r, idx) => {
      const lon = r.center[0];
      const lat = r.center[1];

      // Texto principal: "Calle 1234" o solo "Calle" si sin número
      const displayText = r.address
        ? `${r.text} ${r.address}`.trim()
        : r.text || r.place_name;

      // Contexto: todo lo que sigue al primer segmento de place_name
      const firstComma = r.place_name.indexOf(',');
      const context = firstComma !== -1
        ? r.place_name.slice(firstComma + 1).trim()
        : '';

      return {
        id:          String(idx),
        formatted:   r.place_name,
        displayText,
        context,
        lat,
        lon,
        icon:        this.getIconForPlaceType(r.place_type),
      };
    });
  }

  private getIconForPlaceType(placeType: string[]): string {
    const type = (placeType?.[0] ?? '').toLowerCase();
    if (type === 'house' || type === 'address') return '🏠';
    if (type === 'park' || type === 'leisure')  return '🌳';
    if (type === 'city' || type === 'town')     return '🏙️';
    return '📍';
  }
}
