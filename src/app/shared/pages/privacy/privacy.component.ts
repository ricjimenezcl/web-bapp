import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-full bg-surface-50">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Política de Privacidad</h1>
      </header>
      <div class="max-w-2xl mx-auto px-4 py-6 prose prose-slate prose-sm">
        <h2>1. Información que Recopilamos</h2>
        <p>Recopilamos nombre, correo, teléfono, ubicación aproximada y datos de uso para brindarte el servicio.</p>
        <h2>2. Uso de la Información</h2>
        <p>Usamos tus datos para conectarte con proveedores, procesar reservas y mejorar la plataforma.</p>
        <h2>3. Compartir Información</h2>
        <p>No vendemos tu información. Solo la compartimos con el proveedor correspondiente para completar el servicio.</p>
        <h2>4. Seguridad</h2>
        <p>Protegemos tus datos con cifrado en tránsito (HTTPS) y en reposo.</p>
        <h2>5. Tus Derechos</h2>
        <p>Puedes solicitar acceso, corrección o eliminación de tus datos en cualquier momento contactándonos.</p>
        <h2>6. Contacto</h2>
        <p>Para consultas sobre privacidad: privacidad&#64;bappsearch.com</p>
      </div>
    </div>
  `
})
export class PrivacyComponent {
  readonly window = window;
}
