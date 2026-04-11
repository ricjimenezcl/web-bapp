import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProviderService } from '../../../../core/services/provider.service';
import { GeoapifyService, AddressSuggestion } from '../../../../core/services/geoapify.service';
import { ProviderWorkingHours } from '../../../../core/models/provider.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

@Component({
  selector: 'app-edit-service',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50 pb-8">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/provider/tabs/my-services" class="p-2 -ml-2 text-slate-600 hover:text-slate-800 hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Editar servicio</h1>
      </header>

      @if (loading()) {
        <div class="flex justify-center py-16">
          <span class="spinner w-8 h-8 border-primary-600"></span>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-4 space-y-4">
          @if (success()) {
            <div class="alert alert-success">Servicio actualizado exitosamente</div>
          }
          @if (error()) {
            <div class="alert alert-danger">{{ error() }}</div>
          }

          <!-- Basic info -->
          <div class="card card-body space-y-4">
            <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Información del servicio</h2>

            <div class="form-group">
              <label class="form-label">Nombre del servicio *</label>
              <input type="text" formControlName="business_name" class="form-input"
                [class.error]="f['business_name'].invalid && f['business_name'].touched"
                placeholder="Ej: Plomería residencial">
              @if (f['business_name'].invalid && f['business_name'].touched) {
                <span class="form-error">El nombre es requerido</span>
              }
            </div>

            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea formControlName="description" rows="3" class="form-textarea"
                placeholder="Describe tu servicio..."></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Teléfono de contacto *</label>
              <input type="tel" formControlName="phone" class="form-input"
                [class.error]="f['phone'].invalid && f['phone'].touched"
                placeholder="+56 9 XXXX XXXX"
                maxlength="17"
                (input)="onPhoneInput($event)">
              @if (f['phone'].invalid && f['phone'].touched) {
                <span class="form-error">
                  {{ f['phone'].errors?.['required'] ? 'El teléfono es requerido' : 'Ingresa un teléfono chileno válido. Ej: +56 9 1234 5678' }}
                </span>
              }
            </div>

            <div class="form-group">
              <label class="form-label">Tarifa por hora ($)</label>
              <input type="number" formControlName="hourly_rate" class="form-input" placeholder="0" min="0">
            </div>

            <div class="form-group">
              <label class="form-label flex items-center gap-2 cursor-pointer">
                <input type="checkbox" formControlName="is_available" class="rounded border-surface-300 text-primary-600">
                <span>Disponible para nuevas reservas</span>
              </label>
            </div>
          </div>

          <!-- Address autocomplete -->
          <div class="card card-body space-y-3">
            <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Dirección</h2>
            <div class="form-group relative">
              <label class="form-label">Dirección del servicio *</label>
              <div class="relative">
                <input
                  type="text"
                  formControlName="address"
                  class="form-input pr-8"
                  [class.error]="f['address'].invalid && f['address'].touched"
                  placeholder="Calle, ciudad..."
                  autocomplete="off"
                  (focus)="showSuggestions.set(addressSuggestions().length > 0)"
                  (blur)="onAddressBlur()">
                @if (f['address'].value && !searchingAddress()) {
                  <button type="button" (click)="clearAddress()"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                }
                @if (searchingAddress()) {
                  <span class="absolute right-2 top-1/2 -translate-y-1/2 spinner"></span>
                }
              </div>
              @if (f['address'].invalid && f['address'].touched) {
                <span class="form-error">La dirección es requerida</span>
              }

              <!-- Suggestions dropdown -->
              @if (showSuggestions() && addressSuggestions().length > 0) {
                <div class="absolute z-50 left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-lg overflow-hidden">
                  @for (sug of addressSuggestions(); track sug.id) {
                    <button type="button"
                      (mousedown)="selectSuggestion(sug)"
                      class="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-surface-50 text-left border-b border-surface-100 last:border-0">
                      <span class="text-lg leading-none mt-0.5 shrink-0">{{ sug.icon }}</span>
                      <div class="min-w-0">
                        <p class="text-sm font-medium text-slate-700 truncate">{{ sug.displayText }}</p>
                        @if (sug.context) {
                          <p class="text-xs text-slate-400 truncate">{{ sug.context }}</p>
                        }
                      </div>
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Working hours -->
          <div class="card card-body space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Horario disponible</h2>
              @if (loadingHours()) {
                <span class="spinner w-4 h-4 border-slate-400"></span>
              }
            </div>
            <p class="text-xs text-slate-500">Indica los días y horarios en que ofreces este servicio.</p>

            <div [formArrayName]="'working_hours'" class="space-y-3">
              @for (ctrl of workingHoursArray.controls; track $index; let i = $index) {
                <div [formGroupName]="i" class="border border-surface-200 rounded-xl p-3">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-slate-700">{{ dayNames[i] }}</span>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" formControlName="is_active" class="sr-only peer">
                      <div class="w-9 h-5 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  @if (ctrl.get('is_active')?.value) {
                    <div class="grid grid-cols-2 gap-2">
                      <div class="form-group mb-0">
                        <label class="form-label text-xs">Inicio</label>
                        <input type="time" formControlName="start_time" class="form-input text-sm py-1.5">
                      </div>
                      <div class="form-group mb-0">
                        <label class="form-label text-xs">Fin</label>
                        <input type="time" formControlName="end_time" class="form-input text-sm py-1.5">
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Guardar cambios
          </button>
        </form>
      }
    </div>
  `
})
export class EditServiceComponent implements OnInit, OnDestroy {
  private fb          = inject(FormBuilder);
  private providerSvc = inject(ProviderService);
  private geoapify    = inject(GeoapifyService);
  private router      = inject(Router);
  private route       = inject(ActivatedRoute);
  private destroy$    = new Subject<void>();

  readonly dayNames = DAY_NAMES;

  loading      = signal(true);
  loadingHours = signal(false);
  saving       = signal(false);
  error        = signal('');
  success      = signal(false);
  private serviceId  = 0;
  private providerId = 0;  // requerido para el endpoint PUT /providers/{providerId}/services/{serviceId}

  // Address autocomplete
  addressSuggestions = signal<AddressSuggestion[]>([]);
  showSuggestions    = signal(false);
  searchingAddress   = signal(false);
  private selectedLat: number | null = null;
  private selectedLng: number | null = null;

  form = this.fb.group({
    business_name: ['', Validators.required],
    description:   [''],
    address:       ['', Validators.required],
    phone:         ['', [Validators.required, CustomValidators.phone()]],
    hourly_rate:   [null as number | null],
    is_available:  [true],
    working_hours: this.fb.array(this.buildWorkingHoursControls()),
  });

  get workingHoursArray(): FormArray {
    return this.form.get('working_hours') as FormArray;
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.serviceId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    if (!this.serviceId) {
      this.router.navigate(['/provider/tabs/my-services']);
      return;
    }
    this.loadService();
    this.setupAddressAutocomplete();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupAddressAutocomplete(): void {
    // Usa valueChanges para que el stream nunca muera aunque falle un request HTTP.
    // catchError dentro del switchMap aísla errores por request sin matar la cadena.
    this.form.get('address')!.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 3) {
          this.addressSuggestions.set([]);
          this.showSuggestions.set(false);
          this.searchingAddress.set(false);
          return of([] as AddressSuggestion[]);
        }
        // User is typing manually — clear previously selected coords
        this.selectedLat = null;
        this.selectedLng = null;
        this.searchingAddress.set(true);
        return this.geoapify.autocompleteAddress(query).pipe(
          catchError(() => {
            this.searchingAddress.set(false);
            return of([] as AddressSuggestion[]);
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      this.searchingAddress.set(false);
      this.addressSuggestions.set(results);
      this.showSuggestions.set(results.length > 0);
    });
  }

  private loadService(): void {
    this.providerSvc.getMyServices().pipe(takeUntil(this.destroy$)).subscribe({
      next: (services) => {
        const svc = services.find(s => s.id === this.serviceId);
        if (!svc) {
          this.error.set('Servicio no encontrado.');
          this.loading.set(false);
          return;
        }
        this.providerId = svc.provider_id;  // necesario para el endpoint de actualización
        this.form.patchValue({
          business_name: svc.business_name,
          description:   svc.description ?? '',
          address:       svc.address,
          phone:         svc.phone,
          hourly_rate:   svc.hourly_rate ?? null,
          is_available:  svc.is_available,
        });
        // Pre-fill lat/lng if available
        if (svc.latitude) this.selectedLat = svc.latitude;
        if (svc.longitude) this.selectedLng = svc.longitude;
        this.loading.set(false);
        this.loadWorkingHours();
      },
      error: () => {
        this.error.set('Error al cargar el servicio.');
        this.loading.set(false);
      }
    });
  }

  private loadWorkingHours(): void {
    this.loadingHours.set(true);
    this.providerSvc.getMyWorkingHours().pipe(takeUntil(this.destroy$)).subscribe({
      next: (hours) => {
        if (hours && hours.length > 0) {
          // Reset all days inactive first
          this.workingHoursArray.controls.forEach(ctrl => ctrl.get('is_active')?.setValue(false));
          // Apply loaded hours
          hours.forEach(wh => {
            const dayIndex = wh.day_of_week;
            if (dayIndex >= 0 && dayIndex < 7) {
              const ctrl = this.workingHoursArray.at(dayIndex);
              ctrl.patchValue({
                is_active:  wh.is_active,
                start_time: wh.start_time?.substring(0, 5) ?? '09:00',
                end_time:   wh.end_time?.substring(0, 5) ?? '18:00',
              });
            }
          });
        }
        this.loadingHours.set(false);
      },
      error: () => this.loadingHours.set(false)
    });
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanPhone(input.value);
    input.value = formatted;
    this.form.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  onAddressBlur(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  selectSuggestion(sug: AddressSuggestion): void {
    this.form.get('address')?.setValue(sug.formatted);
    this.selectedLat = sug.lat;
    this.selectedLng = sug.lon;
    this.addressSuggestions.set([]);
    this.showSuggestions.set(false);
  }

  clearAddress(): void {
    this.form.get('address')?.setValue('');
    this.selectedLat = null;
    this.selectedLng = null;
    this.addressSuggestions.set([]);
    this.showSuggestions.set(false);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');
    const v = this.form.value;

    // Endpoint: PUT /providers/{providerId}/services/{serviceId}
    // Acepta nombres en inglés (ServiceProviderUpdateRequest)
    this.providerSvc.updateService(this.providerId, this.serviceId, {
      business_name: v.business_name!,
      description:   v.description ?? undefined,
      address:       v.address!,
      latitude:      this.selectedLat ?? undefined,
      longitude:     this.selectedLng ?? undefined,
      phone:         v.phone!,
    } as any).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        // Guardar horarios como service-specific schedules (tabla service_availability)
        const activeHours = (v.working_hours as any[])
          .map((wh: any, i: number) => ({ ...wh, day_of_week: i }))
          .filter((wh: any) => wh.is_active && wh.start_time && wh.end_time);

        const finish = () => {
          this.saving.set(false);
          this.success.set(true);
          setTimeout(() => this.router.navigate(['/provider/tabs/my-services']), 1500);
        };

        if (activeHours.length === 0 || !this.providerId || !this.serviceId) {
          finish();
          return;
        }

        let saved = 0;
        for (const wh of activeHours) {
          this.providerSvc.saveServiceSchedule(this.providerId, this.serviceId, {
            day_of_week:  wh.day_of_week,
            start_time:   wh.start_time,
            end_time:     wh.end_time,
            is_available: true,
          }).subscribe({
            next:  () => { if (++saved === activeHours.length) finish(); },
            error: () => { if (++saved === activeHours.length) finish(); }
          });
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Error al actualizar el servicio.');
      }
    });
  }

  private buildWorkingHoursControls(): FormGroup[] {
    return DAY_NAMES.map((_, i) => this.fb.group({
      day_of_week: [i],
      is_active:   [i < 5],
      start_time:  ['09:00'],
      end_time:    ['18:00'],
    }));
  }
}
