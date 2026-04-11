import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-primary-700 to-primary-800 flex items-center justify-center p-4">
      <div class="w-full max-w-md card card-body text-center animate-fade-in">
        @if (loading()) {
          <div class="spinner mx-auto mb-4 w-8 h-8 border-primary-600"></div>
          <p class="text-slate-600">Verificando tu correo...</p>
        } @else if (success()) {
          <div class="text-5xl mb-4">✉️</div>
          <h3 class="text-xl font-semibold text-slate-800">¡Correo verificado!</h3>
          <p class="text-slate-600 mt-2">Tu cuenta ha sido verificada exitosamente.</p>
          <a routerLink="/auth/login" class="btn btn-primary btn-block mt-6">Iniciar sesión</a>
        } @else {
          <div class="text-5xl mb-4">❌</div>
          <h3 class="text-xl font-semibold text-slate-800">Error de verificación</h3>
          <p class="text-slate-600 mt-2">{{ error() }}</p>
          <a routerLink="/auth/login" class="btn btn-secondary btn-block mt-6">Ir al inicio</a>
        }
      </div>
    </div>
  `
})
export class EmailVerificationComponent implements OnInit {
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  loading = signal(true);
  success = signal(false);
  error   = signal('');

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) { this.loading.set(false); this.error.set('Token inválido.'); return; }
    this.auth.verifyEmail(token).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al verificar.'); }
    });
  }
}
