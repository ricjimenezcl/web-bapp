import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppFooterComponent } from '../../components/app-footer/app-footer.component';
import { TPipe } from '../../pipes/t.pipe';

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  imports: [CommonModule, RouterLink, AppFooterComponent, TPipe],
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
          <h1 class="text-base font-semibold text-text-primary flex-1">{{ 'faq.title' | t }}</h1>
        </div>
      </header>

      <!-- Main -->
      <main class="flex-1">
        <section class="py-16 sm:py-24 px-4">
          <div class="max-w-3xl mx-auto">

            <!-- Heading -->
            <div class="text-center mb-12">
              <p class="text-sm font-semibold text-accent-500 uppercase tracking-widest mb-3">{{ 'faq.kicker' | t }}</p>
              <h2 class="text-3xl sm:text-4xl lg:text-5xl font-black text-text-primary">
                {{ 'faq.title' | t }}
              </h2>
              <p class="mt-4 text-text-secondary text-lg max-w-xl mx-auto">
                {{ 'faq.subtitle' | t }}
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
                  {{ 'faq.tabClient' | t }}
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
                  {{ 'faq.tabProvider' | t }}
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
                      <span class="font-semibold text-text-primary text-base">{{ faq.questionKey | t }}</span>
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center transition-transform duration-200"
                           [class.rotate-180]="activeClientIndex() === $index">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    @if (activeClientIndex() === $index) {
                      <div class="px-6 pb-5">
                        <p class="text-text-secondary leading-relaxed">{{ faq.answerKey | t }}</p>
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
                      <span class="font-semibold text-text-primary text-base">{{ faq.questionKey | t }}</span>
                      <div class="flex-shrink-0 w-8 h-8 rounded-full bg-surface-raised flex items-center justify-center transition-transform duration-200"
                           [class.rotate-180]="activeProviderIndex() === $index">
                        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>
                    @if (activeProviderIndex() === $index) {
                      <div class="px-6 pb-5">
                        <p class="text-text-secondary leading-relaxed">{{ faq.answerKey | t }}</p>
                      </div>
                    }
                  </div>
                }
              }
            </div>

            <!-- CTA -->
            <div class="mt-14 text-center rounded-2xl border border-border bg-surface-card p-8">
              <p class="text-text-secondary mb-1">{{ 'faq.ctaTitle' | t }}</p>
              <p class="font-semibold text-text-primary mb-4">{{ 'faq.ctaSubtitle' | t }}</p>
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
      questionKey: 'faq.client.findProvider.question',
      answerKey: 'faq.client.findProvider.answer'
    },
    {
      questionKey: 'faq.client.contactProvider.question',
      answerKey: 'faq.client.contactProvider.answer'
    },
    {
      questionKey: 'faq.client.freeUsage.question',
      answerKey: 'faq.client.freeUsage.answer'
    },
    {
      questionKey: 'faq.client.trustProvider.question',
      answerKey: 'faq.client.trustProvider.answer'
    },
    {
      questionKey: 'faq.client.requestService.question',
      answerKey: 'faq.client.requestService.answer'
    },
    {
      questionKey: 'faq.client.leaveReview.question',
      answerKey: 'faq.client.leaveReview.answer'
    },
    {
      questionKey: 'faq.client.reportProblem.question',
      answerKey: 'faq.client.reportProblem.answer'
    },
    {
      questionKey: 'faq.client.cancelRequest.question',
      answerKey: 'faq.client.cancelRequest.answer'
    }
  ];

  readonly providerFaqs: FaqItem[] = [
    {
      questionKey: 'faq.provider.freeRegister.question',
      answerKey: 'faq.provider.freeRegister.answer'
    },
    {
      questionKey: 'faq.provider.commission.question',
      answerKey: 'faq.provider.commission.answer'
    },
    {
      questionKey: 'faq.provider.findMe.question',
      answerKey: 'faq.provider.findMe.answer'
    },
    {
      questionKey: 'faq.provider.identityVerification.question',
      answerKey: 'faq.provider.identityVerification.answer'
    },
    {
      questionKey: 'faq.provider.moreServices.question',
      answerKey: 'faq.provider.moreServices.answer'
    },
    {
      questionKey: 'faq.provider.paymentCollection.question',
      answerKey: 'faq.provider.paymentCollection.answer'
    },
    {
      questionKey: 'faq.provider.pauseProfile.question',
      answerKey: 'faq.provider.pauseProfile.answer'
    },
    {
      questionKey: 'faq.provider.ranking.question',
      answerKey: 'faq.provider.ranking.answer'
    }
  ];
}
