import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { BookingService } from '../../../../core/services/booking.service';
import { ChatService } from '../../../../core/services/chat.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { BookingResponse, BookingStatus, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../../../core/models/booking.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';

type TabId = 'upcoming' | 'pending' | 'cancelled';

@Component({
  selector: 'app-client-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, LoadingSkeletonComponent],
  templateUrl: './client-bookings.component.html',
  styleUrl: './client-bookings.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ClientBookingsComponent implements OnInit, OnDestroy {
  private readonly bookingSvc  = inject(BookingService);
  private readonly chatSvc     = inject(ChatService);
  private readonly wsSvc       = inject(WebSocketService);
  private readonly router      = inject(Router);
  private readonly destroy$    = new Subject<void>();

  bookings        = signal<BookingResponse[]>([]);
  loading         = signal(true);
  error           = signal('');
  activeTab       = signal<TabId>('upcoming');
  toastMsg        = signal<string | null>(null);
  chatOpeningId   = signal<string | number | null>(null);
  cancelTarget    = signal<BookingResponse | null>(null);
  cancelComment   = '';
  cancelLoading   = signal(false);

  readonly statusLabels = BOOKING_STATUS_LABELS;
  readonly statusColors = BOOKING_STATUS_COLORS;

  /** CONFIRMADAS / EN_PROGRESO con fecha futura (o sin fecha) */
  get upcomingBookings(): BookingResponse[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.bookings().filter(b => {
      const s = (b.status || '').toUpperCase();
      if (s !== 'CONFIRMED' && s !== 'IN_PROGRESS') return false;
      if (!b.scheduled_date) return true;
      return new Date(String(b.scheduled_date)) >= now;
    });
  }

  /** PENDIENTES siempre + COMPLETADAS siempre */
  get pendingBookings(): BookingResponse[] {
    return this.bookings().filter(b => {
      const s = (b.status || '').toUpperCase();
      return s === 'PENDING' || s === 'COMPLETED';
    });
  }

  /** CANCELADAS + NO PRESENTADO */
  get cancelledBookings(): BookingResponse[] {
    return this.bookings().filter(b => {
      const s = (b.status || '').toUpperCase();
      return s === 'CANCELLED' || s === 'NOSHOW';
    });
  }

  get displayedBookings(): BookingResponse[] {
    switch (this.activeTab()) {
      case 'upcoming':  return this.upcomingBookings;
      case 'pending':   return this.pendingBookings;
      default:          return this.cancelledBookings;
    }
  }

  ngOnInit(): void {
    this.load();
    this.subscribeToBookingCompleted();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToBookingCompleted(): void {
    this.wsSvc.notification$.pipe(
      filter(n => n.notification_type === 'booking_completed'),
      takeUntil(this.destroy$)
    ).subscribe(n => {
      const id = n.related_entity_id;
      this.bookings.update(list =>
        list.map(b => String(b.id) === String(id)
          ? { ...b, status: 'COMPLETED' as BookingStatus }
          : b
        )
      );
      this.showToast('Tu reserva fue marcada como completada.');
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.bookingSvc.getClientBookings().subscribe({
      next: (res: any) => {
        const list: BookingResponse[] = Array.isArray(res)
          ? res
          : (res?.items ?? res?.bookings ?? res?.data ?? []);
        this.bookings.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar reservas. Intenta nuevamente.');
        this.loading.set(false);
      }
    });
  }

  openCancelModal(booking: BookingResponse): void {
    this.cancelComment = '';
    this.cancelTarget.set(booking);
    document.body.style.overflow = 'hidden';
  }

  closeCancelModal(): void {
    this.cancelTarget.set(null);
    this.cancelComment = '';
    document.body.style.overflow = '';
  }

  confirmCancel(): void {
    const booking = this.cancelTarget();
    if (!booking) return;
    this.cancelLoading.set(true);
    this.bookingSvc.cancelBooking(booking.id, this.cancelComment || undefined).subscribe({
      next: () => {
        this.bookings.update(list =>
          list.map(b => String(b.id) === String(booking.id)
            ? { ...b, status: 'CANCELLED' as BookingStatus }
            : b
          )
        );
        this.cancelLoading.set(false);
        this.closeCancelModal();
        this.showToast('Reserva cancelada correctamente.');
      },
      error: () => {
        this.cancelLoading.set(false);
        this.showToast('Error al cancelar la reserva.');
      }
    });
  }

  goToChat(booking: BookingResponse): void {
    const providerId = Number(booking.provider_id);
    if (!providerId || Number.isNaN(providerId)) {
      this.showToast('No encontramos un proveedor asociado a esta reserva.');
      return;
    }
    this.chatOpeningId.set(booking.id);
    this.chatSvc.createConversation(providerId).subscribe({
      next: (conv) => {
        this.chatOpeningId.set(null);
        this.router.navigate(['/client/chat', conv.id]);
      },
      error: () => {
        this.chatOpeningId.set(null);
        this.showToast('No pudimos abrir el chat. Intenta nuevamente.');
      }
    });
  }

  showToast(msg: string): void {
    this.toastMsg.set(msg);
    setTimeout(() => this.toastMsg.set(null), 3000);
  }
}
