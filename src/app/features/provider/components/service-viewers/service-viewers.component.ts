import {
  Component, inject, signal, Output, EventEmitter, OnInit, Input
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';

export interface UnlockStatus {
  is_unlocked: boolean;
  expires_at: string | null;
  days_remaining: number | null;
  hours_remaining: number | null;
  unlock_id: number | null;
  total_viewers: number;
  price_clp: number;
  duration_days: number;
}

export interface ServiceViewerClient {
  id: number;
  display_name: string;
  avatar_url: string | null;
  phone: string;
  service_viewed: string;
  viewed_at: string;
  is_masked: boolean;
}

export interface ServiceViewersResponse {
  is_unlocked: boolean;
  clients: ServiceViewerClient[];
  total: number;
  price_clp: number;
}

type PanelState = 'loading' | 'locked' | 'unlocked' | 'paying' | 'confirming' | 'error';

@Component({
  selector: 'app-service-viewers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-viewers.component.html',
  styleUrl: './service-viewers.component.scss',
})
export class ServiceViewersComponent implements OnInit {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api    = environment.apiUrl;

  @Input()  isOpen  = false;
  @Output() closed  = new EventEmitter<void>();

  state          = signal<PanelState>('loading');
  unlockStatus   = signal<UnlockStatus | null>(null);
  clients        = signal<ServiceViewerClient[]>([]);
  total          = signal(0);
  unlockLoading  = signal(false);
  paymentRef     = signal<string | null>(null);
  errorMsg       = signal('');

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.state.set('loading');
    this.http.get<UnlockStatus>(`${this.api}/providers/service-viewers/status`).subscribe({
      next: (s) => {
        this.unlockStatus.set(s);
        if (s.total_viewers > 0) this.total.set(s.total_viewers);
        this.loadClients();
      },
      error: (err) => {
        if (err.status === 404) {
          // Si es 404, asumimos que no está desbloqueado o no hay datos aún
          this.state.set('locked');
          this.total.set(0);
        } else {
          this.state.set('error');
          this.errorMsg.set('No se pudo cargar el estado. Intenta más tarde.');
        }
      }
    });
  }

  private loadClients(): void {
    this.http.get<ServiceViewersResponse>(`${this.api}/providers/service-viewers/clients`).subscribe({
      next: (r) => {
        this.clients.set(r.clients);
        this.total.set(r.total);
        this.state.set(r.is_unlocked ? 'unlocked' : 'locked');
      },
      error: () => {
        this.clients.set([]);
        this.state.set(this.unlockStatus()?.is_unlocked ? 'unlocked' : 'locked');
      }
    });
  }

  startUnlock(): void {
    this.router.navigate(['/payment'], {
      queryParams: {
        product_type: 'PROVIDER_LEADS_7',
        returnTo: '/provider/tabs/home'
      }
    });
  }

  confirmPayment(): void {
    const ref = this.paymentRef();
    if (!ref) return;
    this.unlockLoading.set(true);
    this.state.set('confirming');
    this.http.post<{ success: boolean; expires_at: string }>(
      `${this.api}/providers/service-viewers/confirm-payment`,
      { payment_reference: ref }
    ).subscribe({
      next: () => {
        this.unlockLoading.set(false);
        this.loadStatus();
      },
      error: (err) => {
        const detail = err?.error?.detail ?? 'Error confirmando el pago.';
        this.errorMsg.set(detail);
        this.state.set('error');
        this.unlockLoading.set(false);
      }
    });
  }

  goToChat(clientId: number): void {
    this.close();
    this.router.navigate(['/provider/tabs/inbox'], { queryParams: { clientId } });
  }

  close(): void {
    this.closed.emit();
  }

  retry(): void {
    this.errorMsg.set('');
    this.loadStatus();
  }

  formatPhone(phone: string): string {
    return phone === '***' ? '***-***-****' : phone;
  }

  timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return 'hace momentos';
    if (h < 24) return `hace ${h}h`;
    return `hace ${Math.floor(h / 24)}d`;
  }

  countdownLabel(): string {
    const s = this.unlockStatus();
    if (!s) return '';
    if (s.days_remaining && s.days_remaining > 0) return `${s.days_remaining}d restantes`;
    if (s.hours_remaining && s.hours_remaining > 0) return `${s.hours_remaining}h restantes`;
    return 'menos de 1h';
  }
}
