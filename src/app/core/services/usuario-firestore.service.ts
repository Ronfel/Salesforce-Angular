import { inject, Injectable } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { FIRESTORE_DATABASE } from '../data/sales.repository.providers';
import { Empresa, UserRole } from '../models/empresa.model';
import { LoginCredentials } from '../models/sales.models';
import { criptografarSenha, descriptografarSenha, gerarSenha } from '../utils/senha.utils';

/**
 * Registro da tabela de usuários (coleção `users` no Firestore) — a base que o
 * login do Salesforce consulta para autenticar empresas/usuários da plataforma.
 */
export interface UsuarioTabela {
  id: string;
  login: string;
  /** Senha criptografada de forma reversível (o login descriptografa para validar). */
  senha: string;
  nome: string;
  empresaId: string;
  /** Rótulo da empresa (usado direto na sessão, sem depender do cadastro local). */
  empresa: string;
  role: UserRole;
  ativo: boolean;
  createdAt: string;
}

/** Credenciais geradas ao cadastrar uma empresa (exibidas para o admin enviar). */
export interface CredenciaisGeradas {
  login: string;
  senha: string;
}

/**
 * Acesso à tabela de usuários do Firestore:
 * - ao cadastrar uma empresa, cria o usuário de acesso com a senha CRIPTOGRAFADA;
 * - no login do Salesforce, localiza o usuário e DESCRIPTOGRAFA a senha para
 *   validar as credenciais digitadas.
 */
@Injectable({ providedIn: 'root' })
export class UsuarioFirestoreService {
  private readonly database =
    inject(FIRESTORE_DATABASE, { optional: true }) ?? Promise.resolve(null);

  /**
   * Cria o usuário de acesso da empresa recém-cadastrada. O login é o e-mail
   * de contato da empresa e a senha é gerada aleatoriamente (devolvida em
   * claro só aqui, para o administrador enviar à empresa).
   */
  async criarParaEmpresa(empresa: Empresa): Promise<CredenciaisGeradas> {
    const database = await this.database;
    if (!database) {
      throw new Error('Firestore indisponível: o usuário de acesso não pode ser gravado.');
    }
    const sdk = await import('firebase/firestore');

    const login = (empresa.contato.email ?? '').trim().toLowerCase();
    if (!login) {
      throw new Error('Informe um e-mail de contato válido para gerar o login da empresa.');
    }

    const existentes = await this.lerTodos(database, sdk);
    if (existentes.some((usuario) => usuario.login.toLowerCase() === login)) {
      throw new Error(`Já existe um usuário com o login "${login}".`);
    }

    const senha = gerarSenha();
    await sdk.setDoc(sdk.doc(database, 'users', login), {
      login,
      senha: criptografarSenha(senha),
      nome: empresa.contato.nome?.trim() || empresa.nome,
      empresaId: empresa.id,
      empresa: empresa.nome,
      role: 'admin-empresa',
      ativo: true,
      createdAt: new Date().toISOString(),
    } satisfies Omit<UsuarioTabela, 'id'>);

    return { login, senha };
  }

  /**
   * Autentica contra a tabela `users`: encontra o usuário pelo login e
   * compara a senha digitada com a DESCRIPTOGRAFADA da base.
   * Erros de rede/permissão devolvem null (o login segue para a base de
   * vendedores do ERP).
   */
  async autenticar(credentials: LoginCredentials): Promise<UsuarioTabela | null> {
    const database = await this.database;
    if (!database) {
      return null;
    }
    try {
      const sdk = await import('firebase/firestore');
      const usuarios = await this.lerTodos(database, sdk);
      const login = credentials.login.trim().toLowerCase();
      const alvo = usuarios.find(
        (usuario) => usuario.ativo !== false && usuario.login.toLowerCase() === login,
      );
      if (!alvo) {
        return null;
      }
      return descriptografarSenha(alvo.senha) === credentials.senha ? alvo : null;
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
