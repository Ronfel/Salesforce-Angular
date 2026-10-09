import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { SALES_REPOSITORY } from './core/data/sales.repository';
import { AuthService } from './core/services/auth.service';
import { createMockSalesRepository, MockSalesRepository } from './testing/mock-sales.repository';

describe('App', () => {
  let repository: MockSalesRepository;

  beforeEach(async () => {
    localStorage.clear();
    repository = createMockSalesRepository();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SALES_REPOSITORY, useValue: repository },
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  it('should redirect unauthenticated users to the login screen (RF001)', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/login');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Efetuar Login');
  });

  it('should render the sales dashboard after login', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    await TestBed.inject(AuthService).login({
      host: 'local',
      empresa: 'NOVA',
      login: 'rodrigo',
      senha: '123456',
    });

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/overview');
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Bom dia, Rodrigo');
    expect(compiled.textContent).toContain('Pedidos recentes');
  });

  it('should keep the session persisted until logout (RNF007)', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const auth = TestBed.inject(AuthService);

    await auth.login({ host: 'local', empresa: 'NOVA', login: 'rodrigo', senha: '123456' });
    expect(auth.authenticated()).toBe(true);
    expect(localStorage.getItem('nexus-sales-session-v1')).not.toBeNull();

    auth.logout();
    expect(auth.authenticated()).toBe(false);
    expect(localStorage.getItem('nexus-sales-session-v1')).toBeNull();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
