const APP_NAME = 'Kedai Riski - Kasir PRO';
const DB_NAME = 'kasir_riski_pro';
const DB_VER = 1;
const STORE_PRODUCTS = 'products';
const STORE_SALES = 'sales';
const STORE_BACKUPS = 'backups';
const STORE_SETTINGS = 'settings';
const STORE_USERS = 'users';
const AUTO_BACKUP_SETTING_KEY = 'autoBackupEnabled';
const AUTO_BACKUP_INTERVAL_KEY = 'autoBackupIntervalMin';
const CURRENCY = 'Rp ';
const DEFAULT_ADMIN = { id: 'admin-default', username: 'admin', pin: '1234' };

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SALES)) {
        db.createObjectStore(STORE_SALES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
        db.createObjectStore(STORE_BACKUPS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(storeName, mode='readonly', action) {
  return openDB().then(db => new Promise((res, rej) => {
    const t = db.transaction([storeName], mode);
    const store = t.objectStore(storeName);
    try {
      action(store, res, rej);
    } catch (err) {
      rej(err);
    }
    t.oncomplete = () => db.close();
    t.onerror = (e) => rej(e);
  }));
}
function getAll(storeName) {
  return tx(storeName, 'readonly', (s, res) => {
    const r = s.getAll();
    r.onsuccess = () => res(r.result);
  });
}
function getById(storeName, id) {
  return tx(storeName, 'readonly', (s, res) => {
    const r = s.get(id);
    r.onsuccess = () => res(r.result);
  });
}
function putItem(storeName, item) {
  return tx(storeName, 'readwrite', (s, res) => {
    const r = s.put(item);
    r.onsuccess = () => res(r.result);
  });
}
function deleteItem(storeName, id) {
  return tx(storeName, 'readwrite', (s, res) => {
    const r = s.delete(id);
    r.onsuccess = () => res(true);
  });
}

function genId(prefix='id') {
  return `${prefix}-${Math.random().toString(36).slice(2,9)}`;
}
function fmtCurr(n) {
  if (n == null) return CURRENCY + '0';
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return CURRENCY + s;
}
function dateKey(d=new Date()) {
  return d.toISOString().slice(0,10);
}
function dateTimeStr(ts=Date.now()) {
  return new Date(ts).toLocaleString();
}
function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, (m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[m]));
}
function toCSV(rows) {
  return rows.map(r => r.map(cell => {
    if (cell == null) return '';
    const s = String(cell).replace(/"/g,'""');
    return `"${s}"`;
  }).join(',')).join('\n');
}
function downloadBlob(content, name, mime='application/octet-stream') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

const STATE = {
  products: [],
  sales: [],
  backups: [],
  settings: {},
  currentUser: null,
  cart: [],
  autoBackupTimer: null
};

const SEED_PRODUCTS = [
  { id: genId('p'), kategori:'Mie SS', nama:'mie ss manis', harga:12000, stok: 30, notes: 'level 0-15' },
  { id: genId('p'), kategori:'Mie SS', nama:'mie ss gurih', harga:12000, stok: 30, notes: 'level 0-15' },
  { id: genId('p'), kategori:'Mie SS', nama:'pangsit goreng', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'siomay goreng', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'siomay kukus', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'udang keju', harga:11000, stok: 20 },
  { id: genId('p'), kategori:'Mie SS', nama:'udang rambutan', harga:11000, stok: 20 },
  { id: genId('p'), kategori:'Mie SS', nama:'dimsum', harga:11000, stok: 20 },
  ...[
    "Taro Milk","Strawberry Milk","Red Velvet","Regal Milk","Oreo Milk","Blueberry Milk",
    "Cappuccino Milk","Avocado Milk","Hazelnut Milk","Choco Milk","Matcha Milk",
    "Tiramisu Milk","Coffee Milk","Ovaltine Milk",
    "Orange Squash","Melon Squash","Manggo Squash","Lychee Squash",
    "Lemon Tea","Apple Tea","Original Tea"
  ].map(name => ({ id: genId('p'), kategori:'Minuman', nama: name, harga:5000, stok: 80 })),
  { id: genId('p'), kategori:'Camilan', nama:'tahu walik', harga:6000, stok: 40 },
  { id: genId('p'), kategori:'Camilan', nama:'cheese roll', harga:5000, stok: 40 },
  { id: genId('p'), kategori:'Camilan', nama:'corndog Mozarella jumbo', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'corndog sosis jumbo', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'corndog sosis Mozarella', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'corndog Mozarella mini', harga:3000, stok: 60 },
  { id: genId('p'), kategori:'Camilan', nama:'corndog sosis mini', harga:3000, stok: 60 }
];

document.addEventListener('DOMContentLoaded', async () => {
  await ensureSeed();
  await loadAll();
  bindUI();
  renderAll();
  initAutoBackupFromSettings();
  if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
});

async function ensureSeed() {
  const users = await getAll(STORE_USERS);
  if(!users || users.length === 0) {
    await putItem(STORE_USERS, DEFAULT_ADMIN);
  }
  const prods = await getAll(STORE_PRODUCTS);
  if(!prods || prods.length === 0) {
    for(const p of SEED_PRODUCTS) {
      await putItem(STORE_PRODUCTS, p);
    }
  }
}

async function loadAll() {
  STATE.products = await getAll(STORE_PRODUCTS) || [];
  STATE.sales = await getAll(STORE_SALES) || [];
  STATE.backups = await getAll(STORE_BACKUPS) || [];
  const settings = await getAll(STORE_SETTINGS) || [];
  STATE.settings = settings.reduce((acc, s)=> { acc[s.key] = s.value; return acc; }, {});
  STATE.currentUser = null;
}

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function bindUI() {
  $all('.sidebar button').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const page = btn.getAttribute('data-page');
      navigateTo(page);
    });
  });
  $('#searchMenu')?.addEventListener('input', (e) => {
    renderMenuList(e.target.value.trim());
  });
  $('#addProduct')?.addEventListener('click', openAddProductModal);
  $('#payButton')?.addEventListener('click', onCheckout);
  $('#backupCSV')?.addEventListener('click', exportCSVBackup);
  $('#backupJSON')?.addEventListener('click', exportJSONBackup);
  $('#restoreButton')?.addEventListener('click', ()=> {
    const f = $('#restoreFile');
    if (f && f.files && f.files[0]) {
      importFile(f.files[0]);
    } else alert('Pilih file JSON backup untuk restore');
  });
  document.addEventListener('keydown', (e)=>{
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
      startTerminalMode();
    }
  });
}

function navigateTo(pageId) {
  $all('.page').forEach(p => p.classList.remove('active'));
  const el = $(`#${pageId}`);
  if(el) el.classList.add('active');
  if(pageId === 'dashboard') renderDashboard();
  if(pageId === 'kasir') { renderMenuList(); renderCart(); }
  if(pageId === 'admin') renderAdminList();
  if(pageId === 'backup') renderBackupList();
}

function renderAll() {
  renderDashboard();
  renderMenuList();
  renderAdminList();
  renderCart();
  renderBackupList();
}

function renderDashboard() {
  const totalToday = calcTotalForDate(new Date());
  const countToday = calcCountForDate(new Date());
  $('#dashTotal').textContent = fmtCurr(totalToday);
  $('#dashCount').textContent = `${countToday} transaksi`;
  renderMiniChart();
}

function calcTotalForDate(d) {
  const dayKey = dateKey(d);
  const sales = STATE.sales.filter(s => dateKey(new Date(s.created)) === dayKey);
  return sales.reduce((a,b) => a + (b.total||0), 0);
}
function calcCountForDate(d) {
  const dayKey = dateKey(d);
  return STATE.sales.filter(s => dateKey(new Date(s.created)) === dayKey).length;
}
function getLastNDaysTotals(n=7) {
  const results = [];
  for(let i=n-1;i>=0;i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const total = STATE.sales.filter(s => dateKey(new Date(s.created)) === key).reduce((a,b)=>a+(b.total||0),0);
    results.push({ date: key, total });
  }
  return results;
}
function renderMiniChart() {
  let card = document.querySelector('#dashboard .card.canvas');
  if(!card) {
    card = document.createElement('div');
    card.className = 'card canvas';
    card.innerHTML = `<h3>Omzet 7 Hari</h3><canvas id="chart7" width="700" height="140"></canvas>`;
    const dash = $('#dashboard');
    dash.appendChild(card);
  }
  const data = getLastNDaysTotals(7);
  const canvas = document.getElementById('chart7');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width, canvas.height);
  const max = Math.max(1, ...data.map(d=>d.total));
  const w = canvas.width / data.length;
  data.forEach((d,i)=>{
    const h = (d.total / max) * (canvas.height - 20);
    const x = i * w + 10;
    const y = canvas.height - h - 20;
    ctx.fillStyle = '#4a6cf7';
    ctx.fillRect(x, y, w - 20, h);
    ctx.fillStyle = '#333';
    ctx.font = '12px system-ui';
    ctx.fillText(d.date.slice(5), x, canvas.height - 4);
  });
}

function renderMenuList(filter='') {
  const target = $('#menuList');
  if(!target) return;
  target.innerHTML = '';
  const normalized = (filter||'').toLowerCase();
  const prods = STATE.products.filter(p => (p.nama||'').toLowerCase().includes(normalized) || (p.kategori||'').toLowerCase().includes(normalized));
  prods.sort((a,b)=> (a.kategori||'').localeCompare(b.kategori||'') || (a.nama||'').localeCompare(b.nama||''));
  for(const p of prods) {
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${escapeHtml(p.nama)}</div>
          <div style="font-size:12px;color:#666">${escapeHtml(p.kategori)} • ${fmtCurr(p.harga)}</div>
        </div>
        <div style="text-align:right">
          <div style="margin-bottom:8px;color:${(p.stok||0)<=0 ? '#d9534f' : '#333'}">Stok: ${p.stok||0}</div>
          <div>
            <button class="btn-add" data-id="${p.id}">Tambah</button>
            <button class="btn-restock" data-id="${p.id}">Restock</button>
          </div>
        </div>
      </div>
    `;
    target.appendChild(card);
  }
  $all('.btn-add').forEach(b => b.addEventListener('click', (ev)=> {
    const id = b.getAttribute('data-id');
    quickAddToCart(id);
  }));
  $all('.btn-restock').forEach(b => b.addEventListener('click', (ev)=> {
    const id = b.getAttribute('data-id');
    openRestockModal(id);
  }));
}

async function quickAddToCart(productId) {
  const prod = await getById(STORE_PRODUCTS, productId);
  if(!prod) return alert('Produk tidak ditemukan');
  if((prod.stok||0) <= 0) return alert('Stok kosong');
  const existing = STATE.cart.find(c => c.id === prod.id);
  if(existing) {
    if(existing.qty + 1 > prod.stok) return alert('Stok tidak cukup');
    existing.qty++;
  } else {
    STATE.cart.push({ id: prod.id, nama: prod.nama, harga: prod.harga, qty: 1 });
  }
  renderCart();
}

function renderCart() {
  const el = $('#cartList');
  if(!el) return;
  el.innerHTML = '';
  STATE.cart.forEach(item => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(item.nama)}</div>
        <div style="font-size:12px;color:#666">${fmtCurr(item.harga)} • subtotal: ${fmtCurr(item.harga * item.qty)}</div>
      </div>
      <div>
        <button class="cart-dec" data-id="${item.id}">-</button>
        <span style="margin:0 8px">${item.qty}</span>
        <button class="cart-inc" data-id="${item.id}">+</button>
        <button class="cart-remove" data-id="${item.id}">🗑</button>
      </div>
    `;
    el.appendChild(row);
  });
  $all('.cart-inc').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    await changeCartQty(id, 1);
  }));
  $all('.cart-dec').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    await changeCartQty(id, -1);
  }));
  $all('.cart-remove').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    STATE.cart = STATE.cart.filter(c => c.id !== id);
    renderCart();
  }));
}

async function changeCartQty(productId, delta) {
  const idx = STATE.cart.findIndex(c => c.id === productId);
  if(idx === -1) return;
  const prod = await getById(STORE_PRODUCTS, productId);
  if(!prod) return alert('Produk tidak ditemukan');
  STATE.cart[idx].qty += delta;
  if(STATE.cart[idx].qty <= 0) STATE.cart.splice(idx,1);
  else if(STATE.cart[idx].qty > prod.stok) {
    alert('Tidak cukup stok');
    STATE.cart[idx].qty = prod.stok;
  }
  renderCart();
}

async function onCheckout() {
  if(STATE.cart.length === 0) return alert('Keranjang kosong');
  for(const item of STATE.cart) {
    const prod = await getById(STORE_PRODUCTS, item.id);
    if(!prod || (prod.stok || 0) < item.qty) {
      return alert(`Stok tidak cukup untuk ${item.nama}`);
    }
  }
  const total = STATE.cart.reduce((a,b) => a + b.harga * b.qty, 0);
  const paidStr = prompt(`Total ${fmtCurr(total)}\nMasukkan jumlah bayar (angka):`, String(total));
  if(paidStr === null) return;
  const paid = parseInt(paidStr.replace(/[^0-9]/g,'')) || 0;
  if(paid < total) return alert('Pembayaran kurang');
  const change = paid - total;
  const sale = {
    id: genId('s'),
    created: Date.now(),
    items: STATE.cart.map(c=>({ id:c.id, nama:c.nama, harga:c.harga, qty:c.qty })),
    total,
    paid,
    change
  };
  for(const it of sale.items) {
    const prod = await getById(STORE_PRODUCTS, it.id);
    prod.stok = (prod.stok || 0) - it.qty;
    await putItem(STORE_PRODUCTS, prod);
  }
  await putItem(STORE_SALES, sale);
  STATE.cart = [];
  await loadAll();
  renderAll();
  openPrintStruk(sale);
  alert(`Transaksi sukses. Kembalian: ${fmtCurr(change)}`);
}

async function renderAdminList() {
  const el = $('#adminList');
  if(!el) return;
  el.innerHTML = '';
  if(!STATE.currentUser) {
    const loginCard = document.createElement('div');
    loginCard.className = 'card';
    loginCard.innerHTML = `
      <h3>Login Admin</h3>
      <div>
        <input id="adminUser" placeholder="username" />
        <input id="adminPin" placeholder="PIN" type="password" />
        <button id="btnAdminLogin">Login</button>
      </div>
      <small>Default admin PIN: 1234 (ubah setelah login)</small>
    `;
    el.appendChild(loginCard);
    $('#btnAdminLogin')?.addEventListener('click', async ()=> {
      const usern = $('#adminUser').value.trim();
      const pin = $('#adminPin').value.trim();
      if(!usern || !pin) return alert('Masukkan username & PIN');
      const users = await getAll(STORE_USERS);
      const found = users.find(u => u.username === usern && u.pin === pin);
      if(found) {
        STATE.currentUser = found;
        renderAdminList();
      } else {
        alert('Username / PIN salah');
      }
    });
    return;
  }

  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <h3>Admin: ${escapeHtml(STATE.currentUser.username)}</h3>
        <small>Kelola produk, backup, pengaturan.</small>
      </div>
      <div>
        <button id="btnLogout">Logout</button>
        <button id="btnChangePin">Ganti PIN</button>
      </div>
    </div>
  `;
  el.appendChild(header);
  $('#btnLogout')?.addEventListener('click', ()=> { STATE.currentUser = null; renderAdminList(); });

  $('#btnChangePin')?.addEventListener('click', async ()=> {
    const newPin = prompt('Masukkan PIN baru (angka):');
    if(!newPin) return;
    const u = STATE.currentUser;
    u.pin = newPin;
    await putItem(STORE_USERS, u);
    alert('PIN berhasil diubah');
  });

  const listCard = document.createElement('div');
  listCard.className = 'card';
  listCard.innerHTML = `<h3>Produk</h3>`;
  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';
  list.style.marginTop = '8px';
  STATE.products = await getAll(STORE_PRODUCTS) || [];
  STATE.products.sort((a,b)=> (a.kategori||'').localeCompare(b.kategori||'') || (a.nama||'').localeCompare(b.nama||''));
  for(const p of STATE.products) {
    const node = document.createElement('div');
    node.style.display='flex';
    node.style.justifyContent='space-between';
    node.style.alignItems='center';
    node.style.padding='8px';
    node.style.borderRadius='8px';
    node.style.background='#fff';
    node.innerHTML = `
      <div>
        <div style="font-weight:700">${escapeHtml(p.nama)}</div>
        <div style="font-size:12px;color:#666">${escapeHtml(p.kategori)} • ${fmtCurr(p.harga)} • stok: ${p.stok||0}</div>
      </div>
      <div>
        <button class="btn-edit" data-id="${p.id}">Edit</button>
        <button class="btn-del" data-id="${p.id}">Hapus</button>
      </div>
    `;
    list.appendChild(node);
  }
  listCard.appendChild(list);
  el.appendChild(listCard);

  $all('.btn-edit').forEach(b => b.addEventListener('click', async ()=>{
    const id = b.getAttribute('data-id');
    const prod = await getById(STORE_PRODUCTS, id);
    openEditProductModal(prod);
  }));
  $all('.btn-del').forEach(b => b.addEventListener('click', async ()=>{
    const id = b.getAttribute('data-id');
    if(confirm('Hapus produk ini?')) {
      await deleteItem(STORE_PRODUCTS, id);
      await loadAll();
      renderAdminList();
      renderMenuList();
    }
  }));
}

function openAddProductModal() {
  const name = prompt('Nama produk:');
  if(!name) return;
  const cat = prompt('Kategori (contoh: Mie SS, Minuman, Camilan):','Umum') || 'Umum';
  const price = parseInt(prompt('Harga (angka):','1000').replace(/[^0-9]/g,'')) || 0;
  const stock = parseInt(prompt('Stok awal (angka):','10').replace(/[^0-9]/g,'')) || 0;
  const item = { id: genId('p'), nama: name, kategori: cat, harga: price, stok: stock };
  putItem(STORE_PRODUCTS, item).then(()=>{
    loadAll().then(()=>{ renderAdminList(); renderMenuList(); });
  });
}

function openEditProductModal(prod) {
  const name = prompt('Nama produk:', prod.nama);
  if(name === null) return;
  const cat = prompt('Kategori:', prod.kategori || 'Umum');
  if(cat === null) return;
  const price = parseInt(prompt('Harga (angka):', String(prod.harga)).replace(/[^0-9]/g,'')) || prod.harga;
  const stock = parseInt(prompt('Stok:', String(prod.stok)).replace(/[^0-9]/g,'')) || prod.stok;
  prod.nama = name;
  prod.kategori = cat;
  prod.harga = price;
  prod.stok = stock;
  putItem(STORE_PRODUCTS, prod).then(()=> loadAll().then(()=> { renderAdminList(); renderMenuList(); }) );
}

async function openRestockModal(productId) {
  const p = await getById(STORE_PRODUCTS, productId);
  if(!p) return alert('Produk tidak ditemukan');
  const qty = parseInt(prompt(`Restock untuk ${p.nama}\nMasukkan jumlah:`, '1').replace(/[^0-9]/g,'')) || 0;
  if(qty <= 0) return;
  p.stok = (p.stok || 0) + qty;
  await putItem(STORE_PRODUCTS, p);
  await loadAll();
  renderMenuList();
  renderAdminList();
}

async function exportJSONBackup() {
  const snapshot = await snapshotAll();
  const name = `backup-kedai-riski-${dateTimeStr(Date.now()).replace(/[: ]/g,'-')}.json`;
  const entry = { id: genId('b'), name, created: Date.now(), data: snapshot };
  await putItem(STORE_BACKUPS, entry);
  try {
    downloadBlob(JSON.stringify(snapshot, null, 2), name, 'application/json');
  } catch(e){}
  await loadAll();
  renderBackupList();
  alert('Backup JSON dibuat dan disimpan lokal.');
}

async function exportCSVBackup() {
  const prods = await getAll(STORE_PRODUCTS);
  const rows = [['kategori','nama','harga','stok']];
  prods.forEach(p => rows.push([p.kategori, p.nama, p.harga, p.stok]));
  const csv = toCSV(rows);
  const name = `products-${dateKey()}-${genId('csv')}.csv`;
  downloadBlob(csv, name, 'text/csv');
  alert('Export CSV (produk) siap diunduh.');
}

async function snapshotAll() {
  const products = await getAll(STORE_PRODUCTS) || [];
  const sales = await getAll(STORE_SALES) || [];
  return { created: Date.now(), products, sales };
}

async function renderBackupList() {
  const container = $('#backup');
  if(!container) return;
  let listWrap = container.querySelector('.backup-list');
  if(!listWrap) {
    listWrap = document.createElement('div');
    listWrap.className = 'backup-list card';
    container.appendChild(listWrap);
  }
  const backups = await getAll(STORE_BACKUPS) || [];
  listWrap.innerHTML = '<h3>Backup Lokal</h3>';
  if(backups.length === 0) listWrap.innerHTML += '<div>Tidak ada backup</div>';
  backups.sort((a,b)=>b.created - a.created);
  for(const b of backups) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.marginTop = '8px';
    row.innerHTML = `<div><strong>${escapeHtml(b.name)}</strong><br/><small>${dateTimeStr(b.created)}</small></div>
      <div>
        <button class="btn-download" data-id="${b.id}">Download</button>
        <button class="btn-restore" data-id="${b.id}">Restore</button>
        <button class="btn-del-back" data-id="${b.id}">Hapus</button>
      </div>`;
    listWrap.appendChild(row);
  }
  $all('.btn-download').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    const bc = (await getAll(STORE_BACKUPS)).find(x => x.id === id);
    if(!bc) return alert('Backup tidak ditemukan');
    downloadBlob(JSON.stringify(bc.data, null, 2), bc.name, 'application/json');
  }));
  $all('.btn-restore').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    if(!confirm('Restore backup ini? Data produk & transaksi akan diganti.')) return;
    const bc = (await getAll(STORE_BACKUPS)).find(x => x.id === id);
    if(!bc) return alert('Backup tidak ditemukan');
    await restoreFromSnapshot(bc.data);
    alert('Restore selesai.');
    await loadAll(); renderAll();
  }));
  $all('.btn-del-back').forEach(b => b.addEventListener('click', async ()=> {
    const id = b.getAttribute('data-id');
    if(!confirm('Hapus backup ini?')) return;
    await deleteItem(STORE_BACKUPS, id);
    await loadAll();
    renderBackupList();
  }));
}

async function restoreFromSnapshot(snap) {
  const prods = await getAll(STORE_PRODUCTS) || [];
  for(const p of prods) await deleteItem(STORE_PRODUCTS, p.id);
  const sales = await getAll(STORE_SALES) || [];
  for(const s of sales) await deleteItem(STORE_SALES, s.id);
  for(const p of snap.products || []) await putItem(STORE_PRODUCTS, p);
  for(const s of snap.sales || []) await putItem(STORE_SALES, s);
  await loadAll();
  renderAll();
}

async function importFile(file) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if(json.products && json.sales) {
      if(!confirm('File backup terdeteksi. Lanjutkan restore?')) return;
      await restoreFromSnapshot(json);
      alert('Restore berhasil.');
    } else {
      alert('File tidak terdeteksi sebagai backup produk/penjualan.');
    }
  } catch (e) {
    alert('Gagal membaca file (pastikan JSON valid).');
  }
}

async function initAutoBackupFromSettings() {
  const rows = await getAll(STORE_SETTINGS);
  const map = {};
  (rows || []).forEach(r => map[r.key] = r.value);
  const enabled = map[AUTO_BACKUP_SETTING_KEY] ?? false;
  const interval = map[AUTO_BACKUP_INTERVAL_KEY] ?? 60;
  STATE.settings[AUTO_BACKUP_SETTING_KEY] = enabled;
  STATE.settings[AUTO_BACKUP_INTERVAL_KEY] = interval;
  if(enabled) {
    startAutoBackup(interval);
  }
}
let lastAutoBackup = 0;
function startAutoBackup(intervalMinutes=60) {
  stopAutoBackup();
  doAutoBackup();
  STATE.autoBackupTimer = setInterval(doAutoBackup, intervalMinutes*60*1000);
}
function stopAutoBackup() {
  if(STATE.autoBackupTimer) {
    clearInterval(STATE.autoBackupTimer);
    STATE.autoBackupTimer = null;
  }
}
async function doAutoBackup() {
  const now = Date.now();
  if(now - lastAutoBackup < 30*1000) return;
  lastAutoBackup = now;
  const snap = await snapshotAll();
  const name = `autobackup-${dateKey()}-${Date.now()}.json`;
  const entry = { id: genId('b'), name, created: Date.now(), data: snap };
  await putItem(STORE_BACKUPS, entry);
  try {
    downloadBlob(JSON.stringify(snap), name, 'application/json');
  } catch (e) {}
  await loadAll();
  renderBackupList();
}

async function exportSalesCSV(period='all') {
  const sales = await getAll(STORE_SALES) || [];
  let filtered = sales;
  if(period === 'today') {
    const key = dateKey();
    filtered = sales.filter(s => dateKey(new Date(s.created)) === key);
  }
  const rows = [['id','created','items','total','paid','change']];
  filtered.forEach(s => {
    const itemsStr = s.items.map(i=>`${i.nama}x${i.qty}`).join('; ');
    rows.push([s.id, dateTimeStr(s.created), itemsStr, s.total, s.paid, s.change]);
  });
  const csv = toCSV(rows);
  downloadBlob(csv, `sales-${period}-${dateKey()}.csv`, 'text/csv');
}

async function exportProductsExcelLikeCSV() {
  const prods = await getAll(STORE_PRODUCTS);
  const rows = [['kategori','nama','harga','stok']];
  prods.forEach(p => rows.push([p.kategori||'', p.nama||'', p.harga||0, p.stok||0]));
  const csv = toCSV(rows);
  downloadBlob(csv, `products-${dateKey()}.csv`, 'text/csv');
}

function openPrintStruk(sale) {
  const html = buildStrukHtml(sale);
  const w = window.open('', '_blank', 'width=300,height=600');
  w.document.write(html);
  w.document.close();
  setTimeout(()=> {
    w.focus();
    w.print();
  }, 400);
}

function buildStrukHtml(sale) {
  const storeName = APP_NAME;
  const itemsHtml = sale.items.map(i => `<tr><td style="padding:4px">${escapeHtml(i.nama)}</td><td style="padding:4px;text-align:center">${i.qty}</td><td style="padding:4px;text-align:right">${fmtCurr(i.harga * i.qty)}</td></tr>`).join('');
  return `<!doctype html>
  <html><head><meta charset="utf-8">
  <title>Struk ${escapeHtml(sale.id)}</title>
  <style>
    body{font-family:monospace;padding:6px;color:#000}
    .receipt{width:58mm;max-width:320px}
    h2{text-align:center;margin:0;font-size:16px}
    .meta{font-size:12px;text-align:center;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}
    td{font-size:12px}
    .total{font-weight:700;margin-top:10px}
    .foot{text-align:center;font-size:12px;margin-top:8px}
  </style>
  </head><body>
  <div class="receipt">
    <h2>${escapeHtml(storeName)}</h2>
    <div class="meta">${dateTimeStr(sale.created)}</div>
    <table>
      ${itemsHtml}
    </table>
    <div class="total">
      <div style="display:flex;justify-content:space-between"><div>Total</div><div>${fmtCurr(sale.total)}</div></div>
      <div style="display:flex;justify-content:space-between"><div>Bayar</div><div>${fmtCurr(sale.paid)}</div></div>
      <div style="display:flex;justify-content:space-between"><div>Kembali</div><div>${fmtCurr(sale.change)}</div></div>
    </div>
    <div class="foot">Terima kasih - Kedai Riski</div>
  </div>
  </body></html>`;
}

const PrinterBridge = {
  device: null,
  server: null,
  characteristic: null,
  async connectBluetooth() {
    if(!navigator.bluetooth) throw new Error('WebBluetooth tidak tersedia di browser ini');
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    });
    this.device = device;
    this.server = await device.gatt.connect();
    const svc = await this.server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb').catch(()=>null);
    if(!svc) throw new Error('Service printer tidak ditemukan');
    const char = await svc.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb').catch(()=>null);
    if(!char) throw new Error('Characteristic printer tidak ditemukan');
    this.characteristic = char;
    return true;
  },
  async printText(text) {
    if(!this.characteristic) throw new Error('Printer tidak terhubung');
    const encoder = new TextEncoder();
    const buf = encoder.encode(text + '\n');
    const chunkSize = 900;
    for(let i=0;i<buf.length;i+=chunkSize) {
      const chunk = buf.slice(i, i+chunkSize);
      await this.characteristic.writeValue(chunk);
    }
  },
  async disconnect() {
    if(this.server && this.server.connected) this.server.disconnect();
    this.device = null; this.server = null; this.characteristic = null;
  }
};

async function startTerminalMode() {
  let running = true;
  console.clear();
  console.log('--- Terminal Mode (type exit to quit) ---');
  do {
    const cmd = prompt('Terminal Menu:\n1=view products\n2=beli (format: id,jumlah)\n3=restock (id,jumlah)\n4=view sales\n0=exit\nPilihan:');
    if(cmd === null) { running = false; break; }
    const c = cmd.trim();
    switch(c) {
      case '1':
        {
          const prods = await getAll(STORE_PRODUCTS);
          console.log('Products:', prods.map(p => `${p.id} | ${p.nama} | stok:${p.stok}`));
          alert('Products printed to console');
        }
        break;
      case '2':
        {
          const input = prompt('Masukkan "id,jumlah" untuk beli:');
          if(!input) break;
          const [id, qtyStr] = input.split(',').map(s=>s&&s.trim());
          const qty = parseInt(qtyStr) || 0;
          const prod = await getById(STORE_PRODUCTS, id);
          if(!prod) { alert('ID tidak ditemukan'); break; }
          if(prod.stok < qty) { alert('Stok tidak cukup'); break; }
          prod.stok -= qty;
          await putItem(STORE_PRODUCTS, prod);
          const sale = { id: genId('s'), created: Date.now(), items: [{ id: prod.id, nama: prod.nama, harga: prod.harga, qty }], total: prod.harga * qty, paid: prod.harga * qty, change: 0 };
          await putItem(STORE_SALES, sale);
          await loadAll();
          alert('Transaksi sukses (terminal)');
        }
        break;
      case '3':
        {
          const input = prompt('Masukkan "id,jumlah" untuk restock:');
          if(!input) break;
          const [id, qtyStr] = input.split(',').map(s=>s&&s.trim());
          const qty = parseInt(qtyStr) || 0;
          const prod = await getById(STORE_PRODUCTS, id);
          if(!prod) { alert('ID tidak ditemukan'); break; }
          prod.stok = (prod.stok || 0) + qty;
          await putItem(STORE_PRODUCTS, prod);
          await loadAll();
          alert('Restock selesai');
        }
        break;
      case '4':
        {
          const sales = await getAll(STORE_SALES);
          console.log('Sales:', sales);
          alert('Sales printed to console');
        }
        break;
      case '0':
      case 'exit':
        running = false;
        break;
      default:
        alert('Pilihan tidak valid');
    }
  } while(running);
  await loadAll();
  renderAll();
}

async function renderAdminListCompact() {}

function renderBackupList() {}

async function loadAllMinimal() {
  STATE.products = await getAll(STORE_PRODUCTS) || [];
  STATE.sales = await getAll(STORE_SALES) || [];
}
async function loadAllFull() { await loadAll(); }

async function renderAdminAfterChange() {
  await loadAll();
  renderAll();
}

window.exportSalesCSV = exportSalesCSV;
window.exportProductsCSV = exportProductsExcelLikeCSV;
window.startTerminalMode = startTerminalMode;
window.connectPrinterBluetooth = PrinterBridge.connectBluetooth.bind(PrinterBridge);

async function refreshAndRender() {
  await loadAll();
  renderAll();
}

window.refreshAndRender = refreshAndRender;

(function bootstrapNavDefault() {
  const pages = ['dashboard','kasir','admin','backup'];
  const first = pages.find(p => document.getElementById(p)) || 'kasir';
  navigateTo(first);
})();
