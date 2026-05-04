import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export type PayMethod = 'card' | 'mercadopago' | 'debit';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
})
export class PaymentComponent {
  private readonly router = inject(Router);
  private readonly auth   = inject(AuthService);

  readonly user     = this.auth.currentProfile;
  readonly userRole = this.auth.currentUser()?.role ?? 'CLIENT';

  selectedMethod = signal<PayMethod>('card');
  processing     = signal(false);
  success        = signal(false);
  error          = signal('');

  selectMethod(m: PayMethod): void {
    this.selectedMethod.set(m);
  }

  goBack(): void {
    if (this.userRole === 'PROVIDER') {
      this.router.navigate(['/provider/tabs/profile']);
    } else {
      this.router.navigate(['/client/tabs/profile']);
    }
  }

  pay(): void {
    this.processing.set(true);
    this.error.set('');
    // Placeholder: real integration would call payment gateway API here
    setTimeout(() => {
      this.processing.set(false);
      this.success.set(true);
    }, 1800);
  }
}
