/**
 * Conexão com uma API canônica externa (Opção C).
 *
 * Cada conexão representa "uma API qualquer" que o app pode consumir:
 * a API canônica própria, um sandbox do Salesforce, a API de um cliente, etc.
 * A URL NÃO fica fixa no código — você cadastra aqui, em runtime, e o app
 * conversa com a conexão que estiver **ativa**.
 */
export interface Conexao {
  /** Identificador único gerado no momento do cadastro. */
  id: string;
  /** Nome amigável exibido na tela (ex.: "API Canônica", "Sandbox SF"). */
  nome: string;
  /** URL base da API (ex.: https://minha-api.up.railway.app), sem barra final. */
  url: string;
  /** true se for a conexão que o app deve usar. Apenas uma fica ativa. */
  ativa: boolean;
}
