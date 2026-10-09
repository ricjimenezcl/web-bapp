/**
 * El backend serializa fechas de activación/vencimiento con `datetime.utcnow()`
 * (naive, sin sufijo de zona horaria). Un string ISO sin 'Z'/offset es
 * interpretado por `Date` como hora LOCAL del navegador, no UTC, lo que
 * desfasa los cálculos de "días restantes" y las fechas mostradas en varias
 * horas (según el huso horario del usuario). Esta función fuerza la
 * interpretación correcta como UTC antes de construir el `Date`.
 */
export function parseUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}
