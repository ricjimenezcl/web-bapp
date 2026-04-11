import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-terms-acceptance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-700 to-primary-800 flex items-center justify-center p-4">
      <div class="w-full max-w-md card card-body animate-fade-in">
        <div class="text-center mb-6">
          <div class="text-4xl mb-3">📋</div>
          <h2 class="text-xl font-bold text-slate-800">Términos y condiciones</h2>
          <p class="text-sm text-slate-500 mt-1">Por favor revisa y acepta los términos para continuar</p>
        </div>

        <div class="bg-surface-50 rounded-xl p-4 max-h-48 overflow-y-auto text-xs text-slate-600 mb-4 leading-relaxed">
          <p class="font-semibold mb-2">Términos de uso de BAPP</p>
          <p>Al usar nuestra plataforma, aceptas que tus datos serán utilizados para conectarte con proveedores de servicios cercanos.
          Nos comprometemos a proteger tu privacidad y datos personales conforme a la ley aplicable.</p>
          <br>
          <p>No está permitido usar la plataforma para actividades ilegales, spam o cualquier comportamiento que viole los derechos de otros usuarios.</p>
          <br>
          <p>BAPP actúa como intermediario y no se responsabiliza por la calidad de los servicios prestados por proveedores independientes.</p>
          <br>
          <p>Puedes revisar la política de privacidad completa en <a routerLink="/privacy" class="text-primary-600 underline">nuestra página de privacidad</a>.</p>
        </div>

        @if (error()) {
          <div class="alert alert-danger mb-4">{{ error() }}</div>
        }

        <div class="space-y-3 mb-6">
          <label class="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" [(ngModel)]="termsAccepted" class="mt-0.5 rounded border-surface-300 text-primary-600">
            <span class="text-sm text-slate-700">
              He leído y acepto los
              <a routerLink="/terms" class="text-primary-600 font-medium underline">Términos y condiciones</a>
              y la
              <a routerLink="/privacy" class="text-primary-600 font-medium underline">Política de privacidad</a>
              *
            </span>
          </label>
          <label class="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" [(ngModel)]="emailOptIn" class="mt-0.5 rounded border-surface-300 text-primary-600">
            <span class="text-sm text-slate-500">Acepto recibir comunicaciones por correo electrónico (opcional)</span>
          </label>
        </div>

        <button (click)="onAccept()" class="btn btn-primary btn-block btn-lg"
          [disabled]="!termsAccepted || loading()">
          @if (loading()) { <span class="spinner"></span> }
          Continuar
        </button>

        <button (click)="onDecline()" class="btn btn-ghost btn-block mt-2 text-slate-500 text-sm">
          Cancelar y salir
        </button>
      </div>
    </div>
  `
})
export class TermsAcceptanceComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  termsAccepted = false;
  emailOptIn    = false;
  loading       = signal(false);
  error         = signal('');

  onAccept(): void {
    if (!this.termsAccepted || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.acceptTerms(this.emailOptIn).subscribe({
      next: () => {
        this.loading.set(false);
        const user = this.auth.currentUser();
        if (user?.role === 'PROVIDER') {
          this.router.navigate(['/provider/tabs'], { replaceUrl: true });
        } else {
          this.router.navigate(['/client/categories'], { replaceUrl: true });
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo registrar la aceptación. Intenta nuevamente.');
      }
    });
  }

  onDecline(): void {
    this.auth.logout();
  }
}
