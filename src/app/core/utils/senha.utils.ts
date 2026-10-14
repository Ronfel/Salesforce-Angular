/**
 * Geração de senha temporária aleatória para provisionar a conta da empresa
 * no Firebase Authentication.
 *
 * A senha temporária NUNCA é exibida nem enviada: serve só para cumprir a
 * exigência do Authentication de criar a conta com uma senha. A empresa
 * define a própria senha pelo e-mail OFICIAL do Firebase disparado no
 * cadastro (redefinição de senha). Nenhuma senha é gravada no Firestore —
 * a tabela `users` guarda só o perfil (doc = UID).
 */
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
