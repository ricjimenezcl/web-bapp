import { Routes } from '@angular/router';
import {
  authGuard, noAuthGuard, clientGuard, providerGuard, providerVerificationGuard
} from './core/guards/auth.guard';
import { profileCompletionGuard } from './core/guards/profile-completion.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },

  // AUTH
  {
    path: 'auth',
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register-client',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./features/auth/pages/register-client/register-client.component').then(m => m.RegisterClientComponent)
      },
      {
        path: 'register-provider',
        canActivate: [noAuthGuard],
        loadComponent: () => import('./features/auth/pages/register-provider/register-provider.component').then(m => m.RegisterProviderComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      },
      {
        path: 'set-new-password',
        loadComponent: () => import('./features/auth/pages/set-new-password/set-new-password.component').then(m => m.SetNewPasswordComponent)
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./features/auth/pages/email-verification/email-verification.component').then(m => m.EmailVerificationComponent)
      },
      {
        path: 'terms-acceptance',
        loadComponent: () => import('./features/auth/pages/terms-acceptance/terms-acceptance.component').then(m => m.TermsAcceptanceComponent)
      },
      {
        path: 'verify-identity',
        canActivate: [authGuard],
        loadComponent: () => import('./features/auth/pages/document-verification/document-verification.component').then(m => m.DocumentVerificationComponent)
      },
    ]
  },

  // CLIENT
  {
    path: 'client',
    canActivate: [authGuard, clientGuard, profileCompletionGuard],
    children: [
      {
        path: 'tabs',
        loadComponent: () => import('./features/client/pages/tabs/client-tabs.component').then(m => m.ClientTabsComponent),
        children: [
          { path: '', redirectTo: 'service-search', pathMatch: 'full' },
          {
            path: 'service-search',
            loadComponent: () => import('./features/client/pages/service-search/service-search.component').then(m => m.ServiceSearchComponent)
          },
          {
            path: 'service-map',
            loadComponent: () => import('./features/client/pages/service-map/service-map.component').then(m => m.ServiceMapComponent)
          },
          {
            path: 'bookings',
            loadComponent: () => import('./features/client/pages/bookings/client-bookings.component').then(m => m.ClientBookingsComponent)
          },
          {
            path: 'chats',
            loadComponent: () => import('./features/client/pages/chats/client-chats.component').then(m => m.ClientChatsComponent)
          },
          {
            path: 'profile',
            loadComponent: () => import('./features/client/pages/profile/client-profile.component').then(m => m.ClientProfileComponent)
          },
        ]
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/client/pages/categories/categories.component').then(m => m.CategoriesComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/client/pages/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'edit-profile',
        loadComponent: () => import('./features/client/pages/edit-profile/edit-profile.component').then(m => m.EditProfileComponent)
      },
      {
        path: 'provider-info/:id',
        loadComponent: () => import('./features/client/pages/provider-info/provider-info.component').then(m => m.ProviderInfoComponent)
      },
      {
        path: 'chat/:id',
        loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent)
      },
      { path: '', redirectTo: 'tabs', pathMatch: 'full' },
    ]
  },

  // PROVIDER
  {
    path: 'provider',
    canActivate: [authGuard, providerGuard, profileCompletionGuard],
    children: [
      {
        path: 'tabs',
        loadComponent: () => import('./features/provider/pages/tabs/provider-tabs.component').then(m => m.ProviderTabsComponent),
        children: [
          { path: '', redirectTo: 'home', pathMatch: 'full' },
          {
            path: 'home',
            loadComponent: () => import('./features/provider/pages/home/provider-home.component').then(m => m.ProviderHomeComponent)
          },
          {
            path: 'my-services',
            canActivate: [providerVerificationGuard],
            loadComponent: () => import('./features/provider/pages/my-services/my-services.component').then(m => m.MyServicesComponent)
          },
          {
            path: 'bookings',
            canActivate: [providerVerificationGuard],
            loadComponent: () => import('./features/provider/pages/bookings/provider-bookings.component').then(m => m.ProviderBookingsComponent)
          },
          {
            path: 'inbox',
            canActivate: [providerVerificationGuard],
            loadComponent: () => import('./features/provider/pages/inbox/provider-inbox.component').then(m => m.ProviderInboxComponent)
          },
          {
            path: 'profile',
            loadComponent: () => import('./features/provider/pages/profile/provider-profile.component').then(m => m.ProviderProfileComponent)
          },
        ]
      },
      {
        path: 'add-service',
        canActivate: [providerVerificationGuard],
        loadComponent: () => import('./features/provider/pages/add-service/add-service.component').then(m => m.AddServiceComponent)
      },
      {
        path: 'edit-service/:id',
        canActivate: [providerVerificationGuard],
        loadComponent: () => import('./features/provider/pages/edit-service/edit-service.component').then(m => m.EditServiceComponent)
      },
      {
        path: 'working-hours',
        canActivate: [providerVerificationGuard],
        loadComponent: () => import('./features/provider/pages/working-hours/working-hours.component').then(m => m.WorkingHoursComponent)
      },
      {
        path: 'account-info',
        loadComponent: () => import('./features/provider/pages/account-info/account-info.component').then(m => m.AccountInfoComponent)
      },
      {
        path: 'chat/:id',
        canActivate: [providerVerificationGuard],
        loadComponent: () => import('./features/chat/chat.component').then(m => m.ChatComponent)
      },
      { path: '', redirectTo: 'tabs', pathMatch: 'full' },
    ]
  },

  // SHARED ROUTES
  {
    // Bridge para la app móvil: recibe JWT en query param y establece sesión web
    path: 'app-payment',
    loadComponent: () => import('./features/payment/app-payment-bridge.component').then(m => m.AppPaymentBridgeComponent)
  },
  {
    path: 'payment',
    canActivate: [authGuard],
    loadComponent: () => import('./features/payment/payment.component').then(m => m.PaymentComponent)
  },
  {
    path: 'payment/callback',
    canActivate: [authGuard],
    loadComponent: () => import('./features/payment/payment.component').then(m => m.PaymentComponent)
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./features/notifications/notifications.component').then(m => m.NotificationsComponent)
  },
  {
    path: 'registro-proveedores',
    loadComponent: () => import('./features/provider-landing/provider-landing.component').then(m => m.ProviderLandingComponent)
  },
  {
    path: 'proveedores',
    redirectTo: 'registro-proveedores',
    pathMatch: 'full'
  },
  {
    path: 'terms',
    loadComponent: () => import('./shared/pages/terms/terms.component').then(m => m.TermsComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./shared/pages/privacy/privacy.component').then(m => m.PrivacyComponent)
  },

  // FALLBACK
  { path: '**', redirectTo: 'auth/login' },
];
