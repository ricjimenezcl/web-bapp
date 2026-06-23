import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { ProviderProfile, ProviderStats } from '../../../../core/models/provider.model';
import { Review } from '../../../../core/models/review.model';
import { ReviewService } from '../../../../core/services/review.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ServiceViewersComponent } from '../../components/service-viewers/service-viewers.component';

@Component({
  selector: 'app-provider-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ServiceViewersComponent],
  templateUrl: './provider-home.component.html',
  styleUrl: './provider-home.component.scss',
})
export class ProviderHomeComponent implements OnInit, OnDestroy {
  private providerSvc = inject(ProviderService);
  private reviewSvc   = inject(ReviewService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  stats = signal<ProviderStats | null>(null);
  profile = signal<ProviderProfile | null>(null);
  validationStatus = signal<string>('not_submitted');
  loading = signal(true);
  showVerificationAlert = signal(false);
  verificationMessage = signal('');
  isProfileIncomplete = signal(false);
  missingFields = signal<string[]>([]);
  showViewers = signal(false);

  reviews         = signal<Review[]>([]);
  showReviews     = signal(false);
  reviewsLoading  = signal(false);

  ngOnInit(): void {
    this.loadProfileAndStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProfileAndStats(): void {
    // Intentar cargar el perfil
    this.providerSvc.getMyProfile().pipe(takeUntil(this.destroy$)).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.isProfileIncomplete.set(false);
        this.checkProfileCompletion(p);
        this.loadStats();
        this.checkValidationStatus();
        this.loadReviews(p.id);
      },
      error: (error) => {
        if (error.status === 404) {
          this.handleIncompleteProfile();
        } else {
          this.loading.set(false);
          // Incluso si hay error, si no es 404 intentamos ver validación
          this.checkValidationStatus();
        }
      }
    });
  }

  private handleIncompleteProfile(): void {
    this.loading.set(false);
    this.isProfileIncomplete.set(true);
    this.profile.set(null);
    this.missingFields.set(['Información básica del perfil', 'RUN (RUT)', 'Teléfono', 'Configuración de servicios']);
    
    // Si no tiene perfil, la verificación es obligatoria y prioritaria
    this.validationStatus.set('not_submitted');
    this.verificationMessage.set('Para comenzar a recibir clientes, primero debes completar tu perfil y verificar tu identidad.');
    this.showVerificationAlert.set(true);
  }

  private checkProfileCompletion(profile: ProviderProfile): void {
    const missing: string[] = [];
    if (!profile.run) missing.push('RUN (RUT)');
    if (!profile.phone) missing.push('Teléfono');
    
    this.missingFields.set(missing);
    this.isProfileIncomplete.set(missing.length > 0);
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
        } else {
          this.showVerificationAlert.set(false);
        }
      },
      error: (err) => {
        // Si no hay perfil, el endpoint de validación podría dar 404 también
        if (err.status === 404) {
          this.validationStatus.set('not_submitted');
        }
      }
    });
  }

  private showVerificationWarning(status: string): void {
    let message = 'Debes realizar la verificación de identidad para poder publicar servicios.';
    
    if (status === 'pending') {
      message = 'Tu identidad está en revisión. Te avisaremos cuando sea aprobada.';
    } else if (status === 'rejected') {
      message = 'Tu verificación fue rechazada. Por favor, revisa tus documentos y reintenta.';
    } else if (status === 'not_submitted') {
      message = 'Verifica tu identidad para poder recibir clientes y pagos.';
    }

    this.verificationMessage.set(message);
    this.showVerificationAlert.set(true);
  }

    this.verificationMessage.set(message);
    this.showVerificationAlert.set(true);
  }

  goToVerifyIdentity(): void {
    this.showVerificationAlert.set(false);
    this.router.navigate(['/auth/verify-identity']);
  }

  goToCompleteProfile(): void {
    this.router.navigate(['/provider/account-info']);
  }

  dismissVerificationAlert(): void {
    this.showVerificationAlert.set(false);
  }

  openServiceViewers(): void {
    this.showViewers.set(true);
  }

  openReviews(): void {
    this.showReviews.set(true);
  }

  private loadReviews(providerId: number): void {
    this.reviewsLoading.set(true);
    this.reviewSvc.getProviderReviews(providerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r) => { this.reviews.set(r); this.reviewsLoading.set(false); },
      error: () => this.reviewsLoading.set(false)
    });
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