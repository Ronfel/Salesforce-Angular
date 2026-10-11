import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { DemoSyncAdapter } from '../../core/data/demo-sync.adapter';
import { createMockSalesRepository, MockSalesRepository } from '../../testing/mock-sales.repository';
import { compareOrdersByRecency } from '../../core/utils/order.utils';
import { SyncComponent } from './sync.component';

describe('SyncComponent', () => {
  let repository: MockSalesRepository;

  beforeEach(async () => {
    repository = createMockSalesRepository();
    await TestBed.configureTestingModule({
      imports: [SyncComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: repository },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should synchronize only the datasets selected by the user (RF018)', async () => {
    const fixture = TestBed.createComponent(SyncComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    await component.sales.initialize();

    component.setDownloadOption('products', false);
    component.setUploadOption('orders', false);
    await component.synchronizeSelected();

    expect(repository.lastSyncOptions?.download.clients).toBe(true);
    expect(repository.lastSyncOptions?.download.products).toBe(false);
    expect(repository.lastSyncOptions?.upload.clients).toBe(true);
    expect(repository.lastSyncOptions?.upload.orders).toBe(false);
    expect(component.notify.notice()).toContain('Sincronização concluída');
  });

  it('should require at least one download or upload option', async () => {
    const fixture = TestBed.createComponent(SyncComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    await component.sales.initialize();

    for (const key of ['clients', 'appointments', 'lastOrders', 'priceTables', 'paymentConditions', 'products'] as const) {
      component.setDownloadOption(key, false);
    }
    component.setUploadOption('clients', false);
    component.setUploadOption('orders', false);
    await component.synchronizeSelected();

    expect(repository.lastSyncOptions).toBeUndefined();
    expect(component.notify.errorMessage()).toContain('Selecione ao menos');
  });

  it('should download only the logged seller orders (sellerId filter)', async () => {
    const demo = new DemoSyncAdapter();
    const selection = { clients: false, appointments: false, lastOrders: true, priceTables: false, paymentConditions: false, products: false };

    const downloadedMariana = await demo.pull(selection, { sellerId: 'seller-2', scheduledClientIds: [] });
    expect(downloadedMariana.orders?.length).toBeGreaterThan(0);
    expect(downloadedMariana.orders?.every((order) => order.sellerId === 'seller-2')).toBe(true);

    const downloadedRodrigo = await demo.pull(selection, { sellerId: 'seller-1', scheduledClientIds: [] });
    expect(downloadedRodrigo.orders?.length).toBeGreaterThan(0);
    expect(downloadedRodrigo.orders?.every((order) => order.sellerId === 'seller-1')).toBe(true);
  });

  it('should download every seller order sorted from the most recent, without a per-client limit (RF018)', async () => {
    const demo = new DemoSyncAdapter();
    const selection = { clients: false, appointments: false, lastOrders: true, priceTables: false, paymentConditions: false, products: false };

    const downloaded = await demo.pull(selection, { sellerId: 'seller-1', scheduledClientIds: [] });
    const orders = downloaded.orders ?? [];

    // Rodrigo (seller-1) tem 4 pedidos na base demo: todos devem voltar, sem o
    // antigo limite de 5 por cliente e sem filtrar pela agenda do dia.
    expect(orders.length).toBe(4);

    // Ordenados do mais recente para o mais antigo.
    const dates = orders.map((order) => order.createdAt);
    expect(dates).toEqual([...dates].sort((first, second) => second.localeCompare(first)));

    // Pedidos da mesma data são desempatados pelo id do pedido (decrescente),
    // então a listagem nunca "dança" entre eles.
    expect(orders).toEqual([...orders].sort(compareOrdersByRecency));
    const ids = orders.map((order) => order.id);
    expect(ids).toEqual([...ids].sort((first, second) => second.localeCompare(first)));
  });
});
