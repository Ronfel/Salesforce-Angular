import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Identidade de um usuário do Salesforce autenticado no Firebase Authentication. */
export interface SalesforceIdentity {
  uid: string;
  email: string;
  nome: string | null;
}

/**
 * Contrato de autenticação do Salesforce (/login) no Firebase Authentication.
 *
 * - `signIn`/`signOut`/`sendPasswordReset` operam sobre a instância principal
 *   (a sessão do usuário logado);
 * - `createUser` provisiona o acesso de uma empresa recém-cadastrada numa
 *   instância SECONDÁRIA (`provisionamento`), para não derrubar a sessão do
 *   administrador que está cadastrando, e já dispara o e-mail OFICIAL do
 *   Firebase de definição de senha — a empresa define a própria senha pelo
 *   link recebido (o sistema nunca conhece nem envia senha em texto).
 *
 * A implementação padrão usa o SDK `firebase/auth` com import dinâmico, no
 * mesmo padrão dos demais adapters. Os testes injetam uma implementação em
 * memória (ou nada — o `AuthService` trata o adapter ausente como
 * "Firebase indisponível" e segue para o fallback do ERP).
 */
export interface SalesforceAuthAdapter {
  signIn(email: string, senha: string): Promise<SalesforceIdentity>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  createUser(email: string, senhaTemporaria: string, nome: string): Promise<{ uid: string }>;
}

export const SALESFORCE_AUTH_ADAPTER = new InjectionToken<SalesforceAuthAdapter>(
  'SALESFORCE_AUTH_ADAPTER',
);

type FirebaseAppModule = typeof import('firebase/app');
type FirebaseAuthModule = typeof import('firebase/auth');

async function carregarSdk(): Promise<[FirebaseAppModule, FirebaseAuthModule]> {
  return Promise.all([import('firebase/app'), import('firebase/auth')]);
}

function appPrincipal(firebaseApp: FirebaseAppModule) {
  return firebaseApp.getApps().length > 0
    ? firebaseApp.getApp()
    : firebaseApp.initializeApp(environment.firebase);
}

/** Adapter Firebase Auth (e-mail/senha) — login do Salesforce e provisionamento de empresas. */
export class FirebaseSalesforceAuthAdapter implements SalesforceAuthAdapter {
  async signIn(email: string, senha: string): Promise<SalesforceIdentity> {
    const [firebaseApp, firebaseAuth] = await carregarSdk();
    const credential = await firebaseAuth.signInWithEmailAndPassword(
      firebaseAuth.getAuth(appPrincipal(firebaseApp)),
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
    const [firebaseApp, firebaseAuth] = await carregarSdk();
    if (firebaseApp.getApps().length === 0) {
      return;
    }
    await firebaseAuth.signOut(firebaseAuth.getAuth(firebaseApp.getApp()));
  }

  async sendPasswordReset(email: string): Promise<void> {
    const [firebaseApp, firebaseAuth] = await carregarSdk();
    await firebaseAuth.sendPasswordResetEmail(
      firebaseAuth.getAuth(appPrincipal(firebaseApp)),
      email,
    );
  }

  async createUser(
    email: string,
    senhaTemporaria: string,
    nome: string,
  ): Promise<{ uid: string }> {
    const [firebaseApp, firebaseAuth] = await carregarSdk();
    const secundario =
      firebaseApp.getApps().find((app) => app.name === 'provisionamento') ??
      firebaseApp.initializeApp(environment.firebase, 'provisionamento');
    const authSecundario = firebaseAuth.getAuth(secundario);
    try {
      const credential = await firebaseAuth.createUserWithEmailAndPassword(
        authSecundario,
        email,
        senhaTemporaria,
      );
      if (nome.trim()) {
        await firebaseAuth.updateProfile(credential.user, { displayName: nome.trim() });
      }
      // E-mail OFICIAL do Firebase para a empresa definir a própria senha.
      await firebaseAuth.sendPasswordResetEmail(authSecundario, email);
      return { uid: credential.user.uid };
    } finally {
      // Nunca mantém sessão no app secundário (o admin segue logado no principal).
      await firebaseAuth.signOut(authSecundario).catch(() => undefined);
    }
  }
}
