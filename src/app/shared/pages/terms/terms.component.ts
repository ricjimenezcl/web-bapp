import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink, TPipe],
  template: `
    <div class="min-h-full bg-surface-50 text-slate-800">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">{{ 'terms.pageTitle' | t }}</h1>
      </header>
      <div class="max-w-3xl mx-auto px-4 py-8 prose prose-slate prose-sm prose-headings:scroll-mt-24">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{{ 'terms.effectiveDate' | t }}</p>
        <p>{{ 'terms.intro' | t }}</p>

        <h2>{{ 'terms.section1.title' | t }}</h2>
        <p>{{ 'terms.section1.body' | t }}</p>

        <h2>{{ 'terms.section2.title' | t }}</h2>
        <p>{{ 'terms.section2.body' | t }}</p>

        <h2>{{ 'terms.section3.title' | t }}</h2>
        <p>{{ 'terms.section3.body' | t }}</p>

        <h2>{{ 'terms.section4.title' | t }}</h2>
        <p>{{ 'terms.section4.body' | t }}</p>

        <h2>{{ 'terms.section5.title' | t }}</h2>
        <p>{{ 'terms.section5.body' | t }}</p>

        <h2>{{ 'terms.section6.title' | t }}</h2>
        <p>{{ 'terms.section6.body' | t }}</p>

        <h2>{{ 'terms.section7.title' | t }}</h2>
        <p>{{ 'terms.section7.body' | t }}</p>

        <h2>{{ 'terms.section8.title' | t }}</h2>
        <p>{{ 'terms.section8.prefix' | t }} <a routerLink="/privacy" class="text-primary-600">{{ 'terms.section8.linkLabel' | t }}</a> {{ 'terms.section8.suffix' | t }}</p>

        <h2>{{ 'terms.section9.title' | t }}</h2>
        <p>{{ 'terms.section9.body' | t }}</p>

        <h2>{{ 'terms.section10.title' | t }}</h2>
        <p>{{ 'terms.section10.body' | t }}</p>

        <h2>{{ 'terms.section11.title' | t }}</h2>
        <p>{{ 'terms.section11.body' | t }}</p>

        <h2>{{ 'terms.section12.title' | t }}</h2>
        <p>{{ 'terms.section12.prefix' | t }} <a href="mailto:soporte@bappsearch.com">soporte&#64;bappsearch.com</a>.</p>
      </div>
    </div>
  `
})
export class TermsComponent {
  readonly window = window;
}
