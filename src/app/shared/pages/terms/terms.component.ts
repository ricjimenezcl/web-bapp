import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-full bg-surface-50 text-slate-800">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Términos y Condiciones</h1>
      </header>
      <div class="max-w-3xl mx-auto px-4 py-8 prose prose-slate prose-sm prose-headings:scroll-mt-24">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Vigente desde julio de 2026</p>
        <p>Estos Términos y Condiciones regulan el uso de BappSearch, disponible en <strong>https://bappsearch.com</strong> y, cuando aplique, en <strong>https://www.bappsearch.com</strong>. Al registrarte o utilizar la plataforma aceptas íntegramente estas condiciones.</p>

        <h2>1. Descripción del servicio</h2>
        <p>BappSearch es una plataforma de descubrimiento y contacto que permite a clientes encontrar proveedores de servicios, revisar perfiles, contactar, solicitar información y coordinar prestaciones. No prestamos directamente los servicios ofrecidos por terceros.</p>

        <h2>2. Elegibilidad y registro</h2>
        <p>Debes entregar información veraz, actualizada y completa. Si eres proveedor, autorizas la verificación de identidad y la revisión de tu contenido. Eres responsable de mantener la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.</p>

        <h2>3. Obligaciones de los usuarios</h2>
        <p>Te comprometes a usar la plataforma de forma lícita, sin fraude, spam, suplantación, contenido ofensivo, acoso ni cualquier conducta que afecte a otros usuarios o al funcionamiento del servicio. También te obligas a respetar las leyes, normas de consumo y demás disposiciones aplicables en Chile.</p>

        <h2>4. Contenido y moderación</h2>
        <p>Podemos revisar, limitar, ocultar o eliminar contenido que incumpla estas condiciones, nuestras políticas o la normativa aplicable. Esto incluye perfiles, descripciones, imágenes, mensajes y reseñas. También podremos suspender o cerrar cuentas ante incumplimientos graves o reiterados.</p>

        <h2>5. Contenido de proveedores</h2>
        <p>Los proveedores son responsables de la veracidad, calidad, disponibilidad, licencias, permisos y cumplimiento legal de sus servicios. BappSearch no garantiza resultados comerciales ni asume responsabilidad por daños derivados de la relación entre usuarios y proveedores, salvo en los casos en que la ley lo exija.</p>

        <h2>6. Precios, pagos y comisiones</h2>
        <p>Las condiciones comerciales, precios, comisiones o planes, si existen, se informarán en la plataforma o en documentos complementarios. Salvo indicación expresa, BappSearch no interviene en la fijación de precios entre usuarios y proveedores.</p>

        <h2>7. Propiedad intelectual</h2>
        <p>La plataforma, su diseño, código, marcas, logotipos y contenidos propios son titularidad de BappSearch o de sus licenciantes. No puedes copiar, modificar, distribuir o explotar estos elementos sin autorización previa y por escrito.</p>

        <h2>8. Privacidad y datos personales</h2>
        <p>El tratamiento de datos personales se rige por nuestra <a routerLink="/privacy" class="text-primary-600">Política de Privacidad</a> y por la legislación chilena aplicable, incluyendo la <strong>Ley 19.628</strong> y sus modificaciones, incluida la <strong>Ley 21.719</strong>.</p>

        <h2>9. Disponibilidad del servicio</h2>
        <p>Podemos modificar, suspender o discontinuar funciones, contenidos o servicios por razones técnicas, legales, de seguridad o de negocio. Haremos esfuerzos razonables para evitar interrupciones innecesarias, pero no garantizamos disponibilidad continua e ininterrumpida.</p>

        <h2>10. Limitación de responsabilidad</h2>
        <p>En la máxima medida permitida por la ley, BappSearch no será responsable por pérdidas indirectas, lucro cesante, daños reputacionales o problemas derivados de la interacción entre usuarios, salvo culpa grave o dolo cuando la legislación aplicable lo impida.</p>

        <h2>11. Terminación</h2>
        <p>Podemos restringir o terminar el acceso de una cuenta si detectamos incumplimientos, riesgos de seguridad, actividades fraudulentas o requerimientos legales. También puedes dejar de usar la plataforma en cualquier momento y solicitar la eliminación de tu cuenta según la política aplicable.</p>

        <h2>12. Ley aplicable y contacto</h2>
        <p>Estos términos se rigen por las leyes de la República de Chile. Para consultas, escríbenos a <a href="mailto:soporte@bappsearch.com">soporte&#64;bappsearch.com</a>.</p>
      </div>
    </div>
  `
})
export class TermsComponent {
  readonly window = window;
}
