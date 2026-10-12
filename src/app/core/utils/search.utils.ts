/**
 * Normalização compartilhada das buscas por caractere (RNF003):
 * trim + minúsculas com locale pt-BR, para acentos não quebrarem a busca.
 */
export function normalizeSearchTerm(term: string): string {
  return term.trim().toLocaleLowerCase('pt-BR');
}

/**
 * Verifica se algum dos campos do registro contém o termo já normalizado
 * (`normalizeSearchTerm`). Os campos são unidos com espaço antes da comparação,
 * permitindo busca em nome, documento, cidade etc. de uma só vez.
 */
export function matchesSearch(
  fields: Array<string | number | null | undefined>,
  normalizedTerm: string,
): boolean {
  return fields
    .map((field) => String(field ?? ''))
    .join(' ')
    .toLocaleLowerCase('pt-BR')
    .includes(normalizedTerm);
}
