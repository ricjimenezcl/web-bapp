import { trigger, transition, style, query, animate, group } from '@angular/animations';

/**
 * Animación de fade para transiciones de ruta
 * IMPORTANTE: NO usar pointerEvents en las queries — en iOS Safari las animaciones
 * pueden ser pausadas por gestos táctiles, dejando el host del componente con
 * pointer-events:none indefinidamente (root cause de clicks que no funcionan en móvil).
 */
export const fadeAnimation = trigger('fadeAnimation', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0 })
    ], { optional: true }),

    query(':leave', [
      animate('150ms ease-out', style({ opacity: 0 }))
    ], { optional: true }),

    query(':enter', [
      animate('200ms 50ms ease-in', style({ opacity: 1 }))
    ], { optional: true })
  ])
]);

/**
 * Animación de slide para navegación principal
 * Útil para navigation stacks (forward/back)
 */
export const slideAnimation = trigger('slideAnimation', [
  transition('* => *', [
    query(':enter, :leave', [
      style({
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        opacity: 1
      })
    ], { optional: true }),
    
    group([
      query(':leave', [
        animate('200ms ease-out', style({
          opacity: 0,
          transform: 'translateX(-5%)'
        }))
      ], { optional: true }),
      
      query(':enter', [
        style({
          opacity: 0,
          transform: 'translateX(5%)'
        }),
        animate('250ms 50ms ease-out', style({
          opacity: 1,
          transform: 'translateX(0)'
        }))
      ], { optional: true })
    ])
  ])
]);
