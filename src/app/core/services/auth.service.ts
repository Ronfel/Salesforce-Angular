import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { LoginCredentials, SellerSession } from '../models/sales.models';
import { SALES_REPOSITORY } from '../data/sales.repository';

const SESSION_KEY = 'nexus-sales-session-v1';

/**
 * Autenticação de usuários no Web Service (RNF006) com login único (RNF007):
 * a sessão fica gravada no dispositivo e só é encerrada pelo logout, que na
 * tela principal é acionado ao clicar no logo da aplicação.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(SALES_REPOSITORY);
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

  /**
   * RF001 - Efetuar Login: valida Usuário e Senha no servidor.
   * A verificação exige conexão com a internet (RNF006).
   */
  async login(credentials: LoginCredentials): Promise<void> {
    if (!credentials.login.trim() || !credentials.senha) {
      throw new Error('Preencha Usuário e Senha para efetuar o login.');
    }

    if (this.isBrowser && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sem conexão com a internet. A verificação do login exige estar online.');
    }

    const seller = await this.repository.authenticate(credentials);
    if (!seller) {
      throw new Error('Usuário ou senha inválidos. Verifique os dados informados.');
    }

    const session: SellerSession = {
      empresa: seller.empresa,
      login: seller.login,
      nome: seller.nome,
      loggedAt: new Date().toISOString(),
    };
    this.state.set(session);

    if (this.isBrowser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  /** RNF007 - logout acionado pelo logo da aplicação na tela principal. */
  logout(): void {
    this.state.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private restoreSession(): void {
    if (this.state() !== null) {
      return;
    }

    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) {
      return;
    }

    try {
      this.state.set(JSON.parse(saved) as SellerSession);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}
