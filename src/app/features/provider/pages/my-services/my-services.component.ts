import { Component, inject, signal, OnInit, CUSTOM_ELEMENTS_SCHEMA, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProviderService } from '../../../../core/services/provider.service';
import { ServiceProvider } from '../../../../core/models/provider.model';
import { ModalService } from '../../../../core/services/modal.service';

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

  services = signal<ServiceProvider[]>([]);
  loading  = signal(true);
  error    = signal('');
  readonly needsExtraServicePlan = computed(() => this.services().length >= 2);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.providerSvc.getMyServices().subscribe({
      next: (s) => { this.services.set(s); this.loading.set(false); },
      error: () => { this.error.set('Error al cargar servicios.'); this.loading.set(false); }
    });
  }

  async delete(id: number): Promise<void> {
    const service = this.services().find(s => s.id === id);
    const confirmed = await this.modal.confirm('¿Eliminar este servicio?', 'Confirmar eliminación', 'Eliminar');
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
      queryParams: {
        product_type: 'PROVIDER_SERVICE_30',
        returnTo: '/provider/tabs/my-services'
      }
    });
  }
}
