import { isPlatformBrowser } from '@angular/common';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { FirestoreSalesRepository } from './firestore-sales.repository';
import { LocalStorageSalesRepository } from './local-storage-sales.repository';
import { SALES_REPOSITORY } from './sales.repository';

export const FIRESTORE_DATABASE = new InjectionToken<Promise<Firestore | null>>(
  'FIRESTORE_DATABASE',
);

export const salesRepositoryProviders = [
  LocalStorageSalesRepository,
  {
    provide: FIRESTORE_DATABASE,
    useFactory: (): Promise<Firestore | null> => {
      const platformId = inject(PLATFORM_ID);
      const isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);

      if (!isConfigured || !isPlatformBrowser(platformId)) {
        return Promise.resolve(null);
      }

      return Promise.all([import('firebase/app'), import('firebase/firestore')]).then(
        ([firebaseApp, firestore]) =>
          firestore.getFirestore(firebaseApp.initializeApp(environment.firebase)),
      );
    },
  },
  {
    provide: SALES_REPOSITORY,
    useFactory: () => {
      const platformId = inject(PLATFORM_ID);
      const isConfigured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);
      return isConfigured && isPlatformBrowser(platformId)
        ? new FirestoreSalesRepository(inject(FIRESTORE_DATABASE))
        : inject(LocalStorageSalesRepository);
    },
  },
];
