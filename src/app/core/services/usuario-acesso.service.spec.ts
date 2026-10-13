import { TestBed } from '@angular/core/testing';
import { UsuarioAcessoService } from './usuario-acesso.service';

const STORAGE_KEY = 'nx.usuarios-acesso.v1';

describe('UsuarioAcessoService (Fase 1 - vínculo usuário ↔ empresa)', () => {
  let service: UsuarioAcessoService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsuarioAcessoService);
  });

  it('semeia a base de demonstração com admin, rodrigo e mariana', () => {
    expect(service.usuarios().length).toBe(3);
    expect(service.byLogin('admin')?.role).toBe('admin-plataforma');
    expect(service.byLogin('admin')?.empresaId).toBeNull();
  });

  it('byLogin() ignora maiúsculas e espaços nas bordas', () => {
    expect(service.byLogin('  ADMIN ')?.id).toBe('usr-admin');
    expect(service.byLogin('inexistente')).toBeNull();
  });

  it('mantém o vínculo dos vendedores com a empresa e o registro do ERP', () => {
    const rodrigo = service.bySellerId('seller-1');

    expect(rodrigo?.login).toBe('rodrigo');
    expect(rodrigo?.role).toBe('vendedor');
    expect(rodrigo?.empresaId).toBe('emp-nova');
    expect(service.byLogin('mariana')?.sellerId).toBe('seller-2');
  });

  it('byEmpresa() lista apenas os usuários da empresa pedida', () => {
    const daNova = service.byEmpresa('emp-nova');
    const daPlataforma = service.byEmpresa(null);

    expect(daNova.map((usuario) => usuario.login)).toEqual(['rodrigo', 'mariana']);
    expect(daPlataforma.map((usuario) => usuario.login)).toEqual(['admin']);
  });

  it('não guarda senha local — a autenticação é do ERP (vendedor) ou do Firebase (admin)', () => {
    const admin = service.byLogin('admin');

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('admin-plataforma');
    expect('senha' in admin!).toBe(false);
  });

  it('setAtivo() ativa e desativa o usuário de acesso', () => {
    const admin = service.byLogin('admin')!;

    service.setAtivo(admin.id, false);
    expect(service.byId(admin.id)?.ativo).toBe(false);

    service.setAtivo(admin.id, true);
    expect(service.byId(admin.id)?.ativo).toBe(true);
  });

  it('add() cadastra um usuário já vinculado a empresa e papel (sem senha local)', () => {
    const criado = service.add({
      login: 'carla',
      nome: 'Carla Souza',
      role: 'admin-empresa',
      empresaId: 'emp-beta',
    });

    expect(criado?.empresaId).toBe('emp-beta');
    expect(criado?.role).toBe('admin-empresa');
    expect(service.byLogin('carla')?.nome).toBe('Carla Souza');
    expect('senha' in criado!).toBe(false);
  });

  it('add() ignora dados incompletos', () => {
    expect(service.add({ login: '', nome: 'X', role: 'vendedor', empresaId: null })).toBeNull();
    expect(service.add({ login: 'x', nome: '   ', role: 'vendedor', empresaId: null })).toBeNull();
    expect(service.usuarios().length).toBe(3);
  });

  it('setRole() e setEmpresa() atualizam papel e vínculo da empresa', () => {
    const mariana = service.byLogin('mariana')!;

    service.setRole(mariana.id, 'admin-empresa');
    service.setEmpresa(mariana.id, 'emp-beta');

    expect(service.byId(mariana.id)?.role).toBe('admin-empresa');
    expect(service.byId(mariana.id)?.empresaId).toBe('emp-beta');
  });

  it('remove() apaga o usuário de acesso', () => {
    const mariana = service.byLogin('mariana')!;

    service.remove(mariana.id);

    expect(service.byId(mariana.id)).toBeNull();
    expect(service.usuarios().length).toBe(2);
  });

  it('persiste as alterações em localStorage', () => {
    const admin = service.byLogin('admin')!;
    service.setRole(admin.id, 'admin-empresa');

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(saved.find((item: { id: string }) => item.id === 'usr-admin').role).toBe('admin-empresa');
  });
});
