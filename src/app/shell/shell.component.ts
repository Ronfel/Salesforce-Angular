import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs';
import { Permission } from '../core/models/empresa.model';
import { NotificationService } from '../core/services/notification.service';
import { AuthService } from '../core/services/auth.service';
import { SalesDataService } from '../core/services/sales-data.service';
import { environment } from '../../environments/environment';

type PageId =
  | 'overview'
  | 'clients'
  | 'orders'
  | 'products'
  | 'route'
  | 'sync'
  | 'conexoes'
  | 'empresas';

/**
 * Shell da aplicação (View de navegação): sidebar, topbar, mensagens globais,
 * indicador de sincronização e o outlet das rotas filhas protegidas.
 */
@Component({
  selector: 'app-shell',
  styleUrl: './shell.component.scss',
  templateUrl: './shell.component.html',
  imports: [
    RouterLink,
    RouterOutlet,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
})
export class ShellComponent {
  private readonly router = inject(Router);
  readonly sales = inject(SalesDataService);
  readonly auth = inject(AuthService);
  readonly notify = inject(NotificationService);

  readonly busy = this.notify.busy;
  readonly notice = this.notify.notice;
  readonly errorMessage = this.notify.errorMessage;
  readonly isFirebaseConfigured = signal(
    Boolean(environment.firebase.apiKey && environment.firebase.projectId),
  );

  readonly navigation: {
    id: PageId;
    label: string;
    icon: string;
    section: string;
    /** Quando presente, o item só aparece para sessões com esta capability. */
    permission?: Permission;
  }[] = [
    { id: 'overview', label: 'Visão geral', icon: 'space_dashboard', section: 'Workspace' },
    { id: 'clients', label: 'Clientes', icon: 'groups', section: 'Vendas' },
    { id: 'orders', label: 'Pedidos', icon: 'receipt_long', section: 'Vendas' },
    { id: 'products', label: 'Produtos', icon: 'inventory_2', section: 'Vendas' },
    { id: 'route', label: 'Agenda e rota', icon: 'route', section: 'Campo' },
    { id: 'sync', label: 'Sincronização', icon: 'sync', section: 'Campo' },
    { id: 'conexoes', label: 'Conexões', icon: 'cloud', section: 'Campo' },
    // Administração multiempresa (Fase 1): visível apenas para quem tem a
    // permissão `gerenciar-empresas` (admin-plataforma).
    { id: 'empresas', label: 'Empresas', icon: 'apartment', section: 'Administração', permission: 'gerenciar-empresas' },
  ];

  /** Navegação visível para a sessão atual (itens sem permissão ou permitidos). */
  readonly visibleNavigation = computed(() =>
    this.navigation.filter((item) => !item.permission || this.auth.can(item.permission)),
  );

  /** Seções com ao menos um item visível na navegação atual. */
  readonly visibleSections = computed(() => {
    const sections = this.visibleNavigation().map((item) => item.section);
    return sections.filter((section, index) => sections.indexOf(section) === index);
  });

  readonly activePage = signal<PageId>('overview');
  readonly activePageTitle = computed(
    () => this.navigation.find((item) => item.id === this.activePage())?.label ?? 'Visão geral',
  );

  readonly todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  constructor() {
    void this.sales.initialize().catch((error: unknown) => {
      this.notify.error(
        error instanceof Error ? error.message : 'Não foi possível carregar os dados de vendas.',
      );
    });

    this.syncActivePage();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.syncActivePage());
  }

  get userInitials(): string {
    const name = this.auth.session()?.nome ?? 'Vendedor';
    return name
      .split(' ')
      .slice(0, 2)
      .map((part) => part.slice(0, 1))
      .join('')
      .toUpperCase();
  }

  get pendingOrdersCount(): number {
    return this.sales.orders().filter((order) => order.status === 'Pendente').length;
  }

  /** RNF007 - logout acionado ao clicar no logo da aplicação. */
  requestLogout(): void {
    if (window.confirm('Deseja encerrar a sessão e sair da aplicação?')) {
      this.auth.logout();
      void this.router.navigate(['/login']);
    }
  }

  private syncActivePage(): void {
    const segment = this.router.url.split('?')[0].split('/')[1] || 'overview';
    const known = this.navigation.some((item) => item.id === segment);
    this.activePage.set(known ? (segment as PageId) : 'overview');
  }
}
