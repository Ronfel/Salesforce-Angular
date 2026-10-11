import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PageEvent } from '@angular/material/paginator';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { SalesOrder } from '../../core/models/sales.models';
import { PT_BR_DATE_FORMATS } from '../../app.config';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { OrdersComponent } from './orders.component';

registerLocaleData(localePt);

describe('OrdersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
        { provide: MAT_DATE_FORMATS, useValue: PT_BR_DATE_FORMATS },
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  const createInitialized = async () => {
    const fixture = TestBed.createComponent(OrdersComponent);
    await fixture.whenStable();
    await fixture.componentInstance.sales.initialize();
    return fixture;
  };

  it('should calculate and save all items in a new order (RF006/RF013)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    component.startNewOrder();
    component.orderForm.controls.clientId.setValue('client-1');
    // Padrões do cliente carregados automaticamente (RF006).
    expect(component.orderForm.controls.priceTableId.value).toBe('pt-normal');
    expect(component.orderForm.controls.paymentConditionId.value).toBe('pc-28');

    component.orderItems.at(0).controls.productId.setValue('product-1');
    component.orderItems.at(0).controls.quantity.setValue(2);
    component.addOrderItem();
    component.orderItems.at(1).controls.productId.setValue('product-2');
    component.orderItems.at(1).controls.quantity.setValue(3);

    await component.saveOrder();

    const newOrder = component.sales.orders().find((order) => order.items.length === 2);
    expect(newOrder?.total).toBeCloseTo(105.3, 2);
    expect(newOrder?.items).toHaveLength(2);
    expect(newOrder?.items[0].neededDate).toBeTruthy();
    expect(newOrder?.items[0].discount).toBe(0);
    expect(newOrder?.synced).toBe(false);
  });

  it('should recalculate item prices when the price table changes (RF009 alternativa 1a)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    component.startNewOrder();
    component.orderForm.controls.clientId.setValue('client-1');
    component.orderItems.at(0).controls.productId.setValue('product-1');
    component.orderItems.at(0).controls.quantity.setValue(2);

    expect(component.itemUnitPrice(0)).toBeCloseTo(24.9, 2);
    expect(component.orderTotal).toBeCloseTo(49.8, 2);

    component.orderForm.controls.priceTableId.setValue('pt-promo'); // 10% de desconto

    expect(component.itemUnitPrice(0)).toBeCloseTo(22.41, 2);
    expect(component.orderTotal).toBeCloseTo(44.82, 2);
  });

  it('should only allow editing orders that are not synced and pending (RF008/RF009)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    const syncedOrder = component.sales.orders()[0];
    expect(component.canEditOrder(syncedOrder)).toBe(syncedOrder.status === 'Pendente' && !syncedOrder.synced);
  });

  it('should filter orders by status and combine it with the text search', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    const totalOrders = component.sales.orders().length;
    expect(component.filteredOrders().length).toBe(totalOrders);

    component.orderStatusFilter.set('Entregue');
    const delivered = component.filteredOrders();
    expect(delivered.length).toBeGreaterThan(0);
    expect(delivered.every((order) => order.status === 'Entregue')).toBe(true);

    // A busca textual combina (AND) com o filtro de status.
    component.orderSearch.set('Mercado');
    const deliveredForMercado = component.filteredOrders();
    expect(deliveredForMercado.every((order) => order.status === 'Entregue' && order.clientName === 'Mercado São Lucas')).toBe(true);
    expect(deliveredForMercado.length).toBeLessThanOrEqual(delivered.length);

    // Voltar para "Todos" ('') restaura a lista completa respeitando apenas a busca.
    component.orderStatusFilter.set('');
    expect(component.filteredOrders().length).toBe(
      component.sales.orders().filter((order) => order.clientName === 'Mercado São Lucas').length,
    );
  });

  it('should search and pick header fields via the lookup modal (RF006/RF010/RF011)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    component.startNewOrder();
    expect(component.clientLabel).toBe('');

    // Abre a consulta de clientes, busca por um termo e seleciona.
    component.openHeaderLookup('client');
    expect(component.headerLookup()).toBe('client');
    component.headerLookupSearch.set('Padaria');
    expect(component.filteredLookupClients().every((client) => client.name === 'Padaria Pão & Prosa')).toBe(true);

    component.pickClient('client-3');
    expect(component.headerLookup()).toBeNull();
    expect(component.orderForm.controls.clientId.value).toBe('client-3');
    expect(component.clientLabel).toBe('Padaria Pão & Prosa');
    // Tabela e condição padrão do cliente são carregadas automaticamente (RF006).
    expect(component.orderForm.controls.priceTableId.value).toBe('pt-normal');
    expect(component.orderForm.controls.paymentConditionId.value).toBe('pc-vista');
    expect(component.priceTableLabel).toContain('Tabela Normal');
    expect(component.paymentConditionLabel).toBe('À vista');

    // Tabela de preço: consulta com busca por código.
    component.openHeaderLookup('priceTable');
    component.headerLookupSearch.set('promo');
    expect(component.filteredLookupPriceTables().every((table) => table.code === 'PROMO')).toBe(true);
    component.pickPriceTable('pt-promo');
    expect(component.orderForm.controls.priceTableId.value).toBe('pt-promo');
    expect(component.priceTableLabel).toContain('-10%');

    // Condição de pagamento: consulta com busca.
    component.openHeaderLookup('paymentCondition');
    component.headerLookupSearch.set('14');
    expect(component.filteredLookupPaymentConditions().every((condition) => condition.days === 14)).toBe(true);
    component.pickPaymentCondition('pc-14');
    expect(component.orderForm.controls.paymentConditionId.value).toBe('pc-14');
    expect(component.paymentConditionLabel).toBe('14 dias');
  });

  it('should paginate orders limiting 10 per page and expose the current slice', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    // Completa os pedidos existentes até 12 no total para exercitar a virada de página.
    const existing = component.sales.orders().length;
    for (let index = existing; index < 12; index += 1) {
      const order: SalesOrder = {
        id: `PED-TEST-${index}`,
        clientId: 'client-1',
        clientName: 'Cliente Teste',
        sellerId: 'seller-1',
        sellerName: 'Rodrigo Neves',
        priceTableId: 'pt-normal',
        paymentConditionId: 'pc-28',
        createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
        items: [],
        status: 'Pendente',
        total: 100,
        synced: false,
      };
      await component.sales.saveOrder(order);
    }

    const total = component.filteredOrders().length;
    expect(total).toBe(12);
    expect(component.pageSize).toBe(10);

    // Primeira página: 10 pedidos.
    expect(component.pageIndex()).toBe(0);
    expect(component.pagedOrders().length).toBe(10);

    // Segunda página: os 2 restantes.
    component.onPage({ pageIndex: 1, pageSize: 10, length: total } as PageEvent);
    expect(component.pageIndex()).toBe(1);
    expect(component.pagedOrders().length).toBe(2);

    // Filtrar volta para a primeira página.
    component.setOrderSearch('Inexistente');
    expect(component.pageIndex()).toBe(0);
    expect(component.pagedOrders().length).toBe(0);
  });

  it('should convert the needed date between the form string and the MatDatepicker (RF013)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    component.startNewOrder();

    // Valor inicial (YYYY-MM-DD) é convertido para Date (hora local) no picker.
    const initial = component.orderItems.at(0).controls.neededDate.value;
    const pickerValue = component.neededDateValue(0);
    expect(pickerValue).toBeInstanceOf(Date);
    const [year, month, day] = initial.split('-').map(Number);
    expect(pickerValue?.getFullYear()).toBe(year);
    expect(pickerValue?.getMonth()).toBe(month - 1);
    expect(pickerValue?.getDate()).toBe(day);

    // Ao escolher uma data no picker, gravamos de volta como YYYY-MM-DD.
    component.onNeededDateChange(0, { value: new Date(2026, 4, 9) }); // 09/05/2026
    expect(component.orderItems.at(0).controls.neededDate.value).toBe('2026-05-09');

    // Limpar a data grava string vazia.
    component.onNeededDateChange(0, { value: null });
    expect(component.orderItems.at(0).controls.neededDate.value).toBe('');
  });

  it('should apply an appointment draft to the order form (RF017)', async () => {
    const draftService = TestBed.inject(OrderDraftService);
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    const appointment = component.sales.appointments()[0];
    const previousOrder = component.sales.lastOrdersForClient(appointment.clientId)[0];
    draftService.requestFromAppointment(appointment, previousOrder);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.showOrderForm()).toBe(true);
    expect(component.orderForm.controls.clientId.value).toBe(appointment.clientId);
    expect(component.orderItems.length).toBe(previousOrder.items.length);
    expect(draftService.consume()).toBeNull();
  });
});
