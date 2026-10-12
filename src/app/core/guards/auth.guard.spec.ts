import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { SALES_REPOSITORY } from '../data/sales.repository';
import { AuthService } from '../services/auth.service';
import { createMockSalesRepository } from '../../testing/mock-sales.repository';

describe('authGuard', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      providers: [
        { provide: SALES_REPOSITORY, useValue: createMockSalesRepository() },
        provideRouter([]),
      ],
    });
  });

  const runGuard = () =>
    TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as Promise<boolean | object>;

  it('should redirect unauthenticated users to /login', async () => {
    const result = await runGuard();
    expect(typeof result).toBe('object');
    expect((result as { toString(): string }).toString()).toBe('/login');
  });

  it('should await session restore and allow authenticated users', async () => {
    localStorage.setItem(
      'nexus-sales-session-v1',
      JSON.stringify({
        sellerId: 'seller-1',
        empresa: 'NOVA',
        login: 'rodrigo',
        nome: 'Rodrigo Neves',
        loggedAt: new Date().toISOString(),
      }),
    );

    const result = await runGuard();
    expect(result).toBe(true);
    expect(TestBed.inject(AuthService).authenticated()).toBe(true);
  });
});
