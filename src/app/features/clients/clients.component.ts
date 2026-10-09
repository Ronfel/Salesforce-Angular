import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { Client, PersonType } from '../../core/models/sales.models';
import { NotificationService } from '../../core/services/notification.service';
import { SalesDataService } from '../../core/services/sales-data.service';
import { documentPlaceholder, formatDocument, isValidDocument } from '../../core/utils/document.utils';

/**
 * Tela de Clientes (RF002-RF005): cadastro simplificado com validação de
 * CPF/CNPJ, consulta com filtro por caractere (RNF003) e edição/exclusão
 * restritas aos cadastros ainda não sincronizados com o servidor.
 */
@Component({
  selector: 'app-clients',
  styleUrl: './clients.component.scss',
  templateUrl: './clients.component.html',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
  ],
})
export class ClientsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  readonly sales = inject(SalesDataService);
  readonly notify = inject(NotificationService);

  readonly busy = this.notify.busy;
  readonly clientSearch = signal('');
  readonly showClientForm = signal(false);
  readonly clientBeingEdited = signal<string | null>(null);

  constructor() {
    // Atalho da Visão Geral: /clients?new=1 abre o formulário de cadastro.
    this.route.queryParamMap.subscribe((params) => {
      if (params.get('new') === '1' && !this.showClientForm()) {
        this.startNewClient();
      }
    });
  }

  readonly filteredClients = computed(() => {
    const term = this.clientSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.clients().filter((client) =>
      [client.name, client.document, client.city, client.email]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    );
  });

  /** RF002 - cadastro simplificado de clientes. */
  readonly clientForm = this.formBuilder.nonNullable.group({
    personType: ['Jurídica' as PersonType, Validators.required],
    name: ['', [Validators.required, Validators.minLength(2)]],
    document: ['', Validators.required],
    inscricaoEstadual: [''],
    email: ['', Validators.email],
    phone: ['', Validators.required],
    city: [''],
    state: [''],
    address: [''],
    priceTableId: ['', Validators.required],
    paymentConditionId: ['', Validators.required],
  });

  get documentFieldPlaceholder(): string {
    return documentPlaceholder(this.clientForm.controls.personType.value);
  }

  startNewClient(): void {
    this.clientBeingEdited.set(null);
    this.clientForm.reset({
      personType: 'Jurídica',
      name: '',
      document: '',
      inscricaoEstadual: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      address: '',
      priceTableId: this.sales.priceTables()[0]?.id ?? '',
      paymentConditionId: this.sales.paymentConditions()[0]?.id ?? '',
    });
    this.showClientForm.set(true);
    this.notify.clear();
  }

  /** RF002 - reformata o documento conforme o tipo de pessoa escolhido. */
  onPersonTypeChange(): void {
    const control = this.clientForm.controls.document;
    control.setValue(
      formatDocument(this.clientForm.controls.personType.value, control.value),
      { emitEvent: false },
    );
  }

  /** RF002 - aplica a máscara de CPF/CNPJ enquanto o usuário digita. */
  onDocumentInput(): void {
    const control = this.clientForm.controls.document;
    control.setValue(
      formatDocument(this.clientForm.controls.personType.value, control.value),
      { emitEvent: false },
    );
  }

  editClient(client: Client): void {
    if (!this.canEditClient(client)) {
      this.notify.error(
        'Clientes já sincronizados com o servidor são somente leitura. Edite apenas cadastros locais pendentes.',
      );
      return;
    }
    this.clientBeingEdited.set(client.id);
    this.clientForm.patchValue(client);
    this.showClientForm.set(true);
    this.notify.clear();
  }

  canEditClient(client: Client): boolean {
    return !client.synced;
  }

  async saveClient(): Promise<void> {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    const raw = this.clientForm.getRawValue();
    if (!isValidDocument(raw.personType, raw.document)) {
      this.notify.error(
        raw.personType === 'Física'
          ? 'CPF inválido. Verifique os números digitados.'
          : 'CNPJ inválido. Verifique os números digitados.',
      );
      return;
    }

    this.busy.set(true);
    this.notify.clear();
    const editing = this.clientBeingEdited();
    const client: Client = {
      id: editing ?? crypto.randomUUID(),
      ...raw,
      state: raw.state.toUpperCase(),
      createdAt: editing
        ? this.sales.clients().find((saved) => saved.id === editing)?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
      synced: false,
    };

    try {
      await this.sales.saveClient(client);
      this.showClientForm.set(false);
      this.notify.success(editing ? 'Cadastro atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
      this.clientBeingEdited.set(null);
    } catch (error) {
      this.notify.error(this.errorText(error, 'Não foi possível salvar o cliente.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** RF004 - exclui apenas clientes ainda não submetidos ao servidor. */
  async deleteClient(client: Client): Promise<void> {
    if (!this.canEditClient(client)) {
      this.notify.error('Clientes já sincronizados com o servidor não podem ser excluídos.');
      return;
    }
    if (!window.confirm(`Excluir o cadastro de ${client.name}?`)) {
      return;
    }

    this.notify.clear();
    try {
      await this.sales.deleteClient(client.id);
      this.notify.success('Cliente removido.');
    } catch (error) {
      this.notify.error(this.errorText(error, 'Não foi possível excluir o cliente.'));
    }
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
