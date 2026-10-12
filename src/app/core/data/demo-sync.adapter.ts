import {
  Appointment,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';
import { createDemoSnapshot, DEMO_SELLERS } from './demo-data';
import { sortOrdersByRecency } from '../utils/order.utils';
import { SyncAdapter, SyncPullContext } from './sync.adapter';

/**
 * Adaptador de demonstração: simula o Web Service do servidor da empresa
 * usando a base de dados de demonstração.
 */
export class DemoSyncAdapter implements SyncAdapter {
  /**
   * Visitas concluídas enviadas pelo dispositivo: o "servidor" simulado as
   * devolve já com status "Concluída" no próximo pull (como faz o Firestore
   * depois do upload), permitindo que saiam da agenda local.
   */
  private readonly pushedAppointments = new Map<string, Appointment>();

  async authenticate(credentials: LoginCredentials): Promise<Seller | null> {
    const login = credentials.login.trim().toLowerCase();

    return (
      DEMO_SELLERS.find(
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
    const server = createDemoSnapshot();
    const downloaded: Partial<SalesSnapshot> = {};

    if (selection.clients) {
      downloaded.clients = server.clients;
    }
    if (selection.products) {
      downloaded.products = server.products;
    }
    if (selection.priceTables) {
      downloaded.priceTables = server.priceTables;
    }
    if (selection.paymentConditions) {
      downloaded.paymentConditions = server.paymentConditions;
    }
    if (selection.appointments) {
      downloaded.appointments = server.appointments.map(
        (appointment) => this.pushedAppointments.get(appointment.id) ?? appointment,
      );
    }
    if (selection.lastOrders) {
      // Todos os pedidos do vendedor logado, do mais recente ao mais antigo.
      downloaded.orders = this.ordersOfSeller(server.orders, context);
    }

    return downloaded;
  }

  async push(pending: {
    clients: SalesSnapshot['clients'];
    orders: SalesOrder[];
    appointments: Appointment[];
  }): Promise<void> {
    // Servidor simulado: pedidos/clientes são considerados recebidos pelo
    // repositório local; as visitas concluídas ficam registradas para o pull.
    for (const appointment of pending.appointments) {
      this.pushedAppointments.set(appointment.id, { ...appointment, synced: true });
    }
  }

  /** Pedidos do vendedor logado, ordenados do mais recente ao mais antigo (RF018). */
  private ordersOfSeller(orders: SalesOrder[], context: SyncPullContext): SalesOrder[] {
    // Sem vendedor logado não retorna pedidos: evita expor dados de outros vendedores.
    if (!context.sellerId) {
      return [];
    }
    return sortOrdersByRecency(orders.filter((order) => order.sellerId === context.sellerId));
  }
}
