import { InjectionToken } from '@angular/core';
import {
  LoginCredentials,
  SalesSnapshot,
  Seller,
  SyncDownloadSelection,
} from '../models/sales.models';

/** Contexto auxiliar fornecido ao download (ex.: vendedor logado e clientes agendados). */
export interface SyncPullContext {
  /** Id do vendedor logado: o download de pedidos retorna apenas os dele. */
  sellerId: string | null;
  scheduledClientIds: string[];
}

/**
 * Representa o "servidor da empresa" (Web Service) do documento:
 * responsável por validar o login (RF001) e por expor o download/upload
 * seletivo de dados (RF018).
 */
export interface SyncAdapter {
  /** Consulta a tabela de vendedores externos (RNF006). */
  authenticate(credentials: LoginCredentials): Promise<Seller | null>;
  /** Baixa do servidor apenas os conjuntos selecionados pelo usuário (RF018). */
  pull(selection: SyncDownloadSelection, context: SyncPullContext): Promise<Partial<SalesSnapshot>>;
  /** Envia ao servidor os cadastros locais pendentes escolhidos pelo usuário (RF018). */
  push(pending: { clients: SalesSnapshot['clients']; orders: SalesSnapshot['orders'] }): Promise<void>;
}

export const SYNC_ADAPTER = new InjectionToken<SyncAdapter>('SYNC_ADAPTER');
