import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppFooterComponent } from '../../components/app-footer/app-footer.component';

interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterLink, AppFooterComponent],
  template: `
    <div class="min-h-screen bg-surface-base flex flex-col">

      <!-- Header -->
      <header class="border-b border-border bg-surface-card px-4 py-4 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto flex items-center gap-4">
          <a routerLink="/" class="flex items-center gap-2 shrink-0">
            <img src="https://res.cloudinary.com/dghwotofx/image/upload/f_auto,q_auto,w_320,c_limit/v1774563936/logo_gsgyrf.png"
                 alt="Logo BappSearch" class="h-8 w-auto object-contain">
            <img src="https://res.cloudinary.com/dghwotofx/image/upload/v1774563936/titulo_bycrju.png"
                 alt="BappSearch" class="h-4 w-auto object-contain hidden sm:block">
          </a>
          <h1 class="text-base font-semibold text-text-primary flex-1">Preguntas frecuentes</h1>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1">
        <section class="py-16 sm:py-24 px-4">
          <div class="max-w-3xl mx-auto">

            <!-- Heading -->
            <div class="text-center mb-12">
              <p class="text-sm font-semibold text-accent-500 uppercase tracking-widest mb-3">Tus dudas</p>
              <h2 class="text-3xl sm:text-4xl lg:text-5xl font-black text-text-primary">
                Preguntas frecuentes
              </h2>
              <p class="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
                Encuentra respuestas rápidas sobre cómo funciona BappSearch tanto si eres cliente como proveedor.
              </p>
            </div>

            <!-- Tab toggle -->
            <div class="flex justify-center mb-10">
              <div class="inline-flex bg-surface-card border border-border rounded-2xl p-1 gap-1">
                <button
                  type="button"
                  (click)="activeTab.set('cliente')"
                  class="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                  [class.bg-primary-500]="activeTab() === 'cliente'"
                  [class.text-surface-base]="activeTab() === 'cliente'"
                  [class.shadow-md]="activeTab() === 'cliente'"
                  [class.text-text-secondary]="activeTab() !== 'cliente'"
                  [class.hover:text-text-primary]="activeTab() !== 'cliente'">
                  Soy Cliente
                </button>
                <button
                  type="button"
                  (click)="activeTab.set('proveedor')"
                  class="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                  [class.bg-primary-500]="activeTab() === 'proveedor'"
                  [class.text-surface-base]="activeTab() === 'proveedor'"
                  [class.shadow-md]="activeTab() === 'proveedor'"
                  [class.text-text-secondary]="activeTab() !== 'proveedor'"
                  [class.hover:text-text-primary]="activeTab() !== 'proveedor'">
                  Soy Proveedor
                </button>
              </div>
            </div>

            <!-- FAQ accordion -->
            <div class="space-y-3">
              @if (activeTab() === 'cliente') {
                @for (faq of clientFaqs; track $index) {
                  <div class="bg-surface-card border rounded-2xl overflow-hidden transition-all duration-200"
                       [class.border-accent-500]="activeClientIndex() === $index"
                       [class.border-border]="activeClientIndex() !== $index">
                    <button
                      type="button"
                      class="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-surface-raised transition-colors"
                      (click)="toggleClient($index)">
                      <span class="font-semibold text-text-primary text-base">{{ faq.question }}</span>
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center transition-transform duration-200"
                           [class.rotate-180]="activeClientIndex() === $index">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    @if (activeClientIndex() === $index) {
                      <div class="px-6 pb-5">
                        <p class="text-text-secondary leading-relaxed">{{ faq.answer }}</p>
                      </div>
                    }
                  </div>
                }
              }

              @if (activeTab() === 'proveedor') {
                @for (faq of providerFaqs; track $index) {
                  <div class="bg-surface-card border rounded-2xl overflow-hidden transition-all duration-200"
                       [class.border-accent-500]="activeProviderIndex() === $index"
                       [class.border-border]="activeProviderIndex() !== $index">
                    <button
                      type="button"
                      class="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-surface-raised transition-colors"
                      (click)="toggleProvider($index)">
                      <span class="font-semibold text-text-primary text-base">{{ faq.question }}</span>
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center transition-transform duration-200"
                           [class.rotate-180]="activeProviderIndex() === $index">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    @if (activeProviderIndex() === $index) {
                      <div class="px-6 pb-5">
                        <p class="text-text-secondary leading-relaxed">{{ faq.answer }}</p>
                      </div>
                    }
                  </div>
                }
              }
            </div>

            <!-- CTA -->
            <div class="mt-14 text-center rounded-2xl border border-border bg-surface-card p-8">
              <p class="text-text-secondary mb-1">¿No encontraste lo que buscabas?</p>
              <p class="font-semibold text-text-primary mb-4">Escríbenos directamente y te respondemos.</p>
              <a href="mailto:soporte@bappsearch.com"
                 class="inline-flex items-center gap-2 bg-primary-500 text-surface-base font-bold px-8 py-3 rounded-xl hover:bg-primary-400 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                 soporte&#64;bappsearch.com
              </a>
            </div>

          </div>
        </section>
      </main>

      <app-footer [compact]="true"></app-footer>
    </div>
  `
})
export class FaqComponent {
  activeTab = signal<'cliente' | 'proveedor'>('cliente');
  activeClientIndex = signal<number | null>(null);
  activeProviderIndex = signal<number | null>(null);

  toggleClient(index: number): void {
    this.activeClientIndex.set(this.activeClientIndex() === index ? null : index);
  }

  toggleProvider(index: number): void {
    this.activeProviderIndex.set(this.activeProviderIndex() === index ? null : index);
  }

  readonly clientFaqs: FaqItem[] = [
    {
      question: '¿Cómo encuentro un proveedor cerca de mí?',
      answer: 'Ingresa a BappSearch, selecciona la categoría de servicio que necesitas y podrás ver en el mapa los proveedores verificados disponibles en tu zona. También puedes filtrar por servicio específico para afinar los resultados.'
    },
    {
      question: '¿Cómo contacto a un proveedor?',
      answer: 'Una vez que encuentres un proveedor de tu interés, puedes ver su perfil completo con descripción, servicios, fotos y reseñas. Desde ahí puedes enviarle un mensaje directo a través del chat de la plataforma para coordinar los detalles.'
    },
    {
      question: '¿El uso de BappSearch es gratuito para clientes?',
      answer: 'Sí, registrarse y usar BappSearch como cliente es completamente gratuito. Puedes buscar proveedores, ver perfiles, leer reseñas y contactarlos sin ningún costo.'
    },
    {
      question: '¿Cómo sé si un proveedor es confiable?',
      answer: 'Todos los proveedores pasan por un proceso de verificación de identidad antes de publicar sus servicios. Además, puedes ver las reseñas de otros clientes, la descripción detallada de sus servicios y su historial en la plataforma.'
    },
    {
      question: '¿Cómo solicito un servicio?',
      answer: 'Encuentra al proveedor adecuado, revisa su disponibilidad y contáctalo por el chat para acordar los detalles como fecha, hora, lugar y precio. La reserva se confirma directamente entre tú y el proveedor.'
    },
    {
      question: '¿Cómo dejo una reseña a un proveedor?',
      answer: 'Una vez finalizado el servicio, podrás calificar y dejar un comentario sobre tu experiencia desde la sección de reservas en tu perfil. Las reseñas ayudan a la comunidad a tomar mejores decisiones.'
    },
    {
      question: '¿Qué hago si tengo un problema con un proveedor?',
      answer: 'Si experimentas algún inconveniente, puedes reportarlo desde el perfil del proveedor o contactar a nuestro equipo de soporte en soporte@bappsearch.com. Revisamos cada caso para mantener la calidad de la plataforma.'
    },
    {
      question: '¿Puedo cancelar una solicitud de servicio?',
      answer: 'Sí, puedes cancelar una solicitud pendiente desde la sección "Mis reservas" en tu perfil. Te recomendamos avisar al proveedor con anticipación por cortesía.'
    }
  ];

  readonly providerFaqs: FaqItem[] = [
    {
      question: '¿Es realmente gratis registrarse?',
      answer: 'Sí, registrarte como proveedor en BappSearch es completamente gratuito. Puedes publicar hasta 2 servicios sin costo y sin fecha de vencimiento. No necesitas tarjeta de crédito para empezar.'
    },
    {
      question: '¿Cobran comisión por cada trabajo que realizo?',
      answer: 'No. BappSearch no cobra comisión por los trabajos que concretes. El dinero que acuerdes con tus clientes es 100% tuyo. Nuestro modelo es simple: ayudarte a conseguir más clientes sin quitarte parte de tus ganancias.'
    },
    {
      question: '¿Cómo me encuentran los clientes?',
      answer: 'Cuando te registras y activas tu perfil, apareces geolocalizado en el mapa de tu zona. Los clientes que busquen servicios en tu categoría podrán verte, revisar tu perfil y contactarte directamente. Cuanto más completo sea tu perfil, más posibilidades tienes de ser elegido.'
    },
    {
      question: '¿Qué es la verificación de identidad?',
      answer: 'Es un proceso sencillo donde subimos una foto de tu carnet o documento de identidad para validar que eres una persona real. Esto genera confianza en los clientes y te da el sello de "Proveedor verificado" en tu perfil.'
    },
    {
      question: '¿Puedo publicar más de 2 servicios?',
      answer: 'El plan gratuito incluye 2 servicios activos. Si necesitas publicar más, próximamente lanzaremos planes adicionales que te permitirán ampliar tu oferta. Mientras tanto, elige los 2 servicios que más clientes te generan.'
    },
    {
      question: '¿Cómo cobro por mis servicios?',
      answer: 'El pago lo coordinas directamente con el cliente. Puedes acordar el método de pago que prefieras: transferencia bancaria, efectivo o cualquier otro que acuerden entre ustedes. BappSearch no interviene en la transacción económica.'
    },
    {
      question: '¿Qué pasa si quiero pausar o desactivar mi perfil?',
      answer: 'Puedes pausar o desactivar tu perfil en cualquier momento desde la configuración de tu cuenta. Durante ese período no aparecerás en los resultados de búsqueda, pero conservas toda tu información y reseñas para cuando quieras reactivarte.'
    },
    {
      question: '¿Cómo mejoro mi posicionamiento en el mapa?',
      answer: 'Completa al 100% tu perfil (foto, descripción, servicios, zona de cobertura), solicita reseñas a tus clientes satisfechos y mantén tu perfil activo. Los perfiles más completos y con mejores valoraciones aparecen primero en los resultados de búsqueda.'
    }
  ];
}
