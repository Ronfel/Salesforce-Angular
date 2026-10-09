import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { createDemoSnapshot } from './demo-data';
import { SalesRepository } from './sales.repository';
import { SYNC_ADAPTER } from './sync.adapter';
import {
  ALL_DATA_UPLOADED,
  ALL_DATASETS_DOWNLOADED,
  Appointment,
  Client,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncOptions,
} from '../models/sales.models';

const STORAGE_KEY = 'nexus-sales-workspace-v1';

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

  async load(): Promise<SalesSnapshot> {
    if (!this.isBrowser) {
      return createDemoSnapshot();
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      const initialData = createDemoSnapshot();
      this.write(initialData);
      return initialData;
    }

    try {
      return this.normalize(JSON.parse(saved) as SalesSnapshot);
    } catch (error) {
      throw new Error('Não foi possível ler os dados salvos neste navegador.', { cause: error });
    }
  }

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    return this.adapter.authenticate(credentials);
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

  async synchronize(options?: SyncOptions): Promise<SalesSnapshot> {
    const snapshot = await this.load();
    const download = { ...ALL_DATASETS_DOWNLOADED, ...options?.download };
    const upload = { ...ALL_DATA_UPLOADED, ...options?.upload };

    const scheduledClientIds = snapshot.appointments
      .filter((appointment) => appointment.date === new Date().toISOString().slice(0, 10))
      .map((appointment) => appointment.clientId);

    const downloaded = await this.adapter.pull(download, { scheduledClientIds });

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
      await this.adapter.push({ clients: pendingClients, orders: pendingOrders });
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

  private normalize(snapshot: SalesSnapshot): SalesSnapshot {
    const fallback = createDemoSnapshot();
    return {
      ...fallback,
      ...snapshot,
      priceTables: snapshot.priceTables?.length ? snapshot.priceTables : fallback.priceTables,
      paymentConditions: snapshot.paymentConditions?.length
        ? snapshot.paymentConditions
        : fallback.paymentConditions,
    };
  }

  private write(snapshot: SalesSnapshot): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }
}
