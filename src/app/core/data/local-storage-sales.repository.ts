import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DemoSyncAdapter } from './demo-sync.adapter';
import { SalesRepository } from './sales.repository';
import { SYNC_ADAPTER, SyncPullContext } from './sync.adapter';
import {
  ALL_DATA_UPLOADED,
  ALL_DATASETS_DOWNLOADED,
  Appointment,
  Client,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SellerSession,
  SESSION_STORAGE_KEY,
  SyncDownloadSelection,
  SyncOptions,
} from '../models/sales.models';

/** Prefixo da chave do workspace: o sufixo do vendedor é anexado para isolar os dados por usuário. */
const WORKSPACE_KEY_PREFIX = 'nexus-sales-workspace-v3';

/**
 * Armazenamento local do dispositivo (SQLite no app Android do documento).
 * Trabalha em modo offline (RNF005): os cadastros ficam marcados como
 * pendentes (`synced: false`) até que o usuário execute a sincronização
 * seletiva de download/upload (RF018).
 */
@Injectable()
export class LocalStorageSalesRepository implements SalesRepository {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly adapter = inject(SYNC_ADAPTER);
  private readonly demoAdapter = new DemoSyncAdapter();

  /**
   * Chave do workspace isolada por vendedor. Sem sessão (SSR / pré-login) usa o
   * prefixo puro; com sessão, anexa o sellerId para que cada usuário tenha seu
   * próprio espaço (evita que o login da Mariana enxergue os dados do Rodrigo).
   */
  private storageKey(): string {
    const sellerId = this.currentSellerId();
    return sellerId ? `${WORKSPACE_KEY_PREFIX}:${sellerId}` : WORKSPACE_KEY_PREFIX;
  }

  /** Lê o sellerId diretamente da sessão persistida (sem depender do AuthService). */
  private currentSellerId(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) {
        return null;
      }
      const session = JSON.parse(saved) as Partial<SellerSession>;
      return typeof session.sellerId === 'string' && session.sellerId ? session.sellerId : null;
    } catch {
      return null;
    }
  }

  async load(): Promise<SalesSnapshot> {
    if (!this.isBrowser) {
      return this.emptySnapshot();
    }

    const saved = localStorage.getItem(this.storageKey());
    if (!saved) {
      const initialData = this.emptySnapshot();
      this.write(initialData);
      return initialData;
    }

    try {
      return this.normalize(JSON.parse(saved) as SalesSnapshot);
    } catch (error) {
      throw new Error('Não foi possível ler os dados salvos neste navegador.', { cause: error });
    }
  }

  /** Workspace vazio: sem dados de demonstração, o conteúdo vem do servidor via sincronização. */
  private emptySnapshot(): SalesSnapshot {
    return {
      clients: [],
      products: [],
      priceTables: [],
      paymentConditions: [],
      orders: [],
      appointments: [],
      lastSyncedAt: null,
    };
  }

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    // Tenta o Web Service configurado (Firestore quando disponível) e cai para
    // a base de demonstração local quando houver bloqueio de permissão ou
    // Firestore indisponível — assim o login rodrigo/123456 sempre funciona.
    try {
      const seller = await this.adapter.authenticate(credentials);
      if (seller) {
        return seller;
      }
    } catch (error) {
      try {
        const demoSeller = await this.demoAdapter.authenticate(credentials);
        if (demoSeller) {
          return demoSeller;
        }
      } catch {
        // Ignora o erro do fallback e reporta o erro original abaixo.
      }
      throw new Error(normalizeDataSourceError(error), { cause: error });
    }

    return this.demoAdapter.authenticate(credentials);
  }

  async saveClient(client: Client): Promise<void> {
    const snapshot = await this.load();
    // Cadastro feito no dispositivo: sempre pendente de envio até o upload (RF018).
    const pending = { ...client, synced: false };
    snapshot.clients = [...snapshot.clients.filter((saved) => saved.id !== pending.id), pending];
    this.write(snapshot);
  }

  async deleteClient(clientId: string): Promise<void> {
    const snapshot = await this.load();
    snapshot.clients = snapshot.clients.filter((client) => client.id !== clientId);
    this.write(snapshot);
  }

  async saveOrder(order: SalesOrder): Promise<void> {
    const snapshot = await this.load();
    const pending = { ...order, synced: false };
    snapshot.orders = [...snapshot.orders.filter((saved) => saved.id !== pending.id), pending];
    this.write(snapshot);
  }

  async deleteOrder(orderId: string): Promise<void> {
    const snapshot = await this.load();
    snapshot.orders = snapshot.orders.filter((order) => order.id !== orderId);
    this.write(snapshot);
  }

  async saveAppointments(appointments: Appointment[]): Promise<void> {
    const snapshot = await this.load();
    snapshot.appointments = appointments;
    this.write(snapshot);
  }

  async synchronize(options?: SyncOptions & { sellerId?: string }): Promise<SalesSnapshot> {
    const snapshot = await this.load();
    const download = { ...ALL_DATASETS_DOWNLOADED, ...options?.download };
    const upload = { ...ALL_DATA_UPLOADED, ...options?.upload };

    const sellerId = options?.sellerId ?? null;

    const scheduledClientIds = snapshot.appointments
      .filter((appointment) => appointment.date === new Date().toISOString().slice(0, 10))
      .map((appointment) => appointment.clientId);

    const downloaded = await this.safePull(download, { sellerId, scheduledClientIds });

    // Download: o servidor prevalece para os registros já sincronizados;
    // os cadastros locais pendentes sempre são preservados (RF018/RNF005).
    if (downloaded.clients) {
      snapshot.clients = this.mergeServerAndPending(downloaded.clients, snapshot.clients);
    }
    if (downloaded.orders) {
      snapshot.orders = this.mergeServerAndPending(downloaded.orders, snapshot.orders);
    }
    if (downloaded.products) {
      snapshot.products = downloaded.products;
    }
    if (downloaded.priceTables) {
      snapshot.priceTables = downloaded.priceTables;
    }
    if (downloaded.paymentConditions) {
      snapshot.paymentConditions = downloaded.paymentConditions;
    }
    if (downloaded.appointments) {
      snapshot.appointments = downloaded.appointments;
    }

    // Upload: envia apenas os registros pendentes escolhidos pelo usuário (RF018).
    const pendingClients = upload.clients ? snapshot.clients.filter((client) => !client.synced) : [];
    const pendingOrders = upload.orders ? snapshot.orders.filter((order) => !order.synced) : [];

    if (pendingClients.length > 0 || pendingOrders.length > 0) {
      try {
        await this.adapter.push({ clients: pendingClients, orders: pendingOrders });
      } catch (error) {
        throw new Error(normalizeDataSourceError(error), { cause: error });
      }
      const uploadedClientIds = new Set(pendingClients.map((client) => client.id));
      const uploadedOrderIds = new Set(pendingOrders.map((order) => order.id));
      snapshot.clients = snapshot.clients.map((client) =>
        uploadedClientIds.has(client.id) ? { ...client, synced: true } : client,
      );
      snapshot.orders = snapshot.orders.map((order) =>
        uploadedOrderIds.has(order.id) ? { ...order, synced: true } : order,
      );
    }

    snapshot.lastSyncedAt = new Date().toISOString();
    this.write(snapshot);
    return snapshot;
  }

  /** Mantém os pendentes locais e deixa os dados do servidor vencerem por id. */
  private mergeServerAndPending<T extends { id: string; synced: boolean }>(
    fromServer: T[],
    local: T[],
  ): T[] {
    const serverIds = new Set(fromServer.map((record) => record.id));
    const pendingLocals = local.filter((record) => !record.synced && !serverIds.has(record.id));
    return [...fromServer, ...pendingLocals];
  }

  private async safePull(
    download: SyncDownloadSelection,
    context: SyncPullContext,
  ): Promise<Partial<SalesSnapshot>> {
    try {
      return await this.adapter.pull(download, context);
    } catch (error) {
      throw new Error(normalizeDataSourceError(error), { cause: error });
    }
  }

  private normalize(snapshot: SalesSnapshot): SalesSnapshot {
    const empty = this.emptySnapshot();
    return {
      ...empty,
      ...snapshot,
      priceTables: snapshot.priceTables ?? empty.priceTables,
      paymentConditions: snapshot.paymentConditions ?? empty.paymentConditions,
    };
  }

  private write(snapshot: SalesSnapshot): void {
    if (this.isBrowser) {
      localStorage.setItem(this.storageKey(), JSON.stringify(snapshot));
    }
  }
}

/**
 * Converte erros técnicos do Web Service (ex.: Firestore
 * "Missing or insufficient permissions") em mensagens compreensíveis na
 * tela de login/sincronização.
 */
export function normalizeDataSourceError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  ) {
    return (
      'O servidor recusou a leitura dos dados (permissão insuficiente no Firestore). ' +
      'Publique as regras de segurança do Firestore (veja firestore.rules) e cadastre o vendedor ' +
      'na coleção "sellers" com login e senha.'
    );
  }

  return message || 'Não foi possível acessar o Web Service. Tente novamente.';
}
