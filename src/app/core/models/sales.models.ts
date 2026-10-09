export interface Client {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export type OrderStatus = 'Pendente' | 'Em separação' | 'Enviado' | 'Entregue';

export interface SalesOrder {
  id: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  items: OrderItem[];
  paymentTerm: string;
  status: OrderStatus;
  total: number;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  address: string;
  status: 'Agendada' | 'Concluída';
}

export interface SalesSnapshot {
  clients: Client[];
  products: Product[];
  orders: SalesOrder[];
  appointments: Appointment[];
  lastSyncedAt: string | null;
}
