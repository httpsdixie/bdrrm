// ═══════════════════════════════════════════════════════
//  Resource Tracking — COA Property Management
//  Barangay Linao BDRRMC
// ═══════════════════════════════════════════════════════

'use strict';

// ── State ──────────────────────────────────────────────
let allResources      = [];
let allResourceLogs   = [];
let resourceLogsLoaded = false;
let editingId         = null;
let detailId          = null;   // currently open detail modal
let pendingStatus     = null;   // status being applied in status modal

const RESPONSIBILITY_CENTER = 'Linao BDRRMC';

// ── Pagination ─────────────────────────────────────────
let pg = { currentPage: 1, pageSize: 10, filtered: [] };

// ── Helpers ────────────────────────────────────────────

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtMoney(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso; }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return iso; }
}

const STATUS_CONFIG = {
  available:   { label: 'Available',          badgeClass: 'badge-available',   icon: 'check-circle-2',  color: '#4ade80' },
  maintenance: { label: 'Maintenance',         badgeClass: 'badge-maintenance', icon: 'wrench',          color: '#38bdf8' },
  damaged:     { label: 'Damaged / For Repair',badgeClass: 'badge-damaged',     icon: 'alert-triangle',  color: '#f87171' },
  borrowed:    { label: 'Borrowed',            badgeClass: 'badge-borrowed',    icon: 'arrow-right-left',color: '#fb923c' },
};

function statusBadge(status) {
  const cfg = STATUS_CONFIG[status] || { label: status, badgeClass: 'badge', icon: 'circle', color: 'var(--text-muted)' };
  return `<span class="badge ${cfg.badgeClass}" style="display:inline-flex;align-items:center;gap:.3rem;">
    <i data-lucide="${cfg.icon}" style="width:12px;height:12px;"></i> ${cfg.label}
  </span>`;
}

// ── Load & Render ───────────────────────────────────────

async function loadResources() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');

  // Skeleton
  const tbody = document.getElementById('resources-tbody');
  if (tbody) {
    tbody.innerHTML = Array(3).fill(`<tr>${Array(10).fill('<td><span class="skeleton skeleton-text" style="width:80%;"></span></td>').join('')}</tr>`).join('');
  }

  try {
    allResources = await apiFetch('/resources/');
  } catch (err) {
    allResources = [];
    console.warn('loadResources:', err);
  }

  renderSummary();
  filterResources();
  if (document.getElementById('pane-logs')?.style.display !== 'none') {
    loadResourceLogs();
  }
  if (btn) btn.classList.remove('spinning');
}

function renderSummary() {
  const counts = { total: allResources.length, available: 0, maintenance: 0, damaged: 0, borrowed: 0 };
  for (const r of allResources) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  }
  document.getElementById('sum-total').textContent       = counts.total;
  document.getElementById('sum-available').textContent   = counts.available;
  document.getElementById('sum-maintenance').textContent = counts.maintenance;
  document.getElementById('sum-damaged').textContent     = counts.damaged;
  document.getElementById('sum-borrowed').textContent    = counts.borrowed;
  if (window.lucide) lucide.createIcons();
}

function switchResourceTab(tab) {
  const assetsPane = document.getElementById('pane-assets');
  const logsPane = document.getElementById('pane-logs');
  const tabAssets = document.getElementById('tab-assets');
  const tabLogs = document.getElementById('tab-logs');

  if (assetsPane) assetsPane.style.display = tab === 'assets' ? 'block' : 'none';
  if (logsPane) logsPane.style.display = tab === 'logs' ? 'block' : 'none';

  if (tabAssets) tabAssets.classList.toggle('active', tab === 'assets');
  if (tabLogs) tabLogs.classList.toggle('active', tab === 'logs');

  if (tab === 'logs') {
    loadResourceLogs();
  }
}

async function loadResourceLogs() {
  const tbody = document.getElementById('resource-logs-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading activity logs…</td></tr>';
  }

  try {
    allResourceLogs = await apiFetch('/resources/logs');
    resourceLogsLoaded = true;
    filterResourceLogs();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Unable to load activity logs. Please refresh or try again later.</td></tr>`;
    }
    console.warn('loadResourceLogs:', err);
  }
}

function filterResourceLogs() {
  const search = (document.getElementById('res-log-search')?.value || '').toLowerCase().trim();
  const filtered = allResourceLogs.filter(log => {
    return !search || [
      log.resource_name,
      log.event_type,
      log.description,
      log.performed_by_name,
      log.old_status,
      log.new_status,
    ].filter(Boolean).join(' ').toLowerCase().includes(search);
  });
  renderResourceLogsTable(filtered);
}

function renderResourceLogsTable(data) {
  const tbody = document.getElementById('resource-logs-tbody');
  if (!tbody) return;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No activity logs match the current search.</td></tr>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(log => {
    const eventLabel = {
      added: 'Added',
      updated: 'Updated',
      status_changed: 'Status Changed',
      archived: 'Removed',
    }[log.event_type] || log.event_type;
    const statusDetail = log.event_type === 'status_changed'
      ? `<span style="display:block;font-size:.82rem;color:var(--text-muted);">${log.old_status || '—'} → ${log.new_status || '—'}</span>`
      : '';

    return `
      <tr onclick="openResourceLogDetailModal('${log.id}')" style="cursor:pointer;" title="Click to view full activity log record">
        <td>${fmtDateTime(log.created_at)}</td>
        <td>${escHtml(log.resource_name || '—')}</td>
        <td style="white-space:nowrap;">
          <strong>${escHtml(eventLabel)}</strong>
          ${statusDetail}
        </td>
        <td>${escHtml(log.description || '—')}</td>
        <td>${escHtml(log.performed_by_name || 'System')}</td>
      </tr>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openResourceLogDetailModal(id) {
  const log = allResourceLogs.find(l => String(l.id) === String(id));
  if (!log) return;

  const modalBody = document.getElementById('res-log-modal-body');
  if (!modalBody) return;

  const dt = log.created_at
    ? new Date(log.created_at).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : '—';

  const eventLabel = {
    added: 'Added',
    updated: 'Updated',
    status_changed: 'Status Changed',
    archived: 'Removed',
  }[log.event_type] || log.event_type;

  let eventBadge = `<span class="badge badge-blue">${escHtml(eventLabel)}</span>`;
  if (log.event_type === 'added') eventBadge = `<span class="badge badge-purple" style="background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#c084fc;">${escHtml(eventLabel)}</span>`;
  else if (log.event_type === 'status_changed') eventBadge = `<span class="badge badge-amber">${escHtml(eventLabel)}</span>`;
  else if (log.event_type === 'updated') eventBadge = `<span class="badge badge-green">${escHtml(eventLabel)}</span>`;

  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.2rem;">
      <div style="padding:1rem;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">RESOURCE OPERATION</div>
        <div style="font-size:1.15rem;font-weight:800;color:var(--text-main);">${escHtml(log.resource_name || '—')}</div>
        <div style="font-size:.8rem;color:#60a5fa;margin-top:.25rem;font-weight:600;"><i data-lucide="shield-check" style="width:13px;height:13px;vertical-align:middle;"></i> DRRM Lifecycle Audit Record</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">EVENT ACTION</div>
          <div>${eventBadge}</div>
        </div>

        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">AUDIT STATUS</div>
          <div><span class="badge badge-blue">Recorded Log</span></div>
        </div>
      </div>

      <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">AUDIT DESCRIPTION & NOTES</div>
        <div style="font-size:.85rem;color:var(--text-main);line-height:1.5;">${escHtml(log.description || 'No additional details logged.')}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.78rem;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.08);padding-top:.85rem;">
        <div><strong style="color:var(--text-main);">Logged By:</strong> ${escHtml(log.performed_by_name || 'BDRRMC Admin')}</div>
        <div style="text-align:right;"><strong style="color:var(--text-main);">Timestamp:</strong> ${escHtml(dt)}</div>
      </div>
    </div>
  `;

  document.getElementById('res-log-detail-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeResourceLogDetailModal() {
  document.getElementById('res-log-detail-modal-overlay')?.classList.remove('active');
}

function closeResourceLogDetailModalOutside(event) {
  if (event.target.id === 'res-log-detail-modal-overlay') closeResourceLogDetailModal();
}

function quickFilter(status) {
  const sel = document.getElementById('res-filter-status');
  if (sel) sel.value = status;
  filterResources();
}

function filterResources() {
  const search = (document.getElementById('res-search')?.value || '').toLowerCase().trim();
  const status = document.getElementById('res-filter-status')?.value || '';

  pg.filtered = allResources.filter(r => {
    if (status && r.status !== status) return false;
    if (search) {
      const hay = [r.property_code, r.name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const hasFilter = search || status;
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) clearBtn.style.display = hasFilter ? 'inline-flex' : 'none';

  pg.currentPage = 1;
  renderPaginated();
}

function clearFilters() {
  const s = document.getElementById('res-search'); if (s) s.value = '';
  const f = document.getElementById('res-filter-status'); if (f) f.value = '';
  filterResources();
}

function renderPaginated() {
  const total     = pg.filtered.length;
  const totalPages = Math.ceil(total / pg.pageSize) || 1;
  if (pg.currentPage > totalPages) pg.currentPage = totalPages;
  if (pg.currentPage < 1) pg.currentPage = 1;

  const start = (pg.currentPage - 1) * pg.pageSize;
  const end   = Math.min(start + pg.pageSize, total);

  renderTable(pg.filtered.slice(start, end));
  renderPaginationBar(total, start + 1, end, pg.currentPage, totalPages);
}

function renderTable(data) {
  const tbody   = document.getElementById('resources-tbody');
  const user    = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No assets found matching the current filters.</td></tr>`;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr onclick="openDetailModal('${r.id}')" title="Click to view COA details / update status">
      <td class="mono">${escHtml(r.property_code || '—')}</td>
      <td>
        <div style="font-weight:600;color:var(--text-main);font-size:.85rem;">${escHtml(r.name || '—')}</div>
        ${r.status_notes ? `<div style="font-size:.7rem;color:#fb923c;margin-top:.1rem;font-style:italic;">${escHtml(r.status_notes)}</div>` : ''}
      </td>
      <td style="text-align:center;font-size:.82rem;color:var(--text-muted);">${r.estimated_life ? r.estimated_life + ' yr' : '—'}</td>
      <td><span class="rc-pill"><i data-lucide="building-2" style="width:11px;height:11px;"></i> ${escHtml(RESPONSIBILITY_CENTER)}</span></td>
      <td>${statusBadge(r.status)}</td>
      <td style="text-align:right;" onclick="event.stopPropagation()">
        ${canEdit ? `<div class="table-actions" style="justify-content:flex-end;">
          <button class="action-btn action-btn-primary" title="Edit" onclick="openEditModalById('${r.id}')"><i data-lucide="pencil"></i></button>
        </div>` : '—'}
      </td>
    </tr>`).join('');

  lucide.createIcons();
}

function renderPaginationBar(total, startD, endD, cur, totalPages) {
  const info = document.getElementById('res-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${startD} to ${endD} of ${total} entries`;

  const prev = document.getElementById('res-btn-prev');
  const next = document.getElementById('res-btn-next');
  if (prev) prev.disabled = cur <= 1;
  if (next) next.disabled = cur >= totalPages;

  const nums = document.getElementById('res-page-numbers');
  if (nums) {
    let h = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - cur) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && cur > 4) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        else if (p === totalPages - 1 && cur < totalPages - 3) h += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        continue;
      }
      h += `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
    }
    nums.innerHTML = h;
  }

  const pagEl = document.getElementById('res-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';
  if (window.lucide) lucide.createIcons();
}

function changePageSize(val) { pg.pageSize = parseInt(val); pg.currentPage = 1; renderPaginated(); }
function prevPage()          { if (pg.currentPage > 1) { pg.currentPage--; renderPaginated(); } }
function nextPage()          { const t = Math.ceil(pg.filtered.length / pg.pageSize) || 1; if (pg.currentPage < t) { pg.currentPage++; renderPaginated(); } }
function goToPage(p)         { pg.currentPage = p; renderPaginated(); }


// ── Asset Wizard Step Control ──────────────────────────────
let currentAssetWizardStep = 1;

function goToAssetWizardStep(step) {
  currentAssetWizardStep = step;
  const pane1 = document.getElementById('asset-pane-1');
  const pane2 = document.getElementById('asset-pane-2');

  const ind1 = document.getElementById('asset-wizard-indicator-1');
  const ind2 = document.getElementById('asset-wizard-indicator-2');
  const line1 = document.getElementById('asset-wizard-line-1');

  const btnPrev = document.getElementById('asset-btn-prev');
  const btnNext = document.getElementById('asset-btn-next');
  const btnSubmit = document.getElementById('asset-submit-btn');

  if (step === 1) {
    if (pane1) pane1.classList.add('active');
    if (pane2) pane2.classList.remove('active');

    if (ind1) { ind1.classList.add('active'); ind1.classList.remove('completed'); }
    if (ind2) { ind2.classList.remove('active', 'completed'); }
    if (line1) line1.classList.remove('active');

    if (btnPrev) btnPrev.style.visibility = 'hidden';
    if (btnNext) btnNext.style.display = 'inline-flex';
    if (btnSubmit) btnSubmit.style.display = 'none';
  } else {
    // Validate Step 1 first
    const name = (document.getElementById('a-name')?.value || '').trim();
    if (!name && step === 2) {
      const errEl = document.getElementById('asset-error');
      if (errEl) {
        errEl.textContent = 'Please fill out the Resource Description before proceeding.';
        errEl.style.display = 'block';
      }
      document.getElementById('a-name')?.focus();
      return;
    } else {
      const errEl = document.getElementById('asset-error');
      if (errEl) errEl.style.display = 'none';
    }

    if (pane1) pane1.classList.remove('active');
    if (pane2) pane2.classList.add('active');

    if (ind1) { ind1.classList.remove('active'); ind1.classList.add('completed'); }
    if (ind2) { ind2.classList.add('active'); }
    if (line1) line1.classList.add('active');

    if (btnPrev) btnPrev.style.visibility = 'visible';
    if (btnNext) btnNext.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'inline-flex';

    updateAssetCardPreview();
  }
  if (window.lucide) lucide.createIcons();
}

function nextAssetWizardStep() {
  if (currentAssetWizardStep < 2) goToAssetWizardStep(currentAssetWizardStep + 1);
}

function prevAssetWizardStep() {
  if (currentAssetWizardStep > 1) goToAssetWizardStep(currentAssetWizardStep - 1);
}

function updateAssetCardPreview() {
  const code = document.getElementById('a-property-code')?.value.trim() || 'BRG-2026-XXXX';
  const name = document.getElementById('a-name')?.value.trim() || 'Item Description / Specifications...';
  const acqDate = document.getElementById('a-acq-date')?.value;
  const estLife = document.getElementById('a-est-life')?.value || '5';
  const cost = parseFloat(document.getElementById('a-acq-cost')?.value) || 0;
  const dep = parseFloat(document.getElementById('a-acc-dep')?.value) || 0;
  const nbv = Math.max(0, cost - dep);

  const container = document.getElementById('asset-summary-content');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
      <div style="flex:1; min-width:200px;">
        <div style="font-family:monospace; font-weight:700; color:var(--primary); font-size:.88rem;">${escHtml(code)}</div>
        <div style="font-size:.95rem; font-weight:700; color:var(--text-main); margin-top:.2rem;">${escHtml(name)}</div>
        <div style="font-size:.78rem; color:var(--text-muted); margin-top:.3rem; display:flex; gap:1rem; flex-wrap:wrap;">
          <span>Acquisition Date: <strong>${fmtDate(acqDate)}</strong></span>
          <span>Est. Useful Life: <strong>${estLife} yrs</strong></span>
        </div>
      </div>
      <div style="text-align:right; background:rgba(34,197,94,.08); border:1px solid rgba(34,197,94,.25); border-radius:10px; padding:.55rem .85rem;">
        <div style="font-size:.68rem; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); font-weight:700;">Net Book Value</div>
        <div style="font-size:1.15rem; font-weight:800; color:#4ade80;">₱${nbv.toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
        <div style="font-size:.68rem; color:var(--text-muted); margin-top:.1rem;">Cost: ₱${cost.toLocaleString()} · Dep: ₱${dep.toLocaleString()}</div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function calcNBV() {
  const cost   = parseFloat(document.getElementById('a-acq-cost')?.value) || 0;
  const accDep = parseFloat(document.getElementById('a-acc-dep')?.value)  || 0;
  const nbv    = Math.max(0, cost - accDep);
  const nbvEl  = document.getElementById('a-nbv');
  if (nbvEl) nbvEl.value = nbv.toFixed(2);
}

async function autoGenCode() {
  try {
    const res = await apiFetch('/resources/generate/code');
    const el = document.getElementById('a-property-code');
    if (el) el.value = res.property_code;
  } catch {
    const el = document.getElementById('a-property-code');
    if (el) el.value = `BRG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  }
  updateAssetCardPreview();
}

// ── Sample Data Autofill ────────────────────────────────
const SAMPLE_ASSETS = [
  { name: 'Inflatable Rescue Rubber Boat — Yamaha, 15HP outboard engine (SN: YM2024-0812)', acq_date: '2024-03-10', est_life: 10, acq_cost: 185000, acc_dep: 18500 },
  { name: 'Life Jackets (Adult) — Set of 20 units, SOLAS-approved orange foam vest', acq_date: '2023-06-15', est_life: 5, acq_cost: 24000, acc_dep: 9600 },
  { name: 'Portable Water Pump — Honda WB30, 3-inch centrifugal (SN: HWP-2023-441)', acq_date: '2023-01-20', est_life: 8, acq_cost: 42000, acc_dep: 10500 },
  { name: 'Megaphone / Bullhorn — Handheld rechargeable, 30W, 500m range', acq_date: '2022-08-05', est_life: 5, acq_cost: 3800, acc_dep: 2280 },
  { name: 'First Aid Kit — Complete trauma kit, 100-person capacity, hard case', acq_date: '2024-01-08', est_life: 3, acq_cost: 6500, acc_dep: 2167 },
  { name: 'Emergency Generator — Firman 3500W gasoline (SN: FG2022-9900)', acq_date: '2022-05-12', est_life: 10, acq_cost: 28000, acc_dep: 8400 },
  { name: 'Rescue Rope (50m) — Polypropylene throwline, floating, 12mm diameter', acq_date: '2023-09-01', est_life: 5, acq_cost: 2200, acc_dep: 440 },
  { name: 'Folding Stretcher — Aluminum alloy, 200kg load capacity', acq_date: '2023-04-18', est_life: 7, acq_cost: 5500, acc_dep: 1571 },
  { name: 'Two-Way Radio — Motorola DP1400 UHF (SN: MT2023-7712)', acq_date: '2023-11-22', est_life: 5, acq_cost: 9800, acc_dep: 1960 },
  { name: 'Chainsaws — Husqvarna 455 Rancher, 55cc (SN: HV2024-3301)', acq_date: '2024-02-14', est_life: 8, acq_cost: 32000, acc_dep: 4000 },
];

function autofillSampleData() {
  const sample = SAMPLE_ASSETS[Math.floor(Math.random() * SAMPLE_ASSETS.length)];
  const yr = new Date().getFullYear();
  const code = `BRG-${yr}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  document.getElementById('a-property-code').value = code;
  document.getElementById('a-name').value          = sample.name;
  document.getElementById('a-acq-date').value      = sample.acq_date;
  document.getElementById('a-est-life').value      = sample.est_life;
  document.getElementById('a-acq-cost').value      = sample.acq_cost;
  document.getElementById('a-acc-dep').value       = sample.acc_dep;
  calcNBV();
  updateAssetCardPreview();
}

function openAddModal() {
  editingId = null;
  document.getElementById('asset-modal-title').innerHTML = '<i data-lucide="package-plus" style="color:var(--primary);width:22px;height:22px;"></i> Add Resource';
  document.getElementById('asset-submit-label').textContent = 'Register Resource';
  document.getElementById('asset-form').reset();
  document.getElementById('a-id').value = '';
  document.getElementById('asset-error').style.display = 'none';
  // Show Auto Generate button and hint only when adding
  const autoBtn = document.getElementById('btn-auto-gen-code');
  const propHelp = document.getElementById('propHelp');
  if (autoBtn) autoBtn.style.display = 'flex';
  if (propHelp) propHelp.style.display = 'block';
  // Show sample data autofill button only when adding
  const sampleBtn = document.getElementById('btn-autofill-sample');
  if (sampleBtn) sampleBtn.style.display = 'flex';
  calcNBV();
  goToAssetWizardStep(1);
  document.getElementById('asset-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openEditModalById(id) {
  const r = allResources.find(x => x.id === id);
  if (!r) return;
  openEditModal(r);
}

function openEditModal(r) {
  editingId = r.id;
  document.getElementById('asset-modal-title').innerHTML = '<i data-lucide="pencil" style="color:var(--primary);width:22px;height:22px;"></i> Edit Resource';
  document.getElementById('asset-submit-label').textContent = 'Save Changes';
  document.getElementById('a-id').value             = r.id;
  document.getElementById('a-property-code').value  = r.property_code || '';
  document.getElementById('a-name').value           = r.name || '';
  document.getElementById('a-acq-date').value       = r.acquisition_date ? r.acquisition_date.split('T')[0] : '';
  document.getElementById('a-est-life').value       = r.estimated_life || 5;
  document.getElementById('a-acq-cost').value       = r.acquisition_cost || '';
  document.getElementById('a-acc-dep').value        = r.accumulated_depreciation || '';
  // Hide Auto Generate button and hint when editing — property code is already assigned
  const autoBtn = document.getElementById('btn-auto-gen-code');
  const propHelp = document.getElementById('propHelp');
  if (autoBtn) autoBtn.style.display = 'none';
  if (propHelp) propHelp.style.display = 'none';
  // Hide sample data button when editing
  const sampleBtn = document.getElementById('btn-autofill-sample');
  if (sampleBtn) sampleBtn.style.display = 'none';
  calcNBV();
  document.getElementById('asset-error').style.display = 'none';
  goToAssetWizardStep(1);
  document.getElementById('asset-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeAssetModal() {
  document.getElementById('asset-modal-overlay').classList.remove('active');
  editingId = null;
}

function closeAssetModalOutside(e) {
  if (e.target.id === 'asset-modal-overlay') closeAssetModal();
}

async function submitAsset() {
  const errEl = document.getElementById('asset-error');
  errEl.style.display = 'none';

  const code = document.getElementById('a-property-code').value.trim();
  const name = document.getElementById('a-name').value.trim();

  if (!name) {
    errEl.textContent = 'Description is required.';
    errEl.style.display = 'block';
    goToAssetWizardStep(1);
    document.getElementById('a-name').focus();
    return;
  }

  const acqCost = parseFloat(document.getElementById('a-acq-cost').value) || 0;
  const accDep  = parseFloat(document.getElementById('a-acc-dep').value)  || 0;

  if (accDep > acqCost) {
    errEl.textContent = 'Accumulated depreciation cannot exceed acquisition cost.';
    errEl.style.display = 'block';
    goToAssetWizardStep(2);
    return;
  }

  const payload = {
    name,
    acquisition_date:         document.getElementById('a-acq-date').value  || null,
    estimated_life:           parseFloat(document.getElementById('a-est-life').value) || 5,
    acquisition_cost:         acqCost,
    accumulated_depreciation: accDep,
  };
  if (code) payload.property_code = code;

  try {
    if (editingId) {
      await apiFetch(`/resources/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Resource updated successfully.', 'success', 'Saved');
    } else {
      await apiFetch('/resources/', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Resource registered.', 'success', 'Resource Saved');
    }
    closeAssetModal();
    await loadResources();
  } catch (err) {
    errEl.textContent = err.message || 'Save failed.';
    errEl.style.display = 'block';
  }
}


// ── Detail Modal ────────────────────────────────────────

function openDetailModal(id) {
  const r = allResources.find(x => x.id === id);
  if (!r) return;
  detailId = id;

  document.getElementById('detail-title').textContent = r.name || '—';
  document.getElementById('detail-code').textContent  = r.property_code || '';

  // COA grid
  const grid = document.getElementById('detail-coa-grid');
  const field = (label, value, highlight = false) => `
    <div style="padding:.6rem .8rem;background:rgba(15,23,42,.5);border:1px solid rgba(255,255,255,.07);border-radius:8px;">
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.2rem;">${label}</div>
      <div style="font-size:.9rem;font-weight:600;color:${highlight ? '#4ade80' : 'var(--text-main)'};">${value}</div>
    </div>`;

  grid.innerHTML =
    field('Acquisition Date',         fmtDate(r.acquisition_date)) +
    field('Estimated Life',           r.estimated_life ? r.estimated_life + ' years' : '—') +
    field('Responsibility Center',    `<span class="rc-pill"><i data-lucide="building-2" style="width:11px;height:11px;"></i> ${escHtml(RESPONSIBILITY_CENTER)}</span>`, false) +
    field('Current Status',           statusBadge(r.status)) +
    field('Acquisition Cost',         fmtMoney(r.acquisition_cost)) +
    field('Accu. Depreciation',       fmtMoney(r.accumulated_depreciation)) +
    `<div style="padding:.6rem .8rem;background:rgba(15,23,42,.5);border:1px solid rgba(52,211,153,.25);border-radius:8px;grid-column:span 2;">
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.2rem;">Net Book Value</div>
      <div style="font-size:1.2rem;font-weight:800;color:#4ade80;">${fmtMoney(r.net_book_value)}</div>
      <div style="font-size:.7rem;color:var(--text-muted);margin-top:.15rem;">= Acquisition Cost − Accumulated Depreciation</div>
    </div>` +
    (r.status_notes ? `<div style="padding:.6rem .8rem;background:rgba(251,146,60,.07);border:1px solid rgba(251,146,60,.2);border-radius:8px;grid-column:span 2;">
      <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;color:#fb923c;font-weight:700;margin-bottom:.2rem;">Status Notes</div>
      <div style="font-size:.85rem;color:var(--text-main);">${escHtml(r.status_notes)}</div>
    </div>` : '');

  // Highlight current status button
  ['available','maintenance','damaged','borrowed'].forEach(s => {
    const btn = document.getElementById(`btn-status-${s}`);
    if (btn) btn.classList.toggle('active-status', r.status === s);
  });

  document.getElementById('detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.remove('active');
  detailId = null;
}

function closeDetailModalOutside(e) {
  if (e.target.id === 'detail-modal-overlay') closeDetailModal();
}

function openEditModal_fromDetail() {
  const r = allResources.find(x => x.id === detailId);
  if (!r) return;
  closeDetailModal();
  openEditModal(r);
}




// ── Status Modal ────────────────────────────────────────

const STATUS_LABELS = {
  available:   'Mark as Available',
  maintenance: 'Send to Maintenance',
  damaged:     'Mark as Damaged / For Repair',
  borrowed:    'Mark as Borrowed / Lent Out',
};

const STATUS_NOTES_PLACEHOLDER = {
  available:   'Optional notes (e.g. returned from repair, cleared for use)…',
  maintenance: 'What maintenance is needed? Who is responsible?',
  damaged:     'Describe the damage. What needs to be repaired?',
  borrowed:    'Who borrowed this? Contact number? Expected return date?',
};

const STATUS_REQUIRED_NOTES = ['borrowed', 'damaged'];  // notes required for these

function openStatusModal(newStatus) {
  const r = allResources.find(x => x.id === detailId);
  if (!r) return;
  pendingStatus = newStatus;

  const cfg = STATUS_CONFIG[newStatus] || {};

  document.getElementById('status-modal-title').innerHTML =
    `<i data-lucide="${cfg.icon || 'circle'}" style="color:${cfg.color || 'var(--primary)'}; width:22px; height:22px;"></i> ${STATUS_LABELS[newStatus] || newStatus}`;

  document.getElementById('status-asset-name').textContent = `${r.property_code ? '[' + r.property_code + '] ' : ''}${r.name}`;
  document.getElementById('status-notes').value = '';
  document.getElementById('status-notes').placeholder = STATUS_NOTES_PLACEHOLDER[newStatus] || 'Optional notes…';

  const notesLabel = document.getElementById('status-notes-label');
  if (notesLabel) {
    notesLabel.innerHTML = STATUS_REQUIRED_NOTES.includes(newStatus)
      ? `Detailed Description / Notes <span class="required">*</span>`
      : 'Notes <span style="font-size:.73rem;color:var(--text-muted);font-weight:normal;">(optional)</span>';
  }

  // Render structured dynamic fields
  const extraContainer = document.getElementById('status-extra-fields');
  if (extraContainer) {
    if (newStatus === 'damaged') {
      extraContainer.innerHTML = `
        <div style="background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25); border-radius:10px; padding:.85rem; margin-bottom:.75rem;">
          <div style="font-size:.75rem; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:.04em; margin-bottom:.65rem; display:flex; align-items:center; gap:.4rem;">
            <i data-lucide="alert-triangle" style="width:14px; height:14px;"></i> Damage Assessment & Repair Form
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:.65rem; margin-bottom:.65rem;">
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Damage Level <span class="required">*</span></label>
              <select id="st-damage-level" class="form-control" style="font-size:.8rem; padding:.45rem .7rem;">
                <option value="Minor (Usable with Defects)">Minor (Usable with Defects)</option>
                <option value="Moderate (Requires Repair)" selected>Moderate (Requires Repair)</option>
                <option value="Severe (Unusable)">Severe (Unusable)</option>
                <option value="Total Loss (For COA Condemnation)">Total Loss (For COA Condemnation)</option>
              </select>
            </div>
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Est. Repair Cost (₱)</label>
              <input type="number" id="st-repair-cost" class="form-control" min="0" step="100" placeholder="e.g. 2500" style="font-size:.8rem; padding:.45rem .7rem;" />
            </div>
          </div>
          <div>
            <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Recommended Action</label>
            <select id="st-damage-action" class="form-control" style="font-size:.8rem; padding:.45rem .7rem;">
              <option value="In-House Repair">In-House Barangay Repair</option>
              <option value="Third-Party Vendor Service" selected>Third-Party Vendor Service</option>
              <option value="Spare Parts Replacement">Spare Parts Replacement</option>
              <option value="COA Write-Off / Condemnation">COA Write-Off / Condemnation</option>
            </select>
          </div>
        </div>`;
    } else if (newStatus === 'borrowed') {
      extraContainer.innerHTML = `
        <div style="background:rgba(251,146,60,.08); border:1px solid rgba(251,146,60,.25); border-radius:10px; padding:.85rem; margin-bottom:.75rem;">
          <div style="font-size:.75rem; font-weight:700; color:#fb923c; text-transform:uppercase; letter-spacing:.04em; margin-bottom:.65rem; display:flex; align-items:center; gap:.4rem;">
            <i data-lucide="arrow-right-left" style="width:14px; height:14px;"></i> Resource Borrowing & Requisition Form
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:.65rem; margin-bottom:.65rem;">
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Borrower / Requisitioner <span class="required">*</span></label>
              <input type="text" id="st-borrower-name" class="form-control" placeholder="e.g. Kagawad Juan / SK Council" style="font-size:.8rem; padding:.45rem .7rem;" />
            </div>
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Contact No. / Office</label>
              <input type="text" id="st-borrower-contact" class="form-control" placeholder="e.g. 09171234567" style="font-size:.8rem; padding:.45rem .7rem;" />
            </div>
          </div>
          <div>
            <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Target Return Date</label>
            <input type="date" id="st-return-date" class="form-control" style="font-size:.8rem; padding:.45rem .7rem;" />
          </div>
        </div>`;
    } else if (newStatus === 'maintenance') {
      extraContainer.innerHTML = `
        <div style="background:rgba(56,189,248,.08); border:1px solid rgba(56,189,248,.25); border-radius:10px; padding:.85rem; margin-bottom:.75rem;">
          <div style="font-size:.75rem; font-weight:700; color:#38bdf8; text-transform:uppercase; letter-spacing:.04em; margin-bottom:.65rem; display:flex; align-items:center; gap:.4rem;">
            <i data-lucide="wrench" style="width:14px; height:14px;"></i> Maintenance Schedule
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:.65rem;">
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Service Provider / Tech</label>
              <input type="text" id="st-maint-tech" class="form-control" placeholder="e.g. Ormoc Auto Repair" style="font-size:.8rem; padding:.45rem .7rem;" />
            </div>
            <div>
              <label style="font-size:.74rem; font-weight:600; color:#cbd5e1; display:block; margin-bottom:.25rem;">Est. Completion Date</label>
              <input type="date" id="st-maint-date" class="form-control" style="font-size:.8rem; padding:.45rem .7rem;" />
            </div>
          </div>
        </div>`;
    } else {
      extraContainer.innerHTML = '';
    }
  }

  document.getElementById('status-submit-label').textContent = STATUS_LABELS[newStatus] || 'Confirm';
  document.getElementById('status-error').style.display = 'none';

  // Set button color based on status
  const submitBtn = document.getElementById('status-submit-btn');
  submitBtn.className = 'btn ' + ({
    available:   'btn-success',
    maintenance: 'btn-primary',
    damaged:     'btn-danger',
    borrowed:    'btn-warning',
  }[newStatus] || 'btn-primary');

  document.getElementById('status-modal-overlay').classList.add('active');
  lucide.createIcons();
  setTimeout(() => {
    const firstInput = extraContainer?.querySelector('input, select') || document.getElementById('status-notes');
    if (firstInput) firstInput.focus();
  }, 80);
}

function closeStatusModal() {
  document.getElementById('status-modal-overlay').classList.remove('active');
  pendingStatus = null;
}

function closeStatusModalOutside(e) {
  if (e.target.id === 'status-modal-overlay') closeStatusModal();
}

async function submitStatus() {
  const errEl = document.getElementById('status-error');
  errEl.style.display = 'none';

  let rawNotes = document.getElementById('status-notes').value.trim();
  let structuredSummary = '';

  if (pendingStatus === 'damaged') {
    const level  = document.getElementById('st-damage-level')?.value || 'Moderate (Requires Repair)';
    const cost   = parseFloat(document.getElementById('st-repair-cost')?.value);
    const action = document.getElementById('st-damage-action')?.value || 'Third-Party Vendor Service';

    const costFmt = !isNaN(cost) && cost > 0 ? ` | Est. Cost: ₱${cost.toLocaleString('en-PH', {minimumFractionDigits:2})}` : '';
    structuredSummary = `[DAMAGE REPORT — ${level}${costFmt} | Action: ${action}]`;

    if (!rawNotes) {
      errEl.textContent = 'Please provide details describing the damage or cause.';
      errEl.style.display = 'block';
      document.getElementById('status-notes').focus();
      return;
    }
  } else if (pendingStatus === 'borrowed') {
    const borrower = document.getElementById('st-borrower-name')?.value.trim();
    const contact  = document.getElementById('st-borrower-contact')?.value.trim();
    const retDate  = document.getElementById('st-return-date')?.value;

    if (!borrower) {
      errEl.textContent = 'Please enter the Borrower / Requisitioner name.';
      errEl.style.display = 'block';
      document.getElementById('st-borrower-name')?.focus();
      return;
    }

    const contactFmt = contact ? ` (${contact})` : '';
    const dateFmt    = retDate ? ` | Target Return: ${fmtDate(retDate)}` : '';
    structuredSummary = `[BORROWED — Requisitioner: ${borrower}${contactFmt}${dateFmt}]`;
  } else if (pendingStatus === 'maintenance') {
    const tech    = document.getElementById('st-maint-tech')?.value.trim();
    const estDate = document.getElementById('st-maint-date')?.value;
    const techFmt = tech ? ` | Provider: ${tech}` : '';
    const dateFmt = estDate ? ` | Est. Completion: ${fmtDate(estDate)}` : '';
    structuredSummary = `[MAINTENANCE${techFmt}${dateFmt}]`;
  }

  const finalNotes = structuredSummary ? `${structuredSummary} ${rawNotes}`.trim() : rawNotes;

  if (STATUS_REQUIRED_NOTES.includes(pendingStatus) && !finalNotes) {
    errEl.textContent = 'Please complete the required details or add notes.';
    errEl.style.display = 'block';
    return;
  }

  try {
    await apiFetch(`/resources/${detailId}/status`, {
      method:  'PATCH',
      body:    JSON.stringify({ status: pendingStatus, notes: finalNotes || null }),
    });

    const cfg = STATUS_CONFIG[pendingStatus] || {};
    showToast(`Status updated to "${cfg.label || pendingStatus}".`, 'success', 'Status Updated');

    closeStatusModal();
    closeDetailModal();
    await loadResources();
  } catch (err) {
    errEl.textContent = err.message || 'Update failed.';
    errEl.style.display = 'block';
  }
}


// ── Init ────────────────────────────────────────────────

window.openResourceLogDetailModal = openResourceLogDetailModal;
window.closeResourceLogDetailModal = closeResourceLogDetailModal;
window.closeResourceLogDetailModalOutside = closeResourceLogDetailModalOutside;

function initResources() {
  loadResources();
  if (window.initWeather) initWeather();

  // Profile display
  const user = getUser();
  if (user) {
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role-badge');
    if (nameEl) nameEl.textContent = user.full_name || user.username || '—';
    if (roleEl) { roleEl.textContent = user.role || 'User'; roleEl.className = `badge badge-${user.role === 'admin' ? 'red' : user.role === 'officer' ? 'blue' : 'green'}`; }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initResources);
} else {
  initResources();
}
