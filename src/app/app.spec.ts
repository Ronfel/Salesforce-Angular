import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { createDemoSnapshot, DEMO_SELLERS } from './core/data/demo-data';
import { SALES_REPOSITORY, SalesRepository } from './core/data/sales.repository';
import { Client, LoginCredentials, SyncOptions } from './core/models/sales.models';

describe('App', () => {
  let lastSyncOptions: SyncOptions | undefined;

  const repository: SalesRepository = {
    load: async () => createDemoSnapshot(),
    authenticate: async (credentials: LoginCredentials) =>
      DEMO_SELLERS.find(
        (seller) =>
          seller.login === credentials.login &&
          seller.empresa.toUpperCase() === credentials.empresa.trim().toUpperCase() &&
          seller.senha === credentials.senha,
      ) ?? null,
    saveClient: async () => undefined,
    deleteClient: async () => undefined,
    saveOrder: async () => undefined,
    deleteOrder: async () => undefined,
    saveAppointments: async () => undefined,
    synchronize: async (options?: SyncOptions) => {
      lastSyncOptions = options;
      return createDemoSnapshot();
    },
  };

  const loginAsRodrigo = async (fixture: ReturnType<typeof TestBed.createComponent<App>>) => {
    fixture.componentInstance.loginForm.setValue({
      host: 'local',
      empresa: 'NOVA',
      login: 'rodrigo',
      senha: '123456',
    });
    await fixture.componentInstance.login();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    localStorage.clear();
    lastSyncOptions = undefined;
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SALES_REPOSITORY, useValue: repository }],
    }).compileComponents();
  });

  it('should create the app showing the login screen (RF001)', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Efetuar Login');
    expect(compiled.textContent).toContain('Efetuar Login');
  });

  it('should render the sales dashboard after login', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bom dia, Rodrigo');
    expect(compiled.textContent).toContain('Pedidos recentes');
  });

  it('should reject invalid credentials with a toast message (RF001 alternativa 5a)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();

    app.loginForm.setValue({ host: 'local', empresa: 'NOVA', login: 'rodrigo', senha: 'errada' });
    await app.login();

    expect(app.auth.authenticated()).toBe(false);
    expect(app.loginError()).toContain('inválidos');
  });

  it('should keep the session persisted until logout (RNF007)', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    expect(fixture.componentInstance.auth.authenticated()).toBe(true);
    expect(localStorage.getItem('nexus-sales-session-v1')).not.toBeNull();

    fixture.componentInstance.auth.logout();
    expect(fixture.componentInstance.auth.authenticated()).toBe(false);
    expect(localStorage.getItem('nexus-sales-session-v1')).toBeNull();
  });

  it('should save a client as pending upload (RF002/RF018)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    app.startNewClient();
    app.clientForm.setValue({
      personType: 'Jurídica',
      name: 'Cliente de teste',
      document: '11.222.333/0001-81',
      inscricaoEstadual: 'ISENTO',
      email: 'cliente@teste.com.br',
      phone: '(11) 90000-0000',
      city: 'São Paulo',
      state: 'sp',
      address: 'Rua de teste, 123',
      priceTableId: 'pt-normal',
      paymentConditionId: 'pc-28',
    });

    await app.saveClient();

    expect(app.sales.clients()).toHaveLength(5);
    const saved = app.sales.clients().find((client) => client.name === 'Cliente de teste');
    expect(saved?.state).toBe('SP');
    expect(saved?.synced).toBe(false);
    expect(app.sales.pendingClientsCount()).toBe(1);
  });

  it('should reject an invalid CPF/CNPJ on client save (RF002)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    app.startNewClient();
    app.clientForm.setValue({
      personType: 'Física',
      name: 'Pessoa Física Teste',
      document: '111.444.777-33',
      inscricaoEstadual: '',
      email: '',
      phone: '(11) 90000-0000',
      city: '',
      state: '',
      address: '',
      priceTableId: 'pt-normal',
      paymentConditionId: 'pc-vista',
    });

    await app.saveClient();

    expect(app.sales.clients()).toHaveLength(4);
    expect(app.errorMessage()).toContain('CPF inválido');
  });

  it('should calculate and save all items in a new order (RF006/RF013)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    app.startNewOrder();
    app.orderForm.controls.clientId.setValue('client-1');
    // Padrões do cliente carregados automaticamente (RF006).
    expect(app.orderForm.controls.priceTableId.value).toBe('pt-normal');
    expect(app.orderForm.controls.paymentConditionId.value).toBe('pc-28');

    app.orderItems.at(0).controls.productId.setValue('product-1');
    app.orderItems.at(0).controls.quantity.setValue(2);
    app.addOrderItem();
    app.orderItems.at(1).controls.productId.setValue('product-2');
    app.orderItems.at(1).controls.quantity.setValue(3);

    await app.saveOrder();

    const newOrder = app.sales.orders().find((order) => order.items.length === 2);
    expect(newOrder?.total).toBeCloseTo(105.3, 2);
    expect(newOrder?.items).toHaveLength(2);
    expect(newOrder?.items[0].neededDate).toBeTruthy();
    expect(newOrder?.items[0].discount).toBe(0);
    expect(newOrder?.synced).toBe(false);
  });

  it('should recalculate item prices when the price table changes (RF009 alternativa 1a)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    app.startNewOrder();
    app.orderForm.controls.clientId.setValue('client-1');
    app.orderItems.at(0).controls.productId.setValue('product-1');

    expect(app.itemUnitPrice(0)).toBeCloseTo(24.9, 2);

    app.orderForm.controls.priceTableId.setValue('pt-promo'); // 10% de desconto

    expect(app.itemUnitPrice(0)).toBeCloseTo(22.41, 2);
    expect(app.orderTotal).toBeCloseTo(44.82, 2);
  });

  it('should only allow editing clients and orders that are not synced (RF004/RF005/RF008/RF009)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    const syncedClient = app.sales.clients()[0];
    expect(app.canEditClient(syncedClient)).toBe(false);

    const pendingClient: Client = { ...syncedClient, id: 'local-1', synced: false };
    expect(app.canEditClient(pendingClient)).toBe(true);

    const syncedOrder = app.sales.orders()[0];
    expect(app.canEditOrder(syncedOrder)).toBe(syncedOrder.status === 'Pendente' && !syncedOrder.synced);
  });

  it('should synchronize only the datasets selected by the user (RF018)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    app.setDownloadOption('products', false);
    app.setUploadOption('orders', false);
    await app.synchronizeSelected();

    expect(lastSyncOptions?.download.clients).toBe(true);
    expect(lastSyncOptions?.download.products).toBe(false);
    expect(lastSyncOptions?.upload.clients).toBe(true);
    expect(lastSyncOptions?.upload.orders).toBe(false);
    expect(app.notice()).toContain('Sincronização concluída');
  });

  it('should open the appointment flow to create an order from previous ones (RF017)', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    await fixture.whenStable();
    await loginAsRodrigo(fixture);

    const appointment = app.todaysAppointments()[0];
    app.startAppointmentFlow(appointment);
    expect(app.flowStep()).toBe('ask');

    app.confirmCreateOrderFromAppointment();
    expect(app.flowStep()).toBe('previous');

    app.startFromPreviousOrders();
    expect(app.flowStep()).toBe('pick');

    const previousOrder = app.sales.lastOrdersForClient(appointment.clientId)[0];
    app.pickPreviousOrder(previousOrder);

    expect(app.flowStep()).toBeNull();
    expect(app.showOrderForm()).toBe(true);
    expect(app.orderForm.controls.clientId.value).toBe(appointment.clientId);
    expect(app.orderItems.length).toBe(previousOrder.items.length);
  });
});


