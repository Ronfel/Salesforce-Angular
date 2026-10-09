import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { createMockSalesRepository, MockSalesRepository } from '../../testing/mock-sales.repository';
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
});
