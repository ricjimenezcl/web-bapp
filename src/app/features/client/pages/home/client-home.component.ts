import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { BookingService } from '../../../../core/services/booking.service';
import { NotificationStateService } from '../../../../core/services/notification-state.service';

interface StatItem {
  label: string;
  value: string;
  detail: string;
  accent: 'gold' | 'blue' | 'green';
}

interface MessageItem {
  name: string;
  preview: string;
  time: string;
  unread: number;
}

interface BookingItem {
  title: string;
  client: string;
  date: string;
  state: 'Confirmada' | 'Pendiente' | 'Finalizada';
}

interface Transaction {
  id: string;
  product_name: string;
  status: string;
  activated_at: string;
  expires_at: string;
}

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="client-home">
      <header class="page-header">
        <div>
          <p class="eyebrow">Panel del cliente</p>
          <h1>Mi dashboard</h1>
        </div>
        <button type="button" class="primary-action" routerLink="/client/categories">
          Nueva búsqueda
        </button>
      </header>

      <section class="stats-grid" aria-label="Resumen del cliente">
        <article class="stat-card stat-card--gold" *ngFor="let item of stats()">
          <span class="stat-card__label">{{ item.label }}</span>
          <strong class="stat-card__value">{{ item.value }}</strong>
          <small class="stat-card__detail">{{ item.detail }}</small>
        </article>
      </section>

      <section class="panel-grid">
        <article class="panel panel--wide">
          <div class="panel__header">
            <h2>Actividad de búsqueda</h2>
            <a routerLink="/client/categories">Buscar ahora</a>
          </div>

          <div class="search-activity-box">
            <strong class="search-activity-value">{{ searchesToday() }}</strong>
            <span class="search-activity-label">
              {{ searchesToday() === 1 ? 'búsqueda realizada hoy' : 'búsquedas realizadas hoy' }}
            </span>
          </div>
        </article>

        <article class="panel">
          <div class="panel__header">
            <h2>Mensajes</h2>
            <span>Hoy</span>
          </div>

          <ul class="list compact">
            <li class="list__item" *ngFor="let item of messages()">
              <div class="list__main">
                <span class="list__avatar">{{ item.name.slice(0, 1) }}</span>
                <div>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.preview }}</small>
                </div>
              </div>
              <div class="list__meta">
                <span class="list__time">{{ item.time }}</span>
                <span class="counter" *ngIf="item.unread > 0">{{ item.unread }}</span>
              </div>
            </li>
          </ul>
        </article>
      </section>

      <section class="panel-grid panel-grid--bottom">
        <article class="panel">
          <div class="panel__header">
            <h2>Reservas</h2>
            <a routerLink="/client/tabs/bookings">Ver agenda</a>
          </div>

          <ul class="list compact">
            <li class="list__item booking" *ngFor="let item of bookings()">
              <div class="list__main">
                <div>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.client }}</small>
                </div>
              </div>
              <div class="booking__meta">
                <span>{{ item.date }}</span>
                <em [class]="'state state--' + item.state.toLowerCase()">{{ item.state }}</em>
              </div>
            </li>
          </ul>
        </article>

        <article class="panel plan-panel">
          <div class="panel__header">
            <h2>Plan</h2>
            <span>{{ activePlan()?.status || 'Sin plan' }}</span>
          </div>

          <div class="plan-box">
            <div class="plan-box__header">
              <span class="plan-badge">{{ activePlan()?.name || 'Plan Gratuito' }}</span>
            </div>
            <ul *ngIf="activePlan()">
              <li>Plan activo desde {{ activePlan()?.startDate }}</li>
              <li>Vence el {{ activePlan()?.endDate }}</li>
            </ul>
            <ul *ngIf="!activePlan()">
              <li>Acceso básico sin límites</li>
              <li>Atención estándar</li>
            </ul>
            <button type="button" class="secondary-action" routerLink="/payment">
              {{ activePlan() ? 'Cambiar plan' : 'Activar premium' }}
            </button>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .client-home {
        display: grid;
        gap: 1.25rem;
        padding: 1.2rem 1rem 2rem;
        color: #f5f7fb;
      }

      .page-header,
      .stats-grid,
      .panel-grid {
        width: min(100%, 1200px);
        margin: 0 auto;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.7rem;
        color: #d6ba79;
        font-weight: 800;
      }

      h1 {
        margin: 0.15rem 0 0;
        font-size: clamp(2rem, 3vw, 2.7rem);
        line-height: 1.05;
        letter-spacing: -0.06em;
      }

      .primary-action,
      .secondary-action {
        border: none;
        border-radius: 999px;
        font-weight: 800;
        cursor: pointer;
      }

      .primary-action {
        padding: 0.8rem 1.1rem;
        background: linear-gradient(135deg, #d7c785, #b19052);
        color: #17130f;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .stat-card {
        display: grid;
        gap: 0.45rem;
        padding: 1rem 1.05rem;
        background: rgba(13, 18, 27, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 22px;
      }

      .stat-card--gold {
        background: linear-gradient(135deg, rgba(185, 150, 80, 0.18), rgba(12, 18, 27, 0.96));
      }

      .stat-card--blue {
        background: linear-gradient(135deg, rgba(70, 95, 220, 0.16), rgba(12, 18, 27, 0.96));
      }

      .stat-card--green {
        background: linear-gradient(135deg, rgba(46, 182, 122, 0.15), rgba(12, 18, 27, 0.96));
      }

      .stat-card__label {
        color: rgba(229, 234, 245, 0.76);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat-card__value {
        font-size: clamp(1.6rem, 2vw, 2.2rem);
        line-height: 1;
        letter-spacing: -0.05em;
      }

      .stat-card__detail {
        color: rgba(229, 234, 245, 0.74);
        font-size: 0.8rem;
      }

      .panel-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
        gap: 1rem;
      }

      .panel {
        display: grid;
        gap: 0.8rem;
        padding: 1rem 1rem 0.8rem;
        background: rgba(13, 18, 27, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
      }

      .panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .panel__header h2 {
        margin: 0;
        font-size: 1.05rem;
      }

      .panel__header a,
      .panel__header span {
        color: #d8bd78;
        text-decoration: none;
        font-size: 0.8rem;
        font-weight: 700;
      }

      .search-activity-box {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        padding: 1.2rem 1rem;
        border-radius: 18px;
        background: linear-gradient(155deg, rgba(214, 183, 106, 0.12), rgba(47, 66, 131, 0.12));
        border: 1px solid rgba(214, 183, 106, 0.28);
      }

      .search-activity-value {
        font-size: clamp(1.8rem, 3vw, 2.4rem);
        line-height: 1;
        color: #f5f7fb;
      }

      .search-activity-label {
        color: rgba(229, 234, 245, 0.74);
        font-size: 0.85rem;
      }

      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.7rem;
      }

      .list.compact {
        gap: 0.6rem;
      }

      .list__item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.8rem 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 18px;
      }

      .list__main {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        min-width: 0;
      }

      .list__badge,
      .list__avatar {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: linear-gradient(135deg, #d7c785, #8ea7ff);
        color: #0d1117;
        font-weight: 800;
        flex-shrink: 0;
      }

      .list__main strong,
      .booking__meta strong {
        display: block;
        font-size: 0.9rem;
      }

      .list__main small,
      .booking__meta small {
        display: block;
        color: rgba(227, 233, 245, 0.7);
        font-size: 0.73rem;
      }

      .list__time {
        color: rgba(227, 233, 245, 0.72);
        font-size: 0.72rem;
        white-space: nowrap;
      }

      .list__meta {
        display: grid;
        justify-items: end;
        gap: 0.3rem;
      }

      .counter {
        display: inline-grid;
        place-items: center;
        min-width: 18px;
        height: 18px;
        border-radius: 999px;
        background: #d7b76e;
        color: #1b160d;
        font-size: 0.68rem;
        font-weight: 800;
        padding: 0 0.35rem;
      }

      .booking {
        align-items: flex-start;
      }

      .booking__meta {
        display: grid;
        justify-items: end;
        gap: 0.3rem;
      }

      .booking__meta span {
        color: rgba(227, 233, 245, 0.7);
        font-size: 0.72rem;
      }

      .state {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.2rem 0.45rem;
        border-radius: 999px;
        font-style: normal;
        font-size: 0.68rem;
        font-weight: 800;
      }

      .state--confirmada {
        background: rgba(76, 201, 140, 0.18);
        color: #8ae5b9;
      }

      .state--pendiente {
        background: rgba(255, 186, 92, 0.15);
        color: #f6c988;
      }

      .state--finalizada {
        background: rgba(109, 118, 255, 0.16);
        color: #a6b4ff;
      }

      .plan-panel {
        min-height: 100%;
      }

      .plan-box {
        display: grid;
        gap: 1rem;
        padding: 0.8rem;
        border-radius: 18px;
        background: linear-gradient(155deg, rgba(214, 183, 106, 0.12), rgba(47, 66, 131, 0.12));
        border: 1px solid rgba(214, 183, 106, 0.28);
      }

      .plan-box__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }

      .plan-badge {
        display: inline-flex;
        padding: 0.35rem 0.6rem;
        border-radius: 999px;
        background: rgba(215, 183, 106, 0.18);
        border: 1px solid rgba(215, 183, 106, 0.25);
        color: #e9d39a;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .plan-box__header strong {
        font-size: 1.8rem;
      }

      .plan-box ul {
        margin: 0;
        padding-left: 1.1rem;
        color: rgba(235, 240, 248, 0.82);
        display: grid;
        gap: 0.45rem;
      }

      .secondary-action {
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #f4f7ff;
      }

      @media (max-width: 900px) {
        .stats-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .panel-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 560px) {
        .client-home {
          padding-top: 0.9rem;
        }

        .page-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .primary-action {
          width: 100%;
        }

        .stats-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ClientHomeComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  private readonly destroy$ = new Subject<void>();
  private readonly bookingSvc = inject(BookingService);
  private readonly notifState = inject(NotificationStateService);

  // Signals con datos reales (derivados del backend / actividad real del usuario)
  readonly bookings = signal<BookingItem[]>([]);
  readonly bookingsUpcomingCount = signal(0);
  readonly activePlan = signal<any>(null);
  readonly isLoading = signal(false);
  readonly searchesToday = signal(0);

  // "Mensajes" se deriva de NotificationStateService (misma fuente que el badge del navbar)
  readonly messages = computed<MessageItem[]>(() =>
    this.notifState.notifications().slice(0, 3).map((n) => ({
      name: n.title || 'Notificación',
      preview: (n.content || '').slice(0, 40),
      time: this.formatTimeAgo(n.created_at),
      unread: n.is_read ? 0 : 1,
    }))
  );

  readonly stats = computed<StatItem[]>(() => [
    { label: 'Búsquedas', value: `${this.searchesToday()}`, detail: 'hoy', accent: 'gold' },
    { label: 'Mensajes', value: `${this.notifState.unreadCount()}`, detail: 'sin leer', accent: 'blue' },
    { label: 'Reservas', value: `${this.bookingsUpcomingCount()}`, detail: 'programadas', accent: 'green' },
    { label: 'Plan', value: this.activePlan() ? 'Premium' : 'Gratuito', detail: this.activePlan() ? 'activo' : 'gratuito', accent: 'gold' },
  ]);

  ngOnInit(): void {
    this.loadSearchStats();
    this.notifState.loadNotifications();
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.isLoading.set(true);

    this.loadBookings();
    this.loadPlanInfo();

    // Simulamos un timeout para terminar loading
    setTimeout(() => {
      this.isLoading.set(false);
    }, 1000);
  }

  private loadSearchStats(): void {
    this.http
      .get<{ searches_today: number; daily_limit: number | null }>(`${this.api}/users/me/search-stats`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.searchesToday.set(res?.searches_today ?? 0),
        error: (err) => {
          console.error('Error loading search stats:', err);
          this.searchesToday.set(0);
        }
      });
  }

  private normalizeListResponse<T>(payload: T[] | Record<string, unknown> | null | undefined): T[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const record = payload as Record<string, unknown>;
    const candidate = record['notifications']
      ?? record['items']
      ?? record['results']
      ?? record['data']
      ?? record['payload'];

    return Array.isArray(candidate) ? candidate as T[] : [];
  }

  private loadBookings(): void {
    this.bookingSvc
      .getClientBookings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookings) => {
          try {
            const list = bookings || [];
            const sorted = [...list].sort(
              (a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
            );

            const bookingItems: BookingItem[] = sorted.slice(0, 3).map((b) => ({
              title: b?.service_category || 'Servicio',
              client: b?.provider?.full_name || 'Proveedor',
              date: this.formatDate(b?.scheduled_date),
              state: this.mapBookingStatus(b?.status) as 'Confirmada' | 'Pendiente' | 'Finalizada',
            }));

            this.bookings.set(bookingItems);

            const upcoming = list.filter((b) =>
              ['PENDING', 'APPROVED', 'CONFIRMED'].includes((b?.status || '').toUpperCase())
            ).length;
            this.bookingsUpcomingCount.set(upcoming);
          } catch (parseErr) {
            console.error('Error parsing bookings:', parseErr);
            this.bookings.set([]);
            this.bookingsUpcomingCount.set(0);
          }
        },
        error: (err) => {
          console.error('Error loading bookings:', err);
          this.bookings.set([]);
          this.bookingsUpcomingCount.set(0);
        }
      });
  }

  private loadPlanInfo(): void {
    this.http
      .get<any[]>(`${this.api}/transactions/me`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transactions) => {
          try {
            const normalizedTransactions = this.normalizeListResponse(transactions);
            const activeTx = normalizedTransactions.find(
              (t) => t?.status === 'completed' && !!t?.expires_at && new Date(t.expires_at) > new Date()
            );

            if (activeTx) {
              this.activePlan.set({
                name: activeTx.product_name || 'Plan Premium',
                status: 'Activo',
                startDate: this.formatDate(activeTx.activated_at),
                endDate: this.formatDate(activeTx.expires_at),
              });
            } else {
              this.activePlan.set(null);
            }
          } catch (parseErr) {
            console.error('Error parsing plan info:', parseErr);
            this.activePlan.set(null);
          }
        },
        error: (err) => {
          console.error('Error loading plan info:', err);
          this.activePlan.set(null);
        }
      });
  }

  private formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private formatTimeAgo(dateString: string | undefined): string {
    if (!dateString) return 'Hace poco';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES');
  }

  private mapBookingStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'APPROVED': 'Confirmada',
      'CONFIRMED': 'Confirmada',
      'PENDING': 'Pendiente',
      'COMPLETED': 'Finalizada',
      'FINISHED': 'Finalizada',
      'CANCELLED': 'Cancelada'
    };
    return statusMap[status?.toUpperCase()] || 'Pendiente';
  }


}
