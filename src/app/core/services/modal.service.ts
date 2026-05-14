import { Injectable, signal } from '@angular/core';

export type AppModalType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'prompt';

export interface AppModalState {
  open: boolean;
  type: AppModalType;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  showCancel: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  readonly state = signal<AppModalState>({
    open: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Aceptar',
    cancelText: 'Cancelar',
    showCancel: false,
    inputValue: '',
  });

  private resolver: ((value: unknown) => void) | null = null;

  info(message: string, title = 'Información'): Promise<void> {
    return this.open({ type: 'info', title, message, confirmText: 'Aceptar' }).then(() => undefined);
  }

  success(message: string, title = 'Éxito'): Promise<void> {
    return this.open({ type: 'success', title, message, confirmText: 'Aceptar' }).then(() => undefined);
  }

  warning(message: string, title = 'Atención'): Promise<void> {
    return this.open({ type: 'warning', title, message, confirmText: 'Entendido' }).then(() => undefined);
  }

  error(message: string, title = 'Error'): Promise<void> {
    return this.open({ type: 'error', title, message, confirmText: 'Cerrar' }).then(() => undefined);
  }

  confirm(message: string, title = 'Confirmación', confirmText = 'Confirmar', cancelText = 'Cancelar'): Promise<boolean> {
    return this.open({
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
    }).then(result => Boolean(result));
  }

  prompt(
    message: string,
    title = 'Ingresa un valor',
    options?: { inputLabel?: string; inputPlaceholder?: string; confirmText?: string; cancelText?: string }
  ): Promise<string | null> {
    return this.open({
      type: 'prompt',
      title,
      message,
      confirmText: options?.confirmText ?? 'Aceptar',
      cancelText: options?.cancelText ?? 'Cancelar',
      showCancel: true,
      inputLabel: options?.inputLabel,
      inputPlaceholder: options?.inputPlaceholder,
      inputValue: '',
    }).then(result => (typeof result === 'string' ? result : null));
  }

  setPromptValue(value: string): void {
    this.state.update(current => ({ ...current, inputValue: value }));
  }

  accept(): void {
    const current = this.state();
    const value = current.type === 'prompt' ? (current.inputValue ?? '').trim() : true;
    this.resolve(value);
  }

  cancel(): void {
    const current = this.state();
    this.resolve(current.type === 'confirm' ? false : null);
  }

  private open(partial: Partial<AppModalState>): Promise<unknown> {
    if (this.resolver) {
      this.resolve(null);
    }

    this.state.set({
      open: true,
      type: partial.type ?? 'info',
      title: partial.title ?? 'Información',
      message: partial.message ?? '',
      confirmText: partial.confirmText ?? 'Aceptar',
      cancelText: partial.cancelText ?? 'Cancelar',
      showCancel: partial.showCancel ?? false,
      inputLabel: partial.inputLabel,
      inputPlaceholder: partial.inputPlaceholder,
      inputValue: partial.inputValue ?? '',
    });

    return new Promise(resolve => {
      this.resolver = resolve;
    });
  }

  private resolve(value: unknown): void {
    if (this.resolver) {
      this.resolver(value);
      this.resolver = null;
    }

    this.state.update(current => ({
      ...current,
      open: false,
      inputValue: '',
    }));
  }
}
