import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Términos y Condiciones</h1>
      </header>
      <div class="max-w-2xl mx-auto px-4 py-6 prose prose-slate prose-sm">
        <h2>1. Aceptación de los Términos</h2>
        <p>Al usar BappSearch, aceptas estos términos en su totalidad. Si no estás de acuerdo, no uses el servicio.</p>
        <h2>2. Descripción del Servicio</h2>
        <p>BappSearch es una plataforma que conecta clientes con proveedores de servicios. No somos responsables de la calidad de los servicios contratados.</p>
        <h2>3. Registro</h2>
        <p>Debes proporcionar información verídica al registrarte. Los proveedores deben verificar su identidad.</p>
        <h2>4. Uso Aceptable</h2>
        <p>No puedes usar la plataforma para actividades ilegales, spam ni fraude.</p>
        <h2>5. Privacidad</h2>
        <p>Tu información se trata según nuestra <a routerLink="/privacy" class="text-primary-600">Política de Privacidad</a>.</p>
        <h2>6. Contacto</h2>
        <p>Para dudas sobre estos términos, contáctanos a soporte&#64;bappsearch.com</p>
      </div>
    </div>
  `
})
export class TermsComponent {
  readonly window = window;
}
