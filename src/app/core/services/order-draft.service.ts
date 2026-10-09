import { Injectable, signal } from '@angular/core';
import { Appointment, SalesOrder } from '../models/sales.models';

/**
 * Handoff de dados entre telas sem acoplamento direto:
 * - Visão Geral solicita um novo pedido;
 * - Agendamentos (RF017) envia o pedido em branco ou clonado de pedidos anteriores.
 * O componente de Pedidos consome e limpa o rascunho ao ser montado.
 */
export type OrderDraft =
  | { kind: 'new' }
  | { kind: 'appointment'; appointment: Appointment; previousOrder?: SalesOrder };

@Injectable({ providedIn: 'root' })
export class OrderDraftService {
  private readonly state = signal<OrderDraft | null>(null);

  readonly draft = this.state.asReadonly();

  requestNew(): void {
    this.state.set({ kind: 'new' });
  }

  requestFromAppointment(appointment: Appointment, previousOrder?: SalesOrder): void {
    this.state.set({ kind: 'appointment', appointment, previousOrder });
  }

  consume(): OrderDraft | null {
    const draft = this.state();
    this.state.set(null);
    return draft;
  }
}
