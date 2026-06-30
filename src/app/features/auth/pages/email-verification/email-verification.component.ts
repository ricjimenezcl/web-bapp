import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './email-verification.component.html',
})
export class EmailVerificationComponent implements OnInit {
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  loading = signal(true);
  success = signal(false);
  error   = signal('');
  expired = signal(false);
  isMobile = signal(this.detectMobile());

  private detectMobile(): boolean {
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }

  openApp(): void {
    // Intenta abrir la app nativa. Si no está instalada, redirige a la tienda.
    const timeout = setTimeout(() => {
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isAndroid) {
        window.location.href = 'https://play.google.com/store/apps/details?id=io.ionic.bappsearch';
      } else if (isIOS) {
        window.location.href = 'https://apps.apple.com/app/bappsearch/id000000000';
      }
    }, 1500);
    window.location.href = 'bapp://home';
    // Limpiar el timeout si la app se abre exitosamente
    window.addEventListener('blur', () => clearTimeout(timeout), { once: true });
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) { this.loading.set(false); this.error.set('Token inválido.'); return; }
    this.auth.verifyEmail(token).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => {
        this.loading.set(false);
        const detail: string = err?.error?.detail ?? 'Error al verificar.';
        if (detail.toLowerCase().includes('expir')) {
          this.expired.set(true);
        } else {
          this.error.set(detail);
        }
      }
    });
  }
}
