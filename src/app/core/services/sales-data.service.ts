import { computed, inject, Injectable, signal } from '@angular/core';
import { Appointment, Client, Product, SalesOrder, SalesSnapshot } from '../models/sales.models';
import { SALES_REPOSITORY } from '../data/sales.repository';

@Injectable({ providedIn: 'root' })
export class SalesDataService {
  private readonly repository = inject(SALES_REPOSITORY);
  private readonly state = signal<SalesSnapshot>({
    clients: [],
    products: [],
    orders: [],
    appointments: [],
    lastSyncedAt: null,
  });

  readonly clients = computed(() => this.state().clients);
  readonly products = computed(() => this.state().products);
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
    await this.repository.saveOrder(order);
    this.state.update((snapshot) => ({
      ...snapshot,
      orders: [...snapshot.orders.filter((saved) => saved.id !== order.id), order],
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

  async synchronize(): Promise<void> {
    const updated = await this.repository.synchronize();
    this.state.set({ ...updated, lastSyncedAt: updated.lastSyncedAt ?? new Date().toISOString() });
  }

  productById(productId: string): Product | undefined {
    return this.state().products.find((product) => product.id === productId);
  }

}
