import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProviderService } from '../../../../core/services/provider.service';
import { CategoryService } from '../../../../core/services/category.service';
import { GeoapifyService, AddressSuggestion } from '../../../../core/services/geoapify.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MainCategory, ServiceCategory } from '../../../../core/models/provider.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

@Component({
  selector: 'app-add-service',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50 pb-8">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a routerLink="/provider/tabs/profile" class="p-2 -ml-2 text-slate-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Agregar servicio</h1>
      </header>

      <!-- Payment gate: reached 2 free services -->
      @if (showPaymentGate()) {
        <div class="p-4 space-y-4">
          <div class="card card-body text-center py-8 space-y-4">
            <div class="text-5xl">⭐</div>
            <h2 class="text-lg font-bold text-slate-800">Actualiza tu plan</h2>
            <p class="text-sm text-slate-500 leading-relaxed">
              Ya tienes 2 servicios en el plan gratuito.<br>
              Para agregar más servicios necesitas el plan Premium.
            </p>
            <a routerLink="/pages/transactions" class="btn btn-primary btn-block">
              Ver planes Premium
            </a>
            <a routerLink="/provider/tabs/profile" class="text-sm text-slate-500 hover:text-slate-700">
              Volver al perfil
            </a>
          </div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="p-4 space-y-4">
          @if (success()) {
            <div class="alert alert-success rounded-2xl border border-success-200 bg-success-50 text-success-900 shadow-sm" role="status">
              <div class="flex items-center gap-3">
                <span class="text-lg">✅</span>
                <div>
                  <p class="font-semibold">Servicio creado exitosamente</p>
                  <p class="text-sm text-success-700">Tu servicio se registró correctamente y será visible en tu perfil.</p>
                </div>
              </div>
            </div>
          }
          @if (error()) {
            <div class="alert alert-danger rounded-2xl border border-danger-200 bg-danger-50 text-danger-900 shadow-sm" role="alert">
              <div class="flex items-center gap-3">
                <span class="text-lg">⚠️</span>
                <div>
                  <p class="font-semibold">Error al crear el servicio</p>
                  <p class="text-sm text-danger-700">{{ error() }}</p>
                </div>
              </div>
            </div>
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

            <!-- Category: two-step -->
            <div class="form-group">
              <label class="form-label">Categoría principal *</label>
              <select formControlName="main_category_id" class="form-select"
                [class.error]="f['main_category_id'].invalid && f['main_category_id'].touched"
                (change)="onMainCategoryChange()">
                <option value="">Selecciona una categoría</option>
                @for (cat of mainCategories(); track cat.id) {
                  <option [value]="cat.id">{{ cat.name }}</option>
                }
              </select>
              @if (f['main_category_id'].invalid && f['main_category_id'].touched) {
                <span class="form-error">Selecciona una categoría</span>
              }
            </div>

            @if (loadingSubServices()) {
              <div class="flex items-center gap-2 text-sm text-slate-500">
                <span class="spinner"></span> Cargando servicios...
              </div>
            } @else if (subServices().length > 0) {
              <div class="form-group">
                <label class="form-label">Servicio *</label>
                <select formControlName="service_id" class="form-select"
                  [class.error]="f['service_id'].invalid && f['service_id'].touched">
                  <option value="">Selecciona un servicio</option>
                  @for (svc of subServices(); track svc.id) {
                    <option [value]="svc.id">{{ svc.name }}</option>
                  }
                </select>
                @if (f['service_id'].invalid && f['service_id'].touched) {
                  <span class="form-error">Selecciona un servicio</span>
                }
              </div>
            } @else if (f['main_category_id'].value && !loadingSubServices()) {
              <p class="text-sm text-slate-400">No hay servicios disponibles para esta categoría.</p>
            }

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
            <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Horario disponible</h2>
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

          <div class="grid grid-cols-2 gap-3">
            <button type="button" class="btn btn-secondary btn-block btn-lg" (click)="cancel()" [disabled]="loading()">
              Cancelar
            </button>
            <button type="submit" class="btn btn-primary btn-block btn-lg" [disabled]="loading()">
              @if (loading()) { <span class="spinner"></span> }
              Crear servicio
            </button>
          </div>
        </form>
      }
    </div>
  `
})
export class AddServiceComponent implements OnInit, OnDestroy {
  private fb           = inject(FormBuilder);
  private providerSvc  = inject(ProviderService);
  private categorySvc  = inject(CategoryService);
  private geoapify     = inject(GeoapifyService);
  private auth         = inject(AuthService);
  private router       = inject(Router);
  private destroy$ = new Subject<void>();

  readonly dayNames = DAY_NAMES;

  mainCategories    = signal<MainCategory[]>([]);
  subServices       = signal<ServiceCategory[]>([]);
  loadingSubServices = signal(false);
  loading           = signal(false);
  error             = signal('');
  success           = signal(false);
  showPaymentGate   = signal(false);

  // Address autocomplete
  addressSuggestions = signal<AddressSuggestion[]>([]);
  showSuggestions    = signal(false);
  searchingAddress   = signal(false);
  private selectedLat: number | null = null;
  private selectedLng: number | null = null;

  form = this.fb.group({
    business_name:    ['', Validators.required],
    main_category_id: ['', Validators.required],
    service_id:       ['', Validators.required],
    description:      [''],
    address:          ['', Validators.required],
    phone:            ['', [Validators.required, CustomValidators.phone()]],
    hourly_rate:      [null as number | null],
    working_hours:    this.fb.array(this.buildWorkingHoursControls()),
  });

  get workingHoursArray(): FormArray {
    return this.form.get('working_hours') as FormArray;
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    // Check service count gate
    this.providerSvc.getMyServices().pipe(takeUntil(this.destroy$)).subscribe({
      next: (services) => {
        if (services.length >= 2) {
          this.showPaymentGate.set(true);
        }
      },
      error: () => {}
    });

    // Load main categories
    this.categorySvc.getMainCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats) => this.mainCategories.set(cats),
      error: () => {}
    });

    // Autocomplete: usa valueChanges del control para que el stream NUNCA muera.
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMainCategoryChange(): void {
    const id = Number(this.form.get('main_category_id')?.value);
    this.form.get('service_id')?.setValue('');
    this.subServices.set([]);
    if (!id) return;

    this.loadingSubServices.set(true);
    this.categorySvc.getCategoryWithServices(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (cat) => {
        this.subServices.set(cat.services ?? []);
        this.loadingSubServices.set(false);
      },
      error: () => {
        // Fallback: try getServices with main_category_id
        this.categorySvc.getServices({ main_category_id: id }).pipe(takeUntil(this.destroy$)).subscribe({
          next: (svcs) => { this.subServices.set(svcs); this.loadingSubServices.set(false); },
          error: () => this.loadingSubServices.set(false)
        });
      }
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

    // lat/lng son requeridos por el backend — el usuario debe seleccionar una sugerencia
    if (this.selectedLat === null || this.selectedLng === null) {
      this.error.set('Selecciona una dirección de la lista de sugerencias para obtener las coordenadas.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const v = this.form.value;

    // Payload con los nombres de campo exactos que espera el backend
    const payload: Record<string, unknown> = {
      servicio:         Number(v.main_category_id),
      categoria:        Number(v.service_id),
      nombre_prestador: v.business_name!,
      fono:             (v.phone! as string).replace(/\s/g, ''),  // quitar espacios del formato
      detalle:          v.description || '',
      direccion:        v.address!,
      lat:              this.selectedLat,
      lng:              this.selectedLng,
      id_contacto:      this.auth.currentUser()?.id ?? 0,
    };

    if (!confirm('¿Deseas confirmar el alta de este servicio?')) {
      this.loading.set(false);
      return;
    }

    this.providerSvc.createService(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (createdService) => {
        // Guardar horarios como service-specific schedules (tabla service_availability)
        // que es la que usa el backend para calcular available-slots en reservas
        const providerId: number = (createdService as any).provider_id;
        const serviceProviderId: number = (createdService as any).id;

        const activeHours = (v.working_hours as any[])
          .map((wh: any, i: number) => ({ ...wh, day_of_week: i }))
          .filter((wh: any) => wh.is_active && wh.start_time && wh.end_time);

        const finish = () => {
          this.loading.set(false);
          this.error.set('');
          this.success.set(true);
          setTimeout(() => this.success.set(false), 2500);
          setTimeout(() => this.router.navigate(['/provider/tabs/profile']), 2200);
        };

        if (activeHours.length === 0 || !providerId || !serviceProviderId) {
          finish();
          return;
        }

        let saved = 0;
        for (const wh of activeHours) {
          this.providerSvc.saveServiceSchedule(providerId, serviceProviderId, {
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
        this.loading.set(false);
        if (err?.status === 402) {
          this.showPaymentGate.set(true);
        } else {
          this.error.set(err?.error?.detail ?? 'Error al crear servicio.');
        }
      }
    });
  }

  private buildWorkingHoursControls(): FormGroup[] {
    return DAY_NAMES.map((_, i) => this.fb.group({
      day_of_week: [i],
      is_active:   [i < 5],   // Mon–Fri active by default
      start_time:  ['09:00'],
      end_time:    ['18:00'],
    }));
  }

  cancel(): void {
    if (!confirm('¿Deseas cancelar y volver atrás? Los cambios no guardados se perderán.')) {
      return;
    }
    this.router.navigate(['/provider/tabs/profile']);
  }
}
