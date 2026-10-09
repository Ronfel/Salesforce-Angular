import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { SalesDataService } from '../../core/services/sales-data.service';

/**
 * Tela de Produtos (RF012) - consulta do catálogo sincronizado
 * com filtro por caractere (RNF003).
 */
@Component({
  selector: 'app-products',
  styleUrl: './products.component.scss',
  templateUrl: './products.component.html',
  imports: [CurrencyPipe, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
})
export class ProductsComponent {
  readonly sales = inject(SalesDataService);

  readonly productSearch = signal('');

  readonly filteredProducts = computed(() => {
    const term = this.productSearch().trim().toLocaleLowerCase('pt-BR');
    return this.sales.products().filter((product) =>
      [product.name, product.sku, product.category].join(' ').toLocaleLowerCase('pt-BR').includes(term),
    );
  });

  get lowStockCount(): number {
    return this.sales.products().filter((product) => product.stock < 30).length;
  }
}
