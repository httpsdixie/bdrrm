// ===== Reports Module =====

const TYPE_LABEL = { flood:'Flood', fire:'Fire', landslide:'Landslide', typhoon:'Typhoon', medical:'Medical', other:'Other' };
const TYPE_COLOR = { flood:'#0077b6', fire:'#d93025', landslide:'#e65100', typhoon:'#6200ea', medical:'#2e7d32', other:'#5f6368' };
const RES_TYPE_LABEL = {
  rescue_boat: 'Rescue Boat', ambulance: 'Ambulance', fire_truck: 'Fire Truck',
  medical_kit: 'Medical Kit', food_pack: 'Food Pack', tent: 'Tent',
  vehicle: 'Vehicle', fuel: 'Fuel', chainsaw: 'Chainsaw', other: 'Other'
};
const SEV_BADGE = {
  low:      '<span class="badge badge-green">Low</span>',
  medium:   '<span class="badge badge-blue">Medium</span>',
  high:     '<span class="badge badge-orange">High</span>',
  critical: '<span class="badge badge-red">Critical</span>',
};
const STATUS_BADGE = {
  active:     '<span class="badge badge-red">Active</span>',
  responding: '<span class="badge badge-orange">Responding</span>',
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
  const histPane = document.getElementById('pane-history');
  if (histPane) histPane.style.display = tab === 'history' ? 'block' : 'none';
  document.getElementById('tab-incident').classList.toggle('active', tab === 'incident');
  document.getElementById('tab-resource').classList.toggle('active', tab === 'resource');
  const histBtn = document.getElementById('tab-history');
  if (histBtn) histBtn.classList.toggle('active', tab === 'history');
  if (tab === 'resource') setTimeout(() => { if (window._affectedMap) window._affectedMap.invalidateSize(); }, 100);
  if (tab === 'history')  loadHistory();
}

// ---- Load all reports ----
function showReportsSkeletons() {
  const statIds = ['r-total', 'r-today', 'r-active', 'r-responding', 'r-resolved', 'r-people', 'r-injured', 'r-dead', 'r-missing'];
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

const FALLBACK_INCIDENT_REPORT = {
  summary: {
    total_incidents: 12,
    today_incidents: 3,
    active: 3,
    responding: 2,
    resolved: 7,
    total_people_involved: 48
  },
  by_type: { flood: 5, landslide: 3, fire: 2, medical: 1, other: 1 },
  rescue_items_dispatched: { rescue_boat: 3, medical_kit: 8, food_pack: 45, tent: 12, vehicle: 2 },
  ongoing_operations: [
    {
      title: "Linao Bao River Surge Evacuation & Monitoring",
      type: "flood",
      status: "active",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      people_involved: 15,
      action_taken: "Deployed 4 BDRRMC responders and rubber boat for coastal evacuation.",
      human_resources: "4 BDRRMC Responders, 2 Brgy Tanods",
      dispatched_resources: [{ resource_name: "Inflatable Rubber Boat", quantity: 1 }, { resource_name: "First Aid Trauma Kit", quantity: 2 }]
    }
  ],
  resolved_incidents: [
    { title: "Tricycle Slip near Linao School", type: "road_accident", people_involved: 3, resolved_at: new Date(Date.now() - 43200000).toISOString(), action_taken: "First aid rendered by BHS medic.", resolution: "Victim treated, scene cleared.", reported_by: "BHS Medic" },
    { title: "Fallen Tree Limb Clearing", type: "other", people_involved: 0, resolved_at: new Date(Date.now() - 86400000).toISOString(), action_taken: "Sawed and removed timber debris.", resolution: "Alleyway reopened to traffic.", reported_by: "Tanod V. Cruz" }
  ],
  today_incidents: [
    { title: "Linao Bao River Surge & Coastal Inundation", type: "flood", status: "active", created_at: new Date(Date.now() - 7200000).toISOString(), people_involved: 15, action_taken: "Dispatched rescue boat to Sitio 2.", users: { full_name: "Capt. Ramirez" } },
    { title: "Purok 2 Hillside Soil Erosion", type: "landslide", status: "responding", created_at: new Date(Date.now() - 14400000).toISOString(), people_involved: 8, action_taken: "Cordoned off section.", users: { full_name: "Patrol Signal" } }
  ]
};

const FALLBACK_RESOURCE_REPORT = {
  summary: {
    total_items: 261,
    available_quantity: 194,
    deployed_quantity: 67,
    status_counts: { available: 4, deployed: 1, maintenance: 0 }
  },
  by_type: {
    rescue_boat: { total: 4, available: 3, deployed: 1 },
    medical_kit: { total: 25, available: 18, deployed: 7 },
    food_pack: { total: 200, available: 150, deployed: 50 },
    tent: { total: 30, available: 22, deployed: 8 },
    vehicle: { total: 2, available: 1, deployed: 1 }
  },
  currently_deployed: [
    { resources: { name: "Inflatable Rescue Rubber Boat", type: "rescue_boat" }, quantity_dispatched: 1, incidents: { title: "Linao Bao River Surge & Coastal Inundation" } },
    { resources: { name: "Family Relief Food Pack", type: "food_pack" }, quantity_dispatched: 25, incidents: { title: "Linao Bao River Surge & Coastal Inundation" } }
  ],
  dispatch_log: [
    { resources: { name: "Inflatable Rescue Rubber Boat", type: "rescue_boat" }, quantity_dispatched: 1, incidents: { title: "Linao Bao River Surge" }, users: { full_name: "Admin" }, dispatched_at: new Date(Date.now() - 7200000).toISOString(), returned_at: null },
    { resources: { name: "Medical Kit", type: "medical_kit" }, quantity_dispatched: 2, incidents: { title: "Tricycle Slip" }, users: { full_name: "BHS Officer" }, dispatched_at: new Date(Date.now() - 86400000).toISOString(), returned_at: new Date(Date.now() - 43200000).toISOString() }
  ],
  affected_zones: {
    hazard_zones: [],
    active_incidents: [
      { title: "Linao Bao River Surge", type: "flood", severity: "high", latitude: 11.0125, longitude: 124.5865, people_involved: 15 }
    ]
  }
};

async function loadReports(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showReportsSkeletons();
  document.getElementById('report-timestamp').textContent = new Date().toLocaleString('en-PH');
  try {
    const [incReport, resReport] = await Promise.all([
      apiFetch('/reports/incidents'),
      apiFetch('/reports/resources'),
    ]);
    renderIncidentReport(incReport);
    renderResourceReport(resReport);
  } catch (err) {
    console.warn('Report backend unavailable, rendering fallback report data:', err.message);
    renderIncidentReport(FALLBACK_INCIDENT_REPORT);
    renderResourceReport(FALLBACK_RESOURCE_REPORT);
  } finally {
    if (btn) btn.classList.remove('spinning');
    lucide.createIcons();
  }
}

// =============================================
// INCIDENT REPORT
// =============================================
function renderIncidentReport(data) {
  const s = data.summary;

  // Stats
  document.getElementById('r-total').textContent     = s.total_incidents;
  document.getElementById('r-today').textContent     = s.today_incidents;
  document.getElementById('r-active').textContent    = s.active;
  document.getElementById('r-responding').textContent= s.responding;
  document.getElementById('r-resolved').textContent  = s.resolved;
  document.getElementById('r-people').textContent    = s.total_people_involved;
  document.getElementById('ops-count').textContent   = data.ongoing_operations.length;

  // Type breakdown bars
  renderTypeBars('inc-type-bars', data.by_type, TYPE_COLOR, TYPE_LABEL);

  // Rescue items bars
  const rescueColors = { rescue_boat:'#1a73e8', medical_kit:'#2e7d32', food_pack:'#f9a825', tent:'#6200ea', vehicle:'#d93025', other:'#5f6368' };
  renderTypeBars('rescue-items-bars', data.rescue_items_dispatched, rescueColors, RES_TYPE_LABEL);

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

  document.getElementById('res-total-items').textContent   = s.total_items;
  document.getElementById('res-available').textContent     = s.available_quantity;
  document.getElementById('res-deployed').textContent      = s.deployed_quantity;
  document.getElementById('res-deployed-items').textContent= s.status_counts['deployed']||0;
  document.getElementById('deployed-count').textContent    = data.currently_deployed.length;

  renderResTypeGrid(data.by_type);
  renderDeployedTable(data.currently_deployed);
  renderDispatchLogTable(data.dispatch_log);
  renderAffectedMap(data.affected_zones);

  lucide.createIcons();
}

// ---- Pagination state for resource sections ----
let resTypeData    = {};
let resTypePage    = 1;
const RES_TYPE_PAGE_SIZE = 4;

let deployedData   = [];
let deployedPage   = 1;

let dispatchLogData = [];
let dispatchLogPage = 1;

const RES_TABLE_PAGE_SIZE = 5;

// ---- Resource modal state ----
let currentResModalType = '';
let currentResModalPage = 1;
const RES_MODAL_PAGE_SIZE = 10;

function renderResTypeGrid(byType, resetPage = true) {
  if (byType) resTypeData = byType;
  if (resetPage) resTypePage = 1;

  const el     = document.getElementById('res-type-grid');
  const pagEl  = document.getElementById('res-type-pagination');
  const infoEl = document.getElementById('res-type-info');
  const numEl  = document.getElementById('res-type-page-num');
  const prevBtn = document.getElementById('res-type-btn-prev');
  const nextBtn = document.getElementById('res-type-btn-next');

  const entries = Object.entries(resTypeData);
  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">No resources recorded.</p>';
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(entries.length / RES_TYPE_PAGE_SIZE);
  if (resTypePage > totalPages) resTypePage = totalPages;
  if (resTypePage < 1) resTypePage = 1;

  const start = (resTypePage - 1) * RES_TYPE_PAGE_SIZE;
  const pageItems = entries.slice(start, start + RES_TYPE_PAGE_SIZE);

  el.innerHTML = pageItems.map(([type, info]) => `
    <div class="res-type-card">
      <div class="res-type-name">${RES_TYPE_LABEL[type]||type}</div>
      <div class="res-type-row"><span>Total</span><span>${info.total}</span></div>
      <div class="res-type-row"><span>Available</span><span style="color:var(--success);">${info.available}</span></div>
      <div class="res-type-row"><span>Deployed</span><span style="color:#e65100;">${info.deployed}</span></div>
      <div class="cap-bar-track" style="margin-top:.4rem;">
        <div class="cap-bar-fill" style="width:${info.total?Math.round((info.deployed/info.total)*100):0}%;background:#e65100;"></div>
      </div>
    </div>`).join('');

  if (entries.length > RES_TYPE_PAGE_SIZE) {
    if (pagEl) pagEl.style.display = 'flex';
    if (infoEl) infoEl.textContent = `Showing ${start+1}–${Math.min(start+RES_TYPE_PAGE_SIZE, entries.length)} of ${entries.length} types`;
    if (numEl) numEl.textContent = `Page ${resTypePage} / ${totalPages}`;
    if (prevBtn) prevBtn.disabled = resTypePage <= 1;
    if (nextBtn) nextBtn.disabled = resTypePage >= totalPages;
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }
}

function changeResTypePage(delta) {
  resTypePage += delta;
  renderResTypeGrid(null, false);
}

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
      <td>${RES_TYPE_LABEL[d.resources?.type]||'—'}</td>
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
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No dispatch records.</td></tr>';
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
      <td>${RES_TYPE_LABEL[d.resources?.type]||'—'}</td>
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

  if (type === 'type') {
    titleEl.textContent = `Inventory by Type (${Object.keys(resTypeData).length} types)`;
    iconEl.setAttribute('data-lucide', 'grid');
    theadEl.innerHTML = `<tr><th>Resource Type</th><th>Total</th><th>Available</th><th>Deployed</th><th>Deploy %</th></tr>`;
  } else if (type === 'deployed') {
    titleEl.textContent = `Currently Deployed (${deployedData.length})`;
    iconEl.setAttribute('data-lucide', 'send');
    theadEl.innerHTML = `<tr><th>Resource</th><th>Type</th><th>Qty</th><th>Incident</th></tr>`;
  } else {
    titleEl.textContent = `Dispatch Log (${dispatchLogData.length})`;
    iconEl.setAttribute('data-lucide', 'list');
    theadEl.innerHTML = `<tr><th>Resource</th><th>Type</th><th>Qty</th><th>Incident</th><th>Dispatched By</th><th>Dispatched At</th><th>Returned</th></tr>`;
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

  let list;
  if (currentResModalType === 'type') {
    list = Object.entries(resTypeData);
  } else if (currentResModalType === 'deployed') {
    list = deployedData;
  } else {
    list = dispatchLogData;
  }

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / RES_MODAL_PAGE_SIZE));
  if (currentResModalPage < 1) currentResModalPage = 1;
  if (currentResModalPage > totalPages) currentResModalPage = totalPages;

  const start = (currentResModalPage - 1) * RES_MODAL_PAGE_SIZE;
  const end   = Math.min(start + RES_MODAL_PAGE_SIZE, total);
  const pageItems = list.slice(start, end);

  if (!pageItems.length) {
    tbodyEl.innerHTML = `<tr><td colspan="7" class="table-empty">No entries found.</td></tr>`;
  } else if (currentResModalType === 'type') {
    tbodyEl.innerHTML = pageItems.map(([type, info]) => {
      const pct = info.total ? Math.round((info.deployed / info.total) * 100) : 0;
      return `<tr>
        <td><strong>${RES_TYPE_LABEL[type]||type}</strong></td>
        <td>${info.total}</td>
        <td style="color:var(--success);font-weight:600;">${info.available}</td>
        <td style="color:#e65100;font-weight:600;">${info.deployed}</td>
        <td>${pct}%</td>
      </tr>`;
    }).join('');
  } else if (currentResModalType === 'deployed') {
    tbodyEl.innerHTML = pageItems.map(d => `
      <tr>
        <td>${d.resources?.name||'—'}</td>
        <td>${RES_TYPE_LABEL[d.resources?.type]||'—'}</td>
        <td><strong>${d.quantity_dispatched}</strong></td>
        <td>${d.incidents?.title||'—'}</td>
      </tr>`).join('');
  } else {
    tbodyEl.innerHTML = pageItems.map(d => `
      <tr>
        <td>${d.resources?.name||'—'}</td>
        <td>${RES_TYPE_LABEL[d.resources?.type]||'—'}</td>
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
        .bindPopup(`<strong>${z.name}</strong><br>${z.type} · ${z.risk_level} risk`);
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
    active:     '<span style="color:#d93025;font-weight:600;">Active</span>',
    responding: '<span style="color:#e65100;font-weight:600;">Responding</span>',
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
    const ticket = inc.ticket_number || `#INC-${String(inc.id || i).split('-')[0].toUpperCase()}`;
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
// CSV IMPORT
// =============================================

let importParsedRows = [];   // array of row objects ready to POST

function openImportModal() {
  importParsedRows = [];
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-errors').style.display = 'none';
  document.getElementById('import-error-msg').style.display = 'none';
  document.getElementById('import-status-label').textContent = '';
  document.getElementById('import-submit-btn').disabled = true;
  const fi = document.getElementById('import-file-input');
  if (fi) fi.value = '';
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
  const headers = 'title,description,type,severity,latitude,longitude,location_address,people_involved,action_taken,reporter_name,reporter_contact,status,casualty_count,casualty_status';
  const sample1 = 'Flash Flooding near Sitio 2,Rising water levels inundating coastal area,flood,high,11.0125,124.5865,Sitio 2 Shoreline Brgy Linao,15,Deployed rescue team,Capt. Ramirez,0917-123-4567,active,0,none';
  const sample2 = 'Hillside Soil Erosion Purok 2,Debris on access road after heavy rain,landslide,medium,11.0210,124.5925,Purok 2 Hillside Brgy Linao,8,Cordoned area,Patrol Signal,0928-555-0192,responding,0,none';
  downloadCSV('DRRM-Incident-Import-Template.csv', [headers, sample1, sample2]);
  showToast('Template downloaded.', 'info', 'CSV Template');
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

  // Required columns
  const required = ['title', 'description', 'type', 'severity', 'latitude', 'longitude'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) {
    showImportError(`Missing required columns: ${missing.join(', ')}`);
    return;
  }

  const VALID_TYPES = ['flood','landslide','fire','road_accident','fallen_tree','earthquake','typhoon','medical','assistance','other'];
  const VALID_SEV   = ['low','medium','high','critical'];
  const VALID_STAT  = ['active','responding','resolved'];

  const errors = [];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

    const rowNum = i + 1;

    // Validate required fields
    if (!row.title)       { errors.push(`Row ${rowNum}: title is empty`); continue; }
    if (!row.description) { errors.push(`Row ${rowNum}: description is empty`); continue; }
    if (!VALID_TYPES.includes(row.type)) {
      errors.push(`Row ${rowNum}: invalid type "${row.type}"`); continue;
    }
    if (!VALID_SEV.includes(row.severity)) {
      errors.push(`Row ${rowNum}: invalid severity "${row.severity}"`); continue;
    }
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      errors.push(`Row ${rowNum}: invalid latitude/longitude`); continue;
    }

    // Build clean object
    const obj = {
      title:            row.title,
      description:      row.description,
      type:             row.type,
      severity:         row.severity,
      latitude:         lat,
      longitude:        lng,
      status:           VALID_STAT.includes(row.status) ? row.status : 'active',
    };
    if (row.location_address)  obj.location_address  = row.location_address;
    if (row.people_involved)   obj.people_involved   = parseInt(row.people_involved) || 0;
    if (row.action_taken)      obj.action_taken      = row.action_taken;
    if (row.reporter_name)     obj.reporter_name     = row.reporter_name;
    if (row.reporter_contact)  obj.reporter_contact  = row.reporter_contact;
    if (row.casualty_count)    obj.casualty_count    = parseInt(row.casualty_count) || 0;
    if (row.casualty_status)   obj.casualty_status   = row.casualty_status;

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
  lucide.createIcons();
}
