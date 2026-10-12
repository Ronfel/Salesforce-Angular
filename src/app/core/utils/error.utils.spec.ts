import { errorText, normalizeDataSourceError } from './error.utils';

describe('error.utils', () => {
  describe('errorText', () => {
    it('should return the message of an Error', () => {
      expect(errorText(new Error('algo quebrou'), 'fallback')).toBe('algo quebrou');
    });

    it('should use the fallback for non-Error values', () => {
      expect(errorText('string', 'fallback')).toBe('fallback');
      expect(errorText(undefined, 'fallback')).toBe('fallback');
      expect(errorText({ code: 'x' }, 'fallback')).toBe('fallback');
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
