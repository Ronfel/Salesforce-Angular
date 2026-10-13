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
import { normalizeDataSourceError } from '../utils/error.utils';
import { compareOrdersByRecency } from '../utils/order.utils';

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
   * Chave do workspace isolada por empresa + vendedor. Com sessão multiempresa
   * (Fase 1), anexa `empresaId:sellerId`; em sessão legada (sem empresaId),
   * mantém apenas o sellerId — os dados locais antigos continuam acessíveis.
   * Sem sessão (SSR / pré-login) usa o prefixo puro.
   */
  private storageKey(): string {
    const sellerId = this.currentSellerId();
    const empresaId = this.currentEmpresaId();
    if (sellerId && empresaId) {
      return `${WORKSPACE_KEY_PREFIX}:${empresaId}:${sellerId}`;
    }
    if (sellerId) {
      return `${WORKSPACE_KEY_PREFIX}:${sellerId}`;
    }
    return WORKSPACE_KEY_PREFIX;
  }

  /** Lê a sessão persistida de uma vez (sem depender do AuthService). */
  private currentSession(): Partial<SellerSession> | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) {
        return null;
      }
      const session = JSON.parse(saved) as Partial<SellerSession>;
      return session;
    } catch {
      return null;
    }
  }

  /** Lê o sellerId diretamente da sessão persistida (sem depender do AuthService). */
  private currentSellerId(): string | null {
    const sellerId = this.currentSession()?.sellerId;
    return typeof sellerId === 'string' && sellerId ? sellerId : null;
  }

  /** Lê o empresaId da sessão multiempresa (null em sessão legada). */
  private currentEmpresaId(): string | null {
    const empresaId = this.currentSession()?.empresaId;
    return typeof empresaId === 'string' && empresaId ? empresaId : null;
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

    // 1) Upload primeiro (RF018/RNF005): envia os cadastros pendentes escolhidos
    //    ao servidor ANTES de baixar. Assim, ao substituir a lista local de
    //    pedidos pelos dados do servidor, nada do que foi criado offline é
    //    perdido (os pendentes voltam já sincronizados no download).
    const pendingClients = upload.clients ? snapshot.clients.filter((client) => !client.synced) : [];
    const pendingOrders = upload.orders ? snapshot.orders.filter((order) => !order.synced) : [];
    // Visitas concluídas no dispositivo: status "Concluída" ainda não no servidor.
    const pendingAppointments = upload.appointments
      ? snapshot.appointments.filter((appointment) => !appointment.synced)
      : [];

    if (
      pendingClients.length > 0 ||
      pendingOrders.length > 0 ||
      pendingAppointments.length > 0
    ) {
      try {
        await this.adapter.push({
          clients: pendingClients,
          orders: pendingOrders,
          appointments: pendingAppointments,
        });
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
      // Visita concluída e enviada sai da agenda local: o servidor guarda o
      // status "Concluída" como histórico e ela deixa de aparecer na lista.
      const uploadedAppointmentIds = new Set(
        pendingAppointments.map((appointment) => appointment.id),
      );
      snapshot.appointments = snapshot.appointments.filter(
        (appointment) => !uploadedAppointmentIds.has(appointment.id),
      );
    }

    // 2) Download (RF018): o servidor é a fonte da verdade dos pedidos.
    const downloaded = await this.safePull(download, { sellerId, scheduledClientIds: [] });

    // Clientes: o servidor prevalece e os pendentes locais órfãos são preservados.
    if (downloaded.clients) {
      snapshot.clients = this.mergeServerAndPending(downloaded.clients, snapshot.clients);
    }
    if (downloaded.orders) {
      // Pedidos: como os pendentes já foram enviados acima, substitui a lista
      // local por TODOS os pedidos do vendedor (limpa o que não existe mais no
      // servidor). Se o upload de pedidos não foi selecionado, preserva os
      // pendentes locais para não perdê-los.
      snapshot.orders = upload.orders
        ? [...downloaded.orders]
        : this.mergeServerAndPending(downloaded.orders, snapshot.orders);
      // Mais recente primeiro (data do pedido e, no empate, o id).
      snapshot.orders.sort(compareOrdersByRecency);
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
      // Visitas concluídas ficam como histórico no servidor, mas saem da agenda.
      const activeFromServer = this.normalizeAppointments(downloaded.appointments).filter(
        (appointment) => appointment.status !== 'Concluída',
      );
      if (upload.appointments) {
        // As conclusões locais já foram enviadas acima: a agenda passa a ser a
        // do servidor (o servidor vence por id).
        snapshot.appointments = activeFromServer;
      } else {
        // Upload não selecionado: preserva as conclusões locais pendentes,
        // fazendo-as prevalecer sobre a cópia ainda "Agendada" do servidor.
        const pendingLocal = snapshot.appointments.filter(
          (appointment) => !appointment.synced,
        );
        const pendingIds = new Set(pendingLocal.map((appointment) => appointment.id));
        snapshot.appointments = [
          ...activeFromServer.filter((appointment) => !pendingIds.has(appointment.id)),
          ...pendingLocal,
        ];
      }
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
      appointments: this.normalizeAppointments(snapshot.appointments ?? empty.appointments),
    };
  }

  /**
   * Visitas gravadas antes da sincronização da agenda (ou baixadas de
   * documentos do servidor) podem não ter `synced`; nesses casos assume o
   * registro como vindo do servidor (sincronizado).
   */
  private normalizeAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.map((appointment) =>
      typeof appointment.synced === 'boolean' ? appointment : { ...appointment, synced: true },
    );
  }

  private write(snapshot: SalesSnapshot): void {
    if (this.isBrowser) {
      localStorage.setItem(this.storageKey(), JSON.stringify(snapshot));
    }
  }
}

