import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationStateService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _unreadCount   = signal<number>(0);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount   = this._unreadCount.asReadonly();
  readonly hasUnread     = computed(() => this._unreadCount() > 0);

  // Flag para deshabilitar carga HTTP de notificaciones
  // Las notificaciones se manejan por WebSocket en tiempo real
  private readonly ENABLE_HTTP_NOTIFICATIONS = false;

  loadNotifications(): void {
    // El endpoint /notifications/ NO existe en el backend actual
    // Las notificaciones se reciben únicamente por WebSocket
    if (!this.ENABLE_HTTP_NOTIFICATIONS) {
      console.info('📬 Notifications: Using WebSocket only (HTTP endpoint disabled)');
      this._notifications.set([]);
      this._unreadCount.set(0);
      return;
    }

    this.http.get<any[]>(`${this.api}/notifications/`).pipe(
      catchError(err => {
        console.warn('Notifications endpoint not available:', err);
        return of([]); // Retorna array vacío sin romper UI
      })
    ).subscribe({
      next: (list) => {
        const mapped: AppNotification[] = (list ?? []).map(n => ({
          ...n,
          notification_type: n.notification_type ?? n.type,
        }));
        this._notifications.set(mapped);
        this._unreadCount.set(mapped.filter(n => !n.is_read).length);
      },
      error: () => {
        // Fallback adicional por si catchError no funciona
        this._notifications.set([]);
        this._unreadCount.set(0);
      }
    });
  }

  addNotification(n: AppNotification): void {
    this._notifications.update(list => [n, ...list]);
    if (!n.is_read) this._unreadCount.update(c => c + 1);
  }

  markRead(id: number): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    this._unreadCount.update(c => Math.max(0, c - 1));
  }

  markAllRead(): void {
    this._notifications.update(list => list.map(n => ({ ...n, is_read: true })));
    this._unreadCount.set(0);
  }

  setUnreadCount(count: number): void {
    this._unreadCount.set(count);
  }
}
