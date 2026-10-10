# Nexus Vendas

Aplicação web para apoiar a rotina da força de vendas: carteira de clientes, pedidos com vários itens, catálogo, agenda diária e sincronização. A interface foi adaptada dos requisitos funcionais do PDF fornecido; não é uma conversão do aplicativo Android.

## Executar localmente

```bash
npm install
npm start
```

Abra `http://localhost:4200`. Sem credenciais Firebase, o projeto inicia em modo demonstração e persiste as alterações no `localStorage` deste navegador.

## Conectar ao Firebase

1. Crie um projeto Firebase e registre uma aplicação Web.
2. Habilite o Cloud Firestore no projeto.
3. Copie a configuração pública da aplicação Web para `src/environments/environment.ts`.
4. Publique regras de segurança do Firestore antes de usar dados reais (`firebase deploy --only firestore:rules` — veja `firestore.rules`, que contém regras abertas apenas para desenvolvimento).
5. Crie a coleção `sellers` com documentos `{ login, senha, empresa, nome }` (ex.: `rodrigo` / `123456` / `NOVA`).

> O login pede apenas **Usuário** e **Senha** (modo demonstração: `rodrigo` / `123456`). Quando o Firebase está configurado, a validação usa a coleção `sellers` no Firestore; se a permissão for negada, o app usa a base demo local como fallback.

O adaptador grava e lê as coleções `clients`, `products`, `orders` e `appointments`, usando o ID de cada documento como identificador. As credenciais Web do Firebase identificam o projeto, mas **não** substituem autenticação nem regras de segurança. Não coloque chaves privadas ou segredos neste arquivo.

## Organização

- `src/app/core/models`: modelos de domínio.
- `src/app/core/data`: contrato do repositório e adaptadores Firestore/local.
- `src/app/core/services`: estado e operações da aplicação.
- `src/app/app.ts`, `app.html` e `app.scss`: shell e páginas standalone com Angular Material.
- `src/environments/environment.ts`: configuração pública do Firebase.

## Funcionalidades

- Painel com indicadores, pedidos recentes e visitas do dia.
- Cadastro, busca, edição e exclusão de clientes.
- Criação e edição de pedidos com múltiplos produtos e cálculo automático do total.
- Consulta dinâmica de produtos, preços e disponibilidade.
- Consulta da agenda diária e marcação de visitas concluídas.
- Atualização dos dados do Firestore quando as credenciais estão configuradas.
- Modo demonstração com dados de exemplo e persistência local para desenvolvimento sem projeto Firebase.

Execute `npm test` para os testes unitários e `npm run build` para validar o build.
