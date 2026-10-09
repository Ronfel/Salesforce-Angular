import { InjectionToken } from '@angular/core';
import {
  Appointment,
  Client,
  LoginCredentials,
  SalesOrder,
  SalesSnapshot,
  Seller,
  SyncOptions,
} from '../models/sales.models';

/**
 * Repositório local-first: todos os cadastros são gravados primeiro no dispositivo
 * (offline) e enviados ao servidor apenas quando o usuário executa a sincronização
 * (RF018/RNF005).
 */
export interface SalesRepository {
  load(): Promise<SalesSnapshot>;
  /** Valida as credenciais na tabela de vendedores externos do servidor (RF001). */
  authenticate(credentials: LoginCredentials): Promise<Seller | null>;
  saveClient(client: Client): Promise<void>;
  deleteClient(clientId: string): Promise<void>;
  saveOrder(order: SalesOrder): Promise<void>;
  deleteOrder(orderId: string): Promise<void>;
  saveAppointments(appointments: Appointment[]): Promise<void>;
  /** Executa o download/upload seletivo escolhido na tela de sincronização (RF018). */
  synchronize(options?: SyncOptions): Promise<SalesSnapshot>;
}

export const SALES_REPOSITORY = new InjectionToken<SalesRepository>('SALES_REPOSITORY');
