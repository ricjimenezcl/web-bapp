import { Component, OnInit, OnDestroy, signal, PLATFORM_ID, Inject, inject, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { SocialAuthService, GoogleLoginProvider, FacebookLoginProvider } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';
import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import { MainCategory, ServiceCategory } from '../../core/models/provider.model';
import { ContentFilterService } from '../../shared/services/content-filter.service';
import { CustomValidators } from '../../shared/validators/custom-validators';
import { offensiveContentAsyncValidator } from '../../shared/validators/content-filter.validators';
import { formatChileanPhone, formatChileanRUT, normalizeChileanRUTForBackend } from '../../shared/utils/form-formatters';

interface Category {
  name: string;
  icon: string;
}

interface Testimonial {
  name: string;
  role: string;
  text: string;
  location: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Step {
  number: string;
  title: string;
  desc: string;
}

interface Benefit {
  icon: string;
  title: string;
  desc: string;
}

interface Pill {
  label: string;
}

interface MapPin {
  x: number;
  y: number;
  icon: string;
  active: boolean;
}

interface ComparisonRow {
  label: string;
  bapp: boolean;
  others: boolean;
}

@Component({
  selector: 'app-provider-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './provider-landing.component.html',
  styleUrls: ['./provider-landing.component.scss'],
})
export class ProviderLandingComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly socialAuth = inject(SocialAuthService);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly ngZone = inject(NgZone);

  scrolled = signal(false);
  activeFaqIndex = signal<number | null>(null);
  heroSlide = signal(0);
  loadingCategories = signal(false);
  loadingRegister = signal(false);
  errorRegister = signal('');
  successRegister = signal('');
  showRegisterModal = signal(false);
  facebookEmailPromptOpen = signal(false);
  facebookEmailPromptValue = signal('');
  facebookEmailPromptError = signal('');
  showModalPass = signal(false);
  showModalConfirmPass = signal(false);
  dbCategories = signal<MainCategory[]>([]);
  showServicesModal = signal(false);
  selectedCategory = signal<MainCategory | null>(null);
  categoryServices = signal<ServiceCategory[]>([]);
  loadingServices = signal(false);

  registerForm = this.fb.group({
    name: ['', {
      validators: [Validators.required],
      asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'profile')],
      updateOn: 'change',
    }],
    email: ['', [Validators.required, Validators.email]],
    run: ['', Validators.required],
    phone: ['', [Validators.required, CustomValidators.phone()]],
    password: ['', [Validators.required, Validators.minLength(8), CustomValidators.passwordComplexity()]],
    confirmPassword: ['', Validators.required],
    terms_accepted: [false, Validators.requiredTrue],
  }, {
    validators: (ctrl: AbstractControl): ValidationErrors | null => {
      const p = ctrl.get('password');
      const c = ctrl.get('confirmPassword');
      const r = ctrl.get('run');
      const errors: ValidationErrors = {};

      if (p?.value && c?.value && p.value !== c.value) {
        errors['passwordMismatch'] = true;
      }

      const rutInvalid = r?.value ? CustomValidators.rut()(r) : { rutRequired: true };
      if (rutInvalid) {
        Object.assign(errors, rutInvalid);
      }

      return Object.keys(errors).length ? errors : null;
    },
  });

  private readonly emojiMap: Record<string, string> = {
    'construccion': '🏗️', 'plomeria': '🚿', 'fontaneria': '🚿',
    'electricidad': '⚡', 'carpinteria': '🪵', 'jardineria': '🌿',
    'limpieza': '🧹', 'mascotas': '🐾', 'reparaciones': '🔧',
    'belleza': '💇', 'salud': '💊', 'educacion': '📚',
    'transporte': '🚗', 'eventos': '🎉', 'tecnologia': '💻',
    'alimentos': '🍽️', 'cuidado': '🤝',
    'hammer': '🔨', 'construct': '🏗️', 'build': '🔧',
    'water': '🚿', 'flash': '⚡', 'leaf': '🌿',
    'sparkles': '✨', 'paw': '🐾', 'cut': '✂️',
    'medkit': '💊', 'school': '📚', 'car': '🚗',
    'calendar': '📅', 'laptop': '💻', 'restaurant': '🍽️',
  };

  readonly heroPills: Pill[] = [
    { label: 'Registro gratuito' },
    { label: '2 servicios gratis' },
    { label: 'Sin comisiones' },
    { label: 'Clientes cercanos' },
    { label: 'Perfil verificado' },
  ];

  readonly mapPins: MapPin[] = [
    { x: 30, y: 35, icon: '🔧', active: false },
    { x: 50, y: 47, icon: '💄', active: true },
    { x: 70, y: 30, icon: '📚', active: false },
    { x: 22, y: 65, icon: '🚗', active: false },
    { x: 75, y: 62, icon: '🏠', active: false },
    { x: 55, y: 72, icon: '✂️', active: false },
  ];

  readonly categories: Category[] = [
    { name: 'Belleza y Cuidado Personal', icon: '💄' },
    { name: 'Clases y Tutorías', icon: '📚' },
    { name: 'Comida Rápida y Pastelería', icon: '🍰' },
    { name: 'Construcción y Hogar', icon: '🔨' },
    { name: 'Costura y Confección', icon: '🧵' },
    { name: 'Cuidado de Adultos Mayores', icon: '🤝' },
    { name: 'Cuidado de Mascotas', icon: '🐾' },
    { name: 'Cuidado de Niños', icon: '👶' },
    { name: 'Deporte y Recreación', icon: '⚽' },
    { name: 'Entretenimiento y Eventos', icon: '🎉' },
    { name: 'Esoterismo y Espiritualidad', icon: '🔮' },
    { name: 'Joyería y Artesanías', icon: '💍' },
    { name: 'Mecánica Automotriz', icon: '🚗' },
    { name: 'Reparación de Celulares', icon: '📱' },
    { name: 'Reparaciones Generales', icon: '🔧' },
    { name: 'Salud a Domicilio', icon: '🏥' },
    { name: 'Servicios del Hogar', icon: '🏠' },
    { name: 'Tatuajes y Piercings', icon: '🎨' },
    { name: 'Traslados y Mudanzas', icon: '🚚' },
  ];

  readonly benefits: Benefit[] = [
    { icon: '🎁', title: '2 servicios gratis para siempre', desc: 'Publica tus primeros 2 servicios sin pagar nada, sin fecha de vencimiento.' },
    { icon: '💰', title: '0% de comisión', desc: 'Conserva el 100% de tus ganancias. No nos quedamos con nada de lo que cobras.' },
    { icon: '📍', title: 'Clientes cerca de ti', desc: 'Aparece en el mapa de tu zona y recibe solicitudes de personas en tu área.' },
    { icon: '✅', title: 'Perfil profesional verificado', desc: 'Genera confianza con un sello de verificación que aumenta tus conversiones.' },
    { icon: '📅', title: 'Gestión de agenda automática', desc: 'Recibe reservas y organiza tu calendario directamente desde la plataforma.' },
    { icon: '📈', title: 'Escala cuando quieras', desc: 'Empieza gratis y agrega más servicios cuando estés listo para crecer.' },
  ];

  readonly steps: Step[] = [
    { number: '01', title: 'Te registras gratis', desc: 'Crea tu cuenta en minutos con tu email y datos básicos.' },
    { number: '02', title: 'Publicas tus servicios', desc: 'Describe lo que haces, define tu precio y área de cobertura.' },
    { number: '03', title: 'Verificas tu identidad', desc: 'Sube tu cédula y obtén el sello de proveedor verificado.' },
    { number: '04', title: 'Recibes solicitudes', desc: 'Clientes de tu zona te encuentran y envían solicitudes directamente.' },
    { number: '05', title: 'Realizas el trabajo', desc: 'Confirma, coordina y lleva a cabo el servicio acordado con el cliente.' },
    { number: '06', title: 'Cobras directamente', desc: 'Todo el pago es tuyo. Sin comisiones, sin intermediarios.' },
  ];

  readonly testimonials: Testimonial[] = [
    {
      name: 'Carlos M.',
      role: 'Electricista',
      text: 'Antes dependía 100% del boca a boca. Con BApp Search, clientes de mi zona me encuentran solos. Publiqué en 10 minutos y la primera semana ya tenía 3 solicitudes nuevas.',
      location: 'Santiago Centro',
    },
    {
      name: 'Valeria R.',
      role: 'Peluquera a domicilio',
      text: 'Lo que más me gustó es que no cobran comisión. Todo lo que gano es mío. Los 2 servicios gratis me alcanzaron perfecto para empezar sin arriesgar nada.',
      location: 'Providencia',
    },
    {
      name: 'Miguel A.',
      role: 'Profesor de Matemáticas',
      text: 'Tengo alumnos nuevos cada mes sin pagar publicidad. La geolocalización es clave: los estudiantes me buscan por zona y me contactan directo a mí.',
      location: 'Las Condes',
    },
    {
      name: 'Patricia L.',
      role: 'Cuidadora de Adultos Mayores',
      text: 'El perfil verificado me da credibilidad. Las familias confían más cuando ven que estoy verificada. Fue lo que me diferenció de la competencia.',
      location: 'Ñuñoa',
    },
  ];

  readonly comparisonRows: ComparisonRow[] = [
    { label: 'Registro gratuito', bapp: true, others: false },
    { label: '2 servicios gratis para siempre', bapp: true, others: false },
    { label: 'Sin comisión por trabajo realizado', bapp: true, others: false },
    { label: 'Geolocalización de clientes', bapp: true, others: false },
    { label: 'Perfil profesional verificado', bapp: true, others: true },
    { label: 'Reservas online automáticas', bapp: true, others: false },
    { label: 'Gestión de agenda', bapp: true, others: false },
  ];

  readonly faqs: FaqItem[] = [
    {
      question: '¿Es realmente gratis registrarse?',
      answer: 'Sí, el registro es 100% gratuito. Además, puedes publicar hasta 2 servicios gratis para siempre, sin fecha de vencimiento ni cobros ocultos.',
    },
    {
      question: '¿Cobran comisión por cada trabajo que realizo?',
      answer: 'No. Cero comisión. Todo el dinero que acuerdas con tus clientes es tuyo. Nosotros no nos quedamos con ningún porcentaje de tus ingresos.',
    },
    {
      question: '¿Cómo me encuentran los clientes?',
      answer: 'Los clientes buscan servicios usando geolocalización. Tu perfil aparece en el mapa de tu área, por lo que recibes solicitudes de personas que realmente están cerca y pueden contratarte.',
    },
    {
      question: '¿Qué es la verificación de identidad?',
      answer: 'Es un proceso simple donde subes tu cédula de identidad para que los clientes confíen en que eres una persona real. Además, aumenta tu posición en los resultados de búsqueda.',
    },
    {
      question: '¿Puedo publicar más de 2 servicios?',
      answer: 'Los primeros 2 servicios son gratis para siempre. Si quieres escalar y publicar más, puedes hacerlo con nuestro plan premium a un costo muy accesible.',
    },
    {
      question: '¿Cómo cobro por mis servicios?',
      answer: 'Cobras directamente al cliente, como siempre lo has hecho. Puedes acordar el método de pago que prefieras: efectivo, transferencia o cualquier otro.',
    },
  ];

  readonly stars = [1, 2, 3, 4, 5];

  private scrollListener!: () => void;
  private socialAuthSub?: Subscription;
  private heroSlideInterval?: ReturnType<typeof setInterval>;
  private pendingFacebookAccessToken: string | null = null;
  /** Evita que authState llame al backend si el usuario no ha iniciado explícitamente el flujo de Google */
  private googleSignInInitiated = false;
  /** Contenedor del botón Google pre-renderizado para click programático dentro del user-gesture */
  private gBtnHolder: HTMLElement | null = null;
  /** Elemento clickable dentro del contenedor (role="button" o similar, detectado tras renderizado) */
  private gBtnClickEl: HTMLElement | null = null;

  constructor(
    private readonly meta: Meta,
    private readonly title: Title,
    private readonly router: Router,
    private readonly categorySvc: CategoryService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Proveedores de Servicios en Chile | Regístrate Gratis en BApp Search');
    this.meta.updateTag({ name: 'description', content: 'Consigue clientes cerca de ti. Publica hasta 2 servicios gratis para siempre. Sin comisiones y con perfil verificado.' });
    this.meta.updateTag({ property: 'og:title', content: 'Proveedores de Servicios en Chile | Regístrate Gratis en BApp Search' });
    this.meta.updateTag({ property: 'og:description', content: 'Consigue clientes cerca de ti. Publica hasta 2 servicios gratis para siempre. Sin comisiones y con perfil verificado.' });
    this.loadCategories();

    if (isPlatformBrowser(this.platformId)) {
      this.scrollListener = () => this.scrolled.set(window.scrollY > 20);
      window.addEventListener('scroll', this.scrollListener, { passive: true });
      this.heroSlideInterval = setInterval(() => {
        this.heroSlide.update(s => (s + 1) % 2);
      }, 4000);
    }

    this.socialAuthSub = this.socialAuth.authState.subscribe((socialUser) => {
      if (!socialUser) return;
      if (socialUser.provider !== GoogleLoginProvider.PROVIDER_ID) return;
      if (!this.googleSignInInitiated) return;
      this.ngZone.run(() => {
        this.googleSignInInitiated = false;
        this.loadingRegister.set(true);
        this.auth.loginWithGoogle(socialUser.idToken, 'PROVIDER').subscribe({
          next: (res) => {
            this.loadingRegister.set(false);
            this.handleSocialLoginSuccess(res);
          },
          error: (err) => {
            this.loadingRegister.set(false);
            this.errorRegister.set(err.error?.detail || 'Error en autenticación con Google');
          },
        });
      });
    });

    // Pre-renderizar botón Google sin depender de initState (que bloquea si Facebook SDK falla).
    this.tryRenderGoogleButton();
  }

  /** Sondea la disponibilidad del SDK de GIS y pre-renderiza el botón oculto. */
  private tryRenderGoogleButton(attempt = 0): void {
    if (this.gBtnClickEl) return;
    const gsi = (window as any).google?.accounts?.id;
    if (gsi) {
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:50px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden';
      document.body.appendChild(container);
      gsi.renderButton(container, { type: 'standard', size: 'large', width: 200 });
      this.gBtnHolder = container;
      setTimeout(() => {
        this.gBtnClickEl = container.querySelector<HTMLElement>('[role="button"], button, [tabindex]')
          ?? container;
      }, 300);
    } else if (attempt < 20) {
      setTimeout(() => this.tryRenderGoogleButton(attempt + 1), 500);
    }
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="description"');
    this.meta.removeTag('property="og:title"');
    this.meta.removeTag('property="og:description"');

    if (isPlatformBrowser(this.platformId) && this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }

    if (this.heroSlideInterval) {
      clearInterval(this.heroSlideInterval);
    }

    this.socialAuthSub?.unsubscribe();
    this.gBtnHolder?.remove();
  }

  toggleFaq(index: number): void {
    this.activeFaqIndex.set(this.activeFaqIndex() === index ? null : index);
  }

  setHeroSlide(index: number): void {
    this.heroSlide.set(index);
    if (this.heroSlideInterval) {
      clearInterval(this.heroSlideInterval);
    }
    if (isPlatformBrowser(this.platformId)) {
      this.heroSlideInterval = setInterval(() => {
        this.heroSlide.update(s => (s + 1) % 2);
      }, 4000);
    }
  }

  private loadCategories(): void {
    this.loadingCategories.set(true);
    this.categorySvc.getMainCategories().subscribe({
      next: (categories) => {
        this.dbCategories.set(categories);
        this.loadingCategories.set(false);
      },
      error: () => {
        this.dbCategories.set([]);
        this.loadingCategories.set(false);
      },
    });
  }

  openServicesModal(category: MainCategory): void {
    this.selectedCategory.set(category);
    this.showServicesModal.set(true);
    this.loadingServices.set(true);

    this.categorySvc.getCategoryWithServices(category.id).subscribe({
      next: (categoryWithServices: MainCategory) => {
        this.categoryServices.set(categoryWithServices.services || []);
        this.loadingServices.set(false);
      },
      error: () => {
        this.categorySvc.getServices({ category_id: category.id }).subscribe({
          next: (services: ServiceCategory[]) => {
            this.categoryServices.set(services);
            this.loadingServices.set(false);
          },
          error: () => {
            this.categoryServices.set([]);
            this.loadingServices.set(false);
          },
        });
      },
    });
  }

  closeServicesModal(): void {
    this.showServicesModal.set(false);
    this.selectedCategory.set(null);
    this.categoryServices.set([]);
  }

  selectService(_service: ServiceCategory): void {
    this.closeServicesModal();
    this.openRegisterModal();
  }

  openRegisterModal(): void {
    this.showRegisterModal.set(true);
    this.errorRegister.set('');
    this.successRegister.set('');
  }

  closeRegisterModal(): void {
    this.showRegisterModal.set(false);
    this.closeFacebookEmailPrompt();
    this.errorRegister.set('');
    this.successRegister.set('');
  }

  submitRegister(): void {
    if (this.registerForm.pending) {
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loadingRegister.set(true);
    this.errorRegister.set('');
    this.successRegister.set('');

    const { name, email, phone, run, password, terms_accepted } = this.registerForm.value;
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const normalizedRun = normalizeChileanRUTForBackend(run ?? '');
    const payload = {
      email: normalizedEmail,
      password: password!,
      full_name: (name ?? '').trim(),
      phone: (phone ?? '').trim(),
      run: normalizedRun || undefined,
      terms_accepted: terms_accepted!,
    };

    this.auth.registerProvider(payload).subscribe({
      next: () => {
        this.loadingRegister.set(false);
        this.successRegister.set('Cuenta creada con éxito. Iniciaremos sesión para continuar.');
        let settled = false;
        const fallbackToLogin = () => {
          if (settled) return;
          settled = true;
          this.closeRegisterModal();
          this.router.navigate(['/auth/login'], { queryParams: { tab: 'login' } });
        };

        const timeoutId = setTimeout(() => {
          fallbackToLogin();
        }, 10_000);

        this.auth.login({ username: normalizedEmail, password: password!, role: 'PROVIDER' }).subscribe({
          next: (res) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            this.closeRegisterModal();
            this.auth.navigateAfterLogin(res.role, res.status);
          },
          error: () => {
            clearTimeout(timeoutId);
            fallbackToLogin();
          },
        });
      },
      error: (err: any) => {
        this.loadingRegister.set(false);
        this.errorRegister.set(this.getApiErrorMessage(err, 'Error al crear la cuenta. Inténtalo de nuevo.'));
      },
    });
  }

  loginWithGoogle(): void {
    this.loadingRegister.set(true);
    this.errorRegister.set('');
    this.googleSignInInitiated = true;

    // Hacer click en el botón Google pre-renderizado dentro del contexto de gesture del usuario.
    // use_fedcm_for_prompt:false impide que prompt() funcione, renderButton()+click sí abre el popup.
    const btn = this.gBtnClickEl ?? this.gBtnHolder;
    if (btn) {
      btn.click();
    } else {
      this.googleSignInInitiated = false;
      this.loadingRegister.set(false);
      this.tryRenderGoogleButton();
      this.errorRegister.set('Google Sign-In aún no está listo. Espera un momento e intenta de nuevo.');
    }
  }

  loginWithFacebook(): void {
    this.loadingRegister.set(true);
    this.errorRegister.set('');

    this.socialAuth.signIn(FacebookLoginProvider.PROVIDER_ID, {
      scope: 'public_profile,email',
      return_scopes: true,
      auth_type: 'rerequest',
    } as any)
      .then((user) => {
        const accessToken = String((user as any)?.authToken ?? (user as any)?.response?.accessToken ?? '').trim();
        const emailHint = String((user as any)?.email ?? (user as any)?.response?.email ?? '').trim().toLowerCase();

        if (!accessToken) {
          const missingTokenError = new Error('missing_facebook_access_token');
          (missingTokenError as any).error = 'missing_facebook_access_token';
          (missingTokenError as any).details = user;
          throw missingTokenError;
        }

        this.auth.loginWithFacebook(accessToken, 'PROVIDER', emailHint || undefined).subscribe({
          next: (res) => {
            this.loadingRegister.set(false);
            this.handleSocialLoginSuccess(res);
          },
          error: (err) => {
            if (this.isFacebookMissingEmailError(err)) {
              this.loadingRegister.set(false);
              this.openFacebookEmailPrompt(accessToken);
              return;
            }

            this.loadingRegister.set(false);
            this.errorRegister.set(err.error?.detail || 'Error en autenticación con Facebook');
          },
        });
      })
      .catch((err) => {
        this.loadingRegister.set(false);
        const mappedError = this.mapFacebookAuthError(err);
        if (mappedError) {
          this.errorRegister.set(mappedError);
        }
      });
  }

  private isFacebookMissingEmailError(err: any): boolean {
    const detail = String(err?.error?.detail ?? err?.message ?? '').toLowerCase();
    return detail.includes('facebook') && detail.includes('email') && detail.includes('no proporcion');
  }

  openFacebookEmailPrompt(accessToken: string): void {
    this.pendingFacebookAccessToken = accessToken;
    this.facebookEmailPromptValue.set('');
    this.facebookEmailPromptError.set('');
    this.facebookEmailPromptOpen.set(true);
  }

  closeFacebookEmailPrompt(): void {
    this.facebookEmailPromptOpen.set(false);
    this.facebookEmailPromptValue.set('');
    this.facebookEmailPromptError.set('');
    this.pendingFacebookAccessToken = null;
  }

  onFacebookEmailPromptInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.facebookEmailPromptValue.set((input.value ?? '').trim().toLowerCase());
    if (this.facebookEmailPromptError()) {
      this.facebookEmailPromptError.set('');
    }
  }

  submitFacebookEmailPrompt(): void {
    const accessToken = this.pendingFacebookAccessToken;
    if (!accessToken) {
      this.closeFacebookEmailPrompt();
      return;
    }

    const manualEmail = this.facebookEmailPromptValue().trim().toLowerCase();
    if (!this.isBasicValidEmail(manualEmail)) {
      this.facebookEmailPromptError.set('Ingresa un correo válido para continuar.');
      return;
    }

    this.loadingRegister.set(true);
    this.facebookEmailPromptError.set('');

    this.auth.loginWithFacebook(accessToken, 'PROVIDER', manualEmail).subscribe({
      next: (res) => {
        this.loadingRegister.set(false);
        this.closeFacebookEmailPrompt();
        this.handleSocialLoginSuccess(res);
      },
      error: (fallbackErr) => {
        this.loadingRegister.set(false);
        this.facebookEmailPromptError.set(fallbackErr?.error?.detail || 'No fue posible completar el registro con Facebook');
      },
    });
  }

  private isBasicValidEmail(email: string): boolean {
    if (!email || email.includes(' ')) return false;
    const at = email.indexOf('@');
    const dot = email.lastIndexOf('.');
    return at > 0 && dot > at + 1 && dot < email.length - 1;
  }

  private handleSocialLoginSuccess(res: any): void {
    const isNewUser = res.is_new_user === true;

    if (!isNewUser && res.role === 'CLIENT') {
      this.errorRegister.set('Este correo ya está registrado como Cliente. Para registrarte como proveedor, usa otro correo o contacta soporte.');
      this.auth.logout();
      return;
    }

    if (!isNewUser) {
      this.successRegister.set('Ya tienes cuenta de proveedor. Iniciamos sesión por ti.');
    }

    this.closeRegisterModal();
    this.auth.navigateAfterLogin(res.role, res.status);
  }

  onRegisterPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanPhone(input.value);
    input.value = formatted;
    this.registerForm.get('phone')?.setValue(formatted, { emitEvent: false });
  }

  onRegisterRUTInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const formatted = formatChileanRUT(input.value);
    input.value = formatted;
    this.registerForm.get('run')?.setValue(formatted, { emitEvent: false });
  }

  onRegisterRUTKeydown(event: KeyboardEvent): void {
    if (event.key === '.' || event.key === ' ') {
      event.preventDefault();
    }
  }

  get rf() {
    return this.registerForm.controls;
  }

  get registerPasswordMismatch(): boolean {
    return !!(this.registerForm.errors?.['passwordMismatch'] && this.registerForm.get('confirmPassword')?.touched);
  }

  getRegisterPhoneError(): string {
    const control = this.rf['phone'];
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'El teléfono es requerido';
    if (control.errors['invalidPhone']) return 'Ingresa un teléfono chileno válido. Ej: +56 9 1234 5678';
    return 'Teléfono inválido';
  }

  getRegisterRUTError(): string {
    const control = this.rf['run'];
    const formErrors = this.registerForm.errors;
    if (!control.touched && !formErrors) return '';
    if (formErrors?.['rutRequired'] && control.touched) return 'El RUT es obligatorio para proveedores';
    if (formErrors?.['invalidRut'] && control.value) return 'El RUT ingresado no es válido';
    return '';
  }

  getRegisterPasswordError(): string {
    const control = this.rf['password'];
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'La contraseña es requerida';
    if (control.errors['minlength']) return 'La contraseña debe tener al menos 8 caracteres';
    if (control.errors['missingUppercase']) return 'La contraseña debe contener al menos una mayúscula';
    if (control.errors['missingLowercase']) return 'La contraseña debe contener al menos una minúscula';
    if (control.errors['missingNumber']) return 'La contraseña debe contener al menos un número';
    return 'Contraseña inválida';
  }

  private getApiErrorMessage(err: any, fallback: string): string {
    if (err?.status === 429) {
      return 'Demasiados intentos fallidos. Por favor espera antes de volver a intentarlo.';
    }
    const response = err?.error;
    const detail = response?.detail;

    if (typeof detail === 'string' && detail.trim()) {
      if (detail === 'Email already registered') return 'Este correo ya se encuentra registrado';
      if (detail === 'RUN already registered') return 'Este RUT ya se encuentra registrado';
      if (detail === 'Phone already registered') return 'Este teléfono ya se encuentra registrado';
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      return detail[0]?.msg ?? fallback;
    }

    return fallback;
  }

  private mapGoogleAuthError(err: any): string | null {
    // GIS PromptMomentNotification: objeto con métodos isDismissedMoment/isDisplayMoment
    if (typeof err?.isDismissedMoment === 'function' || typeof err?.isDisplayMoment === 'function') {
      const reason = typeof err.getDismissedReason === 'function' ? String(err.getDismissedReason() ?? '') : '';
      const skippedReason = typeof err.getSkippedReason === 'function' ? String(err.getSkippedReason() ?? '') : '';
      if (reason === 'credential_returned' || reason === 'cancel_called') return null;
      if (skippedReason || reason === 'tap_outside' || reason === 'user_cancel') return null;
      return 'Google no pudo mostrar el diálogo de inicio de sesión. Intenta en modo normal del navegador o permite ventanas emergentes.';
    }

    const code = String(err?.error ?? err?.type ?? '').toLowerCase();
    const details = String(err?.details ?? err?.message ?? '').toLowerCase();

    // Cancelación / supresión silenciosa — no mostrar error al usuario
    if (
      code.includes('popup_closed_by_user') ||
      code === 'popup_closed' ||
      code === 'access_denied' ||
      code === 'cancelled' ||
      code === 'user_cancel' ||
      code === 'not_displayed' ||
      code === 'skipped' ||
      code === 'dismissed' ||
      code === 'opt_out_or_no_session' ||
      code === 'suppressed_by_user' ||
      details.includes('opt_out_or_no_session') ||
      details.includes('suppressed_by_user')
    ) return null;

    if (code.includes('popup_blocked_by_browser') || code === 'popup_blocked') {
      return 'Tu navegador bloqueó la ventana emergente de Google. Permite popups para continuar.';
    }

    if (
      code.includes('idpiframe_initialization_failed') ||
      code === 'unregistered_origin' ||
      details.includes('not a valid origin for the client') ||
      details.includes('origin_mismatch') ||
      details.includes('invalid origin') ||
      details.includes('unregistered_origin')
    ) {
      return 'Google Sign-In no está autorizado para este dominio. Verifica los Authorized JavaScript origins del Client ID.';
    }

    if (details.includes('invalid_client') || details.includes('client_id')) {
      return 'La configuración de Google Client ID no es válida para este entorno.';
    }

    console.error('[Google Auth] Error no mapeado:', JSON.stringify({ code, details, raw: err }, null, 2));
    return 'No se pudo completar el inicio de sesión con Google';
  }

  private mapFacebookAuthError(err: any): string | null {
    const code = String(err?.error ?? err?.type ?? '').toLowerCase();
    const details = String(err?.details ?? err?.message ?? '').toLowerCase();

    if (code.includes('popup_closed_by_user')) return null;

    if (code.includes('popup_blocked_by_browser')) {
      return 'Tu navegador bloqueó la ventana emergente de Facebook. Permite popups para continuar.';
    }

    if (code.includes('missing_facebook_access_token')) {
      return 'No fue posible obtener el token de Facebook. Intenta nuevamente.';
    }

    if (details.includes('app_not_setup') || details.includes('invalid_scope')) {
      return 'La app de Facebook no está configurada correctamente para este dominio.';
    }

    return 'No se pudo completar el inicio de sesión con Facebook';
  }

  isImageUrl(icon: string): boolean {
    return this.resolveMediaUrl(icon) !== '';
  }

  getCategoryIconUrl(category: MainCategory | null | undefined): string {
    const rawIcon = this.getRawIconValue(category);
    return this.resolveMediaUrl(rawIcon);
  }

  getServiceIconUrl(service: ServiceCategory | null | undefined): string {
    const rawIcon = this.getRawIconValue(service);
    return this.resolveMediaUrl(rawIcon);
  }

  private getRawIconValue(entity: any): string {
    return String(entity?.icon_url ?? entity?.iconUrl ?? entity?.icon ?? '').trim();
  }

  private resolveMediaUrl(rawIcon: string): string {
    if (!rawIcon) return '';

    if (rawIcon.startsWith('http://') || rawIcon.startsWith('https://') || rawIcon.startsWith('data:image/')) {
      return rawIcon;
    }

    if (rawIcon.startsWith('//')) {
      return `https:${rawIcon}`;
    }

    if (rawIcon.startsWith('res.cloudinary.com/')) {
      return `https://${rawIcon}`;
    }

    if (/^v\d+\//.test(rawIcon)) {
      return `https://res.cloudinary.com/dghwotofx/image/upload/${rawIcon}`;
    }

    if (rawIcon.startsWith('image/upload/')) {
      return `https://res.cloudinary.com/dghwotofx/${rawIcon}`;
    }

    if (rawIcon.startsWith('/')) {
      return rawIcon;
    }

    return '';
  }

  getCategoryEmoji(categoryName: string, icon?: string): string {
    const lowerName = (categoryName || '').toLowerCase();
    const lowerIcon = (icon || '').toLowerCase();

    for (const [key, emoji] of Object.entries(this.emojiMap)) {
      if (lowerName.includes(key) || lowerIcon.includes(key)) {
        return emoji;
      }
    }

    if (lowerName.includes('pint') || lowerIcon.includes('brush')) return '🖌️';
    if (lowerName.includes('clima') || lowerIcon.includes('thermometer')) return '🌡️';
    if (lowerName.includes('gas') || lowerIcon.includes('restaurant')) return '🍳';
    if (lowerName.includes('muda') || lowerIcon.includes('bus')) return '📦';
    return '🛠️';
  }

  goToRegister(): void {
    this.openRegisterModal();
  }
}
