"use strict";
/* =========================================================
   STORAGE
   ========================================================= */
const STORAGE_KEYS = {
    loans: 'ledger_homenet_loans_v1',
    invoices: 'ledger_mobile_invoices_v1',
    shop: 'ledger_shop_info_v1',
};
function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return fallback;
        return JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}
function makeId() {
    if ('randomUUID' in crypto)
        return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}
function todayISO() {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
}
function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function formatAmount(n) {
    return n.toLocaleString('en-US') + ' IQD';
}
function formatDate(iso) {
    if (!iso)
        return '—';
    const [y, m, d] = iso.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mi = parseInt(m, 10) - 1;
    return `${d} ${months[mi] ?? m} ${y}`;
}
/* =========================================================
   STATE
   ========================================================= */
let loans = loadJSON(STORAGE_KEYS.loans, []);
let invoices = loadJSON(STORAGE_KEYS.invoices, []);
let shopInfo = loadJSON(STORAGE_KEYS.shop, {
    name: 'Ledger Mobile & Home Net',
    phone: '',
    address: '',
});
let hnFilter = 'all';
let hnSearch = '';
let mbFilter = 'all';
let mbSearch = '';
function persistLoans() { saveJSON(STORAGE_KEYS.loans, loans); }
function persistInvoices() { saveJSON(STORAGE_KEYS.invoices, invoices); }
function persistShop() { saveJSON(STORAGE_KEYS.shop, shopInfo); }
/* =========================================================
   SEED DATA (first run only)
   ========================================================= */
function seedIfEmpty() {
    if (loans.length === 0 && invoices.length === 0 && !localStorage.getItem('ledger_seeded_v1')) {
        const t = todayISO();
        loans = [
            { id: makeId(), customerName: 'Karwan Ahmed', customerPhone: '0770 111 2233', cardType: '30-day 20GB', cardCode: 'HN-2291', amount: 15000, date: t, dueDate: '', returned: false, notes: 'Regular, pays every Friday', createdAt: Date.now() - 86400000 * 20 },
            { id: makeId(), customerName: 'Karwan Ahmed', customerPhone: '0770 111 2233', cardType: '30-day 20GB', cardCode: 'HN-2318', amount: 15000, date: t, dueDate: '', returned: true, notes: '', createdAt: Date.now() - 86400000 * 12 },
            { id: makeId(), customerName: 'Rezan Salih', customerPhone: '0750 998 4471', cardType: '7-day 10GB', cardCode: 'HN-2400', amount: 7000, date: t, dueDate: '', returned: false, notes: '', createdAt: Date.now() - 86400000 * 2 },
        ];
        invoices = [
            { id: makeId(), customerName: 'Sara Hussein', customerPhone: '0771 223 9988', deviceModel: 'iPhone 13', imei: '', serviceType: 'Repair', issue: 'Cracked screen', price: 85000, date: t, status: 'in-progress', notes: '', createdAt: Date.now() - 86400000 * 3 },
        ];
        persistLoans();
        persistInvoices();
        localStorage.setItem('ledger_seeded_v1', '1');
    }
}
/* =========================================================
   DOM HELPERS
   ========================================================= */
function $(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error('Missing element #' + id);
    return el;
}
/* =========================================================
   CLOCK
   ========================================================= */
function tickClock() {
    const el = $('liveClock');
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    el.textContent = `${dateStr} · ${timeStr}`;
}
/* =========================================================
   STATS
   ========================================================= */
function renderStats() {
    const outstanding = loans.filter(l => !l.returned);
    const outstandingTotal = outstanding.reduce((s, l) => s + l.amount, 0);
    const totalLent = loans.reduce((s, l) => s + l.amount, 0);
    $('statHomenetOutstanding').textContent = formatAmount(outstandingTotal);
    $('statHomenetOutstandingCount').textContent = `${outstanding.length} card${outstanding.length === 1 ? '' : 's'} not returned`;
    $('statHomenetTotal').textContent = formatAmount(totalLent);
    $('statHomenetCount').textContent = `${loans.length} loan${loans.length === 1 ? '' : 's'} on record`;
    const openJobs = invoices.filter(i => i.status === 'pending' || i.status === 'in-progress');
    const revenue = invoices.reduce((s, i) => s + i.price, 0);
    $('statMobileOpen').textContent = String(openJobs.length);
    $('statMobileOpenSub').textContent = 'jobs pending or in progress';
    $('statMobileRevenue').textContent = formatAmount(revenue);
    $('statMobileCount').textContent = `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`;
}
/* =========================================================
   HOME NET — RENDER
   ========================================================= */
function renderHomeNet() {
    const list = $('hnList');
    const empty = $('hnEmpty');
    let items = loans.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (hnFilter === 'borrowed')
        items = items.filter(l => !l.returned);
    if (hnFilter === 'returned')
        items = items.filter(l => l.returned);
    if (hnSearch.trim()) {
        const q = hnSearch.trim().toLowerCase();
        items = items.filter(l => l.customerName.toLowerCase().includes(q) ||
            l.customerPhone.toLowerCase().includes(q) ||
            l.cardType.toLowerCase().includes(q) ||
            l.cardCode.toLowerCase().includes(q));
    }
    empty.hidden = items.length > 0;
    list.innerHTML = items.map(loan => {
        const badge = loan.returned
            ? `<span class="badge badge--returned">Returned</span>`
            : `<span class="badge badge--owed">Owed</span>`;
        const meta = [
            escapeHtml(loan.cardType),
            formatDate(loan.date),
        ];
        if (loan.customerPhone)
            meta.push(escapeHtml(loan.customerPhone));
        if (loan.dueDate)
            meta.push('due ' + formatDate(loan.dueDate));
        if (loan.cardCode)
            meta.push('#' + escapeHtml(loan.cardCode));
        return `
      <li class="entry ${loan.returned ? 'entry--returned' : ''}" data-id="${loan.id}">
        <div class="entry__main">
          <span class="entry__name">${escapeHtml(loan.customerName)}</span>
          <span class="entry__meta">${meta.map(m => `<span>${m}</span>`).join('')}</span>
          ${loan.notes ? `<span class="entry__notes">${escapeHtml(loan.notes)}</span>` : ''}
        </div>
        <div>
          <div class="entry__amount">${formatAmount(loan.amount)}</div>
          <div class="entry__badges">${badge}</div>
        </div>
        <div class="entry__actions">
          <button data-action="toggle-return" data-id="${loan.id}">${loan.returned ? 'Mark not returned' : 'Mark returned'}</button>
          <button data-action="edit-loan" data-id="${loan.id}">Edit</button>
          <button data-action="print-loan" data-id="${loan.id}">Print receipt</button>
          <button data-action="delete-loan" data-id="${loan.id}" class="btn--danger-text">Delete</button>
        </div>
      </li>`;
    }).join('');
}
function computeRegulars() {
    const map = new Map();
    for (const l of loans) {
        const key = (l.customerName.trim().toLowerCase()) + '|' + l.customerPhone.trim();
        let agg = map.get(key);
        if (!agg) {
            agg = { key, name: l.customerName, phone: l.customerPhone, count: 0, outstanding: 0, lastDate: l.date };
            map.set(key, agg);
        }
        agg.count += 1;
        if (!l.returned)
            agg.outstanding += 1;
        if (l.date > agg.lastDate)
            agg.lastDate = l.date;
    }
    return Array.from(map.values())
        .filter(a => a.count >= 2)
        .sort((a, b) => b.count - a.count);
}
function renderRegulars() {
    const regulars = computeRegulars();
    const list = $('regularsList');
    const empty = $('regularsEmpty');
    empty.hidden = regulars.length > 0;
    list.innerHTML = regulars.map((r, i) => `
    <li class="regular">
      <span class="regular__rank">${i + 1}</span>
      <div class="regular__info">
        <div class="regular__name">${escapeHtml(r.name)}</div>
        <div class="regular__meta">${r.phone ? escapeHtml(r.phone) + ' · ' : ''}last card ${formatDate(r.lastDate)}${r.outstanding > 0 ? ` · ${r.outstanding} not returned` : ''}</div>
      </div>
      <span class="regular__count">${r.count}× borrowed</span>
    </li>
  `).join('');
}
/* =========================================================
   MOBILE — RENDER
   ========================================================= */
const STATUS_LABEL = {
    'pending': 'Pending',
    'in-progress': 'In progress',
    'completed': 'Completed',
    'delivered': 'Delivered',
};
const STATUS_BADGE_CLASS = {
    'pending': 'badge--pending',
    'in-progress': 'badge--progress',
    'completed': 'badge--completed',
    'delivered': 'badge--delivered',
};
function renderMobile() {
    const list = $('mbList');
    const empty = $('mbEmpty');
    let items = invoices.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (mbFilter !== 'all')
        items = items.filter(i => i.status === mbFilter);
    if (mbSearch.trim()) {
        const q = mbSearch.trim().toLowerCase();
        items = items.filter(i => i.customerName.toLowerCase().includes(q) ||
            i.customerPhone.toLowerCase().includes(q) ||
            i.deviceModel.toLowerCase().includes(q) ||
            i.imei.toLowerCase().includes(q));
    }
    empty.hidden = items.length > 0;
    list.innerHTML = items.map(inv => {
        const meta = [
            escapeHtml(inv.deviceModel),
            escapeHtml(inv.serviceType),
            formatDate(inv.date),
        ];
        if (inv.customerPhone)
            meta.push(escapeHtml(inv.customerPhone));
        if (inv.imei)
            meta.push('IMEI ' + escapeHtml(inv.imei));
        return `
      <li class="entry" data-id="${inv.id}">
        <div class="entry__main">
          <span class="entry__name">${escapeHtml(inv.customerName)}</span>
          <span class="entry__meta">${meta.map(m => `<span>${m}</span>`).join('')}</span>
          ${inv.issue ? `<span class="entry__notes">${escapeHtml(inv.issue)}</span>` : ''}
        </div>
        <div>
          <div class="entry__amount">${formatAmount(inv.price)}</div>
          <div class="entry__badges"><span class="badge ${STATUS_BADGE_CLASS[inv.status]}">${STATUS_LABEL[inv.status]}</span></div>
        </div>
        <div class="entry__actions">
          <button data-action="cycle-status" data-id="${inv.id}">Advance status</button>
          <button data-action="edit-invoice" data-id="${inv.id}">Edit</button>
          <button data-action="print-invoice" data-id="${inv.id}">Print receipt</button>
          <button data-action="delete-invoice" data-id="${inv.id}" class="btn--danger-text">Delete</button>
        </div>
      </li>`;
    }).join('');
}
const STATUS_ORDER = ['pending', 'in-progress', 'completed', 'delivered'];
/* =========================================================
   FULL RENDER
   ========================================================= */
function renderAll() {
    renderStats();
    renderHomeNet();
    renderRegulars();
    renderMobile();
}
/* =========================================================
   HOME NET — FORM
   ========================================================= */
const hnForm = $('homenetForm');
const hnEditId = $('hnEditId');
const hnCustomerName = $('hnCustomerName');
const hnCustomerPhone = $('hnCustomerPhone');
const hnCardType = $('hnCardType');
const hnCardCode = $('hnCardCode');
const hnAmount = $('hnAmount');
const hnDate = $('hnDate');
const hnDueDate = $('hnDueDate');
const hnNotes = $('hnNotes');
const hnSubmitBtn = $('hnSubmitBtn');
const hnCancelEditBtn = $('hnCancelEditBtn');
function resetHomeNetForm() {
    hnForm.reset();
    hnEditId.value = '';
    hnDate.value = todayISO(); // auto-fill today; user can still edit it
    hnSubmitBtn.textContent = 'Add loan';
    hnCancelEditBtn.hidden = true;
}
function loadLoanIntoForm(loan) {
    hnEditId.value = loan.id;
    hnCustomerName.value = loan.customerName;
    hnCustomerPhone.value = loan.customerPhone;
    hnCardType.value = loan.cardType;
    hnCardCode.value = loan.cardCode;
    hnAmount.value = String(loan.amount);
    hnDate.value = loan.date;
    hnDueDate.value = loan.dueDate;
    hnNotes.value = loan.notes;
    hnSubmitBtn.textContent = 'Save changes';
    hnCancelEditBtn.hidden = false;
    hnForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
hnForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!hnCustomerName.value.trim() || !hnCardType.value.trim() || !hnAmount.value)
        return;
    const editId = hnEditId.value;
    if (editId) {
        const loan = loans.find(l => l.id === editId);
        if (loan) {
            loan.customerName = hnCustomerName.value.trim();
            loan.customerPhone = hnCustomerPhone.value.trim();
            loan.cardType = hnCardType.value.trim();
            loan.cardCode = hnCardCode.value.trim();
            loan.amount = Number(hnAmount.value) || 0;
            loan.date = hnDate.value || todayISO();
            loan.dueDate = hnDueDate.value;
            loan.notes = hnNotes.value.trim();
        }
    }
    else {
        loans.push({
            id: makeId(),
            customerName: hnCustomerName.value.trim(),
            customerPhone: hnCustomerPhone.value.trim(),
            cardType: hnCardType.value.trim(),
            cardCode: hnCardCode.value.trim(),
            amount: Number(hnAmount.value) || 0,
            date: hnDate.value || todayISO(),
            dueDate: hnDueDate.value,
            returned: false,
            notes: hnNotes.value.trim(),
            createdAt: Date.now(),
        });
    }
    persistLoans();
    resetHomeNetForm();
    renderAll();
});
$('hnTodayBtn').addEventListener('click', () => { hnDate.value = todayISO(); });
hnCancelEditBtn.addEventListener('click', resetHomeNetForm);
$('hnList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn)
        return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const loan = loans.find(l => l.id === id);
    if (!loan)
        return;
    if (action === 'toggle-return') {
        loan.returned = !loan.returned;
        persistLoans();
        renderAll();
    }
    else if (action === 'edit-loan') {
        loadLoanIntoForm(loan);
    }
    else if (action === 'delete-loan') {
        if (confirm(`Delete this loan for ${loan.customerName}?`)) {
            loans = loans.filter(l => l.id !== id);
            persistLoans();
            renderAll();
        }
    }
    else if (action === 'print-loan') {
        openLoanReceipt(loan);
    }
});
$('hnSearch').addEventListener('input', (e) => {
    hnSearch = e.target.value;
    renderHomeNet();
});
$('hnFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn)
        return;
    hnFilter = btn.dataset.filter;
    $('hnFilters').querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderHomeNet();
});
/* =========================================================
   MOBILE — FORM
   ========================================================= */
const mbForm = $('mobileForm');
const mbEditId = $('mbEditId');
const mbCustomerName = $('mbCustomerName');
const mbCustomerPhone = $('mbCustomerPhone');
const mbDeviceModel = $('mbDeviceModel');
const mbImei = $('mbImei');
const mbServiceType = $('mbServiceType');
const mbPrice = $('mbPrice');
const mbDate = $('mbDate');
const mbStatus = $('mbStatus');
const mbIssue = $('mbIssue');
const mbSubmitBtn = $('mbSubmitBtn');
const mbCancelEditBtn = $('mbCancelEditBtn');
function resetMobileForm() {
    mbForm.reset();
    mbEditId.value = '';
    mbDate.value = todayISO();
    mbStatus.value = 'pending';
    mbSubmitBtn.textContent = 'Add invoice';
    mbCancelEditBtn.hidden = true;
}
function loadInvoiceIntoForm(inv) {
    mbEditId.value = inv.id;
    mbCustomerName.value = inv.customerName;
    mbCustomerPhone.value = inv.customerPhone;
    mbDeviceModel.value = inv.deviceModel;
    mbImei.value = inv.imei;
    mbServiceType.value = inv.serviceType;
    mbPrice.value = String(inv.price);
    mbDate.value = inv.date;
    mbStatus.value = inv.status;
    mbIssue.value = inv.issue;
    mbSubmitBtn.textContent = 'Save changes';
    mbCancelEditBtn.hidden = false;
    mbForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
mbForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!mbCustomerName.value.trim() || !mbDeviceModel.value.trim() || !mbPrice.value)
        return;
    const editId = mbEditId.value;
    if (editId) {
        const inv = invoices.find(i => i.id === editId);
        if (inv) {
            inv.customerName = mbCustomerName.value.trim();
            inv.customerPhone = mbCustomerPhone.value.trim();
            inv.deviceModel = mbDeviceModel.value.trim();
            inv.imei = mbImei.value.trim();
            inv.serviceType = mbServiceType.value;
            inv.price = Number(mbPrice.value) || 0;
            inv.date = mbDate.value || todayISO();
            inv.status = mbStatus.value;
            inv.issue = mbIssue.value.trim();
        }
    }
    else {
        invoices.push({
            id: makeId(),
            customerName: mbCustomerName.value.trim(),
            customerPhone: mbCustomerPhone.value.trim(),
            deviceModel: mbDeviceModel.value.trim(),
            imei: mbImei.value.trim(),
            serviceType: mbServiceType.value,
            price: Number(mbPrice.value) || 0,
            date: mbDate.value || todayISO(),
            status: mbStatus.value,
            issue: mbIssue.value.trim(),
            notes: '',
            createdAt: Date.now(),
        });
    }
    persistInvoices();
    resetMobileForm();
    renderAll();
});
$('mbTodayBtn').addEventListener('click', () => { mbDate.value = todayISO(); });
mbCancelEditBtn.addEventListener('click', resetMobileForm);
$('mbList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn)
        return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const inv = invoices.find(i => i.id === id);
    if (!inv)
        return;
    if (action === 'cycle-status') {
        const idx = STATUS_ORDER.indexOf(inv.status);
        inv.status = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
        persistInvoices();
        renderAll();
    }
    else if (action === 'edit-invoice') {
        loadInvoiceIntoForm(inv);
    }
    else if (action === 'delete-invoice') {
        if (confirm(`Delete this invoice for ${inv.customerName}?`)) {
            invoices = invoices.filter(i => i.id !== id);
            persistInvoices();
            renderAll();
        }
    }
    else if (action === 'print-invoice') {
        openInvoiceReceipt(inv);
    }
});
$('mbSearch').addEventListener('input', (e) => {
    mbSearch = e.target.value;
    renderMobile();
});
$('mbFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-filter]');
    if (!btn)
        return;
    mbFilter = btn.dataset.filter;
    $('mbFilters').querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
    btn.classList.add('is-active');
    renderMobile();
});
/* =========================================================
   RECEIPTS
   ========================================================= */
const receiptBackdrop = $('receiptBackdrop');
const receiptContent = $('receiptContent');
function receiptShopHeader() {
    return `
    <h4>${escapeHtml(shopInfo.name)}</h4>
    <div class="receipt__shop-meta">
      ${shopInfo.address ? escapeHtml(shopInfo.address) + '<br>' : ''}
      ${shopInfo.phone ? escapeHtml(shopInfo.phone) : ''}
    </div>
    <hr>`;
}
function openLoanReceipt(loan) {
    receiptContent.innerHTML = `
    ${receiptShopHeader()}
    <table>
      <tr><td>Receipt</td><td>Home Net card loan</td></tr>
      <tr><td>Date</td><td>${formatDate(loan.date)}</td></tr>
      <tr><td>Customer</td><td>${escapeHtml(loan.customerName)}</td></tr>
      ${loan.customerPhone ? `<tr><td>Phone</td><td>${escapeHtml(loan.customerPhone)}</td></tr>` : ''}
      <tr><td>Card</td><td>${escapeHtml(loan.cardType)}</td></tr>
      ${loan.cardCode ? `<tr><td>Code</td><td>${escapeHtml(loan.cardCode)}</td></tr>` : ''}
      ${loan.dueDate ? `<tr><td>Due</td><td>${formatDate(loan.dueDate)}</td></tr>` : ''}
      <tr><td>Status</td><td>${loan.returned ? 'Returned / paid' : 'Owed'}</td></tr>
    </table>
    <div class="receipt__total">
      <table><tr><td>Amount</td><td>${formatAmount(loan.amount)}</td></tr></table>
    </div>
    <hr>
    <div class="receipt__foot">Thank you — please keep this receipt.</div>
  `;
    receiptBackdrop.hidden = false;
}
function openInvoiceReceipt(inv) {
    receiptContent.innerHTML = `
    ${receiptShopHeader()}
    <table>
      <tr><td>Receipt</td><td>Mobile service invoice</td></tr>
      <tr><td>Date</td><td>${formatDate(inv.date)}</td></tr>
      <tr><td>Customer</td><td>${escapeHtml(inv.customerName)}</td></tr>
      ${inv.customerPhone ? `<tr><td>Phone</td><td>${escapeHtml(inv.customerPhone)}</td></tr>` : ''}
      <tr><td>Device</td><td>${escapeHtml(inv.deviceModel)}</td></tr>
      ${inv.imei ? `<tr><td>IMEI</td><td>${escapeHtml(inv.imei)}</td></tr>` : ''}
      <tr><td>Service</td><td>${escapeHtml(inv.serviceType)}</td></tr>
      ${inv.issue ? `<tr><td>Issue</td><td>${escapeHtml(inv.issue)}</td></tr>` : ''}
      <tr><td>Status</td><td>${STATUS_LABEL[inv.status]}</td></tr>
    </table>
    <div class="receipt__total">
      <table><tr><td>Total</td><td>${formatAmount(inv.price)}</td></tr></table>
    </div>
    <hr>
    <div class="receipt__foot">Thank you — please keep this receipt.</div>
  `;
    receiptBackdrop.hidden = false;
}
$('receiptCloseBtn').addEventListener('click', () => { receiptBackdrop.hidden = true; });
$('receiptPrintBtn').addEventListener('click', () => { window.print(); });
receiptBackdrop.addEventListener('click', (e) => {
    if (e.target === receiptBackdrop)
        receiptBackdrop.hidden = true;
});
/* =========================================================
   SHOP SETTINGS
   ========================================================= */
const settingsBackdrop = $('settingsBackdrop');
const settingsShopName = $('settingsShopName');
const settingsShopPhone = $('settingsShopPhone');
const settingsShopAddress = $('settingsShopAddress');
$('openSettingsBtn').addEventListener('click', () => {
    settingsShopName.value = shopInfo.name;
    settingsShopPhone.value = shopInfo.phone;
    settingsShopAddress.value = shopInfo.address;
    settingsBackdrop.hidden = false;
});
$('settingsCancelBtn').addEventListener('click', () => { settingsBackdrop.hidden = true; });
$('settingsSaveBtn').addEventListener('click', () => {
    shopInfo = {
        name: settingsShopName.value.trim() || 'Ledger Mobile & Home Net',
        phone: settingsShopPhone.value.trim(),
        address: settingsShopAddress.value.trim(),
    };
    persistShop();
    $('shopNameDisplay').textContent = shopInfo.name;
    settingsBackdrop.hidden = true;
});
settingsBackdrop.addEventListener('click', (e) => {
    if (e.target === settingsBackdrop)
        settingsBackdrop.hidden = true;
});
/* =========================================================
   INIT
   ========================================================= */
function init() {
    seedIfEmpty();
    $('shopNameDisplay').textContent = shopInfo.name;
    resetHomeNetForm();
    resetMobileForm();
    tickClock();
    setInterval(tickClock, 30000);
    renderAll();
}
document.addEventListener('DOMContentLoaded', init);
