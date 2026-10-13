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
import { EmailEnvioService } from '../../core/services/email-envio.service';
import { EmpresaService } from '../../core/services/empresa.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  CredenciaisGeradas,
  UsuarioFirestoreService,
} from '../../core/services/usuario-firestore.service';

/**
 * Tela de Empresas — área administrativa da plataforma (/admin/empresas):
 * cadastro das empresas que utilizarão o Salesforce.
 *
 * A tela é INDEPENDENTE do sistema comercial: não rendiza dentro do shell
 * (sidebar/topbar do Salesforce) e apresenta apenas o próprio menu "Empresas".
 * O formulário fica oculto até o administrador clicar em "Adicionar empresa".
 *
 * Ao criar uma empresa, o sistema gera login/senha, grava o usuário na
 * tabela de usuários do Firestore com a senha CRIPTOGRAFADA e ENVIA as
 * credenciais por e-mail à empresa. O login do Salesforce consulta essa
 * tabela e descriptografa a senha para autenticar.
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
  private readonly emailEnvio = inject(EmailEnvioService);
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

  /** Credenciais geradas na criação (login/senha para enviar à empresa). */
  readonly credenciais = signal<CredenciaisGeradas | null>(null);

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

    // Cria o usuário de acesso na tabela de usuários do Firestore (senha
    // criptografada), ENVIA login/senha por e-mail à empresa e revela as
    // credenciais para o administrador acompanhar.
    try {
      const credenciais = await this.usuarios.criarParaEmpresa(criada);
      this.credenciais.set(credenciais);
      let emailOk = false;
      try {
        await this.emailEnvio.enviarCredenciais({
          para: credenciais.login,
          nomeEmpresa: criada.nome,
          login: credenciais.login,
          senha: credenciais.senha,
        });
        emailOk = true;
      } catch {
        emailOk = false;
      }
      this.notify.success(
        emailOk
          ? `Empresa "${criada.nome}" cadastrada. Login e senha enviados para ${credenciais.login}.`
          : `Empresa "${criada.nome}" cadastrada, mas o e-mail falhou — use "Abrir e-mail" para enviar manualmente.`,
      );
    } catch (error) {
      this.notify.error(
        error instanceof Error
          ? `Empresa cadastrada, mas o usuário de acesso falhou: ${error.message}`
          : 'Empresa cadastrada, mas o usuário de acesso falhou.',
      );
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

  /** Oculta as credenciais exibidas após a criação. */
  fecharCredenciais(): void {
    this.credenciais.set(null);
  }

  /** Link mailto com login/senha (fallback quando o envio automático falha). */
  linkEmailCredenciais(): string {
    const cred = this.credenciais();
    if (!cred) {
      return '';
    }
    const assunto = encodeURIComponent('Acesso ao Nexus Vendas');
    const corpo = encodeURIComponent(
      `Login: ${cred.login}\nSenha: ${cred.senha}\n\nUse esses dados para acessar o Salesforce.`,
    );
    return `mailto:${encodeURIComponent(cred.login)}?subject=${assunto}&body=${corpo}`;
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
