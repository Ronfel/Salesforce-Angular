import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Empresa,
  EmpresaInput,
  EmpresaStatus,
  ERP_PROVIDER_LABELS,
  ErpProvider,
  formatCnpj,
} from '../../core/models/empresa.model';
import { EmpresaService } from '../../core/services/empresa.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Tela de Empresas — área administrativa da plataforma: cadastro das empresas
 * que utilizarão o Salesforce.
 *
 * Cadastro mínimo: nome, identificador (tenant), razão social, CNPJ e
 * contato comercial; a integração (provedor/URL base) é opcional e NÃO dispara
 * conexão com o ERP — a conexão é testada na tela de Conexões.
 * Suporta criação e edição. Acesso restrito à sessão admin-plataforma
 * (guard da rota /empresas).
 */
@Component({
  selector: 'app-empresas',
  templateUrl: './empresas.component.html',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
})
export class EmpresasComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly notify = inject(NotificationService);

  /** Empresas cadastradas (fonte de verdade vinda do serviço). */
  readonly empresas = this.empresaService.empresas;

  /** Empresas em situação ativa. */
  readonly ativas = this.empresaService.ativas;

  /** Opções do select de provedor de integração. */
  readonly provedores = Object.entries(ERP_PROVIDER_LABELS) as [ErpProvider, string][];

  /** Formata o CNPJ na listagem. */
  readonly formatCnpj = formatCnpj;

  // ---- Campos do formulário de criação/edição ----
  readonly nome = signal('');
  readonly tenant = signal('');
  readonly razaoSocial = signal('');
  readonly cnpj = signal('');
  readonly contatoNome = signal('');
  readonly contatoEmail = signal('');
  readonly contatoTelefone = signal('');
  readonly provedor = signal<ErpProvider>('nenhum');
  readonly baseUrl = signal('');

  /** Id da empresa em edição (null = modo criação). */
  readonly editandoId = signal<string | null>(null);

  /** Primeiro erro de validação do formulário (vindo do serviço). */
  readonly erro = signal('');

  /** Mapeamento de campos preservado na edição (vazio na criação). */
  private readonly mapeamento = signal<Record<string, string>>({});

  /** Valida, persiste (criar/editar) e limpa o formulário. */
  salvar(): void {
    const input = this.montarInput();
    const erro = this.empresaService.validate(input, this.editandoId());
    if (erro) {
      this.erro.set(erro);
      this.notify.error(erro);
      return;
    }
    this.erro.set('');

    const editando = this.editandoId();
    if (editando) {
      const salva = this.empresaService.update(editando, input);
      if (!salva) {
        return;
      }
      this.notify.success(`Empresa "${salva.nome}" atualizada.`);
    } else {
      const criada = this.empresaService.add(input);
      if (!criada) {
        return;
      }
      this.notify.success(`Empresa "${criada.nome}" cadastrada.`);
    }
    this.limpar();
  }

  /** Carrega a empresa no formulário para edição. */
  editar(empresa: Empresa): void {
    this.nome.set(empresa.nome);
    this.tenant.set(empresa.tenant);
    this.razaoSocial.set(empresa.razaoSocial);
    this.cnpj.set(empresa.cnpj);
    this.contatoNome.set(empresa.contato.nome);
    this.contatoEmail.set(empresa.contato.email);
    this.contatoTelefone.set(empresa.contato.telefone);
    this.provedor.set(empresa.integracao.provedor);
    this.baseUrl.set(empresa.integracao.baseUrl);
    this.mapeamento.set({ ...empresa.integracao.mapeamento });
    this.editandoId.set(empresa.id);
    this.erro.set('');
  }

  /** Limpa o formulário e volta ao modo criação. */
  limpar(): void {
    this.nome.set('');
    this.tenant.set('');
    this.razaoSocial.set('');
    this.cnpj.set('');
    this.contatoNome.set('');
    this.contatoEmail.set('');
    this.contatoTelefone.set('');
    this.provedor.set('nenhum');
    this.baseUrl.set('');
    this.mapeamento.set({});
    this.editandoId.set(null);
    this.erro.set('');
  }

  /** Ativa ou desativa a empresa (liberação de uso). */
  alternarStatus(empresa: Empresa): void {
    const status: EmpresaStatus = empresa.status === 'ativa' ? 'inativa' : 'ativa';
    this.empresaService.setStatus(empresa.id, status);
    this.notify.success(
      `Empresa "${empresa.nome}" ${status === 'ativa' ? 'ativada' : 'desativada'}.`,
    );
  }

  /** Remove a empresa (com confirmação). */
  remover(empresa: Empresa): void {
    if (
      !window.confirm(
        `Remover a empresa "${empresa.nome}"? Os dados de venda por empresa permanecem no dispositivo.`,
      )
    ) {
      return;
    }
    this.empresaService.remove(empresa.id);
    if (this.editandoId() === empresa.id) {
      this.limpar();
    }
    this.notify.success(`Empresa "${empresa.nome}" removida.`);
  }

  private montarInput(): EmpresaInput {
    return {
      nome: this.nome(),
      tenant: this.tenant(),
      razaoSocial: this.razaoSocial(),
      cnpj: this.cnpj(),
      contato: {
        nome: this.contatoNome(),
        email: this.contatoEmail(),
        telefone: this.contatoTelefone(),
      },
      integracao: {
        provedor: this.provedor(),
        baseUrl: this.baseUrl(),
        mapeamento: { ...this.mapeamento() },
      },
    };
  }
}
