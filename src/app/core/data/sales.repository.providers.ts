import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { DemoSyncAdapter } from './demo-sync.adapter';
import { FirestoreSyncAdapter } from './firestore-sync.adapter';
import { HttpSyncAdapter } from './http-sync.adapter';
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
    // Web Service da empresa (seleção em 3 vias):
    // 1) API canônica (Opção C) se `environment.apiUrl` estiver preenchida;
    // 2) Firestore (Opção B) se o Firebase estiver configurado;
    // 3) base de demonstração caso contrário.
    provide: SYNC_ADAPTER,
    useFactory: () => {
      if (environment.apiUrl) {
        return new HttpSyncAdapter(inject(HttpClient), environment.apiUrl);
      }
      return isFirebaseConfigured()
        ? new FirestoreSyncAdapter(inject(FIRESTORE_DATABASE))
        : new DemoSyncAdapter();
    },
  },
  {
    provide: SALES_REPOSITORY,
    useFactory: () => inject(LocalStorageSalesRepository),
  },
];
