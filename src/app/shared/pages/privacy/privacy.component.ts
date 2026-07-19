import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-full bg-surface-50 text-slate-800">
      <header class="bg-white border-b border-surface-200 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-10">
        <a (click)="window.history.back()" class="p-2 -ml-2 text-slate-600 cursor-pointer hover:bg-surface-100 rounded-lg">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </a>
        <h1 class="text-base font-semibold flex-1">Política de Privacidad</h1>
      </header>
      <div class="max-w-3xl mx-auto px-4 py-8 prose prose-slate prose-sm prose-headings:scroll-mt-24">
        <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Vigente desde julio de 2026</p>
        <p>BappSearch opera en <strong>https://bappsearch.com</strong> y, cuando corresponda, en <strong>https://www.bappsearch.com</strong>. Esta política explica cómo tratamos los datos personales de usuarios, clientes y proveedores que usan nuestra plataforma.</p>

        <h2>1. Responsable del tratamiento</h2>
        <p>El responsable del tratamiento de los datos es BappSearch. Para consultas de privacidad puedes escribir a <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>.</p>

        <h2>2. Datos que recopilamos</h2>
        <p>Podemos recopilar nombre, correo electrónico, teléfono, RUT o identificador equivalente, fotografía o documentación de verificación, ubicación aproximada, categoría profesional, contenido de perfil, mensajes, reseñas, datos de navegación, información técnica del dispositivo y metadatos de uso.</p>

        <h2>3. Finalidades</h2>
        <p>Usamos los datos para crear y administrar cuentas, conectar clientes con proveedores, mostrar resultados geolocalizados, verificar identidad, moderar contenido, prevenir fraude, responder solicitudes de soporte, enviar comunicaciones operativas y mejorar el servicio.</p>

        <h2>4. Base de uso y normativa aplicable</h2>
        <p>Tratamos los datos sobre la base de la relación contractual o precontractual, el consentimiento cuando corresponda y el cumplimiento de obligaciones legales. Esta política se interpreta conforme a la legislación chilena aplicable, incluyendo la <strong>Ley 19.628</strong> y sus modificaciones, incluida la <strong>Ley 21.719</strong>, además de las demás normas vigentes sobre protección de datos personales y privacidad.</p>

        <h2>5. Compartición de datos</h2>
        <p>No vendemos datos personales. Podemos compartir información con proveedores tecnológicos, servicios de infraestructura, mensajería, analítica, alojamiento, soporte y con el proveedor que el usuario contacte, solo en la medida necesaria para prestar el servicio. También podremos revelar información cuando exista obligación legal o requerimiento de autoridad competente.</p>

        <h2>6. Transferencias y almacenamiento</h2>
        <p>La información puede almacenarse en servidores de terceros ubicados dentro o fuera de Chile, siempre bajo medidas contractuales y técnicas razonables de seguridad. Procuramos que los encargados de tratamiento mantengan estándares adecuados de confidencialidad y protección.</p>

        <h2>7. Conservación</h2>
        <p>Conservaremos los datos por el tiempo necesario para prestar el servicio, cumplir obligaciones legales, resolver disputas, hacer valer derechos o mientras tu cuenta permanezca activa. Luego eliminaremos o anonimizaremos los datos cuando sea razonablemente posible.</p>

        <h2>8. Derechos de las personas</h2>
        <p>Puedes solicitar acceso, rectificación, actualización, cancelación, oposición o eliminación de tus datos, así como revocar consentimientos cuando corresponda, escribiendo a <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>. También puedes solicitar apoyo si detectas información inexacta o desactualizada en tu perfil.</p>

        <h2>9. Seguridad</h2>
        <p>Implementamos medidas administrativas, técnicas y organizativas razonables para proteger la información contra acceso no autorizado, pérdida, alteración o divulgación indebida. Ningún sistema es infalible, por lo que no podemos garantizar seguridad absoluta.</p>

        <h2>10. Cookies y tecnologías similares</h2>
        <p>Podemos usar cookies o tecnologías similares para autenticación, preferencias, medición de tráfico y mejora de la experiencia. Puedes controlar su uso desde tu navegador, aunque algunas funciones podrían verse limitadas.</p>

        <h2>11. Cambios a esta política</h2>
        <p>Podemos actualizar esta política para reflejar cambios operativos, técnicos o legales. La versión vigente será siempre la publicada en el sitio web oficial.</p>

        <h2>12. Contacto</h2>
        <p>Consultas sobre privacidad: <a href="mailto:privacidad@bappsearch.com">privacidad&#64;bappsearch.com</a>. Consultas generales: <a href="mailto:soporte@bappsearch.com">soporte&#64;bappsearch.com</a>.</p>
      </div>
    </div>
  `
})
export class PrivacyComponent {
  readonly window = window;
}
