import { createDemoSnapshot } from '../data/demo-data';
import { SalesOrder } from '../models/sales.models';
import { compareOrdersByRecency, sortOrdersByRecency } from './order.utils';

function makeOrder(id: string, createdAt: string): SalesOrder {
  return {
    id,
    clientId: 'client-1',
    clientName: 'Cliente Teste',
    sellerId: 'seller-1',
    sellerName: 'Rodrigo Neves',
    priceTableId: 'pt-normal',
    paymentConditionId: 'pc-28',
    createdAt,
    items: [],
    status: 'Pendente',
    total: 10,
    synced: true,
  };
}

describe('order.utils', () => {
  it('should sort orders from the most recent to the oldest by order date', () => {
    const orders = [
      makeOrder('PED-1', '2026-01-01T00:00:00.000Z'),
      makeOrder('PED-2', '2026-05-01T00:00:00.000Z'),
      makeOrder('PED-3', '2026-03-01T00:00:00.000Z'),
    ];

    expect(sortOrdersByRecency(orders).map((order) => order.id)).toEqual(['PED-2', 'PED-3', 'PED-1']);
  });

  it('should break ties on the same date using the order id (descending)', () => {
    // Mesma data: o id do pedido define a ordem, de forma estável.
    const orders = [
      makeOrder('PED-1047', '2026-01-10T00:00:00.000Z'),
      makeOrder('PED-1048', '2026-01-10T00:00:00.000Z'),
      makeOrder('PED-1049', '2026-01-10T00:00:00.000Z'),
    ];

    expect(sortOrdersByRecency(orders).map((order) => order.id)).toEqual([
      'PED-1049',
      'PED-1048',
      'PED-1047',
    ]);
  });

  it('should sort by date first and only then by order id', () => {
    const orders = [
      makeOrder('PED-2000', '2026-01-01T00:00:00.000Z'),
      makeOrder('PED-1000', '2026-02-01T00:00:00.000Z'),
    ];

    // A data mais recente vence mesmo com o id menor.
    expect(sortOrdersByRecency(orders).map((order) => order.id)).toEqual(['PED-1000', 'PED-2000']);
  });

  it('should not mutate the original list', () => {
    const orders = [makeOrder('PED-1', '2026-01-01T00:00:00.000Z'), makeOrder('PED-2', '2026-05-01T00:00:00.000Z')];

    sortOrdersByRecency(orders);

    expect(orders.map((order) => order.id)).toEqual(['PED-1', 'PED-2']);
  });

  it('should be usable directly as an Array.prototype.sort comparator', () => {
    const orders = [
      makeOrder('PED-1', '2026-01-01T00:00:00.000Z'),
      makeOrder('PED-3', '2026-03-01T00:00:00.000Z'),
    ];

    orders.sort(compareOrdersByRecency);

    expect(orders.map((order) => order.id)).toEqual(['PED-3', 'PED-1']);
  });

  it('should sort every demo order by date and id without losing any', () => {
    const orders = createDemoSnapshot().orders;
    const sorted = sortOrdersByRecency(orders);

    expect(sorted).toHaveLength(orders.length);
    expect(sorted.map((order) => order.id).sort()).toEqual(orders.map((order) => order.id).sort());
    expect(sorted).toEqual([...sorted].sort(compareOrdersByRecency));
  });
});
