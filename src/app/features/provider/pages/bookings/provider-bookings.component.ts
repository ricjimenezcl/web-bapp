import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { BookingService } from '../../../../core/services/booking.service';
import { BookingResponse, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../../../core/models/booking.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-provider-bookings',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  templateUrl: './provider-bookings.component.html',
  styleUrl: './provider-bookings.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProviderBookingsComponent implements OnInit, OnDestroy {
  private bookingSvc = inject(BookingService);
  private router     = inject(Router);
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

  reject(id: number): void {
    const reason = prompt('Motivo del rechazo (opcional):');
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
