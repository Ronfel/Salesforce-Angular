import { Injectable, signal } from '@angular/core';

/**
 * Mensagens e estado de carregamento compartilhados entre os componentes:
 * publicados pelas features e renderizados pelo shell (View central).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly errorMessage = signal('');

  success(message: string): void {
    this.errorMessage.set('');
    this.notice.set(message);
  }

  error(message: string): void {
    this.notice.set('');
    this.errorMessage.set(message);
  }

  clear(): void {
    this.notice.set('');
    this.errorMessage.set('');
  }
}
