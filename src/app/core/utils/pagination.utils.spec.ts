import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { createPagination } from './pagination.utils';

describe('pagination.utils - createPagination', () => {
  function setup(items: string[]) {
    const source = signal(items);
    // Criado no contexto de injeção (como nos componentes) para o effect funcionar.
    const pagination = TestBed.runInInjectionContext(() => createPagination(source));
    return { source, pagination };
  }

  it('should expose the first page slice with pageSize 10', () => {
    const items = Array.from({ length: 12 }, (_, index) => `item-${index}`);
    const { pagination } = setup(items);

    expect(pagination.pageSize).toBe(10);
    expect(pagination.pageIndex()).toBe(0);
    expect(pagination.page()).toHaveLength(10);
  });

  it('should move between pages via the paginator event', () => {
    const items = Array.from({ length: 12 }, (_, index) => `item-${index}`);
    const { pagination } = setup(items);

    pagination.onPage({ pageIndex: 1, pageSize: 10, length: 12 } as PageEvent);
    expect(pagination.pageIndex()).toBe(1);
    expect(pagination.page()).toHaveLength(2);
  });

  it('should reset to the first page', () => {
    const items = Array.from({ length: 12 }, (_, index) => `item-${index}`);
    const { pagination } = setup(items);

    pagination.onPage({ pageIndex: 1, pageSize: 10, length: 12 } as PageEvent);
    pagination.reset();
    expect(pagination.pageIndex()).toBe(0);
  });

  it('should clamp the page when the list shrinks below the current page', () => {
    const items = Array.from({ length: 25 }, (_, index) => `item-${index}`);
    const { source, pagination } = setup(items);

    pagination.onPage({ pageIndex: 2, pageSize: 10, length: 25 } as PageEvent);
    expect(pagination.pageIndex()).toBe(2);

    source.set(items.slice(0, 12));
    TestBed.flushEffects();
    expect(pagination.pageIndex()).toBe(1);
    expect(pagination.page()).toHaveLength(2);
  });
});
