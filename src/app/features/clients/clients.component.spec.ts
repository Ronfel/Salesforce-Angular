import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createMockSalesRepository, MockSalesRepository } from '../../testing/mock-sales.repository';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { Client } from '../../core/models/sales.models';
import { ClientsComponent } from './clients.component';

describe('ClientsComponent', () => {
  let repository: MockSalesRepository;

  beforeEach(async () => {
    repository = createMockSalesRepository();
    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: repository },
        provideRouter([{ path: 'clients', component: ClientsComponent }]),
      ],
    }).compileComponents();
  });

  it('should save a client as pending upload (RF002/RF018)', async () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    await component.sales.initialize();

    component.startNewClient();
    component.clientForm.setValue({
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

    await component.saveClient();

    expect(component.sales.clients()).toHaveLength(5);
    const saved = component.sales.clients().find((client) => client.name === 'Cliente de teste');
    expect(saved?.state).toBe('SP');
    expect(saved?.synced).toBe(false);
    expect(component.sales.pendingClientsCount()).toBe(1);
    expect(component.notify.notice()).toContain('cadastrado com sucesso');
  });

  it('should reject an invalid CPF/CNPJ on client save (RF002)', async () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    await component.sales.initialize();

    component.startNewClient();
    component.clientForm.setValue({
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

    await component.saveClient();

    expect(component.sales.clients()).toHaveLength(4);
    expect(component.notify.errorMessage()).toContain('CPF inválido');
  });

  it('should only allow editing clients that are not synced (RF004/RF005)', async () => {
    const fixture = TestBed.createComponent(ClientsComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    await component.sales.initialize();

    const syncedClient = component.sales.clients()[0];
    expect(component.canEditClient(syncedClient)).toBe(false);

    const pendingClient: Client = { ...syncedClient, id: 'local-1', synced: false };
    expect(component.canEditClient(pendingClient)).toBe(true);
  });
});
