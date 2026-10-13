import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocalStorageSalesRepository } from './local-storage-sales.repository';
import { SALES_REPOSITORY } from './sales.repository';
import { SYNC_ADAPTER } from './sync.adapter';
import { SalesOrder, SalesSnapshot, SESSION_STORAGE_KEY } from '../models/sales.models';

const WORKSPACE_KEY = 'nexus-sales-workspace-v3';

function makeOrder(id: string, sellerId = 'seller-1'): SalesOrder {
  return {
    id,
    clientId: 'client-1',
    clientName: 'Cliente Teste',
    sellerId,
    sellerName: 'Vendedor',
    priceTableId: 'pt-normal',
    paymentConditionId: 'pc-28',
    createdAt: '2026-06-01T00:00:00.000Z',
    items: [],
    status: 'Pendente',
    total: 10,
    synced: false,
  };
}

function persistSession(session: Record<string, unknown>): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Fase 1 (multiempresa): o workspace local é isolado por empresa + vendedor.
 * Sessão sem empresaId (legada) continua usando a chave antiga por vendedor,
 * preservando os dados já gravados no dispositivo.
 */
describe('LocalStorageSalesRepository - isolamento por empresa (Fase 1)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        LocalStorageSalesRepository,
        { provide: SALES_REPOSITORY, useExisting: LocalStorageSalesRepository },
        {
          provide: SYNC_ADAPTER,
          useValue: {
            authenticate: async () => null,
            pull: async () => ({}) as Partial<SalesSnapshot>,
            push: async () => {},
          },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
  });

  it('isola os dados entre empresas mesmo quando o sellerId colide', async () => {
    // Vendedor "seller-1" da empresa NOVA grava um pedido.
    persistSession({
      sellerId: 'seller-1',
      empresa: 'NOVA',
      login: 'rodrigo',
      nome: 'Rodrigo Neves',
      loggedAt: new Date().toISOString(),
      empresaId: 'emp-nova',
      role: 'vendedor',
    });
    const repository = TestBed.inject(LocalStorageSalesRepository);
    await repository.saveOrder(makeOrder('PED-NOVA-1'));

    // O MESMO sellerId logado na empresa BETA não enxerga nada da NOVA.
    persistSession({
      sellerId: 'seller-1',
      empresa: 'BETA',
      login: 'rodrigo-beta',
      nome: 'Rodrigo Neves',
      loggedAt: new Date().toISOString(),
      empresaId: 'emp-beta',
      role: 'vendedor',
    });
    const outroWorkspace = await repository.load();
    expect(outroWorkspace.orders.length).toBe(0);

    // Cada empresa grava na sua própria chave composta (a da BETA fica vazia,
    // gravada pelo load() de inicialização — nunca contém pedidos da NOVA).
    expect(localStorage.getItem(`${WORKSPACE_KEY}:emp-nova:seller-1`)).not.toBeNull();
    const betaWorkspace = JSON.parse(
      localStorage.getItem(`${WORKSPACE_KEY}:emp-beta:seller-1`) ?? '{"orders":[]}',
    ) as { orders: unknown[] };
    expect(betaWorkspace.orders.length).toBe(0);

    // De volta à NOVA, os dados continuam lá.
    persistSession({
      sellerId: 'seller-1',
      empresa: 'NOVA',
      login: 'rodrigo',
      nome: 'Rodrigo Neves',
      loggedAt: new Date().toISOString(),
      empresaId: 'emp-nova',
      role: 'vendedor',
    });
    const deVolta = await repository.load();
    expect(deVolta.orders.map((order) => order.id)).toEqual(['PED-NOVA-1']);
  });

  it('mantém vendedores da mesma empresa em workspaces separados', async () => {
    persistSession({
      sellerId: 'seller-1',
      empresa: 'NOVA',
      login: 'rodrigo',
      nome: 'Rodrigo Neves',
      loggedAt: new Date().toISOString(),
      empresaId: 'emp-nova',
      role: 'vendedor',
    });
    const repository = TestBed.inject(LocalStorageSalesRepository);
    await repository.saveOrder(makeOrder('PED-R1'));

    persistSession({
      sellerId: 'seller-2',
      empresa: 'NOVA',
      login: 'mariana',
      nome: 'Mariana Duarte',
      loggedAt: new Date().toISOString(),
      empresaId: 'emp-nova',
      role: 'vendedor',
    });
    const daMariana = await repository.load();

    expect(daMariana.orders.length).toBe(0);
  });

  it('preserva a chave legada por vendedor quando a sessão não tem empresaId', async () => {
    // Sessão de antes da Fase 1: sem empresaId/role.
    persistSession({
      sellerId: 'seller-1',
      empresa: 'NOVA',
      login: 'rodrigo',
      nome: 'Rodrigo Neves',
      loggedAt: new Date().toISOString(),
    });
    const repository = TestBed.inject(LocalStorageSalesRepository);
    await repository.saveOrder(makeOrder('PED-ANTIGO'));

    // Dado gravado na chave antiga (só sellerId): nada se perde no upgrade.
    expect(localStorage.getItem(`${WORKSPACE_KEY}:seller-1`)).not.toBeNull();
    expect(localStorage.getItem(`${WORKSPACE_KEY}:emp-nova:seller-1`)).toBeNull();

    const snapshot = await repository.load();
    expect(snapshot.orders.map((order) => order.id)).toEqual(['PED-ANTIGO']);
  });

  it('sem sessão usa o prefixo puro (SSR / pré-login)', async () => {
    const repository = TestBed.inject(LocalStorageSalesRepository);
    await repository.load();

    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
    expect(localStorage.getItem(`${WORKSPACE_KEY}:seller-1`)).toBeNull();
  });
});
