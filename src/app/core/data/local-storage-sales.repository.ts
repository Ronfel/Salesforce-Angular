import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { createDemoSnapshot } from './demo-data';
import { SalesRepository } from './sales.repository';
import { Appointment, Client, SalesOrder, SalesSnapshot } from '../models/sales.models';

const STORAGE_KEY = 'nexus-sales-workspace-v1';

@Injectable()
export class LocalStorageSalesRepository implements SalesRepository {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

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
      return JSON.parse(saved) as SalesSnapshot;
    } catch (error) {
      throw new Error('Não foi possível ler os dados salvos neste navegador.', { cause: error });
    }
  }

  async saveClient(client: Client): Promise<void> {
    const snapshot = await this.load();
    snapshot.clients = [...snapshot.clients.filter((saved) => saved.id !== client.id), client];
    this.write(snapshot);
  }

  async deleteClient(clientId: string): Promise<void> {
    const snapshot = await this.load();
    snapshot.clients = snapshot.clients.filter((client) => client.id !== clientId);
    this.write(snapshot);
  }

  async saveOrder(order: SalesOrder): Promise<void> {
    const snapshot = await this.load();
    snapshot.orders = [...snapshot.orders.filter((saved) => saved.id !== order.id), order];
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

  async synchronize(): Promise<SalesSnapshot> {
    const snapshot = await this.load();
    snapshot.lastSyncedAt = new Date().toISOString();
    this.write(snapshot);
    return snapshot;
  }

  private write(snapshot: SalesSnapshot): void {
    if (this.isBrowser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
  }
}
