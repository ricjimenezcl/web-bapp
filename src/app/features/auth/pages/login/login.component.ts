import { Component, inject, signal, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, Renderer2, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CategoryService } from '../../../../core/services/category.service';
import { MainCategory, ServiceCategory } from '../../../../core/models/provider.model';
import { Device3dLoginComponent } from '../../../../shared/components/device-3d-login/device-3d-login.component';
import { BappieChatbotComponent } from '../../../../shared/components/bappie-chatbot/bappie-chatbot.component';
import { CustomValidators } from '../../../../shared/validators/custom-validators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Device3dLoginComponent, BappieChatbotComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly renderer = inject(Renderer2);
  private readonly categorySvc = inject(CategoryService);
  private carouselInterval: ReturnType<typeof setInterval> | null = null;
  private scrollObserver?: IntersectionObserver;

  // ── ViewChild para 3D parallax ───────────────────────────────────
  @ViewChild('sceneContainer') sceneContainer?: ElementRef<HTMLElement>;
  @ViewChild('holoWrapper') holoWrapper?: ElementRef<HTMLElement>;

  // ── Signals originales ───────────────────────────────────────────
  loading   = signal(false);
  error     = signal('');
  showPass  = signal(false);

  // ── Signals landing page ─────────────────────────────────────────
  showModal      = signal(false);
  activeTab      = signal<'login' | 'register'>('login');
  mobileMenuOpen = signal(false);
  contactLoading = signal(false);
  contactSuccess = signal(false);
  showModalPass  = signal(false);
  registerRole   = signal<'client' | 'provider'>('client');
  sticky         = signal(false); // Para header sticky
  guideTab       = signal<'client' | 'provider'>('client'); // Tab para guías de uso
  
  // ── Categorías desde BD ──────────────────────────────────────────
  dbCategories   = signal<MainCategory[]>([]);
  loadingCategories = signal(false);
  
  // ── Modal de servicios 3D ────────────────────────────────────────
  showServicesModal = signal(false);
  selectedCategory = signal<MainCategory | null>(null);
  categoryServices = signal<ServiceCategory[]>([]);
  loadingServices = signal(false);

  private readonly EMOJI_MAP: Record<string, string> = {
    // Por nombre (español)
    'construcción': '🏗️', 'plomería': '🚿', 'fontanería': '🚿',
    'electricidad': '⚡', 'carpintería': '🪵', 'jardinería': '🌿',
    'limpieza': '🧹', 'mascotas': '🐾', 'reparaciones': '🔧',
    'belleza': '💇', 'salud': '💊', 'educación': '📚',
    'transporte': '🚗', 'eventos': '🎉', 'tecnología': '💻',
    'alimentos': '🍽️',
    // Por nombres de Ionic Icons (del backend)
    'hammer': '🔨', 'construct': '🏗️', 'build': '🔧',
    'water': '🚿', 'flash': '⚡', 'leaf': '🌿',
    'sparkles': '✨', 'paw': '🐾', 'cut': '✂️',
    'medkit': '💊', 'school': '📚', 'car': '🚗',
    'calendar': '📅', 'laptop': '💻', 'restaurant': '🍽️',
  };
  
  // ── Hero Carousel ────────────────────────────────────────────────
  currentSlide   = signal(0);
  totalSlides    = 3;
  carouselPaused = signal(false);

  // ── FormGroup original ───────────────────────────────────────────
  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── FormGroup registro (modal) ───────────────────────────────────
  registerForm = this.fb.group({
    name:           ['', Validators.required],
    email:          ['', [Validators.required, Validators.email]],
    phone:          ['', Validators.required],
    password:       ['', [Validators.required, Validators.minLength(8), CustomValidators.passwordComplexity()]],
    terms_accepted: [false, Validators.requiredTrue],
  });

  // ── FormGroup contacto ───────────────────────────────────────────
  contactForm = this.fb.group({
    name:    ['', Validators.required],
    email:   ['', [Validators.required, Validators.email]],
    subject: [''],
    message: ['', Validators.required],
  });

  // ── Detect scroll for sticky header ──────────────────────────────
  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.sticky.set(window.scrollY >= 80);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.normalizeStatIndex();
  }

  // ── 3D Parallax effect para smartphone mockup ────────────────────
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (window.innerWidth < 768) return;

    if (this.holoWrapper?.nativeElement) {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      
      const rotX = 40 - (y * 8);
      const rotZ = -20 + (x * 12);
      
      this.renderer.setStyle(this.holoWrapper.nativeElement, 'transform', `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`);
    }

    if (!this.sceneContainer?.nativeElement || window.innerWidth < 960) return;

    const element = this.sceneContainer.nativeElement;
    const rect = element.getBoundingClientRect();
    
    // Solo aplicar efecto si el mouse está cerca del elemento
    const isNearElement = 
      event.clientY >= rect.top - 200 && 
      event.clientY <= rect.bottom + 200;
    
    if (!isNearElement) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    const deltaX = (mouseX - centerX) / (rect.width / 2);
    const deltaY = (mouseY - centerY) / (rect.height / 2);
    
    const maxRotation = 12;
    const rotateY = deltaX * maxRotation;
    const rotateX = deltaY * -maxRotation;
    
    element.style.setProperty('--rot-x', `${rotateX}deg`);
    element.style.setProperty('--rot-y', `${rotateY}deg`);
  }

  @HostListener('document:mouseleave')
  onMouseLeave() {
    if (this.holoWrapper?.nativeElement) {
      this.renderer.setStyle(this.holoWrapper.nativeElement, 'transform', `rotateX(40deg) rotateZ(-20deg)`);
    }
  }

  // ── Lifecycle Hooks ──────────────────────────────────────────────
  ngOnInit(): void {
    this.startCarouselAutoPlay();
    this.loadCategories();
    this.startTestimonialCarousel();
    this.startStatCarousel();
    // Iniciar reveal después de que Angular termine de renderizar
    setTimeout(() => this.initScrollReveal(), 100);
  }

  ngOnDestroy(): void {
    this.stopCarouselAutoPlay();
    this.stopTestimonialCarousel();
    this.stopStatCarousel();
    this.scrollObserver?.disconnect();
    // Garantizar que el scroll-lock se libere al destruir el componente
    this.unlockBodyScroll();
  }

  private initScrollReveal(): void {
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            this.scrollObserver?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => this.scrollObserver!.observe(el));
  }

  // ── Scroll lock iOS-safe ─────────────────────────────────────────
  // `overflow:hidden` en body bloquea touchstart en iOS Safari.
  // La técnica correcta es fijar el body con position:fixed.
  private scrollY = 0;

  private lockBodyScroll(): void {
    this.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollY}px`;
    document.body.style.width = '100%';
  }

  private unlockBodyScroll(): void {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, this.scrollY);
  }

  private startCarouselAutoPlay(): void {
    this.carouselInterval = setInterval(() => {
      if (!this.carouselPaused()) {
        this.currentSlide.update(current => (current + 1) % this.totalSlides);
      }
    }, 5000);
  }

  private stopCarouselAutoPlay(): void {
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }
  }

  // ── Data estática ────────────────────────────────────────────────
  howItWorksSteps = [
    { id: 1, title: 'Busca y Filtra', description: 'Explora más de 19 categorías y encuentra profesionales cerca de ti con el mapa en tiempo real.' },
    { id: 2, title: 'Chatea', description: 'Habla directo con el proveedor, comparte fotos y acuerda todos los detalles antes de reservar.' },
    { id: 3, title: 'Agenda y Paga', description: 'Elige tu horario y paga de forma segura. Tu transacción está 100% protegida con MercadoPago.' },
    { id: 4, title: 'Califica', description: 'Al terminar, evalúa tu experiencia. Así ayudas a otros usuarios y mantienes la calidad alta.' },
  ];

  // ── Guías de uso - Formato Acordeón ──────────────────────────────
  activeAccordion = signal(0); // Panel activo en el acordeón
  
  // ── Carrusel de testimonios 3D ───────────────────────────────────
  activeTestimonial = signal(0);
  testimonialInterval: ReturnType<typeof setInterval> | null = null;
  testimonialResetting = signal(false); // fuerza reflow de barra ::before

  // ── Carrusel de estadísticas ─────────────────────────────────────
  activeStat = signal(0);
  statLoopingReset = signal(false);
  statInterval: ReturnType<typeof setInterval> | null = null;
  statsCards = [
    { value: '10k+', label: 'Usuarios Activos' },
    { value: '500+', label: 'Profesionales' },
    { value: '4.9/5', label: 'Calificación' },
    { value: '19', label: 'Categorías' },
    { value: '250+', label: 'Servicios' }
  ];
  statsLoopCards = [...this.statsCards, ...this.statsCards];

  clientGuideSteps = [
    { 
      id: '01', 
      title: 'Crea el Perfil e Ingresa', 
      description: 'Regístrate en segundos con tu email o redes sociales. Completa tu información básica y accede a la red.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#FDE68A' // cream
    },
    { 
      id: '02', 
      title: 'Selecciona la Categoría', 
      description: 'Elige entre más de 19 categorías para iniciar la búsqueda en tu zona o en el área que necesites.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930675/busqueda_art_ablhec.png',
      color: '#A7F3D0' // mint
    },
    { 
      id: '03', 
      title: 'Busca en el Mapa', 
      description: 'Visualiza la ubicación de los servicios disponibles en el mapa interactivo de tu zona exacta.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/map-art_y0mytm.png',
      color: '#38BDF8' // cyan
    },
    { 
      id: '04', 
      title: 'Revisa los Servicios', 
      description: 'Selecciona servicios por distancia o calificación. Revisa su portafolio de manera transparente.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/map-art_y0mytm.png',
      color: '#BE202E' // red
    },
    { 
      id: '05', 
      title: 'Chatea y Agenda', 
      description: 'Conversa en tiempo real, comparte fotos del trabajo y coordina tu cita directamente con el servicio.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#FDE68A' // cream
    },
    { 
      id: '06', 
      title: 'Califica y Reseña', 
      description: 'Al finalizar el trabajo, califica el servicio. Tu opinión ayuda a mantener la comunidad segura.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#A7F3D0' // mint
    }
  ];

  providerGuideSteps = [
    { 
      id: '01', 
      title: '¡Regístrate como proveedor!', 
      description: 'Crea un perfil comercial atractivo y define tus áreas de cobertura en el mapa local.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#FDE68A' // cream
    },
    { 
      id: '02', 
      title: 'Configura los Servicios', 
      description: 'Selecciona tus especialidades, sube fotos de trabajos anteriores y establece tu disponibilidad.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#38BDF8' // cyan
    },
    { 
      id: '03', 
      title: 'Aparece en el Mapa', 
      description: 'Hazte visible en el radar de los clientes que buscan servicios exactamente en tu sector.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#BE202E' // red
    },
    { 
      id: '04', 
      title: 'Recibe Solicitudes', 
      description: 'Recibe reservas directas y chatea con los clientes para afinar los detalles del servicio.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#A7F3D0' // mint
    },
    { 
      id: '05', 
      title: 'Ejecuta y Crece', 
      description: 'Realiza el trabajo, recibe calificaciones de 5 estrellas y aumenta tu reputación en la app.',
      screenImage: 'https://res.cloudinary.com/dghwotofx/image/upload/v1779930674/login_art_c2qvwr.png',
      color: '#FDE68A' // cream
    }
  ];

  featuredProviders = [
    { id: 1, name: 'Juan Pérez',    category: 'Plomería',      reviews: 128, location: 'Santiago Centro' },
    { id: 2, name: 'María Torres',  category: 'Electricidad',  reviews: 97,  location: 'Providencia' },
    { id: 3, name: 'Carlos Ruiz',   category: 'Climatización', reviews: 214, location: 'Las Condes' },
    { id: 4, name: 'Ana Soto',      category: 'Pintura',       reviews: 76,  location: 'Maipú' },
    { id: 5, name: 'Luis Mora',     category: 'Carpintería',   reviews: 143, location: 'Ñuñoa' },
    { id: 6, name: 'Sandra Vega',   category: 'Limpieza',      reviews: 189, location: 'Vitacura' },
  ];

  testimonials = [
    { id: 1, stars: 5, text: 'Publicar mis servicios aquí cambió mi agenda por completo. La visibilidad que me dio BappSearch duplicó mis reservas en menos de un mes.', author: 'Felipe Arancibia', role: 'Proveedor Destacado' },
    { id: 2, stars: 5, text: 'Tuve una urgencia eléctrica un domingo. Abrí la app, usé el mapa y tuve a un técnico calificado en mi puerta en 20 minutos. El diseño es increíble.', author: 'Carolina Valdés', role: 'Cliente Verificada' },
    { id: 3, stars: 4, text: 'La interfaz es rápida y el sistema de geolocalización es muy preciso. Publicar oficios aquí eleva el estándar por completo.', author: 'Matías R.', role: 'Contratista General' },
    { id: 4, stars: 5, text: 'Nunca fue tan fácil agendar una reparación. En 3 clics tenía confirmada mi cita. BappSearch transformó la forma en que contrato servicios.', author: 'Valentina R.', role: 'Cliente' },
  ];

  // ── Métodos originales ───────────────────────────────────────────
  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { email, password } = this.form.value;
    this.auth.login({ username: email!, password: password! }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.auth.navigateAfterLogin(res.role, res.status);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Credenciales incorrectas. Inténtalo de nuevo.');
      }
    });
  }

  submitRegister(): void {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    const { name, email, phone, password, terms_accepted } = this.registerForm.value;
    const payload = {
      email: email!, 
      password: password!, 
      full_name: name!,
      phone: phone!,
      terms_accepted: terms_accepted!
    };

    const register$ = this.registerRole() === 'provider'
      ? this.auth.registerProvider(payload)
      : this.auth.registerClient(payload);

    register$.subscribe({
      next: () => {
        this.loading.set(false);
        this.closeModal();
        // Auto-login después de registro exitoso
        this.form.patchValue({ email, password });
        this.submit();
      },
      error: (err: any) => {
        this.loading.set(false);
        const detail = err?.error?.detail;
        if (Array.isArray(detail) && detail.length > 0) {
          this.error.set(detail[0]?.msg ?? 'Error al crear la cuenta. Verifica los datos.');
          return;
        }
        this.error.set(detail ?? 'Error al crear la cuenta. Inténtalo de nuevo.');
      }
    });
  }

  get f() { return this.form.controls; }
  get rf() { return this.registerForm.controls; }

  // ── Social Login ──────────────────────────────────────────────────
  loginWithGoogle(): void {
    console.log('🔵 Login con Google iniciado');
    // TODO: Implementar autenticación con Google OAuth
    this.error.set('');
    // Aquí se implementará la integración con Google OAuth
    alert('La autenticación con Google estará disponible próximamente');
  }

  loginWithFacebook(): void {
    console.log('🔵 Login con Facebook iniciado');
    // TODO: Implementar autenticación con Facebook OAuth
    this.error.set('');
    // Aquí se implementará la integración con Facebook OAuth
    alert('La autenticación con Facebook estará disponible próximamente');
  }

  // ── Métodos landing page ─────────────────────────────────────────
  showAuthModal(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.showModal.set(true);
    this.error.set('');
    this.lockBodyScroll();
  }

  closeModal(): void {
    this.showModal.set(false);
    if (!this.showServicesModal()) {
      this.unlockBodyScroll();
    }
  }

  setTab(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.error.set('');
    if (tab === 'register') {
      this.registerRole.set('client');
    }
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  scrollToSection(sectionId: string, event?: Event, closeMobileMenu = false): void {
    event?.preventDefault();

    if (closeMobileMenu) {
      this.mobileMenuOpen.set(false);
    }

    const section = document.getElementById(sectionId);
    if (!section) return;

    const header = document.querySelector('header') as HTMLElement | null;
    const headerHeight = header?.offsetHeight ?? 96;
    const targetTop = section.getBoundingClientRect().top + window.scrollY - headerHeight - 12;

    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth'
    });
  }

  setGuideTab(tab: 'client' | 'provider'): void {
    this.guideTab.set(tab);
    this.activeAccordion.set(0); // Resetear al primer panel
  }

  activateAccordion(index: number): void {
    this.activeAccordion.set(index);
  }

  // ── Carrusel de testimonios 3D ───────────────────────────────────
  startTestimonialCarousel(): void {
    // Limpiar siempre antes de crear para evitar intervalos duplicados
    this.stopTestimonialCarousel();
    this.testimonialInterval = setInterval(() => {
      this.nextTestimonial();
    }, 5000);
  }

  stopTestimonialCarousel(): void {
    if (this.testimonialInterval) {
      clearInterval(this.testimonialInterval);
      this.testimonialInterval = null;
    }
  }

  nextTestimonial(): void {
    this.resetProgressBar();
    this.activeTestimonial.update(current =>
      (current + 1) % this.testimonials.length
    );
  }

  prevTestimonial(): void {
    this.resetProgressBar();
    this.activeTestimonial.update(current =>
      current === 0 ? this.testimonials.length - 1 : current - 1
    );
  }

  goToTestimonial(index: number): void {
    this.stopTestimonialCarousel();
    this.resetProgressBar();
    this.activeTestimonial.set(index);
    this.startTestimonialCarousel();
  }

  /** Aplica clase de reset un tick para reiniciar la transición ::before */
  private resetProgressBar(): void {
    this.testimonialResetting.set(true);
    requestAnimationFrame(() => {
      this.testimonialResetting.set(false);
    });
  }

  /** Devuelve el estado 3D de cada tarjeta según el índice activo */
  getTestimonialState(idx: number): 'active' | 'prev' | 'next' | 'hidden' {
    const active = this.activeTestimonial();
    const total  = this.testimonials.length;
    if (idx === active) return 'active';
    if (idx === (active - 1 + total) % total) return 'prev';
    if (idx === (active + 1) % total) return 'next';
    return 'hidden';
  }

  /** Devuelve array de booleanos para renderizar estrellas llenas/vacías */
  getStarsArray(stars: number): boolean[] {
    return Array.from({ length: 5 }, (_, i) => i < stars);
  }

  // ── Carrusel de estadísticas ─────────────────────────────────────
  startStatCarousel(): void {
    this.statInterval = setInterval(() => {
      this.nextStat(false);
    }, 4500);
  }

  stopStatCarousel(): void {
    if (this.statInterval) {
      clearInterval(this.statInterval);
      this.statInterval = null;
    }
  }

  nextStat(resetTimer = true): void {
    if (resetTimer) this.restartStatCarousel();
    const maxIndex = this.getStatMaxIndex();
    const current = this.activeStat();

    if (current >= maxIndex) {
      // Reinicio instantaneo del loop para evitar animacion hacia atras.
      this.statLoopingReset.set(true);
      this.activeStat.set(0);
      setTimeout(() => this.statLoopingReset.set(false), 40);
      return;
    }

    this.activeStat.set(current + 1);
  }

  prevStat(): void {
    this.restartStatCarousel();
    this.statLoopingReset.set(false);
    const maxIndex = this.getStatMaxIndex();
    this.activeStat.update(current => (current === 0 ? maxIndex : current - 1));
  }

  goToStat(index: number): void {
    this.restartStatCarousel();
    this.statLoopingReset.set(false);
    this.activeStat.set(Math.min(Math.max(index, 0), this.getStatMaxIndex()));
  }

  getStatTranslate(): string {
    const perView = this.getStatCardsPerView();
    const step = 100 / perView;
    return `translateX(-${this.activeStat() * step}%)`;
  }

  getStatPages(): number[] {
    return Array.from({ length: this.statsCards.length }, (_, index) => index);
  }

  private getStatCardsPerView(): number {
    if (globalThis.window === undefined) return 4;
    if (globalThis.window.innerWidth >= 1024) return 4;
    if (globalThis.window.innerWidth >= 768) return 2;
    return 1;
  }

  private getStatMaxIndex(): number {
    // Avanzamos por el primer bloque completo y al llegar al clon volvemos a 0
    // sin salto visible (misma composicion visual).
    return this.statsCards.length;
  }

  private normalizeStatIndex(): void {
    const maxIndex = this.getStatMaxIndex();
    if (this.activeStat() > maxIndex) {
      this.activeStat.set(maxIndex);
    }
  }

  private restartStatCarousel(): void {
    this.stopStatCarousel();
    this.startStatCarousel();
  }

  submitContact(): void {
    if (this.contactForm.invalid) { this.contactForm.markAllAsTouched(); return; }
    this.contactLoading.set(true);
    setTimeout(() => {
      this.contactLoading.set(false);
      this.contactSuccess.set(true);
      this.contactForm.reset();
      setTimeout(() => this.contactSuccess.set(false), 5000);
    }, 1200);
  }

  slideLeft(sliderId: string): void {
    const el = document.getElementById(sliderId);
    if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
  }

  slideRight(sliderId: string): void {
    const el = document.getElementById(sliderId);
    if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
  }

  // ── Hero Carousel Controls ───────────────────────────────────────
  prevSlide(): void {
    this.pauseAndResumeCarousel();
    const current = this.currentSlide();
    this.currentSlide.set(current === 0 ? this.totalSlides - 1 : current - 1);
  }

  nextSlide(): void {
    this.pauseAndResumeCarousel();
    const current = this.currentSlide();
    this.currentSlide.set((current + 1) % this.totalSlides);
  }

  goToSlide(index: number): void {
    this.pauseAndResumeCarousel();
    this.currentSlide.set(index);
  }

  private pauseAndResumeCarousel(): void {
    this.carouselPaused.set(true);
    // Reiniciar autoplay después de 8 segundos de inactividad
    setTimeout(() => this.carouselPaused.set(false), 8000);
  }

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Cargar categorías desde BD ───────────────────────────────────
  private loadCategories(): void {
    this.loadingCategories.set(true);
    this.categorySvc.getMainCategories().subscribe({
      next: (categories) => {
        console.log('✅ Categorías cargadas en landing:', categories.length);
        this.dbCategories.set(categories);
        this.loadingCategories.set(false);
        // Re-observar elementos reveal que se renderizaron tras la carga async
        setTimeout(() => {
          document.querySelectorAll('.reveal:not(.revealed)').forEach(el => {
            this.scrollObserver?.observe(el);
          });
        }, 50);
      },
      error: (err) => {
        console.error('❌ Error cargando categorías:', err);
        this.loadingCategories.set(false);
      }
    });
  }

  // ── Verificar si es URL de imagen ───────────────────────────────
  isImageUrl(icon: string | undefined): boolean {
    if (!icon) return false;
    const lowerIcon = icon.toLowerCase();
    return icon.startsWith('http://') || 
           icon.startsWith('https://') || 
           icon.startsWith('/') ||
           lowerIcon.endsWith('.png') ||
           lowerIcon.endsWith('.jpg') ||
           lowerIcon.endsWith('.jpeg') ||
           lowerIcon.endsWith('.svg') ||
           lowerIcon.endsWith('.webp');
  }

  // ── Obtener Emoji decorativo ─────────────────────────────────────
  getCategoryEmoji(name: string, icon: string | undefined): string {
    const lowerName = name.toLowerCase();
    const lowerIcon = icon ? icon.toLowerCase() : '';
    
    // Buscar por nombre o identificador de icono
    for (const [key, emoji] of Object.entries(this.EMOJI_MAP)) {
      if (lowerName.includes(key) || lowerIcon.includes(key)) {
        return emoji;
      }
    }

    // Fallbacks específicos por palabras clave si no hay match exacto
    if (lowerName.includes('pint') || lowerIcon.includes('brush')) return '🖌️';
    if (lowerName.includes('clima') || lowerIcon.includes('thermometer')) return '🌡️';
    if (lowerName.includes('gas') || lowerIcon.includes('restaurant')) return '🍳';
    if (lowerName.includes('muda') || lowerIcon.includes('bus')) return '📦';
    
    return '🛠️'; // Default Final
  }
  // ── Abrir modal de servicios ─────────────────────────────────────
  openServicesModal(category: MainCategory): void {
    console.log('🔍 Abriendo modal para categoría:', category.name, 'ID:', category.id);
    this.selectedCategory.set(category);
    this.showServicesModal.set(true);
    this.loadingServices.set(true);
    this.lockBodyScroll();
    
    // Cargar servicios usando el mismo método que categories.component
    this.categorySvc.getCategoryWithServices(category.id).subscribe({
      next: (categoryWithServices: MainCategory) => {
        console.log('✅ Categoría con servicios cargada:', categoryWithServices.services?.length || 0);
        this.categoryServices.set(categoryWithServices.services || []);
        this.loadingServices.set(false);
      },
      error: (err: any) => {
        console.log('⚠️ getCategoryWithServices falló, intentando con getServices...');
        // Fallback: usar getServices con category_id
        this.categorySvc.getServices({ category_id: category.id }).subscribe({
          next: (services: ServiceCategory[]) => {
            console.log('✅ Servicios cargados (fallback):', services.length);
            this.categoryServices.set(services);
            this.loadingServices.set(false);
          },
          error: (err2: any) => {
            console.error('❌ Error cargando servicios:', err2);
            this.categoryServices.set([]);
            this.loadingServices.set(false);
          }
        });
      }
    });
  }

  // ── Cerrar modal de servicios ────────────────────────────────────
  closeServicesModal(): void {
    this.showServicesModal.set(false);
    this.selectedCategory.set(null);
    this.categoryServices.set([]);
    if (!this.showModal()) {
      this.unlockBodyScroll();
    }
  }

  // ── Seleccionar servicio y abrir modal de registro ───────────────
  selectService(service: ServiceCategory): void {
    console.log('🎯 Servicio seleccionado:', service.name);
    this.closeServicesModal();
    this.showAuthModal('register');
  }}
