import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';

import { PlatformI18nService } from './platform-i18n.service';
import { PlatformLanguageService } from './platform-language.service';

describe('PlatformI18nService legal and faq translations', () => {
  let i18n: PlatformI18nService;
  let language: PlatformLanguageService;

  beforeEach(() => {
    localStorage.removeItem('bapp_platform_language');

    TestBed.configureTestingModule({
      providers: [
        PlatformI18nService,
        PlatformLanguageService,
        { provide: DOCUMENT, useValue: document },
      ],
    });

    i18n = TestBed.inject(PlatformI18nService);
    language = TestBed.inject(PlatformLanguageService);
  });

  afterEach(() => {
    localStorage.removeItem('bapp_platform_language');
  });

  it('returns spanish legal labels by default', () => {
    expect(i18n.t('faq.title')).toBe('Preguntas frecuentes');
    expect(i18n.t('terms.pageTitle')).toBe('Terminos y Condiciones');
    expect(i18n.t('privacy.pageTitle')).toBe('Politica de Privacidad');
    expect(i18n.t('termsAcceptance.title')).toBe('Terminos y condiciones');
  });

  it('switches faq and legal labels to english', () => {
    language.setLanguage('en');

    expect(i18n.t('faq.title')).toBe('Frequently asked questions');
    expect(i18n.t('terms.pageTitle')).toBe('Terms and Conditions');
    expect(i18n.t('privacy.pageTitle')).toBe('Privacy Policy');
    expect(i18n.t('termsAcceptance.continue')).toBe('Continue');
  });

  it('switches faq and legal labels to portuguese', () => {
    language.setLanguage('pt');

    expect(i18n.t('faq.title')).toBe('Perguntas frequentes');
    expect(i18n.t('terms.pageTitle')).toBe('Termos e Condicoes');
    expect(i18n.t('privacy.pageTitle')).toBe('Politica de Privacidade');
    expect(i18n.t('termsAcceptance.continue')).toBe('Continuar');
  });

  it('covers representative faq entries across languages', () => {
    expect(i18n.t('faq.client.findProvider.question')).toContain('proveedor');

    language.setLanguage('en');
    expect(i18n.t('faq.client.findProvider.question')).toContain('provider');

    language.setLanguage('pt');
    expect(i18n.t('faq.client.findProvider.question')).toContain('fornecedor');
  });
});