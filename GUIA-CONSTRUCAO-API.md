# Guia de Construção da API Canônica (Opção C)

> **Para que serve este documento:** ele é uma "cola" pronta para você colar em
> outra IA (Claude, Cursor, ChatGPT, etc.) e pedir: *"construa esta API"*. Também
> serve para você entender **onde hospedar** e **como** o app já consome ela.
>
> O contrato **exato** de cada endpoint está em [`INTEGRACAO-ERP.md`](./INTEGRACAO-ERP.md)
> (seção 4). Este guia não inventa formato — usa o mesmo que o app já fala.

---

## 0. Respostas diretas às suas dúvidas

**"Eu tenho que criar essa API, né?"**
Sim. Na Opção C alguém precisa servir os 3 endpoints (`/auth`, `/pull`, `/push`).
Mas atenção: essa API é **sua infraestrutura** (o "tradutor"/hub), **não** uma base
de dados sua com os dados do cliente. Os dados de cada cliente continuam no ERP
dele; sua API só **traduz** e **transporta**.

**"Consigo disponibilizar no Firebase ou em outro lugar?"**
Sim, e o Firebase é a escolha natural. Você já usa o projeto `app-explorar`. O
serviço certo é o **Cloud Functions** (funções serverless com HTTPS automático).

**"Criar no mesmo projeto ficaria ruim?"**
**Não.** Fica até melhor (é o padrão "monorepo" que o próprio Google recomenda):
uma pasta `functions/` dentro deste repositório. Front e back ficam juntos, e o
mais importante: **compartilham os tipos** `SalesSnapshot` (o tradutor já sabe o
formato exato sem divergir). O que seria ruim é colocar **lógica de ERP/senha
dentro do Angular**. Pasta separada = correto.

**"Não conheço outro serviço além do Firebase."**
Tranquilo — para o seu caso, **não precisa**. Firebase resolve hoje. Só para você
saber que existe alternativa (Render, Railway, Fly.io, Cloudflare Workers), nenhuma
faz sentido adotar agora. Quando o Functions crescer, você migra a mesma API — o
app não muda, porque ele só conhece a URL.

---

## 1. Decisão de hospedagem (recomendação)

| Critério | Recomendação |
|---|---|
| **Onde rodar** | **Firebase Cloud Functions** (região `southamerica-east1` — São Paulo) |
| **Mesmo projeto?** | **Sim**, pasta `functions/` neste repositório |
| **Runtime** | Node.js 20 + Express |
| **Custo** | Grátis para começar (Spark plan), escala sob demanda (Blaze) |
| **URL final** | `https://southamerica-east1-app-explorar.cloudfunctions.net/api` |

> **Importante sobre o "grátis":** Cloud Functions com **saída de rede para a
> internet** (chamar o ERP do cliente, ou acessar a internet fora do Google)
> exige o plano **Blaze** (paga-após-cota). O Firestore e o Functions em si têm
> cota gratuita generosa; a única restrição é "fazer requisição de saída para
> fora do Google". Entrar no Blaze é só cadastrar cartão, com limite de gasto
> configurável. **Alternativa 100% grátis:** rodar a API por enquanto em
> **Render** ou **Railway** (tier grátis aceita saída de rede) e apontar o
> `apiUrl` do app para lá — o contrato é o mesmo, não muda nada no app.

### Arquitetura recomendada (a mais segura para o seu caso)

Como você disse que **cada cliente é um ERP com dados dele**, o desenho seguro é:

```
┌──────────────┐   HTTPS    ┌─────────────────────┐   REST/SOAP   ┌──────────────┐
│  App Angular │ ─────────► │  API Canônica       │ ────────────► │  ERP do      │
│  (navegador) │  /pull     │  (Cloud Functions)  │  (dialeto do  │  cliente     │
│              │ ◄───────── │  "tradutor/hub"     │   ERP)        │              │
└──────────────┘  /push     └─────────────────────┘ ◄──────────── └──────────────┘
```

- O **app** só fala o formato canônico (`SalesSnapshot`) — nunca o dialeto do ERP.
- A **API** conhece o dialeto de cada ERP e traduz para o formato canônico.
- **Credenciais de cada cliente** ficam **só na API** (servidor), nunca no navegador.

> **Quando o app pode falar direto com a API?** Só quando a API for **pública**
> (sem segredos) e com **CORS liberado**. O `HttpSyncAdapter` do projeto está pronto
> exatamente para isso. Se a API guardar token/senha de cliente, o app **não**
> deve chamá-la direto — nesse caso a API grava no **Firestore** e o app lê do
> Firestore (que já funciona). Falamos disso na seção 6.

---

## 2. PROMPT pronto para colar em outra IA

Copie **tudo** entre as linhas abaixo e cole na IA que vai construir a API.
Ele já contém o contrato exato que o app consome.

```
CONTEXTO
Estou construindo a API canônica (backend "hub/tradutor") para um app de força de
vendas (Angular) já existente. O app espera 3 endpoints HTTP. Não invente formato:
siga EXATAMENTE este contrato, que espelha os tipos TypeScript já existentes no app.

STACK
- Node.js 20 + Express + CORS.
- Hospedagem: Firebase Cloud Functions (região southamerica-east1). Exporte uma
  única function HTTP chamada "api" que atende todas as rotas abaixo.
- Em memória (por enquanto) use um array de dados fixos simulando um ERP; deixe
  um ponto claro (TODO) onde entra a chamada real ao ERP do cliente.

FORMATO CANÔNICO (os tipos são exatamente estes)
Client        = { id, personType: "Física"|"Jurídica", name, document, inscricaoEstadual, email, phone, city, state, address, priceTableId, paymentConditionId, createdAt, synced }
Product       = { id, sku, name, category, price:number, stock:number }
PriceTable    = { id, code, name, discountPercent:number }
PaymentCondition = { id, code, name, days:number }
OrderItem     = { productId, productName, quantity:number, unitPrice:number, neededDate, discount:number }
SalesOrder    = { id, clientId, clientName, sellerId, sellerName, priceTableId, paymentConditionId, createdAt, items:OrderItem[], status: "Pendente"|"Em separação"|"Enviado"|"Entregue", total:number, synced }
Appointment   = { id, clientId, clientName, date, time, address, status: "Agendada"|"Concluída", synced }
SalesSnapshot = { clients, products, priceTables, paymentConditions, orders, appointments, lastSyncedAt:string|null }

ENDPOINTS (todos retornam JSON; todas as datas em string ISO "YYYY-MM-DD")

1) POST /auth
   Body:  { login, senha }
   200:   { seller: { id, empresa, login, nome } }   // NÃO devolva senha
   401:   { message: "Credenciais inválidas" }
   Regra: valide login/senha contra o cadastro do ERP e devolva o vendedor.
          O app NUNCA reenvia a senha depois; o seller identifica a sessão.

2) POST /pull
   Body:  { sellerId, data: "YYYY-MM-DD" }
   200:   { snapshot: SalesSnapshot }
   Regra: devolva os dados do ERP filtrados pelo vendedor/sellerId.
          - orders/agenda: do dia "data" em diante (ou o histórico que o ERP expuser).
          - clients: carteira do vendedor.
          - products/priceTables/paymentConditions: catálogo geral.
          - lastSyncedAt: new Date().toISOString().

3) POST /push
   Body:  { sellerId, pedidos: SalesOrder[], visitasConcluidas: Appointment[] }
   200:   { ok: true, gravados: { pedidos:number, visitas:number } }
   400:   { message: "..." }
   Regra: grave no ERP os pedidos novos e as visitas concluídas. Marque-os como
          sincronizados no ERP. "gravados" é só para exibir o contador no app.

CORS: libere a origem do app (http://localhost:4200 e o domínio de produção).
MODO TESTE: mantenha dados fixos em memória para eu testar sem ERP real.
ENTREGÁVEL: código pronto para rodar local (npm start) e para deploy no Functions.

REGRAS DE ESTILO
- Sempre responder JSON. Em erro, HTTP adequado (401/400/500) + { message }.
- Validar o body e devolver 400 com mensagem clara se faltar campo.
- Não expor stack trace em produção.
```

---

## 3. API de referência (funcional, para copiar e rodar)

Este é um servidor **mínimo e completo** que já satisfaz o contrato acima e roda
com dados falsos em memória. Use para testar o app **antes** de ter ERP real.
Você roda local (`node server.js`) **ou** empacota no Functions depois.

### 3.1 Rodar local (mais rápido para começar)

Crie uma pasta separada, ex.: `api-test/`, com:

**`api-test/package.json`**
```json
{
  "name": "api-test",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.19.2", "cors": "^2.8.5" }
}
```

**`api-test/server.js`** (contrato completo, dados falsos):
```js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());            // em produção, restrina a origem do app
app.use(express.json());

// ---- dados falsos (substitua pelo ERP real) ----
const seller = { id: 'v1', empresa: 'Distribuidora XPTO', login: 'rodrigo', nome: 'Rodrigo' };
const snapshot = () => ({
  clients: [{ id: 'c1', personType: 'Jurídica', name: 'Mercado São Lucas', document: '12.345.678/0001-90', inscricaoEstadual: '123456', email: 'compras@saolucas.com', phone: '(11) 98888-0000', city: 'São Paulo', state: 'SP', address: 'Rua das Flores, 100', priceTableId: 'pt1', paymentConditionId: 'pc1', createdAt: '2026-01-10', synced: true }],
  products: [{ id: 'p1', sku: 'COCA-2L', name: 'Coca-Cola 2L', category: 'Bebidas', price: 12.5, stock: 120 }],
  priceTables: [{ id: 'pt1', code: 'VAREJO', name: 'Varejo', discountPercent: 5 }],
  paymentConditions: [{ id: 'pc1', code: '30DD', name: '30 dias', days: 30 }],
  orders: [],
  appointments: [{ id: 'a1', clientId: 'c1', clientName: 'Mercado São Lucas', date: '2026-10-13', time: '09:00', address: 'Rua das Flores, 100', status: 'Agendada', synced: true }],
  lastSyncedAt: new Date().toISOString(),
});

// ---- endpoints ----
app.post('/auth', (req, res) => {
  const { login, senha } = req.body ?? {};
  if (login === seller.login && senha === '123456') {
    // NUNCA devolvemos a senha
    return res.json({ seller });
  }
  return res.status(401).json({ message: 'Credenciais inválidas' });
});

app.post('/pull', (req, res) => {
  const { sellerId } = req.body ?? {};
  if (!sellerId) return res.status(400).json({ message: 'sellerId obrigatório' });
  return res.json({ snapshot: snapshot() });   // filtre por sellerId/ERP aqui
});

app.post('/push', (req, res) => {
  const { pedidos = [], visitasConcluidas = [] } = req.body ?? {};
  // grave no ERP e marque como sincronizado
  return res.json({ ok: true, gravados: { pedidos: pedidos.length, visitas: visitasConcluidas.length } });
});

app.listen(3001, () => console.log('API canônica em http://localhost:3001'));
```

Rode e ligue o app:
```bash
cd api-test && npm install && npm start
```
Em `src/environments/environment.ts`:
```ts
export const environment = {
  apiUrl: 'http://localhost:3001',
  firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' },
};
```
Reinicie `ng serve`. O `HttpSyncAdapter` detecta `apiUrl` preenchido e o app
passa a consumir a API. Se `apiUrl` voltar a `''`, volta automaticamente para
Firestore/Demo.

### 3.2 Verificar se está certo (rápido)

```bash
curl -i -X POST http://localhost:3001/auth -H "Content-Type: application/json" -d "{\"login\":\"rodrigo\",\"senha\":\"123456\"}"
curl -i -X POST http://localhost:3001/pull  -H "Content-Type: application/json" -d "{\"sellerId\":\"v1\"}"
```
Esperado: `200` com `{ "seller": {...} }` e `{ "snapshot": {...} }`.

---

## 4. Colocar a API no ar (Firebase Cloud Functions)

Quando quiser deixar **online com HTTPS**, empacote a mesma API no Functions.
Crie a pasta `functions/` **neste repositório** (monorepo — mesmo projeto Firebase):

```bash
# 1) na raiz do projeto, inicializa o Functions (Node 20)
firebase init functions        # escolha JavaScript/ESM, aponta p/ pasta functions/

# 2) dentro de functions/, instale express + cors
cd functions
npm install express cors

# 3) em functions/index.js envolva o app:
#    import express... (o mesmo server.js acima, mas sem app.listen)
#    export const api = onRequest(app);
```

Exemplo de `functions/index.js`:
```js
import { onRequest } from 'firebase-functions/v2/https';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
// ...cole aqui as rotas /auth, /pull, /push iguais às do server.js...

export const api = onRequest(app);   // região padrão; troque p/ southamerica-east1
```

Deploy e ligação:
```bash
firebase deploy --only functions          # sobe só a API (não mexe no site)
firebase functions:log                     # ver logs se algo falhar
```
A URL gerada é tipo `https://<region>-app-explorar.cloudfunctions.net/api`.
Cole ela em `environment.ts` → `apiUrl`. O app volta a consumir via API, agora online.

> Em produção, troque `cors({ origin: true })` por `cors({ origin: ['https://seu-dominio'] })`
> e **nunca** use dados fixos — aí entra a chamada real ao ERP do cliente (o ponto TODO).

---

## 5. Como o app já escolhe a fonte (não precisa mexer nas telas)

O app já está pronto para as 3 fontes. A escolha é automática em
`src/app/core/data/sales.repository.providers.ts`:

```
environment.apiUrl preenchido  →  HttpSyncAdapter (sua API canônica)   ← novo
senão, Firebase configurado    →  FirestoreSyncAdapter
senão                          →  DemoSyncAdapter (base falsa offline)
```

Ou seja: **você não altera nenhuma tela** (Visão geral, Pedidos, Rota, Sync).
Só preenche `apiUrl`. Está tudo isolado atrás da interface `SyncAdapter`.

---

## 6. Segurança — o detalhe que separa "funciona" de "é seguro"

- **Sem segredos no navegador.** Se a API guardar token/senha de cliente, o app
  **não** deve chamá-la direto. Nesse caso a API grava no **Firestore** e o app
  lê do Firestore (hoje a API ainda é pública/sem segredo, então está ok).
- **Nunca commite `environment.ts` com credenciais reais.** Use variáveis de
  ambiente no build/deploy.
- **CORS restrito** em produção (só a origem do seu site).
- Confiança: o que está em `INTEGRACAO-ERP.md` (seção 4) é o mesmo contrato daqui.

---

## 7. Roteiro sugerido (mínimo esforço, na ordem)

1. **Hoje:** rode a API local (`api-test/`), aponte `apiUrl = http://localhost:3001`,
   valide login → pull → criar pedido → push no app. (~15 min)
2. **Depois:** troque os dados falsos pelo ERP do primeiro cliente (só o `/pull` e `/push`).
3. **Quando ficar estável:** `firebase deploy --only functions` para deixar online.
4. **No dia a dia:** cada ERP novo = só ajustar o tradutor dentro da API; **o app não muda**.

Se travar em qualquer passo, o erro quase sempre é CORS ou `apiUrl` não reiniciado
(o `ng serve` precisa ser reiniciado ao mudar `environment.ts`).

