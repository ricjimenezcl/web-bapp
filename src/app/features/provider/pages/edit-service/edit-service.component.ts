import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProviderService } from '../../../../core/services/provider.service';
import { GeoapifyService, AddressSuggestion } from '../../../../core/services/geoapify.service';
import { ProviderWorkingHours } from '../../../../core/models/provider.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';
import { ModalService } from '../../../../core/services/modal.service';
import { DocumentUploadService } from '../../../../shared/services/document-upload.service';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MAX_PORTFOLIO_IMAGES = 5;

interface PortfolioImage {
  file?: File;
  preview: string;
  url?: string;
  isExisting?: boolean;
}

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
  private modal       = inject(ModalService);
  private documentUploadSvc = inject(DocumentUploadService);
  private destroy$    = new Subject<void>();

  readonly dayNames = DAY_NAMES;
  readonly maxPortfolioImages = MAX_PORTFOLIO_IMAGES;

  // Portfolio images
  portfolioImages = signal<PortfolioImage[]>([]);
  uploadingImages = signal(false);

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
        
        // Load existing portfolio images
        this.loadExistingPortfolioImages(svc);
        
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

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error.set('');
    const v = this.form.value;

    // ══ SUBIR NUEVAS IMÁGENES DE PORTAFOLIO ════════════════════════════
    const existingUrls = this.portfolioImages()
      .filter(img => img.isExisting && img.url)
      .map(img => img.url!);
    
    const newImages = this.portfolioImages().filter(img => !img.isExisting && img.file);
    let newUploadedUrls: string[] = [];

    if (newImages.length > 0) {
      try {
        newUploadedUrls = await this.uploadPortfolioImages(newImages);
      } catch (error) {
        console.error('Error subiendo imágenes:', error);
        this.saving.set(false);
        this.error.set('Error al subir imágenes. Intenta nuevamente.');
        return;
      }
    }

    const allPortfolioUrls = [...existingUrls, ...newUploadedUrls];
    // ══════════════════════════════════════════════════════════════════

    // Endpoint: PUT /providers/{providerId}/services/{serviceId}
    // Acepta nombres en inglés (ServiceProviderUpdateRequest)
    const confirmed = await this.modal.confirm(
      '¿Deseas confirmar la actualización de este servicio?',
      'Confirmar edición',
      'Actualizar'
    );

    if (!confirmed) {
      this.saving.set(false);
      return;
    }

    const updateData: any = {
      business_name: v.business_name!,
      description:   v.description ?? undefined,
      address:       v.address!,
      latitude:      this.selectedLat ?? undefined,
      longitude:     this.selectedLng ?? undefined,
      phone:         v.phone!,
    };

    // ══ INCLUIR PORTFOLIO IMAGES ══════════════════════════════════════
    if (allPortfolioUrls.length > 0) {
      updateData.portfolio_images = allPortfolioUrls;
    } else {
      updateData.portfolio_images = [];
    }
    // ══════════════════════════════════════════════════════════════════

    this.providerSvc.updateService(this.providerId, this.serviceId, updateData).pipe(takeUntil(this.destroy$)).subscribe({
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

  async cancel(): Promise<void> {
    const confirmed = await this.modal.confirm(
      '¿Deseas cancelar la edición? Los cambios no guardados se perderán.',
      'Cancelar edición',
      'Sí, salir'
    );

    if (!confirmed) {
      return;
    }
    this.router.navigate(['/provider/tabs/my-services']);
  }

  // ══ PORTFOLIO IMAGES METHODS ══════════════════════════════════════════════

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;

    const currentCount = this.portfolioImages().length;
    const availableSlots = MAX_PORTFOLIO_IMAGES - currentCount;

    if (availableSlots <= 0) {
      this.error.set(`Máximo ${MAX_PORTFOLIO_IMAGES} imágenes permitidas`);
      input.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);

    for (const file of filesToProcess) {
      await this.processAndAddImage(file);
    }

    input.value = '';
  }

  private async processAndAddImage(file: File): Promise<void> {
    try {
      const validation = await this.documentUploadSvc.validateImage(file);
      
      if (!validation.valid) {
        this.error.set(validation.error || 'Imagen no válida');
        return;
      }

      const preview = await this.fileToBase64(file);
      
      this.portfolioImages.update(images => [
        ...images,
        { file, preview, isExisting: false }
      ]);
      
    } catch (error) {
      console.error('Error procesando imagen:', error);
      this.error.set('Error al procesar imagen');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number): void {
    this.portfolioImages.update(images => 
      images.filter((_, i) => i !== index)
    );
  }

  private async uploadPortfolioImages(newImages: PortfolioImage[]): Promise<string[]> {
    if (newImages.length === 0) return [];

    this.uploadingImages.set(true);
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        
        if (!img.file) {
          console.warn(`Imagen ${i} no tiene file, saltando`);
          continue;
        }

        try {
          const signature = await firstValueFrom(
            this.documentUploadSvc.generateUploadSignature('portfolio')
          );
          
          if (!signature) {
            throw new Error('No se pudo generar firma de subida');
          }

          const formData = new FormData();
          formData.append('file', img.file);
          formData.append('api_key', signature.api_key);
          formData.append('timestamp', signature.timestamp.toString());
          formData.append('signature', signature.signature);
          formData.append('folder', 'portfolio');

          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${signature.cloud_name}/image/upload`,
            {
              method: 'POST',
              body: formData
            }
          );

          const data = await response.json();
          
          if (data.secure_url) {
            uploadedUrls.push(data.secure_url);
          } else {
            console.error('Respuesta sin URL:', data);
          }
          
        } catch (error) {
          console.error(`Error subiendo imagen ${i}:`, error);
        }
      }

      this.uploadingImages.set(false);
      return uploadedUrls;
      
    } catch (error) {
      this.uploadingImages.set(false);
      console.error('Error general en upload:', error);
      throw error;
    }
  }

  private loadExistingPortfolioImages(serviceData: any) {
    if (serviceData && serviceData.portfolio_images) {
      const images = serviceData.portfolio_images;
      
      if (Array.isArray(images)) {
        this.portfolioImages.set(images.map((img: any) => ({
          url: typeof img === 'string' ? img : img.url,
          preview: typeof img === 'string' ? img : img.url,
          isExisting: true
        })));
      }
    }
  }
}
