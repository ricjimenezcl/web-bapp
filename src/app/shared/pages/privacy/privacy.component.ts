import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TPipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, TPipe],
  template: `
    <div class="min-h-full bg-surface-50 text-slate-800">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">{{ 'privacy.pageTitle' | t }}</h1>
      </header>
      <div class="max-w-3xl mx-auto px-4 py-8 prose prose-slate prose-sm prose-headings:scroll-mt-24">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">{{ 'privacy.effectiveDate' | t }}</p>
        <p>{{ 'privacy.intro' | t }}</p>

        <h2>{{ 'privacy.section1.title' | t }}</h2>
        <p>{{ 'privacy.section1.prefix' | t }} <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>.</p>

        <h2>{{ 'privacy.section2.title' | t }}</h2>
        <p>{{ 'privacy.section2.body' | t }}</p>

        <h2>{{ 'privacy.section3.title' | t }}</h2>
        <p>{{ 'privacy.section3.body' | t }}</p>

        <h2>{{ 'privacy.section4.title' | t }}</h2>
        <p>{{ 'privacy.section4.body' | t }}</p>

        <h2>{{ 'privacy.section5.title' | t }}</h2>
        <p>{{ 'privacy.section5.body' | t }}</p>

        <h2>{{ 'privacy.section6.title' | t }}</h2>
        <p>{{ 'privacy.section6.body' | t }}</p>

        <h2>{{ 'privacy.section7.title' | t }}</h2>
        <p>{{ 'privacy.section7.body' | t }}</p>

        <h2>{{ 'privacy.section8.title' | t }}</h2>
        <p>{{ 'privacy.section8.prefix' | t }} <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>. {{ 'privacy.section8.suffix' | t }}</p>

        <h2>{{ 'privacy.section9.title' | t }}</h2>
        <p>{{ 'privacy.section9.body' | t }}</p>

        <h2>{{ 'privacy.section10.title' | t }}</h2>
        <p>{{ 'privacy.section10.body' | t }}</p>

        <h2>{{ 'privacy.section11.title' | t }}</h2>
        <p>{{ 'privacy.section11.body' | t }}</p>

        <h2>{{ 'privacy.section12.title' | t }}</h2>
        <p>{{ 'privacy.section12.privacyLabel' | t }} <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>. {{ 'privacy.section12.supportLabel' | t }} <a href="mailto:soporte@bappsearch.com">soporte&#64;bappsearch.com</a>.</p>
      </div>
    </div>
  `
})
export class PrivacyComponent {
  readonly window = window;
}
