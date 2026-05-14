import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../../core/services/modal.service';

@Component({
  selector: 'app-global-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-modal.component.html',
  styleUrl: './global-modal.component.scss',
})
export class GlobalModalComponent {
  readonly modal = inject(ModalService);

  onBackdropClick(): void {
    const state = this.modal.state();
    if (state.showCancel) {
      this.modal.cancel();
    } else {
      this.modal.accept();
    }
  }
}
