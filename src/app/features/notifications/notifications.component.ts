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
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Notificaciones</h1>
        @if (notifState.hasUnread()) {
          <button (click)="markAllRead()" class="text-xs text-primary-600 font-medium">Marcar todo leído</button>
        }
      </header>

      <div class="divide-y divide-surface-100">
        @if (notifications().length === 0) {
          <app-empty-state icon="🔔" title="Sin notificaciones" description="Aquí aparecerán tus notificaciones."></app-empty-state>
        } @else {
          @for (n of notifications(); track n.id) {
            <div (click)="markRead(n)" class="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-surface-50 transition-colors"
              [class]="!n.is_read ? 'bg-primary-50/50' : ''">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-lg"
                [class]="!n.is_read ? 'bg-primary-100' : 'bg-surface-100'">
                {{ getIcon(n.notification_type) }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-slate-800 truncate">{{ n.title }}</p>
                <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ n.content }}</p>
                <p class="text-xs text-slate-400 mt-1">{{ n.created_at | date:'dd/MM/yyyy HH:mm' }}</p>
              </div>
              @if (!n.is_read) {
                <div class="w-2 h-2 bg-primary-600 rounded-full mt-1.5 shrink-0"></div>
              }
            </div>
          }
        }
      </div>
    </div>
  `
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
      booking_completed: '🎉', review_received: '⭐', service_approved: '🏆',
      payment_received: '💰', chat_message: '💬',
    };
    return icons[type] ?? '🔔';
  }
}
