import { TestBed } from '@angular/core/testing';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { SALESFORCE_AUTH_ADAPTER } from '../data/firebase-auth.adapter';
import { AuthService } from './auth.service';
import { SESSION_STORAGE_KEY } from '../models/sales.models';
import { UsuarioFirestoreService, UsuarioTabela } from './usuario-firestore.service';

/**
 * O login do Salesforce autentica no Firebase Authentication e monta a
 * sessão a partir do perfil da tabela `users` (doc = UID); sem Firebase ou
 * sem perfil, cai no fallback dos vendedores do ERP. A administração da
 * plataforma abre a sessão via `openAdminSession` após autenticar no
 * Firebase; sessões legadas seguem sem papel nem empresa.
 */
describe('AuthService (sessão, empresa e papel)', () => {
  const perfil: UsuarioTabela = {
    id: 'uid-ana',
    uid: 'uid-ana',
    login: 'ana@gama.com.br',
    nome: 'Ana Gama',
    empresaId: 'emp-gama',
    empresa: 'GAMA',
    role: 'admin-empresa',
    ativo: true,
    createdAt: new Date().toISOString(),
  };

  /** Adapter Firebase em memória; `falhar` simula o Firebase indisponível (fallback ERP). */
  let falharFirebase = false;

  beforeEach(async () => {
    localStorage.clear();
    falharFirebase = false;
    await TestBed.configureTestingModule({
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        {
          provide: SALESFORCE_AUTH_ADAPTER,
          useValue: {
            signIn: async (email: string, senha: string) => {
              if (falharFirebase) {
                throw new Error('firebase indisponível');
              }
              // Única conta presente no Authentication de teste; qualquer outro
              // login/senha (inclusive "admin" e "rodrigo") não existe lá e
              // devolve user-not-found, forçando o fallback do ERP.
              if (email === 'ana@gama.com.br' && senha === 'segredo') {
                return { uid: 'uid-ana', email, nome: 'Ana Gama' };
              }
              const error = new Error('Usuário ou senha inválidos.');
              (error as { code?: string }).code = 'auth/user-not-found';
              throw error;
            },
            signOut: async () => undefined,
            sendPasswordReset: async () => undefined,
            createUser: async () => ({ uid: 'uid-novo' }),
          },
        },
        {
          provide: UsuarioFirestoreService,
          useValue: { buscarPorUid: async () => perfil },
        },
      ],
    });
  });

  it('autentica no Firebase e monta a sessão a partir do perfil da tabela users', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'ana@gama.com.br', senha: 'segredo' });

    expect(auth.authenticated()).toBe(true);
    expect(auth.session()?.empresaId).toBe('emp-gama');
    expect(auth.session()?.empresa).toBe('GAMA');
    expect(auth.role()).toBe('admin-empresa');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.can('gerenciar-empresas')).toBe(false);
    expect(auth.can('operar-comercial')).toBe(true);
  });

  it('vincula a sessão do vendedor à empresa resolvida pelo rótulo do ERP', async () => {
    TestBed.overrideProvider(UsuarioFirestoreService, { useValue: { buscarPorUid: async () => null } });
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    expect(auth.session()?.empresaId).toBe('emp-nova');
    expect(auth.empresaId()).toBe('emp-nova');
  });

  it('atribui papel vendedor quando não há perfil de acesso cadastrado', async () => {
    TestBed.overrideProvider(UsuarioFirestoreService, { useValue: { buscarPorUid: async () => null } });
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    expect(auth.role()).toBe('vendedor');
    expect(auth.isAdmin()).toBe(false);
    expect(auth.can('operar-comercial')).toBe(true);
    expect(auth.can('gerenciar-empresas')).toBe(false);
  });

  it('resolve a empresa do vendedor pela base em memória (criação coberta no EmpresaService)', async () => {
    TestBed.overrideProvider(UsuarioFirestoreService, { useValue: { buscarPorUid: async () => null } });
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    expect(auth.session()?.empresaId).toBe('emp-nova');
    expect(auth.session()?.empresa).toBe('NOVA');
  });

  it('openAdminSession() abre a sessão da plataforma após o login no Firebase', () => {
    const auth = TestBed.inject(AuthService);
    auth.openAdminSession({
      uid: 'fb-1',
      email: 'admin@plataforma.com',
      nome: 'Admin da Plataforma',
    });

    expect(auth.authenticated()).toBe(true);
    expect(auth.role()).toBe('admin-plataforma');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.can('gerenciar-empresas')).toBe(true);
    // A plataforma não pertence a nenhuma empresa.
    expect(auth.empresaId()).toBeNull();
    expect(auth.session()?.empresa).toBe('Plataforma');
    expect(auth.session()?.sellerId).toBe('admin:fb-1');

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}');
    expect(saved.role).toBe('admin-plataforma');
  });

  it('rejeita credenciais fora da base quando Firebase e ERP falham (admin não entra por /login)', async () => {
    TestBed.overrideProvider(UsuarioFirestoreService, { useValue: { buscarPorUid: async () => null } });
    const auth = TestBed.inject(AuthService);

    await expect(auth.login({ login: 'admin', senha: 'admin123' })).rejects.toThrow('inválidos');
    await expect(auth.login({ login: 'fulano', senha: '123456' })).rejects.toThrow('inválidos');
    expect(auth.authenticated()).toBe(false);
  });

  it('propaga o erro do Firebase quando o ERP também não reconhece o vendedor (ex.: senha errada)', async () => {
    const auth = TestBed.inject(AuthService);

    await expect(auth.login({ login: 'rodrigo', senha: 'errada' })).rejects.toThrow('inválidos');
    expect(auth.authenticated()).toBe(false);
  });

  it('mantém a sessão legada (sem empresaId/role) autenticada em modo legado', async () => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        sellerId: 'seller-1',
        empresa: 'NOVA',
        login: 'rodrigo',
        nome: 'Rodrigo Neves',
        loggedAt: new Date().toISOString(),
      }),
    );

    const auth = TestBed.inject(AuthService);
    await auth.ready;

    expect(auth.authenticated()).toBe(true);
    expect(auth.empresaId()).toBeNull();
    expect(auth.role()).toBeNull();
    expect(auth.isAdmin()).toBe(false);
    expect(auth.can('gerenciar-empresas')).toBe(false);
  });

  it('persiste empresaId e role na sessão gravada (nova instância restaura os dois)', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'ana@gama.com.br', senha: 'segredo' });

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}');
    expect(saved.empresaId).toBe('emp-gama');
    expect(saved.role).toBe('admin-empresa');
  });

  it('persiste empresaId e role do vendedor ERP em fallback (sem perfil no Firestore)', async () => {
    TestBed.overrideProvider(UsuarioFirestoreService, { useValue: { buscarPorUid: async () => null } });
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}');
    expect(saved.empresaId).toBe('emp-nova');
    expect(saved.role).toBe('vendedor');
  });

  it('sendPasswordReset() delega o e-mail OFICIAL ao adapter do Firebase', async () => {
    const adapter = TestBed.inject(SALESFORCE_AUTH_ADAPTER) as {
      sendPasswordReset: (email: string) => Promise<void>;
    };
    const spy = vi.spyOn(adapter, 'sendPasswordReset');
    const auth = TestBed.inject(AuthService);

    await auth.sendPasswordReset('ana@gama.com.br');

    expect(spy).toHaveBeenCalledWith('ana@gama.com.br');
  });
});
