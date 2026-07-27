import { DOCUMENT } from '@angular/common';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';

export type PlatformLanguage = 'es' | 'en' | 'pt';

@Injectable({ providedIn: 'root' })
export class PlatformLanguageService {
  private readonly document = inject(DOCUMENT);

  private readonly storageKey = 'bapp_platform_language';
  private readonly _language = signal<PlatformLanguage>('es');

  readonly language: Signal<PlatformLanguage> = this._language.asReadonly();
  readonly languageLabel = computed(() => this.getLanguageLabel(this._language()));

  initialize(): void {
    const stored = this.readStoredLanguage();
    if (stored) {
      this.applyLanguage(stored);
      return;
    }

    const fallback = this.detectBrowserLanguage();
    this.applyLanguage(fallback);
  }

  setLanguage(language: PlatformLanguage): void {
    this.applyLanguage(language);
  }

  getLanguageLabel(language: PlatformLanguage): string {
    if (language === 'en') return 'English';
    if (language === 'pt') return 'Portugues';
    return 'Espanol';
  }

  private applyLanguage(language: PlatformLanguage): void {
    this._language.set(language);
    this.document.documentElement.lang = language;
    localStorage.setItem(this.storageKey, language);
  }

  private readStoredLanguage(): PlatformLanguage | null {
    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'es' || stored === 'en' || stored === 'pt') {
      return stored;
    }
    return null;
  }

  private detectBrowserLanguage(): PlatformLanguage {
    const browserLang = (this.document.defaultView?.navigator.language || 'es').toLowerCase();
    if (browserLang.startsWith('en')) return 'en';
    if (browserLang.startsWith('pt')) return 'pt';
    return 'es';
  }
}