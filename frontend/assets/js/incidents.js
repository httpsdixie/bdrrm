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
  ongoing:    '<span class="badge badge-orange"><i data-lucide="radio" style="width:11px;height:11px;"></i> Ongoing</span>',
  active:     '<span class="badge badge-orange"><i data-lucide="radio" style="width:11px;height:11px;"></i> Ongoing</span>',
  responding: '<span class="badge badge-orange"><i data-lucide="radio" style="width:11px;height:11px;"></i> Ongoing</span>',
  resolved:   '<span class="badge badge-green"><i data-lucide="lock" style="width:11px;height:11px;"></i> Resolved</span>',
  pending:    '<span class="badge badge-orange">Pending</span>',
};

const CASUALTY_BADGE = {
  none:    '',
  injured: '<span class="badge badge-orange">Injured</span>',
  missing: '<span class="badge badge-blue">Missing</span>',
  dead:    '<span class="badge badge-red">Dead</span>',
  mixed:   '<span class="badge badge-red">Casualties</span>',
};

const TYPE_LABEL = {
  flood:         'Flooding',
  landslide:     'Landslide',
  fire:          'Fire / Conflagration',
  road_accident: 'Road Accident',
  fallen_tree:   'Fallen Tree',
  earthquake:    'Earthquake',
  typhoon:       'Typhoon Damage',
  medical:       'Medical Emergency',
  assistance:    'Emergency Assistance',
  disturbance:   'Public Disturbance',
  crime:         'Crime & Security',
  other:         'Other / General',
};

const TYPE_BADGE = {
  flood:         '<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);"><i data-lucide="waves" style="width:11px;height:11px;margin-right:4px;"></i>Flooding</span>',
  landslide:     '<span class="badge" style="background:rgba(217,119,6,0.15);color:#fbbf24;border:1px solid rgba(217,119,6,0.3);"><i data-lucide="mountain" style="width:11px;height:11px;margin-right:4px;"></i>Landslide</span>',
  fire:          '<span class="badge badge-red"><i data-lucide="flame" style="width:11px;height:11px;margin-right:4px;"></i>Fire</span>',
  road_accident: '<span class="badge badge-orange"><i data-lucide="car" style="width:11px;height:11px;margin-right:4px;"></i>Road Accident</span>',
  fallen_tree:   '<span class="badge" style="background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);"><i data-lucide="trees" style="width:11px;height:11px;margin-right:4px;"></i>Fallen Tree</span>',
  earthquake:    '<span class="badge badge-orange"><i data-lucide="activity" style="width:11px;height:11px;margin-right:4px;"></i>Earthquake</span>',
  typhoon:       '<span class="badge badge-blue"><i data-lucide="wind" style="width:11px;height:11px;margin-right:4px;"></i>Typhoon</span>',
  medical:       '<span class="badge" style="background:rgba(236,72,153,0.15);color:#f472b6;border:1px solid rgba(236,72,153,0.3);"><i data-lucide="heart-pulse" style="width:11px;height:11px;margin-right:4px;"></i>Medical</span>',
  assistance:    '<span class="badge badge-blue"><i data-lucide="shield-alert" style="width:11px;height:11px;margin-right:4px;"></i>Emergency Assistance</span>',
  disturbance:   '<span class="badge badge-orange"><i data-lucide="megaphone" style="width:11px;height:11px;margin-right:4px;"></i>Public Disturbance</span>',
  crime:         '<span class="badge badge-red"><i data-lucide="shield-x" style="width:11px;height:11px;margin-right:4px;"></i>Crime &amp; Security</span>',
  other:         '<span class="badge" style="background:rgba(148,163,184,0.15);color:#cbd5e1;border:1px solid rgba(148,163,184,0.3);"><i data-lucide="help-circle" style="width:11px;height:11px;margin-right:4px;"></i>Other</span>',
};

const DEFAULT_PUROK_COORDS = {
  "Purok 1": { lat: 11.0180, lng: 124.5920 },
  "Purok 2": { lat: 11.0175, lng: 124.5910 },
  "Purok 3": { lat: 11.0170, lng: 124.5900 },
  "Purok 4": { lat: 11.0165, lng: 124.5930 },
  "Purok 5": { lat: 11.0160, lng: 124.5940 },
  "Purok 6": { lat: 11.0155, lng: 124.5925 },
  "Purok 7": { lat: 11.0150, lng: 124.5915 },
  "Purok 8": { lat: 11.0145, lng: 124.5905 },
  "Purok 9": { lat: 11.0140, lng: 124.5935 },
  "Purok 10": { lat: 11.0135, lng: 124.5945 },
  "Purok 11": { lat: 11.0185, lng: 124.5890 },
  "Purok 12": { lat: 11.0190, lng: 124.5880 },
  "Purok 13": { lat: 11.0195, lng: 124.5895 },
  "Purok 14": { lat: 11.0200, lng: 124.5905 },
  "Purok 15": { lat: 11.0205, lng: 124.5915 },
  "Purok 16": { lat: 11.0210, lng: 124.5925 },
  "Purok 17": { lat: 11.0215, lng: 124.5935 }
};

let BARANGAY_PUROK_COORDS = { ...DEFAULT_PUROK_COORDS };

async function fetchPuroksFromDatabase() {
  try {
    const data = await apiFetch('/map/puroks');
    if (Array.isArray(data) && data.length > 0) {
      const newCoords = { ...DEFAULT_PUROK_COORDS };
      data.forEach(item => {
        if (item.name) {
          const latVal = item.latitude ?? item.lat ?? null;
          const lngVal = item.longitude ?? item.lng ?? null;
          if (latVal === null || lngVal === null) return;
          newCoords[item.name] = {
            lat: Number(latVal),
            lng: Number(lngVal),
          };
        }
      });
      BARANGAY_PUROK_COORDS = newCoords;
      if (typeof window._buildPurokChips === 'function') {
        window._buildPurokChips(data);
      }
    }
  } catch (err) {
    console.warn('[Purok DB] Dynamic fetch info:', err);
  }
}

// Automatically initiate database fetch
try { fetchPuroksFromDatabase(); } catch(_) {}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getTicketNumber(inc) {
  // Ticket numbers are hidden per UI preference — return empty string so no badge is displayed.
  return '';
}

// Determine Purok name from coordinates by selecting the nearest known purok center.
function getPurokFromCoords(lat, lng) {
  if (!lat || !lng || typeof BARANGAY_PUROK_COORDS !== 'object') return '';
  let best = null;
  let bestDist = Infinity;
  Object.keys(BARANGAY_PUROK_COORDS).forEach(k => {
    const p = BARANGAY_PUROK_COORDS[k];
    if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    const dx = p.lat - Number(lat);
    const dy = p.lng - Number(lng);
    const d2 = dx*dx + dy*dy;
    if (d2 < bestDist) { bestDist = d2; best = k; }
  });
  return best || '';
}

function getIncidentPurok(inc) {
  // Prefer explicit purok field, then location_address if it mentions 'Purok', else try to derive from coords
  if (!inc) return '';
  if (inc.purok) return inc.purok;
  const la = (inc.location_address || '');
  const m = la.match(/(Purok\s*\d+)/i);
  if (m) return m[1];
  if (inc.latitude && inc.longitude) {
    const derived = getPurokFromCoords(inc.latitude, inc.longitude);
    if (derived) return derived;
  }
  return '';
}

function formatIncidentLocation(inc) {
  const purok = getIncidentPurok(inc);
  if (purok) return purok;
  if (inc && inc.location_address) return inc.location_address;
  return 'Barangay Linao';
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
        <td colspan="4" style="padding:3rem 1rem; text-align:center;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:.6rem;">
            <div style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.07);border-top-color:#3b82f6;border-radius:50%;animation:spin .75s linear infinite;"></div>
            <span style="font-size:.82rem;color:var(--text-muted);">Loading incidents...</span>
          </div>
        </td>
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

function renderTableEmpty(tbodyId, title, message, colSpan = 4, iconName = 'inbox', iconVariant = 'info') {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="${colSpan}" style="padding:0; border:none;">
        <div class="dash-feed-empty" style="margin:1.5rem; border-radius:12px;">
          <div class="dash-feed-empty-icon ${iconVariant}">
            <i data-lucide="${iconName}"></i>
          </div>
          <div class="dash-feed-empty-text">
            <p class="dash-feed-empty-title">${escHtml(title)}</p>
            <span class="dash-feed-empty-sub">${escHtml(message)}</span>
          </div>
        </div>
      </td>
    </tr>`;
  if (window.lucide) lucide.createIcons();
}

let allIncidentsPagination = { currentPage: 1, pageSize: 10, filtered: [] };

async function loadIncidents(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');

  // Show loading state immediately
  const tbody = document.getElementById('incidents-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding:3rem 1rem; text-align:center;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:.6rem;">
            <div style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.07);border-top-color:#3b82f6;border-radius:50%;animation:spin .75s linear infinite;"></div>
            <span style="font-size:.82rem;color:var(--text-muted);">Loading incidents...</span>
          </div>
        </td>
      </tr>`;
  }

  try {
    allIncidents = await API.get('/incidents/');
    allIncidentsPagination.filtered = [...allIncidents];
    allIncidentsPagination.currentPage = 1;
    renderIncidentSummary(allIncidents);
    await loadIncidentLogs();
    if (!allIncidents.length) {
      renderTableEmpty(
        'incidents-tbody',
        'No Incidents Recorded Yet',
        'No incident reports have been filed. Use "Pin & Report Incident" to log the first one.',
        4,
        'shield-off',
        'info'
      );
      updatePaginationBar('all', 0, 0, 0, 1, 1);
    } else {
      renderAllIncidentsPaginated();
    }
  } catch (err) {
    console.warn('Failed to load incidents:', err);
    allIncidents = [];
    allIncidentsPagination.filtered = [];
    allIncidentsPagination.currentPage = 1;
    renderIncidentSummary([]);
    // Only show error state if tbody is still in loading state (not redirected away)
    const tb = document.getElementById('incidents-tbody');
    if (tb) {
      renderTableError('incidents-tbody', 'Unable to Load Incidents', 'Could not connect to the server. Please check your connection and try again.', 'loadIncidents', 4);
    }
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderIncidentSummary(data) {
  const sumTotal    = document.getElementById('inc-sum-total');
  const sumOngoing  = document.getElementById('inc-sum-ongoing');
  const sumResolved = document.getElementById('inc-sum-resolved');

  if (sumTotal)    sumTotal.textContent    = data.length;
  if (sumOngoing)  sumOngoing.textContent  = data.filter(i => i.status === 'ongoing' || i.status === 'active' || i.status === 'responding').length;
  if (sumResolved) sumResolved.textContent = data.filter(i => i.status === 'resolved').length;

  if (window.lucide) lucide.createIcons();
}

function quickFilterIncidentStatus(status) {
  switchIncidentTab('all');
  const statusSelect = document.getElementById('filter-status');
  if (statusSelect) {
    statusSelect.value = status;
    updateStatusFilterLabel();
    filterIncidents();
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

function formatVictimsColumn(inc, isDetail = false) {
  let victims = inc.victims;
  if (typeof victims === 'string') {
    try { victims = JSON.parse(victims); } catch(e) { victims = []; }
  }
  if (Array.isArray(victims) && victims.length > 0) {
    if (isDetail) {
      return victims.map((v, i) => {
        const name = [v.first_name, v.middle_name, v.last_name, v.suffix].filter(Boolean).join(' ');
        return `<div style="font-size:.82rem;font-weight:600;color:var(--text-main);margin-bottom:.3rem;display:flex;align-items:center;gap:.4rem;">
          <span style="font-size:.7rem;font-weight:700;color:#60a5fa;background:rgba(59,130,246,0.18);padding:0.1rem 0.45rem;border-radius:4px;border:1px solid rgba(59,130,246,0.3);">#${i + 1}</span> ${escHtml(name || 'Anonymous')}
        </div>`;
      }).join('');
    }
    const v1 = victims[0];
    const name = [v1.first_name, v1.middle_name, v1.last_name, v1.suffix].filter(Boolean).join(' ');
    const countBadge = victims.length > 1 ? `<span class="badge badge-gray" style="font-size:.65rem;margin-left:.3rem;">+${victims.length - 1}</span>` : '';
    return `<div style="font-size:.82rem;font-weight:600;color:var(--text-main);">${escHtml(name || 'Anonymous')}${countBadge}</div>`;
  }
  if (inc.reporter_name && inc.reporter_name !== 'Barangay Focal Person') {
    return `<div style="font-size:.82rem;font-weight:600;color:var(--text-main);">${escHtml(inc.reporter_name)}</div>`;
  }
  return `<span style="font-size:.75rem;color:var(--text-muted);font-style:italic;">None listed</span>`;
}

function formatSuspectsColumn(inc, isDetail = false) {
  let suspects = inc.suspects;
  if (typeof suspects === 'string') {
    try { suspects = JSON.parse(suspects); } catch(e) { suspects = []; }
  }
  if (Array.isArray(suspects) && suspects.length > 0) {
    if (isDetail) {
      return suspects.map((s, i) => {
        const name = [s.first_name, s.middle_name, s.last_name, s.suffix].filter(Boolean).join(' ');
        return `<div style="font-size:.82rem;font-weight:600;color:#f87171;margin-bottom:.3rem;display:flex;align-items:center;gap:.4rem;">
          <span style="font-size:.7rem;font-weight:700;color:#fca5a5;background:rgba(239,68,68,0.18);padding:0.1rem 0.45rem;border-radius:4px;border:1px solid rgba(239,68,68,0.3);">#${i + 1}</span> ${escHtml(name || 'Unidentified')}
        </div>`;
      }).join('');
    }
    const s1 = suspects[0];
    const name = [s1.first_name, s1.middle_name, s1.last_name, s1.suffix].filter(Boolean).join(' ');
    const countBadge = suspects.length > 1 ? `<span class="badge badge-gray" style="font-size:.65rem;margin-left:.3rem;">+${suspects.length - 1}</span>` : '';
    return `<div style="font-size:.82rem;font-weight:600;color:#f87171;">${escHtml(name || 'Unidentified')}${countBadge}</div>`;
  }
  return `<span style="font-size:.75rem;color:var(--text-muted);font-style:italic;">Unidentified / None</span>`;
}

function formatRespondentsColumn(inc, isDetail = false) {
  let respondents = inc.respondents;
  if (typeof respondents === 'string') {
    try { respondents = JSON.parse(respondents); } catch(e) { respondents = []; }
  }
  if (Array.isArray(respondents) && respondents.length > 0) {
    if (isDetail) {
      return respondents.map((r, i) => {
        const name = [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(' ');
        return `<div style="font-size:.82rem;font-weight:600;color:#fbbf24;margin-bottom:.3rem;display:flex;align-items:center;gap:.4rem;">
          <span style="font-size:.7rem;font-weight:700;color:#fbbf24;background:rgba(245,158,11,0.18);padding:0.1rem 0.45rem;border-radius:4px;border:1px solid rgba(245,158,11,0.3);">#${i + 1}</span> ${escHtml(name || 'Unidentified')}
        </div>`;
      }).join('');
    }
    const r1 = respondents[0];
    const name = [r1.first_name, r1.middle_name, r1.last_name, r1.suffix].filter(Boolean).join(' ');
    const countBadge = respondents.length > 1 ? `<span class="badge badge-gray" style="font-size:.65rem;margin-left:.3rem;">+${respondents.length - 1}</span>` : '';
    return `<div style="font-size:.82rem;font-weight:600;color:#fbbf24;">${escHtml(name || 'Unidentified')}${countBadge}</div>`;
  }
  return `<span style="font-size:.75rem;color:var(--text-muted);font-style:italic;">Unidentified / None</span>`;
}

function renderTable(data) {
  const tbody = document.getElementById('incidents-tbody');
  if (!tbody) return;
  if (!data || !data.length) {
    if (!allIncidents.length) {
      renderTableEmpty('incidents-tbody', 'No Incidents Recorded Yet', 'No incident reports have been filed. Use "Pin & Report Incident" to log the first one.', 4, 'shield-off', 'info');
    } else {
      renderTableEmpty('incidents-tbody', 'No Matching Incidents', 'No incident reports match your current search or filter. Try clearing the filters.', 4, 'search-x', 'warning');
    }
    return;
  }

  tbody.innerHTML = data.map(inc => {
    return `
    <tr onclick="handleRowClick(event, '${inc.id}')" style="cursor:pointer;vertical-align:middle;" title="Click row to view full incident details">
      <td style="vertical-align:middle;">
        <div class="incident-title" style="font-weight:700;color:var(--text-main);">${escHtml(inc.title)}</div>
        <div class="incident-desc" style="font-size:.75rem;color:var(--text-muted);"><i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:middle;"></i> ${escHtml(formatIncidentLocation(inc))}</div>
      </td>
      <td style="vertical-align:middle;font-size:.78rem;color:var(--text-muted);">${formatDate(inc.created_at)}</td>
      <td style="vertical-align:middle;">${STATUS_BADGE[inc.status] || `<span class="badge badge-orange">${inc.status}</span>`}</td>
      <td style="vertical-align:middle;" onclick="event.stopPropagation()">
        <div class="table-actions">
          ${inc.status === 'resolved' ? `` : `
          <button class="action-btn action-btn-primary" title="Edit Incident Details" onclick="openModal('${inc.id}')">
            <i data-lucide="pencil"></i>
          </button>
          <button class="action-btn" title="Mark as Resolved" onclick="openResolutionConfirmModal('${inc.id}')" style="color:#ef4444;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.08);" onmouseover="this.style.background='rgba(239,68,68,0.2)';this.style.borderColor='rgba(239,68,68,0.6)';" onmouseout="this.style.background='rgba(239,68,68,0.08)';this.style.borderColor='rgba(239,68,68,0.3)';">
            <i data-lucide="lock"></i>
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

  if (activeCustomDateTarget === 'archived') {
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

  // If custom was selected but no dates were actually applied, revert to "All Time"
  const selectEl = document.getElementById('filter-date');
  const fromVal  = document.getElementById('inc-date-from')?.value;
  const toVal    = document.getElementById('inc-date-to')?.value;
  if (selectEl && selectEl.value === 'custom' && !fromVal && !toVal) {
    selectEl.value = '';
    updateDateFilterLabel();
    document.querySelectorAll('#filter-date-dropdown .filter-dropdown-item').forEach(btn => {
      btn.style.background = btn.dataset.val === '' ? 'rgba(59,130,246,0.15)' : 'transparent';
    });
  }
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
  if (typeof filterIncidents === 'function') {
    filterIncidents();
  }
}

function filterIncidents() {
  const search    = document.getElementById('search-input')?.value.toLowerCase().trim()  || '';
  const status    = document.getElementById('filter-status')?.value               || '';
  const purok     = document.getElementById('filter-purok')?.value                || '';
  const dateRange = document.getElementById('filter-date')?.value                 || '';

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today.getTime() - 6  * 24 * 60 * 60 * 1000);
  const month = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);

  allIncidentsPagination.filtered = allIncidents.filter(inc => {
    const ticketNo = getTicketNumber(inc).toLowerCase();

    let victims = inc.victims;
    if (typeof victims === 'string') { try { victims = JSON.parse(victims); } catch(e) { victims = []; } }
    let victimText = '';
    if (Array.isArray(victims)) {
      victimText = victims.map(v => `${v.first_name||''} ${v.last_name||''}`).join(' ');
    } else if (inc.complainant_name) {
      victimText = inc.complainant_name;
    }

    let suspects = inc.suspects;
    if (typeof suspects === 'string') { try { suspects = JSON.parse(suspects); } catch(e) { suspects = []; } }
    let suspectText = '';
    if (Array.isArray(suspects)) {
      suspectText = suspects.map(s => `${s.first_name||''} ${s.last_name||''}`).join(' ');
    } else if (inc.suspect_name) {
      suspectText = inc.suspect_name;
    }

    let respondents = inc.respondents;
    if (typeof respondents === 'string') { try { respondents = JSON.parse(respondents); } catch(e) { respondents = []; } }
    let respondentText = '';
    if (Array.isArray(respondents)) {
      respondentText = respondents.map(r => `${r.first_name||''} ${r.last_name||''}`).join(' ');
    } else if (inc.respondent_name) {
      respondentText = inc.respondent_name;
    }

    const matchSearch = !search ||
      ticketNo.includes(search) ||
      (inc.title || '').toLowerCase().includes(search) ||
      (inc.location_address || '').toLowerCase().includes(search) ||
      (inc.remarks || inc.description || '').toLowerCase().includes(search) ||
      victimText.toLowerCase().includes(search) ||
      suspectText.toLowerCase().includes(search) ||
      respondentText.toLowerCase().includes(search);

    const matchStatus = !status || inc.status === status;
    const matchPurok  = !purok  || (getIncidentPurok(inc) || (inc.location_address || '')).toLowerCase().includes(purok.toLowerCase());

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

    return matchSearch && matchStatus && matchPurok && matchDate;
  });

  allIncidentsPagination.currentPage = 1;
  renderAllIncidentsPaginated();
}

function updateFilterPurokLabel() {
  const selectEl = document.getElementById('filter-purok');
  const labelEl = document.getElementById('filter-purok-label');
  if (!labelEl || !selectEl) return;
  labelEl.textContent = selectEl.value ? `Purok: ${selectEl.value}` : 'Purok: All';
}

function buildFilterPurokChips() {
  const grid = document.getElementById('filter-purok-chips');
  const selectEl = document.getElementById('filter-purok');
  if (!grid || !selectEl) return;

  let list = Object.keys(BARANGAY_PUROK_COORDS || {})
    .map(name => String(name).trim())
    .filter(Boolean);

  if (!list.length) {
    for (let i = 1; i <= 17; i++) {
      list.push(`Purok ${i}`);
    }
  } else {
    list.sort((a, b) => {
      const aNum = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const bNum = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return aNum - bNum;
    });
  }

  const currentVal = selectEl.value || '';
  let selectHtml = '<option value="">Purok: All</option>';
  list.forEach(pName => {
    selectHtml += `<option value="${pName}" ${currentVal === pName ? 'selected' : ''}>${pName}</option>`;
  });
  selectEl.innerHTML = selectHtml;

  const chipsHtml = [
    // "All" chip to clear purok selection
    `<button type="button" class="purok-chip" data-val="" onclick="pickFilterPurok('')"
      style="padding:.45rem .55rem; background:${!currentVal ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'rgba(30,41,59,0.7)'}; border:1px solid ${!currentVal ? '#60a5fa' : 'rgba(255,255,255,0.08)'}; border-radius:8px; color:${!currentVal ? '#ffffff' : '#94a3b8'}; font-size:.76rem; font-weight:600; cursor:pointer; text-align:center; transition:all .15s ease; display:flex; align-items:center; justify-content:center; gap:.35rem; grid-column: 1/-1;">
      <i data-lucide="list" style="width:12px;height:12px;"></i> All Puroks
    </button>`,
    ...list.map(pName => {
    const isSelected = currentVal === pName;
    const bg = isSelected ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'rgba(30, 41, 59, 0.7)';
    const border = isSelected ? '#60a5fa' : 'rgba(255,255,255,0.08)';
    const color = isSelected ? '#ffffff' : '#cbd5e1';
    return `
      <button type="button" class="purok-chip" data-val="${pName}" onclick="pickFilterPurok('${pName}')"
        style="padding:.45rem .55rem; background:${bg}; border:1px solid ${border}; border-radius:8px; color:${color}; font-size:.76rem; font-weight:600; cursor:pointer; text-align:center; transition:all .15s ease; display:flex; align-items:center; justify-content:center; gap:.35rem;"
        onmouseover="this.style.background='rgba(59,130,246,0.2)';this.style.borderColor='rgba(59,130,246,0.5)';this.style.color='#93c5fd';"
        onmouseout="this.style.background='${bg}';this.style.borderColor='${border}';this.style.color='${color}';">
        <i data-lucide="map-pin" style="width:12px; height:12px; opacity:.8;"></i>${pName}
      </button>`; })
  ].join('');

  grid.innerHTML = chipsHtml;
  if (window.lucide) lucide.createIcons();
}

function pickFilterPurok(purokName) {
  const selectEl = document.getElementById('filter-purok');
  if (selectEl) {
    selectEl.value = purokName;
  }
  updateFilterPurokLabel();
  buildFilterPurokChips();
  filterIncidents();

  const card = document.getElementById('filter-purok-dropdown');
  if (card) card.style.display = 'none';
  const chevron = document.getElementById('filter-purok-chevron');
  if (chevron) chevron.style.transform = 'none';
}

function toggleFilterPurokDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('filter-purok-dropdown');
  const trigger = document.getElementById('filter-purok-trigger');
  const chevron = document.getElementById('filter-purok-chevron');
  if (!card) return;

  buildFilterPurokChips();
  const show = card.style.display !== 'block';
  closeAllFilterDropdowns();

  if (show && trigger) {
    const rect = trigger.getBoundingClientRect();
    card.style.position = 'absolute';
    // prefer placing under the trigger; if not enough space, flip above
    const topPos = (rect.bottom + 8);
    const availableBelow = window.innerHeight - rect.bottom;
    const availableAbove = rect.top;
    if (availableBelow < 200 && availableAbove > availableBelow) {
      // place above
      card.style.top = Math.max(8, rect.top - Math.min(availableAbove - 12, 280)) + 'px';
    } else {
      card.style.top = (rect.bottom + 8) + 'px';
    }
    // align left edge, but ensure within viewport
    let left = rect.left;
    const maxWidth = Math.min(360, window.innerWidth - 24);
    card.style.width = Math.max(240, Math.min(rect.width, maxWidth)) + 'px';
    if (left + card.offsetWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - card.offsetWidth - 12);
    }
    card.style.left = left + 'px';
    card.style.right = 'auto';
    card.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function closeFilterPurokDropdownOnOutsideClick(event) {
  const trigger = document.getElementById('filter-purok-trigger');
  const card = document.getElementById('filter-purok-dropdown');
  if (!trigger || !card) return;
  if (!trigger.contains(event.target) && !card.contains(event.target)) {
    card.style.display = 'none';
    const chevron = document.getElementById('filter-purok-chevron');
    if (chevron) chevron.style.transform = 'none';
  }
}

// =============================================
// Custom Status Filter Dropdown
// =============================================
function toggleFilterStatusDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('filter-status-dropdown');
  const trigger = document.getElementById('filter-status-trigger');
  const chevron = document.getElementById('filter-status-chevron');
  if (!card) return;
  const show = card.style.display !== 'block';
  closeAllFilterDropdowns();

  if (show && trigger) {
    const rect = trigger.getBoundingClientRect();
    card.style.position = 'absolute';
    card.style.top = (rect.bottom + 8) + 'px';
    let left = rect.left;
    const maxW = Math.min(340, window.innerWidth - 24);
    card.style.width = Math.max(160, Math.min(rect.width, maxW)) + 'px';
    if (left + parseInt(card.style.width || card.offsetWidth) > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - parseInt(card.style.width || card.offsetWidth) - 12);
    }
    card.style.left = left + 'px';
    card.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function pickFilterStatus(val) {
  const selectEl = document.getElementById('filter-status');
  if (selectEl) selectEl.value = val;
  updateStatusFilterLabel();
  closeAllFilterDropdowns();
  // highlight active item
  document.querySelectorAll('#filter-status-dropdown .filter-dropdown-item').forEach(btn => {
    btn.style.background = btn.dataset.val === val ? 'rgba(59,130,246,0.15)' : 'transparent';
  });
  filterIncidents();
}

function updateStatusFilterLabel() {
  const selectEl = document.getElementById('filter-status');
  const label = document.getElementById('filter-status-label');
  const icon = document.getElementById('filter-status-icon');
  if (!selectEl || !label) return;
  const val = selectEl.value;
  if (val === 'ongoing') {
    label.textContent = 'Ongoing';
    if (icon) { icon.setAttribute('data-lucide', 'radio'); icon.style.color = '#ffffff'; }
  } else if (val === 'resolved') {
    label.textContent = 'Resolved';
    if (icon) { icon.setAttribute('data-lucide', 'check-circle-2'); icon.style.color = '#ffffff'; }
  } else {
    label.textContent = 'Status: All';
    if (icon) { icon.setAttribute('data-lucide', 'activity'); icon.style.color = '#ffffff'; }
  }
  if (window.lucide) lucide.createIcons();
}

// =============================================
// Custom Date Filter Dropdown
// =============================================
const DATE_LABELS = {
  '':       'Date: All Time',
  'today':  'Today',
  'week':   'Last 7 Days',
  'month':  'Last 30 Days',
  'custom': 'Custom Range',
};

function toggleFilterDateDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('filter-date-dropdown');
  const trigger = document.getElementById('filter-date-trigger');
  const chevron = document.getElementById('filter-date-chevron');
  if (!card) return;
  const show = card.style.display !== 'block';
  closeAllFilterDropdowns();

  if (show && trigger) {
    const rect = trigger.getBoundingClientRect();
    card.style.position = 'absolute';
    card.style.top = (rect.bottom + 8) + 'px';
    let left = rect.left;
    const maxW = Math.min(420, window.innerWidth - 24);
    card.style.width = Math.max(220, Math.min(rect.width, maxW)) + 'px';
    if (left + parseInt(card.style.width || card.offsetWidth) > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - parseInt(card.style.width || card.offsetWidth) - 12);
    }
    card.style.left = left + 'px';
    card.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function pickFilterDate(val) {
  const selectEl = document.getElementById('filter-date');
  if (selectEl) selectEl.value = val;
  updateDateFilterLabel();
  const card = document.getElementById('filter-date-dropdown');
  if (card) card.style.display = 'none';
  const chevron = document.getElementById('filter-date-chevron');
  if (chevron) chevron.style.transform = 'none';
  // highlight active item
  document.querySelectorAll('#filter-date-dropdown .filter-dropdown-item').forEach(btn => {
    btn.style.background = btn.dataset.val === val ? 'rgba(59,130,246,0.15)' : 'transparent';
  });
  handleIncidentsDatePresetChange();
}

function updateDateFilterLabel() {
  const selectEl = document.getElementById('filter-date');
  const label = document.getElementById('filter-date-label');
  if (!selectEl || !label) return;
  label.textContent = DATE_LABELS[selectEl.value] || 'Date: All Time';
}

function closeAllFilterDropdowns() {
  ['filter-purok-dropdown', 'filter-status-dropdown', 'filter-date-dropdown', 'filter-log-event-dropdown'].forEach(id => {
    const card = document.getElementById(id);
    if (card) card.style.display = 'none';
  });
  ['filter-purok-chevron', 'filter-status-chevron', 'filter-date-chevron', 'filter-log-event-chevron'].forEach(id => {
    const ch = document.getElementById(id);
    if (ch) ch.style.transform = 'none';
  });
}

// =============================================
// Custom Log Event Filter Dropdown
// =============================================
function toggleLogEventDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('filter-log-event-dropdown');
  const trigger = document.getElementById('filter-log-event-trigger');
  const chevron = document.getElementById('filter-log-event-chevron');
  if (!card) return;
  const show = card.style.display !== 'block';
  closeAllFilterDropdowns();

  if (show && trigger) {
    const rect = trigger.getBoundingClientRect();
    card.style.position = 'fixed';
    card.style.top = (rect.bottom + 8) + 'px';
    let left = rect.left;
    const dropW = 170;
    if (left + dropW > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - dropW - 12);
    }
    card.style.left = left + 'px';
    card.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }
}

function pickLogEventFilter(val) {
  const selectEl = document.getElementById('inc-log-filter-event');
  if (selectEl) selectEl.value = val;
  updateLogEventFilterLabel();
  closeAllFilterDropdowns();
  document.querySelectorAll('#filter-log-event-dropdown .filter-dropdown-item').forEach(btn => {
    btn.style.background = btn.dataset.val === val ? 'rgba(59,130,246,0.15)' : 'transparent';
  });
  filterIncidentLogs();
}

function updateLogEventFilterLabel() {
  const selectEl = document.getElementById('inc-log-filter-event');
  const label = document.getElementById('filter-log-event-label');
  if (!selectEl || !label) return;
  const val = selectEl.value;
  const map = { '': 'Event: All', 'added': 'Added', 'updated': 'Updated', 'resolved': 'Resolved' };
  label.textContent = map[val] || 'Event: All';
}

document.addEventListener('click', function(event) {
  const isPurok   = event.target.closest('#filter-purok-trigger, #filter-purok-dropdown');
  const isStatus  = event.target.closest('#filter-status-trigger, #filter-status-dropdown');
  const isDate    = event.target.closest('#filter-date-trigger, #filter-date-dropdown');
  const isLogEvt  = event.target.closest('#filter-log-event-trigger, #filter-log-event-dropdown');

  if (!isPurok && !isStatus && !isDate && !isLogEvt) {
    closeAllFilterDropdowns();
  }
});

window.addEventListener('scroll', closeAllFilterDropdowns, true);
window.addEventListener('resize', closeAllFilterDropdowns);
const initializeFilterPurok = () => {
  updateFilterPurokLabel();
  buildFilterPurokChips();
};
if (document.readyState !== 'loading') {
  initializeFilterPurok();
  updateStatusFilterLabel();
  updateDateFilterLabel();
}
document.addEventListener('DOMContentLoaded', () => {
  initializeFilterPurok();
  updateStatusFilterLabel();
  updateDateFilterLabel();

  // Move filter dropdown nodes to document.body to avoid clipping from parent overflow/transform
  function moveFilterDropdownsToBody() {
    try {
      ['filter-purok-dropdown','filter-status-dropdown','filter-date-dropdown'].forEach(id => {
        const node = document.getElementById(id);
        if (node && node.parentNode !== document.body) {
          // Preserve current inline styles for transition, then append to body
          node._origDisplay = node.style.display || '';
          document.body.appendChild(node);
        }
      });
    } catch (e) {
      // ignore failures — this is a non-fatal enhancement
      console.warn('moveFilterDropdownsToBody error', e);
    }
  }

  // call immediately and also on a short timeout to catch late-rendered elements
  moveFilterDropdownsToBody();
  setTimeout(moveFilterDropdownsToBody, 250);

  // Safety net: if tbody is still empty after a delay, show empty state
  setTimeout(() => {
    const tbody = document.getElementById('incidents-tbody');
    if (tbody && tbody.innerHTML.trim() === '') {
      renderTableEmpty(
        'incidents-tbody',
        'No Incidents Recorded Yet',
        'No incident reports have been filed. Use "Pin & Report Incident" to log the first one.',
        4,
        'shield-off',
        'info'
      );
    }
  }, 4000);
});

function clearFilters() {
  ['search-input','filter-status','filter-purok','filter-date','inc-date-from','inc-date-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.style.borderColor = ''; }
  });
  initializeFilterPurok();
  closeAllFilterDropdowns();
  updateStatusFilterLabel();
  document.querySelectorAll('#filter-status-dropdown .filter-dropdown-item').forEach(btn => btn.style.background = 'transparent');
  updateDateFilterLabel();
  document.querySelectorAll('#filter-date-dropdown .filter-dropdown-item').forEach(btn => btn.style.background = 'transparent');

  if (!allIncidents || allIncidents.length === 0) {
    loadIncidents();
  } else {
    filterIncidents();
  }
}

// =============================================
// Selectors — simplified (select dropdowns used for consciousness + root cause)
// =============================================
function selectSeverity(val) {
  const sev = document.getElementById('inc-severity');
  if (sev) sev.value = val;
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
  // Deprecated: purok-based location selection is the active workflow.
  if (document.getElementById('incident-purok-select')) {
    document.getElementById('incident-purok-select').focus();
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
    ? `${total} total: ${dead} dead · ${injured} injured · ${missing} missing`
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

// Legacy responder registry & dispatch UI have been removed from the intake flow.
// Provide small no-op stubs to avoid runtime errors if older code paths still call these.
async function loadTanodRegistry() { /* responder registry UI removed */ }
function openAddTanodModal() { console.info('Responder registry UI removed'); }
function closeAddTanodModal() { /* no-op */ }
function saveTanodResponder(e) { if (e && typeof e.preventDefault === 'function') e.preventDefault(); console.info('Responder registry save disabled'); }
window.renderResponderSelectionGrid = function() { /* no-op */ };

// Dispatch UI stubs (modal removed)
function openDispatchFormPanel(incidentId) { console.info('Dispatch UI removed'); }
function closeDispatchFormPanel() { /* no-op */ }
async function submitDispatchForm(e) { if (e && typeof e.preventDefault === 'function') e.preventDefault(); console.info('Dispatch submission disabled'); }

function checkPillar2() {}
function checkPillar3() {}
function checkPillar4() {}
function setPillarComplete() {}

// =============================================
// Pin map — Leaflet mini-map inside the modal
// =============================================
function selectPurokLocation(purokName) {
  if (!purokName) return;

  const selectEl = document.getElementById('incident-purok-select');
  if (selectEl) selectEl.value = purokName;

  const coordsMap = (typeof BARANGAY_PUROK_COORDS !== 'undefined' && Object.keys(BARANGAY_PUROK_COORDS).length > 0)
    ? BARANGAY_PUROK_COORDS
    : (typeof DEFAULT_PUROK_COORDS !== 'undefined' ? DEFAULT_PUROK_COORDS : {});
  const coord = coordsMap[purokName] || { lat: 11.0167, lng: 124.5915 };
  const lat = Number(coord.lat);
  const lng = Number(coord.lng);
  const locationText = `${purokName}, Barangay Linao, Ormoc City`;

  const latInput = document.getElementById('inc-lat');
  const lngInput = document.getElementById('inc-lng');
  const addrInput = document.getElementById('inc-address');
  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);
  if (addrInput) addrInput.value = locationText;

  const latDisp = document.getElementById('pin-lat-display');
  const lngDisp = document.getElementById('pin-lng-display');
  if (latDisp) latDisp.textContent = `Latitude: ${lat.toFixed(6)}`;
  if (lngDisp) lngDisp.textContent = `Longitude: ${lng.toFixed(6)}`;

  const trigger = document.getElementById('purok-select-trigger');
  if (trigger) {
    trigger.style.borderColor = 'rgba(255,255,255,0.12)';
    trigger.style.boxShadow = 'none';
  }

  const labelVal = document.getElementById('purok-label-val');
  if (labelVal) {
    labelVal.textContent = `${purokName} (Selected)`;
    labelVal.style.color = '#ffffff';
    labelVal.style.fontWeight = '700';
  }

  document.querySelectorAll('.purok-chip').forEach(chip => {
    const isSel = chip.getAttribute('data-val') === purokName;
    chip.style.background = isSel ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'rgba(30, 41, 59, 0.7)';
    chip.style.borderColor = isSel ? '#60a5fa' : 'rgba(255, 255, 255, 0.08)';
    chip.style.color = isSel ? '#ffffff' : '#cbd5e1';
  });

  if (pinMap) {
    pinMap.setView([lat, lng], 16);
    placePinAt(lat, lng);
  }

  if (typeof checkPillar1 === 'function') checkPillar1();
}

function initPinMap() {
  const container = document.getElementById('pin-map');
  if (!container) return;
  if (container._leaflet_id) {
    container._leaflet_id = null;
  }

  if (pinMap) { 
    try { pinMap.remove(); } catch (_) {}
    pinMap = null; 
    pinMarker = null; 
  }

  pinMap = L.map('pin-map', { zoomControl: true, dragging: true, scrollWheelZoom: true }).setView([11.0167, 124.5915], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(pinMap);

  pinMap.on('click', function() {
    const selectedPurok = document.getElementById('incident-purok-select')?.value;
    if (selectedPurok) {
      selectPurokLocation(selectedPurok);
    }
  });

  container.classList.add('active-pin');

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

  const choosePurok = document.getElementById('incident-purok-select')?.value;
  if (choosePurok) {
    document.getElementById('inc-address').value = `${choosePurok}, Barangay Linao, Ormoc City`;
    checkPillar1();
    return;
  }

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
function bindNativeDateTimePickers() {
  const openPicker = (input) => {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
      } catch (_) {
        input.focus();
      }
      return;
    }
    input.focus();
  };

  const dateField = document.getElementById('inc-date');
  const timeField = document.getElementById('inc-time');

  if (dateField) {
    // Date field uses the custom calendar popup (bound in incidents.html script block)
  }

  // Time field uses the custom clock popup (bound in incidents.html script block)
}

let editingIncidentId = null;

function openModal(editId = null) {
  try {
    bindNativeDateTimePickers();

    if (editId) {
      const inc = allIncidents.find(i => i.id === editId);
      if (!inc) return;
      if (inc.status === 'resolved') {
        showToast('This incident report is RESOLVED and officially locked from editing.', 'warning', 'Record Locked');
        return;
      }
      editingIncidentId = editId;
    } else {
      editingIncidentId = null;
    }

    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('active');
    const errEl = document.getElementById('incident-error');
    if (errEl) errEl.style.display = 'none';
    const form = document.getElementById('incident-form');
    if (form) form.reset();
    selectedPhoto = null;
    newIncidentId = null;

    const modalTitleEl = document.getElementById('modal-title');
    if (modalTitleEl) {
      if (editingIncidentId) {
        const inc = allIncidents.find(i => i.id === editingIncidentId);
        const ticketNo = inc ? getTicketNumber(inc) : '';
        modalTitleEl.innerHTML = `<i data-lucide="pencil"></i> Edit Incident Report — <span style="font-family:monospace; color:#60a5fa;">#${ticketNo}</span>`;
      } else {
        modalTitleEl.innerHTML = `<i data-lucide="plus-circle"></i> Incident Intake &amp; Assessment Form`;
      }
    }

    // Hide Auto-Populate button when editing (would overwrite existing data)
    const autoPopBtn = document.getElementById('modal-auto-populate-btn');
    if (autoPopBtn) autoPopBtn.style.display = editingIncidentId ? 'none' : 'inline-flex';

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.innerHTML = editingIncidentId
        ? `<i data-lucide="save"></i> Save Incident Updates`
        : `<i data-lucide="file-check"></i> Review &amp; Submit Report`;
    }

    if (editingIncidentId) {
      const inc = allIncidents.find(i => i.id === editingIncidentId);
      if (inc) {
        selectTypeCard(inc.type || 'assistance');
        const sev = document.getElementById('inc-severity');
        if (sev) sev.value = inc.severity || 'medium';
        selectSeverity(inc.severity || 'medium');

        const titleEl = document.getElementById('inc-title');
        if (titleEl) titleEl.value = inc.title || '';

        const remarksEl = document.getElementById('inc-remarks');
        if (remarksEl) remarksEl.value = inc.remarks || inc.description || inc.action_taken || '';

        const dt = new Date(inc.occurred_at || inc.created_at || Date.now());
        const dateField = document.getElementById('inc-date');
        const timeField = document.getElementById('inc-time');
        if (dateField) dateField.value = dt.toISOString().slice(0, 10);
        if (timeField) timeField.value = dt.toTimeString().slice(0, 5);

        const addrField = document.getElementById('inc-address');
        if (addrField) addrField.value = inc.location_address || '';

        const latField = document.getElementById('inc-lat');
        const lngField = document.getElementById('inc-lng');
        if (latField) latField.value = inc.latitude || '';
        if (lngField) lngField.value = inc.longitude || '';

        const purokSelect = document.getElementById('incident-purok-select');
        if (purokSelect && inc.location_address) {
          const match = Object.keys(BARANGAY_PUROK_COORDS).find(p => inc.location_address.includes(p));
          if (match) purokSelect.value = match;
        }

        currentWizardStep = 1;
        updateWizardUI();

        setTimeout(() => {
          initPinMap();
          if (window._initClockPickerBinding) window._initClockPickerBinding();
          if (window._initCalPickerBinding) window._initCalPickerBinding();

          // Populate victims
          if (window.clearVictims) window.clearVictims();
          let victims = inc.victims;
          if (typeof victims === 'string') { try { victims = JSON.parse(victims); } catch(e) { victims = []; } }
          if (Array.isArray(victims) && victims.length > 0) {
            victims.forEach(v => {
              if (window.addVictimRow) window.addVictimRow();
              // Query the last added row directly
              const allRows = document.querySelectorAll('#victim-list .victim-row');
              const row = allRows[allRows.length - 1];
              if (!row) return;
              const rowId = row.id.replace('victim-row-', '');
              const f  = document.getElementById(`vfirst-${rowId}`);
              const m  = document.getElementById(`vmiddle-${rowId}`);
              const l  = document.getElementById(`vlast-${rowId}`);
              const s  = document.getElementById(`vsuffix-${rowId}`);
              if (f)  f.value  = v.first_name  || '';
              if (m)  m.value  = v.middle_name || '';
              if (l)  l.value  = v.last_name   || '';
              if (s)  s.value  = v.suffix       || '';
            });
          } else {
            if (window.addVictimRow) window.addVictimRow();
          }

          // Populate suspects
          if (window.clearSuspects) window.clearSuspects();
          let suspects = inc.suspects;
          if (typeof suspects === 'string') { try { suspects = JSON.parse(suspects); } catch(e) { suspects = []; } }

          if (Array.isArray(suspects) && suspects.length > 0) {
            suspects.forEach(s => {
              if (window.addSuspectRow) window.addSuspectRow();
              // Query the last added row directly
              const allRows = document.querySelectorAll('#suspect-list .suspect-row');
              const row = allRows[allRows.length - 1];
              if (!row) return;
              const rowId = row.id.replace('suspect-row-', '');
              const f  = document.getElementById(`sfirst-${rowId}`);
              const m  = document.getElementById(`smiddle-${rowId}`);
              const l  = document.getElementById(`slast-${rowId}`);
              const sx = document.getElementById(`ssuffix-${rowId}`);
              if (f)  f.value  = s.first_name  || '';
              if (m)  m.value  = s.middle_name || '';
              if (l)  l.value  = s.last_name   || '';
              if (sx) sx.value = s.suffix       || '';
            });
          } else {
            if (window.addSuspectRow) window.addSuspectRow();
          }

          // Populate respondents
          if (window.clearRespondents) window.clearRespondents();
          let respondents = inc.respondents;
          if (typeof respondents === 'string') { try { respondents = JSON.parse(respondents); } catch(e) { respondents = []; } }
          if (Array.isArray(respondents) && respondents.length > 0) {
            respondents.forEach(r => {
              if (window.addRespondentRow) window.addRespondentRow(r);
            });
          } else if (window.addRespondentRow) {
            window.addRespondentRow();
          }

          if (window.lucide) lucide.createIcons();
        }, 90);
      }
    } else {
      selectTypeCard('');
      const els = {
        'photo-preview':      e => e.classList.remove('visible'),
        'photo-filename':     e => e.textContent = '',
        'pin-lat-display':    e => e.textContent = 'Latitude: —',
        'pin-lng-display':    e => e.textContent = 'Longitude: —',
        'inc-address':        e => e.value = '',
        'incident-purok-select': e => e.value = '',
        'geo-verify-row':     e => e.classList.remove('verified'),
        'casualty-summary':   e => e.textContent = '',
      };
      Object.entries(els).forEach(([id, fn]) => { const el = document.getElementById(id); if (el) fn(el); });
      const sev = document.getElementById('inc-severity');
      if (sev) sev.value = 'medium';
      selectSeverity('medium');

      const now = new Date();
      const dateField = document.getElementById('inc-date');
      const timeField = document.getElementById('inc-time');
      if (dateField) dateField.value = now.toISOString().slice(0, 10);
      if (timeField) timeField.value = now.toTimeString().slice(0, 5);

      const currentUser = getUser();
      if (currentUser && currentUser.full_name) {
        const parts = currentUser.full_name.trim().split(/\s+/);
        if (parts.length) {
          const firstName  = document.getElementById('inc-reporter-first-name');
          const middleName = document.getElementById('inc-reporter-middle-name');
          const lastName   = document.getElementById('inc-reporter-last-name');
          const suffix     = document.getElementById('inc-reporter-suffix');

          if (firstName) firstName.value = parts[0] || '';
          if (parts.length === 1) {
            if (lastName) lastName.value = '';
          } else {
            if (lastName) lastName.value = parts[parts.length - 1] || '';
            if (middleName) middleName.value = parts.slice(1, parts.length - 1).join(' ') || '';
          }
          if (suffix) suffix.value = '';
        }
      }

      currentWizardStep = 1;
      updateWizardUI();
      setTimeout(() => {
        initPinMap();
        if (window._initClockPickerBinding) window._initClockPickerBinding();
        if (window._initCalPickerBinding) window._initCalPickerBinding();
        if (window.clearVictims) window.clearVictims();
        if (window.addVictimRow) window.addVictimRow();
        if (window.clearSuspects) window.clearSuspects();
        if (window.addSuspectRow) window.addSuspectRow();
        if (window.clearRespondents) window.clearRespondents();
        if (window.addRespondentRow) window.addRespondentRow();
        if (window.lucide) lucide.createIcons();
      }, 90);
    }
  } catch(err) {
    console.error('[openModal ERROR]', err);
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('active');
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('summary-verify-modal-overlay')?.classList.remove('active');
  if (pinMap) { pinMap.remove(); pinMap = null; pinMarker = null; }
  document.getElementById('incident-form').reset();
  selectedPhoto = null;
  editingIncidentId = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

async function submitIncident() {
  const errorEl  = document.getElementById('incident-error');
  const submitBtn = document.getElementById('submit-btn');
  if (errorEl) errorEl.style.display = 'none';

  const title    = document.getElementById('inc-title')?.value.trim() || '';
  const remarks  = document.getElementById('inc-remarks')?.value.trim() || '';
  const dateStr  = document.getElementById('inc-date')?.value || '';
  const timeStr  = document.getElementById('inc-time')?.value || '';
  const purokValue = document.getElementById('incident-purok-select')?.value || '';
  const incType  = document.getElementById('inc-type')?.value || 'assistance';
  const incSeverity = document.getElementById('inc-severity')?.value || 'medium';
  const latVal   = parseFloat(document.getElementById('inc-lat')?.value);
  const lngVal   = parseFloat(document.getElementById('inc-lng')?.value);

  if (!title) { showToast('Title of complaint is required.', 'danger', 'Validation Error'); return; }
  if (!remarks) { showToast('Remarks / Field incident details are required.', 'danger', 'Validation Error'); return; }
  if (!dateStr || !timeStr) {
    showToast('Please specify both date and time.', 'danger', 'Date & Time Required');
    return;
  }
  if (!purokValue) {
    showToast('Please select a purok location from the dropdown.', 'danger', 'Location Required');
    return;
  }

  let lat = latVal;
  let lng = lngVal;
  if (isNaN(lat) || isNaN(lng) || !document.getElementById('inc-address')?.value.trim()) {
    const coord = BARANGAY_PUROK_COORDS[purokValue];
    if (coord) {
      lat = coord.lat;
      lng = coord.lng;
      document.getElementById('inc-lat').value = coord.lat.toFixed(6);
      document.getElementById('inc-lng').value = coord.lng.toFixed(6);
      document.getElementById('inc-address').value = `${purokValue}, Barangay Linao, Ormoc City`;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2"></i> Submitting...';
    lucide.createIcons();
  }

  try {
    const victims = (typeof getVictims === 'function') ? getVictims() : [];
    const suspects = (typeof getSuspects === 'function') ? getSuspects() : [];
    const respondents = (typeof getRespondents === 'function') ? getRespondents() : [];

    const incidentDateTime = new Date(`${dateStr}T${timeStr}`);

    const suspectStr = suspects.map(s => [s.first_name, s.middle_name, s.last_name, s.suffix].filter(Boolean).join(' ')).join(', ');
    const respondentStr = respondents.map(r => [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(' ')).join(', ');

    const payload = {
      title,
      type: incType || 'assistance',
      description: remarks,
      severity: incSeverity || 'medium',
      occurred_at: incidentDateTime.toISOString(),
      latitude: lat,
      longitude: lng,
      location_address: document.getElementById('inc-address')?.value || `${purokValue}, Barangay Linao, Ormoc City`,
      geolocation_verified: true,
      parties_involved: [suspectStr ? `Suspects: ${suspectStr}` : null, respondentStr ? `Respondents: ${respondentStr}` : null].filter(Boolean).join(' | ') || null,
      people_involved: victims.length + suspects.length + respondents.length,
      action_taken: remarks,
      reporter_name: victims.length ? [victims[0].first_name, victims[0].middle_name, victims[0].last_name, victims[0].suffix].filter(Boolean).join(' ') : 'Barangay Focal Person',
      reporter_contact: victims.length ? (victims[0].contact || null) : null,
      victims: victims,
      suspects: suspects,
      respondents: respondents,
    };

    if (editingIncidentId) {
      await apiFetch(`/incidents/${editingIncidentId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      closeModal();
      closeSummaryVerifyModal();
      showToast('Incident report updated successfully!', 'success', 'Incident Updated');
      editingIncidentId = null;
      await loadIncidents();
    } else {
      const incident = await apiFetch('/incidents/', { method: 'POST', body: JSON.stringify(payload) });
      newIncidentId = incident.id;
      closeModal();
      closeSummaryVerifyModal();
      showToast('Incident reported successfully!', 'success', 'Incident Created');
      await loadIncidents();
    }

  } catch (err) {
    showToast(err.message, 'danger', 'Submission Failed');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="file-check"></i> Review & Submit Report';
    lucide.createIcons();
  }
}

// =============================================
// Status Update Modal & Resolution Lock Preview
// =============================================
function openStatusModal(id, currentStatus) {
  const inc = allIncidents.find(i => i.id === id);
  if (!inc) return;

  if (inc.status === 'resolved') {
    showToast('This incident is marked as RESOLVED and officially locked from editing.', 'warning', 'Record Locked');
    return;
  }

  document.getElementById('status-incident-id').value = id;
  document.getElementById('new-status').value = 'ongoing';
  const errorEl = document.getElementById('status-error');
  if (errorEl) errorEl.style.display = 'none';
  const actionEl = document.getElementById('status-action');
  if (actionEl) actionEl.value = (inc.action_taken || inc.resolution || '');
  document.getElementById('status-modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeStatusModal() { document.getElementById('status-modal-overlay').classList.remove('active'); }
function closeStatusModalOutside(e) { if (e.target === document.getElementById('status-modal-overlay')) closeStatusModal(); }

function toggleResolutionField() {
  // Retained for backward compatibility
}

async function submitStatusUpdate() {
  const id        = document.getElementById('status-incident-id').value;
  const newStatus = document.getElementById('new-status').value;

  if (newStatus === 'resolved') {
    closeStatusModal();
    openResolutionConfirmModal(id);
    return;
  }

  const action    = document.getElementById('status-action')?.value.trim() || null;
  const errorEl   = document.getElementById('status-error');

  const payload = { status: newStatus };
  if (action) {
    payload.action_taken = action;
    payload.resolution = action;
  }

  try {
    await apiFetch(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    closeStatusModal();
    showToast('Incident status updated to Ongoing', 'success', 'Status Updated');
    await loadIncidents();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  }
}

// Resolution Lock Confirmation Modal Handlers
function openResolutionConfirmModal(id) {
  const inc = allIncidents.find(i => i.id === id);
  if (!inc) return;

  if (inc.status === 'resolved') {
    showToast('This incident report is already marked as RESOLVED and locked.', 'warning', 'Record Locked');
    return;
  }

  document.getElementById('res-confirm-incident-id').value = id;

  const ticketEl = document.getElementById('res-confirm-ticket');
  if (ticketEl) ticketEl.textContent = `TICKET #${getTicketNumber(inc)}`;

  const titleEl = document.getElementById('res-confirm-title');
  if (titleEl) titleEl.textContent = inc.title;

  const locEl = document.getElementById('res-confirm-location');
  if (locEl) locEl.innerHTML = `<i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:middle;color:var(--primary);"></i> ${escHtml(formatIncidentLocation(inc) || '—')} &nbsp;·&nbsp; <span style="color:#94a3b8;">${escHtml(formatDate(inc.occurred_at || inc.created_at))}</span>`;

  // Count total parties involved
  const _countVictims = (item) => {
    let v = item.victims;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { v = []; } }
    if (Array.isArray(v) && v.length > 0) return v.length;
    if (item.reporter_name && item.reporter_name !== 'Barangay Focal Person') return 1;
    return 0;
  };
  const _countSuspects = (item) => {
    let s = item.suspects;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch(e) { s = []; } }
    if (Array.isArray(s) && s.length > 0) return s.length;
    if (item.parties_involved) return 1;
    return 0;
  };
  const _countRespondents = (item) => {
    let r = item.respondents;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch(e) { r = []; } }
    if (Array.isArray(r) && r.length > 0) return r.length;
    return 0;
  };
  const calcTotal = _countVictims(inc) + _countSuspects(inc) + _countRespondents(inc);

  const partiesBadge = document.getElementById('res-confirm-parties-badge');
  if (partiesBadge) partiesBadge.textContent = `${calcTotal} ${calcTotal === 1 ? 'Person' : 'Persons'} Total`;

  const peopleList = document.getElementById('res-confirm-people-list');
  if (peopleList) {
    const vFormatted = formatVictimsColumn(inc, true);
    const sFormatted = formatSuspectsColumn(inc, true);
    const rFormatted = formatRespondentsColumn(inc, true);
    const remarksText = escHtml(inc.remarks || inc.description || inc.action_taken || '—');
    peopleList.innerHTML = `
      <div style="margin-bottom:.4rem;"><strong>Victim(s):</strong> ${vFormatted}</div>
      <div style="margin-bottom:.4rem;"><strong>Suspect(s):</strong> ${sFormatted}</div>
      <div style="margin-bottom:.5rem;"><strong>Respondent(s):</strong> ${rFormatted}</div>
      <div style="padding-top:.5rem;border-top:1px solid rgba(255,255,255,0.06);font-size:.78rem;color:#94a3b8;"><strong style="color:#cbd5e1;">Remarks:</strong> ${remarksText}</div>
    `;
  }

  const actionText = document.getElementById('res-confirm-action');
  if (actionText) actionText.value = (inc.action_taken || inc.resolution || inc.remarks || '');

  const errEl = document.getElementById('res-confirm-error');
  if (errEl) errEl.style.display = 'none';

  document.getElementById('resolution-modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeResolutionConfirmModal() {
  document.getElementById('resolution-modal-overlay')?.classList.remove('active');
}

function openResolutionFinalConfirm() {
  // Validate action notes before showing the final confirm popup
  const actionNotes = document.getElementById('res-confirm-action')?.value.trim() || '';
  const errEl = document.getElementById('res-confirm-error');
  if (!actionNotes) {
    if (errEl) {
      errEl.textContent = 'Please enter final action taken / resolution summary notes.';
      errEl.style.display = 'block';
    }
    showToast('Resolution summary notes are required before locking.', 'danger', 'Validation Error');
    return;
  }
  if (errEl) errEl.style.display = 'none';
  document.getElementById('final-lock-confirm-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeFinalLockConfirm() {
  document.getElementById('final-lock-confirm-overlay')?.classList.remove('active');
}

async function executeFinalResolutionSubmit() {
  const id = document.getElementById('res-confirm-incident-id')?.value;
  const actionNotes = document.getElementById('res-confirm-action')?.value.trim() || '';
  const errEl = document.getElementById('res-confirm-error');
  const btn = document.getElementById('final-lock-execute-btn');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Locking...';
  }

  try {
    await apiFetch(`/incidents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'resolved',
        action_taken: actionNotes,
        resolution: actionNotes
      })
    });

    closeFinalLockConfirm();
    closeResolutionConfirmModal();
    closeDetailModal();
    closeStatusModal();
    showToast('Incident resolved and officially locked!', 'success', 'Record Locked');
    await loadIncidents();
  } catch (err) {
    closeFinalLockConfirm();
    if (errEl) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
    showToast(err.message, 'danger', 'Resolution Failed');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="lock" style="width:14px;height:14px;"></i> Yes, Lock It';
    }
    if (window.lucide) lucide.createIcons();
  }
}

// =============================================
// Incident Detail Modal
// =============================================
async function openDetailModal(id) {
  const inc = allIncidents.find(i => i.id === id);
  if (!inc) return;

  const ticketNo = getTicketNumber(inc);

  const modalTicket = document.getElementById('detail-modal-ticket');
  if (modalTicket) modalTicket.textContent = ticketNo;

  const modalHeaderTitle = document.getElementById('detail-modal-header-title');
  if (modalHeaderTitle) modalHeaderTitle.innerHTML = escHtml(inc.title);

  // Helper to count total parties involved (Victims + Suspects + Respondents)
  const getVictimsCount = (item) => {
    let v = item.victims;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch(e) { v = []; } }
    if (Array.isArray(v) && v.length > 0) return v.length;
    if (item.reporter_name && item.reporter_name !== 'Barangay Focal Person') return 1;
    return 0;
  };
  const getSuspectsCount = (item) => {
    let s = item.suspects;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch(e) { s = []; } }
    if (Array.isArray(s) && s.length > 0) return s.length;
    if (item.parties_involved) return 1;
    return 0;
  };
  const getRespondentsCount = (item) => {
    let r = item.respondents;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch(e) { r = []; } }
    if (Array.isArray(r) && r.length > 0) return r.length;
    return 0;
  };

  const vCnt = getVictimsCount(inc);
  const sCnt = getSuspectsCount(inc);
  const rCnt = getRespondentsCount(inc);
  const calcTotal = vCnt + sCnt + rCnt;
  const totalParties = (inc.people_involved && inc.people_involved > calcTotal) ? inc.people_involved : calcTotal;

  // helper: render a compact incident information field
  const infoField = (label, value, icon) => `
    <div class="detail-modal-field">
      <div class="detail-modal-field-label"><i data-lucide="${icon}" style="width:12px;height:12px;"></i> ${label}</div>
      <div class="detail-modal-field-value">${value || '—'}</div>
    </div>`;

  const summaryText = escHtml(inc.remarks || inc.description || inc.action_taken || 'No incident remark was provided.');

  const body = `
    <div class="detail-modal-section">
      <div class="detail-modal-section-header">
        <span class="section-icon"><i data-lucide="map-pin"></i></span>
        <span class="section-title">Incident Details</span>
      </div>
      <div class="detail-modal-fields">
        ${infoField('Title of Complaint', escHtml(inc.title), 'clipboard-list')}
        ${infoField('Date & Time of Occurrence', escHtml(formatDate(inc.occurred_at || inc.created_at)), 'calendar-clock')}
        ${infoField('Place of Occurrence', escHtml(formatIncidentLocation(inc) || '—'), 'map-pin')}
      </div>
    </div>

    <div class="detail-modal-section">
      <div class="detail-modal-section-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:.4rem;">
          <span class="section-icon"><i data-lucide="users"></i></span>
          <span class="section-title">People Involved</span>
        </div>
        <span style="font-size:.72rem; font-weight:800; padding:.15rem .6rem; border-radius:9999px; background:rgba(59,130,246,0.2); color:#60a5fa; border:1px solid rgba(59,130,246,0.4);">
          ${totalParties} ${totalParties === 1 ? 'Total Person' : 'Total Persons'}
        </span>
      </div>
      <div class="detail-modal-fields">
        ${infoField('Name of Victim / Complainant', formatVictimsColumn(inc, true), 'user-check')}
        ${infoField('Name of Suspect', formatSuspectsColumn(inc, true), 'user-x')}
        ${infoField('Name of Respondent', formatRespondentsColumn(inc, true), 'users')}
      </div>
    </div>

    <div class="detail-modal-section">
      <div class="detail-modal-section-header">
        <span class="section-icon"><i data-lucide="file-text"></i></span>
        <span class="section-title">Incident Remark</span>
      </div>
      <div class="detail-modal-card">
        <div class="detail-modal-field-value">${summaryText}</div>
      </div>
    </div>

    <!-- Final action / resolution (if present) -->
    <div class="detail-modal-section" id="detail-resolution-section" style="margin-top:.6rem;">
      <div class="detail-modal-section-header">
        <span class="section-icon"><i data-lucide="check-circle-2"></i></span>
        <span class="section-title">Final Action Taken / Resolution Summary</span>
      </div>
      <div class="detail-modal-card">
        <div class="detail-modal-field-value" id="detail-resolution-text">${escHtml(inc.resolution || inc.action_taken || '—')}</div>
      </div>
    </div>
  `;

  document.getElementById('detail-modal-body').innerHTML = body;

  const currentUser = getUser();
  const canManage = currentUser && ['admin', 'officer'].includes(currentUser.role);
  const modalFooter = document.getElementById('detail-modal-footer');

  if (modalFooter) {
    if (inc.status === 'resolved') {
      modalFooter.innerHTML = `
        <div style="display:flex; justify-content:flex-start; align-items:center; width:100%;">
          <span style="font-size:.78rem; font-weight:700; color:#34d399; display:flex; align-items:center; gap:.35rem; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:.35rem .8rem; border-radius:8px;">
            <i data-lucide="lock" style="width:14px;height:14px;"></i> RESOLVED & OFFICIAL RECORD LOCKED
          </span>
        </div>`;
    } else {
      modalFooter.innerHTML = `
        <div style="display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; justify-content:flex-end; width:100%;">
          ${canManage ? `
            <button class="btn btn-outline-sm" onclick="closeDetailModal(); openModal('${inc.id}')" style="gap:.35rem; font-size:.8rem; height:36px; padding:0 .85rem; color:#60a5fa; border-color:rgba(59,130,246,0.4);">
              <i data-lucide="pencil" style="width:13px;height:13px;"></i> Update Incident Details
            </button>
            <button class="btn" onclick="closeDetailModal(); openResolutionConfirmModal('${inc.id}')" style="gap:.35rem; font-size:.8rem; height:36px; padding:0 .9rem; background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:#fff; border:1px solid #ef4444; font-weight:700; box-shadow:0 0 15px rgba(239,68,68,0.3); cursor:pointer;">
              <i data-lucide="lock" style="width:13px;height:13px;"></i> Mark as Resolved
            </button>
          ` : ''}
        </div>`;
    }
  }

  document.getElementById('detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeDetailModal() {
  document.getElementById('detail-modal-overlay').classList.remove('active');
}


// =============================================
// Wizard State Controller & Map Size Handling
// =============================================
let currentWizardStep = 1;

function goToStep(step) {
  if (step < 1 || step > 4) return;
  if (step > currentWizardStep) {
    for (let s = currentWizardStep; s < step; s++) {
      if (!validateStep(s)) return;
    }
  }
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

function validateStep(step) {
  if (step === 1) {
    const titleEl = document.getElementById('inc-title');
    const title = titleEl?.value.trim();
    const purokValue = document.getElementById('incident-purok-select')?.value || '';
    const lat = document.getElementById('inc-lat')?.value;
    const lng = document.getElementById('inc-lng')?.value;
    const addr = document.getElementById('inc-address')?.value.trim();

    const dateVal = document.getElementById('inc-date')?.value;
    const timeVal = document.getElementById('inc-time')?.value;
    if (!dateVal || !timeVal) {
      showWizardError('Please choose both date and time.');
      return false;
    }

    if (!title) {
      if (titleEl) {
        titleEl.style.borderColor = '#ef4444';
        titleEl.style.boxShadow = '0 0 10px rgba(239,68,68,0.4)';
        titleEl.focus();
      }
      showWizardError('Please enter the title of complaint.');
      return false;
    } else if (titleEl) {
      titleEl.style.borderColor = '';
      titleEl.style.boxShadow = '';
    }

    if (!purokValue) {
      const trigger = document.getElementById('purok-select-trigger');
      if (trigger) {
        trigger.style.borderColor = '#ef4444';
        trigger.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.45)';
        trigger.focus();
      }
      showWizardError('Please select a purok or sitio for the place of occurrence.');
      return false;
    } else {
      const trigger = document.getElementById('purok-select-trigger');
      if (trigger) {
        trigger.style.borderColor = 'rgba(255,255,255,0.12)';
        trigger.style.boxShadow = 'none';
      }
    }

    if (!lat || !lng || !addr) {
      const coord = BARANGAY_PUROK_COORDS[purokValue];
      if (coord) {
        document.getElementById('inc-lat').value = coord.lat.toFixed(6);
        document.getElementById('inc-lng').value = coord.lng.toFixed(6);
        document.getElementById('inc-address').value = `${purokValue}, Barangay Linao, Ormoc City`;
      }

      if (!document.getElementById('inc-lat')?.value || !document.getElementById('inc-lng')?.value || !document.getElementById('inc-address')?.value.trim()) {
        const pinMapEl = document.getElementById('pin-map');
        if (pinMapEl) pinMapEl.classList.add('is-invalid');
        showWizardError('The selected purok is missing its map coordinates. Please choose another purok.');
        return false;
      }
    }

    return true;
  }

  if (step === 2) {
    const vRows = document.querySelectorAll('#victim-list .victim-row');
    let hasAtLeastOneValidVictim = false;

    for (let r of vRows) {
      const fnEl = r.querySelector('[id^="vfirst-"]');
      const lnEl = r.querySelector('[id^="vlast-"]');
      const fn = fnEl?.value.trim() || '';
      const ln = lnEl?.value.trim() || '';

      if (!fn && !ln) continue;

      if (!fn) {
        if (fnEl) { fnEl.style.borderColor = '#ef4444'; fnEl.focus(); }
        showWizardError('First Name is required for each Victim record.');
        return false;
      } else if (fnEl) {
        fnEl.style.borderColor = '';
      }

      if (!ln) {
        if (lnEl) { lnEl.style.borderColor = '#ef4444'; lnEl.focus(); }
        showWizardError('Last Name is required for each Victim record.');
        return false;
      } else if (lnEl) {
        lnEl.style.borderColor = '';
      }

      hasAtLeastOneValidVictim = true;
    }

    if (!hasAtLeastOneValidVictim) {
      const firstInput = document.querySelector('#victim-list input');
      if (firstInput) {
        firstInput.style.borderColor = '#ef4444';
        firstInput.focus();
      }
      showWizardError('Please enter both First Name and Last Name for at least one Victim / Complainant.');
      return false;
    }
    return true;
  }

  if (step === 3) {
    // Validate suspect fields (if any suspect row is partially filled)
    const sRows = document.querySelectorAll('#suspect-list .victim-row');
    for (let r of sRows) {
      const fnEl = r.querySelector('[id^="sfirst-"]');
      const lnEl = r.querySelector('[id^="slast-"]');
      const fn = fnEl?.value.trim() || '';
      const ln = lnEl?.value.trim() || '';

      if (fn || ln) {
        if (!fn) {
          if (fnEl) { fnEl.style.borderColor = '#ef4444'; fnEl.focus(); }
          showWizardError('First Name is required for Suspect.');
          return false;
        } else if (fnEl) {
          fnEl.style.borderColor = '';
        }

        if (!ln) {
          if (lnEl) { lnEl.style.borderColor = '#ef4444'; lnEl.focus(); }
          showWizardError('Last Name is required for Suspect.');
          return false;
        } else if (lnEl) {
          lnEl.style.borderColor = '';
        }
      }
    }

    // Validate respondent fields (if any respondent row is partially filled)
    const rRows = document.querySelectorAll('#respondent-list .respondent-row');
    for (let r of rRows) {
      const fnEl = r.querySelector('[id^="rfirst-"]');
      const lnEl = r.querySelector('[id^="rlast-"]');
      const fn = fnEl?.value.trim() || '';
      const ln = lnEl?.value.trim() || '';

      if (fn || ln) {
        if (!fn) {
          if (fnEl) { fnEl.style.borderColor = '#ef4444'; fnEl.focus(); }
          showWizardError('First Name is required for Respondent.');
          return false;
        } else if (fnEl) {
          fnEl.style.borderColor = '';
        }

        if (!ln) {
          if (lnEl) { lnEl.style.borderColor = '#ef4444'; lnEl.focus(); }
          showWizardError('Last Name is required for Respondent.');
          return false;
        } else if (lnEl) {
          lnEl.style.borderColor = '';
        }
      }
    }
    return true;
  }

  if (step === 4) {
    const remarksEl = document.getElementById('inc-remarks');
    const remarks = remarksEl?.value.trim();
    if (!remarks) {
      if (remarksEl) { remarksEl.classList.add('is-invalid'); remarksEl.focus(); }
      showWizardError('Please enter focal person remarks or incident details.');
      return false;
    }

    const privacyCheck = document.getElementById('inc-privacy-consent');
    if (privacyCheck && !privacyCheck.checked) {
      showWizardError('Please acknowledge the Data Privacy Act (RA 10173) consent before submitting.');
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

  if (currentWizardStep === 3 && typeof renderRespondentPage === 'function') {
    renderRespondentPage();
  }

  if (currentWizardStep === 4) {
    updateWizardReview();
  }

  lucide.createIcons();
}

function openSummaryVerifyModal() {
  if (!validateStep(4)) return;

  const title    = document.getElementById('inc-title')?.value.trim() || '—';
  const addr     = document.getElementById('inc-address')?.value || '—';
  const dateVal  = document.getElementById('inc-date')?.value || '—';
  const timeVal  = document.getElementById('inc-time')?.value || '—';
  const remarks  = document.getElementById('inc-remarks')?.value.trim() || '—';

  const popTitle = document.getElementById('pop-rev-title');
  const popLoc   = document.getElementById('pop-rev-location');
  const popDt    = document.getElementById('pop-rev-datetime');
  const popRem   = document.getElementById('pop-rev-remarks');
  if (popTitle) popTitle.textContent = title;
  if (popLoc)   popLoc.innerHTML = `<i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:middle;color:var(--primary);"></i> ${escHtml(addr)}`;
  if (popDt)    popDt.textContent = `${dateVal} at ${timeVal}`;
  if (popRem)   popRem.textContent = remarks;


  // Victims Summary
  const popVictims = document.getElementById('pop-rev-victims');
  if (popVictims) {
    const victims = (typeof getVictims === 'function') ? getVictims() : [];
    if (victims.length === 0) {
      popVictims.textContent = '—';
    } else {
      popVictims.innerHTML = victims.map((v, i) => {
        const full = [v.first_name, v.middle_name, v.last_name, v.suffix].filter(Boolean).join(' ');
        return `<div style="font-weight:600;margin-bottom:.2rem;"><span style="color:#60a5fa;font-family:monospace;font-size:.78rem;">#${i + 1}</span> ${escHtml(full)}</div>`;
      }).join('');
    }
  }

  // Suspects Summary
  const popSuspects = document.getElementById('pop-rev-suspects');
  if (popSuspects) {
    const suspects = (typeof getSuspects === 'function') ? getSuspects() : [];
    if (suspects.length === 0) {
      popSuspects.textContent = 'None reported';
    } else {
      popSuspects.innerHTML = suspects.map((s, i) => {
        const full = [s.first_name, s.middle_name, s.last_name, s.suffix].filter(Boolean).join(' ');
        return `<div style="font-weight:600;color:#fca5a5;margin-bottom:.2rem;"><span style="color:#ef4444;font-family:monospace;font-size:.78rem;">#${i + 1}</span> ${escHtml(full)}</div>`;
      }).join('');
    }
  }

  // Respondents Summary
  const popRespondents = document.getElementById('pop-rev-respondents');
  if (popRespondents) {
    const respondents = (typeof getRespondents === 'function') ? getRespondents() : [];
    if (respondents.length === 0) {
      popRespondents.textContent = 'None reported';
    } else {
      popRespondents.innerHTML = respondents.map((r, i) => {
        const full = [r.first_name, r.middle_name, r.last_name, r.suffix].filter(Boolean).join(' ');
        return `<div style="font-weight:600;color:#fbbf24;margin-bottom:.2rem;"><span style="color:#f59e0b;font-family:monospace;font-size:.78rem;">#${i + 1}</span> ${escHtml(full)}</div>`;
      }).join('');
    }
  }

  document.getElementById('summary-verify-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeSummaryVerifyModal() {
  document.getElementById('summary-verify-modal-overlay')?.classList.remove('active');
}

function jumpToWizardStep(step) {
  closeSummaryVerifyModal();
  currentWizardStep = step;
  updateWizardUI();
  setTimeout(() => {
    if (step === 1) document.getElementById('inc-title')?.focus();
    if (step === 2) document.querySelector('#victim-list input')?.focus();
    if (step === 3) document.querySelector('#suspect-list input, #respondent-list input')?.focus();
    if (step === 4) document.getElementById('inc-remarks')?.focus();
  }, 100);
}

async function executeFinalIncidentSubmit() {
  closeSummaryVerifyModal();
  await submitIncident();
}

function updateWizardReview() {
  // Syncs fields if needed for background step tracking
}

// =============================================
// Data Verification & QA Workflow
// =============================================

// ---- Tab switching ----
function switchIncidentTab(tab) {
  ['all','tanod'].forEach(t => {
    const pane = document.getElementById(`pane-${t}`);
    const btn  = document.getElementById(`tab-${t}`);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn)  btn.classList.toggle('active', t === tab);
  });
  if (tab === 'tanod') loadTanodRegistry();
}

// =============================================
// Tanod & Responder Centralized Registry
// =============================================
// No pre-seeded data — registry is populated only through the
// "Responder Account Creation" onboarding form.
let defaultTanodRegistry = [];

let tanodPagination = {
  currentPage: 1,
  pageSize: 5,
  filtered: []
};

function getTanodRegistry() {
  const saved = localStorage.getItem('drrm_tanod_registry');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration: strip old fake seed entries and old `equipment` field
      const FAKE_SEED_IDS = new Set(['tnd-01','tnd-02','tnd-03','tnd-04','tnd-05']);
      const migrated = parsed
        .filter(t => !FAKE_SEED_IDS.has(t.id))  // remove old hardcoded seeds
        .map(t => {
          // Normalize keys across schema variations: some records use `designation` or `title` for the responder role
          const normalizedRole = t.role || t.designation || t.title || 'Barangay Tanod';
          if (t.equipment !== undefined) {
            const { equipment, ...rest } = t;
            return { ...rest, role: normalizedRole, emergency_contact: rest.emergency_contact || null, emergency_relation: rest.emergency_relation || null };
          }
          return { ...t, role: normalizedRole };
        });
      // Persist the cleaned list back so migration only runs once
      if (migrated.length !== parsed.length) {
        localStorage.setItem('drrm_tanod_registry', JSON.stringify(migrated));
      }
      return migrated;
    } catch (_) {}
  }
  return defaultTanodRegistry;
}

function saveTanodRegistryState(list) {
  localStorage.setItem('drrm_tanod_registry', JSON.stringify(list));
}

function loadTanodRegistry() {
  const list = getTanodRegistry();
  tanodPagination.filtered = [...list];
  tanodPagination.currentPage = 1;
  renderTanodRegistryPaginated();
}

function renderTanodRegistryPaginated() {
  const total = tanodPagination.filtered.length;
  const pageSize = tanodPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (tanodPagination.currentPage > totalPages) tanodPagination.currentPage = totalPages;
  if (tanodPagination.currentPage < 1) tanodPagination.currentPage = 1;

  const start = (tanodPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = tanodPagination.filtered.slice(start, end);

  renderTanodRegistry(pageData);
  updatePaginationBar('tanod', total, total === 0 ? 0 : start + 1, end, tanodPagination.currentPage, totalPages);
}

function changeTanodPageSize(val) {
  tanodPagination.pageSize = parseInt(val, 10);
  tanodPagination.currentPage = 1;
  renderTanodRegistryPaginated();
}

function prevTanodPage() {
  if (tanodPagination.currentPage > 1) {
    tanodPagination.currentPage--;
    renderTanodRegistryPaginated();
  }
}

function nextTanodPage() {
  const totalPages = Math.ceil(tanodPagination.filtered.length / tanodPagination.pageSize) || 1;
  if (tanodPagination.currentPage < totalPages) {
    tanodPagination.currentPage++;
    renderTanodRegistryPaginated();
  }
}

function goToTanodPage(p) {
  tanodPagination.currentPage = p;
  renderTanodRegistryPaginated();
}

function renderTanodRegistry(list) {
  const tbody = document.getElementById('tanod-tbody');
  if (!tbody) return;

  if (!list || !list.length) {
    renderTableEmpty('tanod-tbody', 'No Responders Registered', 'Click "Add Responder" to onboard active field personnel.', 3, 'user-plus');
    return;
  }

  tbody.innerHTML = list.map(t => {
    const initials = t.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const contactLine = (typeof window.formatPHPhoneNumber === 'function')
      ? window.formatPHPhoneNumber(t.contact)
      : (t.contact || '—');

    const role = t.role || t.designation || t.title || 'Barangay Tanod';

    return `
      <tr onclick="viewTanodDetails('${t.id}')" style="cursor:pointer; vertical-align:middle;">
        <td style="padding:.75rem 1rem; vertical-align:middle;">
          <div style="display:flex; align-items:center; gap:.75rem;">
            <div style="width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,rgba(59,130,246,0.25),rgba(37,99,235,0.15)); border:1px solid rgba(59,130,246,0.35); display:flex; align-items:center; justify-content:center; font-size:.8rem; font-weight:800; color:#60a5fa; flex-shrink:0; letter-spacing:.02em;">
              ${initials}
            </div>
            <div>
              <div style="font-weight:700; color:#f8fafc; font-size:.88rem; line-height:1.2;">${escHtml(t.name)}</div>
              <div style="font-size:.72rem; color:#64748b; margin-top:.15rem; display:flex; align-items:center; gap:.3rem;">
                <i data-lucide="phone" style="width:10px;height:10px;"></i> ${escHtml(contactLine)}
              </div>
            </div>
          </div>
        </td>
        <td style="padding:.75rem 1rem; vertical-align:middle;">
          <div style="font-size:.82rem; font-weight:600; color:#60a5fa;">${escHtml(role)}</div>
        </td>
        <td style="padding:.75rem 1rem; vertical-align:middle;" onclick="event.stopPropagation()">
          <div style="display:flex; gap:.4rem; justify-content:flex-end;">
            <button title="Edit Responder" onclick="openEditTanodModal('${t.id}')"
              style="display:flex;align-items:center;gap:.3rem;padding:.3rem .7rem;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:7px;color:#60a5fa;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;"
              onmouseover="this.style.background='rgba(59,130,246,0.22)';this.style.borderColor='rgba(59,130,246,0.55)';"
              onmouseout="this.style.background='rgba(59,130,246,0.1)';this.style.borderColor='rgba(59,130,246,0.3)';">
              <i data-lucide="pencil" style="width:12px;height:12px;"></i> Edit
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function filterTanodRegistry() {
  const search = document.getElementById('tanod-search-input')?.value.toLowerCase().trim() || '';
  const list = getTanodRegistry();

  tanodPagination.filtered = list.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search) ||
      (t.role || '').toLowerCase().includes(search) ||
      (t.contact || '').toLowerCase().includes(search) ||
      (t.address || '').toLowerCase().includes(search);
    return matchSearch;
  });

  tanodPagination.currentPage = 1;
  renderTanodRegistryPaginated();
}

function toggleTanodStatus(id) {
  const list = getTanodRegistry();
  const item = list.find(t => t.id === id);
  if (item) {
    if (item.status === 'Active') item.status = 'Dispatched';
    else if (item.status === 'Dispatched') item.status = 'Off-Duty';
    else item.status = 'Active';
    saveTanodRegistryState(list);
    filterTanodRegistry();
    showToast(`Updated duty status for ${item.name} to ${item.status}`, 'info', 'Status Updated');
  }
}

function openAddTanodModal() {
  document.getElementById('tanod-form').reset();
  document.getElementById('tanod-error').style.display = 'none';
  document.getElementById('tanod-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeAddTanodModal() {
  document.getElementById('tanod-modal-overlay').classList.remove('active');
}

function openEditTanodModal(id) {
  const list = getTanodRegistry();
  const item = list.find(t => t.id === id);
  if (!item) return;

  document.getElementById('tanod-edit-id').value = item.id;
  document.getElementById('tanod-first-name').value = item.first_name || '';
  document.getElementById('tanod-middle-name').value = item.middle_name || '';
  document.getElementById('tanod-last-name').value = item.last_name || '';
  document.getElementById('tanod-suffix').value = item.suffix || '';
  document.getElementById('tanod-contact').value = item.contact || '';
  document.getElementById('tanod-email').value = item.email || '';
  document.getElementById('tanod-address').value = item.address || '';
  document.getElementById('tanod-role').value = item.role || item.designation || item.title || 'Barangay Tanod';
  document.getElementById('tanod-emergency-name').value = item.emergency_name || '';
  document.getElementById('tanod-emergency-contact').value = item.emergency_contact || '';
  document.getElementById('tanod-emergency-relation').value = item.emergency_relation || '';

  const err = document.getElementById('tanod-error');
  if (err) err.style.display = 'none';
  document.getElementById('tanod-modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function viewTanodDetails(id) {
  const list = getTanodRegistry();
  const t = list.find(x => x.id === id);
  if (!t) return;

  // Update modal header
  const modalHeaderTitle = document.getElementById('detail-modal-header-title');
  if (modalHeaderTitle) modalHeaderTitle.textContent = 'Responder Profile';

  const modalTicket = document.getElementById('detail-modal-ticket');
  if (modalTicket) modalTicket.textContent = '';

  // helper: render a compact field matching the incident detail layout
  const infoField = (label, value, icon) => `
    <div class="detail-modal-field">
      <div class="detail-modal-field-label"><i data-lucide="${icon}" style="width:12px;height:12px;"></i> ${label}</div>
      <div class="detail-modal-field-value">${value || '—'}</div>
    </div>`;

  const emergencyValue = [
    t.emergency_name ? escHtml(t.emergency_name) : '',
    t.emergency_relation ? `(${escHtml(t.emergency_relation)})` : '',
    t.emergency_contact ? `· ${escHtml(t.emergency_contact)}` : '',
  ].filter(Boolean).join(' ') || '—';

  const body = `
    <div style="display:flex;align-items:center;gap:.85rem;margin-bottom:1rem;">
      <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,rgba(59,130,246,0.25),rgba(37,99,235,0.15));border:1px solid rgba(59,130,246,0.35);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <i data-lucide="shield-user" style="width:22px;height:22px;color:#60a5fa;"></i>
      </div>
      <div>
        <div style="font-size:1.05rem;font-weight:800;color:var(--text-main);line-height:1.25;">${escHtml(t.name)}</div>
        <div style="font-size:.82rem;color:#94a3b8;margin-top:.15rem;">${escHtml(t.role || 'Responder')}</div>
      </div>
    </div>

    <div class="detail-modal-section">
      <div class="detail-modal-section-header">
        <span class="section-icon"><i data-lucide="phone"></i></span>
        <span class="section-title">Contact Information</span>
      </div>
      <div class="detail-modal-fields">
        ${infoField('Contact', escHtml(t.contact || '—'), 'phone')}
        ${infoField('Email', escHtml(t.email || '—'), 'mail')}
        ${infoField('Address', escHtml(t.address || '—'), 'map-pin')}
        ${infoField('Emergency Contact', emergencyValue, 'heart-pulse')}
      </div>
    </div>
  `;

  document.getElementById('detail-modal-body').innerHTML = body;

  const currentUser = getUser();
  const canManage = currentUser && ['admin', 'officer'].includes(currentUser.role);
  const modalFooter = document.getElementById('detail-modal-footer');
  if (modalFooter) {
    modalFooter.innerHTML = `
      <div style="display:flex;gap:.5rem;align-items:center;">
        <button class="btn btn-outline-sm" onclick="closeDetailModal()">Close</button>
        ${canManage ? `<button class="btn btn-primary" onclick="openEditTanodModal('${id}'); closeDetailModal();">Edit Responder</button>` : ''}
      </div>
    `;
  }

  document.getElementById('detail-modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function autoFillTanodDemoData() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  setVal('tanod-first-name', 'Mario');
  setVal('tanod-middle-name', 'Santos');
  setVal('tanod-last-name', 'Reyes');
  setVal('tanod-suffix', 'Jr.');
  setVal('tanod-contact', '+63-917-889-2041');
  setVal('tanod-email', 'mario.reyes@linao.gov.ph');
  setVal('tanod-address', 'Purok 3 Bao, Barangay Linao, Ormoc City');
  setVal('tanod-role', 'Barangay Tanod');
  setVal('tanod-emergency-name', 'Maria Elena Reyes');
  setVal('tanod-emergency-contact', '+63-920-412-9901');
  setVal('tanod-emergency-relation', 'Spouse');

  const err = document.getElementById('tanod-error');
  if (err) err.style.display = 'none';

  if (typeof showToast === 'function') {
    showToast('Responder form auto-populated for demo.', 'info', 'Auto-Populate');
  }
}

function saveTanodResponder(e) {
  e.preventDefault();
  const editId = document.getElementById('tanod-edit-id')?.value || '';
  const firstName  = document.getElementById('tanod-first-name')?.value.trim() || '';
  const middleName = document.getElementById('tanod-middle-name')?.value.trim() || '';
  const lastName   = document.getElementById('tanod-last-name')?.value.trim() || '';
  const suffix     = document.getElementById('tanod-suffix')?.value.trim() || '';

  const name = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ');
  const role             = document.getElementById('tanod-role')?.value || 'Barangay Tanod';
  const contact          = document.getElementById('tanod-contact')?.value.trim() || '';
  const email            = document.getElementById('tanod-email')?.value.trim() || '';
  const address          = document.getElementById('tanod-address')?.value.trim() || '';
  const emergencyName    = document.getElementById('tanod-emergency-name')?.value.trim() || '';
  const emergencyContact = document.getElementById('tanod-emergency-contact')?.value.trim() || '';
  const emergencyRelation= document.getElementById('tanod-emergency-relation')?.value.trim() || '';

  if (!firstName || !lastName || !contact || !emergencyName || !emergencyContact || !emergencyRelation) {
    const err = document.getElementById('tanod-error');
    if (err) {
      err.textContent = 'Please fill out all mandatory responder details (First Name, Last Name, Contact, and Emergency Contact details).';
      err.style.display = 'block';
    }
    return;
  }

  const list = getTanodRegistry();
  if (editId) {
    // Update existing
    const idx = list.findIndex(t => t.id === editId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        name,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        suffix: suffix || null,
        role,
        contact,
        email: email || null,
        address: address || null,
        emergency_name: emergencyName,
        emergency_contact: emergencyContact,
        emergency_relation: emergencyRelation
      };
      saveTanodRegistryState(list);
      closeAddTanodModal();
      document.getElementById('tanod-edit-id').value = '';
      if (typeof loadTanodRegistry === 'function') loadTanodRegistry();
      if (typeof renderResponderSelectionGrid === 'function') renderResponderSelectionGrid();
      showToast(`Updated ${name} in Responder Registry`, 'success', 'Responder Updated');
      return;
    }
  }

  // Create new responder
  const newId = `tnd-${Date.now().toString().slice(-4)}`;
  const newTanod = {
    id: newId,
    name,
    first_name: firstName,
    middle_name: middleName || null,
    last_name: lastName,
    suffix: suffix || null,
    role,
    status: 'Active',
    contact,
    email: email || null,
    address: address || null,
    emergency_name: emergencyName,
    emergency_contact: emergencyContact,
    emergency_relation: emergencyRelation
  };

  list.unshift(newTanod);
  saveTanodRegistryState(list);
  closeAddTanodModal();

  // Auto-select this newly registered responder in the incident modal if open
  if (!window._selectedResponders) window._selectedResponders = [];
  if (!window._selectedResponders.includes(newId)) window._selectedResponders.push(newId);

  if (typeof loadTanodRegistry === 'function') loadTanodRegistry();
  if (typeof renderResponderSelectionGrid === 'function') renderResponderSelectionGrid();

  showToast(`Registered ${name} to Responder Registry`, 'success', 'Responder Account Created');
}

// =============================================
// Suspect & Responder Handling Helper Functions
// =============================================
window.getSuspects = function () {
  const rows = document.querySelectorAll('#suspect-list .victim-row');
  const suspects = [];
  rows.forEach(row => {
    const id = row.id.replace('suspect-row-', '');
    const fn = (document.getElementById(`sfirst-${id}`)?.value || '').trim();
    const mn = (document.getElementById(`smiddle-${id}`)?.value || '').trim();
    const ln = (document.getElementById(`slast-${id}`)?.value || '').trim();
    const sx = (document.getElementById(`ssuffix-${id}`)?.value || '').trim();
    if (fn || ln) {
      suspects.push({ first_name: fn, middle_name: mn || null, last_name: ln, suffix: sx || null });
    }
  });
  return suspects;
};

window.clearSuspects = function () {
  const list = document.getElementById('suspect-list');
  if (list) list.innerHTML = '';
  if (typeof renderSuspectPage === 'function') renderSuspectPage();
};

window._selectedResponders = [];
let responderGridPagination = { currentPage: 1, pageSize: 6, filtered: [] };

window.getSelectedResponders = function () {
  const selectedIds = window._selectedResponders || [];
  const registry = (typeof getTanodRegistry === 'function') ? getTanodRegistry() : [];
  return registry.filter(r => selectedIds.includes(r.id));
};

window.toggleResponderSelection = function (id) {
  if (!window._selectedResponders) window._selectedResponders = [];
  const idx = window._selectedResponders.indexOf(id);
  if (idx >= 0) {
    window._selectedResponders.splice(idx, 1);
  } else {
    window._selectedResponders.push(id);
  }
  renderResponderSelectionGrid();
};

window.clearSelectedResponders = function () {
  window._selectedResponders = [];
  renderResponderSelectionGrid();
};

window.filterRespondersGrid = function () {
  const search = document.getElementById('responder-search-input')?.value.toLowerCase().trim() || '';
  const role = document.getElementById('responder-status-filter')?.value || 'all';
  const registry = (typeof getTanodRegistry === 'function') ? getTanodRegistry() : [];

  responderGridPagination.filtered = registry.filter(r => {
    const matchSearch = !search ||
      (r.name || '').toLowerCase().includes(search) ||
      (r.role || '').toLowerCase().includes(search) ||
      (r.contact || '').toLowerCase().includes(search);
    const matchRole = role === 'all' || r.role === role;
    return matchSearch && matchRole;
  });

  responderGridPagination.currentPage = 1;
  renderResponderSelectionGrid();
};

window.renderResponderSelectionGrid = function () {
  const grid = document.getElementById('responder-select-grid');
  if (!grid) return;

  const registry = (typeof getTanodRegistry === 'function') ? getTanodRegistry() : [];
  const search = document.getElementById('responder-search-input')?.value.toLowerCase().trim() || '';
  const role = document.getElementById('responder-status-filter')?.value || 'all';

  // Sanitize _selectedResponders — only remove IDs truly absent from registry
  // NOTE: skip sanitize during the initial render pass so edit-populate IDs survive
  if (window._selectedResponders && Array.isArray(window._selectedResponders) && registry.length > 0) {
    window._selectedResponders = window._selectedResponders.filter(id => registry.some(r => r.id === id));
  }

  // Always re-apply filter against full registry so newly created responders show immediately
  responderGridPagination.filtered = registry.filter(r => {
    const matchSearch = !search ||
      (r.name || '').toLowerCase().includes(search) ||
      (r.role || '').toLowerCase().includes(search) ||
      (r.contact || '').toLowerCase().includes(search);
    const matchRole = role === 'all' || r.role === role;
    return matchSearch && matchRole;
  });

  const filtered = responderGridPagination.filtered;
  const total = filtered.length;

  if (total === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; padding:1.5rem 1rem; text-align:center; color:#94a3b8; font-size:.82rem;">
        <i data-lucide="shield-alert" style="width:24px;height:24px;color:#f59e0b;margin-bottom:.4rem;"></i>
        <div>No active responders available in responder database.</div>
        <button type="button" class="btn btn-outline-sm" onclick="openAddTanodModal()" style="margin-top:.6rem; font-size:.74rem; border-color:rgba(52,211,153,0.4); color:#6ee7b7;">
          <i data-lucide="user-plus" style="width:12px;height:12px;"></i> Onboard New Responder
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    const info = document.getElementById('responder-pagination-info');
    if (info) info.textContent = 'Showing 0 responders';
    return;
  }

  const pageSize = responderGridPagination.pageSize || 6;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (responderGridPagination.currentPage > totalPages) responderGridPagination.currentPage = totalPages;
  if (responderGridPagination.currentPage < 1) responderGridPagination.currentPage = 1;

  const start = (responderGridPagination.currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  grid.innerHTML = pageItems.map(r => {
    const isSelected = (window._selectedResponders || []).includes(r.id);
    return `
      <div onclick="toggleResponderSelection('${r.id}')"
        style="padding:.6rem .75rem; background:${isSelected ? 'rgba(59,130,246,0.18)' : 'rgba(15,23,42,0.65)'}; border:1px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; border-radius:10px; cursor:pointer; transition:all .15s ease; display:flex; align-items:center; justify-content:space-between; gap:.6rem;">
        <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleResponderSelection('${r.id}')" style="accent-color:#3b82f6; width:16px; height:16px; cursor:pointer;" />
        <div style="flex:1; min-width:0;">
          <div style="font-size:.82rem; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(r.name)}</div>
          <div style="font-size:.72rem; color:#94a3b8; display:flex; align-items:center; gap:.4rem; margin-top:.15rem;">
            <span>${escHtml(r.role || 'Responder')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();

  const selectedCount = (window._selectedResponders || []).length;
  const info = document.getElementById('responder-pagination-info');
  if (info) info.textContent = `Showing ${pageItems.length} of ${total} responders (${selectedCount} Selected)`;

  const rBadge = document.getElementById('responder-count-badge');
  if (rBadge) rBadge.textContent = `${selectedCount} Selected`;

  const controls = document.getElementById('responder-pagination-controls');
  if (controls) {
    if (totalPages <= 1) {
      controls.innerHTML = '';
    } else {
      let btnHtml = `
        <button type="button" class="page-btn" ${responderGridPagination.currentPage === 1 ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''} onclick="changeResponderGridPage(${responderGridPagination.currentPage - 1})" style="padding:.2rem .45rem; background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#cbd5e1; font-size:.72rem; cursor:pointer;">
          &larr;
        </button>
        <span style="font-size:.72rem; color:#94a3b8; padding:0 .3rem;">${responderGridPagination.currentPage} / ${totalPages}</span>
        <button type="button" class="page-btn" ${responderGridPagination.currentPage === totalPages ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''} onclick="changeResponderGridPage(${responderGridPagination.currentPage + 1})" style="padding:.2rem .45rem; background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.1); border-radius:6px; color:#cbd5e1; font-size:.72rem; cursor:pointer;">
          &rarr;
        </button>
      `;
      controls.innerHTML = btnHtml;
    }
  }
};

window.changeResponderGridPage = function(p) {
  responderGridPagination.currentPage = p;
  renderResponderSelectionGrid();
};

// =============================================
// Resolution & Duplicate Check Verification Modal
// =============================================
function openResolutionVerifyModal(incidentId) {
  const inc = allIncidents.find(i => i.id === incidentId);
  if (!inc) return;

  document.getElementById('res-verify-incident-id').value = incidentId;
  document.getElementById('res-verify-action').value = inc.action_taken || '';
  document.getElementById('res-verify-resources').value = inc.human_resources || '';
  document.getElementById('res-verify-confirm').checked = false;
  document.getElementById('res-verify-error').style.display = 'none';

  // Perform duplicate scan in current Sitio / 48h
  const scanBox = document.getElementById('duplicate-scan-results');
  if (scanBox) {
    const duplicates = allIncidents.filter(other => 
      other.id !== incidentId &&
      other.type === inc.type &&
      other.status !== 'resolved'
    );

    if (duplicates.length > 0) {
      scanBox.innerHTML = `
        <span style="color:#f87171;font-weight:700;"><i data-lucide="alert-triangle" style="width:13px;height:13px;vertical-align:middle;"></i> Found ${duplicates.length} potentially related active ticket(s):</span>
        <ul style="margin:.3rem 0 0 1.1rem;padding:0;">
          ${duplicates.map(d => `<li><strong>${getTicketNumber(d)}</strong>: ${escHtml(d.title)} (${escHtml(d.location_address || 'Same Area')})</li>`).join('')}
        </ul>
      `;
    } else {
      scanBox.innerHTML = `<span style="color:var(--success);"><i data-lucide="check-circle-2" style="width:13px;height:13px;vertical-align:middle;"></i> No active duplicate tickets detected for <strong>${escHtml(inc.title)}</strong> in Barangay Linao.</span>`;
    }
  }

  document.getElementById('resolution-verify-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeResolutionVerifyModal() {
  document.getElementById('resolution-verify-modal-overlay').classList.remove('active');
}

async function confirmIncidentResolution() {
  const id = document.getElementById('res-verify-incident-id').value;
  const action = document.getElementById('res-verify-action').value.trim();
  const resources = document.getElementById('res-verify-resources').value.trim();
  const confirmed = document.getElementById('res-verify-confirm').checked;
  const err = document.getElementById('res-verify-error');

  if (!action) {
    err.textContent = 'Please enter a final action taken / resolution summary.';
    err.style.display = 'block';
    return;
  }

  if (!confirmed) {
    err.textContent = 'Please check the Verification Confirmation box before resolving.';
    err.style.display = 'block';
    return;
  }

  try {
    const payload = {
      status: 'resolved',
      action_taken: action,
      resolution: action,
      human_resources: resources || null
    };

    await apiFetch(`/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    closeResolutionVerifyModal();
    closeStatusModal();
    showToast('Incident verified, locked with lock icon, and set to Resolved!', 'success', 'Incident Resolved');
    await loadIncidents();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

// =============================================
// Incident Modal — Enter Key Navigation
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  bindNativeDateTimePickers();

  const form = document.getElementById('incident-form');
  if (form) {
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      // Don't trigger on textareas (allow multi-line input)
      if (e.target.tagName === 'TEXTAREA') return;
      // Don't trigger on select dropdowns
      if (e.target.tagName === 'SELECT') return;
      e.preventDefault();
      if (currentWizardStep < 4) {
        nextStep();
      } else {
        openSummaryVerifyModal();
      }
    });
  }
});

// =============================================
// Quick Auto-Fill Demo Functions for Presentation / Defense
// =============================================

// Step 1: Title, Date, Time, Location Auto-Fill
window.autoFillStep1DemoData = function(suppressToast = false) {
  const titleEl = document.getElementById('inc-title');
  const dateEl  = document.getElementById('inc-date');
  const timeEl  = document.getElementById('inc-time');

  if (titleEl) titleEl.value = "Flash Flood & Rising Water Level at Bao River";

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  if (dateEl) dateEl.value = `${yyyy}-${mm}-${dd}`;
  if (timeEl) timeEl.value = `${hh}:${min}`;

  if (typeof pickCustomPurok === 'function') {
    pickCustomPurok('Purok 4');
  } else if (typeof selectPurokLocation === 'function') {
    selectPurokLocation('Purok 4');
  }

  const selectEl = document.getElementById('incident-purok-select');
  if (selectEl) selectEl.value = 'Purok 4';

  [titleEl, dateEl, timeEl, selectEl].forEach(el => {
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  if (!suppressToast && typeof showToast === 'function') {
    showToast('Step 1 demo data auto-populated!', 'info', 'Quick Fill');
  }
};

// Step 2: Victim / Complainant Auto-Fill
window.autoFillVictimDemoData = function(suppressToast = false) {
  const list = document.getElementById('victim-list');
  if (list) {
    let rows = list.querySelectorAll('.victim-row');
    if (rows.length === 0 && typeof addVictimRow === 'function') {
      addVictimRow();
      rows = list.querySelectorAll('.victim-row');
    }
    if (rows.length < 2 && typeof addVictimRow === 'function') {
      addVictimRow();
      rows = list.querySelectorAll('.victim-row');
    }

    if (rows.length >= 1) {
      const id1 = rows[0].id.replace('victim-row-', '');
      const fn1 = document.getElementById(`vfirst-${id1}`);
      const mn1 = document.getElementById(`vmiddle-${id1}`);
      const ln1 = document.getElementById(`vlast-${id1}`);
      const sf1 = document.getElementById(`vsuffix-${id1}`);

      if (fn1) fn1.value = "Juan";
      if (mn1) mn1.value = "M.";
      if (ln1) ln1.value = "Dela Cruz";
      if (sf1) sf1.value = "Jr.";
    }

    if (rows.length >= 2) {
      const id2 = rows[1].id.replace('victim-row-', '');
      const fn2 = document.getElementById(`vfirst-${id2}`);
      const mn2 = document.getElementById(`vmiddle-${id2}`);
      const ln2 = document.getElementById(`vlast-${id2}`);
      const sf2 = document.getElementById(`vsuffix-${id2}`);

      if (fn2) fn2.value = "Maria";
      if (mn2) mn2.value = "S.";
      if (ln2) ln2.value = "Dela Cruz";
      if (sf2) sf2.value = "";
    }
  }

  document.querySelectorAll('#wizard-pane-2 input').forEach(el => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  if (!suppressToast && typeof showToast === 'function') {
    showToast('Step 2 victim details auto-populated!', 'info', 'Quick Fill');
  }
};

// Step 3: Suspects & Respondents Auto-Fill
window.autoFillSuspectResponderDemoData = function(suppressToast = false) {
  const list = document.getElementById('suspect-list');
  if (list) {
    let rows = list.querySelectorAll('.victim-row');
    if (rows.length === 0 && typeof addSuspectRow === 'function') {
      addSuspectRow();
      rows = list.querySelectorAll('.victim-row');
    }

    if (rows.length >= 1) {
      const id1 = rows[0].id.replace('suspect-row-', '');
      const fn1 = document.getElementById(`sfirst-${id1}`);
      const mn1 = document.getElementById(`smiddle-${id1}`);
      const ln1 = document.getElementById(`slast-${id1}`);
      const sf1 = document.getElementById(`ssuffix-${id1}`);

      if (fn1) fn1.value = "Pedro";
      if (mn1) mn1.value = "B.";
      if (ln1) ln1.value = "Penduko";
      if (sf1) sf1.value = "";
    }
  }

  const respondentList = document.getElementById('respondent-list');
  if (respondentList) {
    let rows = respondentList.querySelectorAll('.respondent-row');
    if (rows.length === 0 && typeof addRespondentRow === 'function') {
      addRespondentRow();
      rows = respondentList.querySelectorAll('.respondent-row');
    }

    if (rows.length >= 1) {
      const id1 = rows[0].id.replace('respondent-row-', '');
      const fn1 = document.getElementById(`rfirst-${id1}`);
      const mn1 = document.getElementById(`rmiddle-${id1}`);
      const ln1 = document.getElementById(`rlast-${id1}`);
      const sf1 = document.getElementById(`rsuffix-${id1}`);

      if (fn1) fn1.value = "Juan";
      if (mn1) mn1.value = "C.";
      if (ln1) ln1.value = "Santos";
      if (sf1) sf1.value = "";
    }
  }

  document.querySelectorAll('#wizard-pane-3 input, #wizard-pane-3 select').forEach(el => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  if (!suppressToast && typeof showToast === 'function') {
    showToast('Step 3 suspects and respondents auto-populated!', 'info', 'Quick Fill');
  }
};

// Step 4: Remarks Auto-Fill
window.autoFillRemarksDemoData = function(suppressToast = false) {
  const remEl = document.getElementById('inc-remarks');
  const chkEl = document.getElementById('inc-privacy-consent');

  if (remEl) remEl.value = "Bao River overflowed causing knee-deep flash flooding near Purok 4 bridge. 3 families safely evacuated to Barangay Hall Command Center. Medical triage completed.";
  if (chkEl) chkEl.checked = true;

  if (remEl) {
    remEl.dispatchEvent(new Event('input', { bubbles: true }));
    remEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (!suppressToast && typeof showToast === 'function') {
    showToast('Step 4 remarks & privacy consent auto-populated!', 'info', 'Quick Fill');
  }
};

// Master Auto-Fill for Incident Intake
window.autoFillIncidentDemoData = function() {
  autoFillStep1DemoData(true);
  autoFillVictimDemoData(true);
  autoFillSuspectResponderDemoData(true);
  autoFillRemarksDemoData(true);

  if (typeof showToast === 'function') {
    showToast('Full incident intake demo data auto-populated successfully!', 'info', 'Master Quick Fill');
  }
};

window.autoFillResponderDemoData = function() {
  const fn  = document.getElementById('tanod-first-name');
  const mn  = document.getElementById('tanod-middle-name');
  const ln  = document.getElementById('tanod-last-name');
  const suf = document.getElementById('tanod-suffix');
  const con = document.getElementById('tanod-contact');
  const eml = document.getElementById('tanod-email');
  const adr = document.getElementById('tanod-address');
  const rol = document.getElementById('tanod-role');
  const emc = document.getElementById('tanod-emergency-contact');
  const emr = document.getElementById('tanod-emergency-relation');

  if (fn)  fn.value  = "Ricardo";
  if (mn)  mn.value  = "B.";
  if (ln)  ln.value  = "Alvarez";
  if (suf) suf.value = "Jr.";
  if (con) con.value = "+63-917-888-1234";
  if (eml) eml.value = "ricardo.alvarez@linaodrrm.gov.ph";
  if (adr) adr.value = "Purok 2, Barangay Linao, Ormoc City";
  if (rol) rol.value = "Barangay Tanod";
  if (emc) emc.value = "+63-917-888-5678";
  if (emr) emr.value = "Spouse";

  document.querySelectorAll('#tanod-form input, #tanod-form select').forEach(el => {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  if (typeof showToast === 'function') {
    showToast('Demo responder data auto-populated!', 'info', 'Quick Fill');
  }
};

// =============================================
// Incident Tab Switching & Activity Log System
// =============================================

let allIncidentLogs = [];
let incidentLogsLoaded = false;

let incidentLogPagination = { currentPage: 1, pageSize: 25, filtered: [] };

function getIncidentTitleById(incidentId) {
  const incident = allIncidents.find(i => String(i.id) === String(incidentId));
  return incident ? incident.title : 'Incident';
}

function inferIncidentLogEventType(log) {
  const summary = String(log.change_summary || log.description || '').toLowerCase();

  // Created -> mark as 'added'
  if (summary.includes('created') || summary.includes('incident created') || summary.includes('created incident') || summary.includes('reported')) return 'added';

  // Status change to resolved -> 'resolved'
  if (log.status_before && log.status_before !== log.status_after) {
    if (String(log.status_after).toLowerCase() === 'resolved') return 'resolved';
    // other status changes considered 'updated' in the simplified model
    return 'updated';
  }

  // All other cases are 'updated' (this collapses responder_assigned, status_changed, etc.)
  return 'updated';
}

function findNestedValue(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findNestedValue(item, key);
      if (found) return found;
    }
    return null;
  }
  if (obj[key]) return obj[key];
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findNestedValue(value, key);
      if (found) return found;
    }
  }
  return null;
}

function buildIncidentLogEntry(audit) {
  const performByName = audit.users?.full_name || audit.changed_by_name || findNestedValue(audit, 'full_name') || 'BDRRMC Admin';
  const incidentTitle = audit.incident?.title || audit.incidents?.title || findNestedValue(audit, 'title') || getIncidentTitleById(audit.incident_id);
  return {
    id: audit.id || `inc-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: audit.change_timestamp || audit.created_at || new Date().toISOString(),
    incident_title: incidentTitle || 'Incident',
    event_type: audit.event_type || inferIncidentLogEventType(audit),
    description: audit.change_summary || audit.description || 'Incident operation recorded',
    performed_by_name: performByName,
  };
}

async function loadIncidentLogs() {
  try {
    const data = await API.get('/incidents/logs');
    allIncidentLogs = (Array.isArray(data) && data.length > 0) ? data.map(buildIncidentLogEntry) : getSampleIncidentLogs();
  } catch (err) {
    console.warn('Unable to load incident activity logs, fallback to local entries:', err);
    allIncidentLogs = getSampleIncidentLogs();
  }
  incidentLogPagination.filtered = [...allIncidentLogs];
  incidentLogPagination.currentPage = 1;
  incidentLogsLoaded = true;
  if (document.getElementById('pane-logs')?.style.display !== 'none') {
    renderIncidentLogs();
  }
}

function getSampleIncidentLogs() {
  return [
    {
      id: 'inc-log-1',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      incident_title: 'Flash Flood Warning — Purok 4',
      event_type: 'resolved',
      description: 'Marked incident as resolved after water levels normalized and evacuees safely returned.',
      performed_by_name: 'BDRRMC Officer Tan'
    },
    {
      id: 'inc-log-2',
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      incident_title: 'Residential Structural Damage',
      event_type: 'updated',
      description: 'Dispatched 4 Tanod responders and updated victim welfare details.',
      performed_by_name: 'Tanod Responder Reyes'
    },
    {
      id: 'inc-log-3',
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      incident_title: 'Power Line Obstruction — Barangay Road',
      event_type: 'added',
      description: 'Intake created via dispatch portal and forwarded to Ormoc Electric Cooperative (ORECO).',
      performed_by_name: 'BDRRMC Admin'
    }
  ];
}

function addIncidentActivityLogEntry(entry) {
  const newLog = {
    id: 'inc-log-' + Date.now(),
    created_at: entry.created_at || new Date().toISOString(),
    incident_title: entry.incident_title || 'General Incident',
    event_type: entry.event_type || 'updated',
    description: entry.description || 'Action performed',
    performed_by_name: entry.performed_by_name || 'BDRRMC Admin',
  };
  allIncidentLogs.unshift(newLog);
  if (document.getElementById('pane-logs')?.style.display !== 'none') {
    filterIncidentLogs();
  }
}

function switchIncidentTab(tab) {
  const tabs = ['all', 'logs', 'threats'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const pane = document.getElementById(`pane-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
    if (pane) pane.style.display = (t === tab) ? 'block' : 'none';
  });

  if (tab === 'logs') {
    if (!incidentLogsLoaded) {
      loadIncidentLogs();
    } else {
      filterIncidentLogs();
    }
  } else if (tab === 'threats') {
    loadActiveThreatBoard();
    startThreatAutoRefresh();
  } else {
    stopThreatAutoRefresh();
  }
}

function filterIncidentLogs() {
  const search = document.getElementById('inc-log-search')?.value.toLowerCase().trim() || '';
  const event  = document.getElementById('inc-log-filter-event')?.value || '';

  const clearBtn = document.getElementById('btn-clear-inc-log-filters');
  if (clearBtn) clearBtn.style.display = (search || event) ? 'inline-flex' : 'none';

  incidentLogPagination.filtered = allIncidentLogs.filter(log => {
    if (event && log.event_type !== event) return false;
    if (search) {
      const text = `${log.incident_title} ${log.description} ${log.performed_by_name} ${log.event_type}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  incidentLogPagination.currentPage = 1;
  renderIncidentLogs();
}

function clearIncidentLogFilters() {
  const s = document.getElementById('inc-log-search'); if (s) s.value = '';
  const e = document.getElementById('inc-log-filter-event'); if (e) e.value = '';
  updateLogEventFilterLabel();
  document.querySelectorAll('#filter-log-event-dropdown .filter-dropdown-item').forEach(btn => {
    btn.style.background = 'transparent';
  });
  filterIncidentLogs();
}

function renderIncidentLogs() {
  const total = incidentLogPagination.filtered.length;
  const pageSize = incidentLogPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (incidentLogPagination.currentPage > totalPages) incidentLogPagination.currentPage = totalPages;
  if (incidentLogPagination.currentPage < 1) incidentLogPagination.currentPage = 1;

  const start = (incidentLogPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = incidentLogPagination.filtered.slice(start, end);

  const tbody = document.getElementById('inc-logs-tbody');
  if (!tbody) return;

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="text-align:center;padding:2rem;">No incident activity logs match the selected filter.</td></tr>`;
  } else {
    const EVENT_BADGES = {
      added: '<span class="badge badge-red"><i data-lucide="plus-circle" style="width:11px;height:11px;"></i> Added</span>',
      updated: '<span class="badge badge-orange"><i data-lucide="edit-3" style="width:11px;height:11px;"></i> Updated</span>',
      resolved: '<span class="badge badge-green"><i data-lucide="lock" style="width:11px;height:11px;"></i> Resolved</span>',
    };

    tbody.innerHTML = pageData.map(log => `
      <tr onclick="openIncidentLogDetailModal('${log.id}')" style="cursor:pointer;" title="Click to view full activity log record">
        <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap;">${formatDate(log.created_at)}</td>
        <td style="font-weight:700;color:var(--text-main);">${escHtml(log.incident_title)}</td>
        <td>${EVENT_BADGES[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}</td>
        <td style="font-size:.82rem;color:var(--text-muted);line-height:1.4;">${escHtml(log.description)}</td>
        <td style="font-size:.82rem;color:var(--text-main);font-weight:600;"><i data-lucide="user-check" style="width:12px;height:12px;vertical-align:middle;margin-right:.3rem;color:#60a5fa;"></i>${escHtml(log.performed_by_name || 'BDRRMC Admin')}</td>
      </tr>
    `).join('');
  }

  const pagEl = document.getElementById('inc-log-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';

  const info = document.getElementById('inc-log-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${start + 1} to ${end} of ${total} entries`;

  // Render page number buttons into the pagination controls so users can jump pages
  const pageNumbersEl = document.getElementById('inc-log-page-numbers');
  if (pageNumbersEl) {
    if (totalPages <= 1) {
      pageNumbersEl.innerHTML = '';
    } else {
      let html = '';
      for (let p = 1; p <= totalPages; p++) {
        html += `<button type="button" class="page-btn ${p === incidentLogPagination.currentPage ? 'active' : ''}" onclick="goToIncidentLogPage(${p})" ${p === incidentLogPagination.currentPage ? 'disabled style="opacity:.6;cursor:not-allowed;"' : ''}>${p}</button>`;
      }
      pageNumbersEl.innerHTML = html;
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Pagination helpers for Incident Activity Log (wired to the HTML controls)
function changeIncidentLogPageSize(val) {
  incidentLogPagination.pageSize = parseInt(val, 10) || 25;
  incidentLogPagination.currentPage = 1;
  renderIncidentLogs();
}

function prevIncidentLogPage() {
  if (incidentLogPagination.currentPage > 1) {
    incidentLogPagination.currentPage--;
    renderIncidentLogs();
  }
}

function nextIncidentLogPage() {
  const totalPages = Math.ceil(incidentLogPagination.filtered.length / incidentLogPagination.pageSize) || 1;
  if (incidentLogPagination.currentPage < totalPages) {
    incidentLogPagination.currentPage++;
    renderIncidentLogs();
  }
}

function goToIncidentLogPage(p) {
  incidentLogPagination.currentPage = p;
  renderIncidentLogs();
}

function openIncidentLogDetailModal(id) {
  const log = allIncidentLogs.find(l => String(l.id) === String(id));
  if (!log) return;

  const modalBody = document.getElementById('inc-log-modal-body');
  if (!modalBody) return;

  const dt = log.created_at
    ? new Date(log.created_at).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : '—';

  const EVENT_BADGES = {
    added: '<span class="badge badge-red"><i data-lucide="plus-circle" style="width:11px;height:11px;"></i> Added</span>',
    updated: '<span class="badge badge-orange"><i data-lucide="edit-3" style="width:11px;height:11px;"></i> Updated</span>',
    resolved: '<span class="badge badge-green"><i data-lucide="lock" style="width:11px;height:11px;"></i> Resolved</span>',
  };

  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.2rem;">
      <div style="padding:1rem;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">Incident Operation</div>
        <div style="font-size:1.15rem;font-weight:800;color:var(--text-main);">${escHtml(log.incident_title || '—')}</div>
        <div style="font-size:.8rem;color:#60a5fa;margin-top:.25rem;font-weight:600;"><i data-lucide="shield-alert" style="width:13px;height:13px;vertical-align:middle;"></i> DRRM Lifecycle Audit Record</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">EVENT ACTION</div>
          <div>${EVENT_BADGES[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}</div>
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

  document.getElementById('inc-log-detail-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeIncidentLogDetailModal() {
  document.getElementById('inc-log-detail-modal-overlay')?.classList.remove('active');
}

function closeIncidentLogDetailModalOutside(event) {
  if (event.target.id === 'inc-log-detail-modal-overlay') closeIncidentLogDetailModal();
}



// =============================================
// FEATURE: Severity Triage System
// =============================================

const TRIAGE_CONFIG = {
  green: {
    label: 'Green — Minor',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.4)',
    icon: 'check-circle',
    description: 'No immediate deployment required. Monitor remotely.',
  },
  yellow: {
    label: 'Yellow — Moderate',
    color: '#eab308',
    bg: 'rgba(234,179,8,0.15)',
    border: 'rgba(234,179,8,0.4)',
    icon: 'alert-triangle',
    description: 'Dispatch 1–2 BRT members on-site to assess.',
  },
  orange: {
    label: 'Orange — Serious',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.15)',
    border: 'rgba(249,115,22,0.4)',
    icon: 'siren',
    description: 'Deploy BDRRMC response team immediately.',
  },
  red: {
    label: 'Red — Critical',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.15)',
    border: 'rgba(239,68,68,0.4)',
    icon: 'flame',
    description: 'All-hands mobilization. Notify CDRRMO Ormoc.',
  },
};

function getTriageBadge(level) {
  const cfg = TRIAGE_CONFIG[level] || TRIAGE_CONFIG.green;
  return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .55rem;border-radius:6px;background:${cfg.bg};border:1px solid ${cfg.border};color:${cfg.color};font-size:.72rem;font-weight:700;">
    <i data-lucide="${cfg.icon}" style="width:11px;height:11px;"></i>${cfg.label}
  </span>`;
}

async function setIncidentTriage(incidentId, triageLevel) {
  try {
    const result = await apiFetch(`/incidents/${incidentId}/triage?triage_level=${triageLevel}`, { method: 'PATCH' });
    showToast(`Triage level set to ${TRIAGE_CONFIG[triageLevel]?.label || triageLevel}`, 'success', 'Triage Updated');
    // Refresh threat board if visible
    const threatPane = document.getElementById('pane-threats');
    if (threatPane && threatPane.style.display !== 'none') {
      loadActiveThreatBoard();
    }
    // Patch local copy so table re-render is instant
    const inc = allIncidents.find(i => i.id === incidentId);
    if (inc) inc.triage_level = triageLevel;
    return result;
  } catch (e) {
    showToast(e.message || 'Failed to update triage level', 'error', 'Triage Error');
    throw e;
  }
}

function buildTriageControls(incidentId, currentLevel) {
  return Object.entries(TRIAGE_CONFIG).map(([level, cfg]) => {
    const isActive = level === (currentLevel || 'green');
    return `<button type="button" onclick="setIncidentTriage('${incidentId}','${level}')"
      style="flex:1;padding:.4rem .2rem;border-radius:7px;border:2px solid ${isActive ? cfg.color : 'transparent'};background:${isActive ? cfg.bg : 'rgba(15,23,42,0.6)'};color:${isActive ? cfg.color : '#94a3b8'};font-size:.72rem;font-weight:700;cursor:pointer;transition:all .15s;text-align:center;"
      title="${cfg.description}">
      <i data-lucide="${cfg.icon}" style="width:12px;height:12px;display:block;margin:0 auto .2rem;"></i>${cfg.label.split(' — ')[0]}
    </button>`;
  }).join('');
}

// =============================================
// FEATURE: Responder Dispatch Panel
// =============================================

// Dispatch functionality removed per purge policy. Provide minimal no-op implementations
// so existing UI code that references these functions will not crash.

let _dispatchCache = {}; // kept for API shape compatibility

async function loadDispatchForIncident(incidentId) {
  // Dispatch records were removed; return empty list
  _dispatchCache[incidentId] = [];
  return [];
}

function renderDispatchPanel(incidentId, dispatches) {
  // Return a simple informational placeholder to show the panel area without interactive controls
  return `<div style="font-size:.82rem;color:#94a3b8;padding:.6rem;">Responder dispatch functionality has been removed.</div>`;
}

async function updateDispatchStatus(incidentId, dispatchId, newStatus) {
  // No-op: dispatch records are purged. Notify user in UI if possible.
  if (typeof showToast === 'function') showToast('Dispatch functionality is disabled', 'info', 'Dispatch Disabled');
  // Refresh threat board if visible to keep UI state consistent
  const tp = document.getElementById('pane-threats');
  if (tp && tp.style.display !== 'none' && typeof loadActiveThreatBoard === 'function') loadActiveThreatBoard();
}

function openDispatchFormPanel(incidentId) {
  if (typeof showToast === 'function') showToast('Dispatch UI has been removed', 'info', 'Dispatch Disabled');
}

function closeDispatchFormPanel() {}

async function submitDispatchForm(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  if (typeof showToast === 'function') showToast('Dispatch submission disabled', 'info', 'Dispatch Disabled');
}

// =============================================
// FEATURE: Active Threat Board Tab
// =============================================

let threatBoardData = null;
let threatAutoRefreshTimer = null;

async function loadActiveThreatBoard() {
  const container = document.getElementById('threat-board-container');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center;padding:2.5rem 1rem;color:#64748b;font-size:.85rem;">
    <div style="width:28px;height:28px;border:3px solid rgba(255,255,255,0.07);border-top-color:#ef4444;border-radius:50%;animation:spin .75s linear infinite;margin:0 auto .6rem;"></div>
    Loading threat board...
  </div>`;

  try {
    threatBoardData = await apiFetch('/incidents/threats/active');
    renderThreatBoard(threatBoardData);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:#f87171;font-size:.84rem;">
      <i data-lucide="alert-circle" style="width:24px;height:24px;margin-bottom:.5rem;"></i>
      <div>Failed to load threat board. <button onclick="loadActiveThreatBoard()" style="color:#60a5fa;background:none;border:none;cursor:pointer;text-decoration:underline;">Retry</button></div>
    </div>`;
    if (window.lucide) lucide.createIcons();
  }
}

function renderThreatBoard(data) {
  const container = document.getElementById('threat-board-container');
  if (!container) return;

  const { total, red_count, orange_count, yellow_count, green_count, threats } = data;

  const summaryBar = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.65rem;margin-bottom:1.25rem;">
      ${[
        { key:'red',    count: red_count,    label:'Critical', ...TRIAGE_CONFIG.red },
        { key:'orange', count: orange_count, label:'Serious',  ...TRIAGE_CONFIG.orange },
        { key:'yellow', count: yellow_count, label:'Moderate', ...TRIAGE_CONFIG.yellow },
        { key:'green',  count: green_count,  label:'Minor',    ...TRIAGE_CONFIG.green },
      ].map(t => `
        <div style="background:${t.bg};border:1px solid ${t.border};border-radius:12px;padding:.75rem;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:${t.color};font-family:'Space Grotesk',sans-serif;">${t.count}</div>
          <div style="font-size:.72rem;font-weight:700;color:${t.color};text-transform:uppercase;letter-spacing:.05em;">${t.label}</div>
        </div>`
      ).join('')}
    </div>`;

  if (!threats.length) {
    container.innerHTML = summaryBar + `
      <div class="dash-feed-empty" style="margin:0;border-radius:12px;">
        <div class="dash-feed-empty-icon success"><i data-lucide="shield-check"></i></div>
        <div class="dash-feed-empty-text">
          <p class="dash-feed-empty-title">No Active Threats</p>
          <span class="dash-feed-empty-sub">All clear — no ongoing incidents at this time.</span>
        </div>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const cards = threats.map(t => {
    const tc = TRIAGE_CONFIG[t.triage_level] || TRIAGE_CONFIG.green;
    const sc = DISPATCH_STATUS_CFG;
    const actions = (t.triage_guidance?.actions || []).slice(0, 3);

    return `
      <div style="background:rgba(15,23,42,0.85);border:1px solid ${tc.border};border-left:4px solid ${tc.color};border-radius:12px;padding:1rem 1.1rem;margin-bottom:.85rem;backdrop-filter:blur(10px);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.35rem;">
              ${getTriageBadge(t.triage_level)}
              ${SEVERITY_BADGE[t.severity] || ''}
              ${TYPE_BADGE[t.type] || `<span class="badge">${escHtml(t.type)}</span>`}
            </div>
            <div style="font-size:.95rem;font-weight:800;color:#f8fafc;line-height:1.3;margin-bottom:.2rem;">${escHtml(t.title)}</div>
            <div style="font-size:.78rem;color:#94a3b8;display:flex;align-items:center;gap:.35rem;">
              <i data-lucide="map-pin" style="width:12px;height:12px;"></i>
              ${escHtml(t.location_address || 'Barangay Linao')}
              <span style="color:#64748b;">·</span>
              <i data-lucide="clock" style="width:12px;height:12px;"></i>
              ${formatDate(t.created_at)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;flex-shrink:0;">
            <div style="font-size:.72rem;color:${t.active_responders > 0 ? '#34d399' : '#f87171'};font-weight:700;display:flex;align-items:center;gap:.3rem;">
              <i data-lucide="${t.active_responders > 0 ? 'shield-check' : 'shield-alert'}" style="width:12px;height:12px;"></i>
              ${t.active_responders} Responder${t.active_responders !== 1 ? 's' : ''} Active
            </div>
            <div style="display:flex;gap:.35rem;">
              <button type="button" onclick="openDispatchFormPanel('${t.id}')"
                style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;cursor:pointer;display:flex;align-items:center;gap:.3rem;">
                <i data-lucide="user-plus" style="width:11px;height:11px;"></i>Dispatch
              </button>
              <button type="button" onclick="openDetailModal('${t.id}')"
                style="font-size:.72rem;padding:.25rem .6rem;border-radius:6px;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;cursor:pointer;display:flex;align-items:center;gap:.3rem;">
                <i data-lucide="eye" style="width:11px;height:11px;"></i>View
              </button>
            </div>
          </div>
        </div>

        ${t.casualty_count > 0 || t.people_involved > 0 ? `
          <div style="display:flex;gap:.75rem;margin-top:.65rem;padding:.5rem .65rem;background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:8px;flex-wrap:wrap;">
            ${t.people_involved > 0 ? `<span style="font-size:.77rem;color:#fca5a5;"><i data-lucide="users" style="width:12px;height:12px;vertical-align:middle;"></i> ${t.people_involved} involved</span>` : ''}
            ${t.casualty_count > 0 ? `<span style="font-size:.77rem;color:#f87171;"><i data-lucide="heart-pulse" style="width:12px;height:12px;vertical-align:middle;"></i> ${t.casualty_count} ${t.casualty_status || 'casualty/ies'}</span>` : ''}
          </div>` : ''}

        ${actions.length ? `
          <div style="margin-top:.65rem;padding:.6rem .75rem;background:rgba(0,0,0,0.25);border-radius:8px;">
            <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:${tc.color};margin-bottom:.35rem;">Recommended Actions</div>
            ${actions.map(a => `<div style="font-size:.78rem;color:#cbd5e1;display:flex;align-items:flex-start;gap:.4rem;margin-bottom:.2rem;"><i data-lucide="chevron-right" style="width:12px;height:12px;color:${tc.color};flex-shrink:0;margin-top:.15rem;"></i>${escHtml(a)}</div>`).join('')}
          </div>` : ''}

        <!-- Triage escalation/de-escalation controls -->
        <div style="margin-top:.65rem;">
          <div style="font-size:.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.35rem;">Adjust Triage Level</div>
          <div style="display:flex;gap:.35rem;">
            ${buildTriageControls(t.id, t.triage_level)}
          </div>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = summaryBar + cards;
  if (window.lucide) lucide.createIcons();
}

function startThreatAutoRefresh() {
  stopThreatAutoRefresh();
  threatAutoRefreshTimer = setInterval(() => {
    const tp = document.getElementById('pane-threats');
    if (tp && tp.style.display !== 'none') {
      loadActiveThreatBoard();
    }
  }, 30000); // refresh every 30s
}

function stopThreatAutoRefresh() {
  if (threatAutoRefreshTimer) {
    clearInterval(threatAutoRefreshTimer);
    threatAutoRefreshTimer = null;
  }
}

// Hook into tab switching — call loadActiveThreatBoard when threats tab is selected
const _origSwitchIncidentTab = typeof switchIncidentTab === 'function' ? switchIncidentTab : null;
window.switchIncidentTab = function(tab) {
  if (_origSwitchIncidentTab) _origSwitchIncidentTab(tab);
  if (tab === 'threats') {
    loadActiveThreatBoard();
    startThreatAutoRefresh();
  } else {
    stopThreatAutoRefresh();
  }
};
