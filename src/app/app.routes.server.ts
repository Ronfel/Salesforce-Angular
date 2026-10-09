import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Aplicação autenticada e dinâmica: as telas dependem da sessão (localStorage)
 * e do estado local, então o render é feito no cliente (o Prerender não se
 * aplica às rotas protegidas).
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
