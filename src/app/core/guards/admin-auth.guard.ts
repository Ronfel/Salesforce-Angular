import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ADMIN_UID_PERMITIDO } from '../data/admin-auth.adapter';
import { AuthService } from '../services/auth.service';

/**
 * Protege a área de administração da plataforma: exige sessão aberta pelo UID
 * autorizado (`ADMIN_UID_PERMITIDO`) com a capability `gerenciar-empresas`.
 *
 * - Sem sessão → /admin/login (Firebase Authentication), onde o
 *   `AdminLoginComponent` abre a sessão via `AuthService.openAdminSession`.
 * - Sessão de outro UID (mesmo que `admin-plataforma`) → /admin/login.
 * - Com sessão de outro papel (vendedor) → de volta à área comercial.
 */
export const adminAuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;

  if (!auth.authenticated()) {
    return router.createUrlTree(['/admin/login']);
  }
  const sessaoAdmin = auth.session();
  if (
    sessaoAdmin?.sellerId === `admin:${ADMIN_UID_PERMITIDO}` &&
    auth.can('gerenciar-empresas')
  ) {
    return true;
  }
  if (auth.role() === 'admin-plataforma') {
    return router.createUrlTree(['/admin/login']);
  }
  return router.createUrlTree(['/']);
};