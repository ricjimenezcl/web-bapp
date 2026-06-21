import { Component, OnInit, OnDestroy, signal, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './provider-landing.component.html',
})
export class ProviderLandingComponent implements OnInit, OnDestroy {
  scrolled = signal(false);
  activeFaqIndex = signal<number | null>(null);

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

  constructor(
    private readonly meta: Meta,
    private readonly title: Title,
    private readonly router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Proveedores de Servicios en Chile | Regístrate Gratis en BApp Search');
    this.meta.updateTag({ name: 'description', content: 'Consigue clientes cerca de ti. Publica hasta 2 servicios gratis para siempre. Sin comisiones y con perfil verificado.' });
    this.meta.updateTag({ property: 'og:title', content: 'Proveedores de Servicios en Chile | Regístrate Gratis en BApp Search' });
    this.meta.updateTag({ property: 'og:description', content: 'Consigue clientes cerca de ti. Publica hasta 2 servicios gratis para siempre. Sin comisiones y con perfil verificado.' });

    if (isPlatformBrowser(this.platformId)) {
      this.scrollListener = () => this.scrolled.set(window.scrollY > 20);
      window.addEventListener('scroll', this.scrollListener, { passive: true });
    }
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="description"');
    this.meta.removeTag('property="og:title"');
    this.meta.removeTag('property="og:description"');

    if (isPlatformBrowser(this.platformId) && this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
    }
  }

  toggleFaq(index: number): void {
    this.activeFaqIndex.set(this.activeFaqIndex() === index ? null : index);
  }

  goToRegister(): void {
    this.router.navigate(['/auth/register-provider']);
  }
}
