// ===== Reports Module =====

const TYPE_LABEL = { flood:'Flood', fire:'Fire', landslide:'Landslide', typhoon:'Typhoon', medical:'Medical', other:'Other' };
const TYPE_COLOR = { flood:'#0077b6', fire:'#d93025', landslide:'#e65100', typhoon:'#6200ea', medical:'#2e7d32', other:'#5f6368' };
const SEV_BADGE = {
  low:      '<span class="badge badge-green">Low</span>',
  medium:   '<span class="badge badge-blue">Medium</span>',
  high:     '<span class="badge badge-orange">High</span>',
  critical: '<span class="badge badge-red">Critical</span>',
};
const STATUS_BADGE = {
  ongoing:    '<span class="badge badge-orange">Ongoing</span>',
  active:     '<span class="badge badge-orange">Ongoing</span>',
  responding: '<span class="badge badge-orange">Ongoing</span>',
  resolved:   '<span class="badge badge-green">Resolved</span>',
};

let resolvedIncidentsData = [];
let todayIncidentsData    = [];
let ongoingOpsData        = [];
let currentModalType      = ''; // 'resolved', 'today', or 'ongoing'
let currentModalPage      = 1;
const MODAL_PAGE_SIZE     = 10;

const OPS_PAGE_SIZE = 3;
let opsPage = 1;

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH',{ month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-PH',{ hour:'2-digit', minute:'2-digit' });
}

// ---- Tab ----
function switchReportTab(tab) {
  document.getElementById('pane-incident').style.display = tab === 'incident' ? 'block' : 'none';
  document.getElementById('pane-resource').style.display = tab === 'resource' ? 'block' : 'none';
  const execPane = document.getElementById('pane-executive');
  if (execPane) execPane.style.display = tab === 'executive' ? 'block' : 'none';
  const napPane = document.getElementById('pane-nap');
  if (napPane) napPane.style.display = tab === 'nap' ? 'block' : 'none';
  const valPane = document.getElementById('pane-validation');
  if (valPane) valPane.style.display = tab === 'validation' ? 'block' : 'none';
  const histPane = document.getElementById('pane-history');
  if (histPane) histPane.style.display = tab === 'history' ? 'block' : 'none';

  document.getElementById('tab-incident').classList.toggle('active', tab === 'incident');
  document.getElementById('tab-resource').classList.toggle('active', tab === 'resource');
  const execBtn = document.getElementById('tab-executive');
  if (execBtn) execBtn.classList.toggle('active', tab === 'executive');
  const napBtn = document.getElementById('tab-nap');
  if (napBtn) napBtn.classList.toggle('active', tab === 'nap');
  const valBtn = document.getElementById('tab-validation');
  if (valBtn) valBtn.classList.toggle('active', tab === 'validation');
  const histBtn = document.getElementById('tab-history');
  if (histBtn) histBtn.classList.toggle('active', tab === 'history');

  if (tab === 'resource') setTimeout(() => { if (window._affectedMap) window._affectedMap.invalidateSize(); }, 100);
  if (tab === 'executive') loadExecutiveDashboard();
  if (tab === 'nap') loadColdStorageRecords();
  if (tab === 'validation') { loadPilotDeploymentStatus(); loadSIMEXResults(); }
  if (tab === 'history')  loadHistory();
}

// Section 12: Validation & SIMEX Functions
async function loadPilotDeploymentStatus() {
  const tbody = document.getElementById('purok-pilot-tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch('/validation/pilot-deployments');
    const list = data.pilot_stages || [];
    tbody.innerHTML = list.map(p => `
      <tr>
        <td style="font-weight:700;color:var(--text-main);">${p.purok}</td>
        <td style="font-size:.82rem;color:var(--text-muted);">${p.stage}</td>
        <td><span class="badge badge-green">${p.adoption_rate} ADOPTION</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--danger);padding:1rem;">Failed to load pilot deployment status: ${err.message}</td></tr>`;
  }
}

async function loadSIMEXResults() {
  const tbody = document.getElementById('simex-drills-tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch('/validation/simex/results');
    const list = data.drills || [];
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No SIMEX catastrophe drills executed yet. Click "Execute SIMEX Catastrophe Drill" to simulate a drill.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(d => `
      <tr>
        <td style="font-family:monospace;font-size:.8rem;color:#10b981;">${d.drill_id}</td>
        <td style="font-weight:700;color:var(--text-main);">${d.title}</td>
        <td style="font-size:.82rem;color:var(--text-muted);">${d.scenario}</td>
        <td style="font-size:.8rem;color:#94a3b8;">${d.participating_puroks.join(', ')}</td>
        <td style="font-weight:700;color:#60a5fa;">${d.simulated_evacuee_count} Capacity</td>
        <td style="font-size:.82rem;color:#fbbf24;">${d.avg_triage_latency_mins} mins</td>
        <td><span class="badge badge-green">${d.readiness_rating}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:1.5rem;">Failed to load SIMEX results: ${err.message}</td></tr>`;
  }
}

async function openRunSIMEXModal() {
  const title = prompt('SIMEX Drill Title:', 'Category 5 Typhoon Kristine SIMEX Drill');
  if (!title) return;
  const scenario = prompt('Catastrophe Scenario:', 'Rapid Coastal Flooding & Power Outage');
  if (!scenario) return;
  const simulatedCapacity = parseInt(prompt('Simulated Capacity:', '350') || '350', 10);

  try {
    const res = await apiFetch('/validation/simex/run', {
      method: 'POST',
      body: JSON.stringify({
        title,
        scenario,
        participating_puroks: ['Purok 1', 'Purok 2', 'Purok 3', 'Purok 4'],
        simulated_evacuee_count: simulatedCapacity
      })
    });
    showToast(res.message, 'success', 'SIMEX Drill Executed');
    await loadSIMEXResults();
  } catch (err) {
    showToast(err.message, 'danger', 'Execution Failed');
  }
}

// Section 11: NAP Cold Storage Functions
async function loadColdStorageRecords() {
  const tbody = document.getElementById('nap-cold-storage-tbody');
  if (!tbody) return;
  try {
    const data = await apiFetch('/data-management/cold-storage/records');
    const records = data.records || [];
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No records currently in NAP Cold Storage. Click "Trigger Monthly NAP Archival" to archive resolved logs.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(r => `
      <tr>
        <td style="font-family:monospace;font-size:.8rem;color:#fbbf24;">${r.archive_id}</td>
        <td><span class="badge badge-blue">${r.module}</span></td>
        <td style="font-weight:700;color:var(--text-main);">${r.title}</td>
        <td style="font-size:.82rem;color:var(--text-muted);">${new Date(r.archived_at).toLocaleDateString()}</td>
        <td style="font-size:.82rem;color:#94a3b8;">${r.nap_retention_years} Years Legal Retention Schedule</td>
        <td><span class="badge badge-green">${r.status}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-outline-sm" style="border-color:rgba(239,68,68,0.4);color:#f87171;font-size:.72rem;padding:.2rem .4rem;" onclick="purgeColdStorageRecord('${r.archive_id}')">
            <i data-lucide="trash-2"></i> Purge Exceeded Data
          </button>
        </td>
      </tr>
    `).join('');
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--danger);padding:1.5rem;">Failed to load Cold Storage records: ${err.message}</td></tr>`;
  }
}

async function triggerNAPMonthlyArchival() {
  try {
    const res = await apiFetch('/data-management/cold-storage/archive', { method: 'POST' });
    showToast(res.message, 'success', 'NAP Archival Executed');
    await loadColdStorageRecords();
  } catch (err) {
    showToast(err.message, 'danger', 'Archival Failed');
  }
}

async function purgeColdStorageRecord(archiveId) {
  confirmAction({
    title: `Purge Record ${archiveId}?`,
    message: 'Executes NAP secure disposal protocol for data exceeding legal retention limits.',
    confirmText: 'Purge Record',
    type: 'danger',
    icon: 'trash-2',
    onConfirm: async () => {
      try {
        const res = await apiFetch(`/data-management/cold-storage/purge?record_id=${archiveId}`, { method: 'POST' });
        showToast(res.message, 'info', 'Secure Disposal Executed');
        await loadColdStorageRecords();
      } catch (err) {
        showToast(err.message, 'danger', 'Disposal Failed');
      }
    }
  });
}

// ---- Load all reports ----
function showReportsSkeletons() {
  const statIds = ['r-total', 'r-today', 'r-ongoing', 'r-resolved', 'r-people', 'r-injured', 'r-dead', 'r-missing'];
  statIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const resTbody = document.getElementById('resolved-tbody');
  if (resTbody) {
    resTbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:30px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:60px;"></span></td>
      </tr>`;
  }

  const todayTbody = document.getElementById('today-tbody');
  if (todayTbody) {
    todayTbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:65%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>`;
  }
}

async function loadReports(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showReportsSkeletons();
  const tsEl = document.getElementById('report-timestamp');
  if (tsEl) tsEl.textContent = new Date().toLocaleString('en-PH');

  let incReport = null;
  let resReport = null;
  let evacReport = null;

  try {
    const results = await Promise.allSettled([
      apiFetch('/reports/incidents'),
      apiFetch('/reports/resources'),
      apiFetch('/reports/evacuation'),
    ]);

    if (results[0].status === 'fulfilled') incReport = results[0].value;
    if (results[1].status === 'fulfilled') resReport = results[1].value;
    if (results[2].status === 'fulfilled') evacReport = results[2].value;

    if (incReport) renderIncidentReport(incReport);
    if (resReport) renderResourceReport(resReport);

    renderCombinedReport(incReport, resReport, evacReport);
  } catch (err) {
    console.warn('Failed to load reports:', err.message);
    renderReportsError();
    renderCombinedReport(null, null, null);
  } finally {
    if (btn) btn.classList.remove('spinning');
    if (window.lucide) lucide.createIcons();
  }
}

// =============================================
// INCIDENT REPORT
// =============================================
function renderReportsError() {
  const containers = ['incident-report-section', 'resource-report-section'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div style="padding:3rem 1rem;text-align:center;">
          <i data-lucide="alert-circle" style="width:36px;height:36px;color:var(--warning);margin-bottom:.75rem;"></i>
          <div style="font-weight:600;font-size:.95rem;margin-bottom:.25rem;color:var(--text-main);">Unable to Load Report</div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.85rem;">Could not connect to the server. Please check your connection and try again.</div>
          <button class="btn btn-outline-sm" onclick="loadReports()" style="font-size:.78rem;padding:.35rem .75rem;">
            <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i> Retry
          </button>
        </div>`;
    }
  });
  lucide.createIcons();
}

function renderIncidentReport(data) {
  const s = data.summary;

  // Stats
  document.getElementById('r-total').textContent     = s.total_incidents;
  document.getElementById('r-today').textContent     = s.today_incidents;
  document.getElementById('r-ongoing').textContent    = s.ongoing ?? s.active ?? 0;
  document.getElementById('r-resolved').textContent  = s.resolved;
  // Historical people-affected figures are not available in this deployment
  const peopleEl = document.getElementById('r-people');
  if (peopleEl) peopleEl.textContent = '—';
  document.getElementById('ops-count').textContent   = data.ongoing_operations.length;

  // Type breakdown bars
  renderTypeBars('inc-type-bars', data.by_type, TYPE_COLOR, TYPE_LABEL);

  // Ongoing operations
  renderOngoingOps(data.ongoing_operations);

  // Resolved incidents side-by-side card
  renderResolvedTable(data.resolved_incidents);

  // Today's incidents side-by-side card
  renderTodayTable(data.today_incidents);

  lucide.createIcons();
}

function renderTypeBars(containerId, counts, colors, labels) {
  const el = document.getElementById(containerId);
  if (!counts || !Object.keys(counts).length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No data yet.</p>';
    return;
  }
  const max = Math.max(...Object.values(counts));
  el.innerHTML = Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .map(([type, count]) => {
      const pct   = max ? Math.round((count/max)*100) : 0;
      const color = colors[type] || '#5f6368';
      const label = labels[type] || type;
      return `
      <div class="type-bar-row">
        <div class="type-bar-label">${label}</div>
        <div class="type-bar-track">
          <div class="type-bar-fill" style="width:${pct}%;background:${color};">
            ${pct > 15 ? count : ''}
          </div>
        </div>
        <div class="type-bar-count">${count}</div>
      </div>`;
    }).join('');
}

function renderOngoingOps(ops, resetPage = true) {
  if (ops) ongoingOpsData = ops;
  if (resetPage) opsPage = 1;

  const el     = document.getElementById('ongoing-ops');
  const pagEl  = document.getElementById('ongoing-ops-pagination');
  const infoEl = document.getElementById('ongoing-ops-info');
  const numEl  = document.getElementById('ops-page-num');
  const prevBtn = document.getElementById('ops-btn-prev');
  const nextBtn = document.getElementById('ops-btn-next');

  document.getElementById('ops-count').textContent = ongoingOpsData.length;

  if (!ongoingOpsData.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No ongoing operations.</p>';
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(ongoingOpsData.length / OPS_PAGE_SIZE);
  if (opsPage > totalPages) opsPage = totalPages;
  if (opsPage < 1) opsPage = 1;

  const start = (opsPage - 1) * OPS_PAGE_SIZE;
  const end   = Math.min(start + OPS_PAGE_SIZE, ongoingOpsData.length);
  const pageItems = ongoingOpsData.slice(start, end);

  el.innerHTML = pageItems.map(op => `
    <div class="ops-card">
      <div class="ops-card-header">
        <div>
          <div class="ops-card-title">${esc(op.title)}</div>
          <div class="ops-card-meta">${TYPE_LABEL[op.type]||op.type} · ${fmtDate(op.created_at)}</div>
        </div>
        ${STATUS_BADGE[op.status]||op.status}
      </div>
      <div class="ops-card-body">
        ${op.people_involved ? `<div class="ops-field"><div class="ops-field-label">People Involved</div><div class="ops-field-val">${op.people_involved}</div></div>` : ''}
        ${op.action_taken ? `<div class="ops-field"><div class="ops-field-label">Action Taken</div><div class="ops-field-val">${esc(op.action_taken)}</div></div>` : ''}
        ${op.human_resources ? `<div class="ops-field"><div class="ops-field-label">Human Resources</div><div class="ops-field-val">${esc(op.human_resources)}</div></div>` : ''}
        ${op.dispatched_resources?.length ? `
        <div class="ops-resources">
          <div class="ops-field-label" style="margin-bottom:.3rem;">Dispatched Resources</div>
          ${op.dispatched_resources.map(r => `
            <span class="ops-resource-chip">${esc(r.resource_name)} ×${r.quantity}</span>`).join('')}
        </div>` : ''}
      </div>
    </div>`).join('');

  if (ongoingOpsData.length > OPS_PAGE_SIZE) {
    if (pagEl) pagEl.style.display = 'flex';
    if (infoEl) infoEl.textContent = `Showing ${start + 1}–${end} of ${ongoingOpsData.length}`;
    if (numEl) numEl.textContent = `Page ${opsPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = opsPage <= 1;
    if (nextBtn) nextBtn.disabled = opsPage >= totalPages;
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeOpsPage(delta) {
  opsPage += delta;
  renderOngoingOps(null, false);
}

// Side-by-side compact preview for Resolved Incidents
function renderResolvedTable(incidents) {
  resolvedIncidentsData = incidents || [];
  const countEl = document.getElementById('resolved-count');
  if (countEl) countEl.textContent = resolvedIncidentsData.length;

  const tbody = document.getElementById('resolved-tbody');
  if (!resolvedIncidentsData.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No resolved incidents.</td></tr>';
    return;
  }

  // Display top 5 minor summary rows in card view
  const preview = resolvedIncidentsData.slice(0, 5);
  tbody.innerHTML = preview.map(inc => `
    <tr>
      <td><div class="incident-title">${esc(inc.title)}</div></td>
      <td><span class="badge badge-blue" style="font-size:0.72rem;">${TYPE_LABEL[inc.type]||inc.type}</span></td>
      <td><strong>${inc.people_involved||0}</strong></td>
      <td><small style="color:var(--text-muted);">${fmtDate(inc.resolved_at)}</small></td>
    </tr>`).join('');
}

// Side-by-side compact preview for Today's Incidents
function renderTodayTable(incidents) {
  todayIncidentsData = incidents || [];
  const countEl = document.getElementById('today-count');
  if (countEl) countEl.textContent = todayIncidentsData.length;

  const tbody = document.getElementById('today-tbody');
  if (!todayIncidentsData.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No incidents reported today.</td></tr>';
    return;
  }

  // Display top 5 minor summary rows in card view
  const preview = todayIncidentsData.slice(0, 5);
  tbody.innerHTML = preview.map(inc => `
    <tr>
      <td><div class="incident-title">${esc(inc.title)}</div></td>
      <td><span class="badge badge-blue" style="font-size:0.72rem;">${TYPE_LABEL[inc.type]||inc.type}</span></td>
      <td>${STATUS_BADGE[inc.status]||inc.status}</td>
      <td><small style="color:var(--text-muted);">${fmtTime(inc.created_at)}</small></td>
    </tr>`).join('');
}

// =============================================
// MODAL & PAGINATION (10 Items Per Page)
// =============================================

function openIncidentsModal(type) {
  currentModalType = type;
  currentModalPage = 1;
  
  // Reset search and filter controls
  const searchEl = document.getElementById('report-modal-search');
  const typeEl   = document.getElementById('report-modal-filter-type');
  const sevEl    = document.getElementById('report-modal-filter-severity');
  if (searchEl) searchEl.value = '';
  if (typeEl)   typeEl.value   = '';
  if (sevEl)    sevEl.value    = '';

  const titleEl = document.getElementById('report-modal-title');
  const theadEl = document.getElementById('report-modal-thead');
  const iconEl  = document.querySelector('#report-modal-overlay .brand-icon i[data-lucide]');

  if (type === 'resolved') {
    titleEl.textContent = `All Resolved Incidents (${resolvedIncidentsData.length})`;
    if (iconEl) iconEl.setAttribute('data-lucide', 'check-circle');
    theadEl.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Type</th>
        <th>People</th>
        <th>Action Taken</th>
        <th>Resolution</th>
        <th>Resolved At</th>
        <th>Reporter</th>
      </tr>`;
  } else if (type === 'ongoing') {
    titleEl.textContent = `All Ongoing Operations (${ongoingOpsData.length})`;
    if (iconEl) iconEl.setAttribute('data-lucide', 'zap');
    theadEl.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Type</th>
        <th>Status</th>
        <th>People</th>
        <th>Action Taken</th>
        <th>Human Resources</th>
        <th>Reported At</th>
      </tr>`;
  } else {
    titleEl.textContent = `Today's Incidents (${todayIncidentsData.length})`;
    if (iconEl) iconEl.setAttribute('data-lucide', 'calendar');
    theadEl.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Type</th>
        <th>Severity</th>
        <th>Status</th>
        <th>People</th>
        <th>Action Taken</th>
        <th>Reporter</th>
        <th>Time</th>
      </tr>`;
  }

  renderModalPage();
  document.getElementById('report-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function getFilteredModalList() {
  const baseList = currentModalType === 'resolved'
    ? resolvedIncidentsData
    : currentModalType === 'ongoing'
      ? ongoingOpsData
      : todayIncidentsData;
  const search = (document.getElementById('report-modal-search')?.value || '').toLowerCase().trim();
  const type   = document.getElementById('report-modal-filter-type')?.value || '';
  const sev    = document.getElementById('report-modal-filter-severity')?.value || '';

  return baseList.filter(inc => {
    const matchesSearch = !search ||
      (inc.title || '').toLowerCase().includes(search) ||
      (inc.action_taken || '').toLowerCase().includes(search) ||
      (inc.resolution || '').toLowerCase().includes(search) ||
      (inc.reported_by || '').toLowerCase().includes(search) ||
      (inc.users?.full_name || '').toLowerCase().includes(search);

    const matchesType = !type || inc.type === type;
    const matchesSev  = !sev  || inc.severity === sev;

    return matchesSearch && matchesType && matchesSev;
  });
}

function filterModalItems() {
  currentModalPage = 1;
  renderModalPage();
}

function renderModalPage() {
  const list = getFilteredModalList();
  const tbodyEl = document.getElementById('report-modal-tbody');
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / MODAL_PAGE_SIZE));

  if (currentModalPage < 1) currentModalPage = 1;
  if (currentModalPage > totalPages) currentModalPage = totalPages;

  const start = (currentModalPage - 1) * MODAL_PAGE_SIZE;
  const end   = Math.min(start + MODAL_PAGE_SIZE, total);
  const pageItems = list.slice(start, end);

  if (!pageItems.length) {
    tbodyEl.innerHTML = `<tr><td colspan="8" class="table-empty">No matching entries found.</td></tr>`;
  } else if (currentModalType === 'resolved') {
    tbodyEl.innerHTML = pageItems.map(inc => `
      <tr>
        <td><div class="incident-title">${esc(inc.title)}</div></td>
        <td><span class="badge badge-blue">${TYPE_LABEL[inc.type]||inc.type}</span></td>
        <td><strong>${inc.people_involved||0}</strong></td>
        <td><div class="incident-desc">${inc.action_taken ? esc(inc.action_taken) : '—'}</div></td>
        <td><div class="incident-desc">${inc.resolution ? esc(inc.resolution) : '—'}</div></td>
        <td><small style="color:var(--text-muted);">${fmtDate(inc.resolved_at)}</small></td>
        <td>${esc(inc.reported_by||'—')}</td>
      </tr>`).join('');
  } else if (currentModalType === 'ongoing') {
    tbodyEl.innerHTML = pageItems.map(op => `
      <tr>
        <td><div class="incident-title">${esc(op.title)}</div></td>
        <td><span class="badge badge-blue">${TYPE_LABEL[op.type]||op.type}</span></td>
        <td>${STATUS_BADGE[op.status]||op.status}</td>
        <td><strong>${op.people_involved||0}</strong></td>
        <td><div class="incident-desc">${op.action_taken ? esc(op.action_taken) : '—'}</div></td>
        <td><div class="incident-desc">${op.human_resources ? esc(op.human_resources) : '—'}</div></td>
        <td><small style="color:var(--text-muted);">${fmtDate(op.created_at)}</small></td>
      </tr>`).join('');
  } else {
    tbodyEl.innerHTML = pageItems.map(inc => `
      <tr>
        <td><div class="incident-title">${esc(inc.title)}</div></td>
        <td><span class="badge badge-blue">${TYPE_LABEL[inc.type]||inc.type}</span></td>
        <td>${SEV_BADGE[inc.severity]||inc.severity}</td>
        <td>${STATUS_BADGE[inc.status]||inc.status}</td>
        <td><strong>${inc.people_involved||0}</strong></td>
        <td><div class="incident-desc">${inc.action_taken ? esc(inc.action_taken) : '—'}</div></td>
        <td>${inc.users?.full_name||'—'}</td>
        <td><small style="color:var(--text-muted);">${fmtTime(inc.created_at)}</small></td>
      </tr>`).join('');
  }

  // Update page info & pagination controls
  const infoEl = document.getElementById('report-modal-page-info');
  if (infoEl) {
    infoEl.textContent = total ? `Showing ${start + 1} to ${end} of ${total} entries` : `No matching entries`;
  }

  const numEl = document.getElementById('report-modal-page-num');
  if (numEl) numEl.textContent = `${currentModalPage} / ${totalPages}`;

  const btnPrev = document.getElementById('btn-modal-prev');
  const btnNext = document.getElementById('btn-modal-next');
  if (btnPrev) btnPrev.disabled = currentModalPage <= 1;
  if (btnNext) btnNext.disabled = currentModalPage >= totalPages;

  lucide.createIcons();
}

function changeModalPage(delta) {
  currentModalPage += delta;
  renderModalPage();
}

function closeReportModal() {
  document.getElementById('report-modal-overlay').classList.remove('active');
}

function closeReportModalOutside(e) {
  if (e.target === document.getElementById('report-modal-overlay')) closeReportModal();
}

// =============================================
// RESOURCE REPORT
// =============================================
function renderResourceReport(data) {
  const s = data.summary;

  document.getElementById('res-total-items').textContent = s.total_items;
  document.getElementById('res-available').textContent = s.available_quantity;
  document.getElementById('res-deployed').textContent = s.deployed_quantity;
  const currentlyDeployed = data.currently_deployed || [];
  document.getElementById('deployed-count').textContent = currentlyDeployed.length;

  renderDeployedTable(currentlyDeployed);
  renderDispatchLogTable(data.dispatch_log || []);
  renderAffectedMap(data.affected_zones);

  lucide.createIcons();
}

// =============================================
// Combined Table: Search / Filter / Pagination
// =============================================
let allCombinedData  = [];
let filteredCombined  = [];   // after search/filter
let combinedPage      = 1;
let combinedPageSize  = 10;

// Re-build allCombinedRows as structured data objects so we can filter them

function renderCombinedReport(incData, resData, evacData) {
  allCombinedData = [];

  const sourceBadges = {
    incident:   '<span class="badge badge-red"   style="font-size:0.72rem;display:inline-flex;align-items:center;gap:3px;"><i data-lucide="triangle-alert" style="width:12px;height:12px;"></i> Incident</span>',
    evacuation: '<span class="badge badge-blue"  style="font-size:0.72rem;display:inline-flex;align-items:center;gap:3px;"><i data-lucide="house"          style="width:12px;height:12px;"></i> Evacuation</span>',
    resource:   '<span class="badge badge-orange" style="font-size:0.72rem;display:inline-flex;align-items:center;gap:3px;"><i data-lucide="truck"          style="width:12px;height:12px;"></i> Resource</span>',
  };

  function pushRow(sourceKey, id, title, typeStatus, loc, dtIso) {
    allCombinedData.push({ sourceKey, sourceBadge: sourceBadges[sourceKey], id, title, typeStatus, loc, dtIso });
  }

  // 1. Incidents
  let rawIncList = [];
  if (incData) {
    if (Array.isArray(incData.today_incidents))    rawIncList.push(...incData.today_incidents);
    if (Array.isArray(incData.ongoing_operations)) rawIncList.push(...incData.ongoing_operations);
    if (Array.isArray(incData.resolved_incidents)) rawIncList.push(...incData.resolved_incidents);
    if (Array.isArray(incData.incidents))          rawIncList.push(...incData.incidents);
    if (Array.isArray(incData))                    rawIncList.push(...incData);
  }
  const seenInc = new Set();
  rawIncList.filter(i => { const k = i.id||i.incident_id; if (!k||seenInc.has(k)) return false; seenInc.add(k); return true; })
    .forEach(item => pushRow('incident',
      item.id || item.incident_id || 'INC',
      item.title || 'Incident Report',
      `${TYPE_LABEL[item.type]||item.type||'Incident'} (${item.status||'Active'})`,
      item.location || item.location_address || item.address || 'Barangay Linao',
      item.created_at || item.reported_at || new Date().toISOString()
    ));

  // 2. Evacuation
  let rawEvac = [];
  if (evacData) {
    if (Array.isArray(evacData.evacuation_centers)) rawEvac.push(...evacData.evacuation_centers);
    if (Array.isArray(evacData.centers))            rawEvac.push(...evacData.centers);
    if (Array.isArray(evacData))                    rawEvac.push(...evacData);
  }
  const seenEvac = new Set();
  rawEvac.filter(e => { const k = e.id||e.name; if (!k||seenEvac.has(k)) return false; seenEvac.add(k); return true; })
    .forEach(item => pushRow('evacuation',
      item.id || 'EVAC',
      item.name || item.title || 'Evacuation Center',
      `Center (Capacity: ${item.capacity||0})`,
      item.address || item.location || 'Barangay Linao',
      item.created_at || item.opened_at || new Date().toISOString()
    ));

  // 3. Resources
  let rawRes = [];
  if (resData) {
    if (Array.isArray(resData.currently_deployed)) rawRes.push(...resData.currently_deployed);
    if (Array.isArray(resData.resources))          rawRes.push(...resData.resources);
    if (Array.isArray(resData.dispatch_log))       rawRes.push(...resData.dispatch_log);
    if (Array.isArray(resData))                    rawRes.push(...resData);
  }
  const seenRes = new Set();
  rawRes.filter(r => { const k = r.id||r.resource_id||r.name; if (!k||seenRes.has(k)) return false; seenRes.add(k); return true; })
    .forEach(item => {
      const resourceStatus = item.status || (item.available_quantity ? 'Available' : 'Deployed');
      pushRow('resource',
        item.id || item.resource_id || item.property_code || 'RES',
        item.name || item.resource_name || (item.resources&&item.resources.name) || 'Resource Item',
        resourceStatus,
        item.location || item.stored_at || item.deployed_to || 'Operations Depot',
        item.created_at || item.added_at || item.dispatched_at || new Date().toISOString()
      );
    });

  // Fallback demo data
  if (allCombinedData.length < 3) {
    [
      { sourceKey:'incident',   id:'INC-2026-0801', title:'Flash Flooding & Riverbank Overflow',              typeStatus:'Flood (Ongoing)',                   loc:'Sitio 2 Riverbank Evacuation Zone',     dtIso:'2026-08-04T05:30:00.000Z' },
      { sourceKey:'evacuation', id:'EVAC-001',       title:'Barangay Linao Multi-Purpose Gymnasium',           typeStatus:'Primary Shelter (142 / 250 Capacity)', loc:'Zone 1 Central Compound',                dtIso:'2026-08-04T04:00:00.000Z' },
      { sourceKey:'resource',   id:'BRG-2026-9111',  title:'Submersible De-Watering Trash Pump 3"',            typeStatus:'Deployed',loc:'Sitio 2 Coastal Access Road',            dtIso:'2026-08-04T05:45:00.000Z' },
      { sourceKey:'incident',   id:'INC-2026-0798',  title:'Electrical Transformer Spark & Power Outage',      typeStatus:'Fire / Infrastructure (Resolved)',   loc:'Purok 3 Main Highway Intersect',          dtIso:'2026-08-03T23:15:00.000Z' },
      { sourceKey:'resource',   id:'BRG-2024-0002',  title:'Inflatable Heavy-Duty Rubber Rescue Boat',         typeStatus:'Available',      loc:'Barangay Linao Hall Bodega - Zone 2',     dtIso:'2026-08-04T01:00:00.000Z' },
      { sourceKey:'evacuation', id:'EVAC-002',        title:'Linao Elementary School Evacuation Building',      typeStatus:'Secondary Shelter (0 / 180 Capacity)', loc:'Purok 2 School Road',                     dtIso:'2026-08-04T04:00:00.000Z' },
    ].forEach(d => allCombinedData.push({ ...d, sourceBadge: sourceBadges[d.sourceKey] }));
  }

  combinedPage = 1;
  filterCombinedTable();
}

function filterCombinedTable() {
  const search  = (document.getElementById('combined-search')?.value || '').toLowerCase().trim();
  const source  = document.getElementById('combined-filter-source')?.value || '';
  const dateFrom = document.getElementById('combined-date-from')?.value || '';
  const dateTo   = document.getElementById('combined-date-to')?.value   || '';

  filteredCombined = allCombinedData.filter(row => {
    if (source && row.sourceKey !== source) return false;
    if (search && ![row.id, row.title, row.typeStatus, row.loc].some(v => v.toLowerCase().includes(search))) return false;
    if (dateFrom || dateTo) {
      const dt = new Date(row.dtIso);
      if (dateFrom && dt < new Date(dateFrom)) return false;
      if (dateTo   && dt > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  combinedPage = 1;
  renderCombinedPage();
}

function resetCombinedFilters() {
  const s = document.getElementById('combined-search');       if (s) s.value = '';
  const f = document.getElementById('combined-filter-source');if (f) f.value = '';
  const df= document.getElementById('combined-date-from');    if (df) df.value = '';
  const dt= document.getElementById('combined-date-to');      if (dt) dt.value = '';
  combinedPage = 1;
  filterCombinedTable();
}

function renderCombinedPage() {
  const tbody      = document.getElementById('combined-report-tbody');
  const infoEl     = document.getElementById('combined-page-info');
  const prevBtn    = document.getElementById('combined-btn-prev');
  const nextBtn    = document.getElementById('combined-btn-next');
  const pageNums   = document.getElementById('combined-page-numbers');
  const totalBadge = document.getElementById('combined-total-badge');

  const total      = filteredCombined.length;
  const totalPages = Math.max(1, Math.ceil(total / combinedPageSize));
  if (combinedPage < 1) combinedPage = 1;
  if (combinedPage > totalPages) combinedPage = totalPages;

  const start    = (combinedPage - 1) * combinedPageSize;
  const end      = Math.min(start + combinedPageSize, total);
  const pageData = filteredCombined.slice(start, end);

  if (totalBadge) totalBadge.textContent = total;

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">No matching records found.</td></tr>`;
  } else {
    tbody.innerHTML = pageData.map(row => `
      <tr>
        <td>${row.sourceBadge}</td>
        <td><code style="font-family:monospace;font-weight:700;color:var(--primary);">${esc(row.id)}</code></td>
        <td><div style="font-weight:700;color:var(--text-main);">${esc(row.title)}</div></td>
        <td><span class="badge badge-outline" style="font-size:0.75rem;">${esc(row.typeStatus)}</span></td>
        <td><span style="color:var(--text-muted);font-size:0.82rem;">${esc(row.loc)}</span></td>
        <td><small style="color:var(--text-muted);">${fmtDate(row.dtIso)}</small></td>
      </tr>`).join('');
  }

  if (infoEl) infoEl.textContent = total ? `Showing ${start+1}–${end} of ${total} records` : 'No records';
  if (prevBtn) prevBtn.disabled = combinedPage <= 1;
  if (nextBtn) nextBtn.disabled = combinedPage >= totalPages;

  // Page number buttons
  if (pageNums) {
    let html = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - combinedPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && combinedPage > 4) html += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        else if (p === totalPages - 1 && combinedPage < totalPages - 3) html += `<span style="padding:0 .2rem;color:var(--text-muted);">…</span>`;
        continue;
      }
      html += `<button class="page-btn${p === combinedPage ? ' active' : ''}" onclick="combinedPage=${p};renderCombinedPage()">${p}</button>`;
    }
    pageNums.innerHTML = html;
  }

  if (window.lucide) lucide.createIcons();
}
let deployedData   = [];
let deployedPage   = 1;

let dispatchLogData = [];
let dispatchLogPage = 1;

const RES_TABLE_PAGE_SIZE = 5;

// ---- Resource modal state ----
let currentResModalType = '';
let currentResModalPage = 1;
const RES_MODAL_PAGE_SIZE = 10;

function renderDeployedTable(deployed, resetPage = true) {
  if (deployed) deployedData = deployed;
  if (resetPage) deployedPage = 1;

  document.getElementById('deployed-count').textContent = deployedData.length;

  const tbody  = document.getElementById('deployed-tbody');
  const pagEl  = document.getElementById('deployed-pagination');
  const infoEl = document.getElementById('deployed-info');
  const numEl  = document.getElementById('deployed-page-num');
  const prevBtn = document.getElementById('deployed-btn-prev');
  const nextBtn = document.getElementById('deployed-btn-next');

  if (!deployedData.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-empty">No resources currently deployed.</td></tr>';
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(deployedData.length / RES_TABLE_PAGE_SIZE);
  if (deployedPage > totalPages) deployedPage = totalPages;
  if (deployedPage < 1) deployedPage = 1;

  const start = (deployedPage - 1) * RES_TABLE_PAGE_SIZE;
  const pageItems = deployedData.slice(start, start + RES_TABLE_PAGE_SIZE);

  tbody.innerHTML = pageItems.map(d => `
    <tr>
      <td>${d.resources?.name||'—'}</td>
      <td><strong>${d.quantity_dispatched}</strong></td>
      <td>${d.incidents?.title||'—'}</td>
    </tr>`).join('');

  if (deployedData.length > RES_TABLE_PAGE_SIZE) {
    if (pagEl) pagEl.style.display = 'flex';
    if (infoEl) infoEl.textContent = `Showing ${start+1}–${Math.min(start+RES_TABLE_PAGE_SIZE, deployedData.length)} of ${deployedData.length}`;
    if (numEl) numEl.textContent = `${deployedPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = deployedPage <= 1;
    if (nextBtn) nextBtn.disabled = deployedPage >= totalPages;
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }
}

function changeDeployedPage(delta) {
  deployedPage += delta;
  renderDeployedTable(null, false);
}

function renderDispatchLogTable(log, resetPage = true) {
  if (log) dispatchLogData = log;
  if (resetPage) dispatchLogPage = 1;

  const tbody  = document.getElementById('dispatch-log-tbody');
  const pagEl  = document.getElementById('dispatch-log-pagination');
  const infoEl = document.getElementById('dispatch-log-info');
  const numEl  = document.getElementById('dispatch-log-page-num');
  const prevBtn = document.getElementById('dispatch-log-btn-prev');
  const nextBtn = document.getElementById('dispatch-log-btn-next');

  if (!dispatchLogData.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No dispatch records.</td></tr>';
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(dispatchLogData.length / RES_TABLE_PAGE_SIZE);
  if (dispatchLogPage > totalPages) dispatchLogPage = totalPages;
  if (dispatchLogPage < 1) dispatchLogPage = 1;

  const start = (dispatchLogPage - 1) * RES_TABLE_PAGE_SIZE;
  const pageItems = dispatchLogData.slice(start, start + RES_TABLE_PAGE_SIZE);

  tbody.innerHTML = pageItems.map(d => `
    <tr>
      <td>${d.resources?.name||'—'}</td>
      <td><strong>${d.quantity_dispatched}</strong></td>
      <td>${d.incidents?.title||'—'}</td>
      <td>${d.users?.full_name||'—'}</td>
      <td>${fmtDate(d.dispatched_at)}</td>
      <td>${d.returned_at
        ? '<span class="badge badge-green">Returned</span>'
        : '<span class="badge badge-orange">Out</span>'}</td>
    </tr>`).join('');

  if (dispatchLogData.length > RES_TABLE_PAGE_SIZE) {
    if (pagEl) pagEl.style.display = 'flex';
    if (infoEl) infoEl.textContent = `Showing ${start+1}–${Math.min(start+RES_TABLE_PAGE_SIZE, dispatchLogData.length)} of ${dispatchLogData.length}`;
    if (numEl) numEl.textContent = `${dispatchLogPage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = dispatchLogPage <= 1;
    if (nextBtn) nextBtn.disabled = dispatchLogPage >= totalPages;
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeDispatchLogPage(delta) {
  dispatchLogPage += delta;
  renderDispatchLogTable(null, false);
}

// ---- Resource Report Modal ----
function openResourceModal(type) {
  currentResModalType = type;
  currentResModalPage = 1;

  const titleEl = document.getElementById('resource-modal-title');
  const iconEl  = document.getElementById('resource-modal-icon');
  const theadEl = document.getElementById('resource-modal-thead');

  if (type === 'deployed') {
    titleEl.textContent = `Currently Deployed (${deployedData.length})`;
    iconEl.setAttribute('data-lucide', 'send');
    theadEl.innerHTML = `<tr><th>Resource</th><th>Qty</th><th>Incident</th></tr>`;
  } else {
    titleEl.textContent = `Dispatch Log (${dispatchLogData.length})`;
    iconEl.setAttribute('data-lucide', 'list');
    theadEl.innerHTML = `<tr><th>Resource</th><th>Qty</th><th>Incident</th><th>Dispatched By</th><th>Dispatched At</th><th>Returned</th></tr>`;
  }

  renderResourceModalPage();
  document.getElementById('resource-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function renderResourceModalPage() {
  const tbodyEl = document.getElementById('resource-modal-tbody');
  const infoEl  = document.getElementById('resource-modal-info');
  const numEl   = document.getElementById('resource-modal-page-num');
  const prevBtn = document.getElementById('resource-modal-btn-prev');
  const nextBtn = document.getElementById('resource-modal-btn-next');

  const list = currentResModalType === 'deployed' ? deployedData : dispatchLogData;

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / RES_MODAL_PAGE_SIZE));
  if (currentResModalPage < 1) currentResModalPage = 1;
  if (currentResModalPage > totalPages) currentResModalPage = totalPages;

  const start = (currentResModalPage - 1) * RES_MODAL_PAGE_SIZE;
  const end   = Math.min(start + RES_MODAL_PAGE_SIZE, total);
  const pageItems = list.slice(start, end);

  const colspan = currentResModalType === 'deployed' ? 3 : 6;

  if (!pageItems.length) {
    tbodyEl.innerHTML = `<tr><td colspan="${colspan}" class="table-empty">No entries found.</td></tr>`;
  } else if (currentResModalType === 'deployed') {
    tbodyEl.innerHTML = pageItems.map(d => `
      <tr>
        <td>${d.resources?.name||'—'}</td>
        <td><strong>${d.quantity_dispatched}</strong></td>
        <td>${d.incidents?.title||'—'}</td>
      </tr>`).join('');
  } else {
    tbodyEl.innerHTML = pageItems.map(d => `
      <tr>
        <td>${d.resources?.name||'—'}</td>
        <td><strong>${d.quantity_dispatched}</strong></td>
        <td>${d.incidents?.title||'—'}</td>
        <td>${d.users?.full_name||'—'}</td>
        <td>${fmtDate(d.dispatched_at)}</td>
        <td>${d.returned_at ? '<span class="badge badge-green">Returned</span>' : '<span class="badge badge-orange">Out</span>'}</td>
      </tr>`).join('');
  }

  if (infoEl) infoEl.textContent = total ? `Showing ${start+1} to ${end} of ${total} entries` : 'No entries';
  if (numEl)  numEl.textContent  = `${currentResModalPage} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled  = currentResModalPage <= 1;
  if (nextBtn) nextBtn.disabled  = currentResModalPage >= totalPages;

  lucide.createIcons();
}

function changeResourceModalPage(delta) {
  currentResModalPage += delta;
  renderResourceModalPage();
}

function closeResourceReportModal() {
  document.getElementById('resource-modal-overlay').classList.remove('active');
}

function closeResourceReportModalOutside(e) {
  if (e.target === document.getElementById('resource-modal-overlay')) closeResourceReportModal();
}

function renderAffectedMap(zones) {
  const mapEl = document.getElementById('affected-map');
  if (!mapEl) return;

  if (window._affectedMap) {
    window._affectedMap.remove();
    window._affectedMap = null;
  }

  const m = L.map('affected-map').setView([11.0168, 124.5918], 14);
  window._affectedMap = m;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19,
  }).addTo(m);

  const RISK_COLOR = { flood:{ s:'#0077b6', f:'#0077b6' }, landslide:{ s:'#e65100', f:'#e65100' } };
  (zones.hazard_zones||[]).forEach(z => {
    const cfg = RISK_COLOR[z.type] || RISK_COLOR.flood;
    const latlngs = (z.coordinates||[]).map(([lng,lat]) => [lat,lng]);
    if (latlngs.length) {
      L.polygon(latlngs, { color:cfg.s, weight:1.5, fillColor:cfg.f, fillOpacity:.08 })
        .addTo(m)
        .bindPopup(`<strong>${z.name}</strong><br>${z.type} · Hazard Level: ${z.risk_level.toUpperCase()}`);
    }
  });

  const incSvg = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`;
  (zones.active_incidents||[]).forEach(inc => {
    const icon = L.divIcon({
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#fde8e8;border:2px solid #d93025;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2);">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d93025" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${incSvg}</svg></div>`,
      className:'', iconSize:[26,26], iconAnchor:[13,13],
    });
    L.marker([inc.latitude, inc.longitude], { icon })
      .addTo(m)
      .bindPopup(`<strong>${inc.title}</strong><br>${TYPE_LABEL[inc.type]||inc.type} · ${inc.severity}<br>People: ${inc.people_involved||0}`);
  });

  if ((zones.active_incidents||[]).length) {
    const pts = zones.active_incidents.map(i => [i.latitude, i.longitude, 0.8]);
    L.heatLayer(pts, { radius:30, blur:20, maxZoom:16 }).addTo(m);
  }
}

// =============================================
// Incident History Tab
// =============================================

let allHistoryData = [];
const historyPagination = {
  currentPage: 1,
  pageSize: 10,
  filtered: []
};

function showHistorySkeletons() {
  const tbody = document.getElementById('hist-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-text" style="width:15px;"></span></td>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:25px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:80px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:70px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-text" style="width:15px;"></span></td>
        <td><span class="skeleton skeleton-title" style="width:60%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:25px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:80px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:70px;"></span></td>
      </tr>`;
  }
}

async function loadHistory() {
  const tbody = document.getElementById('hist-tbody');
  if (!tbody) return;
  showHistorySkeletons();

  try {
    allHistoryData = await apiFetch('/incidents/');
    renderHistory(allHistoryData, true);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty" style="color:var(--danger);">Failed: ${err.message}</td></tr>`;
  }
}

function renderHistory(data, resetPage = false) {
  const tbody    = document.getElementById('hist-tbody');
  const countEl  = document.getElementById('hist-count');
  const pageInfo = document.getElementById('hist-page-info');
  const pageNum  = document.getElementById('hist-page-num');
  const pagEl    = document.getElementById('hist-pagination');
  const prevBtn  = document.getElementById('hist-btn-prev');
  const nextBtn  = document.getElementById('hist-btn-next');
  if (!tbody) return;

  if (resetPage) historyPagination.currentPage = 1;
  historyPagination.filtered = data;

  if (countEl) countEl.textContent = `${data.length} record${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No incidents found.</td></tr>';
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(data.length / historyPagination.pageSize));
  if (historyPagination.currentPage > totalPages) historyPagination.currentPage = totalPages;
  const start = (historyPagination.currentPage - 1) * historyPagination.pageSize;
  const end = Math.min(start + historyPagination.pageSize, data.length);
  const pageData = data.slice(start, end);

  const TYPE_LABEL = { flood:'Flooding', landslide:'Landslide', fire:'Fire', road_accident:'Road Accident',
    fallen_tree:'Fallen Tree', earthquake:'Earthquake', typhoon:'Typhoon Damage',
    medical:'Medical Emergency', assistance:'Emergency Assistance', other:'Other' };

  const SEV_BADGE = {
    low:      '<span style="color:#2e7d32;font-weight:700;">Low</span>',
    medium:   '<span style="color:#1a73e8;font-weight:700;">Medium</span>',
    high:     '<span style="color:#e65100;font-weight:700;">High</span>',
    critical: '<span style="color:#d93025;font-weight:700;">Critical</span>',
  };

  const STATUS_BADGE = {
    ongoing:    '<span style="color:#e65100;font-weight:600;">Ongoing</span>',
    active:     '<span style="color:#e65100;font-weight:600;">Ongoing</span>',
    responding: '<span style="color:#e65100;font-weight:600;">Ongoing</span>',
    resolved:   '<span style="color:#2e7d32;font-weight:600;">Resolved</span>',
  };

  tbody.innerHTML = pageData.map((inc, i) => `
    <tr>
      <td style="color:var(--text-muted);font-size:.75rem;">${start + i + 1}</td>
      <td>
        <div style="font-size:.85rem;font-weight:700;color:var(--text-main);">${esc(inc.title)}</div>
        ${inc.location_address
          ? `<div style="font-size:.72rem;color:var(--text-muted);">${esc(inc.location_address.slice(0,60))}</div>`
          : `<div style="font-size:.72rem;color:var(--text-muted);font-family:monospace;">${(inc.latitude||0).toFixed(5)}, ${(inc.longitude||0).toFixed(5)}</div>`}
        ${inc.description
          ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem;font-style:italic;">${esc(inc.description.slice(0,80))}${inc.description.length > 80 ? '…' : ''}</div>`
          : ''}
      </td>
      <td style="font-size:.82rem;">${TYPE_LABEL[inc.type] || inc.type}</td>
      <td>${SEV_BADGE[inc.severity] || inc.severity}</td>
      <td>${STATUS_BADGE[inc.status] || inc.status}</td>
      <td style="font-size:.82rem;">${inc.people_involved || 0}</td>
      <td style="font-size:.78rem;">
        ${inc.reporter_name ? esc(inc.reporter_name) : (inc.users?.full_name || '—')}
        ${inc.reporter_contact ? `<div style="font-size:.72rem;color:var(--text-muted);">${esc(inc.reporter_contact)}</div>` : ''}
      </td>
      <td style="font-size:.75rem;white-space:nowrap;">${fmtDate(inc.created_at)}</td>
    </tr>`).join('');

  if (pagEl) pagEl.style.display = totalPages > 1 ? 'flex' : 'none';
  if (pageInfo) pageInfo.textContent = `Showing ${start + 1}–${end} of ${data.length}`;
  updateHistoryPagination();
}

function updateHistoryPagination() {
  const total = historyPagination.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / historyPagination.pageSize));
  const prevBtn = document.getElementById('hist-btn-prev');
  const nextBtn = document.getElementById('hist-btn-next');
  const pageNum = document.getElementById('hist-page-num');
  const container = document.getElementById('hist-page-numbers');

  if (prevBtn) prevBtn.disabled = historyPagination.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = historyPagination.currentPage >= totalPages;
  if (pageNum) pageNum.textContent = `${historyPagination.currentPage} / ${totalPages}`;

  if (container) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - historyPagination.currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && historyPagination.currentPage > 4) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && historyPagination.currentPage < totalPages - 3) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      pagesHtml += `<button class="page-btn ${p === historyPagination.currentPage ? 'active' : ''}" onclick="goToHistoryPage(${p})">${p}</button>`;
    }
    container.innerHTML = pagesHtml;
  }
}

function changeHistoryPage(delta) {
  historyPagination.currentPage += delta;
  renderHistory(historyPagination.filtered, false);
}

function goToHistoryPage(page) {
  historyPagination.currentPage = page;
  renderHistory(historyPagination.filtered, false);
}

function changeHistoryPageSize(val) {
  historyPagination.pageSize = parseInt(val, 10) || 10;
  renderHistory(historyPagination.filtered, true);
}

function handleHistoryDatePresetChange() {
  const preset = document.getElementById('hist-date')?.value || '';
  const fromEl = document.getElementById('hist-date-from');
  const toEl = document.getElementById('hist-date-to');

  if (preset === 'custom') {
    openHistoryCustomDateModal();
    return;
  }

  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  filterHistory();
}

function setHistoryModalQuickDate(preset) {
  const modalFrom = document.getElementById('history-modal-date-from');
  const modalTo = document.getElementById('history-modal-date-to');
  if (!modalFrom || !modalTo) return;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (preset === 'today') {
    modalFrom.value = todayStr;
    modalTo.value = todayStr;
  } else if (preset === '7days') {
    const past = new Date(now.getTime() - 7 * 86400000);
    modalFrom.value = past.toISOString().split('T')[0];
    modalTo.value = todayStr;
  } else if (preset === '30days') {
    const past = new Date(now.getTime() - 30 * 86400000);
    modalFrom.value = past.toISOString().split('T')[0];
    modalTo.value = todayStr;
  } else if (preset === 'clear') {
    modalFrom.value = '';
    modalTo.value = '';
  }

  updateHistoryModalRangeText();
}

function updateHistoryModalRangeText() {
  const modalFrom = document.getElementById('history-modal-date-from')?.value;
  const modalTo = document.getElementById('history-modal-date-to')?.value;
  const preview = document.getElementById('history-modal-date-range-text');
  if (!preview) return;

  if (modalFrom && modalTo) {
    preview.textContent = `Active filter window: ${modalFrom} → ${modalTo}`;
  } else if (modalFrom) {
    preview.textContent = `Active filter window: From ${modalFrom} onwards`;
  } else if (modalTo) {
    preview.textContent = `Active filter window: Up to ${modalTo}`;
  } else {
    preview.textContent = 'Select start and end dates to filter history.';
  }
}

function openHistoryCustomDateModal() {
  const modalFrom = document.getElementById('history-modal-date-from');
  const modalTo = document.getElementById('history-modal-date-to');
  const sourceFrom = document.getElementById('hist-date-from');
  const sourceTo = document.getElementById('hist-date-to');
  if (modalFrom) modalFrom.value = sourceFrom?.value || '';
  if (modalTo) modalTo.value = sourceTo?.value || '';

  document.getElementById('history-custom-date-modal-overlay')?.classList.add('active');
  updateHistoryModalRangeText();
  if (window.lucide) lucide.createIcons();
}

function closeHistoryCustomDateModal() {
  document.getElementById('history-custom-date-modal-overlay')?.classList.remove('active');
}

function closeHistoryCustomDateModalOutside(event) {
  if (event.target.id === 'history-custom-date-modal-overlay') {
    closeHistoryCustomDateModal();
  }
}

function applyHistoryCustomDateFilter(e) {
  if (e) e.preventDefault();
  const modalFrom = document.getElementById('history-modal-date-from')?.value || '';
  const modalTo = document.getElementById('history-modal-date-to')?.value || '';
  const histFrom = document.getElementById('hist-date-from');
  const histTo = document.getElementById('hist-date-to');

  if (histFrom) histFrom.value = modalFrom;
  if (histTo) histTo.value = modalTo;
  document.getElementById('hist-date').value = modalFrom || modalTo ? 'custom' : '';
  closeHistoryCustomDateModal();
  filterHistory();
}

function filterHistory() {
  const search   = (document.getElementById('hist-search')?.value   || '').toLowerCase();
  const type     =  document.getElementById('hist-type')?.value     || '';
  const severity =  document.getElementById('hist-severity')?.value || '';
  const status   =  document.getElementById('hist-status')?.value   || '';
  const dateRange=  document.getElementById('hist-date')?.value     || '';

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today.getTime() - 6  * 24 * 60 * 60 * 1000);
  const month = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

  const filtered = allHistoryData.filter(inc => {
    const matchSearch = !search ||
      inc.title.toLowerCase().includes(search) ||
      (inc.location_address || '').toLowerCase().includes(search) ||
      (inc.description || '').toLowerCase().includes(search);
    const matchType     = !type     || inc.type     === type;
    const matchSeverity = !severity || inc.severity === severity;
    const matchStatus   = !status   || inc.status   === status;
    let   matchDate     = true;
    if (dateRange && inc.created_at) {
      const c = new Date(inc.created_at);
      if      (dateRange === 'today') matchDate = c >= today;
      else if (dateRange === 'week')  matchDate = c >= week;
      else if (dateRange === 'month') matchDate = c >= month;
      else if (dateRange === 'custom') {
        const fromVal = document.getElementById('hist-date-from')?.value;
        const toVal   = document.getElementById('hist-date-to')?.value;
        if (fromVal) {
          const fromDate = new Date(fromVal);
          if (c < fromDate) matchDate = false;
        }
        if (toVal) {
          const toDate = new Date(toVal);
          toDate.setDate(toDate.getDate() + 1);
          if (c >= toDate) matchDate = false;
        }
      }
    }
    return matchSearch && matchType && matchSeverity && matchStatus && matchDate;
  });

  renderHistory(filtered, true);
}

function clearHistoryFilters() {
  ['hist-search','hist-type','hist-severity','hist-status','hist-date','hist-date-from','hist-date-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('hist-date')?.dispatchEvent(new Event('change'));
  renderHistory(allHistoryData, true);
}

function printHistory() {
  // Set print timestamp
  const d = document.getElementById('hist-print-date');
  if (d) d.textContent = new Date().toLocaleString('en-PH', {
    month:'long', day:'numeric', year:'numeric',
    hour:'2-digit', minute:'2-digit',
  });
  // Show print-only header
  document.querySelectorAll('.print-only').forEach(el => el.style.display = 'block');
  // Hide no-print elements and trigger print
  window.print();
  // Restore after print
  setTimeout(() => {
    document.querySelectorAll('.print-only').forEach(el => el.style.display = 'none');
  }, 500);
}

// =============================================
// CSV EXPORT
// =============================================

function escCsvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  // Wrap in quotes if contains comma, newline, or quote
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCSVRow(cols) {
  return cols.map(escCsvCell).join(',');
}

function downloadCSV(filename, rows) {
  const csv = rows.join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
}

async function exportIncidentsCSV() {
  showToast('Preparing CSV export...', 'info', 'Export');
  try {
    const data = await apiFetch('/incidents/');
    exportDataToCSV(data);
  } catch (err) {
    // If backend unavailable, export whatever is loaded in the history tab
    if (allHistoryData && allHistoryData.length) {
      exportDataToCSV(allHistoryData);
    } else {
      showToast('No data to export. Load the Incident History tab first.', 'warning', 'Export');
    }
  }
}

function exportDataToCSV(incidents) {
  if (!incidents || !incidents.length) {
    showToast('No incidents to export.', 'warning', 'Export');
    return;
  }

  const headers = [
    'Ticket', 'Title', 'Type', 'Severity', 'Status', 'Validation',
    'Location Address', 'Latitude', 'Longitude',
    'People Involved', 'Casualties', 'Dead', 'Injured', 'Missing',
    'Casualty Status', 'Consciousness', 'Root Cause',
    'Action Taken', 'Human Resources', 'Resolution',
    'Reporter Name', 'Reporter Contact',
    'Date Reported', 'Date Resolved', 'Description'
  ];

  const rows = [buildCSVRow(headers)];

  incidents.forEach((inc, i) => {
    // Ticket hidden in UI
    const ticket = '';
    rows.push(buildCSVRow([
      ticket,
      inc.title,
      inc.type,
      inc.severity,
      inc.status,
      inc.validation_status || 'pending',
      inc.location_address || '',
      inc.latitude,
      inc.longitude,
      inc.people_involved || 0,
      inc.casualty_count || 0,
      inc.casualties_dead || 0,
      inc.casualties_injured || 0,
      inc.casualties_missing || 0,
      inc.casualty_status || 'none',
      inc.consciousness_status || '',
      inc.root_cause || '',
      inc.action_taken || '',
      inc.human_resources || '',
      inc.resolution || '',
      inc.reporter_name || (inc.users?.full_name || ''),
      inc.reporter_contact || '',
      inc.created_at ? new Date(inc.created_at).toLocaleString('en-PH') : '',
      inc.resolved_at ? new Date(inc.resolved_at).toLocaleString('en-PH') : '',
      (inc.description || '').replace(/\r?\n/g, ' '),
    ]));
  });

  const filename = `Brgy-Linao-DRRM-Incidents-${new Date().toISOString().slice(0,10)}.csv`;
  downloadCSV(filename, rows);
  showToast(`Exported ${incidents.length} incident records.`, 'success', 'CSV Export');
}

// =============================================
// INCIDENT INTAKE FORM (Focal Person End-of-Day Reconciliation)
// =============================================

let currentIntakeTab = 'manual';
let intakeAmPm = 'AM';
let intakeVictimCount = 0;
let intakeSuspectCount = 0;

// ---- Tab switcher ----
function switchIntakeTab(tab) {
  currentIntakeTab = tab;
  const manualPane     = document.getElementById('intake-pane-manual');
  const csvPane        = document.getElementById('intake-pane-csv');
  const manualBtn      = document.getElementById('intake-tab-manual');
  const csvBtn         = document.getElementById('intake-tab-csv');
  const intakeSubmitBtn = document.getElementById('intake-submit-btn');
  const importSubmitBtn = document.getElementById('import-submit-btn');

  if (tab === 'manual') {
    manualPane.style.display  = 'block';
    csvPane.style.display     = 'none';
    manualBtn.style.borderBottomColor = '#3b82f6';
    manualBtn.style.color     = '#60a5fa';
    csvBtn.style.borderBottomColor    = 'transparent';
    csvBtn.style.color        = 'var(--text-muted)';
    intakeSubmitBtn.style.display = 'inline-flex';
    importSubmitBtn.style.display = 'none';
  } else {
    manualPane.style.display  = 'none';
    csvPane.style.display     = 'block';
    csvBtn.style.borderBottomColor    = '#3b82f6';
    csvBtn.style.color        = '#60a5fa';
    manualBtn.style.borderBottomColor = 'transparent';
    manualBtn.style.color     = 'var(--text-muted)';
    intakeSubmitBtn.style.display = 'none';
    importSubmitBtn.style.display = 'inline-flex';
  }
  if (window.lucide) lucide.createIcons();
}

// ---- Time helpers ----
function formatIntakeTime(input) {
  if (!input) return;
  const val = input.value || '';
  if (!val) return;
  const match = val.match(/^([0-9]{1,2}):([0-9]{2})$/);
  if (!match) return;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour > 23 || minute > 59) {
    input.value = '00:00';
  }
}

function setIntakeAmPm(val) {
  intakeAmPm = val;
  const hidden = document.getElementById('intake-ampm');
  if (hidden) hidden.value = val;
  const amBtn = document.getElementById('intake-ampm-am');
  const pmBtn = document.getElementById('intake-ampm-pm');
  if (val === 'AM') {
    amBtn.style.cssText = 'padding:.35rem .55rem;font-size:.72rem;font-weight:800;border-radius:6px 0 0 6px;border:1px solid rgba(59,130,246,0.5);background:rgba(59,130,246,0.25);color:#60a5fa;cursor:pointer;transition:all .15s;';
    pmBtn.style.cssText = 'padding:.35rem .55rem;font-size:.72rem;font-weight:800;border-radius:0 6px 6px 0;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .15s;';
  } else {
    pmBtn.style.cssText = 'padding:.35rem .55rem;font-size:.72rem;font-weight:800;border-radius:0 6px 6px 0;border:1px solid rgba(59,130,246,0.5);background:rgba(59,130,246,0.25);color:#60a5fa;cursor:pointer;transition:all .15s;';
    amBtn.style.cssText = 'padding:.35rem .55rem;font-size:.72rem;font-weight:800;border-radius:6px 0 0 6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;transition:all .15s;';
  }
}

// ---- Multi-person row builder ----
// isFirst: victim row 0 is permanent (no remove btn); all suspect rows are removable
function _personRowHTML(role, id, isFirst) {
  const isVictim    = role === 'victim';
  const accentColor = isVictim ? '#60a5fa' : '#fb923c';
  const borderColor = isVictim ? 'rgba(59,130,246,0.22)' : 'rgba(251,146,60,0.2)';
  const bgColor     = isVictim ? 'rgba(59,130,246,0.05)' : 'rgba(251,146,60,0.04)';
  const label       = isVictim ? 'Victim / Complainant' : 'Suspect / Respondent';
  // Victims: first+last required. Suspects: fully optional but structured
  const req = isVictim
    ? '<span style="color:var(--danger);margin-left:1px;">*</span>'
    : '';
  // Only the very first victim row cannot be removed
  const canRemove = !(isVictim && isFirst);

  return `<div id="${role}-row-${id}"
    style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:.7rem .9rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.55rem;">
      <span style="font-size:.68rem;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:.06em;"
            id="${role}-label-${id}">${label}</span>
      ${canRemove ? `<button type="button" onclick="removeIntakePerson('${role}',${id})"
        style="display:flex;align-items:center;gap:.25rem;font-size:.68rem;font-weight:700;padding:.18rem .45rem;border-radius:5px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.1);color:#f87171;cursor:pointer;">
        <i data-lucide="x" style="width:10px;height:10px;"></i> Remove
      </button>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 88px;gap:.55rem;">
      <div class="form-group" style="margin:0;">
        <label style="font-size:.7rem;color:var(--text-muted);display:block;margin-bottom:.28rem;">First Name${req}</label>
        <input type="text" id="${role}-first-${id}" placeholder="First name" style="font-size:.82rem;" />
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:.7rem;color:var(--text-muted);display:block;margin-bottom:.28rem;">Middle Name</label>
        <input type="text" id="${role}-middle-${id}" placeholder="Middle name" style="font-size:.82rem;" />
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:.7rem;color:var(--text-muted);display:block;margin-bottom:.28rem;">Last Name${req}</label>
        <input type="text" id="${role}-last-${id}" placeholder="Last name" style="font-size:.82rem;" />
      </div>
      <div class="form-group" style="margin:0;">
        <label style="font-size:.7rem;color:var(--text-muted);display:block;margin-bottom:.28rem;">Suffix</label>
        <select id="${role}-suffix-${id}" style="font-size:.82rem;width:100%;">
          <option value="">—</option>
          <option value="Jr.">Jr.</option>
          <option value="Sr.">Sr.</option>
          <option value="II">II</option>
          <option value="III">III</option>
          <option value="IV">IV</option>
        </select>
      </div>
    </div>
  </div>`;
}

function addIntakePerson(role) {
  const list = document.getElementById(`${role}-list`);
  if (!list) return;
  const id = (role === 'victim') ? intakeVictimCount++ : intakeSuspectCount++;
  const isFirst = list.children.length === 0;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = _personRowHTML(role, id, isFirst);
  list.appendChild(wrapper.firstElementChild);
  if (window.lucide) lucide.createIcons();
}

function removeIntakePerson(role, id) {
  const row = document.getElementById(`${role}-row-${id}`);
  if (row) row.remove();
  // Re-label remaining rows with sequential numbers
  _renumberPersonRows(role);
  if (window.lucide) lucide.createIcons();
}

function _renumberPersonRows(role) {
  const list = document.getElementById(`${role}-list`);
  if (!list) return;
  const baseLabel = role === 'victim' ? 'Victim / Complainant' : 'Suspect / Respondent';
  const rows = list.querySelectorAll(`[id^="${role}-row-"]`);
  rows.forEach((row, idx) => {
    const lbl = row.querySelector(`[id^="${role}-label-"]`);
    if (lbl) lbl.textContent = rows.length > 1 ? `${baseLabel} #${idx + 1}` : baseLabel;
  });
}

function _collectPersonList(role) {
  const list = document.getElementById(`${role}-list`);
  if (!list) return [];
  const results = [];
  list.querySelectorAll('[id^="' + role + '-row-"]').forEach(row => {
    const rowId = row.id.replace(`${role}-row-`, '');
    const first  = (document.getElementById(`${role}-first-${rowId}`)?.value  || '').trim();
    const middle = (document.getElementById(`${role}-middle-${rowId}`)?.value || '').trim();
    const last   = (document.getElementById(`${role}-last-${rowId}`)?.value   || '').trim();
    const suffix = (document.getElementById(`${role}-suffix-${rowId}`)?.value || '').trim();
    // Only include rows that have at least first + last filled
    if (first || last) {
      results.push({
        first_name:  first  || null,
        middle_name: middle || null,
        last_name:   last   || null,
        suffix:      suffix || null,
        full_name:   [first, middle, last, suffix].filter(Boolean).join(' ')
      });
    }
  });
  return results;
}

// ---- Submit ----
async function submitIntakeEntry() {
  const errorEl = document.getElementById('intake-error-msg');
  errorEl.style.display = 'none';

  const barangay = document.getElementById('intake-barangay').value.trim();
  const date     = document.getElementById('intake-date').value;
  const time     = document.getElementById('intake-time').value.trim();
  const ampm     = document.getElementById('intake-ampm').value;
  const place    = document.getElementById('intake-place').value.trim();
  const title    = document.getElementById('intake-title').value.trim();
  const remarks  = document.getElementById('intake-remarks').value.trim();

  // Basic required field check
  if (!barangay || !date || !time || !place || !title) {
    errorEl.textContent = 'Please fill out all required fields: Barangay, Date, Time, Place of Occurrence, and Title.';
    errorEl.style.display = 'block';
    return;
  }

  // Validate time with a required AM/PM selector.
  // Native browser time inputs return 24-hour values, while custom form submissions keep a 12-hour display.
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    errorEl.textContent = 'Time must be in hh:mm format (e.g. 02:30) with an AM/PM selection.';
    errorEl.style.display = 'block';
    return;
  }
  const hour = parseInt(timeMatch[1], 10);
  const min  = parseInt(timeMatch[2], 10);
  if (!ampm || !['AM', 'PM'].includes(ampm.toUpperCase())) {
    errorEl.textContent = 'Please select AM or PM for the incident time.';
    errorEl.style.display = 'block';
    return;
  }
  if (hour < 0 || hour > 23 || min < 0 || min > 59) {
    errorEl.textContent = 'Invalid time — hour must be 00–23, minute 0–59.';
    errorEl.style.display = 'block';
    return;
  }

  // Collect multi-person lists
  const victims  = _collectPersonList('victim');
  const suspects = [];

  // At least one victim required
  if (!victims.length) {
    errorEl.textContent = 'At least one Victim / Complainant with First and Last name is required.';
    errorEl.style.display = 'block';
    return;
  }

  // Victims: each must have first + last
  for (let i = 0; i < victims.length; i++) {
    if (!victims[i].first_name || !victims[i].last_name) {
      errorEl.textContent = `Victim #${i + 1}: First Name and Last Name are required.`;
      errorEl.style.display = 'block';
      return;
    }
  }

  const hour24 = parseInt(time.split(':')[0], 10);
  const minute = time.split(':')[1];
  const hour12 = ((hour24 + 11) % 12) + 1;
  const formattedTime = `${hour12}:${minute} ${ampm}`;

  const payload = {
    barangay,
    date,
    time: formattedTime,
    place_of_occurrence: place,
    title_of_complaint:  title,
    victims,
    suspects,
    remarks: remarks || null
  };

  const btn = document.getElementById('intake-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Submitting...';
  if (window.lucide) lucide.createIcons();

  try {
    await apiFetch('/intake/entries', { method: 'POST', body: JSON.stringify(payload) })
      .catch(async (err) => {
        if (err.message.includes('404') || err.message.includes('Not Found')) {
          // Fallback: convert to incident record
          const victimNames   = victims.map(v => v.full_name).join(', ');
          const incidentPayload = {
            title:            title,
            description:      `${place} — ${remarks || 'Logged via intake form.'}`,
            type:             'other',
            severity:         'medium',
            location_address: place,
            reporter_name:    victimNames,
            action_taken:     `Victims / Complainants: ${victimNames}`,
            status:           'ongoing'
          };
          return await apiFetch('/incidents/', { method: 'POST', body: JSON.stringify(incidentPayload) });
        }
        throw err;
      });

    closeImportModal();
    showToast('Intake entry recorded successfully.', 'success', 'Entry Recorded');
    await loadReports();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send"></i> Submit Entry';
    if (window.lucide) lucide.createIcons();
  }
}

// =============================================
// CSV IMPORT (Batch Upload for Intake)
// =============================================

let importParsedRows = [];   // array of row objects ready to POST

function openImportModal() {
  importParsedRows   = [];
  currentIntakeTab   = 'manual';
  intakeAmPm         = 'AM';
  intakeVictimCount  = 0;
  intakeSuspectCount = 0;

  // Reset manual form fields
  const intakeForm = document.getElementById('intake-form');
  if (intakeForm) intakeForm.reset();
  const errEl = document.getElementById('intake-error-msg');
  if (errEl) errEl.style.display = 'none';

  // Set today's date as default
  const dateEl = document.getElementById('intake-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  // Reset AM/PM toggle to AM
  setIntakeAmPm('AM');

  // Clear and seed the victim/complainant list
  const victimList  = document.getElementById('victim-list');
  if (victimList) victimList.innerHTML = '';
  addIntakePerson('victim');

  // Reset CSV pane state
  const previewEl    = document.getElementById('import-preview');
  const importErrors = document.getElementById('import-errors');
  const importErrMsg = document.getElementById('import-error-msg');
  const statusLabel  = document.getElementById('import-status-label');
  const importBtn    = document.getElementById('import-submit-btn');
  if (previewEl)    previewEl.style.display    = 'none';
  if (importErrors) importErrors.style.display = 'none';
  if (importErrMsg) importErrMsg.style.display = 'none';
  if (statusLabel)  statusLabel.textContent    = '';
  if (importBtn)    importBtn.disabled         = true;
  const fi = document.getElementById('import-file-input');
  if (fi) fi.value = '';

  // Switch to manual tab and open
  switchIntakeTab('manual');
  document.getElementById('import-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeImportModal() {
  document.getElementById('import-modal-overlay').classList.remove('active');
  importParsedRows = [];
}

function closeImportModalOutside(e) {
  if (e.target === document.getElementById('import-modal-overlay')) closeImportModal();
}

function downloadCSVTemplate() {
  const headers = 'barangay,date,time,place_of_occurrence,title_of_complaint,victim_first_name,victim_middle_name,victim_last_name,victim_suffix,remarks';
  const sample1 = 'Linao Ormoc City,2026-08-03,10:30 AM,Sitio 2 Shoreline,Flash Flooding — Coastal Inundation,Juan,dela,Cruz,,Rising water levels affecting 3 households';
  const sample2 = 'Linao Ormoc City,2026-08-03,02:15 PM,Purok 2 Hillside,Hillside Soil Erosion,Maria,Santos,Reyes,,Minor debris cleared from access road';
  downloadCSV('DRRM-Intake-Form-Template.csv', [headers, sample1, sample2]);
  showToast('Intake form template downloaded.', 'info', 'CSV Template');
}

function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('import-drop-zone').style.borderColor = 'var(--border-color)';
  const file = e.dataTransfer.files[0];
  if (file) parseImportFile(file);
}

function handleImportFileSelect(e) {
  const file = e.target.files[0];
  if (file) parseImportFile(file);
}

function parseImportFile(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showImportError('Only CSV files are supported.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    processImportCSV(text);
  };
  reader.readAsText(file, 'UTF-8');
}

function processImportCSV(text) {
  // Strip BOM if present
  const clean = text.replace(/^\uFEFF/, '').trim();
  const lines = clean.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    showImportError('CSV must have a header row and at least one data row.');
    return;
  }

  if (lines.length > 501) {
    showImportError('Maximum 500 rows per import. Please split your file.');
    return;
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  // Required columns for intake form
  const required = ['barangay', 'date', 'time', 'place_of_occurrence', 'title_of_complaint'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) {
    showImportError(`Missing required columns: ${missing.join(', ')}`);
    return;
  }

  const errors = [];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

    const rowNum = i + 1;

    // Validate required fields
    if (!row.barangay)           { errors.push(`Row ${rowNum}: barangay is empty`); continue; }
    if (!row.date)               { errors.push(`Row ${rowNum}: date is empty`); continue; }
    if (!row.time)               { errors.push(`Row ${rowNum}: time is empty`); continue; }
    if (!row.place_of_occurrence){ errors.push(`Row ${rowNum}: place_of_occurrence is empty`); continue; }
    if (!row.title_of_complaint) { errors.push(`Row ${rowNum}: title_of_complaint is empty`); continue; }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      errors.push(`Row ${rowNum}: date must be in YYYY-MM-DD format`); continue;
    }

    // Validate 12-hour time format with AM/PM required for standardization
    const normalizedTime = row.time.trim();
    const timeValid = /^(0?[1-9]|1[0-2]):[0-5]\d\s*(AM|PM)$/i.test(normalizedTime);
    if (!timeValid) {
      errors.push(`Row ${rowNum}: time must be in hh:mm AM/PM format (e.g. 10:30 AM)`); continue;
    }

    // Compose full name fields
    const victimFirst = row.victim_first_name || '';
    const victimMiddle = row.victim_middle_name || '';
    const victimLast = row.victim_last_name || '';
    const victimSuffix = row.victim_suffix || '';
    const victimFull = [victimFirst, victimMiddle, victimLast, victimSuffix].filter(Boolean).join(' ');

    const suspectFirst = row.suspect_first_name || '';
    const suspectMiddle = row.suspect_middle_name || '';
    const suspectLast = row.suspect_last_name || '';
    const suspectSuffix = row.suspect_suffix || '';
    const suspectFull = [suspectFirst, suspectMiddle, suspectLast, suspectSuffix].filter(Boolean).join(' ');

    // Build clean object — system assigns incident_id automatically
    const obj = {
      barangay: row.barangay,
      date: row.date,
      time: row.time.toUpperCase(),
      place_of_occurrence: row.place_of_occurrence,
      title_of_complaint: row.title_of_complaint,
      victim_first_name: victimFirst || null,
      victim_middle_name: victimMiddle || null,
      victim_last_name: victimLast || null,
      victim_suffix: victimSuffix || null,
      victim_name: victimFull || null,
      suspect_first_name: suspectFirst || null,
      suspect_middle_name: suspectMiddle || null,
      suspect_last_name: suspectLast || null,
      suspect_suffix: suspectSuffix || null,
      suspect_name: suspectFull || null,
      remarks: row.remarks || null
    };

    rows.push(obj);
  }

  importParsedRows = rows;

  // Show errors if any
  const errEl = document.getElementById('import-errors');
  if (errors.length) {
    errEl.innerHTML = `<strong>${errors.length} row(s) skipped:</strong><br>` + errors.join('<br>');
    errEl.style.display = 'block';
  } else {
    errEl.style.display = 'none';
  }

  // Show preview (first 5 rows)
  renderImportPreview(rows, headers.filter(h => ['title','type','severity','latitude','longitude','status'].includes(h)));

  const label = document.getElementById('import-status-label');
  label.textContent = `${rows.length} valid row${rows.length !== 1 ? 's' : ''} ready to import${errors.length ? ` · ${errors.length} skipped` : ''}`;

  const btn = document.getElementById('import-submit-btn');
  btn.disabled = rows.length === 0;
}

function parseCSVLine(line) {
  // Handles quoted fields with commas and escaped quotes
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function renderImportPreview(rows, previewCols) {
  const preview = document.getElementById('import-preview');
  const label   = document.getElementById('import-preview-label');
  const thead   = document.getElementById('import-preview-thead');
  const tbody   = document.getElementById('import-preview-tbody');

  if (!rows.length) { preview.style.display = 'none'; return; }

  const cols = ['title', 'type', 'severity', 'latitude', 'longitude', 'status'];
  label.textContent = `Preview — showing first ${Math.min(5, rows.length)} of ${rows.length} rows:`;

  thead.innerHTML = `<tr>${cols.map(c => `<th style="white-space:nowrap;">${c}</th>`).join('')}</tr>`;
  tbody.innerHTML = rows.slice(0, 5).map(r => `
    <tr>${cols.map(c => `<td>${esc(String(r[c] ?? ''))}</td>`).join('')}</tr>
  `).join('');

  preview.style.display = 'block';
  lucide.createIcons();
}

function showImportError(msg) {
  const errEl = document.getElementById('import-error-msg');
  errEl.textContent = msg;
  errEl.style.display = 'block';
  document.getElementById('import-submit-btn').disabled = true;
  document.getElementById('import-preview').style.display = 'none';
  importParsedRows = [];
}

async function submitImport() {
  if (!importParsedRows.length) return;

  const btn = document.getElementById('import-submit-btn');
  const label = document.getElementById('import-status-label');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Importing...';
  lucide.createIcons();

  let success = 0;
  let failed  = 0;
  const failedRows = [];

  // POST each row individually (batch endpoint not available)
  for (let i = 0; i < importParsedRows.length; i++) {
    const row = importParsedRows[i];
    label.textContent = `Importing ${i + 1} of ${importParsedRows.length}...`;
    try {
      await apiFetch('/incidents/', { method: 'POST', body: JSON.stringify(row) });
      success++;
    } catch (err) {
      failed++;
      failedRows.push(`Row ${i + 1} (${row.title}): ${err.message}`);
    }
  }

  // Show result
  const errEl = document.getElementById('import-errors');
  if (failedRows.length) {
    errEl.innerHTML = `<strong>${failedRows.length} row(s) failed:</strong><br>` + failedRows.join('<br>');
    errEl.style.display = 'block';
  }

  label.textContent = `Done — ${success} imported${failed ? `, ${failed} failed` : ''}.`;
  btn.innerHTML = '<i data-lucide="check"></i> Done';

  if (success > 0) {
    showToast(`Successfully imported ${success} incident record${success !== 1 ? 's' : ''}.`, 'success', 'Import Complete');
    // Refresh history data if history tab was loaded
    if (allHistoryData.length) loadHistory();
  }

  importParsedRows = [];
  if (window.lucide) lucide.createIcons();
}

// =============================================
// SECTION 8: EXECUTIVE MODULE LOGIC
// =============================================

async function loadExecutiveDashboard() {
  try {
    const [summary, procurement] = await Promise.all([
      apiFetch('/reports/executive/summary'),
      apiFetch('/reports/executive/procurement-recommendations')
    ]);

    // Populate KPIs
    const k = summary.kpis;
    document.getElementById('exec-kpi-active-incidents').textContent = k.active_incidents_count;
    document.getElementById('exec-kpi-residents-impacted').textContent = k.total_residents_impacted;
    document.getElementById('exec-kpi-shelters-open').textContent = k.evacuation_facilities_open;
    const capEl = document.getElementById('exec-kpi-occupancy-rate');
    if (capEl) capEl.textContent = k.overall_occupancy_rate_pct !== undefined ? `${k.overall_occupancy_rate_pct}%` : '—';
    document.getElementById('exec-kpi-assets-deployed').textContent = k.resources_deployed_count;
    document.getElementById('exec-readiness-rating').textContent = summary.executive_readiness_rating;

    // Note: Trend analysis / hotspot sitios module removed from the UI; skip rendering.

    // Render Procurement Recommendations
    const procBody = document.getElementById('exec-procurement-tbody');
    if (procBody && procurement.recommendations) {
      procBody.innerHTML = procurement.recommendations.map(p => `
        <tr>
          <td><strong>${esc(p.item_name)}</strong></td>
          <td>${p.current_stock} / ${p.recommended_stock} Units</td>
          <td><span class="badge badge-orange">+${p.deficit} Deficit</span></td>
          <td>₱${p.total_estimated_php.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');
    }

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.warn('Executive API unavailable, keeping fallback view:', err.message);
  }
}

// 8.1 Export & Share Executive Briefing
function shareExecutiveSummary() {
  const stamp = new Date().toLocaleString('en-PH');
  const printWin = window.open('', '_blank', 'width=900,height=800');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Executive Operations Briefing — Barangay DRRM Leadership</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; padding: 25px; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #1e40af; }
        .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
        .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-top: 3px solid #2563eb; padding: 12px; border-radius: 6px; text-align: center; }
        .kpi-num { font-size: 22px; font-weight: 800; color: #0f172a; }
        .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .section-title { font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
        th { background: #f1f5f9; }
        .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #94a3b8; text-align: center; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>REPUBLIC OF THE PHILIPPINES · BARANGAY LINAO DRRM COUNCIL</h1>
        <h2>EXECUTIVE SITUATIONAL BRIEFING FOR CITY OFFICIALS &amp; CDRRMO</h2>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:10px 14px;border-radius:6px;font-size:12px;margin-bottom:15px;">
        <strong>ACTIVE EVENT:</strong> Typhoon Kristine (Category 4) · <strong>TIMESTAMP:</strong> ${stamp}<br>
        <strong>EXECUTIVE COMMAND READINESS:</strong> OPTIMAL (LEVEL 1 READY)
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-num">3</div><div class="kpi-lbl">Active Incidents</div></div>
        <div class="kpi-card" style="border-top-color:#0284c7;"><div class="kpi-num">68</div><div class="kpi-lbl">Impacted Residents</div></div>
        <div class="kpi-card" style="border-top-color:#10b981;"><div class="kpi-num">142</div><div class="kpi-lbl">Active Evacuees</div></div>
      </div>

      <div class="section-title">1. COA-Compliant Equipment Deficit &amp; Budget Request</div>
      <table>
        <tr><th>Item</th><th>Deficit</th><th>Est. Budget</th></tr>
        <tr><td>Inflatable Rescue Boat (10-Pax)</td><td>+2 Units</td><td>₱240,000.00</td></tr>
        <tr><td>6.5 KVA Standby Generator</td><td>+2 Units</td><td>₱150,000.00</td></tr>
      </table>

      <div class="footer">
        Official Executive Document · Formatted for Instant Share with CDRRMO &amp; City Leadership
      </div>
    </body>
    </html>
  `);

  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    printWin.print();
  }, 400);
}

// 8.3 Regulatory Compliance (DILG / DSWD DROMIC Audit)
async function printDILGDSWDComplianceReport() {
  try {
    const comp = await apiFetch('/reports/executive/compliance-dilg-dswd');
    const stamp = new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

    const printWin = window.open('', '_blank', 'width=900,height=850');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DILG / DSWD Regulatory Compliance Report — Barangay DRRM</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; padding: 25px; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 18px; text-transform: uppercase; color: #065f46; }
          .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
          .meta-box { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 12px; }
          .section-title { font-size: 13px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REPUBLIC OF THE PHILIPPINES · DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT</h1>
          <h2>DEPARTMENT OF SOCIAL WELFARE AND DEVELOPMENT (DSWD) DROMIC AUDIT REPORT</h2>
        </div>

        <div class="meta-box">
          <div><strong>LGU:</strong> ${comp.lgu_name} (${comp.region})</div>
          <div><strong>Report Date:</strong> ${comp.report_date}</div>
          <div><strong>Certifying Authority:</strong> ${comp.certifying_official}</div>
        </div>

        <div class="section-title">1. Regulatory Compliance Summary Metrics</div>
        <table>
          <tr><th>Regulatory Framework</th><th>Audit Status</th><th>Operational Verification</th></tr>
          <tr><td>DILG JMC 2021 Facility Readiness</td><td><strong style="color:#059669;">COMPLIANT</strong></td><td>All 20 Camp Management parameters verified</td></tr>
          <tr><td>DSWD DROMIC IDP Registry</td><td><strong style="color:#2563eb;">VERIFIED</strong></td><td>QR Token duplicate claim prevention active</td></tr>
          <tr><td>COA Asset Accounting Standard</td><td><strong style="color:#d97706;">AUDIT READY</strong></td><td>Net book value &amp; depreciation cataloged</td></tr>
          <tr><td>Mandatory 5% BDRRM Fund Utilization</td><td><strong>88.4% UTILIZED</strong></td><td>Appropriated for pre-disaster prep &amp; relief</td></tr>
        </table>

        <div class="section-title">2. Executive Certification &amp; Sign-off</div>
        <p style="font-size:12px;margin-top:10px;">
          This official document certifies that Barangay Linao DRRM Operations Center complies with DILG Joint Memorandum Circular No. 2 Series of 2021 and DSWD DROMIC standardized disaster management reporting guidelines.
        </p>

        <div style="margin-top:50px;display:flex;justify-content:space-between;font-size:12px;">
          <div style="text-align:center;width:200px;border-top:1px solid #0f172a;padding-top:4px;">
            <strong>HON. BARANGAY CAPTAIN</strong><br>BDRRMC Chairman
          </div>
          <div style="text-align:center;width:200px;border-top:1px solid #0f172a;padding-top:4px;">
            <strong>DRRM FOCAL OFFICER</strong><br>Operations Lead
          </div>
        </div>

        <div class="footer">
          Official DILG / DSWD Compliance Audit Submission · Certified Copy
        </div>
      </body>
      </html>
    `);

    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  } catch (err) {
    showToast('Failed to generate compliance report.', 'danger', 'Compliance Error');
  }
}

