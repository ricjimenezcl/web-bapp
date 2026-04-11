import { Component, inject, signal, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProviderService } from '../../../../core/services/provider.service';
import { ServiceProvider } from '../../../../core/models/provider.model';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-my-services',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSkeletonComponent, EmptyStateComponent],
  templateUrl: './my-services.component.html',
  styleUrl: './my-services.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MyServicesComponent implements OnInit {
  private providerSvc = inject(ProviderService);

  services = signal<ServiceProvider[]>([]);
  loading  = signal(true);
  error    = signal('');

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

  delete(id: number): void {
    if (!confirm('¿Eliminar este servicio?')) return;
    this.providerSvc.deleteService(id).subscribe({
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
}
