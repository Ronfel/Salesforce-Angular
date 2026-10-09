import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { createDemoSnapshot } from './core/data/demo-data';
import { SALES_REPOSITORY, SalesRepository } from './core/data/sales.repository';

describe('App', () => {
  const repository: SalesRepository = {
    load: async () => createDemoSnapshot(),
    saveClient: async () => undefined,
    deleteClient: async () => undefined,
    saveOrder: async () => undefined,
    deleteOrder: async () => undefined,
    saveAppointments: async () => undefined,
    synchronize: async () => createDemoSnapshot(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SALES_REPOSITORY, useValue: repository }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the sales dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bom dia, Rodrigo');
    expect(compiled.textContent).toContain('Pedidos recentes');
  });

  it('should save a client to the sales workspace', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    app.startNewClient();
    app.clientForm.setValue({
      name: 'Cliente de teste',
      document: '12.345.678/0001-99',
      email: 'cliente@teste.com.br',
      phone: '(11) 90000-0000',
      city: 'São Paulo',
      state: 'sp',
      address: 'Rua de teste, 123',
    });

    await app.saveClient();

    expect(app.sales.clients()).toHaveLength(5);
    expect(app.sales.clients().find((client) => client.name === 'Cliente de teste')?.state).toBe('SP');
  });

  it('should calculate and save all items in a new order', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    app.startNewOrder();
    app.orderForm.controls.clientId.setValue('client-1');
    app.orderItems.at(0).controls.productId.setValue('product-1');
    app.orderItems.at(0).controls.quantity.setValue(2);
    app.addOrderItem();
    app.orderItems.at(1).controls.productId.setValue('product-2');
    app.orderItems.at(1).controls.quantity.setValue(3);

    await app.saveOrder();

    const newOrder = app.sales.orders().find((order) => order.items.length === 2);
    expect(newOrder?.total).toBeCloseTo(105.3, 2);
    expect(newOrder?.items).toHaveLength(2);
  });
});
