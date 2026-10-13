import { TestBed } from '@angular/core/testing';
import {
  AdminAuthAdapter,
  AdminIdentity,
  ADMIN_AUTH_ADAPTER,
} from '../data/admin-auth.adapter';
import { AdminAuthService } from './admin-auth.service';

type SignInFn = (email: string, senha: string) => Promise<AdminIdentity>;
type SignOutFn = () => Promise<void>;

describe('AdminAuthService (login da área administrativa)', () => {
  const identity: AdminIdentity = {
    uid: 'fb-uid-1',
    email: 'admin@plataforma.com',
    nome: 'Administrador',
  };
  let signIn: ReturnType<typeof vi.fn<SignInFn>>;
  let signOut: ReturnType<typeof vi.fn<SignOutFn>>;

  beforeEach(() => {
    signIn = vi.fn<SignInFn>().mockResolvedValue(identity);
    signOut = vi.fn<SignOutFn>().mockResolvedValue(undefined);
    const adapter: AdminAuthAdapter = {
      signIn: (email, senha) => signIn(email, senha),
      signOut: () => signOut(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ADMIN_AUTH_ADAPTER, useValue: adapter }],
    });
  });

  it('signIn() devolve a identidade do Firebase com o e-mail normalizado', async () => {
    const service = TestBed.inject(AdminAuthService);

    const resultado = await service.signIn('  admin@plataforma.com  ', 'segredo');

    expect(resultado).toEqual(identity);
    expect(signIn).toHaveBeenCalledWith('admin@plataforma.com', 'segredo');
  });

  it('signIn() exige e-mail e senha antes de acionar o Firebase', async () => {
    const service = TestBed.inject(AdminAuthService);

    await expect(service.signIn('', 'segredo')).rejects.toThrow(
      'Informe e-mail e senha para acessar a área administrativa.',
    );
    await expect(service.signIn('admin@plataforma.com', '')).rejects.toThrow(
      'Informe e-mail e senha para acessar a área administrativa.',
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signIn() traduz os códigos do Firebase para mensagens em pt-BR', async () => {
    const service = TestBed.inject(AdminAuthService);
    signIn.mockRejectedValue(
      Object.assign(new Error('raw'), { code: 'auth/invalid-credential' }),
    );

    await expect(service.signIn('admin@plataforma.com', 'errada')).rejects.toThrow(
      'E-mail ou senha inválidos.',
    );

    signIn.mockRejectedValue(Object.assign(new Error('raw'), { code: 'auth/too-many-requests' }));
    await expect(service.signIn('admin@plataforma.com', 'x')).rejects.toThrow(
      'Muitas tentativas de acesso.',
    );
  });

  it('signIn() devolve erro genérico quando o Firebase falha sem código', async () => {
    const service = TestBed.inject(AdminAuthService);
    signIn.mockRejectedValue(Object.assign(new Error('boom'), { code: 'auth/unknown' }));

    await expect(service.signIn('admin@plataforma.com', 'x')).rejects.toThrow(
      'Não foi possível autenticar: boom',
    );
  });

  it('logout() encerra a sessão no Firebase', async () => {
    const service = TestBed.inject(AdminAuthService);

    await service.logout();

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('logout() não bloqueia quando o Firebase falha (a sessão local é do AuthService)', async () => {
    const service = TestBed.inject(AdminAuthService);
    signOut.mockRejectedValue(new Error('rede fora'));

    await expect(service.logout()).resolves.toBeUndefined();
  });
});