import { Component, Input, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
      @if (iconName) {
        <ion-icon [name]="iconName" class="text-6xl text-slate-400 mb-4"></ion-icon>
      } @else if (icon) {
        <div class="text-5xl mb-4">{{ icon }}</div>
      }
      <h3 class="text-base font-semibold text-slate-700">{{ title }}</h3>
      @if (description) {
        <p class="text-sm text-slate-500 mt-1 max-w-xs">{{ description }}</p>
      }
      <ng-content></ng-content>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() icon = '';
  @Input() iconName = ''; // Ion-icon name (preferred over emoji)
  @Input() title = 'Sin resultados';
  @Input() description = '';
}
