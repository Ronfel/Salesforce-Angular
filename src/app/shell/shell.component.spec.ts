import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { SALES_REPOSITORY } from '../core/data/sales.repository';
import { AuthService } from '../core/services/auth.service';
import { createMockSalesRepository } from '../testing/mock-sales.repository';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  const createAuthenticated = async () => {
    await TestBed.inject(AuthService).login({
      host: 'local',
      empresa: 'NOVA',
      login: 'rodrigo',
      senha: '123456',
    });
    const fixture = TestBed.createComponent(ShellComponent);
    await fixture.whenStable();
    await fixture.componentInstance.sales.initialize();
    fixture.detectChanges();
    return fixture;
  };

  it('should render the navigation with the six main sections', async () => {
    const fixture = await createAuthenticated();
    const compiled = fixture.nativeElement as HTMLElement;

    const labels = [...compiled.querySelectorAll('.nav-link span:not(.nav-count)')].map((span) => span.textContent?.trim());
    expect(labels).toEqual(['Visão geral', 'Clientes', 'Pedidos', 'Produtos', 'Agenda e rota', 'Sincronização']);
    expect(compiled.querySelector('.breadcrumb strong')?.textContent).toContain('Visão geral');
  });

  it('should update the active page and breadcrumb on navigation', async () => {
    const fixture = await createAuthenticated();
    const router = TestBed.inject(Router);

    await router.navigate(['/sync']);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.activePage()).toBe('sync');
    expect(fixture.nativeElement.querySelector('.breadcrumb strong')?.textContent).toContain('Sincronização');
  });

  it('should log out with confirmation and go to the login screen (RNF007)', async () => {
    const fixture = await createAuthenticated();
    const router = TestBed.inject(Router);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.requestLogout();
    await fixture.whenStable();

    expect(confirmSpy).toHaveBeenCalled();
    expect(TestBed.inject(AuthService).authenticated()).toBe(false);
    expect(router.url).toBe('/login');
    confirmSpy.mockRestore();
  });
});
