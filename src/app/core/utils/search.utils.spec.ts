import { matchesSearch, normalizeSearchTerm } from './search.utils';

describe('search.utils', () => {
  describe('normalizeSearchTerm', () => {
    it('should trim and lower-case with pt-BR locale', () => {
      expect(normalizeSearchTerm('  Mercado São LUCAS ')).toBe('mercado são lucas');
    });
  });

  describe('matchesSearch', () => {
    it('should match when any field contains the term', () => {
      const term = normalizeSearchTerm('padaria');
      expect(matchesSearch(['Padaria Pão & Prosa', '111.222.333/0001-44'], term)).toBe(true);
    });

    it('should be case-insensitive on the fields side too', () => {
      expect(matchesSearch(['MERCADO São Lucas'], normalizeSearchTerm('mercado'))).toBe(true);
    });

    it('should return false when no field contains the term', () => {
      expect(matchesSearch(['Cliente A', 'São Paulo'], normalizeSearchTerm('zenite'))).toBe(false);
    });

    it('should tolerate null and undefined fields', () => {
      expect(matchesSearch([null, undefined, 'Rio Preto'], normalizeSearchTerm('preto'))).toBe(true);
      expect(matchesSearch([null, undefined], normalizeSearchTerm('x'))).toBe(false);
    });
  });
});
