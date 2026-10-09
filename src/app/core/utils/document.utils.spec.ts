import { createDemoSnapshot } from '../data/demo-data';
import {
  documentPlaceholder,
  formatDocument,
  isValidCnpj,
  isValidCpf,
  isValidDocument,
  onlyDigits,
} from './document.utils';

describe('document.utils', () => {
  it('should validate known valid CPFs', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
  });

  it('should reject invalid CPFs', () => {
    expect(isValidCpf('111.444.777-33')).toBe(false);
    expect(isValidCpf('12345678900')).toBe(false);
    expect(isValidCpf('000.000.000-00')).toBe(false);
  });

  it('should validate known valid CNPJs', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('45.678.901/0001-75')).toBe(true);
    expect(isValidCnpj('23.456.789/0001-95')).toBe(true);
    expect(isValidCnpj('34.567.890/0001-30')).toBe(true);
  });

  it('should reject invalid CNPJs', () => {
    expect(isValidCnpj('11.222.333/0001-90')).toBe(false);
    expect(isValidCnpj('12345678000100')).toBe(false);
  });

  it('should dispatch validation by person type (RF002)', () => {
    expect(isValidDocument('Física', '529.982.247-25')).toBe(true);
    expect(isValidDocument('Física', '11.222.333/0001-81')).toBe(false);
    expect(isValidDocument('Jurídica', '11.222.333/0001-81')).toBe(true);
    expect(isValidDocument('Jurídica', '529.982.247-25')).toBe(false);
  });

  it('should validate every client document present in the demo seed', () => {
    for (const client of createDemoSnapshot().clients) {
      expect(isValidDocument(client.personType, client.document), client.name).toBe(true);
    }
  });

  it('should format documents with the CPF/CNPJ mask', () => {
    expect(formatDocument('Física', '52998224725')).toBe('529.982.247-25');
    expect(formatDocument('Jurídica', '11222333000181')).toBe('11.222.333/0001-81');
    expect(formatDocument('Jurídica', '1122233300018111')).toBe('11.222.333/0001-81');
  });

  it('should strip non digits and expose the placeholder per person type', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
    expect(documentPlaceholder('Física')).toBe('000.000.000-00');
    expect(documentPlaceholder('Jurídica')).toBe('00.000.000/0000-00');
  });
});
