import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb   = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private carouselInterval: ReturnType<typeof setInterval> | null = null;

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
    name:     ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── FormGroup contacto ───────────────────────────────────────────
  contactForm = this.fb.group({
    name:    ['', Validators.required],
    email:   ['', [Validators.required, Validators.email]],
    subject: [''],
    message: ['', Validators.required],
  });

  // ── Lifecycle Hooks ──────────────────────────────────────────────
  ngOnInit(): void {
    this.startCarouselAutoPlay();
  }

  ngOnDestroy(): void {
    this.stopCarouselAutoPlay();
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

  // ── Data estática sliders ────────────────────────────────────────
  featuredProviders = [
    { id: 1, name: 'Juan Pérez',    category: 'Plomería',      reviews: 128, location: 'Santiago Centro' },
    { id: 2, name: 'María Torres',  category: 'Electricidad',  reviews: 97,  location: 'Providencia' },
    { id: 3, name: 'Carlos Ruiz',   category: 'Climatización', reviews: 214, location: 'Las Condes' },
    { id: 4, name: 'Ana Soto',      category: 'Pintura',       reviews: 76,  location: 'Maipú' },
    { id: 5, name: 'Luis Mora',     category: 'Carpintería',   reviews: 143, location: 'Ñuñoa' },
    { id: 6, name: 'Sandra Vega',   category: 'Limpieza',      reviews: 189, location: 'Vitacura' },
  ];

  testimonials = [
    { id: 1, text: 'Encontré un electricista en minutos. El servicio fue impecable y muy profesional. Totalmente recomendado.', author: 'Valentina R.', role: 'Cliente' },
    { id: 2, text: 'Como proveedor, BappSearch me ha dado visibilidad increíble. Mis reservas aumentaron un 60% en el primer mes.', author: 'Felipe A.', role: 'Proveedor de Plomería' },
    { id: 3, text: 'La geolocalización es maravillosa. Puedo ver quién está disponible en mi sector en tiempo real. Genial.', author: 'Claudia M.', role: 'Cliente' },
    { id: 4, text: 'Nunca fue tan fácil agendar una reparación. En 3 clics tenía confirmada mi cita. Excelente plataforma.', author: 'Roberto P.', role: 'Cliente' },
  ];

  serviceCategories = [
    { id: 1,  name: 'Plomería',       svgPath: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
    { id: 2,  name: 'Electricidad',   svgPath: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 3,  name: 'Pintura',        svgPath: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    { id: 4,  name: 'Carpintería',    svgPath: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    { id: 5,  name: 'Climatización',  svgPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    { id: 6,  name: 'Limpieza',       svgPath: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
    { id: 7,  name: 'Cerrajería',     svgPath: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    { id: 8,  name: 'Mudanzas',       svgPath: 'M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
    { id: 9,  name: 'Jardinería',     svgPath: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 10, name: 'Gasfitería',     svgPath: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 11, name: 'Belleza',        svgPath: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 12, name: 'Tecnología',     svgPath: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
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
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Credenciales incorrectas. Inténtalo de nuevo.');
      }
    });
  }

  get f() { return this.form.controls; }
  get rf() { return this.registerForm.controls; }

  // ── Métodos landing page ─────────────────────────────────────────
  showAuthModal(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.showModal.set(true);
    this.error.set('');
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.showModal.set(false);
    document.body.style.overflow = '';
  }

  setTab(tab: 'login' | 'register'): void {
    this.activeTab.set(tab);
    this.error.set('');
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
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
}
