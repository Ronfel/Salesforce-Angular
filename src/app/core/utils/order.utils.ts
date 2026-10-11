import { SalesOrder } from '../models/sales.models';

/**
 * Comparador único de pedidos (RF018): data do pedido (createdAt) decrescente e,
 * quando dois pedidos têm a mesma data, o id do pedido decrescente como
 * desempate — assim a listagem nunca "dança" entre pedidos do mesmo dia.
 */
export function compareOrdersByRecency(first: SalesOrder, second: SalesOrder): number {
  const byDate = second.createdAt.localeCompare(first.createdAt);
  return byDate !== 0 ? byDate : second.id.localeCompare(first.id);
}

/** Devolve uma nova lista de pedidos ordenada do mais recente ao mais antigo. */
export function sortOrdersByRecency(orders: SalesOrder[]): SalesOrder[] {
  return [...orders].sort(compareOrdersByRecency);
}
