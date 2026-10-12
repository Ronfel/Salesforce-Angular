import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConnectionService } from '../../core/services/connection.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Tela de Conexões de API (integração / Opção C).
 *
 * Substitui o antigo `apiUrl` fixo no código: aqui você cadastra, em runtime,
 * a URL de cada API canônica (a sua, um sandbox do Salesforce, a de um cliente)
 * e marca qual está **ativa**. O `DynamicSyncAdapter` lê a conexão ativa a cada
 * sincronização, então trocar de API é uma ação de tela — sem recompilar.
 */
@Component({
  selector: 'app-connections',
  styleUrl: './connections.component.scss',
  templateUrl: './connections.component.html',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
})
export class ConnectionsComponent {
  private readonly connections = inject(ConnectionService);
  private readonly notify = inject(NotificationService);

  /** Conexões cadastradas (fonte da verdade vinda do serviço). */
  readonly conexoes = this.connections.conexoes;

  /** Conexão atualmente ativa (ou null). */
  readonly ativa = this.connections.ativa;

  /** true quando há uma conexão ativa com URL. */
  readonly hasActive = this.connections.hasActive;

  /** Campos do formulário de nova conexão. */
  readonly nome = signal('');
  readonly url = signal('');

  /** Cadastra uma conexão e limpa o formulário. */
  adicionar(): void {
    const nome = this.nome().trim();
    const url = this.url().trim();
    if (!nome || !url) {
      this.notify.error('Informe um nome e a URL da API.');
      return;
    }
    this.connections.add(nome, url);
    this.nome.set('');
    this.url.set('');
    this.notify.success(`Conexão "${nome}" adicionada.`);
  }

  /** Marca uma conexão como ativa (desativa as demais). */
  ativar(id: string): void {
    this.connections.ativar(id);
    const nome = this.conexoes().find((c) => c.id === id)?.nome ?? '';
    this.notify.success(`Conexão "${nome}" ativada.`);
  }

  /** Remove uma conexão (com confirmação). */
  remover(id: string): void {
    const nome = this.conexoes().find((c) => c.id === id)?.nome ?? '';
    if (!window.confirm(`Remover a conexão "${nome}"?`)) {
      return;
    }
    this.connections.remove(id);
    this.notify.success(`Conexão "${nome}" removida.`);
  }
}
