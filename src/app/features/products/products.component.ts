import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { SalesDataService } from '../../core/services/sales-data.service';
import { createPagination } from '../../core/utils/pagination.utils';
import { matchesSearch, normalizeSearchTerm } from '../../core/utils/search.utils';

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

  readonly filteredProducts = computed(() => {
    const term = normalizeSearchTerm(this.productSearch());
    return this.sales.products().filter((product) =>
      matchesSearch([product.name, product.sku, product.category], term),
    );
  });

  /** Paginação da listagem de produtos: 10 por página (core/utils/pagination). */
  readonly pagination = createPagination(this.filteredProducts);
  readonly pageIndex = this.pagination.pageIndex;
  readonly pageSize = this.pagination.pageSize;
  /** Fatia de produtos exibida na página atual do paginator. */
  readonly pagedProducts = this.pagination.page;

  /** Atualiza a busca textual e volta para a primeira página da listagem. */
  setProductSearch(value: string): void {
    this.productSearch.set(value);
    this.pagination.reset();
  }

  /** Atualiza a página atual exibida pelo paginator. */
  onPage(event: PageEvent): void {
    this.pagination.onPage(event);
  }

  get lowStockCount(): number {
    return this.sales.products().filter((product) => product.stock < 30).length;
  }
}
