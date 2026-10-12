import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SALES_REPOSITORY } from '../../core/data/sales.repository';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should require Usuário e Senha (RF001 alternativa 4a)', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    await component.login();

    expect(component.loginForm.invalid).toBe(true);
    expect(component.loginError()).toContain('Informe Usuário e Senha.');
    expect(component.auth.authenticated()).toBe(false);
  });

  it('should reject invalid credentials with a message (RF001 alternativa 5a)', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    component.loginForm.setValue({ login: 'rodrigo', senha: 'errada' });
    await component.login();

    expect(component.auth.authenticated()).toBe(false);
    expect(component.loginError()).toContain('inválidos');
  });

  it('should authenticate a registered seller and go to the dashboard (RF001)', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.loginForm.setValue({ login: 'rodrigo', senha: '123456' });
    await component.login();

    expect(component.auth.authenticated()).toBe(true);
    expect(component.auth.session()?.nome).toBe('Rodrigo Neves');
    expect(component.loginForm.controls.senha.value).toBe('');
    expect(localStorage.getItem('nexus-sales-session-v1')).not.toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });
});
