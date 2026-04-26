import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-terms-acceptance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './terms-acceptance.component.html',
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
