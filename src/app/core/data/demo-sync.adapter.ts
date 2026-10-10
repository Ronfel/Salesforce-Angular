import {
  LoginCredentials,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';
import { createDemoSnapshot, DEMO_SELLERS } from './demo-data';
import { SyncAdapter, SyncPullContext } from './sync.adapter';

/**
 * Adaptador de demonstração: simula o Web Service do servidor da empresa
 * usando a base de dados de demonstração.
 */
export class DemoSyncAdapter implements SyncAdapter {
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
      downloaded.appointments = server.appointments;
    }
    if (selection.lastOrders) {
      // Últimos 5 pedidos do vendedor logado por cliente agendado (RNF004).
      downloaded.orders = this.lastOrdersOfSeller(server, context);
    }

    return downloaded;
  }

  async push(): Promise<void> {
    // Servidor simulado: os registros são considerados recebidos pelo repositório local.
  }

  private lastOrdersOfSeller(
    server: SalesSnapshot,
    context: SyncPullContext,
  ): SalesSnapshot['orders'] {
    const scheduled = new Set(context.scheduledClientIds);
    const byClient = new Map<string, SalesSnapshot['orders']>();

    for (const order of [...server.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (context.sellerId && order.sellerId && order.sellerId !== context.sellerId) {
        continue;
      }
      // Com agenda do dia disponível, restringe aos clientes agendados.
      if (scheduled.size > 0 && !scheduled.has(order.clientId)) {
        continue;
      }
      const orders = byClient.get(order.clientId) ?? [];
      if (orders.length < 5) {
        orders.push(order);
      }
      byClient.set(order.clientId, orders);
    }

    return [...byClient.values()].flat();
  }
}
