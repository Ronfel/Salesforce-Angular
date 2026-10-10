export type PersonType = 'Física' | 'Jurídica';

export interface Client {
  id: string;
  personType: PersonType;
  name: string;
  document: string;
  inscricaoEstadual: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  priceTableId: string;
  paymentConditionId: string;
  createdAt: string;
  /** false = cadastrado no dispositivo e ainda não submetido ao servidor (RF004/RF005). */
  synced: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

/** Tabela de preço sincronizada do servidor (RF010). */
export interface PriceTable {
  id: string;
  code: string;
  name: string;
  /** Desconto percentual aplicado sobre o preço base dos produtos. */
  discountPercent: number;
}

/** Condição de pagamento sincronizada do servidor (RF011). */
export interface PaymentCondition {
  id: string;
  code: string;
  name: string;
  days: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  /** Preço unitário já calculado pela tabela de preço do pedido. */
  unitPrice: number;
  /** Data necessária (entrega) do item (RF013). */
  neededDate: string;
  /** Percentual de desconto aplicado sobre o item (RF013). */
  discount: number;
}

export type OrderStatus = 'Pendente' | 'Em separação' | 'Enviado' | 'Entregue';

export interface SalesOrder {
  id: string;
  clientId: string;
  clientName: string;
  priceTableId: string;
  paymentConditionId: string;
  createdAt: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  /** false = cadastrado no dispositivo e ainda não submetido ao servidor (RF008/RF009). */
  synced: boolean;
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
  priceTables: PriceTable[];
  paymentConditions: PaymentCondition[];
  orders: SalesOrder[];
  appointments: Appointment[];
  lastSyncedAt: string | null;
}

/** Vendedor cadastrado na tabela de vendedores externos do ERP (RF001). */
export interface Seller {
  id: string;
  login: string;
  senha: string;
  empresa: string;
  nome: string;
}

/** Credenciais informadas na tela de login (RF001): apenas Usuário e Senha. */
export interface LoginCredentials {
  login: string;
  senha: string;
}

/** Sessão do vendedor após login efetuado (RNF007 - login único). */
export interface SellerSession {
  empresa: string;
  login: string;
  nome: string;
  loggedAt: string;
}

/** Seleção de download disponível na tela de sincronização (RF018). */
export interface SyncDownloadSelection {
  clients: boolean;
  appointments: boolean;
  lastOrders: boolean;
  priceTables: boolean;
  paymentConditions: boolean;
  products: boolean;
}

/** Seleção de upload disponível na tela de sincronização (RF018). */
export interface SyncUploadSelection {
  clients: boolean;
  orders: boolean;
}

export interface SyncOptions {
  download: SyncDownloadSelection;
  upload: SyncUploadSelection;
}

export const ALL_DATASETS_DOWNLOADED: SyncDownloadSelection = {
  clients: true,
  appointments: true,
  lastOrders: true,
  priceTables: true,
  paymentConditions: true,
  products: true,
};

export const ALL_DATA_UPLOADED: SyncUploadSelection = {
  clients: true,
  orders: true,
};
