import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';

import { PlatformLanguageService } from './platform-language.service';

describe('PlatformLanguageService', () => {
  let service: PlatformLanguageService;

  beforeEach(() => {
    localStorage.removeItem('bapp_platform_language');
  });

  afterEach(() => {
    localStorage.removeItem('bapp_platform_language');
  });

  function setupWithNavigatorLanguage(language: string): PlatformLanguageService {
    const fakeDocument = {
      documentElement: { lang: '' },
      defaultView: {
        navigator: { language },
      },
    } as unknown as Document;

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlatformLanguageService,
        { provide: DOCUMENT, useValue: fakeDocument },
      ],
    });

    return TestBed.inject(PlatformLanguageService);
  }

  it('initializes from stored language when present', () => {
    localStorage.setItem('bapp_platform_language', 'pt');
    service = setupWithNavigatorLanguage('es-CL');

    service.initialize();

    expect(service.language()).toBe('pt');
  });

  it('detects english from browser language when no stored language', () => {
    service = setupWithNavigatorLanguage('en-US');

    service.initialize();

    expect(service.language()).toBe('en');
  });

  it('detects portuguese from browser language when no stored language', () => {
    service = setupWithNavigatorLanguage('pt-BR');

    service.initialize();

    expect(service.language()).toBe('pt');
  });

  it('falls back to spanish for unsupported browser language', () => {
    service = setupWithNavigatorLanguage('fr-FR');

    service.initialize();

    expect(service.language()).toBe('es');
  });

  it('returns expected labels for each language', () => {
    service = setupWithNavigatorLanguage('es-CL');

    expect(service.getLanguageLabel('es')).toBe('Espanol');
    expect(service.getLanguageLabel('en')).toBe('English');
    expect(service.getLanguageLabel('pt')).toBe('Portugues');
  });
});