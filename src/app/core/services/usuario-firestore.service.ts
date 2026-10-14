import { inject, Injectable } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { FIRESTORE_DATABASE } from '../data/sales.repository.providers';
import { Empresa, UserRole } from '../models/empresa.model';

/**
 * Registro da tabela de usuários (coleção `users` no Firestore) — perfil de
 * acesso do Salesforce vinculado à conta do Firebase Authentication.
 *
 * O documento tem ID = UID do Authentication. A senha NÃO é gravada aqui: ela
 * vive só no Authentication e a empresa a define pelo e-mail OFICIAL do
 * Firebase enviado no cadastro (redefinição de senha).
 */
export interface UsuarioTabela {
  id: string;
  /** UID da conta no Firebase Authentication (igual ao ID do documento). */
  uid: string;
  login: string;
  nome: string;
  empresaId: string;
  /** Rótulo da empresa (usado direto na sessão, sem depender do cadastro local). */
  empresa: string;
  role: UserRole;
  ativo: boolean;
  createdAt: string;
}

/** Acesso provisionado ao cadastrar uma empresa (sem senha — definida pela empresa). */
export interface AcessoProvisionado {
  uid: string;
  login: string;
}

/**
 * Acesso à tabela de usuários do Firestore:
 * - ao cadastrar uma empresa, grava o PERFIL vinculado ao UID do
 *   Authentication (sem senha);
 * - no login do Salesforce, localiza o perfil pelo UID autenticado para montar
 *   a sessão (empresa + papel).
 */
@Injectable({ providedIn: 'root' })
export class UsuarioFirestoreService {
  private readonly database =
    inject(FIRESTORE_DATABASE, { optional: true }) ?? Promise.resolve(null);

  /**
   * Grava o perfil de acesso da empresa recém-cadastrada, vinculado ao UID da
   * conta criada no Authentication. O login é o e-mail de contato.
   */
  async criarPerfilParaEmpresa(uid: string, empresa: Empresa): Promise<AcessoProvisionado> {
    const database = await this.database;
    if (!database) {
      throw new Error('Firestore indisponível: o perfil de acesso não pode ser gravado.');
    }
    const login = (empresa.contato.email ?? '').trim().toLowerCase();
    if (!login) {
      throw new Error('Informe um e-mail de contato válido para gerar o login da empresa.');
    }
    if (!uid.trim()) {
      throw new Error('Conta de acesso inválida (UID vazio).');
    }
    const sdk = await import('firebase/firestore');

    const existentes = await this.lerTodos(database, sdk);
    if (existentes.some((usuario) => usuario.login.toLowerCase() === login && usuario.id !== uid)) {
      throw new Error(`Já existe um usuário com o login "${login}".`);
    }

    await sdk.setDoc(sdk.doc(database, 'users', uid), {
      uid,
      login,
      nome: empresa.contato.nome?.trim() || empresa.nome,
      empresaId: empresa.id,
      empresa: empresa.nome,
      role: 'admin-empresa',
      ativo: true,
      createdAt: new Date().toISOString(),
    } satisfies Omit<UsuarioTabela, 'id'>);

    return { uid, login };
  }

  /** Localiza o perfil pelo UID autenticado (null quando ausente/sem acesso). */
  async buscarPorUid(uid: string): Promise<UsuarioTabela | null> {
    const database = await this.database;
    if (!database || !uid.trim()) {
      return null;
    }
    try {
      const sdk = await import('firebase/firestore');
      const snap = await sdk.getDoc(sdk.doc(database, 'users', uid.trim()));
      if (!snap.exists()) {
        return null;
      }
      return { ...snap.data(), id: snap.id } as UsuarioTabela;
    } catch {
      return null;
    }
  }

  private async lerTodos(
    database: Firestore,
    sdk: typeof import('firebase/firestore'),
  ): Promise<UsuarioTabela[]> {
    const snapshot = await sdk.getDocs(sdk.collection(database, 'users'));
    return snapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as UsuarioTabela);
  }
}
