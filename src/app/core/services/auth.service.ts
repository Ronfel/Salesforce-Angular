import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { LoginCredentials, SellerSession, SESSION_STORAGE_KEY } from '../models/sales.models';
import { isAdminRole, Permission, roleCan, UserRole } from '../models/empresa.model';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { AdminIdentity } from '../data/admin-auth.adapter';
import { EmpresaService } from './empresa.service';
import { UsuarioAcessoService } from './usuario-acesso.service';
import { UsuarioFirestoreService } from './usuario-firestore.service';

/**
 * Autenticação de usuários no Web Service (RNF006) com login único (RNF007):
 * a sessão fica gravada no dispositivo e só é encerrada pelo logout, que na
 * tela principal é acionado ao clicar no logo da aplicação.
 *
 * Fase 1 (multiempresa): o login também estabelece o vínculo usuário ↔ empresa
 * (`empresaId`) e o papel de acesso (`role`) da sessão — usados pelo isolamento
 * do workspace local por empresa. A administração da plataforma autentica no
 * Firebase Authentication (/admin/login), mas a sessão é aberta aqui
 * (`openAdminSession`) para manter uma fonte única de sessão.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(SALES_REPOSITORY);
  private readonly empresas = inject(EmpresaService);
  private readonly usuarios = inject(UsuarioAcessoService);
  private readonly usuariosFire = inject(UsuarioFirestoreService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly state = signal<SellerSession | null>(null);
  private resolveReady!: () => void;

  /** Resolve quando a sessão persistida termina de ser restaurada (usado pelo guard de rotas). */
  readonly ready: Promise<void> = new Promise((resolve) => {
    this.resolveReady = resolve;
  });

  readonly session = this.state.asReadonly();
  readonly authenticated = computed(() => this.state() !== null);
  readonly firstName = computed(() => this.state()?.nome.split(' ')[0] ?? '');

  /** Empresa dona da sessão corrente (null em sessão legada ou de plataforma). */
  readonly empresaId = computed(() => this.state()?.empresaId ?? null);

  /** Papel de acesso da sessão corrente (null em sessão legada sem papel). */
  readonly role = computed<UserRole | null>(() => this.state()?.role ?? null);

  /** true quando a sessão tem um papel de administração (plataforma ou empresa). */
  readonly isAdmin = computed(() => isAdminRole(this.role()));

  constructor() {
    // Restauração adiada para que a primeira renderização no navegador
    // (tela de login) seja idêntica à gerada pelo SSR, evitando erro de hidratação.
    if (this.isBrowser) {
      setTimeout(() => {
        this.restoreSession();
        this.resolveReady();
      }, 0);
    } else {
      this.resolveReady();
    }
  }

  /** true se o papel da sessão possui a capability informada. */
  can(permission: Permission): boolean {
    return roleCan(this.role(), permission);
  }

  /**
   * RF001 - Efetuar Login: valida Usuário e Senha no servidor.
   * A verificação exige conexão com a internet (RNF006).
   *
   * Ordem da autenticação:
   * 1) Tabela de usuários da plataforma (coleção `users` no Firestore) —
   *    a senha é gravada criptografada e DESCRIPTOGRAFA aqui para a comparação.
   *    É por onde entram as empresas cadastradas na área admin.
   * 2) Tabela de vendedores do ERP (RF001) — fallback comercial.
   * A administração da plataforma não entra por aqui (ela usa o login próprio
   * do Firebase Authentication em /admin/login).
   */
  async login(credentials: LoginCredentials): Promise<void> {
    if (!credentials.login.trim() || !credentials.senha) {
      throw new Error('Preencha Usuário e Senha para efetuar o login.');
    }

    if (this.isBrowser && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sem conexão com a internet. A verificação do login exige estar online.');
    }

    const usuario = await this.usuariosFire.autenticar(credentials);
    if (usuario) {
      this.startUsuarioTabelaSession(usuario);
      return;
    }

    const seller = await this.repository.authenticate(credentials);
    if (seller) {
      this.startSellerSession(seller);
      return;
    }

    throw new Error('Usuário ou senha inválidos. Verifique os dados informados.');
  }

  /** Monta a sessão de um usuário vindo da tabela de usuários do Firestore. */
  private startUsuarioTabelaSession(usuario: {
    id: string;
    login: string;
    nome: string;
    empresa: string;
    empresaId: string;
    role: UserRole;
  }): void {
    const session: SellerSession = {
      sellerId: usuario.id,
      empresa: usuario.empresa,
      login: usuario.login,
      nome: usuario.nome,
      loggedAt: new Date().toISOString(),
      empresaId: usuario.empresaId,
      role: usuario.role,
    };
    this.openSession(session);
  }

  /** Monta a sessão de um vendedor externo autenticado no ERP (RF001). */
  private startSellerSession(seller: {
    id: string;
    login: string;
    empresa: string;
    nome: string;
  }): void {
    // Vínculo usuário ↔ empresa: o papel vem da base de usuários de acesso
    // (quando existir); a empresa é resolvida pelo rótulo do ERP e criada se
    // necessário. Sem rótulo, a sessão fica sem empresaId (modo legado).
    const perfil = this.usuarios.bySellerId(seller.id);
    const empresa = seller.empresa.trim() ? this.empresas.resolveByNome(seller.empresa) : null;

    const session: SellerSession = {
      sellerId: seller.id,
      empresa: seller.empresa,
      login: seller.login,
      nome: seller.nome,
      loggedAt: new Date().toISOString(),
      ...(empresa ? { empresaId: empresa.id } : {}),
      role: perfil?.role ?? 'vendedor',
    };
    this.openSession(session);
  }

  /**
   * Abre a sessão da administração da plataforma após o login no Firebase
   * Authentication (/admin/login). Reusa o mesmo modelo de sessão
   * (`SellerSession`) para que shell, guards e isolamento de workspace
   * funcionem sem caminho de sessão paralelo: papel `admin-plataforma`,
   * empresa "Plataforma" e sem `empresaId` (a plataforma não pertence a
   * nenhuma empresa).
   */
  openAdminSession(identity: AdminIdentity): void {
    this.openSession({
      sellerId: `admin:${identity.uid}`,
      empresa: 'Plataforma',
      login: identity.email,
      nome: identity.nome?.trim() || identity.email,
      loggedAt: new Date().toISOString(),
      role: 'admin-plataforma',
    });
  }

  private openSession(session: SellerSession): void {
    this.state.set(session);

    if (this.isBrowser) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  }

  /** RNF007 - logout acionado pelo logo da aplicação na tela principal. */
  logout(): void {
    this.state.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private restoreSession(): void {
    if (this.state() !== null) {
      return;
    }

    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const session = JSON.parse(saved) as Partial<SellerSession>;
      // Sessões gravadas antes do RF018 não têm sellerId (só login/nome):
      // são inválidas — descarta e força novo login em vez de contaminar
      // os pedidos com login/nome no campo sellerId.
      if (!session.sellerId) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      this.state.set(session as SellerSession);
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }
}
