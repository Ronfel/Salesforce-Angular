import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Appointment, Client, OrderItem, SalesOrder } from './core/models/sales.models';
import { SalesDataService } from './core/services/sales-data.service';
import { environment } from '../environments/environment';

registerLocaleData(localePt);

type PageId = 'overview' | 'clients' | 'orders' | 'products' | 'route' | 'sync';
type OrderItemForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
}>;

@Component({
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
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

  readonly clientForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    document: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', [Validators.required, Validators.maxLength(2)]],
    address: ['', Validators.required],
  });

  readonly orderItems = this.formBuilder.array<OrderItemForm>([this.createOrderItemForm()]);
  readonly orderForm = this.formBuilder.nonNullable.group({
    clientId: ['', Validators.required],
    paymentTerm: ['28 dias', Validators.required],
    items: this.orderItems,
  });

  constructor() {
    void this.sales.initialize().catch((error: unknown) => {
      this.errorMessage.set(this.errorText(error, 'Não foi possível carregar os dados de vendas.'));
    });
  }

  get activePageTitle(): string {
    return this.navigation.find((item) => item.id === this.activePage())?.label ?? 'Visão geral';
  }

  get orderTotal(): number {
    return this.orderItems.controls.reduce((total, item) => {
      const product = this.sales.productById(item.controls.productId.value);
      return total + (product?.price ?? 0) * Number(item.controls.quantity.value || 0);
    }, 0);
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

  startNewClient(): void {
    this.clientBeingEdited.set(null);
    this.clientForm.reset({
      name: '',
      document: '',
      email: '',
      phone: '',
      city: '',
      state: '',
      address: '',
    });
    this.showClientForm.set(true);
    this.clearMessages();
  }

  editClient(client: Client): void {
    this.clientBeingEdited.set(client.id);
    this.clientForm.patchValue(client);
    this.showClientForm.set(true);
    this.clearMessages();
  }

  async saveClient(): Promise<void> {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.clearMessages();
    const client: Client = {
      id: this.clientBeingEdited() ?? crypto.randomUUID(),
      ...this.clientForm.getRawValue(),
      state: this.clientForm.controls.state.value.toUpperCase(),
      createdAt: this.clientBeingEdited()
        ? this.sales.clients().find((saved) => saved.id === this.clientBeingEdited())?.createdAt ??
          new Date().toISOString()
        : new Date().toISOString(),
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

  async deleteClient(client: Client): Promise<void> {
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
    this.orderForm.reset({ clientId: '', paymentTerm: '28 dias' });
    this.resetOrderItems();
    this.showOrderForm.set(true);
    this.clearMessages();
  }

  editOrder(order: SalesOrder): void {
    this.orderBeingEdited.set(order.id);
    this.orderForm.reset({ clientId: order.clientId, paymentTerm: order.paymentTerm });
    this.orderItems.clear();
    order.items.forEach((item) => {
      this.orderItems.push(
        this.formBuilder.nonNullable.group({
          productId: [item.productId, Validators.required],
          quantity: [item.quantity, [Validators.required, Validators.min(1)]],
        }),
      );
    });
    this.showOrderForm.set(true);
    this.clearMessages();
  }

  addOrderItem(): void {
    this.orderItems.push(this.createOrderItemForm());
  }

  removeOrderItem(index: number): void {
    if (this.orderItems.length > 1) {
      this.orderItems.removeAt(index);
    }
  }

  async saveOrder(): Promise<void> {
    if (this.orderForm.invalid || this.orderItems.invalid) {
      this.orderForm.markAllAsTouched();
      this.orderItems.markAllAsTouched();
      return;
    }

    const client = this.sales.clients().find((saved) => saved.id === this.orderForm.controls.clientId.value);
    if (!client) {
      this.errorMessage.set('Selecione um cliente cadastrado para o pedido.');
      return;
    }

    const items: OrderItem[] = [];
    for (const item of this.orderItems.controls) {
      const product = this.sales.productById(item.controls.productId.value);
      if (!product) {
        this.errorMessage.set('Um dos produtos selecionados não está mais disponível.');
        return;
      }

      items.push({
        productId: product.id,
        productName: product.name,
        quantity: Number(item.controls.quantity.value),
        unitPrice: product.price,
      });
    }
    const previousOrder = this.sales.orders().find((order) => order.id === this.orderBeingEdited());
    const order: SalesOrder = {
      id: previousOrder?.id ?? `PED-${Date.now().toString().slice(-6)}`,
      clientId: client.id,
      clientName: client.name,
      createdAt: previousOrder?.createdAt ?? new Date().toISOString(),
      items,
      paymentTerm: this.orderForm.controls.paymentTerm.value,
      status: previousOrder?.status ?? 'Pendente',
      total: items.reduce((total, item) => total + item.quantity * item.unitPrice, 0),
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

  async deleteOrder(order: SalesOrder): Promise<void> {
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
    return this.formBuilder.nonNullable.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
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
