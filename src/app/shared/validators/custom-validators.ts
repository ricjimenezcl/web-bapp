import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores personalizados para formularios chilenos.
 * Lógica extraída y adaptada desde frontend-bapp.
 */
export class CustomValidators {

  /**
   * Valida un número de teléfono chileno (solo móviles con 9 inicial).
   * Acepta el valor con o sin formato (+56 9 XXXX XXXX) y también dígitos crudos.
   * No falla si el campo está vacío (usar Validators.required para ese caso).
   */
  static phone(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const cleaned = control.value.toString().replace(/\D/g, '');
      // Acepta: "9XXXXXXXX" (9 dígitos) o "569XXXXXXXX" (11 dígitos con código de país)
      return /^(56)?9\d{8}$/.test(cleaned) ? null : { invalidPhone: true };
    };
  }

  /**
   * Valida un RUT chileno con verificación del dígito verificador.
   * Acepta formatos: "12.345.678-9", "12345678-9", "123456789".
   * No falla si el campo está vacío (usar Validators.required para ese caso).
   */
  static rut(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) return null;
      const cleaned = control.value.toString().replace(/[^0-9K]/gi, '').toUpperCase();
      if (cleaned.length < 8) return { invalidRut: true };
      const body = cleaned.slice(0, -1);
      const dv   = cleaned.slice(-1);
      return dv === CustomValidators.calcRutDV(body) ? null : { invalidRut: true };
    };
  }

  /**
   * Calcula el dígito verificador del RUT chileno.
   * Algoritmo: módulo 11, multiplicadores 2-7 (ciclo correcto chileno).
   */
  private static calcRutDV(body: string): string {
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i], 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    const remainder = 11 - (sum % 11);
    if (remainder === 11) return '0';
    if (remainder === 10) return 'K';
    return remainder.toString();
  }
}
