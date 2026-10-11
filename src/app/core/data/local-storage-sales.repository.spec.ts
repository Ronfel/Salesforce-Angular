import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalStorageSalesRepository } from './local-storage-sales.repository';
import { SALES_REPOSITORY } from './sales.repository';
import { SYNC_ADAPTER } from './sync.adapter';
import { SalesOrder, SalesSnapshot, Seller, SyncDownloadSelection } from '../models/sales.models';
import { AuthService } from '../services/auth.service';
import { SalesDataService } from '../services/sales-data.service';

const WORKSPACE_KEY = 'nexus-sales-workspace-v3';

const ONLY_LAST_ORDERS: SyncDownloadSelection = {
  clients: false,
  appointments: false,
  lastOrders: true,
  priceTables: false,
  paymentConditions: false,
  products: false,
};

function makeOrder(id: string, createdAt: string, sellerId = 'seller-1', synced = true): SalesOrder {
  return {
    id,
    clientId: 'client-1',
    clientName: 'Cliente Teste',
    sellerId,
    sellerName: 'Vendedor',
    priceTableId: 'pt-normal',
    paymentConditionId: 'pc-28',
    createdAt,
    items: [],
    status: 'Pendente',
    total: 10,
    synced,
  };
}

function emptySnapshot(orders: SalesOrder[] = []): SalesSnapshot {
  return {
    clients: [],
    products: [],
    priceTables: [],
    paymentConditions: [],
    orders,
    appointments: [],
    lastSyncedAt: null,
  };
}

/**
 * Repositório local-first: verifica que, ao sincronizar pedidos, a lista local
 * é substituída por todos os pedidos do vendedor no servidor (ordenados do mais
 * recente), sem perder os pendentes offline (enviados antes do download).
 */
describe('LocalStorageSalesRepository - sincronização de pedidos (RF018)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /** Adapter stateful: o push alimenta o "servidor" que o pull lê (como no Firestore). */
  function configure(serverOrders: SalesOrder[]) {
    const store = [...serverOrders];
    const adapter = {
      authenticate: async () => null,
      pull: async (selection: SyncDownloadSelection, context: { sellerId: string | null }) => {
        const result: Partial<SalesSnapshot> = {};
        if (selection.lastOrders) {
          result.orders = store.filter((order) => !context.sellerId || order.sellerId === context.sellerId);
        }
        return result;
      },
      push: async (pending: { clients: unknown[]; orders: SalesOrder[] }) => {
        pending.orders.forEach((order) => {
          const index = store.findIndex((saved) => saved.id === order.id);
          const synced = { ...order, synced: true };
          if (index >= 0) {
            store[index] = synced;
          } else {
            store.push(synced);
          }
        });
      },
    };

    TestBed.configureTestingModule({
      providers: [
        LocalStorageSalesRepository,
        { provide: SYNC_ADAPTER, useValue: adapter },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    return store;
  }

  it('substitui os pedidos locais por todos os do vendedor e remove os obsoletos', async () => {
    configure([makeOrder('SRV-A', '2026-01-01T00:00:00.000Z'), makeOrder('SRV-B', '2026-05-01T00:00:00.000Z')]);

    // Local: um pedido já sincronizado que NÃO existe mais no servidor.
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(emptySnapshot([makeOrder('OLD', '2026-02-01T00:00:00.000Z')])));

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_LAST_ORDERS,
      upload: { clients: false, orders: true },
      sellerId: 'seller-1',
    });

    const ids = result.orders.map((order) => order.id);
    expect(ids).toContain('SRV-A');
    expect(ids).toContain('SRV-B');
    expect(ids).not.toContain('OLD'); // obsoleto local foi limpo
    // Ordenado do mais recente (maio) para o mais antigo (janeiro).
    expect(result.orders[0].id).toBe('SRV-B');
  });

  it('preserva pedidos pendentes offline enviando-os antes do download', async () => {
    configure([makeOrder('SRV-A', '2026-01-01T00:00:00.000Z')]);

    // Local: um pedido pendente (ainda não sincronizado) mais recente que o do servidor.
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify(emptySnapshot([makeOrder('LOCAL-1', '2026-06-01T00:00:00.000Z', 'seller-1', false)])),
    );

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_LAST_ORDERS,
      upload: { clients: false, orders: true },
      sellerId: 'seller-1',
    });

    const ids = result.orders.map((order) => order.id);
    expect(ids).toContain('SRV-A');
    expect(ids).toContain('LOCAL-1'); // não foi perdido
    expect(result.orders.find((order) => order.id === 'LOCAL-1')?.synced).toBe(true);
    // LOCAL-1 (junho) é o mais recente, então vem primeiro.
    expect(result.orders[0].id).toBe('LOCAL-1');
  });

  it('desempata pedidos com a mesma data usando o id do pedido', async () => {
    // Três pedidos do servidor com exatamente a mesma data/hora.
    const sameDate = '2026-04-10T00:00:00.000Z';
    configure([
      makeOrder('SRV-B', sameDate),
      makeOrder('SRV-A', sameDate),
      makeOrder('SRV-C', sameDate),
    ]);

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_LAST_ORDERS,
      upload: { clients: false, orders: true },
      sellerId: 'seller-1',
    });

    // Com a data empatada, o id do pedido define a ordem (decrescente).
    expect(result.orders.map((order) => order.id)).toEqual(['SRV-C', 'SRV-B', 'SRV-A']);
  });

  it('propaga o sellerId da sessão (AuthService → SalesDataService → adapter) e filtra os pedidos', async () => {
    const allOrders = [
      makeOrder('S1-A', '2026-01-01T00:00:00.000Z', 'seller-1'),
      makeOrder('S2-A', '2026-02-01T00:00:00.000Z', 'seller-2'),
    ];
    let receivedSellerId: string | null | undefined = 'NOT_CALLED';
    const seller: Seller = {
      id: 'seller-1',
      login: 'rodrigo',
      senha: '123456',
      empresa: 'NOVA',
      nome: 'Rodrigo Neves',
    };
    const adapter = {
      authenticate: async () => seller,
      pull: async (selection: SyncDownloadSelection, context: { sellerId: string | null }) => {
        receivedSellerId = context.sellerId;
        return selection.lastOrders
          ? { orders: allOrders.filter((order) => !context.sellerId || order.sellerId === context.sellerId) }
          : {};
      },
      push: async () => {},
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        SalesDataService,
        LocalStorageSalesRepository,
        { provide: SALES_REPOSITORY, useExisting: LocalStorageSalesRepository },
        { provide: SYNC_ADAPTER, useValue: adapter },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    const sales = TestBed.inject(SalesDataService);
    await sales.synchronize({ download: ONLY_LAST_ORDERS, upload: { clients: false, orders: true } });

    // O sellerId da sessão deve chegar ao adapter...
    expect(receivedSellerId).toBe('seller-1');
    // ...e somente os pedidos do vendedor logado devem ficar no estado.
    const ids = sales.orders().map((order) => order.id);
    expect(ids).toContain('S1-A');
    expect(ids).not.toContain('S2-A');
  });
});
