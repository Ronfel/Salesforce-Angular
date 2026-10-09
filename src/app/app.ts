import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ALL_DATA_UPLOADED,
  ALL_DATASETS_DOWNLOADED,
  Appointment,
  Client,
  OrderItem,
  PersonType,
  SalesOrder,
  SyncDownloadSelection,
  SyncUploadSelection,
} from './core/models/sales.models';
import { AuthService } from './core/services/auth.service';
import { SalesDataService } from './core/services/sales-data.service';
import {
  documentPlaceholder,
  formatDocument,
  isValidDocument,
} from './core/utils/document.utils';
import { environment } from '../environments/environment';

registerLocaleData(localePt);

type PageId = 'overview' | 'clients' | 'orders' | 'products' | 'route' | 'sync';
type OrderItemForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
  neededDate: FormControl<string>;
  discount: FormControl<number>;
}>;
type AppointmentFlowStep = 'ask' | 'previous' | 'pick';

@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly formBuilder = inject(FormBuilder);
  readonly sales = inject(SalesDataService);
  /** RF001/RNF007 - sessão do vendedor (login único). */
  readonly auth = inject(AuthService);

  readonly activePage = signal<PageId>('overview');
  readonly clientSearch = signal('');
  readonly orderSearch = signal('');
  readonly productSearch = signal('');
  readonly showClientForm = signal(false);
  readonly showOrderForm = signal(false);
  readonly clientBeingEdited = signal<string | null>(null);
  readonly orderBeingEdited = signal<string | null>(null);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly errorMessage = signal('');
  readonly isFirebaseConfigured = signal(
    Boolean(environment.firebase.apiKey && environment.firebase.projectId),
  );

  // Tela de login (RF001).
  readonly loginBusy = signal(false);
  readonly loginError = signal('');
  readonly loginForm = this.formBuilder.nonNullable.group({
    host: ['', Validators.required],
    empresa: ['', Validators.required],
    login: ['', Validators.required],
    senha: ['', Validators.required],
  });

  // Consulta de produtos usada na escolha de itens do pedido (RF012/RF013).
  readonly showProductPicker = signal(false);
  readonly productPickerSearch = signal('');
  readonly productPickerIndex = signal(0);

  // Fluxo agendamento -> pedido a partir de pedidos anteriores (RF017/RNF004).
  readonly flowAppointment = signal<Appointment | null>(null);
  readonly flowStep = signal<AppointmentFlowStep | null>(null);

  // Sincronização seletiva de download/upload (RF018).
  readonly syncDownload = signal<SyncDownloadSelection>({ ...ALL_DATASETS_DOWNLOADED });
  readonly syncUpload = signal<SyncUploadSelection>({ ...ALL_DATA_UPLOADED });

  readonly navigation: { id: PageId; label: string; icon: string; section: string }[] = [
    { id: 'overview', label: 'Visão geral', icon: 'space_dashboard', section: 'Workspace' },
    { id: 'clients', label: 'Clientes', icon: 'groups', section: 'Vendas' },
    { id: 'orders', label: 'Pedidos', icon: 'receipt_long', section: 'Vendas' },
    { id: 'products', label: 'Produtos', icon: 'inventory_2', section: 'Vendas' },
    { id: 'route', label: 'Agenda e rota', icon: 'route', section: 'Campo' },
    { id: 'sync', label: 'Sincronização', icon: 'sync', section: 'Campo' },
  ];

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  readonly filteredClients = computed(() => {
    const term = this.clientSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.clients().filter((client) =>
      [client.name, client.document, client.city, client.email]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    );
  });

  readonly filteredOrders = computed(() => {
    const term = this.orderSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.orders().filter((order) =>
      [order.id, order.clientName, order.status].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  readonly filteredProducts = computed(() => {
    const term = this.productSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.products().filter((product) =>
      [product.name, product.sku, product.category].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  /** Filtro por caractere da consulta de produtos (RNF003) usada no picker de itens. */
  readonly filteredPickerProducts = computed(() => {
    const term = this.productPickerSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.products().filter((product) =>
      [product.name, product.sku, product.category].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  readonly todaysAppointments = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.sales.appointments().filter((appointment) => appointment.date === today);
  });
  readonly completedVisitsCount = computed(
    () => this.todaysAppointments().filter((visit) => visit.status === 'Concluída').length,
  );
  readonly pendingVisitsCount = computed(
    () => this.todaysAppointments().filter((visit) => visit.status === 'Agendada').length,
  );

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

  readonly orderItems = this.formBuilder.array<OrderItemForm>([this.createOrderItemForm()]);
  /** RF006 - pedido com cliente, tabela de preço e condição de pagamento. */
  readonly orderForm = this.formBuilder.nonNullable.group({
    clientId: ['', Validators.required],
    priceTableId: ['', Validators.required],
    paymentConditionId: ['', Validators.required],
    items: this.orderItems,
  });

  /** Evita que a troca de cliente sobrescreva valores carregados ao editar um pedido. */
  private applyingOrderForm = false;

  constructor() {
    void this.sales.initialize().catch((error: unknown) => {
      this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os dados de vendas.'));
    });

    // Ao escolher o cliente, carrega automaticamente a tabela de preço e a
    // condição de pagamento padrões do cadastro do cliente (RF006/RNF004).
    this.orderForm.controls.clientId.valueChanges.subscribe((clientId) => {
      if (this.applyingOrderForm) {
        return;
      }
      const client = this.sales.clientById(clientId);
      if (client) {
        this.orderForm.patchValue({
          priceTableId: client.priceTableId,
          paymentConditionId: client.paymentConditionId,
        });
      }
    });
  }

  get activePageTitle(): string {
    return this.navigation.find((item) => item.id === this.activePage())?.label ?? 'Visão geral';
  }

  get documentFieldPlaceholder(): string {
    return documentPlaceholder(this.clientForm.controls.personType.value);
  }

  /** Iniciais do vendedor logado exibidas nos avatares. */
  get userInitials(): string {
    const name = this.auth.session()?.nome ?? 'Vendedor';
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part.slice(0, 1))
      .join('')
      .toUpperCase();
  }

  get pendingOrdersCount(): number {
    return this.sales.orders().filter((order) => order.status === 'Pendente').length;
  }

  get lowStockCount(): number {
    return this.sales.products().filter((product) => product.stock < 30).length;
  }

  selectPage(page: PageId): void {
    this.activePage.set(page);
    this.showClientForm.set(false);
    this.showOrderForm.set(false);
    this.clearMessages();
  }

  /** RF001 - valida os campos e autentica no Web Service. */
  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Informe Host, Empresa, Usuário e Senha.');
      return;
    }

    this.loginBusy.set(true);
    this.loginError.set('');
    try {
      await this.auth.login(this.loginForm.getRawValue());
      this.loginForm.controls.senha.setValue('');
      this.activePage.set('overview');
    } catch (error) {
      this.loginError.set(this.errorText(error, 'Não foi possível efetuar o login.'));
    } finally {
      this.loginBusy.set(false);
    }
  }

  /** RNF007 - logout acionado ao clicar no logo da aplicação. */
  requestLogout(): void {
    if (window.confirm('Deseja encerrar a sessão e sair da aplicação?')) {
      this.auth.logout();
    }
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
    this.clearMessages();
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
      this.errorMessage.set(
        'Clientes já sincronizados com o servidor são somente leitura. Edite apenas cadastros locais pendentes.',
      );
      return;
    }
    this.clientBeingEdited.set(client.id);
    this.clientForm.patchValue(client);
    this.showClientForm.set(true);
    this.clearMessages();
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
      this.errorMessage.set(
        raw.personType === 'Física'
          ? 'CPF inválido. Verifique os números digitados.'
          : 'CNPJ inválido. Verifique os números digitados.',
      );
      return;
    }

    this.busy.set(true);
    this.clearMessages();
    const client: Client = {
      id: this.clientBeingEdited() ?? crypto.randomUUID(),
      ...raw,
      state: raw.state.toUpperCase(),
      createdAt: this.clientBeingEdited()
        ? this.sales.clients().find((saved) => saved.id === this.clientBeingEdited())?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
      synced: false,
    };

    try {
      await this.sales.saveClient(client);
      this.showClientForm.set(false);
      this.notice.set(this.clientBeingEdited() ? 'Cadastro atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
      this.clientBeingEdited.set(null);
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Não foi possível salvar o cliente.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** RF004 - exclui apenas clientes ainda não submetidos ao servidor. */
  async deleteClient(client: Client): Promise<void> {
    if (!this.canEditClient(client)) {
      this.errorMessage.set('Clientes já sincronizados com o servidor não podem ser excluídos.');
      return;
    }
    if (!window.confirm(`Excluir o cadastro de ${client.name}?`)) {
      return;
    }

    this.clearMessages();
    try {
      await this.sales.deleteClient(client.id);
      this.notice.set('Cliente removido.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Não foi possível excluir o cliente.'));
    }
  }

  startNewOrder(): void {
    this.orderBeingEdited.set(null);
    this.orderForm.reset({
      clientId: '',
      priceTableId: '',
      paymentConditionId: '',
    });
    this.resetOrderItems();
    this.showOrderForm.set(true);
    this.clearMessages();
  }

  /** RF009 - edita apenas pedidos locais ainda não submetidos ao servidor. */
  canEditOrder(order: SalesOrder): boolean {
    return order.status === 'Pendente' && !order.synced;
  }

  editOrder(order: SalesOrder): void {
    if (!this.canEditOrder(order)) {
      this.errorMessage.set(
        order.synced
          ? 'Pedidos já sincronizados com o servidor são somente leitura.'
          : 'Apenas pedidos pendentes podem ser editados.',
      );
      return;
    }
    this.orderBeingEdited.set(order.id);
    this.applyingOrderForm = true;
    this.orderForm.reset({
      clientId: order.clientId,
      priceTableId: order.priceTableId,
      paymentConditionId: order.paymentConditionId,
    });
    this.applyingOrderForm = false;
    this.orderItems.clear();
    order.items.forEach((item) => this.orderItems.push(this.createItemFormFrom(item)));
    this.showOrderForm.set(true);
    this.clearMessages();
  }

  addOrderItem(): void {
    this.orderItems.push(this.createOrderItemForm());
  }

  removeOrderItem(index: number): void {
    if (this.orderItems.length <= 1) {
      return;
    }
    const product = this.sales.productById(this.orderItems.at(index).controls.productId.value);
    if (!window.confirm(`Excluir o item ${product?.name ?? index + 1} do pedido?`)) {
      return;
    }
    this.orderItems.removeAt(index);
  }

  /** RF013 - preço unitário do item calculado pela tabela de preço do pedido. */
  itemUnitPrice(index: number): number {
    const item = this.orderItems.at(index);
    const product = this.sales.productById(item.controls.productId.value);
    if (!product) {
      return 0;
    }
    return this.sales.unitPriceFor(product, this.orderForm.controls.priceTableId.value);
  }

  itemLineTotal(index: number): number {
    const item = this.orderItems.at(index);
    const total =
      this.itemUnitPrice(index) *
      Number(item.controls.quantity.value || 0) *
      (1 - Number(item.controls.discount.value || 0) / 100);
    return Math.round(total * 100) / 100;
  }

  /** Total do pedido considerando tabela de preço e desconto dos itens (RF013). */
  get orderTotal(): number {
    return this.orderItems.controls.reduce(
      (total, _item, index) => total + this.itemLineTotal(index),
      0,
    );
  }

  /** RF012 - abre a consulta de produtos com filtro por caractere. */
  openProductPicker(index: number): void {
    this.productPickerIndex.set(index);
    this.productPickerSearch.set('');
    this.showProductPicker.set(true);
  }

  closeProductPicker(): void {
    this.showProductPicker.set(false);
  }

  pickProduct(productId: string): void {
    this.orderItems.at(this.productPickerIndex()).controls.productId.setValue(productId);
    this.closeProductPicker();
  }

  async saveOrder(): Promise<void> {
    if (this.orderForm.invalid || this.orderItems.invalid) {
      this.orderForm.markAllAsTouched();
      this.orderItems.markAllAsTouched();
      return;
    }

    const client = this.sales.clientById(this.orderForm.controls.clientId.value);
    if (!client) {
      this.errorMessage.set('Selecione um cliente cadastrado para o pedido.');
      return;
    }

    const items: OrderItem[] = [];
    for (const item of this.orderItems.controls) {
      const product = this.sales.productById(item.controls.productId.value);
      if (!product) {
        this.errorMessage.set('Selecione um produto válido em todos os itens do pedido.');
        return;
      }
      if (!item.controls.neededDate.value) {
        this.errorMessage.set('Informe a data necessária de todos os itens do pedido.');
        return;
      }

      items.push({
        productId: product.id,
        productName: product.name,
        quantity: Number(item.controls.quantity.value),
        unitPrice: this.sales.unitPriceFor(product, this.orderForm.controls.priceTableId.value),
        neededDate: item.controls.neededDate.value,
        discount: Number(item.controls.discount.value || 0),
      });
    }

    const previousOrder = this.sales.orders().find((order) => order.id === this.orderBeingEdited());
    const total = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity * (1 - item.discount / 100),
      0,
    );
    const order: SalesOrder = {
      id: previousOrder?.id ?? `PED-${Date.now().toString().slice(-6)}`,
      clientId: client.id,
      clientName: client.name,
      priceTableId: this.orderForm.controls.priceTableId.value,
      paymentConditionId: this.orderForm.controls.paymentConditionId.value,
      createdAt: previousOrder?.createdAt ?? new Date().toISOString(),
      items,
      status: previousOrder?.status ?? 'Pendente',
      total: Math.round(total * 100) / 100,
      synced: false,
    };

    this.busy.set(true);
    this.clearMessages();
    try {
      await this.sales.saveOrder(order);
      this.showOrderForm.set(false);
      this.orderBeingEdited.set(null);
      this.notice.set(previousOrder ? 'Pedido atualizado com sucesso.' : 'Pedido criado e salvo com sucesso.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Não foi possível salvar o pedido.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** RF008 - exclui apenas pedidos locais ainda não submetidos ao servidor. */
  async deleteOrder(order: SalesOrder): Promise<void> {
    if (!this.canEditOrder(order)) {
      this.errorMessage.set('Pedidos já sincronizados com o servidor não podem ser excluídos.');
      return;
    }
    if (!window.confirm(`Excluir o pedido ${order.id}?`)) {
      return;
    }

    this.clearMessages();
    try {
      await this.sales.deleteOrder(order.id);
      this.notice.set('Pedido removido.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Não foi possível excluir o pedido.'));
    }
  }

  async completeAppointment(appointment: Appointment): Promise<void> {
    const appointments = this.sales.appointments().map((saved) =>
      saved.id === appointment.id ? { ...saved, status: 'Concluída' as const } : saved,
    );
    this.clearMessages();

    try {
      await this.sales.updateAppointments(appointments);
      this.notice.set('Visita marcada como concluída.');
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Não foi possível atualizar a visita.'));
    }
  }

  // ---------------------------------------------------------------------
  // RF017 - Consultar agendamentos e criar pedido a partir deles
  // ---------------------------------------------------------------------

  startAppointmentFlow(appointment: Appointment): void {
    this.flowAppointment.set(appointment);
    this.flowStep.set('ask');
  }

  closeAppointmentFlow(): void {
    this.flowAppointment.set(null);
    this.flowStep.set(null);
  }

  /** Sequência típica, passo 4: confirmar a criação do pedido. */
  confirmCreateOrderFromAppointment(): void {
    this.flowStep.set('previous');
  }

  /** Sequência típica, passo 6: perguntar sobre pedidos anteriores. */
  startFromPreviousOrders(): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }
    if (this.sales.lastOrdersForClient(appointment.clientId).length > 0) {
      this.flowStep.set('pick');
    } else {
      // Alternativa 6a: sem pedidos anteriores, abre o pedido apenas com o cliente.
      this.openBlankOrderFromAppointment();
      this.notice.set('Nenhum pedido anterior encontrado. Pedido aberto com os dados do cliente.');
    }
  }

  openBlankOrderFromAppointment(): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }
    this.openOrderForAppointment(appointment);
    this.closeAppointmentFlow();
  }

  /** Sequência típica, passos 9-10: clona o pedido anterior escolhido. */
  pickPreviousOrder(order: SalesOrder): void {
    const appointment = this.flowAppointment();
    if (!appointment) {
      return;
    }

    this.openOrderForAppointment(appointment);
    this.orderItems.clear();
    order.items.forEach((item) => this.orderItems.push(this.createItemFormFrom(item)));
    this.closeAppointmentFlow();
    this.notice.set(`Novo pedido criado a partir do ${order.id}.`);
  }

  private openOrderForAppointment(appointment: Appointment): void {
    this.selectPage('orders');
    this.startNewOrder();
    // Dispara o carregamento dos padrões do cliente (tabela de preço e condição).
    this.orderForm.controls.clientId.setValue(appointment.clientId);
  }

  // ---------------------------------------------------------------------
  // RF018 - Sincronização seletiva de download e upload
  // ---------------------------------------------------------------------

  setDownloadOption(key: keyof SyncDownloadSelection, checked: boolean): void {
    this.syncDownload.update((selection) => ({ ...selection, [key]: checked }));
  }

  setUploadOption(key: keyof SyncUploadSelection, checked: boolean): void {
    this.syncUpload.update((selection) => ({ ...selection, [key]: checked }));
  }

  /** Executa exatamente o que o usuário marcou na tela de sincronização. */
  async synchronizeSelected(): Promise<void> {
    const download = this.syncDownload();
    const upload = this.syncUpload();
    if (!Object.values(download).some(Boolean) && !Object.values(upload).some(Boolean)) {
      this.errorMessage.set('Selecione ao menos uma opção de download ou upload.');
      return;
    }

    this.busy.set(true);
    this.clearMessages();
    try {
      const pendingClients = this.sales.pendingClientsCount();
      const pendingOrders = this.sales.pendingOrdersCount();
      await this.sales.synchronize({ download, upload });
      this.notice.set(
        `Sincronização concluída: download de ${Object.values(download).filter(Boolean).length} conjunto(s)` +
          ` e upload de ${Object.values(upload).filter(Boolean).length} conjunto(s)` +
          ` (${pendingClients} cliente(s) e ${pendingOrders} pedido(s) pendentes).`,
      );
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'A sincronização não foi concluída.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Sincronização completa usada pelos atalhos da aplicação. */
  async synchronize(): Promise<void> {
    this.busy.set(true);
    this.clearMessages();

    try {
      await this.sales.synchronize();
      this.notice.set(
        this.isFirebaseConfigured()
          ? 'Dados atualizados com o Firestore.'
          : 'Dados locais atualizados. Configure o Firebase para sincronizar com a nuvem.',
      );
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'A sincronização não foi concluída.'));
    } finally {
      this.busy.set(false);
    }
  }

  private createOrderItemForm(): OrderItemForm {
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    return this.formBuilder.nonNullable.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      neededDate: [inTwoDays.toISOString().slice(0, 10), Validators.required],
      discount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  private createItemFormFrom(item: OrderItem): OrderItemForm {
    return this.formBuilder.nonNullable.group({
      productId: [item.productId, Validators.required],
      quantity: [item.quantity, [Validators.required, Validators.min(1)]],
      neededDate: [item.neededDate, Validators.required],
      discount: [item.discount, [Validators.required, Validators.min(0), Validators.max(100)]],
    });
  }

  private resetOrderItems(): void {
    this.orderItems.clear();
    this.orderItems.push(this.createOrderItemForm());
  }

  private clearMessages(): void {
    this.notice.set('');
    this.errorMessage.set('');
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}






