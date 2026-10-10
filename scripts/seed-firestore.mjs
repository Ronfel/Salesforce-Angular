#!/usr/bin/env node
/**
 * Seed do Firestore (simula a base do ERP para testes do SFA).
 * Uso:
 *   node scripts/seed-firestore.mjs [--dry-run] [--clients 50 --products 80 --orders 200 --appointments 30] [--clean]
 * Escreve com o SDK Web (mesma config de src/environments/environment.ts).
 * IDs determinísticos (reruns sobrescrevem, sem duplicar).
 */
import { initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDTedm2otI21G5q4SuUlKp0SgsfZmMDvYw',
  authDomain: 'app-explorar.firebaseapp.com',
  databaseURL: 'https://app-explorar-default-rtdb.firebaseio.com',
  projectId: 'app-explorar',
  storageBucket: 'app-explorar.firebasestorage.app',
  messagingSenderId: '1018154961225',
  appId: '1:1018154961225:web:4eec14dea8a427d8543298',
};

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] === undefined ? '1' : arr[i + 1]] : []).filter(Boolean)),
);
const num = (k, d) => Number.parseInt(args[k] ?? d, 10);
const OPTS = {
  dryRun: 'dry-run' in args, clean: 'clean' in args,
  clients: num('clients', 50), products: num('products', 80),
  orders: num('orders', 200), appointments: num('appointments', 30),
};

// RNG determinístico (mulberry32) p/ seed reproduzível.
let _s = 42;
const rnd = () => ((_s = (_s + 0x6d2b79f5) | 0), ((Math.imul(_s ^ (_s >>> 15), 1 | _s) + 0x9e3779b9) >>> 0) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const isoDay = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const isoDateTime = (dayOffset, h, m) => { const d = new Date(); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.toISOString(); };
const cnpj = () => `${int(10, 49)}.${int(100, 999)}.${int(100, 999)}/0001-${int(10, 99)}`;
const phone = () => `(${pick(['11', '19', '21', '31', '41'])}) 9${int(6000, 9999)}-${int(1000, 9999)}`;

const SELLERS = [
  { id: 'seller-1', login: 'rodrigo', senha: '123456', empresa: 'NOVA', nome: 'Rodrigo Neves' },
  { id: 'seller-2', login: 'mariana', senha: '123456', empresa: 'NOVA', nome: 'Mariana Duarte' },
];
const PRICE_TABLES = [
  { id: 'pt-normal', code: 'NORMAL', name: 'Tabela Normal', discountPercent: 0 },
  { id: 'pt-promo', code: 'PROMO', name: 'Tabela Promocional', discountPercent: 10 },
  { id: 'pt-atacado', code: 'ATAC', name: 'Tabela Atacado', discountPercent: 15 },
];
const PAYMENTS = [
  { id: 'pc-vista', code: 'VISTA', name: 'À vista', days: 0 },
  { id: 'pc-14', code: 'P14', name: '14 dias', days: 14 },
  { id: 'pc-21', code: 'P21', name: '21 dias', days: 21 },
  { id: 'pc-28', code: 'P28', name: '28 dias', days: 28 },
  { id: 'pc-30', code: 'P30', name: '30 dias', days: 30 },
];
const CATS = [
  ['Bebidas', 'BEB', ['Suco de uva integral 1L', 'Água mineral sem gás 1,5L', 'Refrigerante cola 2L', 'Cerveja pilsen 350ml', 'Vinho tinto seco 750ml', 'Café torrado e moído 1kg']],
  ['Mercearia', 'MER', ['Arroz branco tipo 1 5kg', 'Feijão carioca 1kg', 'Azeite extra virgem 500ml', 'Açúcar cristal 1kg', 'Farinha de trigo 1kg', 'Macarrão espaguete 500g']],
  ['Laticínios', 'LAC', ['Queijo minas padrão 1kg', 'Leite integral 1L', 'Iogurte natural 850g', 'Manteiga com sal 500g', 'Requeijão cremoso 400g']],
  ['Limpeza', 'LIM', ['Detergente neutro 500ml', 'Sabão em pó 2kg', 'Desinfetante pinho 2L', 'Água sanitária 2L', 'Esponja multiuso 3un']],
  ['Hortifruti', 'HOR', ['Banana prata 1kg', 'Tomate italiano 1kg', 'Cebola nacional 1kg', 'Batata inglesa 1kg', 'Maçã gala 1kg']],
];
const CLIENT_BASE = ['Mercado', 'Empório', 'Padaria', 'Armazém', 'Supermercado', 'Atacadão', 'Mercearia', 'Quitanda', 'Adega', 'Hortifruti'];
const CLIENT_NAME = ['São Lucas', 'Vila Nova', 'Pão & Prosa', 'Central', 'Boa Vista', 'Santa Rosa', 'Alto da Serra', 'Bela Vista', 'Porto Seguro', 'Santa Clara', 'Jardim Paulista', 'Vila Rica', 'São José', 'Nossa Terra', 'Bom Preço'];
const CITIES = [['São Paulo', 'SP'], ['Campinas', 'SP'], ['Jundiaí', 'SP'], ['Sorocaba', 'SP'], ['Guarulhos', 'SP'], ['Osasco', 'SP'], ['Valinhos', 'SP'], ['Vinhedo', 'SP'], ['Itu', 'SP'], ['Salto', 'SP']];
const STREETS = ['Av. Paulista', 'Rua das Flores', 'Rua do Comércio', 'Praça da Matriz', 'Av. Brasil', 'Rua XV de Novembro', 'Av. das Américas', 'Rua São João'];

function buildClients(n) {
  return Array.from({ length: n }, (_, i) => {
    const name = `${pick(CLIENT_BASE)} ${CLIENT_NAME[i % CLIENT_NAME.length]}${n > CLIENT_NAME.length ? ` ${Math.floor(i / CLIENT_NAME.length) + 1}` : ''}`;
    const [city, state] = pick(CITIES);
    const address = `${pick(STREETS)}, ${int(10, 2900)}`;
    const pt = pick(PRICE_TABLES), pc = pick(PAYMENTS);
    const base = slug(name).slice(0, 18) || `cliente${i + 1}`;
    return {
      id: `client-seed-${String(i + 1).padStart(3, '0')}`,
      personType: 'Jurídica', name, document: cnpj(),
      inscricaoEstadual: `${int(100, 699)}.${int(100, 999)}.${int(100, 999)}.11${int(0, 9)}`,
      email: `${i === 0 ? 'compras' : pick(['contato', 'pedidos', 'financeiro', 'compras'])}@${base}.com.br`,
      phone: phone(), city, state, address,
      priceTableId: pt.id, paymentConditionId: pc.id,
      createdAt: isoDay(-int(1, 60)), synced: true,
    };
  });
}

function buildProducts(n) {
  const flat = CATS.flatMap(([category, prefix, names]) => names.map((name) => ({ category, prefix, name })));
  return Array.from({ length: n }, (_, i) => {
    const base = flat[i % flat.length];
    const cycle = Math.floor(i / flat.length);
    const suffix = cycle > 0 ? ` ${cycle + 1}` : '';
    return {
      id: `product-seed-${String(i + 1).padStart(3, '0')}`,
      sku: `${base.prefix}-${String((i % 60) + 1).padStart(3, '0')}`,
      name: `${base.name}${suffix}`, category: base.category,
      price: Math.round((4 + rnd() * 60) * 100) / 100, stock: int(0, 300),
    };
  });
}

function buildAppointments(n, clients) {
  const times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00'];
  const shuffled = [...clients].sort(() => rnd() - 0.5);
  const todayCount = Math.min(n, Math.max(6, Math.round(n * 0.6)));
  return Array.from({ length: n }, (_, i) => {
    const client = shuffled[i % shuffled.length];
    const isToday = i < todayCount;
    const dayOffset = isToday ? 0 : pick([1, 1, 2, -1]);
    return {
      id: `visit-seed-${String(i + 1).padStart(3, '0')}`,
      clientId: client.id, clientName: client.name,
      date: isoDay(dayOffset), time: times[i % times.length],
      address: `${client.address} · ${client.city}, ${client.state}`,
      status: dayOffset < 0 ? 'Concluída' : 'Agendada',
    };
  });
}

function buildOrders(n, clients, products, appointments) {
  const scheduledIds = appointments.filter((a) => a.date === isoDay(0)).map((a) => a.clientId);
  const statuses = ['Pendente', 'Pendente', 'Em separação', 'Enviado', 'Entregue', 'Entregue'];
  return Array.from({ length: n }, (_, i) => {
    const client = rnd() < 0.7 && scheduledIds.length
      ? clients.find((c) => c.id === pick(scheduledIds)) ?? pick(clients)
      : pick(clients);
    const seller = rnd() < 0.5 ? SELLERS[0] : SELLERS[1];
    const items = Array.from({ length: int(1, 4) }, () => {
      const p = pick(products);
      const table = PRICE_TABLES.find((t) => t.id === client.priceTableId) ?? PRICE_TABLES[0];
      const unitPrice = Math.round(p.price * (1 - table.discountPercent / 100) * 100) / 100;
      return {
        productId: p.id, productName: p.name,
        quantity: int(1, 48), unitPrice,
        neededDate: isoDay(int(1, 7)), discount: rnd() < 0.2 ? pick([5, 10, 15]) : 0,
      };
    });
    const dayOffset = -int(0, 30);
    const created = new Date();
    created.setDate(created.getDate() + dayOffset);
    created.setHours(int(8, 18), int(0, 59), 0, 0);
    const total = Math.round(items.reduce((s, it) => s + it.unitPrice * it.quantity * (1 - it.discount / 100), 0) * 100) / 100;
    return {
      id: `PED-SEED-${String(i + 1).padStart(4, '0')}`,
      clientId: client.id, clientName: client.name,
      sellerId: seller.id, sellerName: seller.nome,
      priceTableId: client.priceTableId, paymentConditionId: client.paymentConditionId,
      createdAt: created.toISOString(), items,
      status: pick(statuses), total, synced: true,
    };
  });
}

async function commitChunks(db, name, list) {
  for (let i = 0; i < list.length; i += 400) {
    const chunk = list.slice(i, i + 400);
    const b = writeBatch(db);
    for (const item of chunk) {
      const { docId, ...body } = item;
      b.set(doc(db, name, docId), body);
    }
    await b.commit();
  }
  console.log(`  gravado: ${name} (${list.length} docs)`);
}

async function wipe(db, names) {
  for (const name of names) {
    const snap = await getDocs(collection(db, name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db);
      for (const d of snap.docs.slice(i, i + 400)) b.delete(d.ref);
      await b.commit();
    }
    console.log(`  limpo: ${name} (${snap.size} docs)`);
  }
}

const main = async () => {
  console.log(`Seed Firestore → app-explorar ${OPTS.dryRun ? '(dry-run)' : ''}`);
  console.log(`  sellers=2 · clients=${OPTS.clients} · products=${OPTS.products} · orders=${OPTS.orders} · appointments=${OPTS.appointments}`);
  const clients = buildClients(OPTS.clients);
  const products = buildProducts(OPTS.products);
  const appointments = buildAppointments(OPTS.appointments, clients);
  const orders = buildOrders(OPTS.orders, clients, products, appointments);

  if (OPTS.dryRun) {
    console.log(`  [dry-run] exemplo pedido: sellerId=${orders[0].sellerId} client=${orders[0].clientName} total=${orders[0].total} itens=${orders[0].items.length}`);
    console.log('  [dry-run] nada gravado. Rode sem --dry-run para gravar.');
    return;
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  if (OPTS.clean) await wipe(db, ['sellers', 'clients', 'products', 'priceTables', 'paymentConditions', 'appointments', 'orders']);

  let b = writeBatch(db);
  for (const s of SELLERS) b.set(doc(db, 'sellers', s.id), { login: s.login, senha: s.senha, empresa: s.empresa, nome: s.nome });
  await b.commit();
  console.log('  gravado: sellers (2 docs: seller-1/seller-2)');

  b = writeBatch(db);
  for (const t of PRICE_TABLES) b.set(doc(db, 'priceTables', t.id), { code: t.code, name: t.name, discountPercent: t.discountPercent });
  for (const p of PAYMENTS) b.set(doc(db, 'paymentConditions', p.id), { code: p.code, name: p.name, days: p.days });
  await b.commit();
  console.log(`  gravado: priceTables (${PRICE_TABLES.length}) + paymentConditions (${PAYMENTS.length})`);

  const noId = (list) => list.map(({ id, ...rest }) => ({ docId: id, ...rest }));
  await commitChunks(db, 'clients', noId(clients));
  await commitChunks(db, 'products', noId(products));
  await commitChunks(db, 'appointments', noId(appointments));
  await commitChunks(db, 'orders', noId(orders));

  console.log('\nOK! Teste: login rodrigo/123456 → Sincronização → download "Últimos pedidos" (só seller-1).');
};

main().catch((e) => { console.error('Falha no seed:', e?.message ?? e); process.exit(1); });
