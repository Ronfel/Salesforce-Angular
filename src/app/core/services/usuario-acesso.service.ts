import { Injectable, signal } from '@angular/core';
import { UsuarioAcesso } from '../models/usuario.model';

const STORAGE_KEY = 'nx.usuarios-acesso.v1';

/**
 * Base de demonstração de usuários de acesso. Em produção esta base
 * vive no backend, com permissões validadas no servidor.
 *
 * - `admin` — administrador da plataforma (sem empresa fixa): gerencia empresas.
 *   O login dele acontece na área /admin via Firebase Authentication.
 * - `rodrigo` / `mariana` — vendedores ligados à NOVA; a autenticação deles
 *   continua pela tabela de vendedores do ERP (RF001), e estes registros apenas
 *   mantêm o vínculo usuário ↔ empresa ↔ papel.
 */
function seedUsuarios(): UsuarioAcesso[] {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return [
    {
      id: 'usr-admin',
      login: 'admin',
      nome: 'Administrador da Plataforma',
      role: 'admin-plataforma',
      empresaId: null,
      ativo: true,
      createdAt,
    },
    {
      id: 'usr-rodrigo',
      login: 'rodrigo',
      nome: 'Rodrigo Neves',
      role: 'vendedor',
      empresaId: 'emp-nova',
      sellerId: 'seller-1',
      ativo: true,
      createdAt,
    },
    {
      id: 'usr-mariana',
      login: 'mariana',
      nome: 'Mariana Duarte',
      role: 'vendedor',
      empresaId: 'emp-nova',
      sellerId: 'seller-2',
      ativo: true,
      createdAt,
    },
  ];
}

/**
 * CRUD dos usuários de acesso e de seu vínculo com empresas e papéis
 * (Fase 1 - fundação multiempresa). Persistido em localStorage, no mesmo
 * padrão do `ConnectionService`/`EmpresaService`.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioAcessoService {
  private readonly _usuarios = signal<UsuarioAcesso[]>(this.load());

  /** Lista somente-leitura dos usuários de acesso cadastrados. */
  readonly usuarios = this._usuarios.asReadonly();

  /** Usuários vinculados a uma empresa (exibe `empresaId === null` com `'plataforma'`). */
  byEmpresa(empresaId: string | null): UsuarioAcesso[] {
    return this._usuarios().filter((usuario) => usuario.empresaId === empresaId);
  }

  byId(id: string): UsuarioAcesso | null {
    return this._usuarios().find((usuario) => usuario.id === id) ?? null;
  }

  byLogin(login: string): UsuarioAcesso | null {
    const clean = login.trim().toLowerCase();
    return (
      this._usuarios().find((usuario) => usuario.login.toLowerCase() === clean) ?? null
    );
  }

  /** Vínculo do usuário de acesso com o registro de vendedor do ERP. */
  bySellerId(sellerId: string): UsuarioAcesso | null {
    return (
      this._usuarios().find((usuario) => usuario.sellerId === sellerId) ?? null
    );
  }

  /**
   * Cadastra um usuário de acesso já vinculado a empresa e papel.
   * Sem senha local — a autenticação é do ERP (RF001) ou do Firebase (admin).
   */
  add(dados: {
    login: string;
    nome: string;
    role: UsuarioAcesso['role'];
    empresaId: string | null;
  }): UsuarioAcesso | null {
    const login = dados.login.trim();
    const nome = dados.nome.trim();
    if (!login || !nome) {
      return null;
    }
    const usuario: UsuarioAcesso = {
      id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      login,
      nome,
      role: dados.role,
      empresaId: dados.empresaId,
      ativo: true,
      createdAt: new Date().toISOString(),
    };
    this._usuarios.update((list) => [...list, usuario]);
    this.persist();
    return usuario;
  }

  /** Altera o papel de acesso do usuário. */
  setRole(id: string, role: UsuarioAcesso['role']): void {
    this._usuarios.update((list) =>
      list.map((usuario) => (usuario.id === id ? { ...usuario, role } : usuario)),
    );
    this.persist();
  }

  /** Move o usuário para outra empresa (ou para a plataforma, com `null`). */
  setEmpresa(id: string, empresaId: string | null): void {
    this._usuarios.update((list) =>
      list.map((usuario) => (usuario.id === id ? { ...usuario, empresaId } : usuario)),
    );
    this.persist();
  }

  /** Ativa ou desativa o usuário. */
  setAtivo(id: string, ativo: boolean): void {
    this._usuarios.update((list) =>
      list.map((usuario) => (usuario.id === id ? { ...usuario, ativo } : usuario)),
    );
    this.persist();
  }

  /** Remove o vínculo/usuário de acesso. */
  remove(id: string): void {
    this._usuarios.update((list) => list.filter((usuario) => usuario.id !== id));
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._usuarios()));
    } catch {
      // localStorage indisponível (SSR / modo privado / quota): segue apenas em memória.
    }
  }

  private load(): UsuarioAcesso[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const seeded = seedUsuarios();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return seedUsuarios();
      }
      return parsed
        .filter((item): item is UsuarioAcesso => this.isUsuario(item))
        .map((item) => ({
          id: String(item.id),
          login: String(item.login),
          nome: String(item.nome),
          role: item.role,
          empresaId: item.empresaId === null ? null : String(item.empresaId),
          ...(typeof item.sellerId === 'string' ? { sellerId: item.sellerId } : {}),
          ativo: Boolean(item.ativo),
          createdAt: String(item.createdAt),
        }));
    } catch {
      return seedUsuarios();
    }
  }

  private isUsuario(
    value: unknown,
  ): value is UsuarioAcesso & { role: UsuarioAcesso['role'] } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v['id'] === 'string' &&
      typeof v['login'] === 'string' &&
      typeof v['nome'] === 'string' &&
      (v['role'] === 'admin-plataforma' ||
        v['role'] === 'admin-empresa' ||
        v['role'] === 'vendedor') &&
      (v['empresaId'] === null || typeof v['empresaId'] === 'string') &&
      typeof v['ativo'] === 'boolean' &&
      typeof v['createdAt'] === 'string'
    );
  }
}
