import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * UID do Firebase Authentication autorizado a acessar a área administrativa
 * (/admin). A restrição é aplicada em duas camadas: `AdminAuthService.signIn`
 * (encerra a sessão de qualquer outro UID) e `adminAuthGuard` (confere a
 * sessão aberta).
 */
export const ADMIN_UID_PERMITIDO = 'YmX7asMWDEcCPkQMtHrgaz1wVOV2';

/** Identidade do administrador autenticado no Firebase Authentication. */
export interface AdminIdentity {
  uid: string;
  email: string;
  nome: string | null;
}

/**
 * Contrato de autenticação da área administrativa (/admin).
 *
 * A implementação padrão usa Firebase Authentication (e-mail/senha), carregado
 * com import dinâmico no mesmo padrão dos demais adapters do projeto. Os testes
 * injetam uma implementação em memória para não depender de rede.
 */
export interface AdminAuthAdapter {
  signIn(email: string, senha: string): Promise<AdminIdentity>;
  signOut(): Promise<void>;
}

export const ADMIN_AUTH_ADAPTER = new InjectionToken<AdminAuthAdapter>('ADMIN_AUTH_ADAPTER');

/** Adapter Firebase Auth (e-mail/senha) — login da área /admin. */
export class FirebaseAdminAuthAdapter implements AdminAuthAdapter {
  async signIn(email: string, senha: string): Promise<AdminIdentity> {
    const [firebaseApp, firebaseAuth] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    const app =
      firebaseApp.getApps().length > 0
        ? firebaseApp.getApp()
        : firebaseApp.initializeApp(environment.firebase);
    const credential = await firebaseAuth.signInWithEmailAndPassword(
      firebaseAuth.getAuth(app),
      email,
      senha,
    );
    return {
      uid: credential.user.uid,
      email: credential.user.email ?? email,
      nome: credential.user.displayName,
    };
  }

  async signOut(): Promise<void> {
    const [firebaseApp, firebaseAuth] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
    ]);
    if (firebaseApp.getApps().length === 0) {
      return;
    }
    await firebaseAuth.signOut(firebaseAuth.getAuth(firebaseApp.getApp()));
  }
}