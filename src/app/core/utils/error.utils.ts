import { HttpErrorResponse } from '@angular/common/http';

/**
 * Extrai uma mensagem legível de qualquer valor de erro.
 *
 * Observação importante: o `HttpErrorResponse` do Angular NÃO estende `Error`
 * (estende `HttpResponseBase`). Por isso os testes `instanceof Error` falhavam
 * e qualquer falha de rede (CORS, API fora do ar, 404) caía no fallback
 * genérico, escondendo a causa real. Aqui tratamos esse tipo explicitamente.
 */
function extractMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    return describeHttpError(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return '';
}

/** Descreve um HttpErrorResponse em linguagem compreensível. */
function describeHttpError(error: HttpErrorResponse): string {
  // status 0 = a requisição nunca chegou ao servidor: CORS, API offline,
  // DNS, mixed-content (HTTP em página HTTPS), queda de internet.
  if (error.status === 0) {
    return (
      'Não foi possível conectar ao Web Service. Verifique se a API está no ar, ' +
      'se a URL está correta e se ela libera o acesso do navegador a este ' +
      'endereço (CORS).'
    );
  }

  const statusText = error.statusText || `HTTP ${error.status}`;
  const detail = serverDetail(error.error);
  return detail
    ? `O Web Service respondeu com erro ${error.status} (${statusText}): ${detail}`
    : `O Web Service respondeu com erro ${error.status} (${statusText}).`;
}

/** Extrai uma mensagem do corpo devolvido pelo servidor, quando houver. */
function serverDetail(body: unknown): string {
  if (typeof body === 'string' && body.trim()) {
    return body.trim().slice(0, 300);
  }
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'details', 'erro']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim().slice(0, 300);
      }
    }
  }
  return '';
}

/**
 * Converte um erro desconhecido em mensagem exibível ao usuário.
 * Centralizado aqui para os componentes não duplicarem o mesmo catch.
 */
export function errorText(error: unknown, fallback: string): string {
  return extractMessage(error) || fallback;
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
  const message = extractMessage(error);

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

