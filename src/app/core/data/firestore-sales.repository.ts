import type { Firestore } from 'firebase/firestore';
import { Appointment, Client, Product, SalesOrder, SalesSnapshot } from '../models/sales.models';
import { SalesRepository } from './sales.repository';

const loadFirestoreSdk = () => import('firebase/firestore');

export class FirestoreSalesRepository implements SalesRepository {
  constructor(private readonly databasePromise: Promise<Firestore | null>) {}

  async load(): Promise<SalesSnapshot> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    const [clients, products, orders, appointments] = await Promise.all([
      this.readCollection<Client>(database, sdk, 'clients'),
      this.readCollection<Product>(database, sdk, 'products'),
      this.readCollection<SalesOrder>(database, sdk, 'orders'),
      this.readCollection<Appointment>(database, sdk, 'appointments'),
    ]);

    return { clients, products, orders, appointments, lastSyncedAt: null };
  }

  async saveClient(client: Client): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    await sdk.setDoc(sdk.doc(database, 'clients', client.id), client);
  }

  async deleteClient(clientId: string): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    await sdk.deleteDoc(sdk.doc(database, 'clients', clientId));
  }

  async saveOrder(order: SalesOrder): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    await sdk.setDoc(sdk.doc(database, 'orders', order.id), order);
  }

  async deleteOrder(orderId: string): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    await sdk.deleteDoc(sdk.doc(database, 'orders', orderId));
  }

  async saveAppointments(appointments: Appointment[]): Promise<void> {
    const [database, sdk] = await Promise.all([this.getDatabase(), loadFirestoreSdk()]);
    await Promise.all(
      appointments.map((appointment) =>
        sdk.setDoc(sdk.doc(database, 'appointments', appointment.id), appointment),
      ),
    );
  }

  async synchronize(): Promise<SalesSnapshot> {
    return this.load();
  }

  private async readCollection<T extends { id: string }>(
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
