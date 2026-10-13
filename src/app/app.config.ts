import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { salesRepositoryProviders } from './core/data/sales.repository.providers';
import { ADMIN_AUTH_ADAPTER, FirebaseAdminAuthAdapter } from './core/data/admin-auth.adapter';

/** Formato de data brasileiro usado pelo MatDatepicker (data necessária do pedido). */
export const PT_BR_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideAnimationsAsync(),
    MatNativeDateModule,
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
    { provide: MAT_DATE_FORMATS, useValue: PT_BR_DATE_FORMATS },
    provideHttpClient(withFetch()),
    ...salesRepositoryProviders,
    // Login administrativo (Firebase Authentication - e-mail/senha). Os testes
    // injetam uma implementação em memória no lugar desta.
    { provide: ADMIN_AUTH_ADAPTER, useClass: FirebaseAdminAuthAdapter },
  ],
};
