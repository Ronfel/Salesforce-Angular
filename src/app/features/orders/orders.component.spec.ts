import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { OrdersComponent } from './orders.component';

registerLocaleData(localePt);

describe('OrdersComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersComponent],
      providers: [{ provide: SALES_REPOSITORY, useValue: createMockSalesRepository() }],
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
