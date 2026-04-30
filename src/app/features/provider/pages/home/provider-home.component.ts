import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { ProviderProfile, ProviderStats } from '../../../../core/models/provider.model';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-provider-home',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent],
  templateUrl: './provider-home.component.html',
  styleUrl: './provider-home.component.scss',
})
export class ProviderHomeComponent implements OnInit, OnDestroy {
  private providerSvc = inject(ProviderService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  stats = signal<ProviderStats | null>(null);
  profile = signal<ProviderProfile | null>(null);
  validationStatus = signal<string>('not_submitted');
  loading = signal(true);
  showVerificationAlert = signal(false);
  verificationMessage = signal('');

  ngOnInit(): void {
    this.loadProfileAndStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProfileAndStats(): void {
    this.providerSvc.getMyProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.loadStats();
        this.checkValidationStatus();
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  private loadStats(): void {
    this.providerSvc.getMyStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  private checkValidationStatus(): void {
    this.http.get<{status: string}>(`${environment.apiUrl}/providers/validation/status`).pipe(takeUntil(this.destroy$)).subscribe({
      next: (v) => {
        this.validationStatus.set(v.status);
        if (v.status !== 'approved') {
          this.showVerificationWarning(v.status);
        }
      },
      error: () => {}
    });
  }

  private showVerificationWarning(status: string): void {
    let message = 'Para poder agregar servicios, debes completar la verificación de identidad.';
    
    if (status === 'pending') {
      message = 'Tu verificación está pendiente de procesamiento.';
    } else if (status === 'not_submitted') {
      message = 'Para poder agregar servicios, debes completar la verificación de identidad.';
    }

    this.verificationMessage.set(message);
    this.showVerificationAlert.set(true);
  }

  goToVerifyIdentity(): void {
    this.showVerificationAlert.set(false);
    this.router.navigate(['/auth/verify-identity']);
  }

  dismissVerificationAlert(): void {
    this.showVerificationAlert.set(false);
  }

  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }

  getFirstName(): string {
    const name = this.profile()?.full_name || '';
    return name.split(' ')[0];
  }
}