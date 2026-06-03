import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NotificationStateService } from '../../core/services/notification-state.service';
import { AppNotification } from '../../core/models/notification.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent],
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent implements OnInit {
  readonly notifState = inject(NotificationStateService);
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  readonly history = window.history;

  notifications = this.notifState.notifications;

  ngOnInit(): void {
    this.notifState.loadNotifications();
  }

  markRead(n: AppNotification): void {
    if (n.is_read) return;
    this.http.patch(`${this.api}/notifications/${n.id}/read`, {}).subscribe({
      next: () => this.notifState.markRead(n.id),
      error: () => {}
    });
  }

  markAllRead(): void {
    this.http.patch(`${this.api}/notifications/mark-all-read`, {}).subscribe({
      next: () => this.notifState.markAllRead(),
      error: () => {}
    });
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      message: '💬', booking_confirmed: '✅', booking_rejected: '❌',
      booking_completed: '🎉', booking_review_request: '⭐', review_received: '⭐',
      service_approved: '🏆', payment_received: '💰', chat_message: '💬',
    };
    return icons[type] ?? '🔔';
  }
}
