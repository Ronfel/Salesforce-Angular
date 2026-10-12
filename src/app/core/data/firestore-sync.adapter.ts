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
import { sortOrdersByRecency } from '../utils/order.utils';
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
          // Todos os pedidos do vendedor logado, do mais recente ao mais antigo.
          downloaded.orders = this.ordersOfSeller(orders, context);
        }),
      );
    }

    await Promise.all(tasks);
    return downloaded;
  }

  async push(pending: {
    clients: Client[];
    orders: SalesOrder[];
    appointments: Appointment[];
  }): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    const tasks = [
      ...pending.clients.map((client) =>
        sdk.setDoc(sdk.doc(database, 'clients', client.id), { ...client, synced: true }),
      ),
      ...pending.orders.map((order) =>
        sdk.setDoc(sdk.doc(database, 'orders', order.id), { ...order, synced: true }),
      ),
      // Visita concluída: atualiza o status no servidor (sai da agenda ativa do ERP).
      ...pending.appointments.map((appointment) =>
        sdk.setDoc(sdk.doc(database, 'appointments', appointment.id), {
          ...appointment,
          synced: true,
        }),
      ),
    ];
    await Promise.all(tasks);
  }

  /** Pedidos do vendedor logado, ordenados do mais recente ao mais antigo (RF018). */
  private ordersOfSeller(orders: SalesOrder[], context: SyncPullContext): SalesOrder[] {
    // Sem vendedor logado não retorna pedidos: evita expor dados de outros
    // vendedores (o download deve respeitar sempre o sellerId da sessão).
    if (!context.sellerId) {
      return [];
    }
    return sortOrdersByRecency(orders.filter((order) => order.sellerId === context.sellerId));
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
