import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmpresasComponent } from './empresas.component';
import { EmpresaService } from '../../core/services/empresa.service';
import { NotificationService } from '../../core/services/notification.service';
import { UsuarioFirestoreService } from '../../core/services/usuario-firestore.service';
import { UsuarioAcessoService } from '../../core/services/usuario-acesso.service';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import {
  SALESFORCE_AUTH_ADAPTER,
  SalesforceAuthAdapter,
} from '../../core/data/firebase-auth.adapter';
import { Empresa } from '../../core/models/empresa.model';

/** Adapter em memória: provisiona a conta sem rede (fluxo opção 2). */
class FakeSalesforceAuthAdapter implements SalesforceAuthAdapter {
  async signIn(email: string) {
    return { uid: 'uid-teste', email, nome: 'Usuário Teste' };
  }
  async signOut(): Promise<void> {}
  async sendPasswordReset(): Promise<void> {}
  async createUser(email: string) {
    return { uid: `uid-${email}` };
  }
}

/** Stub do serviço de usuários do Firestore (criação de perfil + busca por UID). */
const usuariosStub = {
  criarPerfilParaEmpresa: async (uid: string, empresa: Empresa) => ({
    uid,
    login: empresa.contato.email.toLowerCase(),
  }),
  buscarPorUid: async () => null,
};

describe('EmpresasComponent (cadastro de empresas)', () => {
  let service: EmpresaService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EmpresasComponent],
      providers: [
        EmpresaService,
        NotificationService,
        UsuarioAcessoService,
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        { provide: SALESFORCE_AUTH_ADAPTER, useClass: FakeSalesforceAuthAdapter },
        { provide: UsuarioFirestoreService, useValue: usuariosStub },
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(EmpresaService);
  });

  /** Preenche o formulário com um cadastro completo e válido. */
  function preencherFormulario(cmp: EmpresasComponent): void {
    cmp.nome.set('GAMA Comércio');
    cmp.tenant.set('gama-comercio');
    cmp.razaoSocial.set('Gama Comercio e Distribuicao Ltda');
    cmp.cnpj.set('11444777000161');
    cmp.contatoNome.set('Ana Gama');
    cmp.contatoEmail.set('ana@gama.com.br');
    cmp.contatoTelefone.set('(11) 3000-1000');
  }

  it('deve criar o componente com a semente de demonstração', () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.empresas().length).toBe(2);
  });

  it('salvar() cadastra a empresa completa e limpa o formulário', async () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;

    preencherFormulario(cmp);
    await cmp.salvar();

    expect(cmp.erro()).toBe('');
    expect(service.empresas().length).toBe(3);
    expect(service.empresas()[2].nome).toBe('GAMA Comércio');
    expect(service.empresas()[2].tenant).toBe('gama-comercio');
    expect(cmp.nome()).toBe('');
    expect(cmp.editandoId()).toBeNull();
  });

  it('salvar() expõe o erro de validação e não cadastra nada com o cadastro incompleto', async () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;

    await cmp.salvar();

    expect(cmp.erro()).toBe('Informe o nome da empresa.');
    expect(service.empresas().length).toBe(2);

    // Corrige o nome, mas esquece os demais campos obrigatórios.
    cmp.nome.set('GAMA Comércio');
    await cmp.salvar();
    expect(cmp.erro()).toBe('Informe o identificador curto (tenant) da empresa.');
    expect(service.empresas().length).toBe(2);
  });

  it('editar() carrega a empresa no formulário e salvar() atualiza em vez de duplicar', async () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;
    const beta = service.empresas()[1];

    cmp.editar(beta);
    expect(cmp.editandoId()).toBe(beta.id);
    expect(cmp.nome()).toBe(beta.nome);
    expect(cmp.razaoSocial()).toBe(beta.razaoSocial);

    cmp.razaoSocial.set('Beta Distribuidora de Alimentos Ltda');
    await cmp.salvar();

    expect(cmp.editandoId()).toBeNull();
    expect(service.empresas().length).toBe(2);
    expect(service.byId(beta.id)?.razaoSocial).toBe('Beta Distribuidora de Alimentos Ltda');
  });

  it('salvar() provisiona a conta no Authentication e expõe o acesso criado', async () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;

    preencherFormulario(cmp);
    await cmp.salvar();

    expect(cmp.erro()).toBe('');
    expect(service.empresas().length).toBe(3);
    expect(cmp.credenciais()?.login).toBe('ana@gama.com.br');
    expect(cmp.credenciais()?.uid).toBe('uid-ana@gama.com.br');
  });

  it('salvar() desfaz a empresa quando o provisionamento do acesso falha', async () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;
    const usuarios = TestBed.inject(UsuarioFirestoreService);
    vi.spyOn(usuarios, 'criarPerfilParaEmpresa').mockRejectedValue(new Error('Firestore fora do ar'));

    preencherFormulario(cmp);
    await cmp.salvar();

    expect(service.empresas().length).toBe(2);
    expect(cmp.credenciais()).toBeNull();
    expect(cmp.erro()).toContain('Empresa não cadastrada');
  });

  it('alternarStatus() desativa e reativa a empresa', () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;
    const nova = service.empresas()[0];

    cmp.alternarStatus(nova);
    expect(service.byId(nova.id)?.status).toBe('inativa');
    expect(cmp.ativas().length).toBe(1);

    cmp.alternarStatus(service.byId(nova.id)!);
    expect(service.ativas().length).toBe(2);
  });

  it('remover() apaga a empresa com confirmação', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(EmpresasComponent);
    const beta = service.empresas()[1];

    fixture.componentInstance.remover(beta);

    expect(service.byId(beta.id)).toBeNull();
    expect(service.empresas().length).toBe(1);
  });

  it('não remove quando o usuário cancela a confirmação', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fixture = TestBed.createComponent(EmpresasComponent);
    const beta = service.empresas()[1];

    fixture.componentInstance.remover(beta);

    expect(service.byId(beta.id)).not.toBeNull();
  });
});
