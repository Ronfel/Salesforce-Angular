import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { OrderDraftService } from '../../core/services/order-draft.service';
import { SalesDataService } from '../../core/services/sales-data.service';

/**
 * Tela de Visão Geral: indicadores de vendas, pedidos recentes, agenda do dia
 * e atalhos para as operações principais.
 */
@Component({
  selector: 'app-overview',
  styleUrl: './overview.component.scss',
  templateUrl: './overview.component.html',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatCardModule, MatIconModule],
})
export class OverviewComponent {
  private readonly orderDraft = inject(OrderDraftService);
  private readonly router = inject(Router);
  readonly sales = inject(SalesDataService);
  readonly auth = inject(AuthService);

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  readonly todaysAppointments = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sales.appointments().filter((appointment) => appointment.date === today);
  });

  get pendingOrdersCount(): number {
    return this.sales.orders().filter((order) => order.status === 'Pendente').length;
  }

  /** "Novo pedido" prepara o rascunho e abre a tela de Pedidos. */
  requestNewOrder(): void {
    this.orderDraft.requestNew();
    void this.router.navigate(['/orders']);
  }

  /** "Novo cliente" abre a tela de Clientes com o formulário pronto. */
  goToNewClient(): void {
    void this.router.navigate(['/clients'], { queryParams: { new: '1' } });
  }

  goToOrders(): void {
    void this.router.navigate(['/orders']);
  }

  goToRoute(): void {
    void this.router.navigate(['/route']);
  }
}
