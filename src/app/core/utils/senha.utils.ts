/**
 * Criptografia REVERSÍVEL de senhas para a base de usuários da plataforma.
 *
 * A senha é gravada na coleção `users` (Firestore) cifrada e o login do
 * Salesforce a descriptografa aqui antes de comparar com a senha digitada —
 * por isso a cifra é simétrica (e não hash). O segredo mora no frontend:
 * protege apenas contra leitura casual da base; em produção o critério
 * definitivo de segurança deve ser definido com o backend.
 */
const CHAVE = 'nexus-plataforma-credenciais-v1';

function chaveBytes(): Uint8Array {
  return new TextEncoder().encode(CHAVE);
}

/** Cifra a senha (UTF-8 → XOR com a chave → base64). */
export function criptografarSenha(senha: string): string {
  const entrada = new TextEncoder().encode(senha);
  const chave = chaveBytes();
  let binario = '';
  for (let i = 0; i < entrada.length; i++) {
    binario += String.fromCharCode(entrada[i] ^ chave[i % chave.length]);
  }
  return btoa(binario);
}

/** Decifra uma senha gravada. Cifra inválida devolve string vazia. */
export function descriptografarSenha(cifra: string): string {
  try {
    const binario = atob(cifra);
    const chave = chaveBytes();
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) {
      bytes[i] = binario.charCodeAt(i) ^ chave[i % chave.length];
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/** Gera uma senha temporária legível (sem caracteres ambíguos) para a empresa. */
export function gerarSenha(tamanho = 10): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const valores = new Uint32Array(tamanho);
  const cryptoGlobal = globalThis.crypto;
  if (cryptoGlobal?.getRandomValues) {
    cryptoGlobal.getRandomValues(valores);
  } else {
    for (let i = 0; i < tamanho; i++) {
      valores[i] = Math.floor(Math.random() * alfabeto.length);
    }
  }
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += alfabeto[valores[i] % alfabeto.length];
  }
  return senha;
}
