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

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) { this.loading.set(false); this.error.set('Token inválido.'); return; }
    this.auth.verifyEmail(token).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.detail ?? 'Error al verificar.'); }
    });
  }
}
