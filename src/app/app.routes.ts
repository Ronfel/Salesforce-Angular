import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Rotas da aplicação - o router atua como controlador entre as Views (telas).
 * As rotas autenticadas ficam sob o ShellComponent, protegidas pelo authGuard
 * (RNF007 - login único), com carregamento preguiçoso de cada feature.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Efetuar Login · Nexus Vendas',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Visão geral · Nexus Vendas',
        loadComponent: () => import('./features/overview/overview.component').then((m) => m.OverviewComponent),
      },
      {
        path: 'clients',
        title: 'Clientes · Nexus Vendas',
        loadComponent: () => import('./features/clients/clients.component').then((m) => m.ClientsComponent),
      },
      {
        path: 'orders',
        title: 'Pedidos · Nexus Vendas',
        loadComponent: () => import('./features/orders/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'products',
        title: 'Produtos · Nexus Vendas',
        loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent),
      },
      {
        path: 'route',
        title: 'Agenda e rota · Nexus Vendas',
        loadComponent: () => import('./features/route/route.component').then((m) => m.RouteComponent),
      },
      {
        path: 'sync',
        title: 'Sincronização · Nexus Vendas',
        loadComponent: () => import('./features/sync/sync.component').then((m) => m.SyncComponent),
      },
      { path: '**', redirectTo: 'overview' },
    ],
  },
];
