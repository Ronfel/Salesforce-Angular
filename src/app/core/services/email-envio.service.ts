import { inject, Injectable } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { FIRESTORE_DATABASE } from '../data/sales.repository.providers';

/**
 * Envio do e-mail com login/senha da empresa recém-cadastrada.
 *
 * Estratégia (padrão Firebase, sem backend próprio): grava um documento na
 * coleção `mail` no formato da extensão **Trigger Email** (Firebase). Com a
 * extensão instalada no projeto (plano Blaze), ela observa `mail` e dispara o
 * e-mail via SMTP configurado. Sem a extensão, o documento fica enfileirado e
 * o admin usa o botão "Abrir e-mail" (mailto) como fallback.
 */
@Injectable({ providedIn: 'root' })
export class EmailEnvioService {
  private readonly database =
    inject(FIRESTORE_DATABASE, { optional: true }) ?? Promise.resolve(null);

  async enviarCredenciais(dados: {
    para: string;
    nomeEmpresa: string;
    login: string;
    senha: string;
  }): Promise<void> {
    const database = await this.database;
    if (!database) {
      throw new Error('Firestore indisponível para enfileirar o e-mail.');
    }
    const sdk = await import('firebase/firestore');
    const assunto = `Acesso ao Nexus Vendas — ${dados.nomeEmpresa}`;
    const texto =
      `Olá, ${dados.nomeEmpresa}!\n\n` +
      `Sua empresa foi cadastrada no Nexus Vendas. Use os dados abaixo para acessar o Salesforce:\n\n` +
      `Login: ${dados.login}\n` +
      `Senha: ${dados.senha}\n\n` +
      `Acesse em /login e troque a senha após o primeiro acesso.`;
    const html =
      `<p>Olá, <strong>${dados.nomeEmpresa}</strong>!</p>` +
      `<p>Sua empresa foi cadastrada no Nexus Vendas. Use os dados abaixo para acessar o Salesforce:</p>` +
      `<ul><li><strong>Login:</strong> ${dados.login}</li>` +
      `<li><strong>Senha:</strong> ${dados.senha}</li></ul>` +
      `<p>Acesse a tela de login e troque a senha após o primeiro acesso.</p>`;

    await sdk.addDoc(sdk.collection(database as Firestore, 'mail'), {
      to: [dados.para],
      message: { subject: assunto, text: texto, html },
      createdAt: new Date().toISOString(),
    });
  }
}
