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
  // 1. Quitar todo lo que no sea dígito
  let digits = rawValue.replace(/\D/g, '');

  // 2. Quitar prefijo 56 si ya viene con él (p.ej. al pegar "+56 9 1234 5678")
  if (digits.startsWith('56') && digits.length > 9) {
    digits = digits.substring(2);
  }

  // 3. Limitar a 9 dígitos locales
  digits = digits.substring(0, 9);

  if (digits.length === 0) return '';

  // 4. Solo aplicar el formato visual completo cuando el número está completo (9 dígitos).
  //    Si el usuario está borrando o aún escribiendo, devolver los dígitos sin formatear
  //    para que el cursor no salte y la edición funcione con normalidad.
  if (digits.length === 9) {
    return `+56 ${digits[0]} ${digits.substring(1, 5)} ${digits.substring(5)}`;
  }

  return digits;
}

/**
 * Formatea un RUT chileno al escribir en un input.
 *
 * Acepta: dígitos y K sueltos, con o sin puntos/guión.
 * Salida:  "12.345.678-9"  (solo cuando hay suficientes dígitos)
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

  // 4. Insertar puntos en el cuerpo cada 3 dígitos desde la derecha
  let bodyFormatted = '';
  const reversed = body.split('').reverse().join('');
  for (let i = 0; i < reversed.length; i++) {
    if (i > 0 && i % 3 === 0) bodyFormatted = '.' + bodyFormatted;
    bodyFormatted = reversed[i] + bodyFormatted;
  }

  return `${bodyFormatted}-${dv}`;
}
