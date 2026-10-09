import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { OrderDraft, OrderDraftService } from '../../core/services/order-draft.service';
import { NotificationService } from '../../core/services/notification.service';
import { SalesDataService } from '../../core/services/sales-data.service';
import { OrderItem, SalesOrder } from '../../core/models/sales.models';

type OrderItemForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
  neededDate: FormControl<string>;
  discount: FormControl<number>;
}>;

/**
 * Tela de Pedidos (RF006-RF009, RF013-RF016): cliente com tabela de preço e
 * condição de pagamento automáticos, itens com data necessária/desconto,
 * consulta de produtos (RF012) e edição/exclusão apenas de pedidos locais.
 * Também recebe o rascunho vindo da Visão Geral e de Agendamentos (RF017).
 */
@Component({
  selector: 'app-orders',
  styleUrl: './orders.component.scss',
  templateUrl: './orders.component.html',
  imports: [
    CurrencyPipe,
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
export class OrdersComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly orderDraft = inject(OrderDraftService);
  readonly sales = inject(SalesDataService);
  readonly notify = inject(NotificationService);

  readonly busy = this.notify.busy;
  readonly orderSearch = signal('');
  readonly showOrderForm = signal(false);
  readonly orderBeingEdited = signal<string | null>(null);
  readonly showProductPicker = signal(false);
  readonly productPickerSearch = signal('');
  readonly productPickerIndex = signal(0);

  readonly filteredOrders = computed(() => {
    const term = this.orderSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.orders().filter((order) =>
      [order.id, order.clientName, order.status].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  /** Filtro por caractere da consulta de produtos (RNF003) usada no picker de itens. */
  readonly filteredPickerProducts = computed(() => {
    const term = this.productPickerSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.products().filter((product) =>
      [product.name, product.sku, product.category].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
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

    // Rascunho enviado pela Visão Geral ou pelo fluxo de agendamentos (RF017).
    effect(() => {
      const draft = this.orderDraft.consume();
      if (draft) {
        this.applyDraft(draft);
      }
    });
  }

  /** Total do pedido considerando tabela de preço e desconto dos itens (RF013). */
  get orderTotal(): number {
    return this.orderItems.controls.reduce(
      (total, _item, index) => total + this.itemLineTotal(index),
      0,
    );
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
    this.notify.clear();
  }

  /** RF009 - edita apenas pedidos locais ainda não submetidos ao servidor. */
  canEditOrder(order: SalesOrder): boolean {
    return order.status === 'Pendente' && !order.synced;
  }

  editOrder(order: SalesOrder): void {
    if (!this.canEditOrder(order)) {
      this.notify.error(
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
    this.notify.clear();
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
      this.notify.error('Selecione um cliente cadastrado para o pedido.');
      return;
    }

    const items: OrderItem[] = [];
    for (const item of this.orderItems.controls) {
      const product = this.sales.productById(item.controls.productId.value);
      if (!product) {
        this.notify.error('Selecione um produto válido em todos os itens do pedido.');
        return;
      }
      if (!item.controls.neededDate.value) {
        this.notify.error('Informe a data necessária de todos os itens do pedido.');
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
    this.notify.clear();
    try {
      await this.sales.saveOrder(order);
      this.showOrderForm.set(false);
      this.orderBeingEdited.set(null);
      this.notify.success(previousOrder ? 'Pedido atualizado com sucesso.' : 'Pedido criado e salvo com sucesso.');
    } catch (error) {
      this.notify.error(this.errorText(error, 'Não foi possível salvar o pedido.'));
    } finally {
      this.busy.set(false);
    }
  }

  /** RF008 - exclui apenas pedidos locais ainda não submetidos ao servidor. */
  async deleteOrder(order: SalesOrder): Promise<void> {
    if (!this.canEditOrder(order)) {
      this.notify.error('Pedidos já sincronizados com o servidor não podem ser excluídos.');
      return;
    }
    if (!window.confirm(`Excluir o pedido ${order.id}?`)) {
      return;
    }

    this.notify.clear();
    try {
      await this.sales.deleteOrder(order.id);
      this.notify.success('Pedido removido.');
    } catch (error) {
      this.notify.error(this.errorText(error, 'Não foi possível excluir o pedido.'));
    }
  }

  /** Monta o formulário a partir do rascunho da Visão Geral/Agendamentos (RF017). */
  private applyDraft(draft: OrderDraft): void {
    if (draft.kind === 'new') {
      this.startNewOrder();
      return;
    }

    this.startNewOrder();
    this.orderForm.controls.clientId.setValue(draft.appointment.clientId);
    if (draft.previousOrder) {
      this.orderItems.clear();
      draft.previousOrder.items.forEach((item) => this.orderItems.push(this.createItemFormFrom(item)));
      this.notify.success(`Novo pedido criado a partir do ${draft.previousOrder.id}.`);
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

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}

