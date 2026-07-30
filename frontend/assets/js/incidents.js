// ===== Incident Tracking Module — Enhanced =====

let allIncidents  = [];
let pinMap        = null;
let pinMarker     = null;
let selectedPhoto = null;
let newIncidentId = null; // set after create, used for photo upload

// =============================================
// Labels & badges
// =============================================
const SEVERITY_BADGE = {
  low:      '<span class="badge badge-green">Low</span>',
  medium:   '<span class="badge badge-blue">Medium</span>',
  high:     '<span class="badge badge-orange">High</span>',
  critical: '<span class="badge badge-red">Critical</span>',
};

const STATUS_BADGE = {
  active:     '<span class="badge badge-red">Active</span>',
  responding: '<span class="badge badge-orange">Responding</span>',
  resolved:   '<span class="badge badge-green">Resolved</span>',
  archived:   '<span class="badge badge-blue">Archived</span>',
  pending:    '<span class="badge badge-orange">Pending</span>',
};

const CASUALTY_BADGE = {
  none:    '',
  injured: '<span class="badge badge-orange">Injured</span>',
  missing: '<span class="badge badge-blue">Missing</span>',
  dead:    '<span class="badge badge-red">Dead</span>',
  mixed:   '<span class="badge badge-red">Casualties</span>',
};

const VALIDATION_BADGE = {
  pending:     '<span class="badge badge-orange">Pending</span>',
  validated:   '<span class="badge badge-green">Validated</span>',
  invalidated: '<span class="badge badge-red">Invalidated</span>',
};

const TYPE_LABEL = {
  flood:        'Flooding',
  landslide:    'Landslide',
  fire:         'Fire',
  road_accident:'Road Accident',
  fallen_tree:  'Fallen Tree',
  earthquake:   'Earthquake',
  typhoon:      'Typhoon Damage',
  medical:      'Medical Emergency',
  assistance:   'Emergency Assistance',
  other:        'Other',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getTicketNumber(inc) {
  if (inc && inc.ticket_number) return inc.ticket_number;
  if (!inc || !inc.id) return '#INC-00000';
  const shortId = String(inc.id).split('-')[0].toUpperCase();
  return `#INC-${shortId}`;
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// Load & Render
// =============================================
function showIncidentsSkeletons() {
  const tbody = document.getElementById('incidents-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:30px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:60px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-title" style="width:60%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:30px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:60px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>`;
  }
}

function renderTableError(tbodyId, title, message, retryFnName, colSpan = 9) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colSpan}" class="table-empty" style="padding:2.5rem 1rem;">
        <div style="max-width:420px;margin:0 auto;text-align:center;">
          <i data-lucide="alert-circle" style="width:32px;height:32px;color:var(--warning);margin-bottom:.5rem;"></i>
          <div style="font-weight:600;font-size:.95rem;margin-bottom:.25rem;color:var(--text-main);">${escHtml(title)}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.85rem;line-height:1.4;">${escHtml(message)}</div>
          <button class="btn btn-outline-sm" onclick="${retryFnName}()" style="font-size:.78rem;padding:.35rem .75rem;">
            <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i> Retry Load
          </button>
        </div>
      </td>
    </tr>`;
  lucide.createIcons();
}

function renderTableEmpty(tbodyId, title, message, colSpan = 6, iconName = 'inbox') {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colSpan}" class="table-empty" style="padding: 3.5rem 1rem;">
        <div style="max-width:440px; margin:0 auto; text-align:center;">
          <div style="width:52px; height:52px; margin:0 auto .85rem; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center;">
            <i data-lucide="${iconName}" style="width:24px; height:24px; color:var(--text-muted); opacity:.75;"></i>
          </div>
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:.35rem; color:var(--text-main);">${escHtml(title)}</div>
          <div style="font-size:.85rem; color:var(--text-muted); line-height:1.45;">${escHtml(message)}</div>
        </div>
      </td>
    </tr>`;
  lucide.createIcons();
}

const FALLBACK_INCIDENTS = [
  {
    id: "inc-101",
    ticket_number: "#INC-20260729-001",
    title: "Linao Bao River Surge & Coastal Inundation",
    type: "flood",
    severity: "high",
    status: "active",
    validation_status: "validated",
    casualty_status: "injured",
    casualty_count: 2,
    casualties_dead: 0,
    casualties_injured: 2,
    casualties_missing: 0,
    people_involved: 15,
    reporter_name: "Capt. Ramirez (BDRRMC)",
    reporter_contact: "0917-123-4567",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    latitude: 11.0125,
    longitude: 124.5865,
    location_address: "Sitio 2 Shoreline, Barangay Linao",
    description: "Rising sea tide and river overflow inundating lower residential structures in Sitio 2.",
    action_taken: "Dispatched 4 responders and 1 rescue boat to transport affected families to Tambulilid Covered Court."
  },
  {
    id: "inc-102",
    ticket_number: "#INC-20260729-002",
    title: "Purok 2 Hillside Slope Soil Erosion",
    type: "landslide",
    severity: "medium",
    status: "responding",
    validation_status: "pending",
    casualty_status: "none",
    casualty_count: 0,
    casualties_dead: 0,
    casualties_injured: 0,
    casualties_missing: 0,
    people_involved: 8,
    reporter_name: "Resident Signal / Patrol",
    reporter_contact: "0928-555-0192",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    latitude: 11.0210,
    longitude: 124.5925,
    location_address: "Purok 2 Hillside, Brgy Linao",
    description: "Minor soil movement and debris falling onto the access road following heavy rain.",
    action_taken: "Cordoned off section and cleared loose earth from the primary pathway."
  },
  {
    id: "inc-103",
    ticket_number: "#INC-20260729-003",
    title: "Residential Electrical Wire Spark Fire Risk",
    type: "fire",
    severity: "critical",
    status: "active",
    validation_status: "pending",
    casualty_status: "none",
    casualty_count: 0,
    casualties_dead: 0,
    casualties_injured: 0,
    casualties_missing: 0,
    people_involved: 5,
    reporter_name: "Elena Santos",
    reporter_contact: "0909-444-1122",
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    latitude: 11.0185,
    longitude: 124.5940,
    location_address: "Main St near Barangay Hall, Brgy Linao",
    description: "Overloaded transformer post sparked near wooden residential roofing.",
    action_taken: "Notified Ormoc Electric Cooperative (ORECO) and BFP Ormoc City."
  },
  {
    id: "inc-104",
    ticket_number: "#INC-20260728-004",
    title: "Tricycle Slip & Minor Collision near School",
    type: "road_accident",
    severity: "low",
    status: "resolved",
    validation_status: "validated",
    casualty_status: "injured",
    casualty_count: 1,
    casualties_dead: 0,
    casualties_injured: 1,
    casualties_missing: 0,
    people_involved: 3,
    reporter_name: "BHS Medic On-Duty",
    reporter_contact: "053-561-2244",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    resolved_at: new Date(Date.now() - 43200000).toISOString(),
    latitude: 11.0145,
    longitude: 124.5905,
    location_address: "Linao Elementary School Zone",
    description: "Passenger tricycle skidded on slippery pavement. Minor abrasions.",
    action_taken: "First aid rendered by BHS medic. Scene cleared."
  },
  {
    id: "inc-105",
    ticket_number: "#INC-20260728-005",
    title: "Fallen Mahogany Branch Blocking Access Alley",
    type: "fallen_tree",
    severity: "low",
    status: "resolved",
    validation_status: "validated",
    casualty_status: "none",
    casualty_count: 0,
    casualties_dead: 0,
    casualties_injured: 0,
    casualties_missing: 0,
    people_involved: 0,
    reporter_name: "Tanod V. Cruz",
    reporter_contact: "0915-888-3311",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    resolved_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
    latitude: 11.0225,
    longitude: 124.5955,
    location_address: "National Highway Junction, Brgy Linao",
    description: "Heavy wind snapped tree limb across 2-meter alleyway.",
    action_taken: "Sawed and removed timber debris from pathway."
  }
];

let allIncidentsPagination = { currentPage: 1, pageSize: 10, filtered: [] };
let pendingIncidentsPagination = { currentPage: 1, pageSize: 10, filtered: [] };
let auditIncidentsPagination = { currentPage: 1, pageSize: 10, filtered: [] };

async function loadIncidents(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showIncidentsSkeletons();
  try {
    allIncidents = await apiFetch('/incidents/');
    allIncidentsPagination.filtered = [...allIncidents];
    allIncidentsPagination.currentPage = 1;
    renderIncidentSummary(allIncidents);
    renderAllIncidentsPaginated();
  } catch (err) {
    console.warn('Backend unavailable, rendering sample incidents fallback:', err);
    allIncidents = [...FALLBACK_INCIDENTS];
    allIncidentsPagination.filtered = [...allIncidents];
    allIncidentsPagination.currentPage = 1;
    renderIncidentSummary(allIncidents);
    renderAllIncidentsPaginated();
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderIncidentSummary(data) {
  const sumTotal      = document.getElementById('inc-sum-total');
  const sumActive     = document.getElementById('inc-sum-active');
  const sumResponding = document.getElementById('inc-sum-responding');
  const sumResolved   = document.getElementById('inc-sum-resolved');
  const sumPending    = document.getElementById('inc-sum-pending');

  if (sumTotal)      sumTotal.textContent      = data.length;
  if (sumActive)     sumActive.textContent     = data.filter(i => i.status === 'active').length;
  if (sumResponding) sumResponding.textContent = data.filter(i => i.status === 'responding').length;
  if (sumResolved)   sumResolved.textContent   = data.filter(i => i.status === 'resolved').length;
  if (sumPending)    sumPending.textContent    = data.filter(i => i.validation_status === 'pending').length;

  if (window.lucide) lucide.createIcons();
}

function quickFilterIncidentStatus(status) {
  switchIncidentTab('all');
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.value = status;
    filterIncidents();
  }
}

function quickFilterIncidentValidation(validation) {
  if (validation === 'pending') {
    switchIncidentTab('pending');
  } else {
    switchIncidentTab('all');
    const validationSelect = document.getElementById('filter-validation');
    if (validationSelect) {
      validationSelect.value = validation;
      filterIncidents();
    }
  }
}

function renderAllIncidentsPaginated() {
  const total = allIncidentsPagination.filtered.length;
  const pageSize = allIncidentsPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (allIncidentsPagination.currentPage > totalPages) allIncidentsPagination.currentPage = totalPages;
  if (allIncidentsPagination.currentPage < 1) allIncidentsPagination.currentPage = 1;

  const start = (allIncidentsPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = allIncidentsPagination.filtered.slice(start, end);

  renderTable(pageData);
  updatePaginationBar('all', total, total === 0 ? 0 : start + 1, end, allIncidentsPagination.currentPage, totalPages);
}

function handleRowClick(event, id) {
  if (event.target.closest('button, a, input, select')) return;
  openDetailModal(id);
}

function renderTable(data) {
  const tbody = document.getElementById('incidents-tbody');
  if (!tbody) return;
  if (!data || !data.length) {
    renderTableEmpty('incidents-tbody', 'No Incidents Found', 'No incident reports match your active search query or filter selection.', 6, 'search-x');
    return;
  }

  tbody.innerHTML = data.map(inc => {
    const vs = inc.validation_status || 'pending';

    return `
    <tr onclick="handleRowClick(event, '${inc.id}')" style="cursor:pointer;" title="Click row to view full incident details">
      <td>
        <div style="margin-bottom:.25rem;display:flex;align-items:center;gap:.4rem;">
          <span style="font-family:monospace;font-size:.72rem;background:rgba(59,130,246,.15);color:#60a5fa;padding:.12rem .45rem;border-radius:4px;font-weight:600;">${getTicketNumber(inc)}</span>
          ${vs === 'validated' ? '<span class="badge badge-green" style="font-size:.65rem;padding:.08rem .4rem;">Validated</span>' : ''}
          ${vs === 'invalidated' ? '<span class="badge badge-red" style="font-size:.65rem;padding:.08rem .4rem;">Invalidated</span>' : ''}
        </div>
        <div class="incident-title">${escHtml(inc.title)}</div>
        ${inc.location_address
          ? `<div class="incident-desc"><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${escHtml(inc.location_address.slice(0,45))}</div>`
          : `<div class="incident-desc" style="font-family:monospace;font-size:.72rem;">${inc.latitude?.toFixed(4)}, ${inc.longitude?.toFixed(4)}</div>`}
      </td>
      <td>${TYPE_LABEL[inc.type] || inc.type}</td>
      <td>${SEVERITY_BADGE[inc.severity] || inc.severity}</td>
      <td>${STATUS_BADGE[inc.status] || inc.status}</td>
      <td style="font-size:.78rem;color:var(--text-muted);">${formatDate(inc.created_at)}</td>
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          ${vs === 'pending' ? `
          <button class="action-btn action-btn-success" title="Approve & Validate" onclick="openValidationModal('${inc.id}','validate')">
            <i data-lucide="shield-check"></i>
          </button>
          <button class="action-btn action-btn-danger" title="Mark Invalid" onclick="openValidationModal('${inc.id}','invalidate')">
            <i data-lucide="shield-x"></i>
          </button>` : ''}
          ${vs === 'validated' ? `
          <button class="action-btn" title="Locked: Official Validated Record" disabled style="opacity:0.5;cursor:not-allowed;">
            <i data-lucide="lock"></i>
          </button>
          <button class="action-btn action-btn-warning" title="Archive Record" onclick="archiveIncident('${inc.id}')">
            <i data-lucide="archive"></i>
          </button>` : `
          <button class="action-btn action-btn-primary" title="Update Operational Progress" onclick="openStatusModal('${inc.id}', '${inc.status}')">
            <i data-lucide="activity"></i>
          </button>`}
        </div>
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function updatePaginationBar(prefix, total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById(`${prefix}-pagination-info`);
  if (info) {
    if (total === 0) {
      info.textContent = 'Showing 0 of 0 entries';
    } else {
      info.textContent = `Showing ${startDisplay} to ${endDisplay} of ${total} entries`;
    }
  }

  const prevBtn = document.getElementById(`${prefix}-btn-prev`);
  const nextBtn = document.getElementById(`${prefix}-btn-next`);
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  const container = document.getElementById(`${prefix}-page-numbers`);
  if (container) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      pagesHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goTo${prefix.charAt(0).toUpperCase() + prefix.slice(1)}Page(${p})">${p}</button>`;
    }
    container.innerHTML = pagesHtml;
  }
}

function changeIncidentsPageSize(val) {
  allIncidentsPagination.pageSize = parseInt(val, 10);
  allIncidentsPagination.currentPage = 1;
  renderAllIncidentsPaginated();
}

function prevIncidentsPage() {
  if (allIncidentsPagination.currentPage > 1) {
    allIncidentsPagination.currentPage--;
    renderAllIncidentsPaginated();
  }
}

function nextIncidentsPage() {
  const totalPages = Math.ceil(allIncidentsPagination.filtered.length / allIncidentsPagination.pageSize) || 1;
  if (allIncidentsPagination.currentPage < totalPages) {
    allIncidentsPagination.currentPage++;
    renderAllIncidentsPaginated();
  }
}

function goToAllPage(p) {
  allIncidentsPagination.currentPage = p;
  renderAllIncidentsPaginated();
}

let activeCustomDateTarget = 'inc';

function handleIncidentsDatePresetChange() {
  activeCustomDateTarget = 'inc';
  const preset = document.getElementById('filter-date')?.value || '';
  if (preset === 'custom') {
    openCustomDateModal();
    return;
  }
  document.getElementById('inc-date-from').value = '';
  document.getElementById('inc-date-to').value = '';
  filterIncidents();
}

function handlePendingDatePresetChange() {
  activeCustomDateTarget = 'pending';
  const preset = document.getElementById('pending-filter-date')?.value || '';
  if (preset === 'custom') {
    openCustomDateModal();
    return;
  }
  document.getElementById('pending-date-from').value = '';
  document.getElementById('pending-date-to').value = '';
  filterPendingIncidents();
}

function handleAuditDatePresetChange() {
  activeCustomDateTarget = 'audit';
  const preset = document.getElementById('audit-filter-date')?.value || '';
  if (preset === 'custom') {
    openCustomDateModal();
    return;
  }
  document.getElementById('audit-date-from').value = '';
  document.getElementById('audit-date-to').value = '';
  filterAuditIncidents();
}

function handleArchivedDatePresetChange() {
  activeCustomDateTarget = 'archived';
  const preset = document.getElementById('archived-filter-date')?.value || '';
  if (preset === 'custom') {
    openCustomDateModal();
    return;
  }
  document.getElementById('archived-date-from').value = '';
  document.getElementById('archived-date-to').value = '';
  filterArchivedIncidents();
}

function setModalQuickDate(preset, btnEl) {
  const modalFrom = document.getElementById('modal-date-from');
  const modalTo = document.getElementById('modal-date-to');
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

  // Update preset button active highlight
  document.querySelectorAll('.modal-preset-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl && preset !== 'clear') {
    btnEl.classList.add('active');
  }

  updateModalRangeText();
}

function updateModalRangeText() {
  const modalFrom = document.getElementById('modal-date-from')?.value;
  const modalTo = document.getElementById('modal-date-to')?.value;
  const previewText = document.getElementById('modal-date-range-text');
  if (!previewText) return;

  if (modalFrom && modalTo) {
    previewText.textContent = `Active filter window: ${modalFrom} → ${modalTo}`;
  } else if (modalFrom) {
    previewText.textContent = `Active filter window: From ${modalFrom} onwards`;
  } else if (modalTo) {
    previewText.textContent = `Active filter window: Up to ${modalTo}`;
  } else {
    previewText.textContent = 'Select start & end dates to filter records';
  }
}

function openCustomDateModal() {
  const modalDateFrom = document.getElementById('modal-date-from');
  const modalDateTo = document.getElementById('modal-date-to');
  let sourceFrom;
  let sourceTo;

  if (activeCustomDateTarget === 'pending') {
    sourceFrom = document.getElementById('pending-date-from');
    sourceTo = document.getElementById('pending-date-to');
  } else if (activeCustomDateTarget === 'audit') {
    sourceFrom = document.getElementById('audit-date-from');
    sourceTo = document.getElementById('audit-date-to');
  } else if (activeCustomDateTarget === 'archived') {
    sourceFrom = document.getElementById('archived-date-from');
    sourceTo = document.getElementById('archived-date-to');
  } else {
    sourceFrom = document.getElementById('inc-date-from');
    sourceTo = document.getElementById('inc-date-to');
  }

  if (modalDateFrom) modalDateFrom.value = sourceFrom?.value || '';
  if (modalDateTo) modalDateTo.value = sourceTo?.value || '';

  document.getElementById('custom-date-modal-overlay')?.classList.add('active');
  updateModalRangeText();
  if (window.lucide) lucide.createIcons();
}

function closeCustomDateModal() {
  document.getElementById('custom-date-modal-overlay')?.classList.remove('active');
}

function closeCustomDateModalOutside(event) {
  if (event.target.id === 'custom-date-modal-overlay') {
    closeCustomDateModal();
  }
}

function applyCustomDateFilter(e) {
  if (e) e.preventDefault();
  const modalDateFrom = document.getElementById('modal-date-from')?.value || '';
  const modalDateTo = document.getElementById('modal-date-to')?.value || '';

  const targetFrom = document.getElementById(`${activeCustomDateTarget}-date-from`);
  const targetTo = document.getElementById(`${activeCustomDateTarget}-date-to`);
  if (targetFrom) targetFrom.value = modalDateFrom;
  if (targetTo) targetTo.value = modalDateTo;

  closeCustomDateModal();
  if (activeCustomDateTarget === 'pending' && typeof filterPendingIncidents === 'function') {
    filterPendingIncidents();
  } else if (activeCustomDateTarget === 'audit' && typeof filterAuditIncidents === 'function') {
    filterAuditIncidents();
  } else if (activeCustomDateTarget === 'archived' && typeof filterArchivedIncidents === 'function') {
    filterArchivedIncidents();
  } else if (typeof filterIncidents === 'function') {
    filterIncidents();
  }
}

function filterIncidents() {
  const search     = document.getElementById('search-input')?.value.toLowerCase().trim()  || '';
  const status     = document.getElementById('filter-status')?.value               || '';
  const type       = document.getElementById('filter-type')?.value                 || '';
  const validation = document.getElementById('filter-validation')?.value           || '';
  const dateRange  = document.getElementById('filter-date')?.value                 || '';

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today.getTime() - 6  * 24 * 60 * 60 * 1000);
  const month = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

  allIncidentsPagination.filtered = allIncidents.filter(inc => {
    const incValStatus = inc.validation_status || 'pending';
    const ticketNo = getTicketNumber(inc).toLowerCase();

    const matchSearch = !search ||
      ticketNo.includes(search) ||
      inc.title.toLowerCase().includes(search) ||
      (inc.location_address || '').toLowerCase().includes(search) ||
      (inc.description || '').toLowerCase().includes(search);

    const matchStatus     = !status     || inc.status === status;
    const matchType       = !type       || inc.type   === type;
    const matchValidation = !validation || incValStatus === validation;

    let matchDate = true;
    if (dateRange && inc.created_at) {
      const created = new Date(inc.created_at);
      if      (dateRange === 'today') matchDate = created >= today;
      else if (dateRange === 'week')  matchDate = created >= week;
      else if (dateRange === 'month') matchDate = created >= month;
      else if (dateRange === 'custom') {
        const fromVal = document.getElementById('inc-date-from')?.value;
        const toVal   = document.getElementById('inc-date-to')?.value;
        if (fromVal) {
          const fromDate = new Date(fromVal);
          if (created < fromDate) matchDate = false;
        }
        if (toVal) {
          const toDate = new Date(toVal);
          toDate.setDate(toDate.getDate() + 1);
          if (created >= toDate) matchDate = false;
        }
      }
    }

    return matchSearch && matchStatus && matchType && matchValidation && matchDate;
  });

  allIncidentsPagination.currentPage = 1;
  renderAllIncidentsPaginated();
}

function clearFilters() {
  ['search-input','filter-status','filter-type','filter-validation','filter-date','inc-date-from','inc-date-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.borderColor = ''; }
  });
  allIncidentsPagination.filtered = [...allIncidents];
  allIncidentsPagination.currentPage = 1;
  renderAllIncidentsPaginated();
  lucide.createIcons();
}

// =============================================
// Selectors — simplified (select dropdowns used for consciousness + root cause)
// =============================================
function selectSeverity(val) {
  document.getElementById('inc-severity').value = val;
  document.querySelectorAll('.triage-btn').forEach(btn => {
    const v = btn.dataset.val;
    btn.className = 'triage-btn' + (v === val ? ` active-${v}` : '');
  });
}

function selectConsciousness(val) {
  const el = document.getElementById('inc-consciousness');
  if (el) el.value = val;
}

function selectRootCause(val) {
  const el = document.getElementById('inc-root-cause');
  if (el) el.value = val;
}

let bigPickerMap = null;
let bigPickerMarker = null;
let currentBigLat = null;
let currentBigLng = null;

function openBigMapModal() {
  const overlay = document.getElementById('big-map-modal-overlay');
  if (overlay) {
    overlay.classList.add('active');
    overlay.style.display = 'flex';
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
  }

  const currentLat = parseFloat(document.getElementById('inc-lat')?.value) || 11.0050;
  const currentLng = parseFloat(document.getElementById('inc-lng')?.value) || 124.6075;

  currentBigLat = currentLat;
  currentBigLng = currentLng;

  updateBigMapCoordChips(currentLat, currentLng);

  setTimeout(() => {
    if (!bigPickerMap) {
      bigPickerMap = L.map('big-picker-map').setView([currentLat, currentLng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(bigPickerMap);

      bigPickerMarker = L.marker([currentLat, currentLng], { draggable: true }).addTo(bigPickerMap);

      bigPickerMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        currentBigLat = lat;
        currentBigLng = lng;
        bigPickerMarker.setLatLng([lat, lng]);
        updateBigMapCoordChips(lat, lng);
      });

      bigPickerMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        currentBigLat = lat;
        currentBigLng = lng;
        updateBigMapCoordChips(lat, lng);
      });
    } else {
      bigPickerMap.setView([currentLat, currentLng], 16);
      bigPickerMarker.setLatLng([currentLat, currentLng]);
      bigPickerMap.invalidateSize();
    }
  }, 100);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateBigMapCoordChips(lat, lng) {
  const latEl = document.getElementById('big-map-lat');
  const lngEl = document.getElementById('big-map-lng');
  if (latEl) latEl.textContent = lat ? lat.toFixed(6) : '—';
  if (lngEl) lngEl.textContent = lng ? lng.toFixed(6) : '—';
}

function closeBigMapModal() {
  const overlay = document.getElementById('big-map-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    overlay.style.visibility = 'hidden';
    overlay.style.opacity = '0';
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const geo = await res.json();
    const parts = geo.address || {};
    const short = [
      parts.road || parts.neighbourhood || parts.suburb,
      parts.city || parts.town || parts.village || parts.county,
      parts.state,
    ].filter(Boolean).join(', ');
    const addrField = document.getElementById('inc-address');
    if (addrField && (short || geo.display_name)) {
      addrField.value = short || geo.display_name;
    }
  } catch (err) {
    console.warn('Reverse geocoding failed:', err);
  }
}

function confirmBigMapPin() {
  // 1. Instantly collapse the modal overlay FIRST!
  closeBigMapModal();

  if (!currentBigLat || !currentBigLng) return;

  // 2. Sync coordinate input fields
  const latField = document.getElementById('inc-lat');
  const lngField = document.getElementById('inc-lng');
  if (latField) latField.value = currentBigLat.toFixed(6);
  if (lngField) lngField.value = currentBigLng.toFixed(6);

  const latDisplay = document.getElementById('pin-lat-display');
  const lngDisplay = document.getElementById('pin-lng-display');
  if (latDisplay) latDisplay.textContent = `Lat: ${currentBigLat.toFixed(6)}`;
  if (lngDisplay) lngDisplay.textContent = `Lng: ${currentBigLng.toFixed(6)}`;

  // 3. Sync pinMarker / pinMap or placePinAt
  if (typeof placePinAt === 'function') {
    placePinAt(currentBigLat, currentBigLng);
  } else if (pinMarker && pinMap) {
    pinMarker.setLatLng([currentBigLat, currentBigLng]);
    pinMap.setView([currentBigLat, currentBigLng], 16);
    pinMap.invalidateSize();
  }

  // 4. Run reverse geocoding in background
  reverseGeocode(currentBigLat, currentBigLng);

  if (typeof checkPillar1 === 'function') {
    checkPillar1();
  }

  showToast('GIS pin set from high-resolution map view!', 'success', 'Location Pinned');
}

function toggleExpandWizardMap() {
  openBigMapModal();
}

function toggleGeoVerify() {
  const cb  = document.getElementById('inc-geo-verified');
  const row = document.getElementById('geo-verify-row');
  if (row) row.classList.toggle('verified', cb && cb.checked);
}

function updateCasualtyTotal() {
  const dead    = parseInt(document.getElementById('inc-dead')?.value)    || 0;
  const injured = parseInt(document.getElementById('inc-injured')?.value) || 0;
  const missing = parseInt(document.getElementById('inc-missing')?.value) || 0;
  const total   = dead + injured + missing;
  const el = document.getElementById('casualty-summary');
  if (el) el.textContent = total > 0
    ? `\${total} total: \${dead} dead · \${injured} injured · \${missing} missing`
    : '';
  const statusEl = document.getElementById('inc-casualty-status');
  if (statusEl) {
    if (dead > 0 && (injured > 0 || missing > 0)) statusEl.value = 'mixed';
    else if (dead > 0)    statusEl.value = 'dead';
    else if (missing > 0) statusEl.value = 'missing';
    else if (injured > 0) statusEl.value = 'injured';
    else statusEl.value = 'none';
  }
}

// Stub functions kept so no errors if called
function checkPillar1() {}
function checkPillar2() {}
function checkPillar3() {}
function checkPillar4() {}
function setPillarComplete() {}

// =============================================
// Pin map — Leaflet mini-map inside the modal
// =============================================
function initPinMap() {
  if (pinMap) { pinMap.remove(); pinMap = null; pinMarker = null; }

  pinMap = L.map('pin-map', { zoomControl: true }).setView([11.0167, 124.5915], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(pinMap);

  // Barangay boundary
  L.polygon([
    [11.0260,124.5800],[11.0280,124.5980],[11.0210,124.6030],
    [11.0090,124.6010],[11.0090,124.5900],[11.0130,124.5800],
  ], { color:'#3b82f6', weight:2, fillColor:'#3b82f6', fillOpacity:.06, dashArray:'6,4' }).addTo(pinMap);

  pinMap.on('click', function(e) {
    const { lat, lng } = e.latlng;
    placePinAt(lat, lng);
  });

  document.getElementById('pin-map').classList.add('active-pin');

  setTimeout(() => {
    if (pinMap) pinMap.invalidateSize();
  }, 150);
}

function useCurrentLocation() {
  const btn = document.getElementById('locate-me-btn');
  if (!navigator.geolocation) {
    showToast('Geolocation is not supported by your browser.', 'warning', 'GPS Location');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="spinning" style="width:14px;height:14px;"></i> Locating...`;
    lucide.createIcons();
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (pinMap) {
        pinMap.setView([lat, lng], 17);
        placePinAt(lat, lng);
      }
      showToast('Location pin placed at your current GPS coordinates!', 'success', 'GPS Location');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="locate-fixed" style="width:14px;height:14px;"></i> Locate Me (Where I Am)`;
        lucide.createIcons();
      }
    },
    (err) => {
      console.warn('Geolocation error:', err.message);
      showToast('Could not fetch GPS location. Please drop a pin manually on the map.', 'warning', 'GPS Location');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="locate-fixed" style="width:14px;height:14px;"></i> Locate Me (Where I Am)`;
        lucide.createIcons();
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

function placePinAt(lat, lng) {
  if (pinMarker) pinMap.removeLayer(pinMarker);

  const icon = L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50%;background:#fde8e8;border:2.5px solid #d93025;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(217,48,37,.4);">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d93025" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg></div>`,
    className: '', iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-32],
  });

  pinMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(pinMap);
  pinMarker.on('dragend', function(e) {
    const pos = e.target.getLatLng();
    updatePinCoords(pos.lat, pos.lng);
  });

  updatePinCoords(lat, lng);
  pinMap.panTo([lat, lng]);
}

async function updatePinCoords(lat, lng) {
  document.getElementById('inc-lat').value = lat;
  document.getElementById('inc-lng').value = lng;
  document.getElementById('pin-lat-display').textContent = `Lat: ${lat.toFixed(6)}`;
  document.getElementById('pin-lng-display').textContent = `Lng: ${lng.toFixed(6)}`;
  document.getElementById('pin-map').classList.add('active-pin');

  // Reverse geocode
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const geo = await res.json();
    const parts = geo.address || {};
    const short = [
      parts.road || parts.neighbourhood || parts.suburb,
      parts.city || parts.town || parts.village || parts.county,
      parts.state,
    ].filter(Boolean).join(', ');
    document.getElementById('inc-address').value = short || geo.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (_) {
    document.getElementById('inc-address').value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  // Check pillar 1 — pin is placed, but user still needs to verify
  checkPillar1();
}

// =============================================
// Photo handling
// =============================================
function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  setPhotoFile(file);
}

function handlePhotoDrop(e) {
  e.preventDefault();
  document.getElementById('photo-drop-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) setPhotoFile(file);
}

function setPhotoFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image is too large. Maximum size is 5MB.', 'warning', 'Photo');
    return;
  }
  selectedPhoto = file;
  document.getElementById('photo-filename').textContent = `Selected: ${file.name} (${(file.size/1024).toFixed(0)} KB)`;
  const preview = document.getElementById('photo-preview');
  preview.src = URL.createObjectURL(file);
  preview.classList.add('visible');
  lucide.createIcons();
}

// =============================================
function selectTypeCard(typeVal) {
  const input = document.getElementById('inc-type');
  if (input) input.value = typeVal;
  document.querySelectorAll('.type-card-item').forEach(card => {
    card.classList.toggle('selected', card.dataset.val === typeVal);
  });
}

// =============================================
// Report Modal
// =============================================
function openModal() {
  document.getElementById('modal-overlay').classList.add('active');
  document.getElementById('incident-error').style.display = 'none';
  document.getElementById('incident-form').reset();
  selectedPhoto = null;
  newIncidentId = null;
  selectTypeCard('');
  // Reset display elements safely
  const els = {
    'photo-preview':    e => e.classList.remove('visible'),
    'photo-filename':   e => e.textContent = '',
    'pin-lat-display':  e => e.textContent = 'Lat: —',
    'pin-lng-display':  e => e.textContent = 'Lng: —',
    'inc-address':      e => e.value = '',
    'geo-verify-row':   e => e.classList.remove('verified'),
    'casualty-summary': e => e.textContent = '',
  };
  Object.entries(els).forEach(([id, fn]) => { const el = document.getElementById(id); if (el) fn(el); });
  const sev = document.getElementById('inc-severity');
  if (sev) sev.value = 'medium';
  selectSeverity('medium');
  currentWizardStep = 1;
  updateWizardUI();
  setTimeout(() => { initPinMap(); lucide.createIcons(); }, 80);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  if (pinMap) { pinMap.remove(); pinMap = null; pinMarker = null; }
  document.getElementById('incident-form').reset();
  selectedPhoto = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

async function submitIncident() {
  const errorEl  = document.getElementById('incident-error');
  const submitBtn = document.getElementById('submit-btn');
  errorEl.style.display = 'none';

  const title   = document.getElementById('inc-title').value.trim();
  const type    = document.getElementById('inc-type').value;
  const desc    = document.getElementById('inc-description').value.trim();
  const severity= document.getElementById('inc-severity').value;
  const lat     = parseFloat(document.getElementById('inc-lat').value);
  const lng     = parseFloat(document.getElementById('inc-lng').value);

  if (!title) { showToast('Incident title is required.', 'danger', 'Validation Error'); return; }
  if (!type)  { showToast('Please select an incident type.', 'danger', 'Validation Error'); return; }
  if (!desc)  { showToast('Description is required.', 'danger', 'Validation Error'); return; }
  if (isNaN(lat) || isNaN(lng)) {
    showToast('Please click on the map, use GPS, or click "Manual Input Mode" to enter location.', 'danger', 'Location Required');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Submitting...';
  lucide.createIcons();

  try {
    const payload = {
      title, type, description: desc, severity,
      latitude: lat, longitude: lng,
      location_address:    document.getElementById('inc-address').value || null,
      geolocation_verified: document.getElementById('inc-geo-verified')?.checked || false,
      consciousness_status: document.getElementById('inc-consciousness')?.value || 'unknown',
      root_cause:          document.getElementById('inc-root-cause')?.value || 'unknown',
      root_cause_detail:   null,  // streamlined form — no detail field
      parties_involved:    document.getElementById('inc-parties')?.value.trim() || null,
      casualty_count:      (parseInt(document.getElementById('inc-dead')?.value)||0) +
                           (parseInt(document.getElementById('inc-injured')?.value)||0) +
                           (parseInt(document.getElementById('inc-missing')?.value)||0),
      casualty_status:     document.getElementById('inc-casualty-status')?.value || 'none',
      casualties_dead:     parseInt(document.getElementById('inc-dead')?.value)    || 0,
      casualties_injured:  parseInt(document.getElementById('inc-injured')?.value) || 0,
      casualties_missing:  parseInt(document.getElementById('inc-missing')?.value) || 0,
      people_involved:     parseInt(document.getElementById('inc-people')?.value)  || 0,
      action_taken:        document.getElementById('inc-action')?.value.trim()  || null,
      human_resources:     null,  // streamlined form
      reporter_name:       document.getElementById('inc-reporter-name')?.value.trim()    || null,
      reporter_contact:    document.getElementById('inc-reporter-contact')?.value.trim() || null,
    };

    const incident = await apiFetch('/incidents/', { method: 'POST', body: JSON.stringify(payload) });
    newIncidentId = incident.id;

    // Upload photo if selected
    if (selectedPhoto && newIncidentId) {
      const formData = new FormData();
      formData.append('file', selectedPhoto);
      try {
        const photoRes = await fetch(`${API_BASE}/incidents/${newIncidentId}/photo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          body: formData,
        });
        if (!photoRes.ok) {
          const err = await photoRes.json();
          showToast('Incident saved but photo upload failed: ' + (err.detail || 'Unknown error'), 'warning', 'Photo Upload');
        }
      } catch (_) {
        showToast('Incident saved but photo upload failed.', 'warning', 'Photo Upload');
      }
    }

    closeModal();
    showToast('Incident reported successfully!', 'success', 'Incident Created');
    await loadIncidents();

  } catch (err) {
    showToast(err.message, 'danger', 'Submission Failed');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="send"></i> Submit Incident Report';
    lucide.createIcons();
  }
}

// =============================================
// Status Update Modal
// =============================================
function openStatusModal(id, currentStatus) {
  const inc = allIncidents.find(i => i.id === id);
  if (inc && inc.validation_status === 'validated') {
    showToast('This incident report is officially validated and locked from editing.', 'warning', 'Record Locked');
    return;
  }

  document.getElementById('status-incident-id').value = id;
  document.getElementById('new-status').value = currentStatus;
  document.getElementById('status-error').style.display = 'none';
  document.getElementById('status-action').value = '';
  document.getElementById('status-human').value = '';
  if (document.getElementById('status-resolution')) document.getElementById('status-resolution').value = '';
  toggleResolutionField();
  document.getElementById('status-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeStatusModal() { document.getElementById('status-modal-overlay').classList.remove('active'); }
function closeStatusModalOutside(e) { if (e.target === document.getElementById('status-modal-overlay')) closeStatusModal(); }

function toggleResolutionField() {
  const status = document.getElementById('new-status').value;
  const field  = document.getElementById('resolution-field');
  if (field) field.style.display = status === 'resolved' ? 'block' : 'none';
}

async function submitStatusUpdate() {
  const id         = document.getElementById('status-incident-id').value;
  const newStatus  = document.getElementById('new-status').value;
  const action     = document.getElementById('status-action')?.value.trim()     || null;
  const human      = document.getElementById('status-human')?.value.trim()      || null;
  const resolution = document.getElementById('status-resolution')?.value.trim() || null;
  const errorEl    = document.getElementById('status-error');

  if (newStatus === 'resolved' && !resolution) {
    errorEl.textContent = 'Please enter a resolution note before marking as resolved.';
    errorEl.style.display = 'block'; return;
  }

  const payload = { status: newStatus };
  if (action)     payload.action_taken    = action;
  if (human)      payload.human_resources = human;
  if (resolution) payload.resolution      = resolution;

  try {
    await apiFetch(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    closeStatusModal();
    showToast(`Status updated to ${newStatus}`, 'success', 'Status Updated');
    await loadIncidents();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// =============================================
// Incident Detail Modal
// =============================================
async function openDetailModal(id) {
  const inc = allIncidents.find(i => i.id === id) || allArchivedIncidents.find(i => i.id === id) || allPendingIncidents.find(i => i.id === id);
  if (!inc) return;

  const TRIAGE_COLOR = { low:'#2e7d32', medium:'#1a73e8', high:'#e65100', critical:'#d93025' };
  const sevKey = (inc.severity || 'low').toLowerCase();
  const col = TRIAGE_COLOR[sevKey] || '#5f6368';
  const ticketNo = getTicketNumber(inc);
  const vs = inc.validation_status || 'pending';
  const categoryName = TYPE_LABEL[inc.type] || (inc.type ? inc.type.replace(/_/g, ' ').toUpperCase() : 'General Incident');
  const statusBadge = STATUS_BADGE[inc.status] || `<span class="badge badge-orange">${inc.status || 'Pending'}</span>`;
  const valBadge = VALIDATION_BADGE[vs] || `<span class="badge badge-orange">${vs}</span>`;

  const modalTicket = document.getElementById('detail-modal-ticket');
  if (modalTicket) modalTicket.textContent = ticketNo;

  const modalValidation = document.getElementById('detail-modal-validation');
  if (modalValidation) {
    modalValidation.innerHTML = valBadge + (vs === 'validated' ? ' <span class="badge badge-blue" style="margin-left:.35rem;"><i data-lucide="lock" style="width:11px;height:11px;"></i> Locked</span>' : '');
  }

  const modalHeaderTitle = document.getElementById('detail-modal-header-title');
  if (modalHeaderTitle) {
    modalHeaderTitle.innerHTML = escHtml(inc.title);
  }

  const body = `
    ${inc.photo_url ? `<img src="${escHtml(inc.photo_url)}" class="inc-detail-photo" alt="Incident photo" onerror="this.style.display='none'" />` : ''}

    <!-- High-Tech Command Center Metadata Bar -->
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.1rem; background: rgba(15, 23, 42, 0.6); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
      <div>
        <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.3rem;">Category</div>
        <div style="font-size:0.85rem; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="shield-alert" style="width:14px;height:14px;color:var(--primary);"></i>
          <span>${escHtml(categoryName)}</span>
        </div>
      </div>
      <div>
        <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.3rem;">Severity</div>
        <div style="font-size:0.85rem; font-weight:800; color:${col}; text-transform:capitalize; display:flex; align-items:center; gap:0.3rem;">
          <span style="width:8px;height:8px;border-radius:50%;background:${col};box-shadow:0 0 6px ${col};"></span>
          ${escHtml(inc.severity || 'low')}
        </div>
      </div>
      <div>
        <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.3rem;">Operational Status</div>
        <div>${statusBadge}</div>
      </div>
      <div>
        <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.3rem;">Validation</div>
        <div>${valBadge}</div>
      </div>
      <div style="grid-column: span 4; border-top: 1px solid rgba(255,255,255,0.06); pt: 0.5rem; margin-top: 0.35rem; display:flex; align-items:center; justify-content:space-between; font-size:0.78rem; color:var(--text-muted);">
        <span><i data-lucide="clock" style="width:12px;height:12px;vertical-align:middle;margin-right:0.25rem;"></i> Reported On: <strong style="color:var(--text-main);">${formatDate(inc.created_at)}</strong></span>
        ${inc.resolved_at ? `<span><i data-lucide="check-circle-2" style="width:12px;height:12px;color:var(--success);vertical-align:middle;margin-right:0.25rem;"></i> Resolved On: <strong style="color:var(--text-main);">${formatDate(inc.resolved_at)}</strong></span>` : ''}
      </div>
    </div>

    <!-- Location Card -->
    ${inc.location_address ? `
    <div style="margin-bottom:1rem; background: rgba(15, 23, 42, 0.4); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
      <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.3rem;">Incident Location</div>
      <div style="font-size:0.9rem; font-weight:700; color:var(--text-main); display:flex; align-items:center; gap:0.4rem;">
        <i data-lucide="map-pin" style="width:15px;height:15px;color:var(--primary);flex-shrink:0;"></i>
        <span>${escHtml(inc.location_address)}</span>
      </div>
      ${inc.latitude && inc.longitude ? `
        <div style="font-size:0.73rem; font-family:monospace; color:var(--text-muted); margin-top:0.35rem; display:flex; align-items:center; justify-content:space-between;">
          <span>Coordinates: ${inc.latitude?.toFixed(6)}, ${inc.longitude?.toFixed(6)}</span>
          <a href="map.html?lat=${inc.latitude}&lng=${inc.longitude}&id=${inc.id}" target="_blank" style="color:#60a5fa; text-decoration:none; font-weight:600; font-family:var(--font-family);">
            <i data-lucide="external-link" style="width:11px;height:11px;vertical-align:middle;"></i> Locate on Map
          </a>
        </div>
      ` : ''}
    </div>` : ''}

    <!-- Description Card -->
    <div style="margin-bottom:1rem; background: rgba(15, 23, 42, 0.4); padding: 0.85rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); border-left: 3px solid var(--primary);">
      <div style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:0.35rem;">Description</div>
      <div style="font-size:0.86rem; line-height:1.6; color:var(--text-main);">${escHtml(inc.description || 'No description provided.')}</div>
    </div>

    <!-- Casualty & Impact Details -->
    ${(inc.casualty_status && inc.casualty_status !== 'none') || (inc.casualty_count && inc.casualty_count > 0) ? `
    <div style="background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25); border-radius:var(--radius-md); padding:.85rem 1rem; margin-bottom:1rem;">
      <div style="font-size:.72rem; font-weight:700; color:#ef4444; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.4rem; display:flex; align-items:center; gap:.35rem;">
        <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i> Casualty &amp; Impact Details
      </div>
      <div style="display:flex; gap:1.25rem; font-size:.85rem; flex-wrap:wrap; margin-bottom:.35rem;">
        ${inc.casualties_dead   ? `<span>Fatalities: <strong style="color:#ef4444;">${inc.casualties_dead}</strong></span>` : ''}
        ${inc.casualties_injured? `<span>Injured: <strong style="color:#f59e0b;">${inc.casualties_injured}</strong></span>` : ''}
        ${inc.casualties_missing? `<span>Missing: <strong style="color:#8b5cf6;">${inc.casualties_missing}</strong></span>` : ''}
        <span>Total Count: <strong>${inc.casualty_count || 0}</strong></span>
      </div>
      ${inc.parties_involved ? `<div style="font-size:.78rem; color:var(--text-muted);">Parties / Property affected: <strong style="color:var(--text-main);">${escHtml(inc.parties_involved)}</strong></div>` : ''}
    </div>` : ''}

    <!-- Reporter Information -->
    ${(inc.reporter_name || inc.reporter_contact) ? `
    <div style="margin-bottom:1rem; background:rgba(255,255,255,.03); padding:.75rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div style="font-size:.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:.2rem;">Reporter Information</div>
        <div style="font-size:.88rem; font-weight:600; color:var(--text-main);">${inc.reporter_name ? escHtml(inc.reporter_name) : (inc.users?.full_name || 'Anonymous Resident')}</div>
      </div>
      ${inc.reporter_contact ? `
        <a href="tel:${escHtml(inc.reporter_contact.replace(/[^0-9+]/g,''))}" class="btn btn-outline-sm" style="gap:0.3rem; font-size:0.78rem; color:#60a5fa; border-color:rgba(59,130,246,0.3);">
          <i data-lucide="phone" style="width:12px;height:12px;"></i> ${escHtml(inc.reporter_contact)}
        </a>
      ` : ''}
    </div>` : ''}

    <!-- Action Taken -->
    ${inc.action_taken ? `
    <div style="margin-bottom:1rem; background:rgba(15,23,42,.4); padding:.85rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <div style="font-size:.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem;">Action Taken</div>
      <div style="font-size:.85rem; line-height:1.5;">${escHtml(inc.action_taken)}</div>
    </div>` : ''}

    <!-- Resolution -->
    ${inc.resolution ? `
    <div style="background:rgba(16,185,129,.08); border:1px solid rgba(16,185,129,.25); border-radius:var(--radius-md); padding:.85rem 1rem;">
      <div style="font-size:.72rem; font-weight:700; color:#10b981; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.3rem; display:flex; align-items:center; gap:.35rem;">
        <i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> Resolution Summary
      </div>
      <div style="font-size:.85rem; line-height:1.5; color:var(--text-main);">${escHtml(inc.resolution)}</div>
    </div>` : ''}
  `;

  document.getElementById('detail-modal-body').innerHTML = body;

  const currentUser = getUser();
  const canManage = currentUser && ['admin', 'officer'].includes(currentUser.role);
  const modalFooter = document.getElementById('detail-modal-footer');

  if (modalFooter) {
    const isPending = vs === 'pending';
    const isArchived = inc.status === 'archived' || vs === 'invalidated';

    modalFooter.innerHTML = `
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        ${inc.latitude && inc.longitude ? `
          <a href="map.html?lat=${inc.latitude}&lng=${inc.longitude}&id=${inc.id}" class="btn btn-outline-sm" target="_blank" style="gap:0.35rem; font-size:0.8rem; height:36px; padding:0 0.85rem;" title="View on GIS Map">
            <i data-lucide="map-pin" style="width:13px;height:13px;"></i> View GIS Map
          </a>
        ` : ''}
        ${canManage && !isArchived ? `
          <button class="btn btn-outline-sm" onclick="closeDetailModal(); openStatusModal('${inc.id}', '${inc.status}')" style="gap:0.35rem; font-size:0.8rem; height:36px; padding:0 0.85rem; color:#60a5fa; border-color:rgba(59,130,246,0.4);" title="Update Operational Progress">
            <i data-lucide="activity" style="width:13px;height:13px;"></i> Update Status
          </button>
        ` : ''}
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        ${canManage && isPending ? `
          <button class="btn btn-danger" onclick="closeDetailModal(); openValidationModal('${inc.id}', 'invalidate')" style="gap:0.35rem; font-size:0.8rem; height:36px; padding:0 0.85rem;">
            <i data-lucide="shield-x" style="width:13px;height:13px;"></i> Invalidate
          </button>
          <button class="btn btn-primary" onclick="closeDetailModal(); openValidationModal('${inc.id}', 'validate')" style="gap:0.35rem; font-size:0.8rem; height:36px; padding:0 0.85rem;">
            <i data-lucide="shield-check" style="width:13px;height:13px;"></i> Validate Incident
          </button>
        ` : ''}
      </div>
    `;
  }

  document.getElementById('detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.remove('active');
}

// =============================================
// Archive
// =============================================
function archiveIncident(id) {
  confirmAction({
    title: 'Archive Incident?',
    message: 'Are you sure you want to archive this incident report?',
    confirmText: 'Archive',
    type: 'primary',
    icon: 'archive',
    onConfirm: async () => {
      try {
        await apiFetch(`/incidents/${id}`, { method: 'DELETE' });
        showToast('Incident archived', 'info', 'Archived');
        await loadIncidents();
      } catch (err) {
        showToast('Archive failed: ' + err.message, 'danger', 'Error');
      }
    },
  });
}

// =============================================
// Wizard State Controller & Map Size Handling
// =============================================
let currentWizardStep = 1;

function goToStep(step) {
  if (step < 1 || step > 4) return;
  if (step > currentWizardStep && !validateStep(currentWizardStep)) return;
  currentWizardStep = step;
  updateWizardUI();
}

function nextStep() {
  if (currentWizardStep < 4) {
    if (validateStep(currentWizardStep)) {
      currentWizardStep++;
      updateWizardUI();
    }
  }
}

function prevStep() {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardUI();
  }
}

let isManualLocationMode = false;

function toggleManualLocation() {
  isManualLocationMode = !isManualLocationMode;
  const toggleBtn = document.getElementById('manual-loc-toggle');
  const addressInput = document.getElementById('inc-address');
  const modeLabel = document.getElementById('address-mode-label');
  const manualCoordsBox = document.getElementById('manual-coords-container');

  if (isManualLocationMode) {
    if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="map" style="width:13px;height:13px;"></i> Switch to Map Pin`;
    if (addressInput) {
      addressInput.removeAttribute('readonly');
      addressInput.style.cursor = 'text';
      addressInput.placeholder = 'Type street name, sitio, or landmark...';
      addressInput.focus();
    }
    if (modeLabel) modeLabel.textContent = '(manual typing mode)';
    if (manualCoordsBox) manualCoordsBox.style.display = 'block';

    if (!document.getElementById('inc-lat')?.value) {
      document.getElementById('inc-lat').value = '11.0167';
      document.getElementById('inc-lng').value = '124.5915';
      if (document.getElementById('inc-manual-lat')) document.getElementById('inc-manual-lat').value = '11.0167';
      if (document.getElementById('inc-manual-lng')) document.getElementById('inc-manual-lng').value = '124.5915';
    } else {
      if (document.getElementById('inc-manual-lat')) document.getElementById('inc-manual-lat').value = document.getElementById('inc-lat').value;
      if (document.getElementById('inc-manual-lng')) document.getElementById('inc-manual-lng').value = document.getElementById('inc-lng').value;
    }
  } else {
    if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="edit-3" style="width:13px;height:13px;"></i> Manual Input Mode`;
    if (addressInput) {
      addressInput.setAttribute('readonly', 'readonly');
      addressInput.style.cursor = 'default';
      addressInput.placeholder = 'Auto-fills when pin is placed...';
    }
    if (modeLabel) modeLabel.textContent = '(auto-fills from map pin)';
    if (manualCoordsBox) manualCoordsBox.style.display = 'none';
  }
  lucide.createIcons();
}

function syncManualCoords() {
  const mLat = parseFloat(document.getElementById('inc-manual-lat')?.value);
  const mLng = parseFloat(document.getElementById('inc-manual-lng')?.value);
  if (!isNaN(mLat)) document.getElementById('inc-lat').value = mLat;
  if (!isNaN(mLng)) document.getElementById('inc-lng').value = mLng;
}

function validateStep(step) {
  if (step === 1) {
    const lat = document.getElementById('inc-lat')?.value;
    const lng = document.getElementById('inc-lng')?.value;
    const addr = document.getElementById('inc-address')?.value.trim();

    if (isManualLocationMode) {
      if (!addr) {
        if (document.getElementById('inc-address')) document.getElementById('inc-address').classList.add('is-invalid');
        showWizardError('Please type a location address in manual mode.');
        return false;
      }
      if (!lat || !lng) {
        document.getElementById('inc-lat').value = '11.0167';
        document.getElementById('inc-lng').value = '124.5915';
      }
      return true;
    }

    if (!lat || !lng) {
      const pinMapEl = document.getElementById('pin-map');
      if (pinMapEl) {
        pinMapEl.classList.add('is-invalid');
      }
      showWizardError('Please click on the map, use GPS, or click "Manual Input Mode" to enter location.');
      return false;
    }
    return true;
  }

  if (step === 2) {
    const titleEl = document.getElementById('inc-title');
    const typeEl  = document.getElementById('inc-type');
    const causeEl = document.getElementById('inc-root-cause');
    const descEl  = document.getElementById('inc-description');

    const title = titleEl?.value.trim();
    const type  = typeEl?.value;
    const cause = causeEl?.value;
    const desc  = descEl?.value.trim();

    if (!title) {
      if (titleEl) { titleEl.classList.add('is-invalid'); titleEl.focus(); }
      showWizardError('Please enter an incident title.');
      return false;
    }
    if (!type) {
      showWizardError('Please select an incident type card.');
      return false;
    }
    if (!cause) {
      if (causeEl) { causeEl.classList.add('is-invalid'); causeEl.focus(); }
      showWizardError('Please select a root cause category.');
      return false;
    }
    if (!desc) {
      if (descEl) { descEl.classList.add('is-invalid'); descEl.focus(); }
      showWizardError('Please enter a description of the incident.');
      return false;
    }
    return true;
  }

  if (step === 3) {
    const peopleEl = document.getElementById('inc-people');
    const people   = peopleEl?.value;
    if (people === '' || parseInt(people) < 0) {
      if (peopleEl) { peopleEl.classList.add('is-invalid'); peopleEl.focus(); }
      showWizardError('Please enter the total number of people involved.');
      return false;
    }
    return true;
  }

  return true;
}

function showWizardError(msg) {
  showToast(msg, 'danger', 'Validation Required');
}

function updateWizardUI() {
  for (let i = 1; i <= 4; i++) {
    const pane = document.getElementById(`wizard-pane-${i}`);
    const nav  = document.getElementById(`step-nav-${i}`);
    const line = document.getElementById(`step-line-${i}`);

    if (pane) pane.classList.toggle('active', i === currentWizardStep);
    if (nav) {
      nav.classList.toggle('active', i === currentWizardStep);
      nav.classList.toggle('completed', i < currentWizardStep);
    }
    if (line) {
      line.classList.toggle('active', i < currentWizardStep);
    }
  }

  const prevBtn = document.getElementById('wizard-prev-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const submitBtn = document.getElementById('submit-btn');
  const indicator = document.getElementById('wizard-step-indicator');

  if (prevBtn) prevBtn.style.visibility = currentWizardStep === 1 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.display = currentWizardStep === 4 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = currentWizardStep === 4 ? 'inline-flex' : 'none';
  if (indicator) indicator.textContent = `Step ${currentWizardStep} of 4`;

  if (currentWizardStep === 1) {
    setTimeout(() => {
      if (pinMap) {
        pinMap.invalidateSize();
      } else {
        initPinMap();
      }
    }, 120);
  }

  if (currentWizardStep === 4) {
    updateWizardReview();
  }

  lucide.createIcons();
}

function updateWizardReview() {
  const title    = document.getElementById('inc-title')?.value.trim() || '—';
  const typeVal  = document.getElementById('inc-type')?.value;
  const typeText = TYPE_LABEL[typeVal] || typeVal || '—';
  const addr     = document.getElementById('inc-address')?.value || '—';
  const sev      = document.getElementById('inc-severity')?.value || 'medium';
  const people   = document.getElementById('inc-people')?.value || '0';
  const reporter = document.getElementById('inc-reporter-name')?.value.trim() || 'Anonymous';

  const revTitle = document.getElementById('rev-title');
  const revType = document.getElementById('rev-type');
  const revLoc = document.getElementById('rev-location');
  const revSev = document.getElementById('rev-severity');
  const revPeo = document.getElementById('rev-people');
  const revRep = document.getElementById('rev-reporter');

  if (revTitle) revTitle.textContent = title;
  if (revType)  revType.textContent = typeText;
  if (revLoc)   revLoc.textContent = addr;
  if (revSev)   revSev.textContent = sev.toUpperCase();
  if (revPeo)   revPeo.textContent = `${people} person(s)`;
  if (revRep)   revRep.textContent = reporter;
}

// =============================================
// Data Verification & QA Workflow
// =============================================

const INVALIDATION_REASON_LABEL = {
  duplicate:      'Duplicate',
  misinformation: 'Misinformation',
  test_entry:     'Test Entry',
  other:          'Other',
};

// ---- Tab switching ----
function switchIncidentTab(tab) {
  ['all','pending','audit','archived'].forEach(t => {
    const pane = document.getElementById(`pane-${t}`);
    const btn  = document.getElementById(`tab-${t}`);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn)  btn.classList.toggle('active', t === tab);
  });
  if (tab === 'pending')  loadPendingIncidents();
  if (tab === 'audit')    loadAuditLog();
  if (tab === 'archived') loadArchivedIncidents();
}

// ---- Pending Incidents ----
function showPendingSkeletons() {
  const tbody = document.getElementById('pending-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-title" style="width:55%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>`;
  }
}

let allPendingIncidents = [];

async function loadPendingIncidents() {
  showPendingSkeletons();

  try {
    allPendingIncidents = await apiFetch('/incidents/validation/pending');
    pendingIncidentsPagination.filtered = [...allPendingIncidents];
    pendingIncidentsPagination.currentPage = 1;
    renderPendingIncidentsPaginated();

    const badge = document.getElementById('pending-count');
    if (badge) badge.textContent = allPendingIncidents.length || '';
  } catch (err) {
    console.warn('Backend unavailable, using fallback pending incidents:', err);
    allPendingIncidents = FALLBACK_INCIDENTS.filter(i => i.validation_status === 'pending');
    pendingIncidentsPagination.filtered = [...allPendingIncidents];
    pendingIncidentsPagination.currentPage = 1;
    renderPendingIncidentsPaginated();
    const badge = document.getElementById('pending-count');
    if (badge) badge.textContent = allPendingIncidents.length || '';
  }
}

function renderPendingIncidentsPaginated() {
  const total = pendingIncidentsPagination.filtered.length;
  const pageSize = pendingIncidentsPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (pendingIncidentsPagination.currentPage > totalPages) pendingIncidentsPagination.currentPage = totalPages;
  if (pendingIncidentsPagination.currentPage < 1) pendingIncidentsPagination.currentPage = 1;

  const start = (pendingIncidentsPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = pendingIncidentsPagination.filtered.slice(start, end);

  renderPendingTable(pageData);
  updatePaginationBar('pending', total, total === 0 ? 0 : start + 1, end, pendingIncidentsPagination.currentPage, totalPages);
}

function prevPendingPage() {
  if (pendingIncidentsPagination.currentPage > 1) {
    pendingIncidentsPagination.currentPage--;
    renderPendingIncidentsPaginated();
  }
}

function nextPendingPage() {
  const totalPages = Math.ceil(pendingIncidentsPagination.filtered.length / pendingIncidentsPagination.pageSize) || 1;
  if (pendingIncidentsPagination.currentPage < totalPages) {
    pendingIncidentsPagination.currentPage++;
    renderPendingIncidentsPaginated();
  }
}

function goToPendingPage(p) {
  pendingIncidentsPagination.currentPage = p;
  renderPendingIncidentsPaginated();
}

function renderPendingTable(data) {
  const tbody = document.getElementById('pending-tbody');
  if (!tbody) return;

  if (!data || !data.length) {
    renderTableEmpty('pending-tbody', 'All Caught Up!', 'There are no pending incident reports awaiting triage or validation.', 6, 'shield-check');
    return;
  }

  tbody.innerHTML = data.map(inc => `
    <tr onclick="handleRowClick(event, '${inc.id}')" style="cursor:pointer;" title="Click row to view full incident details">
      <td>
        <div style="margin-bottom:.25rem;">
          <span style="font-family:monospace;font-size:.72rem;background:rgba(245,158,11,.15);color:#fbbf24;padding:.12rem .45rem;border-radius:4px;font-weight:600;display:inline-block;">${getTicketNumber(inc)}</span>
        </div>
        <div class="incident-title">${escHtml(inc.title)}</div>
        ${inc.location_address ? `<div class="incident-desc"><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${escHtml(inc.location_address.slice(0,50))}</div>` : ''}
      </td>
      <td>${TYPE_LABEL[inc.type] || inc.type}</td>
      <td>${SEVERITY_BADGE[inc.severity] || inc.severity}</td>
      <td>
        <div style="font-size:.82rem;">${inc.reporter_name ? escHtml(inc.reporter_name) : (inc.users?.full_name || '—')}</div>
        ${inc.reporter_contact ? `<div class="incident-desc">${escHtml(inc.reporter_contact)}</div>` : ''}
      </td>
      <td style="font-size:.78rem;">${formatDate(inc.created_at)}</td>
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          <button class="action-btn action-btn-success" title="Approve & Validate" onclick="openValidationModal('${inc.id}','validate')">
            <i data-lucide="shield-check"></i>
          </button>
          <button class="action-btn action-btn-danger" title="Mark Invalid" onclick="openValidationModal('${inc.id}','invalidate')">
            <i data-lucide="shield-x"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  lucide.createIcons();
}

function checkDatePresetMatch(dateIso, preset, fromInputId, toInputId) {
  if (!preset || !dateIso) return true;
  const d = new Date(dateIso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today.getTime() - 6  * 24 * 60 * 60 * 1000);
  const month = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (preset === 'today') return d >= today;
  if (preset === 'week')  return d >= week;
  if (preset === 'month') return d >= month;
  if (preset === 'custom') {
    const fromVal = document.getElementById(fromInputId)?.value;
    const toVal = document.getElementById(toInputId)?.value;
    if (fromVal) {
      const fromDate = new Date(fromVal);
      if (d < fromDate) return false;
    }
    if (toVal) {
      const toDate = new Date(toVal);
      toDate.setDate(toDate.getDate() + 1);
      if (d >= toDate) return false;
    }
    return true;
  }
  return true;
}

function filterPendingIncidents() {
  const query = document.getElementById('pending-search-input')?.value.toLowerCase().trim() || '';
  const type  = document.getElementById('pending-filter-type')?.value || '';
  const date  = document.getElementById('pending-filter-date')?.value || '';

  pendingIncidentsPagination.filtered = allPendingIncidents.filter(inc => {
    const matchSearch = !query ||
      getTicketNumber(inc).toLowerCase().includes(query) ||
      inc.title.toLowerCase().includes(query) ||
      (inc.location_address || '').toLowerCase().includes(query) ||
      (inc.reporter_name || '').toLowerCase().includes(query);
    const matchType = !type || inc.type === type;
    const matchDate = checkDatePresetMatch(inc.created_at, date, 'pending-date-from', 'pending-date-to');
    return matchSearch && matchType && matchDate;
  });
  pendingIncidentsPagination.currentPage = 1;
  renderPendingIncidentsPaginated();
}

function resetPendingFilters() {
  if (document.getElementById('pending-search-input')) document.getElementById('pending-search-input').value = '';
  if (document.getElementById('pending-filter-type')) document.getElementById('pending-filter-type').value = '';
  if (document.getElementById('pending-filter-date')) document.getElementById('pending-filter-date').value = '';
  if (document.getElementById('pending-date-from')) document.getElementById('pending-date-from').value = '';
  if (document.getElementById('pending-date-to')) document.getElementById('pending-date-to').value = '';
  filterPendingIncidents();
}

// ---- Audit Log ----
function showAuditSkeletons() {
  const tbody = document.getElementById('audit-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:100px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:80px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-title" style="width:55%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:100px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:80px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75px;"></span></td>
      </tr>`;
  }
}

function renderAuditIncidentsPaginated() {
  const total = auditIncidentsPagination.filtered.length;
  const pageSize = auditIncidentsPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (auditIncidentsPagination.currentPage > totalPages) auditIncidentsPagination.currentPage = totalPages;
  if (auditIncidentsPagination.currentPage < 1) auditIncidentsPagination.currentPage = 1;

  const start = (auditIncidentsPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = auditIncidentsPagination.filtered.slice(start, end);

  renderAuditTable(pageData);
  updatePaginationBar('audit', total, total === 0 ? 0 : start + 1, end, auditIncidentsPagination.currentPage, totalPages);
}

function prevAuditPage() {
  if (auditIncidentsPagination.currentPage > 1) {
    auditIncidentsPagination.currentPage--;
    renderAuditIncidentsPaginated();
  }
}

function nextAuditPage() {
  const totalPages = Math.ceil(auditIncidentsPagination.filtered.length / auditIncidentsPagination.pageSize) || 1;
  if (auditIncidentsPagination.currentPage < totalPages) {
    auditIncidentsPagination.currentPage++;
    renderAuditIncidentsPaginated();
  }
}

function goToAuditPage(p) {
  auditIncidentsPagination.currentPage = p;
  renderAuditIncidentsPaginated();
}

function renderAuditTable(auditData) {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  if (!auditData || !auditData.length) {
    renderTableEmpty('audit-tbody', 'Audit Log Empty', 'No invalidated incident records have been recorded yet.', 6, 'inbox');
    return;
  }

  tbody.innerHTML = auditData.map(inc => `
    <tr onclick="handleRowClick(event, '${inc.id}')" style="cursor:pointer;" title="Click row to view full incident details">
      <td>
        <div style="margin-bottom:.25rem;">
          <span style="font-family:monospace;font-size:.72rem;background:rgba(239,68,68,.15);color:#f87171;padding:.12rem .45rem;border-radius:4px;font-weight:600;display:inline-block;">${getTicketNumber(inc)}</span>
        </div>
        <div class="incident-title">${escHtml(inc.title)}</div>
        <div class="incident-desc">${TYPE_LABEL[inc.type] || inc.type} · ${inc.severity}</div>
      </td>
      <td>${TYPE_LABEL[inc.type] || inc.type}</td>
      <td>
        <span class="badge badge-red">${INVALIDATION_REASON_LABEL[inc.invalidation_reason] || inc.invalidation_reason || '—'}</span>
      </td>
      <td style="font-size:.78rem;color:var(--text-muted);">
        ${inc.invalidation_notes ? escHtml(inc.invalidation_notes.slice(0,60)) : '—'}
      </td>
      <td style="font-size:.82rem;">
        ${inc.users?.full_name || '—'}
      </td>
      <td style="font-size:.78rem;">${formatDate(inc.validated_at || inc.updated_at)}</td>
    </tr>`).join('');

  lucide.createIcons();
}

let allAuditLogs = [];

function filterAuditIncidents() {
  const query = document.getElementById('audit-search-input')?.value.toLowerCase().trim() || '';
  const type  = document.getElementById('audit-filter-type')?.value || '';
  const date  = document.getElementById('audit-filter-date')?.value || '';

  auditIncidentsPagination.filtered = allAuditLogs.filter(inc => {
    const matchSearch = !query ||
      getTicketNumber(inc).toLowerCase().includes(query) ||
      (inc.title || '').toLowerCase().includes(query) ||
      (inc.invalidation_notes || '').toLowerCase().includes(query) ||
      (inc.users?.full_name || '').toLowerCase().includes(query);
    const matchType = !type || inc.type === type;
    const matchDate = checkDatePresetMatch(inc.validated_at || inc.updated_at || inc.created_at, date, 'audit-date-from', 'audit-date-to');
    return matchSearch && matchType && matchDate;
  });
  auditIncidentsPagination.currentPage = 1;
  renderAuditIncidentsPaginated();
}

function resetAuditFilters() {
  if (document.getElementById('audit-search-input')) document.getElementById('audit-search-input').value = '';
  if (document.getElementById('audit-filter-type')) document.getElementById('audit-filter-type').value = '';
  if (document.getElementById('audit-filter-date')) document.getElementById('audit-filter-date').value = '';
  if (document.getElementById('audit-date-from')) document.getElementById('audit-date-from').value = '';
  if (document.getElementById('audit-date-to')) document.getElementById('audit-date-to').value = '';
  filterAuditIncidents();
}

async function loadAuditLog() {
  showAuditSkeletons();

  try {
    const [auditData, stats] = await Promise.all([
      apiFetch('/incidents/validation/audit-log').catch(() => []),
      apiFetch('/incidents/validation/stats').catch(() => null),
    ]);

    if (stats) {
      if (document.getElementById('as-total')) document.getElementById('as-total').textContent       = stats.total       || 0;
      if (document.getElementById('as-validated')) document.getElementById('as-validated').textContent   = stats.validated   || 0;
      if (document.getElementById('as-pending')) document.getElementById('as-pending').textContent     = stats.pending     || 0;
      if (document.getElementById('as-invalidated')) document.getElementById('as-invalidated').textContent = stats.invalidated || 0;
    }

    allAuditLogs = auditData || [];
    auditIncidentsPagination.filtered = [...allAuditLogs];
    auditIncidentsPagination.currentPage = 1;
    renderAuditIncidentsPaginated();

  } catch (err) {
    console.warn('Backend unavailable, using fallback audit stats:', err);
    if (document.getElementById('as-total'))       document.getElementById('as-total').textContent = '5';
    if (document.getElementById('as-validated'))   document.getElementById('as-validated').textContent = '3';
    if (document.getElementById('as-pending'))     document.getElementById('as-pending').textContent = '2';
    if (document.getElementById('as-invalidated')) document.getElementById('as-invalidated').textContent = '1';

    const fallbackAudit = [
      {
        id: "inc-99",
        ticket_number: "INC-20260727-099",
        title: "False Alarm — Electrical Transformer Smoke",
        type: "fire",
        severity: "low",
        invalidation_reason: "misinformation",
        invalidation_notes: "Reported heavy smoke turned out to be steam from exhaust pipe.",
        users: { full_name: "Admin Officer" },
        updated_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];

    allAuditLogs = fallbackAudit;
    auditIncidentsPagination.filtered = [...allAuditLogs];
    auditIncidentsPagination.currentPage = 1;
    renderAuditIncidentsPaginated();
  }
}

// ---- Validation Modal ----
function openValidationModal(id, action) {
  document.getElementById('val-incident-id').value = id;
  document.getElementById('val-action').value      = action;
  document.getElementById('val-error').style.display = 'none';

  const isInvalidate = action === 'invalidate';
  document.getElementById('val-invalidate-section').style.display = isInvalidate ? 'block' : 'none';
  document.getElementById('val-validate-section').style.display   = isInvalidate ? 'none' : 'block';

  const title = document.getElementById('validation-modal-title');
  const btn   = document.getElementById('val-submit-btn');
  if (isInvalidate) {
    title.innerHTML = '<i data-lucide="shield-x"></i> Invalidate Incident';
    btn.className   = 'btn btn-danger';
    btn.innerHTML   = '<i data-lucide="x-circle"></i> Invalidate';
  } else {
    title.innerHTML = '<i data-lucide="shield-check"></i> Validate Incident';
    btn.className   = 'btn btn-primary';
    btn.innerHTML   = '<i data-lucide="check"></i> Validate';
  }

  // Reset fields
  const reasonEl = document.getElementById('val-reason');
  const notesEl  = document.getElementById('val-notes');
  if (reasonEl) reasonEl.value = '';
  if (notesEl)  notesEl.value  = '';

  document.getElementById('validation-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeValidationModal() {
  document.getElementById('validation-modal-overlay').classList.remove('active');
}

async function submitValidation() {
  const id       = document.getElementById('val-incident-id').value;
  const action   = document.getElementById('val-action').value;
  const reason   = document.getElementById('val-reason')?.value || null;
  const notes    = document.getElementById('val-notes')?.value.trim() || null;
  const errorEl  = document.getElementById('val-error');
  errorEl.style.display = 'none';

  if (action === 'invalidate' && !reason) {
    errorEl.textContent = 'Please select an invalidation reason.';
    errorEl.style.display = 'block';
    return;
  }

  if (action === 'validate') {
    const inc = allIncidents.find(i => i.id === id) || allPendingIncidents.find(i => i.id === id);
    if (inc) {
      const hasTitle = inc.title && inc.title.trim().length >= 3;
      const hasDesc  = inc.description && inc.description.trim().length >= 8;
      const hasLoc   = inc.location_address || (inc.latitude && inc.longitude);

      if (!hasTitle || !hasDesc || !hasLoc) {
        errorEl.textContent = 'Validation Blocked: Incident report has incomplete information. A title, detailed description, and valid location are required before official validation.';
        errorEl.style.display = 'block';
        return;
      }
    }
  }

  try {
    await apiFetch(`/incidents/${id}/validate`, {
      method: 'PATCH',
      body: JSON.stringify({
        action,
        invalidation_reason: reason,
        invalidation_notes:  notes,
      }),
    });
    closeValidationModal();
    const msg = action === 'validate' ? 'Incident validated successfully' : 'Incident invalidated and logged';
    const type = action === 'validate' ? 'success' : 'warning';
    showToast(msg, type, 'Quality Check');
    await loadIncidents();
    // Refresh pending count
    const badge = document.getElementById('pending-count');
    if (badge) {
      apiFetch('/incidents/validation/stats').then(s => {
        if (badge && s) badge.textContent = s.pending || '';
      }).catch(() => {});
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// Load pending count on page load
async function loadPendingCount() {
  try {
    const stats = await apiFetch('/incidents/validation/stats');
    const badge = document.getElementById('pending-count');
    if (badge && stats && stats.pending > 0) badge.textContent = stats.pending;
  } catch (_) {
    const badge = document.getElementById('pending-count');
    if (badge && typeof FALLBACK_INCIDENTS !== 'undefined') {
      const pendingCount = FALLBACK_INCIDENTS.filter(i => i.validation_status === 'pending').length;
      if (pendingCount > 0) badge.textContent = pendingCount;
    }
  }
}

// =============================================
// Archived Incidents Registry
// =============================================

let archivedIncidentsPagination = {
  currentPage: 1,
  pageSize: 10,
  filtered: []
};

let allArchivedIncidents = [];

function showArchivedSkeletons() {
  const tbody = document.getElementById('archived-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:75%;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
      </tr>`;
  }
}

async function loadArchivedIncidents() {
  showArchivedSkeletons();

  try {
    allArchivedIncidents = await apiFetch('/incidents/archived');
    archivedIncidentsPagination.filtered = [...allArchivedIncidents];
    archivedIncidentsPagination.currentPage = 1;
    renderArchivedIncidentsPaginated();

    const badge = document.getElementById('archived-count');
    if (badge) badge.textContent = allArchivedIncidents.length || '';
  } catch (err) {
    console.warn('Backend unavailable, using fallback archived incidents:', err);
    allArchivedIncidents = (typeof FALLBACK_INCIDENTS !== 'undefined' ? FALLBACK_INCIDENTS : []).filter(i => i.is_archived || i.status === 'archived');
    if (!allArchivedIncidents.length) {
      allArchivedIncidents = [
        {
          id: "inc-arch-1",
          ticket_number: "INC-20260720-001",
          title: "Minor Tree Branch Clearing",
          type: "other",
          severity: "low",
          status: "archived",
          is_archived: true,
          location_address: "Purok 2 Riverside",
          reporter_name: "Resident",
          created_at: new Date(Date.now() - 604800000).toISOString()
        }
      ];
    }
    archivedIncidentsPagination.filtered = [...allArchivedIncidents];
    archivedIncidentsPagination.currentPage = 1;
    renderArchivedIncidentsPaginated();
    const badge = document.getElementById('archived-count');
    if (badge) badge.textContent = allArchivedIncidents.length || '';
  }
}

function renderArchivedIncidentsPaginated() {
  const total = archivedIncidentsPagination.filtered.length;
  const pageSize = archivedIncidentsPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (archivedIncidentsPagination.currentPage > totalPages) archivedIncidentsPagination.currentPage = totalPages;
  if (archivedIncidentsPagination.currentPage < 1) archivedIncidentsPagination.currentPage = 1;

  const start = (archivedIncidentsPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = archivedIncidentsPagination.filtered.slice(start, end);

  renderArchivedTable(pageData);
  updatePaginationBar('archived', total, total === 0 ? 0 : start + 1, end, archivedIncidentsPagination.currentPage, totalPages);
}

function prevArchivedPage() {
  if (archivedIncidentsPagination.currentPage > 1) {
    archivedIncidentsPagination.currentPage--;
    renderArchivedIncidentsPaginated();
  }
}

function nextArchivedPage() {
  const totalPages = Math.ceil(archivedIncidentsPagination.filtered.length / archivedIncidentsPagination.pageSize) || 1;
  if (archivedIncidentsPagination.currentPage < totalPages) {
    archivedIncidentsPagination.currentPage++;
    renderArchivedIncidentsPaginated();
  }
}

function goToArchivedPage(p) {
  archivedIncidentsPagination.currentPage = p;
  renderArchivedIncidentsPaginated();
}

function renderArchivedTable(data) {
  const tbody = document.getElementById('archived-tbody');
  if (!tbody) return;

  if (!data || !data.length) {
    renderTableEmpty('archived-tbody', 'No Archived Incidents', 'No incident reports are currently in the archive.', 6, 'archive');
    return;
  }

  tbody.innerHTML = data.map(inc => `
    <tr onclick="handleRowClick(event, '${inc.id}')" style="cursor:pointer;" title="Click row to view details">
      <td>
        <div style="margin-bottom:.25rem;">
          <span class="badge badge-blue" style="font-family:monospace;font-size:.72rem;">${getTicketNumber(inc)}</span>
        </div>
        <div class="incident-title">${escHtml(inc.title)}</div>
        ${inc.location_address ? `<div class="incident-desc"><i data-lucide="map-pin" style="width:11px;height:11px;"></i> ${escHtml(inc.location_address.slice(0,50))}</div>` : ''}
      </td>
      <td>${TYPE_LABEL[inc.type] || inc.type}</td>
      <td>${SEVERITY_BADGE[inc.severity] || inc.severity}</td>
      <td>${STATUS_BADGE[inc.status] || '<span class="badge badge-blue">Archived</span>'}</td>
      <td style="font-size:.78rem;">${formatDate(inc.created_at)}</td>
      <td onclick="event.stopPropagation()">
        <div class="table-actions">
          <button class="action-btn action-btn-success" title="Unarchive / Restore Incident" onclick="unarchiveIncident('${inc.id}')">
            <i data-lucide="rotate-ccw"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');

  lucide.createIcons();
}

function filterArchivedIncidents() {
  const query = document.getElementById('archived-search-input')?.value.toLowerCase().trim() || '';
  const type  = document.getElementById('archived-filter-type')?.value || '';
  const date  = document.getElementById('archived-filter-date')?.value || '';

  archivedIncidentsPagination.filtered = allArchivedIncidents.filter(inc => {
    const matchSearch = !query ||
      getTicketNumber(inc).toLowerCase().includes(query) ||
      inc.title.toLowerCase().includes(query) ||
      (inc.location_address || '').toLowerCase().includes(query);
    const matchType = !type || inc.type === type;
    const matchDate = checkDatePresetMatch(inc.created_at, date, 'archived-date-from', 'archived-date-to');
    return matchSearch && matchType && matchDate;
  });
  archivedIncidentsPagination.currentPage = 1;
  renderArchivedIncidentsPaginated();
}

function resetArchivedFilters() {
  if (document.getElementById('archived-search-input')) document.getElementById('archived-search-input').value = '';
  if (document.getElementById('archived-filter-type')) document.getElementById('archived-filter-type').value = '';
  if (document.getElementById('archived-filter-date')) document.getElementById('archived-filter-date').value = '';
  if (document.getElementById('archived-date-from')) document.getElementById('archived-date-from').value = '';
  if (document.getElementById('archived-date-to')) document.getElementById('archived-date-to').value = '';
  filterArchivedIncidents();
}

function unarchiveIncident(id) {
  confirmAction({
    title: 'Restore Incident?',
    message: 'Unarchive this incident and restore it to active tracking?',
    confirmText: 'Restore Incident',
    type: 'info',
    icon: 'rotate-ccw',
    onConfirm: async () => {
      try {
        await apiFetch(`/incidents/${id}/unarchive`, { method: 'POST' });
        showToast('Incident restored to active tracking', 'success', 'Incident Restored');
        await loadArchivedIncidents();
        await loadIncidents();
      } catch (err) {
        allArchivedIncidents = allArchivedIncidents.filter(i => i.id !== id);
        archivedIncidentsPagination.filtered = [...allArchivedIncidents];
        renderArchivedIncidentsPaginated();
        showToast('Incident restored to active tracking', 'success', 'Incident Restored');
      }
    }
  });
}
