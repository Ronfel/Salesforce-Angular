/** Situação operacional de uma empresa cliente na plataforma multiempresa. */
export type EmpresaStatus = 'ativa' | 'inativa';

/** Provedor de integração ERP selecionável por empresa. */
export type ErpProvider = 'nenhum' | 'nexus-erp' | 'outro-erp';

/** Rótulos dos provedores de integração (exibição na tela de cadastro). */
export const ERP_PROVIDER_LABELS: Record<ErpProvider, string> = {
  nenhum: 'Sem integração (ainda não configurada)',
  'nexus-erp': 'Nexus ERP (API oficial)',
  'outro-erp': 'Outro ERP (contrato genérico HTTP)',
};

/** Contato comercial da empresa (parte do cadastro mínimo). */
export interface EmpresaContato {
  nome: string;
  email: string;
  telefone: string;
}

/**
 * Configuração de integração da empresa. Credenciais NÃO são persistidas
 * aqui: o frontend não deve manter chaves de produção de ERP — elas vivem no
 * backend. Guardamos apenas a configuração não crítica: provedor, URL base e
 * o mapeamento de campos.
 */
export interface EmpresaIntegracao {
  provedor: ErpProvider;
  /** URL base da API do cliente (vazia = ainda não configurada). */
  baseUrl: string;
  /** Mapeamento campo interno -> campo externo (configurável por empresa). */
  mapeamento: Record<string, string>;
}

/**
 * Empresa cliente da plataforma multiempresa.
 *
 * O cadastro da empresa é independente da configuração da API de integração:
 * criar uma empresa NÃO dispara consulta ao ERP. A conexão só ocorre depois que
 * a integração é configurada e mediante ação explícita de teste ou sincronização.
 */
export interface Empresa {
  /** Identificador interno estável. */
  id: string;
  /** Nome curto exibido na navegação e usado para vincular o rótulo do ERP no login. */
  nome: string;
  /** Identificador curto (tenant): slug único em minúsculas. */
  tenant: string;
  /** Razão social completa (cadastro mínimo). */
  razaoSocial: string;
  /** CNPJ (apenas dígitos, 14 posições). */
  cnpj: string;
  /** Contato comercial (cadastro mínimo). */
  contato: EmpresaContato;
  /** Situação operacional: apenas empresas ativas podem operar. */
  status: EmpresaStatus;
  /** Integração ERP selecionável por empresa. */
  integracao: EmpresaIntegracao;
  /** Data ISO de criação do cadastro. */
  createdAt: string;
  /** Data ISO da última atualização do cadastro. */
  updatedAt: string;
}

/** Dados de entrada do formulário de cadastro/edição de empresa. */
export interface EmpresaInput {
  nome: string;
  tenant: string;
  razaoSocial: string;
  cnpj: string;
  contato: EmpresaContato;
  integracao: EmpresaIntegracao;
}

/** Formata o CNPJ (apenas dígitos) como 99.999.999/9999-99 para exibição. */
export function formatCnpj(cnpj: string): string {
  const digits = (cnpj ?? '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Converte um nome em slug usado como tenant (identificador curto). */
export function slugifyTenant(nome: string): string {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Valida um CNPJ (cadastro mínimo): exatamente 14 dígitos, sem todos
 * repetidos e com os dígitos verificadores corretos. Aceita formatado
 * (99.999.999/9999-99) ou apenas dígitos.
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = (cnpj ?? '').replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }
  const checkDigit = (base: string, weights: number[]): number => {
    const sum = base
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = checkDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.slice(12) === `${first}${second}`;
}

/**
 * Papéis de acesso da plataforma multiempresa.
 *
 * - `admin-plataforma`: gerencia as empresas clientes e configurações globais.
 * - `admin-empresa`: gerencia usuários, integração e mapeamentos da própria empresa.
 * - `vendedor`: acesso comercial individual usando os dados sincronizados.
 */
export type UserRole = 'admin-plataforma' | 'admin-empresa' | 'vendedor';

/** Capacidades usadas pelas telas e guards para decidir o que cada papel pode fazer. */
export type Permission =
  | 'gerenciar-empresas'
  | 'gerenciar-usuarios'
  | 'configurar-integracoes'
  | 'configurar-mapeamentos'
  | 'consultar-sincronizacoes'
  | 'operar-comercial';

/**
 * Matriz de permissões por papel. A matriz definitiva deverá ser documentada e
 * testada antes da disponibilização comercial.
 */
const PERMISSIONS_BY_ROLE: Record<UserRole, Permission[]> = {
  'admin-plataforma': [
    'gerenciar-empresas',
    'gerenciar-usuarios',
    'configurar-integracoes',
    'configurar-mapeamentos',
    'consultar-sincronizacoes',
  ],
  'admin-empresa': [
    'gerenciar-usuarios',
    'configurar-integracoes',
    'configurar-mapeamentos',
    'consultar-sincronizacoes',
    'operar-comercial',
  ],
  vendedor: ['operar-comercial'],
};

/** Rótulo legível de cada papel. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  'admin-plataforma': 'Administrador da plataforma',
  'admin-empresa': 'Administrador da empresa',
  vendedor: 'Vendedor',
};

/** Permissões efetivas de um papel (lista vazia para papel desconhecido/ausente). */
export function permissionsOf(role: UserRole | null | undefined): Permission[] {
  return role ? (PERMISSIONS_BY_ROLE[role] ?? []) : [];
}

/** true se o papel possui a capability informada. */
export function roleCan(role: UserRole | null | undefined, permission: Permission): boolean {
  return permissionsOf(role).includes(permission);
}

/** true para papéis de administração (plataforma ou empresa). */
export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin-plataforma' || role === 'admin-empresa';
}
