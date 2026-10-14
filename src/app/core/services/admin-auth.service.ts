import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import {
  AdminIdentity,
  ADMIN_AUTH_ADAPTER,
  ADMIN_UID_PERMITIDO,
} from '../data/admin-auth.adapter';

/** Traduz os códigos de erro do Firebase Authentication para mensagens em pt-BR. */
function mapAuthError(error: unknown): Error {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return new Error('E-mail inválido.');
    case 'auth/missing-password':
      return new Error('Informe a senha.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('E-mail ou senha inválidos.');
    case 'auth/too-many-requests':
      return new Error('Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.');
    case 'auth/network-request-failed':
      return new Error('Sem conexão com a internet. Verifique a rede e tente novamente.');
    case 'auth/operation-not-allowed':
    case 'auth/configuration-not-found':
      return new Error(
        'Autenticação por e-mail/senha não está habilitada neste projeto. ' +
          'Ative "E-mail/senha" no Firebase Console (Authentication → Sign-in method).',
      );
    default:
      return error instanceof Error
        ? new Error(`Não foi possível autenticar: ${error.message}`)
        : new Error('Não foi possível autenticar. Tente novamente.');
  }
}

/**
 * Autenticação da área administrativa (/admin/login) usando Firebase
 * Authentication (e-mail/senha): o frontend não guarda credenciais de
 * administrador — elas vivem no Firebase.
 *
 * Esta serviço apenas autentica e devolve a identidade. A sessão é aberta pelo
 * `AuthService` (fonte única de sessão, junto com a do vendedor) via
 * `openAdminSession`, para que shell, guards e isolamento de workspace
 * funcionem sem um caminho de sessão paralelo.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly adapter = inject(ADMIN_AUTH_ADAPTER);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Autentica o administrador no Firebase Authentication (exige conexão) e
   * devolve a identidade usada para abrir a sessão (`AuthService.openAdminSession`).
   *
   * RESTRITO a um único UID (`ADMIN_UID_PERMITIDO`): qualquer outra conta do
   * Authentication tem a sessão encerrada na hora e recebe "acesso restrito".
   */
  async signIn(email: string, senha: string): Promise<AdminIdentity> {
    if (!email.trim() || !senha) {
      throw new Error('Informe e-mail e senha para acessar a área administrativa.');
    }
    if (this.isBrowser && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sem conexão com a internet. A verificação do login exige estar online.');
    }
    try {
      const identity = await this.adapter.signIn(email.trim(), senha);
      if (identity.uid !== ADMIN_UID_PERMITIDO) {
        await this.adapter.signOut().catch(() => undefined);
        throw new Error('Acesso restrito ao administrador da plataforma.');
      }
      return identity;
    } catch (error) {
      if (error instanceof Error && error.message === 'Acesso restrito ao administrador da plataforma.') {
        throw error;
      }
      throw mapAuthError(error);
    }
  }

  /** Encerra a sessão no Firebase Authentication (a sessão local é do AuthService). */
  async logout(): Promise<void> {
    try {
      await this.adapter.signOut();
    } catch {
      // Falha no Firebase não bloqueia o encerramento da sessão local.
    }
  }
}