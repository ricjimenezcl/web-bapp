import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './edit-service.component.html',
  styleUrl: './edit-service.component.scss',
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
    if (!confirm('¿Deseas confirmar la actualización de este servicio?')) {
      this.saving.set(false);
      return;
    }

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
          this.error.set('');
          this.success.set(true);
          setTimeout(() => this.success.set(false), 2500);
          setTimeout(() => this.router.navigate(['/provider/tabs/my-services']), 2200);
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

  cancel(): void {
    if (!confirm('¿Deseas cancelar la edición? Los cambios no guardados se perderán.')) {
      return;
    }
    this.router.navigate(['/provider/tabs/my-services']);
  }
}
