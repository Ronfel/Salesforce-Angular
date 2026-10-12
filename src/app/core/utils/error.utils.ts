/**
 * Converte um erro desconhecido em mensagem exibível ao usuário:
 * mensagens de `Error` são repassadas; qualquer outro valor usa o fallback.
 * Centralizado aqui para os componentes não duplicarem o mesmo catch.
 */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Converte erros técnicos do Web Service (ex.: Firestore
 * "Missing or insufficient permissions") em mensagens compreensíveis na
 * tela de login/sincronização.
 */
export function normalizeDataSourceError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (
    code === 'permission-denied' ||
    message.includes('Missing or insufficient permissions') ||
    message.includes('permission-denied')
  ) {
    return (
      'O servidor recusou a leitura dos dados (permissão insuficiente no Firestore). ' +
      'Publique as regras de segurança do Firestore (veja firestore.rules) e cadastre o vendedor ' +
      'na coleção "sellers" com login e senha.'
    );
  }

  return message || 'Não foi possível acessar o Web Service. Tente novamente.';
}
