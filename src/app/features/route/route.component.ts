import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Appointment, SalesOrder } from '../../core/models/sales.models';
import { NotificationService } from '../../core/services/notification.service';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { SalesDataService } from '../../core/services/sales-data.service';

type AppointmentFlowStep = 'ask' | 'previous' | 'pick';

/**
 * Tela de Agendamentos e rota (RF017/RNF004): visitas do dia, conclusão e o
 * fluxo "criar pedido" (inclusive a partir dos 5 últimos pedidos do cliente),
 * enviando o pedido via OrderDraftService para a tela de Pedidos.
 */
@Component({
  selector: 'app-route',
  styleUrl: './route.component.scss',
  templateUrl: './route.component.html',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatIconModule],
})
export class RouteComponent {
  private readonly orderDraft = inject(OrderDraftService);
  private readonly router = inject(Router);
  readonly sales = inject(SalesDataService);
  readonly notify = inject(NotificationService);

  readonly busy = this.notify.busy;

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  readonly todaysAppointments = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sales.appointments().filter((appointment) => appointment.date === today);
  });
  readonly completedVisitsCount = computed(
    () => this.todaysAppointments().filter((visit) => visit.status === 'Concluída').length,
  );
  readonly pendingVisitsCount = computed(
    () => this.todaysAppointments().filter((visit) => visit.status === 'Agendada').length,
  );

  // Fluxo agendamento -> pedido a partir de pedidos anteriores (RF017/RNF004).
  readonly flowAppointment = signal<Appointment | null>(null);
  readonly flowStep = signal<AppointmentFlowStep | null>(null);

  /** "Ver cliente" abre a tela de Clientes. */
  goToClients(): void {
    void this.router.navigate(['/clients']);
  }

  async completeAppointment(appointment: Appointment): Promise<void> {
    const appointments = this.sales.appointments().map((saved) =>
      saved.id === appointment.id ? { ...saved, status: 'Concluída' as const } : saved,
    );
    this.notify.clear();

    try {
      await this.sales.updateAppointments(appointments);
      this.notify.success('Visita marcada como concluída.');
    } catch (error) {
      this.notify.error(this.errorText(error, 'Não foi possível atualizar a visita.'));
    }
  }

  /** Sincronização completa usada pelo atalho "Atualizar agenda". */
  async synchronize(): Promise<void> {
    this.busy.set(true);
    this.notify.clear();
    try {
      await this.sales.synchronize();
      this.notify.success('Agenda atualizada com os dados do servidor.');
    } catch (error) {
      this.notify.error(this.errorText(error, 'A sincronização não foi concluída.'));
    } finally {
      this.busy.set(false);
    }
  }

  startAppointmentFlow(appointment: Appointment): void {
    this.flowAppointment.set(appointment);
    this.flowStep.set('ask');
  }

  closeAppointmentFlow(): void {
    this.flowAppointment.set(null);
    this.flowStep.set(null);
  }

  /** Sequência típica, passo 4: confirmar a criação do pedido. */
  confirmCreateOrderFromAppointment(): void {
    this.flowStep.set('previous');
  }

  /** Sequência típica, passo 6: perguntar sobre pedidos anteriores. */
  startFromPreviousOrders(): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }
    if (this.sales.lastOrdersForClient(appointment.clientId).length > 0) {
      this.flowStep.set('pick');
    } else {
      // Alternativa 6a: sem pedidos anteriores, abre o pedido apenas com o cliente.
      this.openBlankOrderFromAppointment();
      this.notify.success('Nenhum pedido anterior encontrado. Pedido aberto com os dados do cliente.');
    }
  }

  openBlankOrderFromAppointment(): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }
    this.orderDraft.requestFromAppointment(appointment);
    this.closeAppointmentFlow();
    void this.router.navigate(['/orders']);
  }

  /** Sequência típica, passos 9-10: envia o pedido anterior escolhido via rascunho. */
  pickPreviousOrder(order: SalesOrder): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }
    this.orderDraft.requestFromAppointment(appointment, order);
    this.closeAppointmentFlow();
    void this.router.navigate(['/orders']);
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
