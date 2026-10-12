import { HttpErrorResponse } from '@angular/common/http';
import { errorText, normalizeDataSourceError } from './error.utils';

describe('error.utils', () => {
  describe('errorText', () => {
    it('should return the message of an Error', () => {
      expect(errorText(new Error('algo quebrou'), 'fallback')).toBe('algo quebrou');
    });

    it('should use the string itself when the error is a string', () => {
      expect(errorText('falha de rede', 'fallback')).toBe('falha de rede');
    });

    it('should use the fallback for values without a message', () => {
      expect(errorText(undefined, 'fallback')).toBe('fallback');
      expect(errorText({ code: 'x' }, 'fallback')).toBe('fallback');
    });
  });

  describe('HttpErrorResponse', () => {
    it('should explain a network failure (status 0: CORS, API offline, URL errada)', () => {
      const httpError = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
      const message = errorText(httpError, 'fallback');
      expect(message).toContain('Não foi possível conectar');
      expect(message).toContain('CORS');
    });

    it('should surface the server status and detail for HTTP errors', () => {
      const httpError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        error: { message: 'boom no servidor' },
      });
      const message = errorText(httpError, 'fallback');
      expect(message).toContain('500');
      expect(message).toContain('boom no servidor');
    });
  });

  describe('normalizeDataSourceError', () => {
    it('should translate Firestore permission errors into a friendly message', () => {
      const message = normalizeDataSourceError({ code: 'permission-denied' });
      expect(message).toContain('permissão insuficiente');
      expect(message).toContain('firestore.rules');
    });

    it('should detect permission errors by message text', () => {
      const message = normalizeDataSourceError(
        new Error('Missing or insufficient permissions.'),
      );
      expect(message).toContain('permissão insuficiente');
    });

    it('should keep the original message for other errors', () => {
      expect(normalizeDataSourceError(new Error('timeout'))).toBe('timeout');
    });

    it('should fall back when there is no message', () => {
      expect(normalizeDataSourceError(null)).toContain('Não foi possível acessar');
    });
  });
});
