import { HttpClient } from '@angular/common/http';
import {
  Appointment,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';
import { SyncAdapter, SyncPullContext } from './sync.adapter';

/**
 * Payload de resposta do `POST /auth`. O `senha` não volta do servidor em
 * produção, por isso é opcional aqui (ver INTEGRACAO-ERP.md seção 4.1).
 */
interface AuthResponse {
  id: string;
  empresa: string;
  nome: string;
}

/**
 * Adaptador da API canônica (Opção C de INTEGRACAO-ERP.md).
 *
 * Fala com uma única "boca" HTTP no formato canônico (`SalesSnapshot`), sem
 * saber qual ERP está por trás — a tradução de cada ERP é responsabilidade do
 * servidor/tradutor. Implementa o mesmo contrato `SyncAdapter` do Firestore e
 * do Demo, então nenhuma tela muda.
 *
 * Só aponte este adapter se a API for pública (sem segredos) e com CORS
 * liberado. Para ERP com credencial, prefira o ingeridor no servidor (Opção B).
 *
 * Instanciado manualmente em `sales.repository.providers.ts` (por isso não leva
 * `@Injectable`, igual ao `FirestoreSyncAdapter`).
 */
export class HttpSyncAdapter implements SyncAdapter {
  /** Remove a barra final para o `${base}/auth` não virar `//auth`. */
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    apiBaseUrl: string,
  ) {
    this.baseUrl = apiBaseUrl.replace(/\/+$/, '');
  }

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    try {
      const response = await this.http
        .post<AuthResponse>(`${this.baseUrl}/auth`, credentials)
        .toPromise();
      // 200 vazio (improvável) é tratado como credencial inválida.
      return response ? this.toSeller(response, credentials) : null;
    } catch {
      // 401 (ou qualquer falha de rede) = login negado para o app.
      return null;
    }
  }

  async pull(
    selection: SyncDownloadSelection,
    context: SyncPullContext,
  ): Promise<Partial<SalesSnapshot>> {
    const response = await this.http
      .post<Partial<SalesSnapshot>>(`${this.baseUrl}/pull`, { selection, context })
      .toPromise();
    return response ?? {};
  }

  async push(pending: {
    clients: SalesSnapshot['clients'];
    orders: SalesOrder[];
    appointments: Appointment[];
  }): Promise<void> {
    // 204 (sem corpo): só aguardamos o sucesso para marcar `synced: true` local.
    await this.http.post<void>(`${this.baseUrl}/push`, pending).toPromise();
  }

  /**
   * Reconstrói o `Seller` a partir da resposta do `/auth`. O `senha` não é
   * devolvido pelo servidor; preenchemos vazio porque o `AuthService` só usa
   * `id`/`empresa`/`login`/`nome` (nunca `senha`).
   */
  private toSeller(response: AuthResponse, credentials: LoginCredentials): Seller {
    return {
      id: response.id,
      login: credentials.login,
      senha: '',
      empresa: response.empresa,
      nome: response.nome,
    };
  }
}
