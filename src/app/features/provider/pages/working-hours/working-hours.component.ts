import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProviderService } from '../../../../core/services/provider.service';
import { ProviderWorkingHours, DAY_NAMES } from '../../../../core/models/provider.model';

@Component({
  selector: 'app-working-hours',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/provider/tabs/profile" class="p-2 -ml-2 text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Horarios de trabajo</h1>
      </header>

      <div class="p-4 space-y-3">
        @if (loading()) {
          <div class="flex justify-center py-8"><span class="spinner w-6 h-6 border-primary-600"></span></div>
        } @else {
          @if (success()) { <div class="alert alert-success">✅ Horarios guardados</div> }
          @for (day of workingHours(); track day.day_of_week) {
            <div class="card card-body">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold text-slate-700">{{ dayNames[day.day_of_week] }}</h3>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" class="sr-only peer" [checked]="day.is_active"
                    (change)="toggleDay(day, ($any($event.target)).checked)">
                  <div class="w-9 h-5 bg-surface-200 peer-checked:bg-primary-600 rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-primary-500/30 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                </label>
              </div>
              @if (day.is_active) {
                <div class="flex items-center gap-3 mt-2">
                  <div class="form-group flex-1">
                    <label class="form-label text-xs">Inicio</label>
                    <input type="time" class="form-input text-sm" [value]="day.start_time"
                      (change)="updateTime(day, 'start_time', ($any($event.target)).value)">
                  </div>
                  <div class="text-slate-400 pt-5">—</div>
                  <div class="form-group flex-1">
                    <label class="form-label text-xs">Fin</label>
                    <input type="time" class="form-input text-sm" [value]="day.end_time"
                      (change)="updateTime(day, 'end_time', ($any($event.target)).value)">
                  </div>
                </div>
              }
            </div>
          }
          <button (click)="save()" class="btn btn-primary btn-block" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Guardar horarios
          </button>
        }
      </div>
    </div>
  `
})
export class WorkingHoursComponent implements OnInit {
  private providerSvc = inject(ProviderService);
  workingHours = signal<ProviderWorkingHours[]>([]);
  loading = signal(true);
  saving  = signal(false);
  success = signal(false);
  readonly dayNames = DAY_NAMES;

  ngOnInit(): void {
    // Init with all 7 days
    const defaults: ProviderWorkingHours[] = DAY_NAMES.map((_, i) => ({
      day_of_week: i, start_time: '09:00', end_time: '18:00', is_active: i < 5
    }));
    this.workingHours.set(defaults);

    this.providerSvc.getMyWorkingHours().subscribe({
      next: (hours) => {
        const merged = defaults.map(d => {
          const saved = hours.find(h => h.day_of_week === d.day_of_week);
          return saved ?? d;
        });
        this.workingHours.set(merged);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleDay(day: ProviderWorkingHours, active: boolean): void {
    this.workingHours.update(list =>
      list.map(d => d.day_of_week === day.day_of_week ? { ...d, is_active: active } : d)
    );
  }

  updateTime(day: ProviderWorkingHours, field: 'start_time' | 'end_time', value: string): void {
    this.workingHours.update(list =>
      list.map(d => d.day_of_week === day.day_of_week ? { ...d, [field]: value } : d)
    );
  }

  save(): void {
    this.saving.set(true);
    const active = this.workingHours().filter(d => d.is_active);
    let saved = 0;
    if (active.length === 0) { this.saving.set(false); this.success.set(true); return; }
    active.forEach(day => {
      this.providerSvc.saveWorkingHours(day).subscribe({
        next: () => { saved++; if (saved === active.length) { this.saving.set(false); this.success.set(true); setTimeout(() => this.success.set(false), 3000); } },
        error: () => { saved++; if (saved === active.length) { this.saving.set(false); } }
      });
    });
  }
}
