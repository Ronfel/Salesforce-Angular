import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ALL_DATASETS_DOWNLOADED } from '../models/sales.models';
import { SyncPullContext } from './sync.adapter';
import { HttpSyncAdapter } from './http-sync.adapter';

describe('HttpSyncAdapter (Opção C - API canônica)', () => {
  let adapter: HttpSyncAdapter;
  let httpMock: HttpTestingController;

  const context: SyncPullContext = { sellerId: 'sel-1', scheduledClientIds: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    // Barra final de propósito: prova que ela é removida (não vira `//auth`).
    adapter = new HttpSyncAdapter(TestBed.inject(HttpClient), 'https://api.exemplo.com/v1/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve montar o Seller a partir da resposta do /auth (sem exigir senha de volta)', async () => {
    const promise = adapter.authenticate({ login: 'rodrigo', senha: '123456' });

    const req = httpMock.expectOne('https://api.exemplo.com/v1/auth');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login: 'rodrigo', senha: '123456' });
    req.flush({ id: 'sel-1', empresa: 'Nova Distribuidora', nome: 'Rodrigo' });

    const seller = await promise;
    expect(seller).toEqual({
      id: 'sel-1',
      login: 'rodrigo',
      senha: '',
      empresa: 'Nova Distribuidora',
      nome: 'Rodrigo',
    });
  });

  it('deve devolver null no authenticate quando o servidor responde 401', async () => {
    const promise = adapter.authenticate({ login: 'x', senha: 'y' });
    httpMock.expectOne('https://api.exemplo.com/v1/auth').flush('erro', {
      status: 401,
      statusText: 'Unauthorized',
    });
    await expect(promise).resolves.toBeNull();
  });

  it('deve enviar selection + context no /pull e devolver o parcial recebido', async () => {
    const payload = { clients: [{ id: 'c1' } as never] };
    const promise = adapter.pull(ALL_DATASETS_DOWNLOADED, context);

    const req = httpMock.expectOne('https://api.exemplo.com/v1/pull');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ selection: ALL_DATASETS_DOWNLOADED, context });
    req.flush(payload);

    await expect(promise).resolves.toEqual(payload);
  });

  it('deve devolver objeto vazio no pull quando a API não retorna corpo', async () => {
    const promise = adapter.pull(ALL_DATASETS_DOWNLOADED, context);
    httpMock.expectOne('https://api.exemplo.com/v1/pull').flush(null);
    await expect(promise).resolves.toEqual({});
  });

  it('deve postar os pendentes no /push sem exigir corpo de resposta', async () => {
    const pending = { clients: [], orders: [], appointments: [] };
    const promise = adapter.push(pending as never);

    const req = httpMock.expectOne('https://api.exemplo.com/v1/push');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(pending);
    req.flush(null, { status: 204, statusText: 'No Content' });

    await promise;
  });
});

