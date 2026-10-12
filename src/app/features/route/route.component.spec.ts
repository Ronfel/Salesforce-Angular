import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { RouteComponent } from './route.component';

registerLocaleData(localePt);

describe('RouteComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouteComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  const createInitialized = async () => {
    const fixture = TestBed.createComponent(RouteComponent);
    await fixture.whenStable();
    await fixture.componentInstance.sales.initialize();
    return fixture;
  };

  it('should open the appointment flow to create an order from previous ones (RF017)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;
    const draftService = TestBed.inject(OrderDraftService);
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    const appointment = component.todaysAppointments()[0];
    expect(appointment).toBeTruthy();

    component.startAppointmentFlow(appointment);
    expect(component.flowStep()).toBe('ask');

    component.confirmCreateOrderFromAppointment();
    expect(component.flowStep()).toBe('previous');

    component.startFromPreviousOrders();
    expect(component.flowStep()).toBe('pick');

    const previousOrder = component.sales.lastOrdersForClient(appointment.clientId)[0];
    component.pickPreviousOrder(previousOrder);

    expect(component.flowStep()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/orders']);

    const draft = draftService.draft();
    expect(draft?.kind).toBe('appointment');
    if (draft?.kind === 'appointment') {
      expect(draft.appointment.id).toBe(appointment.id);
      expect(draft.previousOrder?.id).toBe(previousOrder.id);
    }
  });

  it('should fall back to a blank order when the client has no previous orders (RF017 alternativa 6a)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;
    const draftService = TestBed.inject(OrderDraftService);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    // Agenda de um cliente sem pedidos na base.
    const appointment = {
      ...component.todaysAppointments()[0],
      id: 'visit-sem-pedidos',
      clientId: 'client-sem-pedidos',
      clientName: 'Cliente Sem Pedidos',
    };
    component.startAppointmentFlow(appointment);
    component.confirmCreateOrderFromAppointment();
    component.startFromPreviousOrders();

    const draft = draftService.draft();
    expect(draft?.kind).toBe('appointment');
    if (draft?.kind === 'appointment') {
      expect(draft.previousOrder).toBeUndefined();
    }
    expect(component.flowStep()).toBeNull();
  });

  it('should mark a visit as completed (RF017 pós-condição)', async () => {
    const fixture = await createInitialized();
    const component = fixture.componentInstance;

    const visit = component.todaysAppointments().find((item) => item.status === 'Agendada');
    await component.completeAppointment(visit!);

    const updated = component.sales.appointments().find((item) => item.id === visit!.id);
    expect(updated?.status).toBe('Concluída');
    // Visita concluída fica pendente de upload (sairá da agenda na sincronização).
    expect(updated?.synced).toBe(false);
    expect(component.notify.notice()).toContain('concluída');
  });
});
