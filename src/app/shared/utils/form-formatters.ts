/**
 * Utilidades de formateo en tiempo real para campos de formulario.
 * Lógica extraída y adaptada desde frontend-bapp.
 */

/**
 * Formatea un número de teléfono chileno al escribir en un input.
 *
 * Acepta: dígitos sueltos, con código de país (56/+56), con o sin espacios.
 * Salida:  "+56 9 XXXX XXXX"  (máx. 9 dígitos locales, solo móviles con 9 inicial)
 *
 * @param rawValue Valor crudo del input (puede incluir letras, espacios, etc.)
 * @returns Valor formateado, o '' si el input está vacío
 */
export function formatChileanPhone(rawValue: string): string {
  let digits = rawValue.replace(/\D/g, '');

  // El sistema exige prefijo fijo "+56 9" y solo 8 dígitos finales.
  if (digits.startsWith('56')) {
    digits = digits.substring(2);
  }
  if (digits.startsWith('9')) {
    digits = digits.substring(1);
  }

  digits = digits.substring(0, 8);

  if (digits.length === 0) return '+56 9';
  if (digits.length <= 4) return `+56 9 ${digits}`;
  return `+56 9 ${digits.substring(0, 4)} ${digits.substring(4)}`;
}

/**
 * Normaliza un teléfono chileno al formato canónico para backend: "+569XXXXXXXX".
 * Acepta formatos tipo "+56 9 1234 5678", "56912345678", "981234567" y "12345678".
 */
export function normalizeChileanPhoneForBackend(rawValue: string): string {
  const digits = (rawValue ?? '').toString().replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('56')) {
    const withoutCountry = digits.slice(2);
    if (withoutCountry.length === 9 && withoutCountry.startsWith('9')) {
      return `+56${withoutCountry}`;
    }
    return `+${digits}`;
  }

  if (digits.length === 9 && digits.startsWith('9')) {
    return `+56${digits}`;
  }

  if (digits.length === 8) {
    return `+569${digits}`;
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return `+56${digits}`;
}

/**
 * Formatea un RUT chileno al escribir en un input.
 *
 * Acepta: dígitos y K sueltos, con o sin puntos/guión.
 * Salida:  "12345678-9"  (formato canónico backend, sin puntos)
 *
 * @param rawValue Valor crudo del input
 * @returns Valor formateado
 */
export function formatChileanRUT(rawValue: string): string {
  // 1. Solo dígitos y K (dígito verificador)
  let cleaned = rawValue.toUpperCase().replace(/[^0-9K]/g, '');

  // 2. Limitar a 9 caracteres (8 dígitos + DV)
  cleaned = cleaned.substring(0, 9);

  if (cleaned.length < 2) return cleaned;

  // 3. Separar cuerpo y dígito verificador
  const body = cleaned.slice(0, -1);
  const dv   = cleaned.slice(-1);

  return `${body}-${dv}`;
}

/**
 * Normaliza un RUT chileno al formato de backend: "12345678-9".
 * Elimina puntos/espacios/símbolos, conserva K en mayúscula y agrega guión.
 */
export function normalizeChileanRUTForBackend(rawValue: string): string {
  const cleaned = rawValue.toUpperCase().replace(/[^0-9K]/g, '').substring(0, 9);
  if (cleaned.length < 2) return cleaned;
  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}
