import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { BookingService } from '../../../../core/services/booking.service';
import { BookingResponse, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../../../core/models/booking.model';
import { ModalService } from '../../../../core/services/modal.service';
import { AppFooterComponent } from '../../../../shared/components/app-footer/app-footer.component';

@Component({
  selector: 'app-provider-bookings',
  standalone: true,
  imports: [CommonModule, RouterLink, AppFooterComponent],
  templateUrl: './provider-bookings.component.html',
  styleUrl: './provider-bookings.component.scss'
})
export class ProviderBookingsComponent implements OnInit, OnDestroy {
  private readonly bookingSvc = inject(BookingService);
  private readonly router     = inject(Router);
  private readonly modal      = inject(ModalService);
  private sub?: Subscription;

  bookings  = signal<BookingResponse[]>([]);
  loading   = signal(true);
  activeTab = signal<'pending' | 'history'>('pending');

  getStatusLabel(status: string): string { return (BOOKING_STATUS_LABELS as any)[status] ?? status; }
  getStatusColor(status: string): string { return (BOOKING_STATUS_COLORS as any)[status] ?? 'badge-gray'; }

  get pending()    { return this.bookings().filter(b => b.status === 'PENDING'); }
  get activeList() { return this.bookings().filter(b => ['CONFIRMED', 'IN_PROGRESS'].includes(b.status)); }
  get historyList(){ return this.bookings().filter(b => ['COMPLETED', 'CANCELLED', 'NOSHOW'].includes(b.status)); }
  get displayed()  { return this.activeTab() === 'pending' ? [...this.pending, ...this.activeList] : this.historyList; }

  ngOnInit(): void {
    this.load();
    // Reload when navigating back to this tab
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd && e.urlAfterRedirects.includes('/provider/tabs/bookings'))
    ).subscribe(() => this.load());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading.set(true);
    this.bookingSvc.getProviderBookings().subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  confirm(id: number): void {
    this.bookingSvc.confirmBooking(id).subscribe({
      next: (u) => this.bookings.update(l => l.map(b => String(b.id) === String(id) ? u : b))
    });
  }

  async reject(id: number): Promise<void> {
    const reason = await this.modal.prompt(
      'Opcionalmente puedes indicar un motivo para rechazar la reserva.',
      'Rechazar reserva',
      {
        inputLabel: 'Motivo del rechazo',
        inputPlaceholder: 'Escribe un motivo (opcional)',
        confirmText: 'Rechazar',
      }
    );

    if (reason === null) return;

    this.bookingSvc.rejectBooking(id, reason ?? undefined).subscribe({
      next: (u) => this.bookings.update(l => l.map(b => String(b.id) === String(id) ? u : b))
    });
  }

  complete(id: number): void {
    this.bookingSvc.completeBooking(id).subscribe({
      next: (u) => this.bookings.update(l => l.map(b => String(b.id) === String(id) ? u : b))
    });
  }
}
