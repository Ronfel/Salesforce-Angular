import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege a área de administração da plataforma: exige sessão com
 * a capability `gerenciar-empresas`.
 *
 * - Sem sessão → /admin/login (Firebase Authentication), onde o
 *   `AdminLoginComponent` abre a sessão via `AuthService.openAdminSession`.
 * - Com sessão de outro papel (vendedor) → de volta à área comercial.
 */
export const adminAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  if (!auth.authenticated()) {
    return router.createUrlTree(['/admin/login']);
  }
  return auth.can('gerenciar-empresas') ? true : router.createUrlTree(['/']);
};