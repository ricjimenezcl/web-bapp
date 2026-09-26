import { Component, inject, signal, OnInit, CUSTOM_ELEMENTS_SCHEMA, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { ServiceProvider } from '../../../../core/models/provider.model';
import { ModalService } from '../../../../core/services/modal.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ServiceEntitlementService } from '../../../../core/services/service-entitlement.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-my-services',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-services.component.html',
  styleUrl: './my-services.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MyServicesComponent implements OnInit {
  private readonly providerSvc = inject(ProviderService);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly serviceEntitlement = inject(ServiceEntitlementService);

  services = signal<ServiceProvider[]>([]);
  loading  = signal(true);
  error    = signal('');
  private hasPaidPlan = signal(false);
  private usedFreeBenefit = signal(false);
  readonly needsExtraServicePlan = computed(() => this.services().length >= 2);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.providerSvc.getMyServices().subscribe({
      next: (s) => {
        this.services.set(s);
        this.loading.set(false);
        this.refreshEntitlement(s);
      },
      error: () => { this.error.set('Error al cargar servicios.'); this.loading.set(false); }
    });
  }

  private refreshEntitlement(services: ServiceProvider[]): void {
    this.http.get<any[]>(`${environment.apiUrl}/transactions/me`).pipe(
      catchError(() => of([]))
    ).subscribe(transactions => {
      const userId = this.auth.currentUser()?.id ?? null;
      const evaluation = this.serviceEntitlement.evaluate(userId, services, transactions ?? []);
      this.hasPaidPlan.set(evaluation.hasBasePlan || evaluation.hasPremiumPlan);
      this.usedFreeBenefit.set(evaluation.usedFreeBenefit);
    });
  }

  async delete(id: number): Promise<void> {
    const service = this.services().find(s => s.id === id);

    const willLoseFreeBenefit = !this.hasPaidPlan() && this.usedFreeBenefit();
    const message = willLoseFreeBenefit
      ? 'Ya utilizaste tu beneficio de 2 servicios gratuitos. Si eliminas este servicio NO podrás agregar uno nuevo de forma gratuita; necesitarás activar un plan. ¿Deseas continuar?'
      : '¿Eliminar este servicio?';

    const confirmed = await this.modal.confirm(message, 'Confirmar eliminación', 'Eliminar');
    if (!confirmed) return;
    this.providerSvc.deleteService(id, service?.provider_id).subscribe({
      next: () => this.services.update(list => list.filter(s => s.id !== id))
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      approved: 'Aprobado',
      pending:  'Pendiente',
      rejected: 'Rechazado',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      approved: 'badge-success',
      pending:  'badge-warning',
      rejected: 'badge-danger',
    };
    return map[status] ?? 'badge-gray';
  }

  countByStatus(status: string): number {
    return this.services().filter(s => s.validation_status === status).length;
  }

  goToExtraServicePlan(): void {
    this.router.navigate(['/payment'], {
      state: {
        product_type: 'PROVIDER_SERVICE_30',
        returnTo: '/provider/tabs/my-services'
      }
    });
  }
}
