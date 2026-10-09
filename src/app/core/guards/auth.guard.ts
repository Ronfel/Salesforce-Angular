import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege as rotas autenticadas (RNF007 - login único):
 * aguarda a restauração da sessão e redireciona para o login quando necessário.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  return auth.authenticated() ? true : router.createUrlTree(['/login']);
};
