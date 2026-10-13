import { computed, Injectable, signal } from '@angular/core';
import {
  Empresa,
  EmpresaContato,
  EmpresaInput,
  EmpresaIntegracao,
  EmpresaStatus,
  ErpProvider,
  isValidCnpj,
  slugifyTenant,
} from '../models/empresa.model';

const STORAGE_KEY = 'nx.empresas.v1';

/** Identificador curto (tenant): letras minúsculas, números e hífens. */
const TENANT_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Empresas semeadas no primeiro uso para preservar o ambiente de demonstração.
 * A segunda existe para exercitar o isolamento multiempresa. Ambas já nascem
 * com o cadastro mínimo (nome, tenant, razão social, CNPJ e contato).
 */
function seedEmpresas(): Empresa[] {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return [
    {
      id: 'emp-nova',
      nome: 'NOVA',
      tenant: 'nova',
      razaoSocial: 'Nova Distribuidora Comercial Ltda',
      cnpj: '11444777000161',
      contato: {
        nome: 'Paula Ribeiro',
        email: 'contato@novadist.com.br',
        telefone: '(11) 3456-7890',
      },
      status: 'ativa',
      integracao: {
        provedor: 'nexus-erp',
        baseUrl: 'https://erp.novadist.com.br/api',
        mapeamento: { pedidoNumero: 'numeroPedido', clienteCnpj: 'cnpjCliente' },
      },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'emp-beta',
      nome: 'BETA Distribuidora',
      tenant: 'beta-distribuidora',
      razaoSocial: 'Beta Distribuidora de Alimentos S/A',
      cnpj: '22333444000181',
      contato: {
        nome: 'Marcos Lima',
        email: 'comercial@betadist.com.br',
        telefone: '(19) 3344-5566',
      },
      status: 'ativa',
      integracao: { provedor: 'nenhum', baseUrl: '', mapeamento: {} },
      createdAt,
      updatedAt: createdAt,
    },
  ];
}

/**
 * Gerencia as empresas clientes da plataforma multiempresa.
 *
 * CRUD persistido em localStorage — equivalente local do cadastro que, em
 * produção, ficaria no backend/Firestore. É a fonte de runtime do vínculo
 * "usuário ↔ empresa": o `AuthService` resolve o `empresaId` do login a partir
 * daqui, e o repositório local isola o workspace por empresa.
 *
 * Nenhuma operação daqui consulta o ERP: descrever provedor/mapeamento aqui
 * não dispara conexão — a conexão é testada na tela de Conexões.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly _empresas = signal<Empresa[]>(this.load());

  /** Lista somente-leitura das empresas cadastradas. */
  readonly empresas = this._empresas.asReadonly();

  /** Empresas em situação ativa. */
  readonly ativas = computed(() => this._empresas().filter((empresa) => empresa.status === 'ativa'));

  /**
   * Valida o cadastro mínimo (nome, identificador/tenant, razão social,
   * CNPJ, contato) e a configuração de integração. Devolve a mensagem em pt-BR
   * do primeiro problema encontrado, ou `null` quando válido.
   *
   * @param ignoreId id da empresa sendo editada (a unicidade não vale contra ela).
   */
  validate(input: EmpresaInput, ignoreId?: string | null): string | null {
    const nome = input.nome.trim();
    if (!nome) {
      return 'Informe o nome da empresa.';
    }
    const tenant = input.tenant.trim().toLowerCase();
    if (!tenant) {
      return 'Informe o identificador curto (tenant) da empresa.';
    }
    if (!TENANT_PATTERN.test(tenant)) {
      return 'Identificador (tenant) inválido: use apenas letras minúsculas, números e hífens.';
    }
    if (!input.razaoSocial.trim()) {
      return 'Informe a razão social da empresa.';
    }
    if (!isValidCnpj(input.cnpj)) {
      return 'Informe um CNPJ válido com 14 dígitos.';
    }
    if (!input.contato.nome.trim()) {
      return 'Informe o nome do contato.';
    }
    if (!isEmail(input.contato.email.trim())) {
      return 'Informe um e-mail válido de contato.';
    }

    const other = (empresa: Empresa): boolean => empresa.id !== ignoreId;
    if (
      this._empresas().some(
        (empresa) => other(empresa) && empresa.nome.toLowerCase() === nome.toLowerCase(),
      )
    ) {
      return `Já existe uma empresa cadastrada com o nome "${nome}".`;
    }
    if (
      this._empresas().some(
        (empresa) => other(empresa) && empresa.tenant.toLowerCase() === tenant,
      )
    ) {
      return `Já existe uma empresa com o identificador "${tenant}".`;
    }

    const integracao = input.integracao;
    if (integracao.provedor !== 'nenhum') {
      const baseUrl = integracao.baseUrl.trim();
      if (!baseUrl) {
        return 'Informe a URL base da API para o provedor de integração selecionado.';
      }
      if (!/^https?:\/\/\S+$/i.test(baseUrl)) {
        return 'A URL base da integração deve começar com http:// ou https://.';
      }
    }
    return null;
  }

  /**
   * Cadastra uma nova empresa a partir do formulário de cadastro. A empresa nasce
   * ativa (use `setStatus` para deixá-la inativa logo em seguida, se necessário).
   * Devolve a empresa criada ou `null` quando a validação falha.
   */
  add(input: EmpresaInput): Empresa | null {
    const dados = normalizeInput(input);
    if (this.validate(dados)) {
      return null;
    }
    const now = new Date().toISOString();
    const empresa: Empresa = {
      id: this.nextId(),
      ...dados,
      status: 'ativa',
      createdAt: now,
      updatedAt: now,
    };
    this._empresas.update((list) => [...list, empresa]);
    this.persist();
    return empresa;
  }

  /**
   * Atualiza o cadastro de uma empresa existente (edição no formulário da tela de Empresas).
   * Preserva id/createdAt e registra `updatedAt`. Devolve a empresa salva ou null.
   */
  update(id: string, input: EmpresaInput): Empresa | null {
    const atual = this.byId(id);
    if (!atual) {
      return null;
    }
    const dados = normalizeInput(input);
    if (this.validate(dados, id)) {
      return null;
    }
    const empresa: Empresa = { ...atual, ...dados, updatedAt: new Date().toISOString() };
    this._empresas.update((list) => list.map((item) => (item.id === id ? empresa : item)));
    this.persist();
    return empresa;
  }

  /** Ativa ou desativa uma empresa (controla a liberação de uso). */
  setStatus(id: string, status: EmpresaStatus): void {
    this._empresas.update((list) =>
      list.map((empresa) =>
        empresa.id === id
          ? { ...empresa, status, updatedAt: new Date().toISOString() }
          : empresa,
      ),
    );
    this.persist();
  }

  /** Remove uma empresa do cadastro. */
  remove(id: string): void {
    this._empresas.update((list) => list.filter((empresa) => empresa.id !== id));
    this.persist();
  }

  /** Busca uma empresa pelo id. */
  byId(id: string | null | undefined): Empresa | null {
    if (!id) {
      return null;
    }
    return this._empresas().find((empresa) => empresa.id === id) ?? null;
  }

  /**
   * Resolve (ou cria) a empresa dona de um vendedor a partir do rótulo `empresa`
   * do registro do ERP. Usado no login para estabelecer o vínculo usuário ↔
   * empresa sem exigir que o ERP conheça nossos ids internos.
   *
   * A criação automática é intencionalmente parcial (sem CNPJ/contato): o
   * administrador completa o cadastro na tela de Empresas.
   */
  resolveByNome(nome: string): Empresa {
    const clean = nome.trim();
    const found = this._empresas().find(
      (empresa) => empresa.nome.toLowerCase() === clean.toLowerCase(),
    );
    if (found) {
      return found;
    }
    const now = new Date().toISOString();
    const created: Empresa = {
      id: this.nextId(),
      nome: clean,
      tenant: slugifyTenant(clean) || `emp-${Date.now().toString(36)}`,
      razaoSocial: clean,
      cnpj: '',
      contato: { nome: '', email: '', telefone: '' },
      status: 'ativa',
      integracao: { provedor: 'nenhum', baseUrl: '', mapeamento: {} },
      createdAt: now,
      updatedAt: now,
    };
    this._empresas.update((list) => [...list, created]);
    this.persist();
    return created;
  }

  private nextId(): string {
    return `emp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._empresas()));
    } catch {
      // localStorage indisponível (SSR / modo privado / quota): segue apenas em memória.
    }
  }

  private load(): Empresa[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Primeira execução (ou ambiente sem armazenamento): semeia a base de demonstração.
      if (raw === null) {
        const seeded = seedEmpresas();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return seedEmpresas();
      }
      return parsed
        .filter((item): item is Record<string, unknown> => this.isEmpresaShape(item))
        .map((item) => this.normalize(item));
    } catch {
      return seedEmpresas();
    }
  }

  /**
   * Aceita tanto o cadastro completo quanto registros legados gravados
   * antes da Fase 1 (apenas id/nome/status/createdAt), preenchendo os campos
   * ausentes com padrões seguros.
   */
  private isEmpresaShape(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v['id'] === 'string' &&
      typeof v['nome'] === 'string' &&
      typeof v['createdAt'] === 'string' &&
      (v['status'] === 'ativa' || v['status'] === 'inativa')
    );
  }

  private normalize(value: Record<string, unknown>): Empresa {
    const nome = String(value['nome']);
    const createdAt = String(value['createdAt']);
    return {
      id: String(value['id']),
      nome,
      tenant:
        typeof value['tenant'] === 'string' && value['tenant'].trim()
          ? String(value['tenant'])
          : slugifyTenant(nome),
      razaoSocial:
        typeof value['razaoSocial'] === 'string' && value['razaoSocial'].trim()
          ? String(value['razaoSocial'])
          : nome,
      cnpj:
        typeof value['cnpj'] === 'string'
          ? String(value['cnpj']).replace(/\D/g, '').slice(0, 14)
          : '',
      contato: normalizeContato(value['contato']),
      status: value['status'] === 'inativa' ? 'inativa' : 'ativa',
      integracao: normalizeIntegracao(value['integracao']),
      createdAt,
      updatedAt: typeof value['updatedAt'] === 'string' ? String(value['updatedAt']) : createdAt,
    };
  }
}

/** Normaliza os campos do formulário antes de validar/persistir. */
function normalizeInput(input: EmpresaInput): EmpresaInput {
  return {
    nome: input.nome.trim(),
    tenant: input.tenant.trim().toLowerCase(),
    razaoSocial: input.razaoSocial.trim(),
    cnpj: (input.cnpj ?? '').replace(/\D/g, ''),
    contato: {
      nome: input.contato.nome.trim(),
      email: input.contato.email.trim(),
      telefone: input.contato.telefone.trim(),
    },
    integracao: {
      provedor: input.integracao.provedor,
      baseUrl: input.integracao.baseUrl.trim(),
      mapeamento: { ...input.integracao.mapeamento },
    },
  };
}

function normalizeContato(value: unknown): EmpresaContato {
  const c = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    nome: typeof c['nome'] === 'string' ? c['nome'] : '',
    email: typeof c['email'] === 'string' ? c['email'] : '',
    telefone: typeof c['telefone'] === 'string' ? c['telefone'] : '',
  };
}

function normalizeIntegracao(value: unknown): EmpresaIntegracao {
  const i = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const provedor: ErpProvider =
    i['provedor'] === 'nexus-erp' || i['provedor'] === 'outro-erp' ? i['provedor'] : 'nenhum';
  const mapeamento: Record<string, string> = {};
  if (typeof i['mapeamento'] === 'object' && i['mapeamento'] !== null) {
    for (const [key, entry] of Object.entries(i['mapeamento'] as Record<string, unknown>)) {
      if (typeof entry === 'string') {
        mapeamento[key] = entry;
      }
    }
  }
  return {
    provedor,
    baseUrl: typeof i['baseUrl'] === 'string' ? i['baseUrl'] : '',
    mapeamento,
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
