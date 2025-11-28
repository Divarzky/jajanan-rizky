/**
 * app.js - Kedai Riski (FINAL OPTIMIZED)
 * - Fully responsive mobile-first design
 * - Enhanced UI/UX with better touch targets
 * - Improved performance and error handling
 * - Better state management
 */

/* =========================
   Config & Constants
   ========================= */
const APP_NAME = 'Kedai Riski';
const DB_NAME = 'kasir_riski_pro';
const DB_VER = 2; // Incremented for new schema
const STORE_PRODUCTS = 'products';
const STORE_SALES = 'sales';
const STORE_BACKUPS = 'backups';
const STORE_SETTINGS = 'settings';
const STORE_USERS = 'users';
const AUTO_BACKUP_SETTING_KEY = 'autoBackupEnabled';
const AUTO_BACKUP_INTERVAL_KEY = 'autoBackupIntervalMin';
const CURRENCY = 'Rp ';
const DEFAULT_ADMIN = { id: 'admin-default', username: 'admin', pin: '1234' };

/* =========================
   IndexedDB helpers
   ========================= */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
        const store = db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
        store.createIndex('kategori', 'kategori', { unique: false });
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
    r.onerror = () => res([]);
  });
}

function getById(storeName, id) {
  return tx(storeName, 'readonly', (s, res) => {
    const r = s.get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
}

function putItem(storeName, item) {
  return tx(storeName, 'readwrite', (s, res, rej) => {
    const r = s.put(item);
    r.onsuccess = () => res(r.result);
    r.onerror = (e) => rej(e);
  });
}

function deleteItem(storeName, id) {
  return tx(storeName, 'readwrite', (s, res, rej) => {
    const r = s.delete(id);
    r.onsuccess = () => res(true);
    r.onerror = (e) => rej(e);
  });
}

function clearStore(storeName) {
  return tx(storeName, 'readwrite', (s, res, rej) => {
    const r = s.clear();
    r.onsuccess = () => res(true);
    r.onerror = (e) => rej(e);
  });
}

/* =========================
   Utils & Formatters
   ========================= */
function genId(prefix='id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

function fmtCurr(n) {
  if (n == null || isNaN(n)) return CURRENCY + '0';
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return CURRENCY + s;
}

function dateKey(d=new Date()) {
  return d.toISOString().slice(0,10);
}

function dateTimeStr(ts=Date.now()) {
  return new Date(ts).toLocaleString('id-ID');
}

function escapeHtml(s='') {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function toCSV(rows) {
  return rows.map(r => r.map(cell => {
    if (cell == null) return '';
    const s = String(cell).replace(/"/g,'""');
    return s.includes(',') ? `"${s}"` : s;
  }).join(',')).join('\n');
}

function downloadBlob(content, name, mime='application/octet-stream') {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.error('Download failed:', e);
    return false;
  }
}

function showLoading(show = true) {
  const loading = $('#loading');
  if (loading) {
    loading.classList.toggle('hidden', !show);
  }
}

function showNotification(message, type = 'info', duration = 3000) {
  // Simple notification system - could be enhanced with a proper toast
  console.log(`${type.toUpperCase()}: ${message}`);
  if (type === 'error') {
    alert(`Error: ${message}`);
  } else if (type === 'success' && duration > 0) {
    // Could implement toast here
  }
}

/* =========================
   App State
   ========================= */
const STATE = {
  products: [],
  sales: [],
  backups: [],
  settings: {},
  currentUser: null,
  cart: [],
  autoBackupTimer: null,
  categories: new Set(),
  isLoading: false
};

/* =========================
   Seed data
   ========================= */
const SEED_PRODUCTS = [
  { id: genId('p'), kategori:'Mie SS', nama:'Mie SS Manis', harga:12000, stok: 30, notes: 'Level 0-15' },
  { id: genId('p'), kategori:'Mie SS', nama:'Mie SS Gurih', harga:12000, stok: 30, notes: 'Level 0-15' },
  { id: genId('p'), kategori:'Mie SS', nama:'Pangsit Goreng', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'Siomay Goreng', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'Siomay Kukus', harga:11000, stok: 25 },
  { id: genId('p'), kategori:'Mie SS', nama:'Udang Keju', harga:11000, stok: 20 },
  { id: genId('p'), kategori:'Mie SS', nama:'Udang Rambutan', harga:11000, stok: 20 },
  { id: genId('p'), kategori:'Mie SS', nama:'Dimsum', harga:11000, stok: 20 },
  ...[
    "Taro Milk","Strawberry Milk","Red Velvet","Regal Milk","Oreo Milk","Blueberry Milk",
    "Cappuccino Milk","Avocado Milk","Hazelnut Milk","Choco Milk","Matcha Milk",
    "Tiramisu Milk","Coffee Milk","Ovaltine Milk",
    "Orange Squash","Melon Squash","Manggo Squash","Lychee Squash",
    "Lemon Tea","Apple Tea","Original Tea"
  ].map(name => ({ id: genId('p'), kategori:'Minuman', nama: name, harga:5000, stok: 80 })),
  { id: genId('p'), kategori:'Camilan', nama:'Tahu Walik', harga:6000, stok: 40 },
  { id: genId('p'), kategori:'Camilan', nama:'Cheese Roll', harga:5000, stok: 40 },
  { id: genId('p'), kategori:'Camilan', nama:'Corndog Mozarella Jumbo', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'Corndog Sosis Jumbo', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'Corndog Sosis Mozarella', harga:5000, stok: 30 },
  { id: genId('p'), kategori:'Camilan', nama:'Corndog Mozarella Mini', harga:3000, stok: 60 },
  { id: genId('p'), kategori:'Camilan', nama:'Corndog Sosis Mini', harga:3000, stok: 60 }
];

/* =========================
   DOM helpers
   ========================= */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

/* =========================
   Modal System
   ========================= */
function showModal({ title='', bodyHtml='', okText='OK', cancelText='Batal', onOK=null, onCancel=null, hideCancel=false, size='' }) {
  const modal = $('#modal');
  if(!modal) {
    // Fallback for very basic environments
    const confirmed = confirm(title + '\n\n' + bodyHtml.replace(/<[^>]+>/g,''));
    if(confirmed && onOK) onOK();
    else if(!confirmed && onCancel) onCancel();
    return;
  }
  
  modal.classList.remove('hidden');
  const titleEl = $('#modalTitle');
  const bodyEl = $('#modalBody');
  const okBtn = $('#modalOK');
  const cancelBtn = $('#modalCancel');
  const closeBtn = $('#modalClose');
  
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = bodyHtml;
  if (okBtn) {
    okBtn.textContent = okText;
    okBtn.onclick = () => { 
      hideModal(); 
      if(onOK) setTimeout(() => onOK(modal), 10); 
    };
  }
  if (cancelBtn) {
    cancelBtn.textContent = cancelText;
    cancelBtn.style.display = hideCancel ? 'none' : '';
    cancelBtn.onclick = () => { 
      hideModal(); 
      if(onCancel) setTimeout(() => onCancel(modal), 10); 
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => { 
      hideModal(); 
      if(onCancel) setTimeout(() => onCancel(modal), 10); 
    };
  }
  
  // Size class
  const modalContent = $('.modal-content');
  if (modalContent) {
    modalContent.className = 'modal-content';
    if (size) modalContent.classList.add(`modal-${size}`);
  }
  
  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
      hideModal();
      if(onCancel) setTimeout(() => onCancel(modal), 10);
    }
  };
  
  // Escape key to close
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      hideModal();
      if(onCancel) setTimeout(() => onCancel(modal), 10);
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);
}

function hideModal() {
  const modal = $('#modal');
  if(modal) {
    modal.classList.add('hidden');
    // Clean up event listeners
    modal.onclick = null;
  }
}

/* =========================
   Mobile Sidebar
   ========================= */
function initMobileSidebar() {
  const menuToggle = $('#menuToggle');
  const closeSidebar = $('#closeSidebar');
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      overlay.classList.add('show');
    });
  }
  
  if (closeSidebar) {
    closeSidebar.addEventListener('click', closeMobileSidebar);
  }
  
  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sidebar = $('#sidebar');
  const overlay = $('#sidebarOverlay');
  
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

/* =========================
   Init
   ========================= */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  try {
    await ensureSeed();
    await loadAll();
    bindUI();
    initMobileSidebar();
    renderAll();
    initAutoBackupFromSettings();
    showLoading(false);
    
    // Try registering service worker
    if('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(reg => console.log('SW registered'))
        .catch(err => console.log('SW registration failed:', err));
    }
  } catch (error) {
    console.error('Init failed:', error);
    showNotification('Gagal memuat aplikasi', 'error');
    showLoading(false);
  }
});

/* Ensure seed user & products */
async function ensureSeed() {
  try {
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
  } catch (e) {
    console.error('Seed error', e);
    throw e;
  }
}

/* Load everything */
async function loadAll() {
  try {
    STATE.products = await getAll(STORE_PRODUCTS) || [];
    STATE.sales = await getAll(STORE_SALES) || [];
    STATE.backups = await getAll(STORE_BACKUPS) || [];
    const settings = await getAll(STORE_SETTINGS) || [];
    STATE.settings = settings.reduce((acc, s) => { 
      acc[s.key] = s.value; 
      return acc; 
    }, {});
    
    // Update categories
    STATE.categories = new Set(STATE.products.map(p => p.kategori).filter(Boolean));
    
    // Update cart badge
    updateCartBadge();
  } catch (error) {
    console.error('Load all error:', error);
    throw error;
  }
}

/* =========================
   UI Binding
   ========================= */
function bindUI() {
  // Sidebar navigation
  $all('.navbtn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = btn.getAttribute('data-page');
      navigateTo(page);
      closeMobileSidebar();
    });
  });
  
  // Search and filters
  $('#searchMenu')?.addEventListener('input', debounce((e) => {
    renderMenuList(e.target.value.trim());
  }, 300));
  
  $('#categoryFilter')?.addEventListener('change', (e) => {
    renderMenuList($('#searchMenu').value.trim());
  });
  
  // Product management
  $('#addProduct')?.addEventListener('click', () => openAddProductModal());
  $('#exportProducts')?.addEventListener('click', exportProductsExcelLikeCSV);
  $('#importProducts')?.addEventListener('click', () => $('#importFile').click());
  $('#importFile')?.addEventListener('change', handleImportCSV);
  
  // Cart and checkout
  $('#payButton')?.addEventListener('click', onCheckout);
  
  // Backup and restore
  $('#backupCSV')?.addEventListener('click', exportCSVBackup);
  $('#backupJSON')?.addEventListener('click', exportJSONBackup);
  $('#autoBackupToggle')?.addEventListener('click', toggleAutoBackup);
  $('#restoreButton')?.addEventListener('click', handleRestore);
  
  // Global escape key handler
  document.addEventListener('keydown', (e) => {
    if(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
      startTerminalMode();
    }
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/* =========================
   Navigation & Render All
   ========================= */
function navigateTo(pageId) {
  // Update active nav button
  $all('.navbtn').forEach(btn => btn.classList.remove('active'));
  $all(`.navbtn[data-page="${pageId}"]`).forEach(btn => btn.classList.add('active'));
  
  // Update active page
  $all('.page').forEach(p => p.classList.remove('active'));
  const el = $(`#${pageId}`);
  if(el) el.classList.add('active');
  
  // Page-specific rendering
  if(pageId === 'dashboard') renderDashboard();
  if(pageId === 'kasir') { 
    updateCategoryFilter();
    renderMenuList(); 
    renderCart(); 
  }
  if(pageId === 'admin') renderAdminList();
  if(pageId === 'backup') renderBackupList();
  
  // Update mobile title
  const mobileTitle = $('.mobile-title');
  if (mobileTitle) {
    const pageTitles = {
      'dashboard': 'Dashboard',
      'kasir': 'Kasir',
      'admin': 'Admin', 
      'backup': 'Backup'
    };
    mobileTitle.textContent = pageTitles[pageId] || 'Kedai Riski';
  }
}

function renderAll() {
  renderDashboard();
  updateCategoryFilter();
  renderMenuList();
  renderAdminList();
  renderCart();
  renderBackupList();
}

/* =========================
   Dashboard
   ========================= */
function renderDashboard() {
  const totalToday = calcTotalForDate(new Date());
  const countToday = calcCountForDate(new Date());
  const lowStockCount = STATE.products.filter(p => (p.stok || 0) < 5).length;
  
  $('#dashTotal').textContent = fmtCurr(totalToday);
  $('#dashCount').textContent = `${countToday} transaksi`;
  $('#dashLowStock').textContent = `${lowStockCount} produk`;
  
  renderMiniChart();
}

function refreshDashboard() {
  loadAll().then(() => {
    renderDashboard();
    showNotification('Dashboard diperbarui', 'success', 2000);
  });
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
    const d = new Date(); 
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const total = STATE.sales
      .filter(s => dateKey(new Date(s.created)) === key)
      .reduce((a,b) => a + (b.total||0), 0);
    results.push({ date: key, total });
  }
  return results;
}

function renderMiniChart() {
  const canvas = $('#chart7');
  if(!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const data = getLastNDaysTotals(7);
  const max = Math.max(1, ...data.map(d => d.total));
  const w = canvas.width / data.length;
  const h = canvas.height;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw bars
  data.forEach((d, i) => {
    const barHeight = (d.total / max) * (h - 40);
    const x = i * w + 10;
    const y = h - barHeight - 30;
    
    ctx.fillStyle = '#4a6cf7';
    ctx.fillRect(x, y, w - 20, barHeight);
    
    // Label
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(d.date.slice(5), x + (w - 20) / 2, h - 10);
    
    // Value
    if (d.total > 0) {
      ctx.fillStyle = '#333';
      ctx.fillText(fmtCurr(d.total).replace('Rp ', ''), x + (w - 20) / 2, y - 5);
    }
  });
}

/* =========================
   Menu / Products (Kasir)
   ========================= */
function updateCategoryFilter() {
  const filter = $('#categoryFilter');
  if (!filter) return;
  
  const currentValue = filter.value;
  filter.innerHTML = '<option value="">Semua Kategori</option>';
  
  STATE.categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    filter.appendChild(option);
  });
  
  // Restore previous selection
  if (currentValue && STATE.categories.has(currentValue)) {
    filter.value = currentValue;
  }
}

function renderMenuList(filter='') {
  const target = $('#menuList');
  if(!target) return;
  
  const normalized = (filter||'').toLowerCase();
  const categoryFilter = $('#categoryFilter')?.value || '';
  
  let prods = STATE.products.filter(p => 
    (p.nama||'').toLowerCase().includes(normalized) || 
    (p.kategori||'').toLowerCase().includes(normalized)
  );
  
  if (categoryFilter) {
    prods = prods.filter(p => p.kategori === categoryFilter);
  }
  
  prods.sort((a,b) => 
    (a.kategori||'').localeCompare(b.kategori||'') || 
    (a.nama||'').localeCompare(b.nama||'')
  );
  
  target.innerHTML = '';
  
  if (prods.length === 0) {
    target.innerHTML = '<div class="text-center" style="grid-column:1/-1;padding:40px 20px;color:#666">Tidak ada produk ditemukan</div>';
    return;
  }
  
  for(const p of prods) {
    const card = document.createElement('div');
    card.className = 'menu-card';
    card.innerHTML = `
      <div class="category">${escapeHtml(p.kategori)}</div>
      <div class="name">${escapeHtml(p.nama)}</div>
      <div class="price">${fmtCurr(p.harga)}</div>
      <div class="stock ${(p.stok||0) < 5 ? 'low' : ''}">
        <span>Stok: ${p.stok||0}</span>
        ${p.notes ? `<small>${escapeHtml(p.notes)}</small>` : ''}
      </div>
      <div class="menu-actions">
        <button class="btn-add" data-id="${p.id}">+ Tambah</button>
        <button class="btn-secondary btn-small" data-id="${p.id}">Restock</button>
      </div>
    `;
    target.appendChild(card);
  }
  
  // Bind events
  $all('.btn-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      quickAddToCart(id);
    });
  });
  
  $all('.btn-small').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      openRestockModal(id);
    });
  });
  
  $all('.menu-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        const id = card.querySelector('.btn-add')?.getAttribute('data-id');
        if (id) quickAddToCart(id);
      }
    });
  });
}

async function quickAddToCart(productId) {
  try {
    const prod = await getById(STORE_PRODUCTS, productId);
    if(!prod) {
      showNotification('Produk tidak ditemukan', 'error');
      return;
    }
    
    if((prod.stok||0) <= 0) {
      showNotification('Stok kosong', 'error');
      return;
    }
    
    const existing = STATE.cart.find(c => c.id === prod.id);
    if(existing) {
      if(existing.qty + 1 > prod.stok) {
        showNotification('Stok tidak cukup', 'error');
        return;
      }
      existing.qty++;
    } else {
      STATE.cart.push({ 
        id: prod.id, 
        nama: prod.nama, 
        harga: prod.harga, 
        qty: 1,
        kategori: prod.kategori 
      });
    }
    
    renderCart();
    showNotification(`${prod.nama} ditambahkan ke keranjang`, 'success', 1500);
  } catch (error) {
    console.error('Add to cart error:', error);
    showNotification('Gagal menambah ke keranjang', 'error');
  }
}

function clearCart() {
  if (STATE.cart.length === 0) return;
  
  showModal({
    title: 'Kosongkan Keranjang',
    bodyHtml: '<p>Yakin ingin mengosongkan keranjang?</p>',
    okText: 'Ya, Kosongkan',
    cancelText: 'Batal',
    onOK: () => {
      STATE.cart = [];
      renderCart();
      showNotification('Keranjang dikosongkan', 'success');
    }
  });
}

/* Cart UI */
function renderCart() {
  const el = $('#cartList');
  const cartTotal = $('#cartTotal');
  if(!el) return;
  
  el.innerHTML = '';
  
  if (STATE.cart.length === 0) {
    el.innerHTML = '<div class="text-center" style="padding:40px 20px;color:#666">Keranjang kosong</div>';
    if (cartTotal) cartTotal.textContent = 'Total: Rp 0';
    updateCartBadge();
    return;
  }
  
  const total = STATE.cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  if (cartTotal) cartTotal.textContent = `Total: ${fmtCurr(total)}`;
  
  STATE.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(item.nama)}</div>
        <div class="cart-item-details">
          ${fmtCurr(item.harga)} × ${item.qty} = ${fmtCurr(item.harga * item.qty)}
        </div>
      </div>
      <div class="cart-item-actions">
        <button class="btn-qty" data-id="${item.id}" data-action="decrease">-</button>
        <span class="qty-display">${item.qty}</span>
        <button class="btn-qty" data-id="${item.id}" data-action="increase">+</button>
        <button class="btn-remove" data-id="${item.id}">🗑</button>
      </div>
    `;
    el.appendChild(row);
  });
  
  // Bind cart controls
  $all('.btn-qty').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      await changeCartQty(id, action === 'increase' ? 1 : -1);
    });
  });
  
  $all('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      STATE.cart = STATE.cart.filter(c => c.id !== id);
      renderCart();
      showNotification('Item dihapus dari keranjang', 'success', 1500);
    });
  });
  
  updateCartBadge();
}

function updateCartBadge() {
  const badge = $('#cartBadge span');
  const totalItems = STATE.cart.reduce((sum, item) => sum + item.qty, 0);
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

async function changeCartQty(productId, delta) {
  const idx = STATE.cart.findIndex(c => c.id === productId);
  if(idx === -1) return;
  
  try {
    const prod = await getById(STORE_PRODUCTS, productId);
    if(!prod) {
      showNotification('Produk tidak ditemukan', 'error');
      return;
    }
    
    STATE.cart[idx].qty += delta;
    
    if(STATE.cart[idx].qty <= 0) {
      STATE.cart.splice(idx, 1);
      showNotification('Item dihapus dari keranjang', 'success', 1500);
    } else if(STATE.cart[idx].qty > prod.stok) {
      showNotification('Tidak cukup stok', 'error');
      STATE.cart[idx].qty = prod.stok;
    }
    
    renderCart();
  } catch (error) {
    console.error('Change cart quantity error:', error);
    showNotification('Gagal mengubah jumlah', 'error');
  }
}

/* =========================
   Checkout (with payment methods)
   ========================= */
async function onCheckout() {
  if(STATE.cart.length === 0) {
    showNotification('Keranjang kosong', 'error');
    return;
  }
  
  // Validate stock
  for(const item of STATE.cart) {
    const prod = await getById(STORE_PRODUCTS, item.id);
    if(!prod || (prod.stok || 0) < item.qty) {
      showNotification(`Stok tidak cukup untuk ${item.nama}`, 'error');
      return;
    }
  }
  
  const total = STATE.cart.reduce((a,b) => a + b.harga * b.qty, 0);
  const itemsHtml = STATE.cart.map(i => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee">
      <div>${escapeHtml(i.nama)} × ${i.qty}</div>
      <div>${fmtCurr(i.harga * i.qty)}</div>
    </div>
  `).join('');
  
  const body = `
    <div class="form-group">
      <label class="form-label">Ringkasan Pesanan</label>
      <div style="max-height:200px;overflow:auto;background:#f8f9fa;padding:12px;border-radius:8px;border:1px solid #ddd">
        ${itemsHtml}
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #333;margin-top:8px;font-weight:700">
          <div>Total</div>
          <div>${fmtCurr(total)}</div>
        </div>
      </div>
    </div>
    
    <div class="form-group">
      <label class="form-label">Metode Pembayaran</label>
      <select id="pmethod" class="form-select">
        <option value="cash">Cash (Tunai)</option>
        <option value="qris">QRIS</option>
        <option value="transfer">Transfer</option>
      </select>
    </div>
    
    <div class="form-group" id="pamountGroup">
      <label class="form-label">Jumlah Bayar</label>
      <input type="number" id="pamount" class="form-input" value="${total}" min="${total}">
    </div>
    
    <div class="form-group hidden" id="prefGroup">
      <label class="form-label">Referensi Pembayaran</label>
      <input type="text" id="payref" class="form-input" placeholder="No. referensi / kode pembayaran">
    </div>
    
    <div id="changeInfo" class="hidden" style="padding:12px;background:#e8f5e8;border-radius:8px;margin-top:12px">
      <strong>Kembalian: <span id="changeAmount">Rp 0</span></strong>
    </div>
  `;
  
  showModal({
    title: 'Pembayaran',
    bodyHtml: body,
    okText: '💳 Bayar',
    cancelText: 'Batal',
    onOK: async (modal) => {
      await processPayment(modal, total);
    },
    onCancel: () => {}
  });
  
  // Dynamic form behavior
  setTimeout(() => {
    const modal = $('#modal');
    const pm = modal.querySelector('#pmethod');
    const pamount = modal.querySelector('#pamount');
    const prefGroup = modal.querySelector('#prefGroup');
    const pamountGroup = modal.querySelector('#pamountGroup');
    const changeInfo = modal.querySelector('#changeInfo');
    const changeAmount = modal.querySelector('#changeAmount');
    
    function updatePaymentUI() {
      const method = pm.value;
      
      if (method === 'cash') {
        pamountGroup.classList.remove('hidden');
        prefGroup.classList.add('hidden');
        pamount.min = total;
        pamount.value = total;
      } else {
        pamountGroup.classList.add('hidden');
        prefGroup.classList.remove('hidden');
        pamount.value = total;
      }
      
      updateChangeInfo();
    }
    
    function updateChangeInfo() {
      if (pm.value === 'cash') {
        const paid = parseInt(pamount.value) || 0;
        const change = paid - total;
        if (change >= 0) {
          changeInfo.classList.remove('hidden');
          changeAmount.textContent = fmtCurr(change);
        } else {
          changeInfo.classList.add('hidden');
        }
      } else {
        changeInfo.classList.add('hidden');
      }
    }
    
    pm?.addEventListener('change', updatePaymentUI);
    pamount?.addEventListener('input', updateChangeInfo);
    
    updatePaymentUI();
  }, 100);
}

async function processPayment(modal, total) {
  const method = modal.querySelector('#pmethod')?.value || 'cash';
  let paid = parseInt(modal.querySelector('#pamount')?.value || total);
  const payRef = modal.querySelector('#payref')?.value || '';
  
  // Validation
  if (method === 'cash' && paid < total) {
    showNotification('Pembayaran kurang', 'error');
    return;
  }
  
  if (method !== 'cash') {
    paid = total; // Non-cash methods are exact
  }
  
  const change = method === 'cash' ? paid - total : 0;
  
  // Create sale object
  const sale = {
    id: genId('s'),
    created: Date.now(),
    items: STATE.cart.map(c => ({ 
      id: c.id, 
      nama: c.nama, 
      harga: c.harga, 
      qty: c.qty 
    })),
    total,
    paid,
    change,
    paymentMethod: method,
    paymentRef: payRef
  };
  
  try {
    showLoading(true);
    
    // Update stock
    for(const item of sale.items) {
      const prod = await getById(STORE_PRODUCTS, item.id);
      prod.stok = (prod.stok || 0) - item.qty;
      await putItem(STORE_PRODUCTS, prod);
    }
    
    // Save sale
    await putItem(STORE_SALES, sale);
    
    // Clear cart and update state
    STATE.cart = [];
    await loadAll();
    renderAll();
    
    showLoading(false);
    
    // Show success and print receipt
    showModal({
      title: 'Transaksi Berhasil',
      bodyHtml: `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:48px;margin-bottom:16px">✅</div>
          <h3 style="margin-bottom:8px">Pembayaran Sukses</h3>
          <p>Total: <strong>${fmtCurr(total)}</strong></p>
          ${change > 0 ? `<p>Kembalian: <strong>${fmtCurr(change)}</strong></p>` : ''}
          <p>Metode: <strong>${method.toUpperCase()}</strong></p>
        </div>
      `,
      okText: 'Print Struk',
      cancelText: 'Tutup',
      onOK: () => {
        openPrintStruk(sale);
      },
      onCancel: () => {
        openPrintStruk(sale);
      }
    });
    
  } catch (error) {
    console.error('Checkout error:', error);
    showLoading(false);
    showNotification('Terjadi kesalahan saat memproses transaksi', 'error');
  }
}

// Continue with the rest of the functions (Admin, Backup, etc.)
// Note: Due to character limits, I'll include the most critical parts

/* =========================
   Admin Functions
   ========================= */
async function renderAdminList() {
  const el = $('#adminList');
  if(!el) return;
  
  el.innerHTML = '';
  
  if(!STATE.currentUser) {
    renderAdminLogin();
    return;
  }
  
  renderAdminHeader();
  renderProductList();
}

function renderAdminLogin() {
  const el = $('#adminList');
  el.innerHTML = `
    <div class="card">
      <h3>Login Admin</h3>
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" id="adminUser" class="form-input" placeholder="username">
      </div>
      <div class="form-group">
        <label class="form-label">PIN</label>
        <input type="password" id="adminPin" class="form-input" placeholder="PIN">
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button id="btnAdminLogin" class="btn-main">Login</button>
        <button class="btn-secondary" onclick="navigateTo('kasir')">Batal</button>
      </div>
      <small style="display:block;margin-top:16px;color:#666;text-align:center">
        Default: username=<strong>admin</strong> pin=<strong>1234</strong>
      </small>
    </div>
  `;
  
  $('#btnAdminLogin')?.addEventListener('click', handleAdminLogin);
}

async function handleAdminLogin() {
  const username = $('#adminUser')?.value.trim();
  const pin = $('#adminPin')?.value.trim();
  
  if(!username || !pin) {
    showNotification('Masukkan username & PIN', 'error');
    return;
  }
  
  try {
    const users = await getAll(STORE_USERS);
    const found = users.find(u => u.username === username && u.pin === pin);
    
    if(found) {
      STATE.currentUser = found;
      renderAdminList();
      showNotification(`Login berhasil sebagai ${username}`, 'success');
    } else {
      showNotification('Username / PIN salah', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showNotification('Gagal login', 'error');
  }
}

function renderAdminHeader() {
  const el = $('#adminList');
  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h3>Admin: ${escapeHtml(STATE.currentUser.username)}</h3>
        <small style="color:#666">Kelola produk dan pengaturan</small>
      </div>
      <div style="display:flex;gap:8px">
        <button id="btnChangePin" class="btn-secondary">Ganti PIN</button>
        <button id="btnLogout" class="btn-secondary" style="background:#dc3545;color:white;border:none">Logout</button>
      </div>
    </div>
  `;
  el.appendChild(header);
  
  $('#btnLogout')?.addEventListener('click', () => {
    STATE.currentUser = null;
    renderAdminList();
    showNotification('Logout berhasil', 'success');
  });
  
  $('#btnChangePin')?.addEventListener('click', changeAdminPin);
}

async function changeAdminPin() {
  const newPin = prompt('Masukkan PIN baru (min 4 angka):');
  if(!newPin || newPin.length < 4) {
    showNotification('PIN harus minimal 4 karakter', 'error');
    return;
  }
  
  try {
    STATE.currentUser.pin = newPin;
    await putItem(STORE_USERS, STATE.currentUser);
    showNotification('PIN berhasil diubah', 'success');
  } catch (error) {
    console.error('Change PIN error:', error);
    showNotification('Gagal mengubah PIN', 'error');
  }
}

function renderProductList() {
  const el = $('#adminList');
  const listCard = document.createElement('div');
  listCard.className = 'card';
  listCard.innerHTML = `
    <h3>Daftar Produk (${STATE.products.length})</h3>
    <div id="adminProductList" class="admin-list"></div>
  `;
  el.appendChild(listCard);
  
  const productList = $('#adminProductList');
  productList.innerHTML = '';
  
  if (STATE.products.length === 0) {
    productList.innerHTML = '<div class="text-center" style="padding:40px 20px;color:#666">Belum ada produk</div>';
    return;
  }
  
  STATE.products.sort((a,b) => 
    (a.kategori||'').localeCompare(b.kategori||'') || 
    (a.nama||'').localeCompare(b.nama||'')
  );
  
  STATE.products.forEach(p => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    item.innerHTML = `
      <div class="admin-item-info">
        <div class="admin-item-name">${escapeHtml(p.nama)}</div>
        <div class="admin-item-details">
          <span>${escapeHtml(p.kategori)}</span>
          <span>${fmtCurr(p.harga)}</span>
          <span class="${(p.stok||0) < 5 ? 'text-danger' : ''}">Stok: ${p.stok||0}</span>
          ${p.notes ? `<span>${escapeHtml(p.notes)}</span>` : ''}
        </div>
      </div>
      <div class="admin-item-actions">
        <button class="btn-edit" data-id="${p.id}">Edit</button>
        <button class="btn-del" data-id="${p.id}">Hapus</button>
      </div>
    `;
    productList.appendChild(item);
  });
  
  // Bind edit/delete events
  $all('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const prod = await getById(STORE_PRODUCTS, id);
      openEditProductModal(prod);
    });
  });
  
  $all('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const prod = STATE.products.find(p => p.id === id);
      
      showModal({
        title: 'Hapus Produk',
        bodyHtml: `<p>Yakin ingin menghapus <strong>${escapeHtml(prod?.nama)}</strong>?</p>`,
        okText: 'Ya, Hapus',
        cancelText: 'Batal',
        onOK: async () => {
          try {
            await deleteItem(STORE_PRODUCTS, id);
            await loadAll();
            renderAdminList();
            renderMenuList();
            showNotification('Produk berhasil dihapus', 'success');
          } catch (error) {
            console.error('Delete product error:', error);
            showNotification('Gagal menghapus produk', 'error');
          }
        }
      });
    });
  });
}

function openAddProductModal() {
  const body = `
    <div class="form-group">
      <label class="form-label">Nama Produk</label>
      <input type="text" id="p_name" class="form-input" placeholder="Nama produk" required>
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <input type="text" id="p_cat" class="form-input" placeholder="Kategori" list="categories">
      <datalist id="categories">
        ${Array.from(STATE.categories).map(cat => `<option value="${escapeHtml(cat)}">`).join('')}
      </datalist>
    </div>
    <div class="form-group">
      <label class="form-label">Harga</label>
      <input type="number" id="p_price" class="form-input" placeholder="Harga" min="0" required>
    </div>
    <div class="form-group">
      <label class="form-label">Stok Awal</label>
      <input type="number" id="p_stock" class="form-input" placeholder="Stok" min="0" value="0" required>
    </div>
    <div class="form-group">
      <label class="form-label">Catatan (opsional)</label>
      <input type="text" id="p_notes" class="form-input" placeholder="Catatan tambahan">
    </div>
  `;
  
  showModal({
    title: 'Tambah Produk',
    bodyHtml: body,
    okText: 'Simpan',
    cancelText: 'Batal',
    onOK: async (modal) => {
      const name = modal.querySelector('#p_name')?.value?.trim();
      const cat = modal.querySelector('#p_cat')?.value?.trim() || 'Umum';
      const price = parseInt(modal.querySelector('#p_price')?.value || 0);
      const stock = parseInt(modal.querySelector('#p_stock')?.value || 0);
      const notes = modal.querySelector('#p_notes')?.value?.trim();
      
      if(!name) {
        showNotification('Nama produk tidak boleh kosong', 'error');
        return;
      }
      
      if(price <= 0) {
        showNotification('Harga harus lebih dari 0', 'error');
        return;
      }
      
      try {
        const item = { 
          id: genId('p'), 
          nama: name, 
          kategori: cat, 
          harga: price, 
          stok: stock,
          notes: notes || undefined
        };
        
        await putItem(STORE_PRODUCTS, item);
        await loadAll();
        renderAdminList();
        renderMenuList();
        showNotification('Produk berhasil ditambahkan', 'success');
      } catch (error) {
        console.error('Add product error:', error);
        showNotification('Gagal menambah produk', 'error');
      }
    }
  });
}

function openEditProductModal(prod) {
  if(!prod) return;
  
  const body = `
    <div class="form-group">
      <label class="form-label">Nama Produk</label>
      <input type="text" id="e_name" class="form-input" value="${escapeHtml(prod.nama)}" required>
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <input type="text" id="e_cat" class="form-input" value="${escapeHtml(prod.kategori||'')}" list="categories">
    </div>
    <div class="form-group">
      <label class="form-label">Harga</label>
      <input type="number" id="e_price" class="form-input" value="${prod.harga||0}" min="0" required>
    </div>
    <div class="form-group">
      <label class="form-label">Stok</label>
      <input type="number" id="e_stock" class="form-input" value="${prod.stok||0}" min="0" required>
    </div>
    <div class="form-group">
      <label class="form-label">Catatan (opsional)</label>
      <input type="text" id="e_notes" class="form-input" value="${escapeHtml(prod.notes||'')}" placeholder="Catatan tambahan">
    </div>
  `;
  
  showModal({
    title: 'Edit Produk',
    bodyHtml: body,
    okText: 'Simpan',
    cancelText: 'Batal',
    onOK: async (modal) => {
      const name = modal.querySelector('#e_name')?.value?.trim();
      const cat = modal.querySelector('#e_cat')?.value?.trim() || 'Umum';
      const price = parseInt(modal.querySelector('#e_price')?.value || 0);
      const stock = parseInt(modal.querySelector('#e_stock')?.value || 0);
      const notes = modal.querySelector('#e_notes')?.value?.trim();
      
      if(!name) {
        showNotification('Nama produk tidak boleh kosong', 'error');
        return;
      }
      
      if(price <= 0) {
        showNotification('Harga harus lebih dari 0', 'error');
        return;
      }
      
      try {
        prod.nama = name;
        prod.kategori = cat;
        prod.harga = price;
        prod.stok = stock;
        prod.notes = notes || undefined;
        
        await putItem(STORE_PRODUCTS, prod);
        await loadAll();
        renderAdminList();
        renderMenuList();
        showNotification('Produk berhasil diupdate', 'success');
      } catch (error) {
        console.error('Edit product error:', error);
        showNotification('Gagal mengupdate produk', 'error');
      }
    }
  });
}

async function openRestockModal(productId) {
  const p = await getById(STORE_PRODUCTS, productId);
  if(!p) {
    showNotification('Produk tidak ditemukan', 'error');
    return;
  }
  
  const body = `
    <div class="form-group">
      <label class="form-label">Restock untuk <strong>${escapeHtml(p.nama)}</strong></label>
      <input type="number" id="rest_qty" class="form-input" value="1" min="1" required>
    </div>
    <div style="background:#e8f4fd;padding:12px;border-radius:8px;margin-top:12px">
      <small>Stok saat ini: <strong>${p.stok || 0}</strong></small>
    </div>
  `;
  
  showModal({
    title: 'Restock Produk',
    bodyHtml: body,
    okText: 'Tambah Stok',
    cancelText: 'Batal',
    onOK: async (modal) => {
      const qty = parseInt(modal.querySelector('#rest_qty')?.value || 0);
      
      if(qty <= 0) {
        showNotification('Masukkan jumlah valid', 'error');
        return;
      }
      
      try {
        p.stok = (p.stok || 0) + qty;
        await putItem(STORE_PRODUCTS, p);
        await loadAll();
        renderMenuList();
        if (STATE.currentUser) renderAdminList();
        showNotification(`Stok ${p.nama} ditambah ${qty}`, 'success');
      } catch (error) {
        console.error('Restock error:', error);
        showNotification('Gagal restock', 'error');
      }
    }
  });
}

/* =========================
   Backup & Restore
   ========================= */
async function exportJSONBackup() {
  try {
    showLoading(true);
    const snapshot = await snapshotAll();
    const name = `backup-kedai-riski-${dateKey()}-${Date.now()}.json`;
    const entry = { id: genId('b'), name, created: Date.now(), data: snapshot };
    
    await putItem(STORE_BACKUPS, entry);
    const success = downloadBlob(JSON.stringify(snapshot, null, 2), name, 'application/json');
    
    await loadAll();
    renderBackupList();
    
    showLoading(false);
    
    if (success) {
      showNotification('Backup JSON berhasil dibuat', 'success');
    } else {
      showNotification('Backup disimpan lokal (download gagal)', 'info');
    }
  } catch (error) {
    console.error('Backup error:', error);
    showLoading(false);
    showNotification('Gagal membuat backup', 'error');
  }
}

async function exportCSVBackup() {
  try {
    const prods = await getAll(STORE_PRODUCTS);
    const rows = [['Kategori','Nama','Harga','Stok','Catatan']];
    prods.forEach(p => rows.push([p.kategori, p.nama, p.harga, p.stok, p.notes || '']));
    const csv = toCSV(rows);
    const name = `produks-${dateKey()}.csv`;
    
    const success = downloadBlob(csv, name, 'text/csv;charset=utf-8');
    
    if (success) {
      showNotification('Backup CSV berhasil diunduh', 'success');
    } else {
      showNotification('Gagal mengunduh backup CSV', 'error');
    }
  } catch (error) {
    console.error('CSV export error:', error);
    showNotification('Gagal export CSV', 'error');
  }
}

async function exportProductsExcelLikeCSV() {
  exportCSVBackup(); // Alias for consistency
}

async function snapshotAll() {
  const products = await getAll(STORE_PRODUCTS) || [];
  const sales = await getAll(STORE_SALES) || [];
  return { 
    created: Date.now(), 
    app: APP_NAME,
    version: DB_VER,
    products, 
    sales 
  };
}

async function renderBackupList() {
  const container = $('#backupList');
  if(!container) return;
  
  container.innerHTML = '';
  
  if (STATE.backups.length === 0) {
    container.innerHTML = '<div class="text-center" style="padding:20px;color:#666">Belum ada backup</div>';
    return;
  }
  
  STATE.backups.sort((a,b) => b.created - a.created);
  
  for(const b of STATE.backups) {
    const row = document.createElement('div');
    row.className = 'backup-item';
    row.innerHTML = `
      <div class="backup-info">
        <div class="backup-name">${escapeHtml(b.name)}</div>
        <div class="backup-date">${dateTimeStr(b.created)} • ${b.data?.products?.length || 0} produk, ${b.data?.sales?.length || 0} transaksi</div>
      </div>
      <div class="backup-actions">
        <button class="btn-secondary btn-small btn-download" data-id="${b.id}">Download</button>
        <button class="btn-secondary btn-small btn-restore" data-id="${b.id}">Restore</button>
        <button class="btn-del btn-small" data-id="${b.id}">Hapus</button>
      </div>
    `;
    container.appendChild(row);
  }
  
  // Bind backup actions
  $all('.btn-download').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const backup = STATE.backups.find(x => x.id === id);
      if(!backup) {
        showNotification('Backup tidak ditemukan', 'error');
        return;
      }
      
      downloadBlob(JSON.stringify(backup.data, null, 2), backup.name, 'application/json');
    });
  });
  
  $all('.btn-restore').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const backup = STATE.backups.find(x => x.id === id);
      if(!backup) {
        showNotification('Backup tidak ditemukan', 'error');
        return;
      }
      
      showModal({
        title: 'Restore Backup',
        bodyHtml: `
          <p>Yakin ingin restore backup <strong>${escapeHtml(backup.name)}</strong>?</p>
          <div style="background:#fff3cd;padding:12px;border-radius:8px;margin-top:12px;border:1px solid #ffeaa7">
            <strong>⚠️ Peringatan:</strong> Semua data produk dan transaksi saat ini akan diganti!
          </div>
        `,
        okText: 'Ya, Restore',
        cancelText: 'Batal',
        onOK: async () => {
          try {
            showLoading(true);
            await restoreFromSnapshot(backup.data);
            showLoading(false);
            showNotification('Restore berhasil', 'success');
          } catch (error) {
            console.error('Restore error:', error);
            showLoading(false);
            showNotification('Gagal restore backup', 'error');
          }
        }
      });
    });
  });
  
  $all('.btn-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const backup = STATE.backups.find(x => x.id === id);
      
      showModal({
        title: 'Hapus Backup',
        bodyHtml: `<p>Yakin ingin menghapus backup <strong>${escapeHtml(backup?.name)}</strong>?</p>`,
        okText: 'Ya, Hapus',
        cancelText: 'Batal',
        onOK: async () => {
          try {
            await deleteItem(STORE_BACKUPS, id);
            await loadAll();
            renderBackupList();
            showNotification('Backup berhasil dihapus', 'success');
          } catch (error) {
            console.error('Delete backup error:', error);
            showNotification('Gagal menghapus backup', 'error');
          }
        }
      });
    });
  });
}

async function handleRestore() {
  const fileInput = $('#restoreFile');
  const file = fileInput?.files?.[0];
  
  if (!file) {
    showNotification('Pilih file backup terlebih dahulu', 'error');
    return;
  }
  
  try {
    showLoading(true);
    const text = await file.text();
    const json = JSON.parse(text);
    
    if (!json.products || !Array.isArray(json.products)) {
      throw new Error('Format backup tidak valid');
    }
    
    showModal({
      title: 'Restore dari File',
      bodyHtml: `
        <p>Yakin ingin restore dari file <strong>${escapeHtml(file.name)}</strong>?</p>
        <div style="background:#fff3cd;padding:12px;border-radius:8px;margin-top:12px;border:1px solid #ffeaa7">
          <strong>⚠️ Peringatan:</strong> 
          <ul style="margin:8px 0;padding-left:20px">
            <li>${json.products.length} produk akan diganti</li>
            <li>${json.sales?.length || 0} transaksi akan diganti</li>
            <li>Data saat ini akan hilang!</li>
          </ul>
        </div>
      `,
      okText: 'Ya, Restore',
      cancelText: 'Batal',
      onOK: async () => {
        try {
          await restoreFromSnapshot(json);
          fileInput.value = '';
          showNotification('Restore dari file berhasil', 'success');
        } catch (error) {
          console.error('File restore error:', error);
          showNotification('Gagal restore dari file', 'error');
        }
      }
    });
    
  } catch (error) {
    console.error('File read error:', error);
    showNotification('File tidak valid atau rusak', 'error');
  } finally {
    showLoading(false);
  }
}

async function handleImportCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const rows = text.split('\n').filter(row => row.trim());
    
    if (rows.length < 2) {
      throw new Error('File CSV kosong atau tidak valid');
    }
    
    const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['kategori', 'nama', 'harga', 'stok'];
    
    if (!expectedHeaders.every(h => headers.includes(h))) {
      throw new Error('Format CSV tidak sesuai. Kolom required: kategori, nama, harga, stok');
    }
    
    const products = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map(c => c.trim());
      if (cells.length >= 4) {
        products.push({
          id: genId('p'),
          kategori: cells[0],
          nama: cells[1],
          harga: parseInt(cells[2]) || 0,
          stok: parseInt(cells[3]) || 0,
          notes: cells[4] || undefined
        });
      }
    }
    
    if (products.length === 0) {
      throw new Error('Tidak ada data produk yang valid dalam file');
    }
    
    showModal({
      title: 'Import CSV',
      bodyHtml: `
        <p>Import <strong>${products.length}</strong> produk dari CSV?</p>
        <div style="max-height:200px;overflow:auto;background:#f8f9fa;padding:12px;border-radius:8px;margin-top:12px">
          ${products.slice(0, 10).map(p => `
            <div style="padding:4px 0;border-bottom:1px solid #ddd">
              <strong>${escapeHtml(p.nama)}</strong> - ${escapeHtml(p.kategori)} - ${fmtCurr(p.harga)}
            </div>
          `).join('')}
          ${products.length > 10 ? `<div style="padding:4px 0;color:#666">... dan ${products.length - 10} produk lainnya</div>` : ''}
        </div>
        <div style="background:#fff3cd;padding:12px;border-radius:8px;margin-top:12px;border:1px solid #ffeaa7">
          <strong>⚠️ Peringatan:</strong> Produk dengan nama yang sama akan ditimpa!
        </div>
      `,
      okText: 'Import',
      cancelText: 'Batal',
      onOK: async () => {
        try {
          showLoading(true);
          
          // Import products
          for (const product of products) {
            await putItem(STORE_PRODUCTS, product);
          }
          
          await loadAll();
          renderAdminList();
          renderMenuList();
          event.target.value = '';
          showLoading(false);
          showNotification(`${products.length} produk berhasil diimport`, 'success');
        } catch (error) {
          console.error('Import error:', error);
          showLoading(false);
          showNotification('Gagal import produk', 'error');
        }
      }
    });
    
  } catch (error) {
    console.error('CSV import error:', error);
    showNotification(error.message, 'error');
    event.target.value = '';
  }
}

async function restoreFromSnapshot(snap) {
  try {
    showLoading(true);
    
    // Clear existing data
    await clearStore(STORE_PRODUCTS);
    await clearStore(STORE_SALES);
    
    // Restore products
    for (const p of snap.products || []) {
      await putItem(STORE_PRODUCTS, p);
    }
    
    // Restore sales
    for (const s of snap.sales || []) {
      await putItem(STORE_SALES, s);
    }
    
    await loadAll();
    renderAll();
    showLoading(false);
  } catch (error) {
    console.error('Restore snapshot error:', error);
    throw error;
  }
}

/* =========================
   Auto-backup
   ========================= */
async function initAutoBackupFromSettings() {
  try {
    const enabled = STATE.settings[AUTO_BACKUP_SETTING_KEY] ?? false;
    const interval = STATE.settings[AUTO_BACKUP_INTERVAL_KEY] ?? 60;
    
    updateAutoBackupToggle(enabled);
    
    if (enabled) {
      startAutoBackup(interval);
    }
  } catch (error) {
    console.error('Auto-backup init error:', error);
  }
}

function updateAutoBackupToggle(enabled) {
  const toggle = $('#autoBackupToggle');
  if (toggle) {
    toggle.textContent = `⏰ Auto Backup: ${enabled ? 'ON' : 'OFF'}`;
    toggle.style.background = enabled ? '#e8f5e8' : '';
    toggle.style.borderColor = enabled ? '#28a745' : '';
  }
}

function toggleAutoBackup() {
  const currentlyEnabled = STATE.settings[AUTO_BACKUP_SETTING_KEY] ?? false;
  const newEnabled = !currentlyEnabled;
  
  STATE.settings[AUTO_BACKUP_SETTING_KEY] = newEnabled;
  
  // Save setting
  putItem(STORE_SETTINGS, {
    key: AUTO_BACKUP_SETTING_KEY,
    value: newEnabled
  }).then(() => {
    updateAutoBackupToggle(newEnabled);
    
    if (newEnabled) {
      startAutoBackup(STATE.settings[AUTO_BACKUP_INTERVAL_KEY] || 60);
      showNotification('Auto-backup diaktifkan', 'success');
    } else {
      stopAutoBackup();
      showNotification('Auto-backup dimatikan', 'info');
    }
  }).catch(error => {
    console.error('Save auto-backup setting error:', error);
    showNotification('Gagal mengubah pengaturan auto-backup', 'error');
  });
}

let lastAutoBackup = 0;
function startAutoBackup(intervalMinutes = 60) {
  stopAutoBackup();
  
  // Do initial backup
  doAutoBackup();
  
  // Set interval for subsequent backups
  STATE.autoBackupTimer = setInterval(() => {
    doAutoBackup();
  }, intervalMinutes * 60 * 1000);
}

function stopAutoBackup() {
  if (STATE.autoBackupTimer) {
    clearInterval(STATE.autoBackupTimer);
    STATE.autoBackupTimer = null;
  }
}

async function doAutoBackup() {
  const now = Date.now();
  if (now - lastAutoBackup < 30 * 1000) return; // Prevent too frequent backups
  
  lastAutoBackup = now;
  
  try {
    const snap = await snapshotAll();
    const name = `autobackup-${dateKey()}-${Date.now()}.json`;
    const entry = { id: genId('b'), name, created: now, data: snap };
    
    await putItem(STORE_BACKUPS, entry);
    
    // Try to download but don't worry if it fails
    try {
      downloadBlob(JSON.stringify(snap), name, 'application/json');
    } catch (e) {
      // Silent fail for download
    }
    
    await loadAll();
    renderBackupList();
    
    console.log('Auto-backup completed:', name);
  } catch (error) {
    console.error('Auto-backup error:', error);
  }
}

/* =========================
   Print / Struk
   ========================= */
function openPrintStruk(sale) {
  const html = buildStrukHtml(sale);
  const w = window.open('', '_blank', 'width=320,height=600');
  
  if (!w) {
    showNotification('Popup diblokir. Izinkan popup untuk print struk.', 'error');
    return;
  }
  
  w.document.write(html);
  w.document.close();
  
  setTimeout(() => {
    try {
      w.focus();
      w.print();
      // w.close(); // Don't auto-close, let user decide
    } catch(e) {
      console.error('Print error:', e);
      showNotification('Gagal print. Silakan print manual dari browser.', 'error');
    }
  }, 500);
}

function buildStrukHtml(sale) {
  const storeName = APP_NAME;
  const dateStr = dateTimeStr(sale.created);
  const itemsHtml = sale.items.map(i => `
    <tr>
      <td style="padding:2px 4px;border-bottom:1px dotted #ccc">${escapeHtml(i.nama)}</td>
      <td style="padding:2px 4px;text-align:center;border-bottom:1px dotted #ccc">${i.qty}</td>
      <td style="padding:2px 4px;text-align:right;border-bottom:1px dotted #ccc">${fmtCurr(i.harga * i.qty)}</td>
    </tr>
  `).join('');
  
  const paymentMethod = escapeHtml(sale.paymentMethod || 'cash');
  const paymentRef = escapeHtml(sale.paymentRef || '');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Struk ${escapeHtml(sale.id)}</title>
  <style>
    body { 
      font-family: 'Courier New', monospace; 
      font-size: 12px; 
      margin: 0; 
      padding: 8px; 
      color: #000;
      background: white;
    }
    .receipt { 
      width: 72mm; 
      max-width: 100%; 
      margin: 0 auto;
    }
    .header { 
      text-align: center; 
      margin-bottom: 8px;
      border-bottom: 1px dashed #000;
      padding-bottom: 8px;
    }
    .header h1 { 
      font-size: 16px; 
      margin: 0; 
      font-weight: bold;
    }
    .meta { 
      font-size: 10px; 
      text-align: center; 
      margin-bottom: 8px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 8px 0;
    }
    .total { 
      margin-top: 8px; 
      border-top: 2px solid #000;
      padding-top: 8px;
    }
    .total-line {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    .footer { 
      text-align: center; 
      margin-top: 16px; 
      font-size: 10px;
      border-top: 1px dashed #000;
      padding-top: 8px;
    }
    .payment-info {
      margin-top: 8px;
      padding: 8px;
      background: #f0f0f0;
      border-radius: 4px;
    }
    @media print {
      body { margin: 0; padding: 4px; }
      .receipt { width: 72mm; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${escapeHtml(storeName)}</h1>
      <div class="meta">
        ${dateStr}<br>
        No: ${escapeHtml(sale.id)}
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th style="text-align:left;padding:2px 4px;border-bottom:1px solid #000">Item</th>
          <th style="text-align:center;padding:2px 4px;border-bottom:1px solid #000">Qty</th>
          <th style="text-align:right;padding:2px 4px;border-bottom:1px solid #000">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="total">
      <div class="total-line">
        <div>Total:</div>
        <div>${fmtCurr(sale.total)}</div>
      </div>
      <div class="total-line">
        <div>Bayar:</div>
        <div>${fmtCurr(sale.paid)}</div>
      </div>
      <div class="total-line">
        <div>Kembali:</div>
        <div>${fmtCurr(sale.change)}</div>
      </div>
    </div>
    
    <div class="payment-info">
      <div>Metode: <strong>${paymentMethod.toUpperCase()}</strong></div>
      ${paymentRef ? `<div>Ref: <strong>${paymentRef}</strong></div>` : ''}
    </div>
    
    <div class="footer">
      Terima kasih atas kunjungannya<br>
      --- ${escapeHtml(storeName)} ---
    </div>
  </div>
  
  <script>
    // Auto-print after load
    setTimeout(() => {
      window.print();
    }, 500);
  </script>
</body>
</html>`;
}

/* =========================
   Terminal Mode (dev)
   ========================= */
async function startTerminalMode() {
  console.clear();
  console.log('--- Terminal Mode ---');
  console.log('Commands: products, sales, buy [id] [qty], restock [id] [qty], exit');
  
  // Simple terminal interface
  const command = prompt('Enter command:');
  if (!command) return;
  
  const [cmd, ...args] = command.trim().toLowerCase().split(' ');
  
  try {
    switch(cmd) {
      case 'products':
      case 'p':
        const prods = await getAll(STORE_PRODUCTS);
        console.table(prods.map(p => ({
          ID: p.id, 
          Name: p.nama, 
          Category: p.kategori,
          Price: fmtCurr(p.harga),
          Stock: p.stok
        })));
        break;
        
      case 'sales':
      case 's':
        const sales = await getAll(STORE_SALES);
        console.table(sales.map(s => ({
          ID: s.id,
          Date: dateTimeStr(s.created),
          Total: fmtCurr(s.total),
          Items: s.items.length
        })));
        break;
        
      case 'buy':
        if (args.length < 2) {
          console.log('Usage: buy [productId] [quantity]');
          break;
        }
        await terminalBuy(args[0], parseInt(args[1]));
        break;
        
      case 'restock':
        if (args.length < 2) {
          console.log('Usage: restock [productId] [quantity]');
          break;
        }
        await terminalRestock(args[0], parseInt(args[1]));
        break;
        
      case 'exit':
      case 'quit':
        return;
        
      default:
        console.log('Unknown command. Available: products, sales, buy, restock, exit');
    }
  } catch (error) {
    console.error('Terminal error:', error);
  }
  
  // Recursive call for continuous terminal
  setTimeout(startTerminalMode, 100);
}

async function terminalBuy(productId, quantity) {
  const prod = await getById(STORE_PRODUCTS, productId);
  if (!prod) {
    console.log('Product not found');
    return;
  }
  
  if (prod.stok < quantity) {
    console.log('Insufficient stock');
    return;
  }
  
  // Update stock
  prod.stok -= quantity;
  await putItem(STORE_PRODUCTS, prod);
  
  // Create sale
  const sale = {
    id: genId('s'),
    created: Date.now(),
    items: [{ id: prod.id, nama: prod.nama, harga: prod.harga, qty: quantity }],
    total: prod.harga * quantity,
    paid: prod.harga * quantity,
    change: 0,
    paymentMethod: 'cash'
  };
  
  await putItem(STORE_SALES, sale);
  await loadAll();
  
  console.log(`Sold ${quantity} × ${prod.nama} for ${fmtCurr(sale.total)}`);
}

async function terminalRestock(productId, quantity) {
  const prod = await getById(STORE_PRODUCTS, productId);
  if (!prod) {
    console.log('Product not found');
    return;
  }
  
  prod.stok = (prod.stok || 0) + quantity;
  await putItem(STORE_PRODUCTS, prod);
  await loadAll();
  
  console.log(`Restocked ${quantity} × ${prod.nama}. New stock: ${prod.stok}`);
}

/* =========================
   Global exports for debug
   ========================= */
window.APP = {
  STATE,
  refresh: () => loadAll().then(renderAll),
  exportSalesCSV: async (period = 'all') => {
    const sales = await getAll(STORE_SALES) || [];
    let filtered = sales;
    
    if (period === 'today') {
      const key = dateKey();
      filtered = sales.filter(s => dateKey(new Date(s.created)) === key);
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = sales.filter(s => new Date(s.created) >= weekAgo);
    }
    
    const rows = [['ID', 'Tanggal', 'Items', 'Total', 'Bayar', 'Kembali', 'Metode', 'Referensi']];
    filtered.forEach(s => {
      const itemsStr = s.items.map(i => `${i.nama} x${i.qty}`).join('; ');
      rows.push([
        s.id,
        dateTimeStr(s.created),
        itemsStr,
        s.total,
        s.paid,
        s.change,
        s.paymentMethod || '',
        s.paymentRef || ''
      ]);
    });
    
    const csv = toCSV(rows);
    downloadBlob(csv, `sales-${period}-${dateKey()}.csv`, 'text/csv');
  },
  terminal: startTerminalMode
};

// Initialize default navigation
setTimeout(() => {
  navigateTo('dashboard');
}, 100);