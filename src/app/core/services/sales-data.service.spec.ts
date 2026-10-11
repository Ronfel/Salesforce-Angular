import { TestBed } from '@angular/core/testing';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { AuthService } from './auth.service';
import { SESSION_STORAGE_KEY, SalesOrder } from '../models/sales.models';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { SalesDataService } from './sales-data.service';

function makeOrder(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'PED-TEST-1',
    clientId: 'client-1',
    clientName: 'Cliente Teste',
    sellerId: '',
    sellerName: '',
    priceTableId: 'pt-normal',
    paymentConditionId: 'pc-28',
    createdAt: new Date().toISOString(),
    items: [],
    status: 'Pendente',
    total: 0,
    synced: false,
    ...overrides,
  };
}

describe('SalesDataService (sellerId)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [{ provide: SALES_REPOSITORY, useValue: createMockSalesRepository() }],
    });
  });

  it('should stamp saves with the logged seller id, never the seller name (RF018)', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    const sales = TestBed.inject(SalesDataService);
    await sales.saveOrder(makeOrder());

    expect(sales.orders()[0]?.sellerId).toBe('seller-1');
    expect(sales.orders()[0]?.sellerName).toBe('Rodrigo Neves');
  });

  it('should let the session sellerId win over a stale order sellerId', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'mariana', senha: '123456' });

    const sales = TestBed.inject(SalesDataService);
    // Pedido antigo que trazia login/nome no campo sellerId.
    await sales.saveOrder(makeOrder({ sellerId: 'mariana', sellerName: 'Mariana Duarte' }));

    expect(sales.orders()[0]?.sellerId).toBe('seller-2');
    expect(sales.orders()[0]?.sellerName).toBe('Mariana Duarte');
  });

  it('should refuse to save without a session sellerId', async () => {
    const sales = TestBed.inject(SalesDataService);
    await expect(sales.saveOrder(makeOrder())).rejects.toThrow('Sessão do vendedor expirada');
  });

  it('should discard persisted sessions without sellerId (pre-RF018) instead of contaminating orders', async () => {
    // Sessão antiga: tinha só login/nome, sem o id do documento do vendedor.
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ empresa: 'NOVA', login: 'rodrigo', nome: 'Rodrigo Neves', loggedAt: new Date().toISOString() }),
    );

    await TestBed.inject(AuthService).ready;
    expect(TestBed.inject(AuthService).authenticated()).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
