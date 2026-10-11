import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { SalesDataService } from '../../core/services/sales-data.service';

/**
 * Tela de Produtos (RF012) - consulta do catálogo sincronizado
 * com filtro por caractere (RNF003).
 */
@Component({
  selector: 'app-products',
  styleUrl: './products.component.scss',
  templateUrl: './products.component.html',
  imports: [CurrencyPipe, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatPaginatorModule],
})
export class ProductsComponent {
  readonly sales = inject(SalesDataService);

  readonly productSearch = signal('');

  /** Paginação da listagem de produtos: 10 produtos por página. */
  readonly pageIndex = signal(0);
  readonly pageSize = 10;

  constructor() {
    // Mantém a página atual válida quando a lista filtrada diminui,
    // evitando exibir uma página vazia.
    effect(() => {
      const lastPage = Math.max(0, Math.ceil(this.filteredProducts().length / this.pageSize) - 1);
      if (this.pageIndex() > lastPage) {
        this.pageIndex.set(lastPage);
      }
    });
  }

  readonly filteredProducts = computed(() => {
    const term = this.productSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.products().filter((product) =>
      [product.name, product.sku, product.category].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  /** Fatia de produtos exibida na página atual do paginator (10 por página). */
  readonly pagedProducts = computed(() => {
    const start = this.pageIndex() * this.pageSize;
    return this.filteredProducts().slice(start, start + this.pageSize);
  });

  /** Atualiza a busca textual e volta para a primeira página da listagem. */
  setProductSearch(value: string): void {
    this.productSearch.set(value);
    this.pageIndex.set(0);
  }

  /** Atualiza a página atual exibida pelo paginator. */
  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
  }

  get lowStockCount(): number {
    return this.sales.products().filter((product) => product.stock < 30).length;
  }
}
