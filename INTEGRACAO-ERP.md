# Integração com ERPs — Contrato Canônico (Opção C)

Este documento descreve **como conectar qualquer ERP** ao Nexus Vendas pelo
caminho de **mínimo esforço repetido**: uma **API canônica única** que todo ERP
entrega/consome, sem que o aplicativo (Angular) precise mudar a cada integração.

> **Regra de ouro:** o app **não conhece ERPs**. Ele conhece apenas o
> `SalesSnapshot` (formato canônico) através do contrato `SyncAdapter`.
> Plugar um ERP = escrever um **tradutor pequeno** que mapeia o ERP → formato
> canônico. O site nunca muda.

---

## 1. Por que este formato existe (o isolamento já está pronto)

O projeto já separa as responsabilidades em três camadas. Você só mexe na
**camada de cima** (o tradutor do ERP); as outras duas permanecem intactas:

| Camada | Onde vive | Papel | Muda por ERP? |
|---|---|---|---|
| **UI / telas** | `features/*` (Visão geral, Pedidos, Rota, Sync) | Consome o snapshot já normalizado | ❌ Nunca |
| **Repositório local-first** | `core/data/local-storage-sales.repository.ts` | Guarda no `localStorage`, faz merge, marca `synced` | ❌ Nunca |
| **Contrato de integração** | `core/data/sync.adapter.ts` (`SyncAdapter`) | A "porta" que todo ERP implementa | ❌ Nunca |
| **Tradutor do ERP** | servidor (API canônica) ou low-code | Mapeia ERP → `SalesSnapshot` | ✅ Só esta |

O contrato (`SyncAdapter`) tem exatamente **três operações**:

```ts
interface SyncAdapter {
  authenticate(credentials): Promise<Seller | null>;   // login (RF001)
  pull(selection, context): Promise<Partial<SalesSnapshot>>; // download seletivo (RF018)
  push(pending): Promise<void>;                        // upload de pendentes (RF018)
}
```

---

## 2. O formato canônico: `SalesSnapshot`

Toda integração produz/consome objetos neste formato. Os campos abaixo são os
**reais** de `src/app/core/models/sales.models.ts`.

### 2.1 Cliente (`Client`)
| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| `id` | string | sim | Identificador estável (usado como chave do documento). |
| `personType` | `'Física' \| 'Jurídica'` | sim | |
| `name` | string | sim | Nome / Razão social. |
| `document` | string | sim | CPF ou CNPJ. |
| `inscricaoEstadual` | string | recom. | Pode ser `'ISENTO'`. |
| `email` | string | sim | |
| `phone` | string | sim | |
| `city` | string | sim | |
| `state` | string | sim | UF (ex.: `'SP'`). |
| `address` | string | sim | |
| `priceTableId` | string | sim | Aponta para uma `PriceTable.id`. |
| `paymentConditionId` | string | sim | Aponta para uma `PaymentCondition.id`. |
| `createdAt` | string | sim | Data ISO `AAAA-MM-DD`. |
| `synced` | boolean | no* | Controle interno do app. Na **entrada** do servidor pode ser ignorado. |

### 2.2 Produto (`Product`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | |
| `sku` | string | Código do produto. |
| `name` | string | |
| `category` | string | |
| `price` | number | Preço base. |
| `stock` | number | |

### 2.3 Tabela de preço (`PriceTable`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | |
| `code` | string | |
| `name` | string | |
| `discountPercent` | number | Desconto % sobre o preço base. |

### 2.4 Condição de pagamento (`PaymentCondition`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | |
| `code` | string | |
| `name` | string | |
| `days` | number | Prazo em dias. |

### 2.5 Item do pedido (`OrderItem`)
| Campo | Tipo | Observação |
|---|---|---|
| `productId` | string | Aponta para `Product.id`. |
| `productName` | string | Nome congelado no momento do pedido. |
| `quantity` | number | |
| `unitPrice` | number | Já calculado pela tabela de preço do pedido. |
| `neededDate` | string | Data de entrega desejada `AAAA-MM-DD` (RF013). |
| `discount` | number | % de desconto do item. |

### 2.6 Pedido (`SalesOrder`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | |
| `clientId` / `clientName` | string | |
| `sellerId` / `sellerName` | string | **Obrigatórios**: o download filtra pedidos pelo `sellerId` da sessão. |
| `priceTableId` / `paymentConditionId` | string | |
| `createdAt` | string | ISO. |
| `items` | OrderItem[] | |
| `status` | `'Pendente' \| 'Em separação' \| 'Enviado' \| 'Entregue'` | |
| `total` | number | |
| `synced` | boolean | Controle interno do app. |

### 2.7 Agendamento / visita (`Appointment`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | |
| `clientId` / `clientName` | string | |
| `date` | string | ISO `AAAA-MM-DD`. |
| `time` | string | `HH:MM`. |
| `address` | string | |
| `status` | `'Agendada' \| 'Concluída'` | |
| `synced` | boolean | Controle interno do app. |

### 2.8 Vendedor (login) (`Seller`)
| Campo | Tipo | Observação |
|---|---|---|
| `id` | string | ID do vendedor (vira o `sellerId`). |
| `login` | string | Comparado sem diferenciar maiúsc/minúsc. |
| `senha` | string | **Aqui é responsabilidade do servidor**: em produção use hash. |
| `empresa` | string | |
| `nome` | string | |

### 2.9 Snapshot completo (`SalesSnapshot`)
```ts
{
  clients: Client[],
  products: Product[],
  priceTables: PriceTable[],
  paymentConditions: PaymentCondition[],
  orders: SalesOrder[],
  appointments: Appointment[],
  lastSyncedAt: string | null   // ISO datetime do servidor, ou null
}
```

---

## 3. Como plugar um ERP no dia a dia

Você tem **duas responsabilidades** ao receber um ERP novo:

1. **Um tradutor** (roda no servidor / low-code) que converte o dialeto do ERP
   para o formato canônico acima.
2. **Nada no app.** O site continua lendo o mesmo `SalesSnapshot`.

### 3.1 Comparação honesta dos caminhos

| Caminho | Onde roda o tradutor | Esforço por ERP novo | App muda? | Segurança |
|---|---|---|---|---|
| **A** — `HttpSyncAdapter` no navegador | No front (bundle) | Baixo no 1º, **cresce** a cada ERP | Sim | ⚠️ Fraca (credencial/CORS) |
| **B** — Ingeridor grava no Firestore | Cloud Function (Firebase) | Médio, depois +1 função | ❌ Nunca | ✅ Forte |
| **C — escolhida** — API canônica única | Backend/low-code expõe **1 formato** | **Menor a partir do 2º ERP** | ❌ Nunca | ✅ Forte |

**Por que C vence com "ERPs diversos":** o app fala com **uma única boca**
(o endpoint canônico). Cada ERP novo é só **mais um tradutor** alimentando essa
boca — nunca mais código dentro do site. O número de adapters no front fica
**sempre em 1**.

### 3.2 Os três lugares possíveis para o tradutor (do mais fácil ao mais robusto)

1. **No próprio ERP**, se ele permitir export/script/personalização → já exporta
   no formato canônico e grava direto. **Zero código seu.**
2. **Low-code** (n8n, Make, Zapier) → a maioria dos ERPs já tem conector pronto;
   você só arrasta os campos para o formato canônico. **Quase zero código.**
3. **Cloud Function / script seu** → quando o ERP não tem conector nem export.
   Mais controle, mais esforço.

> Dica: com **B + C juntos**, cada ERP tem um ingeridor low-code que escreve no
> Firestore **no mesmo formato canônico**. O app não muda e você ganha
> segurança (credenciais do ERP ficam no servidor).

---

## 4. O contrato HTTP canônico (a "boca" única)

Este é o **formato único** que todo ERP deve expor (via tradutor/backend). Ele
espelha **exatamente** as três operações do `SyncAdapter` do projeto, então o
app consome com **um** `HttpSyncAdapter` e nada mais.

Base URL (exemplo): `https://api.suaempresa.com.br/nexus`

### 4.1 `POST /auth` — login (equivale a `authenticate`)

**Request**
```json
{ "login": "rodrigo", "senha": "123456" }
```
**Resposta 200** (equivale ao `Seller`; `senha` **não** deve voltar em produção)
```json
{ "id": "seller-1", "empresa": "NOVA", "nome": "Rodrigo Neves" }
```
**Resposta 401** — credenciais inválidas → o app trata como login negado.

### 4.2 `POST /pull` — download seletivo (equivale a `pull`)

**Request** — `selection` = quais conjuntos baixar; `context` = vendedor logado.
```json
{
  "selection": {
    "clients": true,
    "appointments": true,
    "lastOrders": true,
    "priceTables": true,
    "paymentConditions": true,
    "products": true
  },
  "context": { "sellerId": "seller-1", "scheduledClientIds": ["client-1", "client-3"] }
}
```

**Resposta 200** — um `SalesSnapshot` **parcial**: só as chaves com `true` em
`selection`. Exemplo (com todas as seleções ativas) — veja a seção 5 para o
payload completo campo a campo.

> **Regra de `lastOrders`:** devolva **apenas os pedidos do `sellerId`** do
> contexto, do mais recente ao mais antigo. Se `sellerId` vier vazio, devolva
> lista vazia (nunca exponha pedidos de outro vendedor).

### 4.3 `POST /push` — upload de pendentes (equivale a `push`)

**Request** — somente o que está com `synced: false` e foi marcado pelo usuário.
```json
{
  "clients": [ /* Client[] */ ],
  "orders": [ /* SalesOrder[] */ ],
  "appointments": [ /* Appointment[] (visitas concluídas) */ ]
}
```
**Resposta 204** — sucesso. O app então marca localmente como `synced: true`.

> **Convenção de idempotência:** o servidor grava/atualiza pelo **`id`** do
> registro (como faz o Firestore com `setDoc`). Reenviar o mesmo `id` não duplica.

---

## 5. Exemplo real de payload (`POST /pull` 200)

Baseado nos dados de demonstração do projeto (`core/data/demo-data.ts`).
Copie este JSON como ponto de partida para o seu tradutor.

```json
{
  "clients": [
    {
      "id": "client-1",
      "personType": "Jurídica",
      "name": "Mercado São Lucas",
      "document": "11.222.333/0001-81",
      "inscricaoEstadual": "110.442.557.114",
      "email": "compras@saolucas.com.br",
      "phone": "(11) 98765-4321",
      "city": "São Paulo",
      "state": "SP",
      "address": "Av. Paulista, 1200",
      "priceTableId": "pt-normal",
      "paymentConditionId": "pc-28",
      "createdAt": "2025-09-24",
      "synced": true
    }
  ],
  "products": [
    { "id": "product-1", "sku": "BEB-001", "name": "Café especial 500g", "category": "Mercearia", "price": 24.9, "stock": 86 }
  ],
  "priceTables": [
    { "id": "pt-normal", "code": "NORMAL", "name": "Tabela normal", "discountPercent": 0 }
  ],
  "paymentConditions": [
    { "id": "pc-28", "code": "28D", "name": "28 dias", "days": 28 }
  ],
  "orders": [
    {
      "id": "PED-1047",
      "clientId": "client-3",
      "clientName": "Padaria Pão & Prosa",
      "sellerId": "seller-1",
      "sellerName": "Rodrigo Neves",
      "priceTableId": "pt-normal",
      "paymentConditionId": "pc-vista",
      "createdAt": "2025-10-12",
      "items": [
        { "productId": "product-3", "productName": "Queijo minas padrão 1kg", "quantity": 10, "unitPrice": 42, "neededDate": "2025-10-13", "discount": 0 }
      ],
      "status": "Pendente",
      "total": 420,
      "synced": true
    }
  ],
  "appointments": [
    {
      "id": "visit-1",
      "clientId": "client-1",
      "clientName": "Mercado São Lucas",
      "date": "2025-10-12",
      "time": "09:00",
      "address": "Av. Paulista, 1200 · São Paulo, SP",
      "status": "Agendada",
      "synced": true
    }
  ],
  "lastSyncedAt": "2025-10-12T14:35:00.000Z"
}
```

### 5.1 Regras de valores que o tradutor deve garantir

- **Datas**: `createdAt`/`neededDate`/`date` no formato `AAAA-MM-DD`;
  `lastSyncedAt` em ISO datetime completo.
- **`unitPrice`** já deve vir **calculado pela tabela de preço** do pedido
  (preço base − desconto da tabela). O app **não** recalcula.
- **`status`** de pedido só pode ser um de: `Pendente`, `Em separação`,
  `Enviado`, `Entregue`.
- **`status`** de visita só pode ser `Agendada` ou `Concluída`.
- **Relacionamentos** (`priceTableId`, `paymentConditionId`, `productId`,
  `clientId`, `sellerId`) devem apontar para `id`s que existem no mesmo
  snapshot — o app faz lookup por esses ids.
- **`total`** do pedido = Σ `quantity × unitPrice × (1 − discount/100)`.

---

## 6. Ligar a API canônica no app (opcional, se quiser consumir direto)

Na Opção C pura o app **não muda**: o tradutor grava no formato canônico (ou no
Firestore) e o `FirestoreSyncAdapter`/ingeridor já entrega. Mas se você quiser
que o **navegador consuma a API canônica direto**, basta:

1. Criar **um** adapter que implementa `SyncAdapter` (ver
   `core/data/sync.adapter.ts`) usando `HttpClient` para chamar `/auth`, `/pull`
   e `/push` da seção 4.
2. Registrá-lo em `core/data/sales.repository.providers.ts` no lugar do binário
   `Firebase-ou-Demo` (linha ~37). Exemplo de direção:

```ts
// sales.repository.providers.ts
{
  provide: SYNC_ADAPTER,
  useFactory: () =>
    isFirebaseConfigured()
      ? new FirestoreSyncAdapter(inject(FIRESTORE_DATABASE))  // Opção B
      : new HttpSyncAdapter(inject(HttpClient)),              // Opção C direta
}
```

> **Recomendação de segurança:** só aponte o `HttpSyncAdapter` direto no
> navegador se a API canônica for **pública** (sem segredos) e com **CORS
> liberado**. Para ERP real com credencial, prefira a **Opção B** (ingeridor no
> servidor → Firestore) e mantenha o app intacto.

---

## 7. Checklist para plugar um ERP novo

- [ ] O ERP expõe (ou você traduz) os 6 conjuntos: `clients`, `products`,
      `priceTables`, `paymentConditions`, `orders`, `appointments`.
- [ ] O login valida contra a tabela de vendedores e devolve `id`/`empresa`/`nome`.
- [ ] `pull` respeita o `sellerId` do contexto em `lastOrders`.
- [ ] `push` grava por `id` (idempotente) e aceita `clients`/`orders`/`appointments`.
- [ ] Datas, enums e relacionamentos seguem as regras da seção 5.1.
- [ ] O app **não** foi alterado (só o tradutor).

---

## 8. Onde mexer no código (referência rápida)

| Responsabilidade | Arquivo |
|---|---|
| Contrato de integração (a "porta") | `src/app/core/data/sync.adapter.ts` |
| Exemplos de adapter | `src/app/core/data/firestore-sync.adapter.ts`, `demo-sync.adapter.ts` |
| Seleção do adapter | `src/app/core/data/sales.repository.providers.ts` |
| Modelos canônicos | `src/app/core/models/sales.models.ts` |
| Exemplo de dados | `src/app/core/data/demo-data.ts` |

Para adicionar um **novo adapter** (ex.: `HttpSyncAdapter` ou outro ERP), siga o
formato de `firestore-sync.adapter.ts`: implemente `authenticate`, `pull` e
`push` devolvendo/consumindo os tipos de `sales.models.ts`.

