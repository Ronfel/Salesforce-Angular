import { createDemoSnapshot, DEMO_SELLERS } from '../core/data/demo-data';
import { SalesRepository } from '../core/data/sales.repository';
import { LoginCredentials, SyncOptions } from '../core/models/sales.models';

export interface MockSalesRepository extends SalesRepository {
  /** Opções usadas na última chamada de sincronização (útil para asserções). */
  lastSyncOptions?: SyncOptions;
}

/**
 * Repositório em memória para testes: devolve a base de demonstração e
 * valida credenciais contra a tabela de vendedores (DEMO_SELLERS).
 */
export function createMockSalesRepository(): MockSalesRepository {
  const mock: MockSalesRepository = {
    load: async () => createDemoSnapshot(),
    authenticate: async (credentials: LoginCredentials) =>
      DEMO_SELLERS.find(
        (seller) =>
          seller.login === credentials.login &&
          seller.senha === credentials.senha,
      ) ?? null,
    saveClient: async () => undefined,
    deleteClient: async () => undefined,
    saveOrder: async () => undefined,
    deleteOrder: async () => undefined,
    saveAppointments: async () => undefined,
    synchronize: async (options?: SyncOptions) => {
      mock.lastSyncOptions = options;
      return createDemoSnapshot();
    },
  };

  return mock;
}
