import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ALL_DATA_UPLOADED,
  ALL_DATASETS_DOWNLOADED,
  Appointment,
  Client,
  PaymentCondition,
  PriceTable,
  Product,
  SalesOrder,
  SalesSnapshot,
  SyncOptions,
} from '../models/sales.models';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SalesDataService {
  private readonly repository = inject(SALES_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly state = signal<SalesSnapshot>({
    clients: [],
    products: [],
    priceTables: [],
    paymentConditions: [],
    orders: [],
    appointments: [],
    lastSyncedAt: null,
  });

  readonly clients = computed(() => this.state().clients);
  readonly products = computed(() => this.state().products);
  readonly priceTables = computed(() => this.state().priceTables);
  readonly paymentConditions = computed(() => this.state().paymentConditions);
  readonly orders = computed(() =>
    [...this.state().orders].sort((first, second) => second.createdAt.localeCompare(first.createdAt)),
  );
  readonly appointments = computed(() =>
    [...this.state().appointments].sort((first, second) =>
      `${first.date} ${first.time}`.localeCompare(`${second.date} ${second.time}`),
    ),
  );
  readonly lastSyncedAt = computed(() => this.state().lastSyncedAt);
  readonly totalOrderValue = computed(() =>
    this.state().orders.reduce((total, order) => total + order.total, 0),
  );
  /** Cadastros locais ainda não submetidos ao servidor (RF004/RF005/RF008/RF009). */
  readonly pendingClientsCount = computed(
    () => this.state().clients.filter((client) => !client.synced).length,
  );
  readonly pendingOrdersCount = computed(
    () => this.state().orders.filter((order) => !order.synced).length,
  );

  async initialize(): Promise<void> {
    this.state.set(await this.repository.load());
  }

  async saveClient(client: Client): Promise<void> {
    await this.repository.saveClient(client);
    this.state.update((snapshot) => ({
      ...snapshot,
      clients: [...snapshot.clients.filter((saved) => saved.id !== client.id), client],
    }));
  }

  async deleteClient(clientId: string): Promise<void> {
    await this.repository.deleteClient(clientId);
    this.state.update((snapshot) => ({
      ...snapshot,
      clients: snapshot.clients.filter((client) => client.id !== clientId),
    }));
  }

  async saveOrder(order: SalesOrder): Promise<void> {
    // Vincula o pedido ao vendedor logado (id + nome da sessão).
    const session = this.auth.session();
    const orderWithSeller: SalesOrder = {
      ...order,
      sellerId: order.sellerId || session?.sellerId || session?.login || 'desconhecido',
      sellerName: order.sellerName || session?.nome || 'Vendedor',
    };
    await this.repository.saveOrder(orderWithSeller);
    this.state.update((snapshot) => ({
      ...snapshot,
      orders: [...snapshot.orders.filter((saved) => saved.id !== orderWithSeller.id), orderWithSeller],
    }));
  }

  async deleteOrder(orderId: string): Promise<void> {
    await this.repository.deleteOrder(orderId);
    this.state.update((snapshot) => ({
      ...snapshot,
      orders: snapshot.orders.filter((order) => order.id !== orderId),
    }));
  }

  async updateAppointments(appointments: Appointment[]): Promise<void> {
    await this.repository.saveAppointments(appointments);
    this.state.update((snapshot) => ({ ...snapshot, appointments }));
  }

  async synchronize(options?: SyncOptions): Promise<void> {
    // Repassa o vendedor logado para que o download de pedidos venha filtrado.
    const sellerId = options?.sellerId ?? this.auth.session()?.sellerId ?? null;
    const updated = await this.repository.synchronize({
      download: options?.download ?? ALL_DATASETS_DOWNLOADED,
      upload: options?.upload ?? ALL_DATA_UPLOADED,
      sellerId,
    });
    this.state.set({ ...updated, lastSyncedAt: updated.lastSyncedAt ?? new Date().toISOString() });
  }

  productById(productId: string): Product | undefined {
    return this.state().products.find((product) => product.id === productId);
  }

  clientById(clientId: string): Client | undefined {
    return this.state().clients.find((client) => client.id === clientId);
  }

  priceTableById(priceTableId: string): PriceTable | undefined {
    return this.state().priceTables.find((table) => table.id === priceTableId);
  }

  paymentConditionById(paymentConditionId: string): PaymentCondition | undefined {
    return this.state().paymentConditions.find((condition) => condition.id === paymentConditionId);
  }

  paymentConditionName(paymentConditionId: string): string {
    return this.paymentConditionById(paymentConditionId)?.name ?? '—';
  }

  /** Preço unitário do produto na tabela de preço do pedido (RF010/RF013). */
  unitPriceFor(product: Product, priceTableId: string): number {
    const discount = this.priceTableById(priceTableId)?.discountPercent ?? 0;
    return Math.round(product.price * (1 - discount / 100) * 100) / 100;
  }

  /** RF007/RNF004 - até 5 últimos pedidos de um cliente (base sincronizada). */
  lastOrdersForClient(clientId: string, limit = 5): SalesOrder[] {
    const sorted = this.state().orders
      .filter((order) => order.clientId === clientId)
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
    const synced = sorted.filter((order) => order.synced);
    return (synced.length > 0 ? synced : sorted).slice(0, limit);
  }

}
