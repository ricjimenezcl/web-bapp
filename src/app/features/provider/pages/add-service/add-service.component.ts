import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './add-service.component.html',
  styleUrl: './add-service.component.scss',
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
