import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import {
  ALL_DATA_UPLOADED,
  ALL_DATASETS_DOWNLOADED,
  SyncDownloadSelection,
  SyncUploadSelection,
} from '../../core/models/sales.models';
import { NotificationService } from '../../core/services/notification.service';
import { SalesDataService } from '../../core/services/sales-data.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Tela de Sincronização (RF018): download e upload seletivos escolhidos
 * pelo usuário, com resumo dos dados do workspace.
 */
@Component({
  selector: 'app-sync',
  styleUrl: './sync.component.scss',
  templateUrl: './sync.component.html',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatCheckboxModule, MatIconModule],
})
export class SyncComponent {
  private readonly router = inject(Router);
  readonly sales = inject(SalesDataService);
  readonly notify = inject(NotificationService);
  private readonly auth = inject(AuthService);

  readonly busy = this.notify.busy;
  readonly isFirebaseConfigured = Boolean(
    environment.firebase.apiKey && environment.firebase.projectId,
  );

  readonly syncDownload = signal<SyncDownloadSelection>({ ...ALL_DATASETS_DOWNLOADED });
  readonly syncUpload = signal<SyncUploadSelection>({ ...ALL_DATA_UPLOADED });

  /** "Entendi" do card de setup volta para a Visão Geral. */
  goToOverview(): void {
    void this.router.navigate(['/overview']);
  }

  setDownloadOption(key: keyof SyncDownloadSelection, checked: boolean): void {
    this.syncDownload.update((selection) => ({ ...selection, [key]: checked }));
  }

  setUploadOption(key: keyof SyncUploadSelection, checked: boolean): void {
    this.syncUpload.update((selection) => ({ ...selection, [key]: checked }));
  }

  /** Executa exatamente o que o usuário marcou na tela de sincronização. */
  async synchronizeSelected(): Promise<void> {
    const download = this.syncDownload();
    const upload = this.syncUpload();
    if (!Object.values(download).some(Boolean) && !Object.values(upload).some(Boolean)) {
      this.notify.error('Selecione ao menos uma opção de download ou upload.');
      return;
    }

    this.busy.set(true);
    this.notify.clear();
    try {
      const pendingClients = this.sales.pendingClientsCount();
      const pendingOrders = this.sales.pendingOrdersCount();
      await this.sales.synchronize({ download, upload, sellerId: this.auth.session()?.sellerId ?? null });
      this.notify.success(
        `Sincronização concluída: download de ${Object.values(download).filter(Boolean).length} conjunto(s)` +
          ` e upload de ${Object.values(upload).filter(Boolean).length} conjunto(s)` +
          ` (${pendingClients} cliente(s) e ${pendingOrders} pedido(s) pendentes).`,
      );
    } catch (error) {
      this.notify.error(this.errorText(error, 'A sincronização não foi concluída.'));
    } finally {
      this.busy.set(false);
    }
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
