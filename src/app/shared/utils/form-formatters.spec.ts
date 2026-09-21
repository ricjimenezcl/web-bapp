import { formatChileanPhone, normalizeChileanPhoneForBackend } from './form-formatters';
import { CustomValidators } from '../validators/custom-validators';

describe('formatChileanPhone', () => {
  it('debe dejar fijo el prefijo +56 9 y limitar a 8 dígitos finales', () => {
    expect(formatChileanPhone('+56 9 1234 5678')).toBe('+56 9 1234 5678');
    expect(formatChileanPhone('56912345678')).toBe('+56 9 1234 5678');
    expect(formatChileanPhone('12345678')).toBe('+56 9 1234 5678');
    expect(formatChileanPhone('123456789')).toBe('+56 9 1234 5678');
  });

  it('debe normalizar el teléfono al formato internacional +569...', () => {
    expect(formatChileanPhone('+56 9 1234 5678')).toBe('+56 9 1234 5678');
    expect(normalizeChileanPhoneForBackend('+56 9 1234 5678')).toBe('+56912345678');
    expect(normalizeChileanPhoneForBackend('56912345678')).toBe('+56912345678');
    expect(normalizeChileanPhoneForBackend('981234567')).toBe('+56981234567');
  });

  it('debe validar el formato con +56 9 más 8 dígitos', () => {
    const control = { value: '+56 9 1234 5678' } as any;
    expect(CustomValidators.phone()(control)).toBeNull();

    const invalid = { value: '+56 9 123 4567' } as any;
    expect(CustomValidators.phone()(invalid)).toEqual({ invalidPhone: true });
  });
});
