import type { Firestore } from 'firebase/firestore';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ConnectionService } from '../services/connection.service';
import {
  Appointment,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';
import { DemoSyncAdapter } from './demo-sync.adapter';
import { FirestoreSyncAdapter } from './firestore-sync.adapter';
import { HttpSyncAdapter } from './http-sync.adapter';
import { SyncAdapter, SyncPullContext } from './sync.adapter';

const isFirebaseConfigured = (): boolean =>
  Boolean(environment.firebase.apiKey && environment.firebase.projectId);

/**
 * Adapter-roteador — substitui o antigo `apiUrl` fixo.
 *
 * Em vez de gravar a URL de uma API no código, o app lê a **conexão ativa**
 * cadastrada em tela (ConnectionService) a cada chamada e fala com ela via
 * `HttpSyncAdapter`. Se nenhuma conexão estiver ativa, cai no Firestore
 * (quando configurado) ou na base de demonstração — exatamente o comportamento
 * anterior, então o login de demonstração e o fallback continuam funcionando.
 *
 * Trocar a API passa a ser uma ação de tela (cadastrar/ativar conexão), não uma
 * recompilação. Nenhuma outra parte do app muda: segue o contrato `SyncAdapter`.
 *
 * Instanciado manualmente em `sales.repository.providers.ts` (por isso não leva
 * `@Injectable`, igual aos outros adapters concretos).
 */
export class DynamicSyncAdapter implements SyncAdapter {
  constructor(
    private readonly http: HttpClient,
    private readonly connections: ConnectionService,
    private readonly firestore: Promise<Firestore | null>,
  ) {}

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    return this.resolve().authenticate(credentials);
  }

  async pull(
    selection: SyncDownloadSelection,
    context: SyncPullContext,
  ): Promise<Partial<SalesSnapshot>> {
    return this.resolve().pull(selection, context);
  }

  async push(pending: {
    clients: SalesSnapshot['clients'];
    orders: SalesOrder[];
    appointments: Appointment[];
  }): Promise<void> {
    return this.resolve().push(pending);
  }

  /**
   * Decide, no momento da chamada, qual adapter concreto usar:
   * conexão ativa (HTTP) → Firestore → demonstração.
   */
  private resolve(): SyncAdapter {
    const url = this.connections.activeUrl();
    if (url) {
      return new HttpSyncAdapter(this.http, url);
    }
    return isFirebaseConfigured()
      ? new FirestoreSyncAdapter(this.firestore)
      : new DemoSyncAdapter();
  }
}
