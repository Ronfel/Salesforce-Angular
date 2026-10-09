import { PersonType } from '../models/sales.models';

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function weightedSum(digits: string, weights: number[]): number {
  return digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
}

function checkDigit(sum: number): number {
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/** Valida o CPF considerando os dois dígitos verificadores (RF002). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const firstDigit = checkDigit(weightedSum(cpf.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  if (firstDigit !== Number(cpf[9])) {
    return false;
  }

  const secondDigit = checkDigit(
    weightedSum(cpf.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]),
  );
  return secondDigit === Number(cpf[10]);
}

/** Valida o CNPJ considerando os dois dígitos verificadores (RF002). */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const firstDigit = checkDigit(
    weightedSum(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
  );
  if (firstDigit !== Number(cnpj[12])) {
    return false;
  }

  const secondDigit = checkDigit(
    weightedSum(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]),
  );
  return secondDigit === Number(cnpj[13]);
}

/** Valida o documento de acordo com o tipo de pessoa informado (RF002). */
export function isValidDocument(personType: PersonType, value: string): boolean {
  return personType === 'Física' ? isValidCpf(value) : isValidCnpj(value);
}

/** Aplica a máscara do documento conforme o tipo de pessoa (000.000.000-00 / 00.000.000/0000-00). */
export function formatDocument(personType: PersonType, value: string): string {
  const digits = onlyDigits(value);

  if (personType === 'Física') {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/** Placeholder exibido no campo de documento conforme o tipo de pessoa. */
export function documentPlaceholder(personType: PersonType): string {
  return personType === 'Física' ? '000.000.000-00' : '00.000.000/0000-00';
}
