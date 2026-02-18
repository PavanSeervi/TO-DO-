/* =========================================================
   Inventory Pro – app.js
   ========================================================= */

// ── Sample Data ──────────────────────────────────────────
const SAMPLE = {
    categories: ['Electronics', 'Office Supplies', 'Accessories', 'Home & Living'],
    products: [
        { name: 'Wireless Mouse', category: 'Electronics', stock: 5, threshold: 10, costPrice: 250, sellingPrice: 450, supplier: 'Tech Supplies' },
        { name: 'USB-C Cable', category: 'Electronics', stock: 0, threshold: 20, costPrice: 80, sellingPrice: 150, supplier: 'Cable World' },
        { name: 'Laptop Stand', category: 'Office Supplies', stock: 3, threshold: 5, costPrice: 500, sellingPrice: 899, supplier: 'Office Pro' },
        { name: 'Bluetooth Speaker', category: 'Electronics', stock: 22, threshold: 8, costPrice: 800, sellingPrice: 1499, supplier: 'Audio Co' },
        { name: 'Phone Case', category: 'Accessories', stock: 8, threshold: 15, costPrice: 120, sellingPrice: 299, supplier: 'Mobile Hub' },
        { name: 'Desk Lamp', category: 'Home & Living', stock: 12, threshold: 6, costPrice: 350, sellingPrice: 699, supplier: 'LightCo' },
    ],
};

// ── Helpers ───────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}
function fmt(n) { return '₹' + Number(n).toFixed(2); }
function fmtInt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

// ── Storage ───────────────────────────────────────────────
const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Storage full – data not saved', 'danger'); } },
};

// ── Toast ─────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3200) {
    const icons = { success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill', danger: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${esc(msg)}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(110%)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 320); }, duration);
}

// ── Modal ─────────────────────────────────────────────────
function openModal(title, bodyHTML, { wide = false } = {}) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.innerHTML = `
    <div class="modal-box" style="${wide ? 'max-width:680px' : ''}">
      <div class="modal-head">
        <span class="modal-title">${esc(title)}</span>
        <button class="modal-close" id="modal-close-btn" aria-label="Close">&times;</button>
      </div>
      <div id="modal-body">${bodyHTML}</div>
    </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);

    const onKey = e => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    overlay._keyHandler = onKey;

    // Focus first input
    setTimeout(() => { const f = overlay.querySelector('input,select,textarea'); if (f) f.focus(); }, 60);
    return overlay;
}
function closeModal() {
    const m = document.getElementById('active-modal');
    if (m) { if (m._keyHandler) document.removeEventListener('keydown', m._keyHandler); m.remove(); }
}

// ── App State ─────────────────────────────────────────────
const state = {
    products: store.get('inv_products') || [],
    categories: store.get('inv_categories') || [],
    purchaseOrders: store.get('inv_purchaseOrders') || [],
    currentTab: 'products',
    filters: { search: '', category: '', status: '', sort: 'name-asc' },
    charts: {},
};

function save() {
    store.set('inv_products', state.products);
    store.set('inv_categories', state.categories);
    store.set('inv_purchaseOrders', state.purchaseOrders);
}

// ── Status Logic ──────────────────────────────────────────
function getStatus(p) {
    if (p.stock === 0) return 'out-of-stock';
    if (p.stock <= p.threshold) return 'low-stock';
    if (p.stock <= Math.ceil(p.threshold * 1.5)) return 'needs-reorder';
    return 'in-stock';
}
const STATUS_LABEL = { 'in-stock': 'In Stock', 'low-stock': 'Low Stock', 'needs-reorder': 'Needs Reorder', 'out-of-stock': 'Out of Stock' };
const STATUS_COLOR = { 'in-stock': 'var(--success)', 'low-stock': 'var(--warning)', 'needs-reorder': 'var(--info)', 'out-of-stock': 'var(--danger)' };

function reorderQty(p) { return Math.max(1, Math.ceil(p.threshold * 1.5) * 2 - p.stock); }

// ── Navigation ────────────────────────────────────────────
function showTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
        el.classList.toggle('active', el.dataset.tab === tab);
    });
    updateNavBadges();
    renderMain();
}

function updateNavBadges() {
    const alerts = state.products.filter(p => getStatus(p) !== 'in-stock').length;
    const pendingPOs = state.purchaseOrders.filter(po => po.status === 'pending').length;
    document.querySelectorAll('.nav-badge').forEach(b => b.remove());

    if (alerts > 0) {
        document.querySelectorAll('.nav-item[data-tab="products"]').forEach(el => {
            if (!el.querySelector('.nav-badge')) el.insertAdjacentHTML('beforeend', `<span class="nav-badge">${alerts}</span>`);
        });
    }
    if (pendingPOs > 0) {
        document.querySelectorAll('.nav-item[data-tab="orders"]').forEach(el => {
            if (!el.querySelector('.nav-badge')) el.insertAdjacentHTML('beforeend', `<span class="nav-badge" style="background:var(--warning);color:#fff;">${pendingPOs}</span>`);
        });
    }
}

// ── Stats ─────────────────────────────────────────────────
function renderStats() {
    const total = state.products.length;
    const oos = state.products.filter(p => getStatus(p) === 'out-of-stock').length;
    const low = state.products.filter(p => getStatus(p) === 'low-stock').length;
    const reorder = state.products.filter(p => getStatus(p) === 'needs-reorder').length;
    const value = state.products.reduce((s, p) => s + p.stock * p.costPrice, 0);

    return `
  <div class="stats-grid">
    <div class="stat-card" style="--accent:var(--primary)" onclick="showTab('products')" title="View all products">
      <div class="stat-icon"><i class="bi bi-box-seam"></i></div>
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total Products</div>
    </div>
    <div class="stat-card" style="--accent:var(--danger)" onclick="applyFilter('status','out-of-stock')" title="Filter out-of-stock">
      <div class="stat-icon" style="background:rgba(244,63,94,.12);color:var(--danger)"><i class="bi bi-x-circle"></i></div>
      <div class="stat-value" style="color:var(--danger)">${oos}</div>
      <div class="stat-label">Out of Stock</div>
    </div>
    <div class="stat-card" style="--accent:var(--warning)" onclick="applyFilter('status','low-stock')" title="Filter low stock">
      <div class="stat-icon" style="background:rgba(245,158,11,.12);color:var(--warning)"><i class="bi bi-exclamation-triangle"></i></div>
      <div class="stat-value" style="color:var(--warning)">${low}</div>
      <div class="stat-label">Low Stock</div>
    </div>
    <div class="stat-card" style="--accent:var(--info)" onclick="applyFilter('status','needs-reorder')" title="Filter needs reorder">
      <div class="stat-icon" style="background:rgba(56,189,248,.12);color:var(--info)"><i class="bi bi-arrow-repeat"></i></div>
      <div class="stat-value" style="color:var(--info)">${reorder}</div>
      <div class="stat-label">Needs Reorder</div>
    </div>
    <div class="stat-card" style="--accent:var(--success)" onclick="showTab('analytics')" title="View analytics">
      <div class="stat-icon" style="background:rgba(34,211,160,.12);color:var(--success)"><i class="bi bi-currency-rupee"></i></div>
      <div class="stat-value" style="color:var(--success)">${fmtInt(value)}</div>
      <div class="stat-label">Inventory Value</div>
    </div>
  </div>`;
}

// ── Products Tab ───────────────────────────────────────────
function sortProducts(products, sort) {
    const sorted = [...products];
    switch (sort) {
        case 'name-asc': return sorted.sort((a, b) => a.name.localeCompare(b.name));
        case 'name-desc': return sorted.sort((a, b) => b.name.localeCompare(a.name));
        case 'stock-asc': return sorted.sort((a, b) => a.stock - b.stock);
        case 'stock-desc': return sorted.sort((a, b) => b.stock - a.stock);
        case 'value-desc': return sorted.sort((a, b) => (b.stock * b.sellingPrice) - (a.stock * a.sellingPrice));
        case 'margin-desc': return sorted.sort((a, b) => {
            const ma = a.costPrice > 0 ? (a.sellingPrice - a.costPrice) / a.costPrice : -Infinity;
            const mb = b.costPrice > 0 ? (b.sellingPrice - b.costPrice) / b.costPrice : -Infinity;
            return mb - ma;
        });
        case 'status': return sorted.sort((a, b) => {
            const order = { 'out-of-stock': 0, 'low-stock': 1, 'needs-reorder': 2, 'in-stock': 3 };
            return order[getStatus(a)] - order[getStatus(b)];
        });
        default: return sorted;
    }
}

function renderProducts() {
    const { search, category, status, sort } = state.filters;

    let filtered = state.products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
            || (p.supplier || '').toLowerCase().includes(search.toLowerCase())
            || p.category.toLowerCase().includes(search.toLowerCase());
        const matchCategory = !category || p.category === category;
        const matchStatus = !status || getStatus(p) === status;
        return matchSearch && matchCategory && matchStatus;
    });
    filtered = sortProducts(filtered, sort);

    const catOptions = state.categories.map(c => `<option value="${esc(c)}" ${c === category ? 'selected' : ''}>${esc(c)}</option>`).join('');

    let cardsHTML = '';
    if (state.products.length === 0) {
        cardsHTML = `<div class="empty-state">
      <i class="bi bi-box-seam"></i>
      <h3>No Products Yet</h3>
      <p>Add your first product or load sample data to get started.</p>
      <button class="btn btn-primary" onclick="loadSample()"><i class="bi bi-lightning-charge"></i> Load Sample Data</button>
    </div>`;
    } else if (filtered.length === 0) {
        cardsHTML = `<div class="empty-state">
      <i class="bi bi-search"></i>
      <h3>No Results</h3>
      <p>No products match your current filters.</p>
      <button class="btn btn-ghost btn-sm" onclick="clearFilters()"><i class="bi bi-x-lg"></i> Clear Filters</button>
    </div>`;
    } else {
        cardsHTML = `<div class="product-grid">${filtered.map(productCard).join('')}</div>`;
    }

    return `
    ${renderStats()}
    <div class="page-header">
      <div>
        <div class="page-title">Products</div>
        <div class="page-subtitle">${state.products.length} product${state.products.length !== 1 ? 's' : ''} · ${filtered.length} shown</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-export-csv" title="Export to CSV"><i class="bi bi-download"></i> Export CSV</button>
    </div>
    <div class="toolbar">
      <div class="search-wrap">
        <i class="bi bi-search"></i>
        <input class="search-input" id="search-input" type="text" placeholder="Search name, supplier, category…" value="${esc(search)}" oninput="onSearch(this.value)" />
      </div>
      <select class="sel" onchange="applyFilter('category', this.value)">
        <option value="">All Categories</option>
        ${catOptions}
      </select>
      <select class="sel" onchange="applyFilter('status', this.value)">
        <option value="">All Status</option>
        <option value="in-stock"      ${status === 'in-stock' ? 'selected' : ''}>In Stock</option>
        <option value="low-stock"     ${status === 'low-stock' ? 'selected' : ''}>Low Stock</option>
        <option value="needs-reorder" ${status === 'needs-reorder' ? 'selected' : ''}>Needs Reorder</option>
        <option value="out-of-stock"  ${status === 'out-of-stock' ? 'selected' : ''}>Out of Stock</option>
      </select>
      <select class="sel" onchange="applyFilter('sort', this.value)">
        <option value="name-asc"    ${sort === 'name-asc' ? 'selected' : ''}>Name A–Z</option>
        <option value="name-desc"   ${sort === 'name-desc' ? 'selected' : ''}>Name Z–A</option>
        <option value="stock-asc"   ${sort === 'stock-asc' ? 'selected' : ''}>Stock: Low first</option>
        <option value="stock-desc"  ${sort === 'stock-desc' ? 'selected' : ''}>Stock: High first</option>
        <option value="value-desc"  ${sort === 'value-desc' ? 'selected' : ''}>Value: High first</option>
        <option value="margin-desc" ${sort === 'margin-desc' ? 'selected' : ''}>Margin: High first</option>
        <option value="status"      ${sort === 'status' ? 'selected' : ''}>Status: Alerts first</option>
      </select>
    </div>
    ${cardsHTML}`;
}

function productCard(p) {
    const st = getStatus(p);
    const color = STATUS_COLOR[st];
    const margin = p.costPrice > 0 ? (((p.sellingPrice - p.costPrice) / p.costPrice) * 100).toFixed(1) : null;
    const marginClass = margin !== null ? (parseFloat(margin) >= 0 ? 'pos' : 'neg') : '';

    return `
  <div class="product-card" style="--status-color:${color}">
    <div class="card-top">
      <span class="cat-badge">${esc(p.category)}</span>
      <span class="status-pill ${st}">${STATUS_LABEL[st]}</span>
    </div>
    <div class="product-name">${esc(p.name)}</div>
    ${p.supplier ? `<div class="product-supplier"><i class="bi bi-truck"></i> ${esc(p.supplier)}</div>` : ''}
    <div class="info-row stock-row">
      <span>Stock</span>
      <div style="display:flex;align-items:center;gap:.4rem;">
        <button class="btn-stock-adj btn-stock-dec" data-id="${p.id}" title="Remove 1">-</button>
        <strong>${p.stock} units</strong>
        <button class="btn-stock-adj btn-stock-inc" data-id="${p.id}" title="Add 1">+</button>
      </div>
    </div>
    <div class="info-row"><span>Min. Stock</span><strong>${p.threshold}</strong></div>
    <div class="info-row"><span>Cost</span><strong>${fmt(p.costPrice)}</strong></div>
    <div class="info-row"><span>Selling</span><strong>${fmt(p.sellingPrice)}</strong></div>
    ${margin !== null ? `<div class="info-row"><span>Margin</span><strong class="${marginClass}">${margin}%</strong></div>` : ''}
    <div class="card-actions">
      <button class="btn btn-ghost btn-sm btn-edit-product" data-id="${p.id}"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn btn-ghost btn-sm btn-duplicate-product" data-id="${p.id}" title="Duplicate"><i class="bi bi-copy"></i></button>
      ${st !== 'in-stock' ? `<button class="btn btn-primary btn-sm btn-quick-reorder" data-id="${p.id}"><i class="bi bi-cart-plus"></i> Reorder</button>` : ''}
      <button class="btn btn-icon btn-sm btn-delete-product" data-id="${p.id}" title="Delete"><i class="bi bi-trash"></i></button>
    </div>
  </div>`;
}

// ── Analytics Tab ─────────────────────────────────────────
function renderAnalytics() {
    if (state.products.length === 0) {
        return `${renderStats()}<div class="page-header"><div class="page-title">Analytics</div></div>
    <div class="empty-state"><i class="bi bi-bar-chart-line"></i><h3>No Data Yet</h3><p>Add products to see analytics.</p></div>`;
    }
    return `${renderStats()}
  <div class="page-header"><div class="page-title">Analytics</div></div>
  <div class="chart-grid">
    <div class="chart-card"><div class="chart-title">Stock by Category</div><div class="chart-wrap"><canvas id="chart-cat"></canvas></div></div>
    <div class="chart-card"><div class="chart-title">Stock Status Distribution</div><div class="chart-wrap"><canvas id="chart-status"></canvas></div></div>
    <div class="chart-card" style="grid-column:1/-1"><div class="chart-title">Top 8 Products by Inventory Value</div><div class="chart-wrap" style="height:280px"><canvas id="chart-value"></canvas></div></div>
  </div>`;
}

function buildCharts() {
    if (state.currentTab !== 'analytics' || state.products.length === 0) return;
    Object.values(state.charts).forEach(c => { try { c.destroy(); } catch { } });
    state.charts = {};

    const COLORS = ['#7c6ff7', '#38bdf8', '#22d3a0', '#f59e0b', '#f43f5e', '#a78bfa', '#34d399', '#fb923c'];

    // Category chart
    const catMap = {};
    state.products.forEach(p => { catMap[p.category] = (catMap[p.category] || 0) + p.stock; });
    const catEl = document.getElementById('chart-cat');
    if (catEl) {
        state.charts.cat = new Chart(catEl, {
            type: 'bar',
            data: { labels: Object.keys(catMap), datasets: [{ label: 'Units', data: Object.values(catMap), backgroundColor: COLORS, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8892a4' }, grid: { color: '#2e3248' } }, y: { ticks: { color: '#8892a4' }, grid: { color: '#2e3248' } } } },
        });
    }

    // Status doughnut
    const statusCounts = { 'In Stock': 0, 'Low Stock': 0, 'Needs Reorder': 0, 'Out of Stock': 0 };
    state.products.forEach(p => {
        const s = getStatus(p);
        if (s === 'in-stock') statusCounts['In Stock']++;
        else if (s === 'low-stock') statusCounts['Low Stock']++;
        else if (s === 'needs-reorder') statusCounts['Needs Reorder']++;
        else statusCounts['Out of Stock']++;
    });
    const statEl = document.getElementById('chart-status');
    if (statEl) {
        state.charts.status = new Chart(statEl, {
            type: 'doughnut',
            data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#22d3a0', '#f59e0b', '#38bdf8', '#f43f5e'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#8892a4', padding: 16 } } }, cutout: '65%' },
        });
    }

    // Value bar
    const top = state.products.map(p => ({ name: p.name, value: p.stock * p.sellingPrice })).sort((a, b) => b.value - a.value).slice(0, 8);
    const valEl = document.getElementById('chart-value');
    if (valEl) {
        state.charts.value = new Chart(valEl, {
            type: 'bar',
            data: { labels: top.map(p => p.name), datasets: [{ label: 'Value (₹)', data: top.map(p => p.value), backgroundColor: COLORS, borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8892a4' }, grid: { color: '#2e3248' } }, y: { ticks: { color: '#8892a4' }, grid: { color: '#2e3248' } } } },
        });
    }
}

// ── Purchase Orders Tab ───────────────────────────────────
function renderOrders() {
    const pos = [...state.purchaseOrders].reverse();
    let body = '';
    if (pos.length === 0) {
        body = `<div class="empty-state"><i class="bi bi-receipt"></i><h3>No Purchase Orders</h3><p>Create your first purchase order.</p></div>`;
    } else {
        body = pos.map(po => {
            const itemsHTML = po.items.map(it => `
        <div class="po-item-row">
          <span>${esc(it.productName)}</span>
          <span><strong>${it.quantity}</strong> × ${fmt(it.cost)}</span>
        </div>`).join('');
            return `
      <div class="po-card">
        <div class="po-head">
          <div>
            <div class="po-num">${esc(po.poNumber)}</div>
            <div class="po-date">${new Date(po.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}${po.deliveryDate ? ' · Expected: ' + po.deliveryDate : ''}</div>
          </div>
          <span class="po-badge ${po.status}">${po.status.toUpperCase()}</span>
        </div>
        <div class="po-items">${itemsHTML}</div>
        ${po.notes ? `<div style="font-size:.82rem;color:var(--muted);margin-bottom:.75rem;"><i class="bi bi-chat-left-text"></i> ${esc(po.notes)}</div>` : ''}
        <div class="po-footer">
          <div class="po-total">${fmt(po.totalCost)}</div>
          <div style="display:flex;gap:.5rem;align-items:center;">
            ${po.status === 'pending' ? `<button class="btn btn-icon btn-sm btn-delete-po" data-po-id="${po.id}" title="Delete Order"><i class="bi bi-trash"></i></button>` : ''}
            ${po.status === 'pending'
                    ? `<button class="btn btn-success btn-sm po-receive-btn" data-po-id="${po.id}"><i class="bi bi-check-circle"></i> Mark Received</button>`
                    : `<span style="color:var(--success);font-weight:700;font-size:.88rem;"><i class="bi bi-check-circle-fill"></i> Received ${po.receivedAt ? new Date(po.receivedAt).toLocaleDateString('en-IN') : ''}</span>`}
          </div>
        </div>
      </div>`;
        }).join('');
    }

    return `
  <div class="page-header">
    <div><div class="page-title">Purchase Orders</div><div class="page-subtitle">${state.purchaseOrders.length} order${state.purchaseOrders.length !== 1 ? 's' : ''}</div></div>
    <button class="btn btn-primary" id="btn-create-po"><i class="bi bi-plus-lg"></i> Create PO</button>
  </div>
  ${body}`;
}

// ── Categories Tab ────────────────────────────────────────
function renderCategories() {
    let body = '';
    if (state.categories.length === 0) {
        body = `<div class="empty-state"><i class="bi bi-tags"></i><h3>No Categories</h3><p>Add your first category to organise products.</p></div>`;
    } else {
        body = state.categories.map((cat, idx) => {
            const count = state.products.filter(p => p.category === cat).length;
            const canDelete = count === 0;
            return `
      <div class="cat-card">
        <div>
          <div class="cat-name">${esc(cat)}</div>
          <div class="cat-count" style="color:${canDelete ? 'var(--muted)' : 'var(--warning)'}">
            ${count === 0 ? 'No products — safe to delete' : `${count} product${count !== 1 ? 's' : ''} (remove them first)`}
          </div>
        </div>
        <button
          class="btn btn-icon btn-sm cat-delete-btn"
          data-cat-idx="${idx}"
          title="${canDelete ? 'Delete category' : 'Remove all products from this category first'}"
          style="${canDelete ? '' : 'opacity:.35;cursor:not-allowed;'}"
        ><i class="bi bi-trash"></i></button>
      </div>`;
        }).join('');
    }

    return `
  <div class="page-header">
    <div><div class="page-title">Categories</div><div class="page-subtitle">${state.categories.length} categor${state.categories.length !== 1 ? 'ies' : 'y'}</div></div>
    <button class="btn btn-primary" onclick="showAddCategory()"><i class="bi bi-plus-lg"></i> Add Category</button>
  </div>
  ${body}`;
}

// ── Main Render ───────────────────────────────────────────
function renderMain() {
    const el = document.getElementById('main-content');
    if (!el) return;

    if (state.currentTab === 'products') {
        el.innerHTML = renderProducts();
        // Wire product card buttons via data attributes
        el.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', () => editProduct(btn.dataset.id));
        });
        el.querySelectorAll('.btn-delete-product').forEach(btn => {
            btn.addEventListener('click', () => deleteProduct(btn.dataset.id));
        });
        el.querySelectorAll('.btn-quick-reorder').forEach(btn => {
            btn.addEventListener('click', () => quickReorder(btn.dataset.id));
        });
        // Wire new buttons
        el.querySelectorAll('.btn-duplicate-product').forEach(btn => {
            btn.addEventListener('click', () => duplicateProduct(btn.dataset.id));
        });
        el.querySelectorAll('.btn-stock-adj').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const isInc = e.target.classList.contains('btn-stock-inc');
                adjustStock(btn.dataset.id, isInc ? 1 : -1);
            });
        });
        const exportBtn = document.getElementById('btn-export-csv');
        if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    } else if (state.currentTab === 'analytics') {
        el.innerHTML = renderAnalytics();
        setTimeout(buildCharts, 50);
    } else if (state.currentTab === 'orders') {
        el.innerHTML = renderOrders();
        // Wire Create PO button
        const createBtn = el.querySelector('#btn-create-po');
        if (createBtn) createBtn.addEventListener('click', showCreatePO);
        // Wire all "Mark Received" buttons
        el.querySelectorAll('.po-receive-btn').forEach(btn => {
            btn.addEventListener('click', () => receivePO(btn.dataset.poId));
        });
        // Wire Delete PO buttons
        el.querySelectorAll('.btn-delete-po').forEach(btn => {
            btn.addEventListener('click', () => deletePO(btn.dataset.poId));
        });
    } else if (state.currentTab === 'categories') {
        el.innerHTML = renderCategories();
        el.querySelectorAll('.cat-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.catIdx, 10);
                const cat = state.categories[idx];
                if (cat !== undefined) deleteCategory(cat);
            });
        });
    }
}

// ── Filter Helpers ────────────────────────────────────────
function onSearch(val) { state.filters.search = val; renderMain(); }
function applyFilter(key, val) { state.filters[key] = val; showTab('products'); }
function clearFilters() { state.filters = { search: '', category: '', status: '' }; renderMain(); }

// ── Add / Edit Product ────────────────────────────────────
function showAddProduct() {
    if (state.categories.length === 0) {
        if (confirm('No categories exist yet. Add one first?')) showAddCategory();
        return;
    }
    const catOpts = state.categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    openModal('Add Product', `
    <form id="product-form" onsubmit="submitAddProduct(event)" novalidate>
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input class="form-control" name="name" required placeholder="e.g. Wireless Keyboard" />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-control" name="category" required>
          <option value="">Select category…</option>
          ${catOpts}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Current Stock *</label>
          <input class="form-control" name="stock" type="number" min="0" value="0" required />
        </div>
        <div class="form-group">
          <label class="form-label">Minimum Stock *</label>
          <input class="form-control" name="threshold" type="number" min="1" value="10" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cost Price (₹)</label>
          <input class="form-control" name="costPrice" type="number" min="0" step="0.01" value="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Selling Price (₹)</label>
          <input class="form-control" name="sellingPrice" type="number" min="0" step="0.01" value="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Supplier</label>
        <input class="form-control" name="supplier" placeholder="Supplier name (optional)" />
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:.5rem;justify-content:center;">
        <i class="bi bi-plus-lg"></i> Add Product
      </button>
    </form>`);
}

function submitAddProduct(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    const category = fd.get('category');
    if (!name) { toast('Product name is required', 'warning'); return; }
    if (!category) { toast('Please select a category', 'warning'); return; }
    const costPrice = parseFloat(fd.get('costPrice')) || 0;
    const sellingPrice = parseFloat(fd.get('sellingPrice')) || 0;
    if (sellingPrice > 0 && sellingPrice < costPrice) {
        if (!confirm('Selling price is below cost price (negative margin). Save anyway?')) return;
    }
    const threshold = parseInt(fd.get('threshold')) || 10;
    state.products.push({
        id: uid(),
        name,
        category,
        stock: parseInt(fd.get('stock')) || 0,
        threshold,
        costPrice,
        sellingPrice,
        supplier: fd.get('supplier').trim(),
        createdAt: Date.now(),
    });
    save();
    closeModal();
    renderMain();
    toast(`"${name}" added successfully!`, 'success');
}

function editProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const catOpts = state.categories.map(c => `<option value="${esc(c)}" ${c === p.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
    openModal('Edit Product', `
    <form id="edit-form" onsubmit="submitEditProduct(event,'${id}')" novalidate>
      <div class="form-group">
        <label class="form-label">Product Name *</label>
        <input class="form-control" name="name" value="${esc(p.name)}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-control" name="category" required>
          ${catOpts}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Current Stock *</label>
          <input class="form-control" name="stock" type="number" min="0" value="${p.stock}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Minimum Stock *</label>
          <input class="form-control" name="threshold" type="number" min="1" value="${p.threshold}" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cost Price (₹)</label>
          <input class="form-control" name="costPrice" type="number" min="0" step="0.01" value="${p.costPrice}" />
        </div>
        <div class="form-group">
          <label class="form-label">Selling Price (₹)</label>
          <input class="form-control" name="sellingPrice" type="number" min="0" step="0.01" value="${p.sellingPrice}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Supplier</label>
        <input class="form-control" name="supplier" value="${esc(p.supplier || '')}" />
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:.5rem;justify-content:center;">
        <i class="bi bi-check-lg"></i> Save Changes
      </button>
    </form>`);
}

function submitEditProduct(e, id) {
    e.preventDefault();
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    const category = fd.get('category');
    if (!name) { toast('Product name is required', 'warning'); return; }
    if (!category) { toast('Please select a category', 'warning'); return; }
    const costPrice = parseFloat(fd.get('costPrice')) || 0;
    const sellingPrice = parseFloat(fd.get('sellingPrice')) || 0;
    if (sellingPrice > 0 && sellingPrice < costPrice) {
        if (!confirm('Selling price is below cost price. Save anyway?')) return;
    }
    Object.assign(p, { name, category, stock: parseInt(fd.get('stock')) || 0, threshold: parseInt(fd.get('threshold')) || 10, costPrice, sellingPrice, supplier: fd.get('supplier').trim() });
    save();
    closeModal();
    renderMain();
    toast('Product updated!', 'success');
}

function deleteProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    state.products = state.products.filter(x => x.id !== id);
    save();
    renderMain();
    toast('Product deleted', 'success');
}

// ── Categories ────────────────────────────────────────────
function showAddCategory() {
    openModal('Add Category', `
    <form id="cat-form" onsubmit="submitAddCategory(event)" novalidate>
      <div class="form-group">
        <label class="form-label">Category Name *</label>
        <input class="form-control" name="category" required placeholder="e.g. Electronics" />
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;margin-top:.5rem;justify-content:center;">
        <i class="bi bi-plus-lg"></i> Add Category
      </button>
    </form>`);
}

function submitAddCategory(e) {
    e.preventDefault();
    const name = new FormData(e.target).get('category').trim();
    if (!name) { toast('Category name is required', 'warning'); return; }
    if (state.categories.includes(name)) { toast('Category already exists', 'warning'); return; }
    state.categories.push(name);
    save();
    closeModal();
    renderMain();
    toast(`Category "${name}" added!`, 'success');
}

function deleteCategory(cat) {
    const count = state.products.filter(p => p.category === cat).length;
    if (count > 0) {
        // Offer to reassign
        const otherCats = state.categories.filter(c => c !== cat);
        if (otherCats.length > 0) {
            const options = otherCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
            openModal('Cannot Delete Category', `
            <p style="margin-bottom:1rem">This category contains <strong>${count}</strong> products. You cannot delete it unless you move these products to another category.</p>
            <form id="reassign-form">
                <div class="form-group">
                    <label class="form-label">Move products to:</label>
                    <select class="form-control" name="newCat">${options}</select>
                </div>
                <button class="btn btn-primary" style="width:100%">Move Products & Delete Category</button>
            </form>
            `);
            setTimeout(() => {
                const f = document.getElementById('reassign-form');
                if (f) f.onsubmit = (e) => {
                    e.preventDefault();
                    reassignAndDeleteCategory(cat, e.target.newCat.value);
                    closeModal();
                };
            }, 50);
            return;
        }

        toast(`Cannot delete "${cat}" — ${count} product${count !== 1 ? 's' : ''} still use this category.`, 'warning', 4500);
        return;
    }
    if (!confirm(`Delete category "${cat}"? This cannot be undone.`)) return;
    state.categories = state.categories.filter(c => c !== cat);
    save();
    renderMain();
    toast(`Category "${cat}" deleted`, 'success');
}

function reassignAndDeleteCategory(oldCat, newCat) {
    state.products.forEach(p => {
        if (p.category === oldCat) p.category = newCat;
    });
    state.categories = state.categories.filter(c => c !== oldCat);
    save();
    renderMain();
    toast(`Category "${oldCat}" deleted and products moved to "${newCat}"`, 'success');
}

// ── Purchase Orders ───────────────────────────────────────
function deletePO(id) {
    if (!confirm('Delete this purchase order?')) return;
    state.purchaseOrders = state.purchaseOrders.filter(p => p.id !== id);
    save();
    renderMain();
    toast('Purchase order deleted', 'success');
}
function showCreatePO() {
    if (state.products.length === 0) {
        toast('Add products first before creating a purchase order', 'warning');
        return;
    }

    // Show ALL products — pre-check the ones that need restocking
    const itemsHTML = state.products.map(p => {
        const st = getStatus(p);
        const needsOrder = st !== 'in-stock';
        return `
        <label style="display:flex;align-items:center;gap:.75rem;padding:.5rem;border-radius:8px;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
          <input type="checkbox" name="products" value="${p.id}" ${needsOrder ? 'checked' : ''} style="width:1rem;height:1rem;accent-color:var(--primary);flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.name)}</div>
            <div style="font-size:.8rem;color:var(--muted);">Stock: ${p.stock} &middot; Suggest: ${reorderQty(p)} units</div>
          </div>
          <span class="status-pill ${st}" style="flex-shrink:0;">${STATUS_LABEL[st]}</span>
        </label>`;
    }).join('');

    openModal('Create Purchase Order', `
    <form id="po-form" novalidate>
      <div class="form-group">
        <label class="form-label">Select Products to Order *</label>
        <div style="border:1px solid var(--border);border-radius:8px;padding:.5rem;max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:.15rem;">
          ${itemsHTML}
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Expected Delivery</label>
          <input class="form-control" name="deliveryDate" type="date" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-control" name="notes" placeholder="Optional notes&hellip;" />
        </div>
      </div>
      <button type="button" id="btn-submit-po" class="btn btn-primary" style="width:100%;margin-top:.5rem;justify-content:center;">
        <i class="bi bi-receipt"></i> Create Purchase Order
      </button>
    </form>`, { wide: true });

    // Wire submit after modal is in DOM
    setTimeout(() => {
        const btn = document.getElementById('btn-submit-po');
        if (btn) btn.addEventListener('click', doCreatePO);
    }, 30);
}

function doCreatePO() {
    const form = document.getElementById('po-form');
    if (!form) return;
    const fd = new FormData(form);
    const selectedIds = fd.getAll('products');
    if (selectedIds.length === 0) { toast('Select at least one product', 'warning'); return; }

    const items = selectedIds.map(id => {
        const p = state.products.find(x => x.id === id);
        if (!p) return null;
        return { productId: id, productName: p.name, quantity: reorderQty(p), cost: p.costPrice };
    }).filter(Boolean);

    const po = {
        id: uid(),
        poNumber: 'PO-' + Date.now().toString().slice(-6),
        items,
        totalCost: items.reduce((s, i) => s + i.quantity * i.cost, 0),
        status: 'pending',
        deliveryDate: fd.get('deliveryDate') || '',
        notes: (fd.get('notes') || '').trim(),
        createdAt: Date.now(),
    };
    state.purchaseOrders.push(po);
    save();
    closeModal();
    showTab('orders');
    toast('Purchase order created!', 'success');
}

// Keep old name as alias for any remaining references
function submitCreatePO(e) { if (e) e.preventDefault(); doCreatePO(); }

function receivePO(id) {
    const po = state.purchaseOrders.find(x => x.id === id);
    if (!po || po.status === 'received') return;
    if (!confirm(`Mark ${po.poNumber} as received? This will update stock levels.`)) return;
    po.status = 'received';
    po.receivedAt = Date.now();
    po.items.forEach(item => {
        const p = state.products.find(x => x.id === item.productId);
        if (p) p.stock += item.quantity;
    });
    save();
    renderMain();
    toast('Stock updated from PO!', 'success');
}

// ── Backup / Restore ──────────────────────────────────────
function showBackup() {
    const data = { products: state.products, categories: state.categories, purchaseOrders: state.purchaseOrders, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    openModal('Backup & Restore', `
    <div class="section-card" style="margin-bottom:1rem;">
      <h4 style="margin-bottom:.5rem;font-size:.95rem;">📥 Download Backup</h4>
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:.75rem;">Save all your inventory data as a JSON file.</p>
      <a href="${url}" download="inventory-backup-${Date.now()}.json" class="btn btn-primary" style="width:100%;justify-content:center;text-decoration:none;">
        <i class="bi bi-download"></i> Download Backup
      </a>
    </div>
    <hr class="divider" />
    <div class="section-card">
      <h4 style="margin-bottom:.5rem;font-size:.95rem;">📤 Restore from Backup</h4>
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:.75rem;">This will <strong>replace all current data</strong>.</p>
      <input class="form-control" type="file" id="restore-file" accept=".json" style="margin-bottom:.75rem;" />
      <button class="btn btn-ghost" style="width:100%;justify-content:center;" onclick="doRestore()">
        <i class="bi bi-upload"></i> Restore Backup
      </button>
    </div>`);
}

function doRestore() {
    const file = document.getElementById('restore-file')?.files[0];
    if (!file) { toast('Please select a backup file', 'warning'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm('This will replace ALL current data. Continue?')) return;
            state.products = data.products || [];
            state.categories = data.categories || [];
            state.purchaseOrders = data.purchaseOrders || [];
            save();
            closeModal();
            renderMain();
            toast('Backup restored successfully!', 'success');
        } catch { toast('Invalid backup file', 'danger'); }
    };
    reader.readAsText(file);
}

// ── Quick Reorder ─────────────────────────────────────────
function quickReorder(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const qty = reorderQty(p);
    if (!confirm(`Create a purchase order for ${qty} units of "${p.name}"?`)) return;
    const po = {
        id: uid(),
        poNumber: 'PO-' + Date.now().toString().slice(-6),
        items: [{ productId: id, productName: p.name, quantity: qty, cost: p.costPrice }],
        totalCost: qty * p.costPrice,
        status: 'pending',
        deliveryDate: '',
        notes: '',
        createdAt: Date.now(),
    };
    state.purchaseOrders.push(po);
    save();
    toast('Purchase order created!', 'success');
}

// ── Sample Data ───────────────────────────────────────────
function loadSample() {
    if (state.products.length > 0 && !confirm('This will add sample data to your existing inventory. Continue?')) return;
    state.categories = [...new Set([...state.categories, ...SAMPLE.categories])];
    SAMPLE.products.forEach(p => {
        state.products.push({ id: uid(), ...p, createdAt: Date.now() });
    });
    save();
    renderMain();
    toast('Sample data loaded!', 'success');
}

// ── Logic Helpers ─────────────────────────────────────────
function adjustStock(id, amount) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    if (p.stock + amount < 0) { toast('Stock cannot be negative', 'warning'); return; }
    p.stock += amount;
    save();
    renderMain();
}

function duplicateProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const newP = { ...p, id: uid(), name: p.name + ' (Copy)', stock: 0 };
    state.products.push(newP);
    save();
    renderMain();
    toast('Product duplicated', 'success');
    editProduct(newP.id);
}

function exportCSV() {
    const headers = ['Name', 'Category', 'Stock', 'Threshold', 'Cost Price', 'Selling Price', 'Supplier', 'Status'];
    const rows = state.products.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category.replace(/"/g, '""')}"`,
        p.stock,
        p.threshold,
        p.costPrice,
        p.sellingPrice,
        `"${(p.supplier || '').replace(/"/g, '""')}"`,
        getStatus(p)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ── Boot ──────────────────────────────────────────────────
function boot() {
    // Wire up top-bar buttons
    document.getElementById('btn-add-product').addEventListener('click', showAddProduct);
    document.getElementById('btn-backup').addEventListener('click', showBackup);

    // Wire up all nav items (sidebar + mobile)
    document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
        el.addEventListener('click', () => showTab(el.dataset.tab));
    });

    // First render
    renderMain();

    // Welcome toast on first visit
    if (!localStorage.getItem('inv_visited')) {
        localStorage.setItem('inv_visited', '1');
        setTimeout(() => toast('Welcome! Click "Load Sample Data" to get started.', 'info', 4000), 600);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
