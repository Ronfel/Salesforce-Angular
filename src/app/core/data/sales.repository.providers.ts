import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { ConnectionService } from '../services/connection.service';
import { DynamicSyncAdapter } from './dynamic-sync.adapter';
import { LocalStorageSalesRepository } from './local-storage-sales.repository';
import { SALES_REPOSITORY } from './sales.repository';
import { SYNC_ADAPTER } from './sync.adapter';

export const FIRESTORE_DATABASE = new InjectionToken<Promise<Firestore | null>>(
  'FIRESTORE_DATABASE',
);

const isFirebaseConfigured = (): boolean =>
  Boolean(environment.firebase.apiKey && environment.firebase.projectId);

export const salesRepositoryProviders = [
  LocalStorageSalesRepository,
  {
    provide: FIRESTORE_DATABASE,
    useFactory: (): Promise<Firestore | null> => {
      const platformId = inject(PLATFORM_ID);

      if (!isFirebaseConfigured() || !isPlatformBrowser(platformId)) {
        return Promise.resolve(null);
      }

      return Promise.all([import('firebase/app'), import('firebase/firestore')]).then(
        ([firebaseApp, firestore]) =>
          firestore.getFirestore(firebaseApp.initializeApp(environment.firebase)),
      );
    },
  },
  {
    // Roteador de sincronização — a URL NÃO fica mais fixa no código.
    // O DynamicSyncAdapter lê a **conexão ativa** (cadastrada na tela
    // /conexoes) a cada chamada; sem conexão ativa, cai no Firestore e,
    // em último caso, na base de demonstração.
    provide: SYNC_ADAPTER,
    useFactory: () =>
      new DynamicSyncAdapter(
        inject(HttpClient),
        inject(ConnectionService),
        inject(FIRESTORE_DATABASE),
      ),
  },
  {
    provide: SALES_REPOSITORY,
    useFactory: () => inject(LocalStorageSalesRepository),
  },
];
