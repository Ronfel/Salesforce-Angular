import { TestBed } from '@angular/core/testing';
import { EmpresaInput } from '../models/empresa.model';
import { EmpresaService } from './empresa.service';

const STORAGE_KEY = 'nx.empresas.v1';

/** Cadastro completo e válido — base para os testes de validação. */
function inputValido(sobrescrever: Partial<EmpresaInput> = {}): EmpresaInput {
  return {
    nome: 'GAMA Comércio',
    tenant: 'gama-comercio',
    razaoSocial: 'Gama Comercio e Distribuicao Ltda',
    cnpj: '11444777000161',
    contato: { nome: 'Ana Gama', email: 'ana@gama.com.br', telefone: '(11) 3000-1000' },
    integracao: { provedor: 'nenhum', baseUrl: '', mapeamento: {} },
    ...sobrescrever,
  };
}

describe('EmpresaService (cadastro de empresas da plataforma)', () => {
  let service: EmpresaService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(EmpresaService);
  });

  it('semeia a base de demonstração com duas empresas ativas na primeira execução', () => {
    expect(service.empresas().length).toBe(2);
    expect(service.ativas().length).toBe(2);
    expect(service.empresas().map((empresa) => empresa.nome)).toEqual([
      'NOVA',
      'BETA Distribuidora',
    ]);
  });

  it('persiste a semente em localStorage para reuso entre execuções', () => {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.length).toBe(2);
  });

  describe('validate', () => {
    it('devolve null quando o cadastro está completo e não duplica dados', () => {
      expect(service.validate(inputValido())).toBeNull();
    });

    it('exige nome, tenant, razão social, CNPJ e contato', () => {
      expect(service.validate(inputValido({ nome: '   ' }))).toBe(
        'Informe o nome da empresa.',
      );
      expect(service.validate(inputValido({ tenant: '' }))).toBe(
        'Informe o identificador curto (tenant) da empresa.',
      );
      expect(service.validate(inputValido({ razaoSocial: '' }))).toBe(
        'Informe a razão social da empresa.',
      );
      expect(service.validate(inputValido({ cnpj: '12345678901234' }))).toBe(
        'Informe um CNPJ válido com 14 dígitos.',
      );
      const semNomeContato = inputValido({
        contato: { ...inputValido().contato, nome: '' },
      });
      expect(service.validate(semNomeContato)).toBe('Informe o nome do contato.');
      const emailRuim = inputValido({
        contato: { ...inputValido().contato, email: 'nao-eh-email' },
      });
      expect(service.validate(emailRuim)).toBe('Informe um e-mail válido de contato.');
    });

    it('aceita apenas letras minúsculas, números e hífens no tenant', () => {
      expect(service.validate(inputValido({ tenant: 'tem espaço' }))).toContain(
        'Identificador (tenant) inválido',
      );
      expect(service.validate(inputValido({ tenant: '-comeca-com-hifen' }))).toContain(
        'Identificador (tenant) inválido',
      );
      expect(service.validate(inputValido({ tenant: 'Gama-Comercio' }))).toBeNull();
    });

    it('impede nome e tenant já usados por outra empresa', () => {
      expect(service.validate(inputValido({ nome: 'nova' }))).toBe(
        'Já existe uma empresa cadastrada com o nome "nova".',
      );
      expect(service.validate(inputValido({ tenant: 'beta-distribuidora' }))).toBe(
        'Já existe uma empresa com o identificador "beta-distribuidora".',
      );
    });

    it('exige URL base apenas quando há provedor de integração selecionado', () => {
      const comProvedor = inputValido({
        integracao: { provedor: 'nexus-erp', baseUrl: '', mapeamento: {} },
      });
      expect(service.validate(comProvedor)).toBe(
        'Informe a URL base da API para o provedor de integração selecionado.',
      );

      const urlInvalida = inputValido({
        integracao: { provedor: 'nexus-erp', baseUrl: 'ftp://erp.exemplo.com', mapeamento: {} },
      });
      expect(service.validate(urlInvalida)).toBe(
        'A URL base da integração deve começar com http:// ou https://.',
      );

      const urlValida = inputValido({
        integracao: {
          provedor: 'nexus-erp',
          baseUrl: 'https://erp.exemplo.com/api',
          mapeamento: {},
        },
      });
      expect(service.validate(urlValida)).toBeNull();
    });
  });

  describe('add', () => {
    it('cadastra uma empresa ativa e a inclui na lista', () => {
      const criada = service.add(inputValido());

      expect(criada).not.toBeNull();
      expect(criada?.nome).toBe('GAMA Comércio');
      expect(criada?.status).toBe('ativa');
      expect(criada?.id).toMatch(/^emp_/);
      expect(service.empresas().length).toBe(3);
      expect(service.ativas().length).toBe(3);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').length).toBe(3);
    });

    it('devolve null e não altera a lista quando a validação falha', () => {
      expect(service.add(inputValido({ nome: '' }))).toBeNull();
      expect(service.add(inputValido({ nome: 'NOVA' }))).toBeNull();
      expect(service.empresas().length).toBe(2);
    });
  });

  describe('update', () => {
    it('atualiza o cadastro preservando id e createdAt', () => {
      const nova = service.empresas()[0];
      const antes = nova.createdAt;

      const atualizada = service.update(nova.id, inputValido());

      expect(atualizada).not.toBeNull();
      expect(atualizada?.id).toBe(nova.id);
      expect(atualizada?.createdAt).toBe(antes);
      expect(atualizada?.razaoSocial).toBe('Gama Comercio e Distribuicao Ltda');
      expect(atualizada?.contato.email).toBe('ana@gama.com.br');
      expect(service.byId(nova.id)?.nome).toBe('GAMA Comércio');
    });

    it('ignora a unicidade contra a própria empresa que está em edição', () => {
      const nova = service.empresas()[0];

      const atualizada = service.update(nova.id, inputValido({ nome: 'NOVA', tenant: 'nova' }));

      expect(atualizada).not.toBeNull();
      expect(atualizada?.id).toBe(nova.id);
      expect(atualizada?.razaoSocial).toBe('Gama Comercio e Distribuicao Ltda');
    });

    it('devolve null para id inexistente ou cadastro inválido', () => {
      expect(service.update('inexistente', inputValido())).toBeNull();
      expect(service.update(service.empresas()[0].id, inputValido({ cnpj: '1' }))).toBeNull();
    });
  });

  it('setStatus() ativa e desativa uma empresa (liberação de uso)', () => {
    const nova = service.empresas()[0];

    service.setStatus(nova.id, 'inativa');
    expect(service.byId(nova.id)?.status).toBe('inativa');
    expect(service.ativas().length).toBe(1);

    service.setStatus(nova.id, 'ativa');
    expect(service.ativas().length).toBe(2);
  });

  it('remove() apaga a empresa do cadastro', () => {
    const beta = service.empresas()[1];

    service.remove(beta.id);

    expect(service.byId(beta.id)).toBeNull();
    expect(service.empresas().length).toBe(1);
  });

  it('byId(null) devolve null (sessão sem empresa vinculada)', () => {
    expect(service.byId(null)).toBeNull();
    expect(service.byId(undefined)).toBeNull();
    expect(service.byId('inexistente')).toBeNull();
  });

  it('resolveByNome() encontra empresa existente sem diferenciar maiúsculas', () => {
    const resolvida = service.resolveByNome('nova');

    expect(resolvida.id).toBe('emp-nova');
    expect(service.empresas().length).toBe(2);
  });

  it('resolveByNome() cria o rótulo desconhecido sem duplicar em repetidas chamadas', () => {
    const criada = service.resolveByNome('DELTA Atacado');

    expect(criada.nome).toBe('DELTA Atacado');
    expect(service.empresas().length).toBe(3);
    expect(service.resolveByNome('delta ATACADO').id).toBe(criada.id);
    expect(service.empresas().length).toBe(3);
  });
});
