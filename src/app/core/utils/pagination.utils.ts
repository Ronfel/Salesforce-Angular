import { computed, effect, Signal, signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';

/** Estado e comportamento de paginação compartilhado pelas listagens (10 por página). */
export interface Pagination<T> {
  /** Página atual (0-based); leitura para o template e para o paginator. */
  readonly pageIndex: Signal<number>;
  /** Tamanho fixo de página das listagens do sistema. */
  readonly pageSize: number;
  /** Fatia da página atual da lista filtrada. */
  readonly page: Signal<T[]>;
  /** Conecta o evento do `mat-paginator` à página exibida. */
  onPage(event: PageEvent): void;
  /** Volta para a primeira página (usado ao mudar busca/filtro). */
  reset(): void;
}

/**
 * Cria o estado de paginação de uma listagem filtrada.
 *
 * Além do slice da página atual, mantém a página válida quando a lista
 * encolhe (exclusão, filtro, sincronização), evitando página vazia — lógica
 * que antes era reescrita em Clients, Orders e Products.
 *
 * Deve ser criado no inicializador de campo do componente (contexto de
 * injeção), pois registra um `effect` de correção de página.
 */
export function createPagination<T>(items: Signal<T[]>, pageSize = 10): Pagination<T> {
  const pageIndex = signal(0);

  const page = computed(() => {
    const start = pageIndex() * pageSize;
    return items().slice(start, start + pageSize);
  });

  // Quando a lista encolhe, recua para a última página existente.
  effect(() => {
    const lastPage = Math.max(0, Math.ceil(items().length / pageSize) - 1);
    if (pageIndex() > lastPage) {
      pageIndex.set(lastPage);
    }
  });

  return {
    pageIndex: pageIndex.asReadonly(),
    pageSize,
    page,
    onPage: (event) => pageIndex.set(event.pageIndex),
    reset: () => pageIndex.set(0),
  };
}
