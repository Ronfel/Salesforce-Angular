import type { Firestore } from 'firebase/firestore';
import {
  Appointment,
  Client,
  LoginCredentials,
  PaymentCondition,
  PriceTable,
  Product,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';
import { SyncAdapter, SyncPullContext } from './sync.adapter';

const loadFirestoreSdk = () => import('firebase/firestore');

/**
 * Adaptador que usa o Cloud Firestore como Web Service da empresa:
 * autentica vendedores e realiza o download/upload seletivo (RF018).
 */
export class FirestoreSyncAdapter implements SyncAdapter {
  constructor(private readonly databasePromise: Promise<Firestore | null>) {}

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    const sellers = await this.read<Seller>(database, sdk, 'sellers');
    const login = credentials.login.trim().toLowerCase();

    return (
      sellers.find(
        (seller) =>
          seller.login.toLowerCase() === login &&
          seller.senha === credentials.senha,
      ) ?? null
    );
  }

  async pull(
    selection: SyncDownloadSelection,
    context: SyncPullContext,
  ): Promise<Partial<SalesSnapshot>> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    const downloaded: Partial<SalesSnapshot> = {};

    const tasks: Promise<void>[] = [];
    if (selection.clients) {
      tasks.push(
        this.read<Client>(database, sdk, 'clients').then((value) => {
          downloaded.clients = value;
        }),
      );
    }
    if (selection.products) {
      tasks.push(
        this.read<Product>(database, sdk, 'products').then((value) => {
          downloaded.products = value;
        }),
      );
    }
    if (selection.priceTables) {
      tasks.push(
        this.read<PriceTable>(database, sdk, 'priceTables').then((value) => {
          downloaded.priceTables = value;
        }),
      );
    }
    if (selection.paymentConditions) {
      tasks.push(
        this.read<PaymentCondition>(database, sdk, 'paymentConditions').then((value) => {
          downloaded.paymentConditions = value;
        }),
      );
    }
    if (selection.appointments) {
      tasks.push(
        this.read<Appointment>(database, sdk, 'appointments').then((value) => {
          downloaded.appointments = value;
        }),
      );
    }
    if (selection.lastOrders) {
      tasks.push(
        this.read<SalesOrder>(database, sdk, 'orders').then((orders) => {
          // Download apenas dos pedidos do vendedor logado (últimos 5 por cliente agendado).
          downloaded.orders = this.lastOrdersOfSeller(orders, context);
        }),
      );
    }

    await Promise.all(tasks);
    return downloaded;
  }

  async push(pending: { clients: Client[]; orders: SalesOrder[] }): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    const tasks = [
      ...pending.clients.map((client) =>
        sdk.setDoc(sdk.doc(database, 'clients', client.id), { ...client, synced: true }),
      ),
      ...pending.orders.map((order) =>
        sdk.setDoc(sdk.doc(database, 'orders', order.id), { ...order, synced: true }),
      ),
    ];
    await Promise.all(tasks);
  }

  private lastOrdersOfSeller(
    orders: SalesOrder[],
    context: SyncPullContext,
  ): SalesOrder[] {
    const scheduled = new Set(context.scheduledClientIds);
    // Sem vendedor na sessão (ou sem agenda), retorna os pedidos do vendedor
    // sem o filtro de agenda — nunca mistura pedidos de outros vendedores.
    const byClient = new Map<string, SalesOrder[]>();

    for (const order of [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      // Pedidos antigos podem não ter sellerId: nesses casos, mantém o pedido
      // apenas quando não há vendedor em sessão (fallback da base demo).
      if (context.sellerId && order.sellerId && order.sellerId !== context.sellerId) {
        continue;
      }
      if (context.sellerId && !order.sellerId) {
        continue;
      }
      // Com agenda do dia disponível, restringe aos clientes agendados.
      if (scheduled.size > 0 && !scheduled.has(order.clientId)) {
        continue;
      }
      const clientOrders = byClient.get(order.clientId) ?? [];
      if (clientOrders.length < 5) {
        clientOrders.push(order);
      }
      byClient.set(order.clientId, clientOrders);
    }

    return [...byClient.values()].flat();
  }

  private async read<T extends { id: string }>(
    database: Firestore,
    sdk: typeof import('firebase/firestore'),
    name: string,
  ): Promise<T[]> {
    const documents = await sdk.getDocs(sdk.collection(database, name));
    return documents.docs.map((document) => ({ ...document.data(), id: document.id }) as T);
  }

  private async getDatabase(): Promise<Firestore> {
    const database = await this.databasePromise;
    if (!database) {
      throw new Error('O Firestore não está disponível neste ambiente.');
    }

    return database;
  }
}
