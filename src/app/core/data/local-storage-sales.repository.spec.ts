import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalStorageSalesRepository } from './local-storage-sales.repository';
import { SALES_REPOSITORY } from './sales.repository';
import { SYNC_ADAPTER } from './sync.adapter';
import { SalesOrder, SalesSnapshot, Seller, Appointment, SyncDownloadSelection } from '../models/sales.models';
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

const ONLY_APPOINTMENTS: SyncDownloadSelection = {
  clients: false,
  appointments: true,
  lastOrders: false,
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

function makeAppointment(
  id: string,
  status: 'Agendada' | 'Concluída' = 'Agendada',
  synced = true,
): Appointment {
  return {
    id,
    clientId: 'client-1',
    clientName: 'Cliente Teste',
    date: '2026-06-10',
    time: '09:00',
    address: 'Rua Teste, 1',
    status,
    synced,
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
  function configure(serverOrders: SalesOrder[], serverAppointments: Appointment[] = []) {
    const store = [...serverOrders];
    const appointmentStore = [...serverAppointments];
    const adapter = {
      authenticate: async () => null,
      pull: async (selection: SyncDownloadSelection, context: { sellerId: string | null }) => {
        const result: Partial<SalesSnapshot> = {};
        if (selection.lastOrders) {
          result.orders = store.filter((order) => !context.sellerId || order.sellerId === context.sellerId);
        }
        if (selection.appointments) {
          result.appointments = [...appointmentStore];
        }
        return result;
      },
      push: async (pending: {
        clients: unknown[];
        orders: SalesOrder[];
        appointments: Appointment[];
      }) => {
        pending.orders.forEach((order) => {
          const index = store.findIndex((saved) => saved.id === order.id);
          const synced = { ...order, synced: true };
          if (index >= 0) {
            store[index] = synced;
          } else {
            store.push(synced);
          }
        });
        (pending.appointments ?? []).forEach((appointment) => {
          const synced = { ...appointment, synced: true };
          const index = appointmentStore.findIndex((saved) => saved.id === appointment.id);
          if (index >= 0) {
            appointmentStore[index] = synced;
          } else {
            appointmentStore.push(synced);
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

    return { orders: store, appointments: appointmentStore };
  }

  it('substitui os pedidos locais por todos os do vendedor e remove os obsoletos', async () => {
    configure([makeOrder('SRV-A', '2026-01-01T00:00:00.000Z'), makeOrder('SRV-B', '2026-05-01T00:00:00.000Z')]);

    // Local: um pedido já sincronizado que NÃO existe mais no servidor.
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(emptySnapshot([makeOrder('OLD', '2026-02-01T00:00:00.000Z')])));

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_LAST_ORDERS,
      upload: { clients: false, orders: true, appointments: false },
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
      upload: { clients: false, orders: true, appointments: false },
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
      upload: { clients: false, orders: true, appointments: false },
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
    await sales.synchronize({ download: ONLY_LAST_ORDERS, upload: { clients: false, orders: true, appointments: false } });

    // O sellerId da sessão deve chegar ao adapter...
    expect(receivedSellerId).toBe('seller-1');
    // ...e somente os pedidos do vendedor logado devem ficar no estado.
    const ids = sales.orders().map((order) => order.id);
    expect(ids).toContain('S1-A');
    expect(ids).not.toContain('S2-A');
  });

  it('envia as visitas concluídas ao servidor e as remove da agenda local após o upload', async () => {
    // Servidor: a visita ainda está agendada.
    const server = configure([], [makeAppointment('visit-1')]);

    // Local: o vendedor concluiu a visita (synced: false = pendente de envio).
    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        ...emptySnapshot(),
        appointments: [makeAppointment('visit-1', 'Concluída', false)],
      }),
    );

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_APPOINTMENTS,
      upload: { clients: false, orders: false, appointments: true },
      sellerId: 'seller-1',
    });

    // O servidor recebeu a atualização de status...
    expect(server.appointments.find((appointment) => appointment.id === 'visit-1')?.status).toBe(
      'Concluída',
    );
    // ...e a visita concluída saiu da agenda local.
    expect(result.appointments.map((appointment) => appointment.id)).not.toContain('visit-1');
  });

  it('preserva a conclusão local pendente quando o upload de agendamentos não está selecionado', async () => {
    const server = configure([], [makeAppointment('visit-1')]);

    localStorage.setItem(
      WORKSPACE_KEY,
      JSON.stringify({
        ...emptySnapshot(),
        appointments: [makeAppointment('visit-1', 'Concluída', false)],
      }),
    );

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_APPOINTMENTS,
      upload: { clients: false, orders: false, appointments: false },
      sellerId: 'seller-1',
    });

    // Sem upload, o download não pode reverter a visita para "Agendada"...
    const visit = result.appointments.find((appointment) => appointment.id === 'visit-1');
    expect(visit?.status).toBe('Concluída');
    expect(visit?.synced).toBe(false);
    // ...e nada foi enviado ao servidor.
    expect(server.appointments.find((appointment) => appointment.id === 'visit-1')?.status).toBe(
      'Agendada',
    );
  });

  it('remove da agenda as visitas que o servidor já registrou como concluídas', async () => {
    configure([], [makeAppointment('visit-1'), makeAppointment('visit-2', 'Concluída')]);

    const repository = TestBed.inject(LocalStorageSalesRepository);
    const result = await repository.synchronize({
      download: ONLY_APPOINTMENTS,
      upload: { clients: false, orders: false, appointments: true },
      sellerId: 'seller-1',
    });

    expect(result.appointments.map((appointment) => appointment.id)).toEqual(['visit-1']);
  });
});
