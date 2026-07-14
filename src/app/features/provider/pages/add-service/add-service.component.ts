import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProviderService } from '../../../../core/services/provider.service';
import { CategoryService } from '../../../../core/services/category.service';
import { GeoapifyService, AddressSuggestion } from '../../../../core/services/geoapify.service';
import { AuthService } from '../../../../core/services/auth.service';
import { MainCategory, ServiceCategory } from '../../../../core/models/provider.model';
import { CustomValidators } from '../../../../shared/validators/custom-validators';
import { formatChileanPhone } from '../../../../shared/utils/form-formatters';
import { ModalService } from '../../../../core/services/modal.service';
import { DocumentUploadService } from '../../../../shared/services/document-upload.service';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MAX_PORTFOLIO_IMAGES = 5;

interface PortfolioImage {
  file: File;
  preview: string;
  url?: string;
}

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
  private modal        = inject(ModalService);
  private documentUploadSvc = inject(DocumentUploadService);
  private destroy$ = new Subject<void>();

  readonly dayNames = DAY_NAMES;
  readonly maxPortfolioImages = MAX_PORTFOLIO_IMAGES;

  // Portfolio images
  portfolioImages = signal<PortfolioImage[]>([]);
  uploadingImages = signal(false);

  mainCategories    = signal<MainCategory[]>([]);
  subServices       = signal<ServiceCategory[]>([]);
  loadingSubServices = signal(false);
  loading           = signal(false);
  error             = signal('');
  success           = signal(false);
  showPaymentGate   = signal(false);
  showIdentityGate  = signal(false);
  validationStatus  = signal<string>('not_submitted');
  identityMessage   = signal('Para agregar servicios debes verificar tu identidad.');

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
    this.checkIdentityStatus();

    // Nota: ya NO bloqueamos el formulario aquí solo por tener >=2 servicios.
    // El backend valida si existe un slot de pago activo (provider_service_slots)
    // al momento de crear el servicio: si no hay slot, responde 402 y recién ahí
    // se muestra el payment gate (ver catch en submit()). Bloquear antes impedía
    // que un proveedor que ya pagó pudiera siquiera ver el formulario.

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

  async submit(): Promise<void> {
    if (this.showIdentityGate()) {
      this.error.set('No puedes agregar servicios hasta verificar tu identidad.');
      return;
    }

    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    // lat/lng son requeridos por el backend — el usuario debe seleccionar una sugerencia
    if (this.selectedLat === null || this.selectedLng === null) {
      this.error.set('Selecciona una dirección de la lista de sugerencias para obtener las coordenadas.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    const v = this.form.value;

    // ══ SUBIR IMÁGENES DE PORTAFOLIO PRIMERO ═══════════════════════
    let portfolioUrls: string[] = [];
    
    if (this.portfolioImages().length > 0) {
      try {
        portfolioUrls = await this.uploadPortfolioImages();
        console.log('Imágenes subidas:', portfolioUrls);
      } catch (error) {
        console.error('Error subiendo imágenes:', error);
        this.loading.set(false);
        this.error.set('Error al subir imágenes. Intenta nuevamente.');
        return;
      }
    }
    // ═══════════════════════════════════════════════════════════════

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

    // ══ INCLUIR PORTFOLIO IMAGES SI EXISTEN ════════════════════════
    if (portfolioUrls.length > 0) {
      payload['portfolio_images'] = portfolioUrls;
    }
    // ═══════════════════════════════════════════════════════════════

    const confirmed = await this.modal.confirm(
      '¿Deseas confirmar el alta de este servicio?',
      'Confirmar alta de servicio',
      'Confirmar'
    );

    if (!confirmed) {
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async cancel(): Promise<void> {
    const confirmed = await this.modal.confirm(
      '¿Deseas cancelar y volver atrás? Los cambios no guardados se perderán.',
      'Cancelar creación',
      'Sí, cancelar'
    );

    if (!confirmed) {
      return;
    }
    this.router.navigate(['/provider/tabs/profile']);
  }

  goToVerifyIdentity(): void {
    this.router.navigate(['/auth/verify-identity']);
  }

  private checkIdentityStatus(): void {
    this.providerSvc.getValidationStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const status = res?.status ?? 'not_submitted';
        this.validationStatus.set(status);

        if (status !== 'approved') {
          this.showIdentityGate.set(true);
          if (status === 'pending') {
            this.identityMessage.set('Debes realizar la verificación de identidad para poder agregar servicios.');
          } else if (status === 'rejected') {
            this.identityMessage.set('Tu verificación fue rechazada. Debes verificar tu identidad nuevamente para poder agregar servicios.');
          } else {
            this.identityMessage.set('Para agregar servicios debes verificar tu identidad.');
          }
        } else {
          this.showIdentityGate.set(false);
        }
      },
      error: () => {
        this.showIdentityGate.set(true);
        this.identityMessage.set('No se pudo validar tu identidad. Verifícala antes de agregar servicios.');
      }
    });
  }

  // ══ PORTFOLIO IMAGES METHODS ══════════════════════════════════════════════

  /**
   * Handle file input change
   */
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) return;

    const currentCount = this.portfolioImages().length;
    const availableSlots = MAX_PORTFOLIO_IMAGES - currentCount;

    if (availableSlots <= 0) {
      this.error.set(`Máximo ${MAX_PORTFOLIO_IMAGES} imágenes permitidas`);
      input.value = ''; // Reset input
      return;
    }

    // Process only the available slots
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    for (const file of filesToProcess) {
      await this.processAndAddImage(file);
    }

    // Reset input to allow selecting the same file again
    input.value = '';
  }

  /**
   * Process and validate image before adding
   */
  private async processAndAddImage(file: File): Promise<void> {
    try {
      // Validate image
      const validation = await this.documentUploadSvc.validateImage(file);
      
      if (!validation.valid) {
        this.error.set(validation.error || 'Imagen no válida');
        return;
      }

      // Generate preview
      const preview = await this.fileToBase64(file);
      
      // Add to array
      this.portfolioImages.update(images => [
        ...images,
        { file, preview }
      ]);
      
    } catch (error) {
      console.error('Error procesando imagen:', error);
      this.error.set('Error al procesar imagen');
    }
  }

  /**
   * Convert file to base64 for preview
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Remove image from array
   */
  removeImage(index: number): void {
    this.portfolioImages.update(images => 
      images.filter((_, i) => i !== index)
    );
  }

  /**
   * Upload all portfolio images to Cloudinary
   * Returns array of Cloudinary URLs
   */
  private async uploadPortfolioImages(): Promise<string[]> {
    const images = this.portfolioImages();
    if (images.length === 0) return [];

    this.uploadingImages.set(true);
    const uploadedUrls: string[] = [];

    try {
      // Upload each image sequentially
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        if (!img.file) {
          console.warn(`Imagen ${i} no tiene file, saltando`);
          continue;
        }

        try {
          // Get signature from backend
          const signature = await firstValueFrom(
            this.documentUploadSvc.generateUploadSignature('portfolio')
          );
          
          if (!signature) {
            throw new Error('No se pudo generar firma de subida');
          }

          // Create FormData for Cloudinary
          const formData = new FormData();
          formData.append('file', img.file);
          // Soporta tanto uploads signed como unsigned según respuesta del backend
          if (signature.upload_preset) {
            formData.append('upload_preset', signature.upload_preset);
            formData.append('folder', signature.folder || 'portfolio');
            if (signature.public_id) {
              formData.append('public_id', signature.public_id);
            }
          } else {
            formData.append('api_key', signature.api_key);
            formData.append('timestamp', signature.timestamp.toString());
            formData.append('signature', signature.signature);
            formData.append('folder', signature.folder || 'portfolio');
          }

          // Upload to Cloudinary directly
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
}
