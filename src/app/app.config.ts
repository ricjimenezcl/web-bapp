import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DatePipe, DecimalPipe } from '@angular/common';
import { SocialAuthServiceConfig, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';

/** Recarga la página cuando un chunk de lazy-loading no se puede obtener.
 *  Esto ocurre cuando el SW tiene en caché main.js de una build anterior
 *  y los chunks nuevos (con hash diferente) ya no existen en el servidor. */
class ChunkLoadErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const msg: string = error?.message ?? '';
    if (/Failed to fetch dynamically imported|Loading chunk \d+ failed|Importing a module script failed/i.test(msg)) {
      console.warn('[ChunkLoadError] Recargando para obtener la última versión:', msg);
      window.location.reload();
    } else {
      console.error(error);
    }
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: ChunkLoadErrorHandler },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled'
      })
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    DatePipe,
    DecimalPipe,
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(environment.googleClientId, {
              oneTapEnabled: false, // Desactiva One Tap/FedCM para evitar el error de consola
              prompt: 'select_account'
            })
          },
          {
            id: FacebookLoginProvider.PROVIDER_ID,
            provider: new FacebookLoginProvider(environment.facebookAppId)
          }
        ],
        onError: (err) => console.error(err)
      } as SocialAuthServiceConfig,
    },
  ]
};
