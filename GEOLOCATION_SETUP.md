# Guía de Integración de API de Geolocalización Real

Esta guía explica cómo configurar la API de Geoapify para búsqueda de ubicaciones en tiempo real.

## 📋 Prerequisitos

- Cuenta gratuita en Geoapify
- Angular con HttpClient configurado ✅ (ya configurado)
- LocationService creado ✅ (ya creado)

## 🚀 Pasos de Configuración

### 1. Obtener API Key de Geoapify

#### Opción A: Geoapify (Recomendado - Gratuito)
1. Ve a https://www.geoapify.com/
2. Haz clic en "Get Started Free"
3. Regístrate con tu email
4. Accede al Dashboard
5. Copia tu API Key (está visible inmediatamente)

**Tier gratuito:**
- ✅ 3,000 requests por día
- ✅ Sin tarjeta de crédito
- ✅ Todas las funciones básicas

#### Opción B: Mapbox (Alternativa)
1. Ve a https://www.mapbox.com/
2. Crea cuenta gratuita
3. Obtén Access Token
4. Modifica LocationService para usar Mapbox API

#### Opción C: Google Places API (Más costoso)
- Requiere tarjeta de crédito
- 300 USD gratis por mes
- API más completa pero overkill para este caso

---

### 2. Configurar API Key en tu Proyecto

**Opción A: Directamente en el servicio (Para desarrollo rápido)**

Edita: `src/app/core/services/location.service.ts`

```typescript
private readonly GEOAPIFY_API_KEY = 'TU_API_KEY_AQUI'; // ← Reemplazar
```

**Opción B: En environment (Recomendado para producción)**

1. Edita `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  geoapifyApiKey: 'TU_API_KEY_AQUI'
};
```

2. Edita `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  geoapifyApiKey: 'TU_API_KEY_PRODUCCION'
};
```

3. Actualiza `location.service.ts`:
```typescript
import { environment } from '../../../environments/environment';

// ...
private readonly GEOAPIFY_API_KEY = environment.geoapifyApiKey;
```

---

### 3. Verificar Funcionamiento

1. **Build del proyecto:**
```bash
cd web-bapp
ng build --configuration production
```

2. **Ejecutar en desarrollo:**
```bash
ng serve --port 4200
```

3. **Probar la búsqueda:**
   - Abre http://localhost:4200
   - Ve a la página de Categorías
   - Haz clic en el location pill
   - Escribe "Santiago" o cualquier ciudad chilena
   - Deberías ver sugerencias reales de la API

---

## 🔍 Características Implementadas

### LocationService (`location.service.ts`)

✅ **searchLocations(query: string)**
- Busca ubicaciones en Chile usando Geoapify
- Filtro automático: solo Chile (countrycode:cl)
- Límite de 8 resultados
- Debounce de 350ms (ya implementado en el componente)
- Fallback a mock si falla la API

✅ **getCurrentPosition()**
- Obtiene ubicación GPS del navegador
- Requiere permisos del usuario
- Manejo de errores incluido

✅ **reverseGeocode(lat, lon)**
- Convierte coordenadas → nombre de lugar
- Útil para "Detectar mi ubicación"

---

## 🛡️ Fallback Automático

Si la API falla (sin internet, API key inválida, cuota excedida), el servicio automáticamente usa el **mock de 36 comunas** de Santiago como fallback.

**Mock incluye:**
- Santiago Centro, Providencia, Las Condes
- Maipú, Puente Alto, La Florida
- Y 30 comunas más de la Región Metropolitana

---

## 🌍 Buscar Más Allá de Chile

Para buscar en otros países, modifica el filtro en `location.service.ts`:

```typescript
// Solo Chile (actual)
filter: 'countrycode:cl'

// Toda Latinoamérica
filter: 'countrycode:cl,ar,pe,bo,co,ec'

// Sin filtro (mundo entero)
// Eliminar la línea "filter" completamente
```

---

## 📊 Monitoreo de Uso

### Ver cuota en Geoapify Dashboard:
1. Ve a https://myprojects.geoapify.com/
2. Pestaña "Statistics"
3. Verás requests diarios/mensuales

### Si excedes el límite:
- Tier gratuito: API devolverá error 429
- Fallback se activará automáticamente
- Opciones: upgrade a plan de pago o esperar 24h

---

## 🔧 Troubleshooting

### Problema: No aparecen resultados

**Solución 1:** Verifica la API key en consola del navegador
```bash
# Abre DevTools (F12) → Console
# Deberías ver logs del servicio
```

**Solución 2:** Verifica CORS
```bash
# Geoapify permite CORS desde cualquier origen
# Si hay error CORS, contacta soporte de Geoapify
```

### Problema: Error 401 Unauthorized

**Causa:** API key inválida

**Solución:**
1. Verifica que copiaste la key correctamente
2. Asegúrate de que no haya espacios antes/después
3. Regenera la key en el dashboard de Geoapify

### Problema: Error 429 Too Many Requests

**Causa:** Excediste 3,000 requests/día

**Solución:**
1. Espera 24 horas (se resetea)
2. O upgrade a plan Pro (10,000 requests/día)

---

## 💰 Comparación de APIs

| API | Tier Gratuito | Requests/día | Tarjeta requerida |
|-----|---------------|--------------|-------------------|
| **Geoapify** | ✅ Sí | 3,000 | ❌ No |
| Mapbox | ✅ Sí | 100,000/mes | ⚠️ Sí (no se cobra) |
| Google Places | ❌ No | 300 USD gratis/mes | ✅ Sí |
| Nominatim (OSM) | ✅ Sí | Ilimitado* | ❌ No |

*Nominatim tiene rate limiting estricto (1 req/seg), no recomendado para producción

---

## 🎯 Próximos Pasos Opcionales

### 1. Agregar Geolocalización GPS

Permite al usuario detectar su ubicación automáticamente:

```typescript
// En categories.component.ts
detectMyLocation(): void {
  this.locationSvc.getCurrentPosition().subscribe(position => {
    if (position) {
      const { latitude, longitude } = position.coords;
      
      // Geocodificación inversa
      this.locationSvc.reverseGeocode(latitude, longitude).subscribe(placeName => {
        this.selectedLocationName = placeName;
        console.log('📍 Ubicación detectada:', placeName, latitude, longitude);
      });
    }
  });
}
```

Agregar botón en el HTML:
```html
<button type="button" (click)="detectMyLocation()">
  <ion-icon name="navigate-outline"></ion-icon>
  Detectar mi ubicación
</button>
```

### 2. Guardar Ubicación en LocalStorage

```typescript
selectLocation(suggestion: LocationSuggestion): void {
  this.selectedLocationName = suggestion.text;
  
  // Guardar para próxima visita
  localStorage.setItem('lastLocation', JSON.stringify({
    name: suggestion.text,
    lat: suggestion.lat,
    lon: suggestion.lon
  }));
  
  this.showLocationSearch = false;
}
```

### 3. Filtrar Proveedores por Distancia

```typescript
// En el servicio de proveedores
filterByDistance(providers: Provider[], userLat: number, userLon: number, maxKm: number) {
  return providers.filter(provider => {
    const distance = this.calculateDistance(
      userLat, userLon, 
      provider.latitude, provider.longitude
    );
    return distance <= maxKm;
  });
}

// Fórmula de Haversine para calcular distancia
calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
}
```

---

## 📞 Soporte

- **Geoapify Docs:** https://apidocs.geoapify.com/
- **Geoapify Dashboard:** https://myprojects.geoapify.com/
- **Soporte Email:** support@geoapify.com
- **Angular HttpClient:** https://angular.io/guide/http

---

## ✅ Checklist Final

Antes de pasar a producción, verifica:

- [ ] API key configurada en environment.prod.ts
- [ ] API key NO commiteada en Git (.gitignore incluye environment.prod.ts)
- [ ] Tested con 10+ búsquedas diferentes
- [ ] Fallback funciona si API falla
- [ ] Debounce de 350ms activo (evita spam)
- [ ] Límite de 8 resultados aplicado
- [ ] Loading spinner aparece mientras busca
- [ ] Manejo de errores implementado
- [ ] Console logs limpios (sin errores)

---

**Estado Actual:** ✅ Todo implementado, solo falta configurar API key

**Siguiente paso:** Obtén tu API key de Geoapify y reemplázala en `location.service.ts`
