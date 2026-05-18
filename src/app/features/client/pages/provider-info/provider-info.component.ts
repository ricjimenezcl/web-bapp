import { Component, inject, signal, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, forkJoin, takeUntil, catchError } from 'rxjs';
import { ProviderService } from '../../../../core/services/provider.service';
import { BookingService } from '../../../../core/services/booking.service';
import { ChatService } from '../../../../core/services/chat.service';
import { ReviewService } from '../../../../core/services/review.service';
import { GeoapifyService, AddressSuggestion } from '../../../../core/services/geoapify.service';
import { SearchStateService } from '../../../../core/services/search-state.service';
import { ContactLimitService } from '../../../../core/services/contact-limit.service';
import { ProviderProfile, ServiceProvider, ProviderWorkingHours } from '../../../../core/models/provider.model';
import { Review } from '../../../../core/models/review.model';
import { ModalService } from '../../../../core/services/modal.service';

interface CalendarDay {
  dateStr: string;      // YYYY-MM-DD
  dayLabel: string;     // "lun.", "mar.", …
  dayNum: number;       // 1-31
  monthLabel: string;   // "mar.", "abr.", …
  isActive: boolean;    // el proveedor trabaja ese día
  isSelected: boolean;  // día actualmente seleccionado
}

@Component({
  selector: 'app-provider-info',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './provider-info.component.html',
  styleUrl: './provider-info.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ProviderInfoComponent implements OnInit, OnDestroy {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly location     = inject(Location);
  private readonly searchState  = inject(SearchStateService);
  private readonly providerSvc = inject(ProviderService);
  private readonly bookingSvc  = inject(BookingService);
  private readonly chatSvc     = inject(ChatService);
  private readonly reviewSvc   = inject(ReviewService);
  private readonly geoapify    = inject(GeoapifyService);
  readonly contactLimit        = inject(ContactLimitService);
  private readonly modal       = inject(ModalService);
  private readonly destroy$    = new Subject<void>();

  // ── Datos del proveedor ──────────────────────────────────────────────────
  provider    = signal<ProviderProfile | null>(null);
  services    = signal<ServiceProvider[]>([]);
  reviews     = signal<Review[]>([]);
  loading     = signal(true);

  // ── Tabs ─────────────────────────────────────────────────────────────────
  activeTab = signal<'profile' | 'reviews' | 'contact'>('profile');

  // ── Booking modal ────────────────────────────────────────────────────────
  bookingOpen      = signal(false);
  bookingLoading   = signal(false);
  bookingAttempted = signal(false);
  selectedService  = signal<ServiceProvider | null>(null);
  selectedDate     = signal('');
  selectedSlot     = signal('');

  // ── Calendar (working hours) ─────────────────────────────────────────────
  hoursLoaded  = signal(false);
  calendarDays = signal<CalendarDay[]>([]);
  providerWH   = signal<ProviderWorkingHours[]>([]);

  // ── Slots con estado disponible/ocupado ──────────────────────────────────
  allSlots      = signal<{ time: string; available: boolean }[]>([]);
  isLoadingTimes = signal(false);

  // ── Ubicación ───────────────────────────────────────────────────────────
  userLocation       = signal<{ lat: number; lng: number } | null>(null);
  showLocationPrompt = signal(false);

  // ── Autocompletado de dirección ──────────────────────────────────────────
  addressInput       = signal('');
  addressSuggestions = signal<AddressSuggestion[]>([]);
  showSuggestions    = signal(false);
  searchingAddress   = signal(false);
  selectedAddress    = signal<AddressSuggestion | null>(null);

  // ── Notas ────────────────────────────────────────────────────────────────
  bookingNotes = signal('');

  // ── Chat ─────────────────────────────────────────────────────────────────
  isStartingChat = signal(false);

  // ── Privadas ─────────────────────────────────────────────────────────────
  private activeDays             = new Set<number>();
  private slotsCache             = new Map<string, { time: string; available: boolean }[]>();
  private useManualAddress       = false;
  private hasShownLocationPrompt = false;
  private readonly searchTerms   = new Subject<string>();
  providerId!: number;

  // ── Getters normalizados de proveedor ─────────────────────────────────────
  get providerName(): string {
    return this.provider()?.full_name ?? '';
  }

  get providerRating(): number | string {
    return this.provider()?.rating_avg ?? (this.reviews().length ? this.avgRating : 'Nuevo');
  }

  get providerReviewCount(): number {
    return this.provider()?.total_reviews ?? this.reviews().length;
  }

  get providerHourlyRate(): number | null {
    return this.services()[0]?.hourly_rate ?? null;
  }

  get providerPhone(): string {
    return this.provider()?.phone ?? 'No disponible';
  }

  get providerMail(): string {
    return this.provider()?.email ?? 'No disponible';
  }

  get providerAddress(): string {
    // Primero intenta obtener del perfil raíz, luego del primer servicio (donde viene en /providers/{id}/detailed)
    return this.provider()?.address ?? this.services()[0]?.address ?? 'No disponible';
  }

  get providerDescription(): string {
    return this.provider()?.bio ?? '';
  }

  get hasWorkingHours(): boolean {
    return this.activeDays.size > 0;
  }

  get isBookingValid(): boolean {
    return !!(this.selectedDate() && this.selectedSlot() && this.addressInput());
  }

  get avgRating(): number {
    if (!this.reviews().length) return 0;
    return this.reviews().reduce((s, r) => s + r.rating, 0) / this.reviews().length;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.providerId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    this.setupAddressAutocomplete();
    // Working hours se cargan después de services para tener el spid disponible
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────
  load(): void {
    // Obtiene todo en una sola llamada al endpoint /providers/{id}/detailed
    this.providerSvc.getProviderDetailedProfile(this.providerId).subscribe({
      next:  (profile) => {
        this.provider.set(profile);
        // Extrae los servicios del perfil si existen
        if (profile.services && profile.services.length > 0) {
          this.services.set(profile.services);
        }
        this.loadProviderWorkingHours();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading provider detailed profile:', err);
        this.loading.set(false);
      }
    });
    
    this.reviewSvc.getProviderReviews(this.providerId).subscribe({
      next:  (r) => this.reviews.set(r),
      error: ()  => {}
    });
  }

  // ── Working hours & calendario ────────────────────────────────────────────
  private loadProviderWorkingHours(): void {
    const spid = this.services()[0]?.id ?? 0;

    // Fuente primaria: ProviderWorkingHours | Fuente secundaria: ServiceAvailability schedules
    const wh$ = this.providerSvc.getProviderWorkingHours(this.providerId)
      .pipe(catchError(() => of([])));
    const ss$ = spid
      ? this.providerSvc.getServiceSchedules(this.providerId, spid).pipe(catchError(() => of([])))
      : of([]);

    forkJoin([wh$, ss$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([hours, schedules]) => {
        const wh = (hours as ProviderWorkingHours[]) || [];
        this.activeDays.clear();

        // Fuente primaria: ProviderWorkingHours
        wh.filter(h => !!h.is_active).forEach(h => this.activeDays.add(h.day_of_week));

        let merged = [...wh];

        // Fallback: ServiceAvailability si ProviderWorkingHours está vacío
        if (this.activeDays.size === 0) {
          (schedules as any[]).filter(s => s.is_available).forEach(s => {
            this.activeDays.add(s.day_of_week);
            merged.push({
              id: 0,
              provider_id: this.providerId,
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              is_active: true
            } as ProviderWorkingHours);
          });
        }

        this.providerWH.set(merged);
        this.hoursLoaded.set(true);
        this.generateCalendarDays();
      });
  }

  private generateCalendarDays(): void {
    const today = new Date();
    const days: CalendarDay[] = [];

    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const y   = d.getFullYear();
      const mo  = d.getMonth();
      const day = d.getDate();
      const dateStr    = `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const backendDow = (d.getDay() + 6) % 7; // JS Sun=0 → backend Sun=6; JS Mon=1 → backend Mon=0
      days.push({
        dateStr,
        dayLabel:   d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayNum:     day,
        monthLabel: d.toLocaleDateString('es-ES', { month: 'short' }),
        isActive:   this.activeDays.has(backendDow),
        isSelected: false
      });
    }

    // Auto-selecciona primer día disponible (inmutable para signal change detection)
    const firstIdx = days.findIndex(d => d.isActive);
    if (firstIdx >= 0) {
      days[firstIdx] = { ...days[firstIdx], isSelected: true };
    }
    this.calendarDays.set(days);

    if (firstIdx >= 0) {
      this.selectedDate.set(days[firstIdx].dateStr);
      this.selectedSlot.set('');
      this.allSlots.set([]);
      // Sólo carga slots si el modal ya está abierto
      if (this.bookingOpen()) {
        this.fetchAvailableSlots();
      }
    }
  }

  selectCalendarDay(day: CalendarDay): void {
    if (!day.isActive) return;
    this.calendarDays.update(days => days.map(d => ({ ...d, isSelected: d.dateStr === day.dateStr })));
    this.selectedDate.set(day.dateStr);
    this.selectedSlot.set('');
    this.allSlots.set([]);
    this.slotsCache.delete(day.dateStr);
    this.fetchAvailableSlots();
  }

  trackByDate(_index: number, day: CalendarDay): string {
    return day.dateStr;
  }

  // ── Slots ─────────────────────────────────────────────────────────────────
  private fetchAvailableSlots(): void {
    if (!this.selectedDate()) return;

    const datePart = this.selectedDate().substring(0, 10);
    const pid  = this.providerId;
    const spid = this.selectedService()?.id ?? this.services()[0]?.id ?? 0;

    // Verificar que el proveedor trabaja ese día
    if (this.hoursLoaded() && this.activeDays.size > 0) {
      const [fy, fm, fd] = datePart.split('-').map(Number);
      const backendDow   = (new Date(fy, fm - 1, fd).getDay() + 6) % 7;
      if (!this.activeDays.has(backendDow)) {
        this.allSlots.set([]);
        return;
      }
    }

    // Cache hit
    const cached = this.slotsCache.get(datePart);
    if (cached) {
      this.allSlots.set(cached);
      return;
    }

    // Mostrar slots locales inmediatamente (todos disponibles como placeholder)
    this.generateSlotsFromWorkingHours();
    if (this.allSlots().length > 0) {
      this.slotsCache.set(datePart, [...this.allSlots()]); // cache provisional
    }

    // Sin service_provider_id no podemos consultar disponibilidad real
    if (!spid) return;

    // Enriquecer en background con estado real de reservas
    this.isLoadingTimes.set(true);
    this.providerSvc.getAvailableSlotsByService(pid, spid, datePart)
      .pipe(takeUntil(this.destroy$), catchError(() => of(null)))
      .subscribe(response => {
        // Solo actualizar si el usuario sigue en la misma fecha
        if (this.selectedDate().startsWith(datePart) && response?.slots?.length) {
          this.allSlots.set(response.slots);
          this.slotsCache.set(datePart, response.slots);
        }
        this.isLoadingTimes.set(false);
      });
  }

  private generateSlotsFromWorkingHours(): void {
    if (!this.selectedDate() || this.providerWH().length === 0) {
      this.allSlots.set([]);
      return;
    }
    const [gy, gm, gd] = this.selectedDate().substring(0, 10).split('-').map(Number);
    const backendDow    = (new Date(gy, gm - 1, gd).getDay() + 6) % 7;
    const dayHours      = this.providerWH().find(h => h.day_of_week === backendDow && !!h.is_active);
    if (!dayHours) {
      this.allSlots.set([]);
      return;
    }
    const [sh, sm]  = dayHours.start_time.split(':').map(Number);
    const [eh, em]  = dayHours.end_time.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins   = eh * 60 + em;
    const slots: { time: string; available: boolean }[] = [];
    for (let m = startMins; m < endMins; m += 60) {
      slots.push({
        time:      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
        available: true
      });
    }
    this.allSlots.set(slots);
  }

  // ── Booking modal ─────────────────────────────────────────────────────────
  openBooking(service?: ServiceProvider): void {
    const svc = service ?? this.services()[0] ?? null;
    this.selectedService.set(svc);
    this.bookingOpen.set(true);
    this.bookingAttempted.set(false);
    this.selectedSlot.set('');
    this.addressInput.set('');
    this.selectedAddress.set(null);
    this.bookingNotes.set('');
    this.allSlots.set([]);
    this.hasShownLocationPrompt = false;
    this.useManualAddress       = false;

    if (!this.hoursLoaded()) {
      this.loadProviderWorkingHours();
    } else {
      this.generateCalendarDays();
    }
  }

  closeBooking(): void {
    this.bookingOpen.set(false);
    this.bookingAttempted.set(false);
    this.allSlots.set([]);
    this.selectedSlot.set('');
    this.slotsCache.clear();
  }

  confirmBooking(): void {
    this.bookingAttempted.set(true);

    if (!this.selectedDate() || !this.selectedSlot() || !this.addressInput()) {
      this.showToast('Por favor completa todos los campos requeridos', 'warning');
      return;
    }

    const service  = this.selectedService() ?? this.services()[0] ?? null;
    const datePart = this.selectedDate().includes('T')
      ? this.selectedDate().split('T')[0]
      : this.selectedDate();
    let timePart = this.selectedSlot();
    if (timePart.length === 5) timePart = `${timePart}:00`;

    // service_id es requerido por el backend (service_providers.id)
    const serviceId = Number(service?.service_id ?? service?.id ?? 0);
    if (!serviceId) {
      this.showToast('Error: no se pudo identificar el servicio', 'danger');
      return;
    }

    const serviceCategory = service?.service_category?.name ?? 'GENERAL';
    const duration        = 60;
    const totalPrice      = (service?.hourly_rate ?? 0) * (duration / 60);

    this.bookingLoading.set(true);
    this.bookingSvc.createBooking({
      provider_id:      this.providerId,
      service_id:       serviceId,
      service_provider_id: service?.id,
      scheduled_date:   datePart,
      scheduled_time:   timePart,
      duration:         duration,
      total_price:      totalPrice,
      description:      this.bookingNotes() || 'Sin descripción',
      location_address: this.addressInput(),
      location_lat:     this.userLocation()?.lat,
      location_lng:     this.userLocation()?.lng,
      service_category: serviceCategory
    }).subscribe({
      next: () => {
        this.bookingLoading.set(false);
        this.showToast('¡Reserva enviada exitosamente!', 'success');
        this.closeBooking();
        setTimeout(() => this.router.navigate(['/client/tabs/bookings']), 1200);
      },
      error: (err) => {
        this.bookingLoading.set(false);
        const errorMsg = err?.error?.detail ?? err?.error?.message ?? 'Error al crear la reserva';
        this.showToast(errorMsg, 'danger');
      }
    });
  }

  // ── Dirección ─────────────────────────────────────────────────────────────
  private setupAddressAutocomplete(): void {
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) => {
        if (term.length < 3) {
          this.addressSuggestions.set([]);
          this.showSuggestions.set(false);
          return of([]);
        }
        this.searchingAddress.set(true);
        return this.geoapify.autocompleteAddress(term).pipe(catchError(() => of([])));
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (suggestions: AddressSuggestion[]) => {
        this.addressSuggestions.set(suggestions);
        this.showSuggestions.set(suggestions.length > 0);
        this.searchingAddress.set(false);
      },
      error: () => {
        this.addressSuggestions.set([]);
        this.showSuggestions.set(false);
        this.searchingAddress.set(false);
      }
    });
  }

  onAddressFocus(): void {
    if (!this.hasShownLocationPrompt) {
      this.hasShownLocationPrompt = true;
      this.showLocationPrompt.set(true);
      return;
    }
    if (this.useManualAddress && this.addressSuggestions().length > 0) {
      this.showSuggestions.set(true);
    }
  }

  onAddressInput(value: string): void {
    if (!this.useManualAddress) return;
    this.addressInput.set(value);
    if (this.selectedAddress() && value !== this.selectedAddress()!.displayText) {
      this.selectedAddress.set(null);
    }
    if (value.length >= 3) {
      this.searchingAddress.set(true);
      this.showSuggestions.set(true);
      this.searchTerms.next(value);
    } else {
      this.showSuggestions.set(false);
      this.addressSuggestions.set([]);
    }
  }

  onAddressBlur(): void {
    if (!this.useManualAddress) return;
    setTimeout(() => {
      this.showSuggestions.set(false);
    }, 200);
  }

  chooseCurrentLocation(): void {
    this.useManualAddress = false;
    this.showLocationPrompt.set(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userLocation.set({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          this.addressInput.set('Mi ubicación actual');
          this.selectedAddress.set({
            id:          'current',
            formatted:   'Mi ubicación actual',
            displayText: 'Mi ubicación actual',
            context:     '',
            lat:         pos.coords.latitude,
            lon:         pos.coords.longitude,
            icon:        '📍'
          });
        },
        () => {
          // Permiso denegado o error — fallback a manual
          this.useManualAddress = true;
          this.addressInput.set('');
          this.showToast('No se pudo obtener la ubicación. Ingresa una dirección.', 'warning');
        }
      );
    } else {
      this.useManualAddress = true;
    }
  }

  chooseManualAddress(): void {
    this.useManualAddress = true;
    this.showLocationPrompt.set(false);
    this.addressInput.set('');
    this.selectedAddress.set(null);
  }

  selectAddressSuggestion(suggestion: AddressSuggestion): void {
    this.selectedAddress.set(suggestion);
    this.addressInput.set(suggestion.displayText);
    this.userLocation.set({ lat: suggestion.lat, lng: suggestion.lon });
    this.showSuggestions.set(false);
    this.addressSuggestions.set([]);
  }

  clearAddress(): void {
    this.addressInput.set('');
    this.selectedAddress.set(null);
    this.addressSuggestions.set([]);
    this.showSuggestions.set(false);
    this.useManualAddress       = false;
    this.hasShownLocationPrompt = false;
  }

  // ── Contact limit modal ──────────────────────────────────────────────────
  showContactLimitModal = signal(false);

  // ── Chat ─────────────────────────────────────────────────────────────────
  startChat(): void {
    if (!this.providerId) {
      this.showToast('Error: ID de proveedor no disponible', 'danger');
      return;
    }
    if (!this.contactLimit.canContact(this.providerId)) {
      this.showContactLimitModal.set(true);
      return;
    }
    this.isStartingChat.set(true);
    this.chatSvc.createConversation(this.providerId).subscribe({
      next: (conv) => {
        this.isStartingChat.set(false);
        this.contactLimit.recordContact(this.providerId);
        void this.router.navigate(['/client/chat', conv.id]);
      },
      error: () => {
        this.isStartingChat.set(false);
        this.showToast('No se pudo abrir el chat', 'danger');
      }
    });
  }

  /**
   * Denunciar perfil del proveedor
   * Muestra un modal para confirmar la denuncia y enviar el reporte al backend
   */
  async reportProvider(): Promise<void> {
    if (!this.providerId) {
      this.showToast('Error: no se puede denunciar este perfil', 'danger');
      return;
    }

    const confirmed = await this.modal.confirm(
      '¿Deseas denunciar este perfil?',
      'Denunciar perfil',
      'Denunciar',
      'Cancelar'
    );

    if (confirmed) {
      // TODO: Implementar llamada al backend cuando esté disponible
      // Ejemplo: this.reportService.reportProvider(this.providerId, reason).subscribe(...)
      
      // Por ahora, solo mostramos confirmación
      this.showToast('Denuncia enviada. Gracias por tu reporte.', 'success');
      console.log(`Proveedor ${this.providerId} denunciado`);
    }
  }

  /**
   * Abre el visor de imagen en pantalla completa (portfolio)
   */
  openImageViewer(imageUrl: string): void {
    // Abrir en una pestaña nueva para mantener una vista ampliada sin depender de HTML en el modal global.
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  }

  /**
   * Muestra el modal de paywall para desbloquear servicios premium
   */
  async showPremiumPaywall(): Promise<void> {
    const confirmed = await this.modal.confirm(
      'Desbloquea la posibilidad de reservar múltiples servicios del mismo proveedor.\n\nPlan Premium: $9.990/mes\nCancela cuando quieras.\n\nIncluye:\n- Reserva ilimitada de servicios\n- Soporte prioritario\n- Sin comisiones adicionales\n- Acceso anticipado a nuevas funciones',
      'Hazte Premium',
      'Suscribirme',
      'Ahora no'
    );

    if (confirmed) {
      void this.router.navigate(['/payment'], {
        queryParams: {
          plan: 'premium',
          source: 'provider-info',
          providerId: this.providerId
        }
      });
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  showToast(msg: string, type: string = 'success'): void {
    if (type === 'danger') {
      void this.modal.error(msg);
      return;
    }
    if (type === 'warning') {
      void this.modal.warning(msg);
      return;
    }
    if (type === 'success') {
      void this.modal.success(msg);
      return;
    }
    void this.modal.info(msg);
  }

  // ── Navegación ────────────────────────────────────────────────────────────
  goBack(): void {
    const filters = this.searchState.filters();
    if (filters.service_ids?.length) {
      this.router.navigate(['/client/tabs/service-search'], {
        queryParams: { service_ids: filters.service_ids.join(',') }
      });
    } else {
      this.location.back();
    }
  }
}
