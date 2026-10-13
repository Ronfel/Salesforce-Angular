import { TestBed } from '@angular/core/testing';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { AuthService } from './auth.service';
import { SESSION_STORAGE_KEY } from '../models/sales.models';

/**
 * O login contra o ERP estabelece empresaId + role na sessão; a administração
 * da plataforma abre a sessão via `openAdminSession` após autenticar no
 * Firebase; sessões legadas seguem sem papel nem empresa.
 */
describe('AuthService (sessão, empresa e papel)', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [{ provide: SALES_REPOSITORY, useValue: createMockSalesRepository() }],
    });
  });

  it('vincula a sessão do vendedor à empresa resolvida pelo rótulo do ERP', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    expect(auth.session()?.empresaId).toBe('emp-nova');
    expect(auth.empresaId()).toBe('emp-nova');
  });

  it('atribui papel vendedor quando não há perfil de acesso cadastrado', async () => {
    const auth = TestBed.inject(AuthService);
    await auth.login({ login: 'rodrigo', senha: '123456' });

    expect(auth.role()).toBe('vendedor');
    expect(auth.isAdmin()).toBe(false);
    expect(auth.can('operar-comercial')).toBe(true);
    expect(auth.can('gerenciar-empresas')).toBe(false);
  });

  it('resolve a empresa do vendedor pela base em memória (criação coberta no EmpresaService)', async () => {
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

  it('rejeita credenciais fora da base de vendedores do ERP (admin não entra por /login)', async () => {
    const auth = TestBed.inject(AuthService);

    await expect(auth.login({ login: 'admin', senha: 'admin123' })).rejects.toThrow('inválidos');
    await expect(auth.login({ login: 'rodrigo', senha: 'errada' })).rejects.toThrow('inválidos');
    await expect(auth.login({ login: 'fulano', senha: '123456' })).rejects.toThrow('inválidos');
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
    await auth.login({ login: 'rodrigo', senha: '123456' });

    const saved = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) ?? '{}');
    expect(saved.empresaId).toBe('emp-nova');
    expect(saved.role).toBe('vendedor');
  });
});
