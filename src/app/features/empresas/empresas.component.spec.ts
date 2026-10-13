import { TestBed } from '@angular/core/testing';
import { EmpresasComponent } from './empresas.component';
import { EmpresaService } from '../../core/services/empresa.service';
import { NotificationService } from '../../core/services/notification.service';

describe('EmpresasComponent (cadastro de empresas)', () => {
  let service: EmpresaService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EmpresasComponent],
      providers: [EmpresaService, NotificationService],
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

  it('salvar() cadastra a empresa completa e limpa o formulário', () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;

    preencherFormulario(cmp);
    cmp.salvar();

    expect(cmp.erro()).toBe('');
    expect(service.empresas().length).toBe(3);
    expect(service.empresas()[2].nome).toBe('GAMA Comércio');
    expect(service.empresas()[2].tenant).toBe('gama-comercio');
    expect(cmp.nome()).toBe('');
    expect(cmp.editandoId()).toBeNull();
  });

  it('salvar() expõe o erro de validação e não cadastra nada com o cadastro incompleto', () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;

    cmp.salvar();

    expect(cmp.erro()).toBe('Informe o nome da empresa.');
    expect(service.empresas().length).toBe(2);

    // Corrige o nome, mas esquece os demais campos obrigatórios.
    cmp.nome.set('GAMA Comércio');
    cmp.salvar();
    expect(cmp.erro()).toBe('Informe o identificador curto (tenant) da empresa.');
    expect(service.empresas().length).toBe(2);
  });

  it('editar() carrega a empresa no formulário e salvar() atualiza em vez de duplicar', () => {
    const fixture = TestBed.createComponent(EmpresasComponent);
    const cmp = fixture.componentInstance;
    const beta = service.empresas()[1];

    cmp.editar(beta);
    expect(cmp.editandoId()).toBe(beta.id);
    expect(cmp.nome()).toBe(beta.nome);
    expect(cmp.razaoSocial()).toBe(beta.razaoSocial);

    cmp.razaoSocial.set('Beta Distribuidora de Alimentos Ltda');
    cmp.salvar();

    expect(cmp.editandoId()).toBeNull();
    expect(service.empresas().length).toBe(2);
    expect(service.byId(beta.id)?.razaoSocial).toBe('Beta Distribuidora de Alimentos Ltda');
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
