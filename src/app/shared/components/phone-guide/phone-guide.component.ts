import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { animate, stagger } from 'animejs';

type Anim = ReturnType<typeof animate>;

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { title: 'Te damos la bienvenida', description: 'Un recorrido corto para que sepas por dónde empezar.' },
  { title: 'Crea tu cuenta', description: 'Ingresa tu nombre, tu correo y una contraseña. Toma menos de un minuto.' },
  { title: 'Verifica tu correo', description: 'Escribe el código de 4 dígitos que te enviamos para activar tu cuenta.' },
  { title: 'Cuéntanos qué buscas', description: 'Elige tus categorías favoritas y personalizamos lo que verás.' },
  { title: 'Explora resultados', description: 'Busca y compara. Cada resultado muestra qué tanto coincide contigo.' },
  { title: 'Navega con la barra inferior', description: 'Inicio, búsqueda, mensajes y perfil siempre están a un toque.' },
];

@Component({
  selector: 'app-phone-guide',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phone-guide.component.html',
  styleUrl: './phone-guide.component.scss'
})
export class PhoneGuideComponent implements OnDestroy {
  /** Avanza solo entre pantallas. Se desactiva si el usuario prefiere menos movimiento. */
  readonly autoplay = input(true);
  /** Milisegundos que dura cada pantalla en modo automático. */
  readonly intervalMs = input(5500);

  readonly steps = STEPS;
  readonly step = signal(0);
  readonly playing = signal(false);

  // Datos de ejemplo: cámbialos por los de tu plataforma
  readonly code = ['4', '2', '7', '1'];
  readonly tabs = ['Inicio', 'Buscar', 'Mensajes', 'Perfil'];
  readonly chips = [
    { label: 'Hogar', on: true },
    { label: 'Salud', on: false },
    { label: 'Tecnología', on: true },
    { label: 'Educación', on: false },
    { label: 'Eventos', on: false },
    { label: 'Belleza', on: false },
  ];
  readonly results = [
    { name: 'Paula Medina', role: 'Diseño de interiores', match: 92 },
    { name: 'Andrés Soto', role: 'Gasfitería y reparaciones', match: 78 },
    { name: 'Lucía Vera', role: 'Clases particulares', match: 64 },
  ];

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly screen = viewChild.required<ElementRef<HTMLElement>>('screen');

  private anims: Anim[] = [];
  private progress?: Anim;
  private busy = false;
  private reduced = false;

  constructor() {
    // afterNextRender solo corre en el navegador: seguro con SSR
    afterNextRender(() => {
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.playing.set(this.autoplay() && !this.reduced);
      this.cdr.detectChanges();
      this.playScreen(1);
      this.startProgress();
    });
  }

  ngOnDestroy(): void {
    this.clearAnims();
    this.progress?.revert();
  }

  /* ---------- navegación ---------- */

  async go(target: number): Promise<void> {
    if (this.busy || target === this.step() || target < 0 || target >= STEPS.length) return;
    this.busy = true;
    this.progress?.pause();
    this.clearAnims();

    const dir = target > this.step() ? 1 : -1;
    const el = this.screen().nativeElement;

    // 1) la pantalla actual sale
    if (!this.reduced) {
      await new Promise<void>((resolve) =>
        animate(el, {
          opacity: 0,
          translateX: -30 * dir,
          duration: 220,
          ease: 'inQuad',
          onComplete: () => resolve(),
        }),
      );
    }

    // 2) cambiamos el contenido y forzamos el render ya mismo
    this.step.set(target);
    this.cdr.detectChanges();

    // 3) la nueva pantalla entra
    this.playScreen(dir);
    this.startProgress();
    this.busy = false;
  }

  toggle(): void {
    const next = !this.playing();
    this.playing.set(next);
    if (!next) this.progress?.pause();
    else if (this.progress) this.progress.play();
    else this.startProgress();
  }

  hoverPause(): void {
    this.progress?.pause();
  }

  hoverResume(): void {
    if (this.playing()) this.progress?.play();
  }

  /* ---------- animaciones ---------- */

  private startProgress(): void {
    this.progress?.revert();
    this.progress = undefined;
    if (!this.playing()) return;

    const bar = this.host.nativeElement.querySelector('[data-progress]');
    if (!bar) return;

    this.progress = animate(bar, {
      width: ['0%', '100%'],
      duration: this.intervalMs(),
      ease: 'linear',
      onComplete: () => this.go((this.step() + 1) % STEPS.length),
    });
  }

  private clearAnims(): void {
    this.anims.forEach((a) => a.revert());
    this.anims = [];
  }

  private playScreen(dir: number): void {
    const root = this.screen().nativeElement;
    const all = <T extends HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));

    // Con "reducir movimiento": mostramos el estado final sin animar
    if (this.reduced) {
      root.style.opacity = '1';
      root.style.transform = 'none';
      all('.opacity-0').forEach((e) => (e.style.opacity = '1'));
      all('[data-type]').forEach((e) => (e.textContent = e.dataset['type'] ?? ''));
      all('[data-bar]').forEach((e) => (e.style.width = e.dataset['w'] + '%'));
      all('[data-chip-on]').forEach((e) => {
        e.style.backgroundColor = '#2D5BFF';
        e.style.color = '#fff';
      });
      return;
    }

    const add = (a: Anim) => this.anims.push(a);

    // Entrada del contenedor
    add(animate(root, { opacity: [0, 1], translateX: [40 * dir, 0], duration: 380, ease: 'outCubic' }));

    // Entrada escalonada de todo lo marcado con data-anim
    const items = all('[data-anim]');
    if (items.length) {
      add(animate(items, {
        opacity: [0, 1],
        translateY: [14, 0],
        duration: 420,
        delay: stagger(70, { start: 150 }),
        ease: 'outCubic',
      }));
    }

    // Animación propia de cada pantalla
    switch (this.step()) {
      case 0: {
        add(animate('[data-float]', { translateY: [0, -8], duration: 1400, alternate: true, loop: true, ease: 'inOutSine' }));
        break;
      }
      case 1: {
        const fields = all('[data-type]');
        fields.forEach((el, i) => {
          const text = el.dataset['type'] ?? '';
          const counter = { n: 0 };
          el.textContent = '';
          add(animate(counter, {
            n: text.length,
            duration: text.length * 55,
            delay: 600 + i * 1000,
            ease: 'linear',
            onUpdate: () => (el.textContent = text.slice(0, Math.round(counter.n))),
          }));
        });
        add(animate('[data-tap]', { scale: [0.3, 1.8], opacity: [0.6, 0], duration: 700, delay: 2800, ease: 'outQuad' }));
        add(animate('[data-cta]', { scale: [1, 0.94, 1], duration: 300, delay: 2850 }));
        break;
      }
      case 2: {
        add(animate('[data-digit]', { opacity: [0, 1], scale: [0.5, 1], duration: 400, delay: stagger(220, { start: 500 }), ease: 'outBack' }));
        add(animate('[data-badge]', { opacity: [0, 1], scale: [0.6, 1], duration: 500, delay: 1700, ease: 'outBack' }));
        break;
      }
      case 3: {
        add(animate('[data-chip-on]', {
          backgroundColor: ['#FFFFFF', '#2D5BFF'],
          color: ['#12263A', '#FFFFFF'],
          duration: 300,
          delay: stagger(600, { start: 1100 }),
        }));
        break;
      }
      case 4: {
        add(animate('[data-bar]', {
          width: (el: any) => `${el.dataset['w']}%`,
          duration: 900,
          delay: stagger(150, { start: 700 }),
          ease: 'outExpo',
        }));
        break;
      }
      case 5: {
        add(animate('[data-pill]', {
          translateX: [
            { to: '100%', duration: 450, delay: 900, ease: 'inOutQuad' },
            { to: '200%', duration: 450, delay: 600, ease: 'inOutQuad' },
            { to: '300%', duration: 450, delay: 600, ease: 'inOutQuad' },
          ],
        }));
        break;
      }
    }
  }
}

