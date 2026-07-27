import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { BookingService } from '../../../../core/services/booking.service';
import { ChatService } from '../../../../core/services/chat.service';
import { ReviewService } from '../../../../core/services/review.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { BookingResponse, BookingStatus, BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from '../../../../core/models/booking.model';
import { ModalService } from '../../../../core/services/modal.service';
import { ContentFilterService } from '../../../../shared/services/content-filter.service';
import { TPipe } from '../../../../shared/pipes/t.pipe';
import { PlatformI18nService } from '../../../../core/services/platform-i18n.service';

type TabId = 'upcoming' | 'pending' | 'history' | 'cancelled';

@Component({
  selector: 'app-client-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, TPipe],
  templateUrl: './client-bookings.component.html',
  styleUrl: './client-bookings.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ClientBookingsComponent implements OnInit, OnDestroy {
  private readonly bookingSvc  = inject(BookingService);
  private readonly chatSvc     = inject(ChatService);
  private readonly reviewSvc   = inject(ReviewService);
  private readonly wsSvc       = inject(WebSocketService);
  private readonly router      = inject(Router);
  private readonly modal       = inject(ModalService);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly i18n        = inject(PlatformI18nService);
  private readonly destroy$    = new Subject<void>();

  bookings        = signal<BookingResponse[]>([]);
  loading         = signal(true);
  error           = signal('');
  activeTab       = signal<TabId>('upcoming');
  chatOpeningId   = signal<string | number | null>(null);
  cancelTarget    = signal<BookingResponse | null>(null);
  cancelComment   = '';
  cancelLoading   = signal(false);
  cancelChecking  = signal(false);
  cancelContentError = signal('');

  // review modal
  reviewTarget    = signal<BookingResponse | null>(null);
  reviewRating    = signal(0);
  reviewComment   = signal('');
  reviewLoading   = signal(false);
  reviewChecking  = signal(false);
  reviewContentError = signal('');
  reviewHoverStar = signal(0);

  readonly statusLabels = BOOKING_STATUS_LABELS;
  readonly statusColors = BOOKING_STATUS_COLORS;

  /** APROBADAS / CONFIRMADAS / EN_PROGRESO con fecha futura (o sin fecha) */
  get upcomingBookings(): BookingResponse[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return this.bookings().filter(b => {
      const s = (b.status || '').toUpperCase();
      if (s !== 'APPROVED' && s !== 'CONFIRMED' && s !== 'IN_PROGRESS') return false;
      if (!b.scheduled_date) return true;
      return new Date(String(b.scheduled_date)) >= now;
    });
  }

  /** Solo PENDIENTES (esperando confirmación) */
  get pendingBookings(): BookingResponse[] {
    return this.bookings().filter(b =>
      (b.status || '').toUpperCase() === 'PENDING'
    );
  }

  /** COMPLETADAS — historial */
  get historyBookings(): BookingResponse[] {
    return this.bookings().filter(b =>
      (b.status || '').toUpperCase() === 'COMPLETED'
    );
  }

  /** RECHAZADAS + CANCELADAS + NO PRESENTADO */
  get cancelledBookings(): BookingResponse[] {
    return this.bookings().filter(b => {
      const s = (b.status || '').toUpperCase();
      return s === 'REJECTED' || s === 'CANCELLED' || s === 'NOSHOW';
    });
  }

  get displayedBookings(): BookingResponse[] {
    switch (this.activeTab()) {
      case 'upcoming':   return this.upcomingBookings;
      case 'pending':    return this.pendingBookings;
      case 'history':    return this.historyBookings;
      default:           return this.cancelledBookings;
    }
  }

  emptyStateTitle(): string {
    switch (this.activeTab()) {
      case 'upcoming':
        return this.i18n.t('bookings.emptyUpcomingTitle');
      case 'pending':
        return this.i18n.t('bookings.emptyPendingTitle');
      case 'history':
        return this.i18n.t('bookings.emptyHistoryTitle');
      default:
        return this.i18n.t('bookings.emptyCancelledTitle');
    }
  }

  emptyStateSubtitle(): string {
    switch (this.activeTab()) {
      case 'upcoming':
        return this.i18n.t('bookings.emptyUpcomingSub');
      case 'pending':
        return this.i18n.t('bookings.emptyPendingSub');
      case 'history':
        return this.i18n.t('bookings.emptyHistorySub');
      default:
        return this.i18n.t('bookings.emptyCancelledSub');
    }
  }

  ngOnInit(): void {
    this.load();
    this.subscribeToBookingCompleted();
    this.subscribeToReviewRequest();
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
      this.showToast(this.i18n.t('bookings.toastMarkedCompleted'));
    });
  }

  private subscribeToReviewRequest(): void {
    this.wsSvc.notification$.pipe(
      filter(n => n.notification_type === 'booking_review_request'),
      takeUntil(this.destroy$)
    ).subscribe(n => {
      const id = n.related_entity_id;
      const booking = this.bookings().find(b => String(b.id) === String(id));
      if (booking) {
        this.openReviewModal(booking);
      }
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
        this.error.set(this.i18n.t('bookings.errorLoadBookings'));
        this.loading.set(false);
      }
    });
  }

  openCancelModal(booking: BookingResponse): void {
    this.cancelComment = '';
    this.cancelChecking.set(false);
    this.cancelContentError.set('');
    this.cancelTarget.set(booking);
    document.body.style.overflow = 'hidden';
  }

  closeCancelModal(): void {
    this.cancelTarget.set(null);
    this.cancelComment = '';
    this.cancelChecking.set(false);
    this.cancelContentError.set('');
    document.body.style.overflow = '';
  }

  confirmCancel(): void {
    const booking = this.cancelTarget();
    if (!booking) return;
    const comment = this.cancelComment.trim();

    if (!comment) {
      this.cancelContentError.set('');
      this.submitCancel(booking);
      return;
    }

    this.cancelChecking.set(true);
    this.cancelContentError.set('');
    this.contentFilterService.validateText(comment, 'generic').subscribe({
      next: (result) => {
        this.cancelChecking.set(false);
        if (result.blocked) {
          this.cancelContentError.set(this.i18n.t('bookings.errorCancelContentBlocked'));
          return;
        }
        this.submitCancel(booking, comment);
      },
      error: () => {
        this.cancelChecking.set(false);
        this.submitCancel(booking, comment);
      }
    });
  }

  private submitCancel(booking: BookingResponse, comment?: string): void {
    this.cancelLoading.set(true);
    this.bookingSvc.cancelBooking(booking.id, comment || undefined).subscribe({
      next: () => {
        this.bookings.update(list =>
          list.map(b => String(b.id) === String(booking.id)
            ? { ...b, status: 'CANCELLED' as BookingStatus }
            : b
          )
        );
        this.cancelLoading.set(false);
        this.closeCancelModal();
        this.showToast(this.i18n.t('bookings.toastCancelled'));
      },
      error: () => {
        this.cancelLoading.set(false);
        this.showToast(this.i18n.t('bookings.errorCancelBooking'));
      }
    });
  }

  goToChat(booking: BookingResponse): void {
    const providerId = Number(booking.provider_id);
    if (!providerId || Number.isNaN(providerId)) {
      this.showToast(this.i18n.t('bookings.errorNoProvider'));
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
        this.showToast(this.i18n.t('bookings.errorOpenChat'));
      }
    });
  }

  openReviewModal(booking: BookingResponse): void {
    this.reviewRating.set(0);
    this.reviewComment.set('');
    this.reviewContentError.set('');
    this.reviewHoverStar.set(0);
    this.reviewTarget.set(booking);
    document.body.style.overflow = 'hidden';
  }

  closeReviewModal(): void {
    this.reviewTarget.set(null);
    this.reviewContentError.set('');
    document.body.style.overflow = '';
  }

  setReviewRating(star: number): void {
    this.reviewRating.set(star);
  }

  submitReview(): void {
    const booking = this.reviewTarget();
    if (!booking || this.reviewRating() < 1) return;
    const comment = this.reviewComment().trim();

    if (!comment) {
      this.reviewContentError.set('');
      this.sendReview(booking);
      return;
    }

    this.reviewChecking.set(true);
    this.reviewContentError.set('');
    this.contentFilterService.validateText(comment, 'review').subscribe({
      next: (result) => {
        this.reviewChecking.set(false);
        if (result.blocked) {
          this.reviewContentError.set(this.i18n.t('bookings.errorReviewContentBlocked'));
          return;
        }
        this.sendReview(booking, comment);
      },
      // UX fail-open: backend vuelve a validar al persistir.
      error: () => {
        this.reviewChecking.set(false);
        this.sendReview(booking, comment);
      }
    });
  }

  private sendReview(booking: BookingResponse, comment?: string): void {
    this.reviewLoading.set(true);
    this.reviewSvc.createReview({
      booking_id: Number(booking.id),
      rating: this.reviewRating(),
      comment,
    }).subscribe({
      next: () => {
        this.reviewLoading.set(false);
        this.closeReviewModal();
        this.showToast(this.i18n.t('bookings.toastReviewThanks'));
        // mark as reviewed locally to hide button
        this.bookings.update(list =>
          list.map(b => String(b.id) === String(booking.id)
            ? { ...b, reviewed: true } as any
            : b
          )
        );
      },
      error: (err) => {
        this.reviewLoading.set(false);
        const msg = err?.error?.detail || this.i18n.t('bookings.errorSubmitReview');
        this.showToast(msg);
      }
    });
  }

  showToast(msg: string): void {
    void this.modal.info(msg);
  }
}
