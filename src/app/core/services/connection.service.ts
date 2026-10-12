import { computed, Injectable, signal } from '@angular/core';
import { Conexao } from '../models/connection.model';

const STORAGE_KEY = 'nx.conexoes.v1';

/**
 * Gerencia as conexões de API (CRUD + conexão ativa), persistidas em
 * localStorage. É a "fonte da verdade" de runtime que substitui o antigo
 * `apiUrl` fixo: o adapter HTTP lê `activeUrl()` a cada chamada, então trocar
 * a conexão ativa surte efeito imediato, sem recompilar o app.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly _conexoes = signal<Conexao[]>(this.load());

  /** Lista somente-leitura das conexões cadastradas. */
  readonly conexoes = this._conexoes.asReadonly();

  /** Conexão atualmente ativa, ou null se nenhuma estiver marcada. */
  readonly ativa = computed<Conexao | null>(
    () => this._conexoes().find((c) => c.ativa) ?? null,
  );

  /** URL da conexão ativa (sem espaços), ou '' se não houver conexão ativa. */
  readonly activeUrl = computed(() => this.ativa()?.url.trim() ?? '');

  /** true quando existe uma conexão ativa com URL preenchida. */
  readonly hasActive = computed(() => this.activeUrl().length > 0);

  /** Cadastra uma nova conexão. A primeira cadastrada já entra ativa. */
  add(nome: string, url: string): void {
    const cleanNome = nome.trim();
    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanNome || !cleanUrl) {
      return;
    }
    const conexao: Conexao = {
      id: this.nextId(),
      nome: cleanNome,
      url: cleanUrl,
      ativa: this._conexoes().length === 0,
    };
    this._conexoes.update((list) => [...list, conexao]);
    this.persist();
  }

  /** Remove uma conexão; se era a ativa, promove a primeira restante. */
  remove(id: string): void {
    const wasActive = this._conexoes().find((c) => c.id === id)?.ativa ?? false;
    let list = this._conexoes().filter((c) => c.id !== id);
    if (wasActive && list.length > 0 && !list.some((c) => c.ativa)) {
      list = list.map((c, index) => ({ ...c, ativa: index === 0 }));
    }
    this._conexoes.set(list);
    this.persist();
  }

  /** Marca uma conexão como ativa (e desmarca todas as outras). */
  ativar(id: string): void {
    this._conexoes.update((list) => list.map((c) => ({ ...c, ativa: c.id === id })));
    this.persist();
  }

  private nextId(): string {
    return `cx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._conexoes()));
    } catch {
      // localStorage indisponível (modo privado / quota): segue apenas em memória.
    }
  }

  private load(): Conexao[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((item): item is Conexao => this.isConexao(item))
        .map((item) => ({
          id: String(item.id),
          nome: String(item.nome),
          url: String(item.url),
          ativa: Boolean(item.ativa),
        }));
    } catch {
      return [];
    }
  }

  private isConexao(value: unknown): value is Conexao {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;
    return (
      typeof v['id'] === 'string' &&
      typeof v['nome'] === 'string' &&
      typeof v['url'] === 'string' &&
      typeof v['ativa'] === 'boolean'
    );
  }
}
