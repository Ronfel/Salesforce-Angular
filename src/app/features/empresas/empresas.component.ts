import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { AuthService } from '../../core/services/auth.service';
import { SALESFORCE_AUTH_ADAPTER } from '../../core/data/firebase-auth.adapter';
import { EmpresaService } from '../../core/services/empresa.service';
import { NotificationService } from '../../core/services/notification.service';
import { gerarSenha } from '../../core/utils/senha.utils';
import {
  AcessoProvisionado,
  UsuarioFirestoreService,
} from '../../core/services/usuario-firestore.service';

/**
 * Tela de Empresas — área administrativa da plataforma (/admin/empresas):
 * cadastro das empresas que utilizarão o Salesforce.
 *
 * A tela é INDEPENDENTE do sistema comercial: não renderiza dentro do shell
 * (sidebar/topbar do Salesforce) e apresenta apenas o próprio menu "Empresas".
 * O formulário fica oculto até o administrador clicar em "Adicionar empresa".
 *
 * Ao criar uma empresa, o sistema cria a conta no Firebase Authentication,
 * grava o perfil na tabela de usuários (`users`, doc = UID, sem senha) e
 * dispara o e-mail OFICIAL do Firebase para a empresa definir a própria
 * senha. O login do Salesforce (/login) autentica no Authentication e monta
 * a sessão a partir do perfil da tabela.
 *
 * O acesso a esta tela é restrito ao UID do administrador autorizado
 * (`ADMIN_UID_PERMITIDO`): a verificação acontece no `AdminAuthService.signIn`
 * e no `adminAuthGuard` (dupla camada).
 */
@Component({
  selector: 'app-empresas',
  templateUrl: './empresas.component.html',
  styleUrl: './empresas.component.scss',
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
  ],
})
export class EmpresasComponent {
  private readonly empresaService = inject(EmpresaService);
  private readonly notify = inject(NotificationService);
  private readonly usuarios = inject(UsuarioFirestoreService);
  private readonly salesforceAuth = inject(SALESFORCE_AUTH_ADAPTER, { optional: true });
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Empresas cadastradas (fonte de verdade vinda do serviço). */
  readonly empresas = this.empresaService.empresas;

  /** Empresas em situação ativa. */
  readonly ativas = this.empresaService.ativas;

  /** Opções do select de provedor de integração. */
  readonly provedores = Object.entries(ERP_PROVIDER_LABELS) as [ErpProvider, string][];

  /** Formata o CNPJ na listagem. */
  readonly formatCnpj = formatCnpj;

  /** Mensagens exibidas localmente (a tela não rendiza dentro do shell). */
  readonly notice = this.notify.notice;
  readonly errorMessage = this.notify.errorMessage;

  /** Formulário de cadastro/edição só aparece após "Adicionar empresa". */
  readonly formVisivel = signal(false);

  /** Acesso provisionado na criação (login + UID, sem senha — definida pela empresa). */
  readonly credenciais = signal<AcessoProvisionado | null>(null);

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

  /** Exibe o formulário limpo para cadastrar uma nova empresa. */
  adicionarEmpresa(): void {
    this.limpar();
    this.credenciais.set(null);
    this.formVisivel.set(true);
  }

  /** Valida, persiste (criar/editar) e limpa o formulário. */
  async salvar(): Promise<void> {
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
      this.limpar();
      return;
    }

    const criada = this.empresaService.add(input);
    if (!criada) {
      return;
    }

    // Cria a empresa, provisiona a conta no Authentication (app secundário, sem
    // derrubar a sessão do admin), grava o perfil na tabela `users` (doc = UID,
    // sem senha) e revela o acesso para o administrador acompanhar. O e-mail
    // OFICIAL do Firebase (definição de senha) já foi disparado no provisionamento.
    try {
      const login = (criada.contato.email ?? '').trim().toLowerCase();
      if (!this.salesforceAuth) {
        throw new Error('Firebase indisponível: o acesso da empresa não pode ser criado.');
      }
      const { uid } = await this.salesforceAuth.createUser(
        login,
        gerarSenha(12),
        criada.contato.nome?.trim() || criada.nome,
      );
      const acesso = await this.usuarios.criarPerfilParaEmpresa(uid, criada);
      this.credenciais.set(acesso);
      this.notify.success(
        `Empresa "${criada.nome}" cadastrada. O Firebase enviou a ${acesso.login} o e-mail para definir a senha de acesso ao Salesforce.`,
      );
    } catch (error) {
      await this.empresaService.remove(criada.id);
      const mensagem =
        error instanceof Error ? error.message : 'o acesso da empresa não pôde ser criado.';
      this.erro.set(`Empresa não cadastrada: ${mensagem}`);
      this.notify.error(`Empresa não cadastrada: ${mensagem}`);
      return;
    }
    this.limpar();
  }

  /** Carrega a empresa no formulário para edição. */
  editar(empresa: Empresa): void {
    this.credenciais.set(null);
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
    this.formVisivel.set(true);
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

  /** Oculta o formulário mantendo a listagem. */
  cancelarFormulario(): void {
    this.limpar();
    this.formVisivel.set(false);
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
      this.formVisivel.set(false);
    }
    this.notify.success(`Empresa "${empresa.nome}" removida.`);
  }

  /** Encerra a sessão administrativa e volta para o login da área admin. */
  async sair(): Promise<void> {
    if (window.confirm('Deseja encerrar a sessão administrativa?')) {
      this.auth.logout();
      await this.router.navigate(['/admin/login']);
    }
  }

  /** Oculta o acesso exibido após a criação. */
  fecharCredenciais(): void {
    this.credenciais.set(null);
  }

  /** Reenvia o e-mail OFICIAL do Firebase para a empresa definir a senha. */
  async reenviarEmailSenha(): Promise<void> {
    const acesso = this.credenciais();
    if (!acesso || !this.salesforceAuth) {
      return;
    }
    try {
      await this.salesforceAuth.sendPasswordReset(acesso.login);
      this.notify.success(`E-mail de definição de senha reenviado para ${acesso.login}.`);
    } catch (error) {
      this.notify.error(
        error instanceof Error ? error.message : 'Não foi possível reenviar o e-mail.',
      );
    }
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
