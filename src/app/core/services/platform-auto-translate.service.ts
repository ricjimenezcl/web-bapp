import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, effect, inject } from '@angular/core';
import { PlatformI18nService } from './platform-i18n.service';
import { PlatformLanguageService } from './platform-language.service';

@Injectable({ providedIn: 'root' })
export class PlatformAutoTranslateService {
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(PlatformI18nService);
  private readonly language = inject(PlatformLanguageService);

  private observer: MutationObserver | null = null;
  private started = false;
  private scheduled = false;

  constructor() {
    effect(() => {
      this.language.language();
      this.scheduleTranslation();
    });
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    this.zone.runOutsideAngular(() => {
      this.observer = new MutationObserver(() => this.scheduleTranslation());
      if (this.document.body) {
        this.observer.observe(this.document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['placeholder', 'title', 'aria-label', 'value'],
        });
      }
    });

    this.scheduleTranslation();
  }

  private scheduleTranslation(): void {
    if (!this.started || this.scheduled) return;
    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;
      this.translateDocument();
    });
  }

  private translateDocument(): void {
    const root = this.document.body;
    if (!root) return;
    this.translateNode(root);
  }

  private translateNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      this.translateTextNode(node as Text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    if (this.shouldSkipElement(element)) return;

    this.translateElementAttributes(element);

    const children = Array.from(element.childNodes);
    for (const child of children) {
      this.translateNode(child);
    }
  }

  private translateTextNode(node: Text): void {
    const current = node.data;
    const translated = this.i18n.translateRuntimeText(current);
    if (translated !== current) {
      node.data = translated;
    }
  }

  private translateElementAttributes(element: Element): void {
    const attributes = ['placeholder', 'title', 'aria-label', 'value'];

    for (const attr of attributes) {
      const current = element.getAttribute(attr);
      if (current === null || !current.trim()) continue;

      const translated = this.i18n.translateRuntimeText(current);
      if (translated !== current) {
        element.setAttribute(attr, translated);
      }
    }
  }

  private shouldSkipElement(element: Element): boolean {
    const tag = element.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') return true;
    if (element.hasAttribute('data-no-auto-i18n')) return true;
    return false;
  }
}