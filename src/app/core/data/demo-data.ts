import { SalesSnapshot } from '../models/sales.models';

export function createDemoSnapshot(): SalesSnapshot {
  const today = new Date();
  const dateAt = (offset: number): string => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  return {
    clients: [
      {
        id: 'client-1',
        name: 'Mercado São Lucas',
        document: '12.345.678/0001-90',
        email: 'compras@saolucas.com.br',
        phone: '(11) 98765-4321',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista, 1200',
        createdAt: dateAt(-18),
      },
      {
        id: 'client-2',
        name: 'Empório Vila Nova',
        document: '45.678.901/0001-23',
        email: 'contato@emporiovila.com.br',
        phone: '(11) 97654-3210',
        city: 'Campinas',
        state: 'SP',
        address: 'Rua das Flores, 85',
        createdAt: dateAt(-12),
      },
      {
        id: 'client-3',
        name: 'Padaria Pão & Prosa',
        document: '23.456.789/0001-01',
        email: 'financeiro@paoeprosa.com.br',
        phone: '(19) 98876-5432',
        city: 'Jundiaí',
        state: 'SP',
        address: 'Rua do Comércio, 340',
        createdAt: dateAt(-6),
      },
      {
        id: 'client-4',
        name: 'Armazém Central',
        document: '34.567.890/0001-12',
        email: 'pedidos@armazemcentral.com.br',
        phone: '(19) 96543-2109',
        city: 'Sorocaba',
        state: 'SP',
        address: 'Praça da Matriz, 22',
        createdAt: dateAt(-2),
      },
    ],
    products: [
      { id: 'product-1', sku: 'BEB-001', name: 'Café especial 500g', category: 'Mercearia', price: 24.9, stock: 86 },
      { id: 'product-2', sku: 'BEB-002', name: 'Suco de uva integral 1L', category: 'Bebidas', price: 18.5, stock: 42 },
      { id: 'product-3', sku: 'LAC-001', name: 'Queijo minas padrão 1kg', category: 'Laticínios', price: 42, stock: 28 },
      { id: 'product-4', sku: 'MER-014', name: 'Azeite extra virgem 500ml', category: 'Mercearia', price: 36.9, stock: 57 },
      { id: 'product-5', sku: 'BEB-008', name: 'Água mineral sem gás 1,5L', category: 'Bebidas', price: 4.5, stock: 240 },
      { id: 'product-6', sku: 'LIM-003', name: 'Detergente neutro 500ml', category: 'Limpeza', price: 3.79, stock: 112 },
    ],
    orders: [
      {
        id: 'PED-1048',
        clientId: 'client-1',
        clientName: 'Mercado São Lucas',
        createdAt: dateAt(0),
        items: [
          { productId: 'product-1', productName: 'Café especial 500g', quantity: 24, unitPrice: 24.9 },
          { productId: 'product-4', productName: 'Azeite extra virgem 500ml', quantity: 12, unitPrice: 36.9 },
        ],
        paymentTerm: '28 dias',
        status: 'Em separação',
        total: 1042.8,
      },
      {
        id: 'PED-1047',
        clientId: 'client-3',
        clientName: 'Padaria Pão & Prosa',
        createdAt: dateAt(0),
        items: [{ productId: 'product-3', productName: 'Queijo minas padrão 1kg', quantity: 10, unitPrice: 42 }],
        paymentTerm: 'À vista',
        status: 'Pendente',
        total: 420,
      },
      {
        id: 'PED-1046',
        clientId: 'client-2',
        clientName: 'Empório Vila Nova',
        createdAt: dateAt(-1),
        items: [{ productId: 'product-2', productName: 'Suco de uva integral 1L', quantity: 18, unitPrice: 18.5 }],
        paymentTerm: '14 dias',
        status: 'Entregue',
        total: 333,
      },
    ],
    appointments: [
      {
        id: 'visit-1',
        clientId: 'client-1',
        clientName: 'Mercado São Lucas',
        date: dateAt(0),
        time: '09:00',
        address: 'Av. Paulista, 1200 · São Paulo, SP',
        status: 'Agendada',
      },
      {
        id: 'visit-2',
        clientId: 'client-3',
        clientName: 'Padaria Pão & Prosa',
        date: dateAt(0),
        time: '11:30',
        address: 'Rua do Comércio, 340 · Jundiaí, SP',
        status: 'Agendada',
      },
      {
        id: 'visit-3',
        clientId: 'client-2',
        clientName: 'Empório Vila Nova',
        date: dateAt(0),
        time: '14:00',
        address: 'Rua das Flores, 85 · Campinas, SP',
        status: 'Agendada',
      },
      {
        id: 'visit-4',
        clientId: 'client-4',
        clientName: 'Armazém Central',
        date: dateAt(1),
        time: '10:00',
        address: 'Praça da Matriz, 22 · Sorocaba, SP',
        status: 'Agendada',
      },
    ],
    lastSyncedAt: null,
  };
}
