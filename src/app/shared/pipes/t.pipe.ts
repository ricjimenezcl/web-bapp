import { Pipe, PipeTransform, inject } from '@angular/core';
import { PlatformI18nService } from '../../core/services/platform-i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TPipe implements PipeTransform {
  private readonly i18n = inject(PlatformI18nService);

  transform(key: string): string {
    return this.i18n.t(key);
  }
}