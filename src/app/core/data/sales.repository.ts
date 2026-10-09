import { InjectionToken } from '@angular/core';
import { Appointment, Client, SalesOrder, SalesSnapshot } from '../models/sales.models';

export interface SalesRepository {
  load(): Promise<SalesSnapshot>;
  saveClient(client: Client): Promise<void>;
  deleteClient(clientId: string): Promise<void>;
  saveOrder(order: SalesOrder): Promise<void>;
  deleteOrder(orderId: string): Promise<void>;
  saveAppointments(appointments: Appointment[]): Promise<void>;
  synchronize(): Promise<SalesSnapshot>;
}

export const SALES_REPOSITORY = new InjectionToken<SalesRepository>('SALES_REPOSITORY');
