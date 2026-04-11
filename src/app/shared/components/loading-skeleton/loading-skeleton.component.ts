import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3">
      @for (item of items; track $index) {
        <div class="card card-body">
          <div class="flex items-center gap-3">
            @if (showAvatar) { <div class="skeleton w-12 h-12 rounded-full shrink-0"></div> }
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-3/4 rounded"></div>
              <div class="skeleton h-3 w-1/2 rounded"></div>
              @if (lines === 3) { <div class="skeleton h-3 w-2/3 rounded"></div> }
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class LoadingSkeletonComponent {
  @Input() count   = 3;
  @Input() lines   = 2;
  @Input() showAvatar = true;
  get items() { return Array(this.count); }
}
