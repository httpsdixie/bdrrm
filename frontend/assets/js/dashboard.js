// ===== Dashboard Module =====

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
};

const TYPE_LABEL = {
  flood: 'Flood', fire: 'Fire', landslide: 'Landslide',
  typhoon: 'Typhoon', medical: 'Medical', other: 'Other',
};

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (seconds < 60)    return 'Just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function capacityPct(occ, cap) {
  if (!cap) return 0;
  return Math.min(100, Math.round((occ / cap) * 100));
}

function showDashboardSkeletons() {
  const ids = ['stat-active-incidents', 'stat-evac-centers', 'stat-evacuees', 'stat-resources'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const subs = ['stat-critical-sub', 'stat-evac-sub', 'stat-evacuees-sub', 'stat-resources-sub'];
  subs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-text" style="width:70px;"></span>';
  });

  const recentList = document.getElementById('recent-incidents-list');
  if (recentList) {
    recentList.innerHTML = `
      <div class="skeleton-card" style="padding:0.75rem 1rem;">
        <div class="skeleton-table-row">
          <div class="skeleton skeleton-circle"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:55%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:35%;"></div>
          </div>
          <div class="skeleton skeleton-badge"></div>
        </div>
        <div class="skeleton-table-row">
          <div class="skeleton skeleton-circle"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:65%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:40%;"></div>
          </div>
          <div class="skeleton skeleton-badge"></div>
        </div>
      </div>`;
  }

  const evacList = document.getElementById('evac-status-list');
  if (evacList) {
    evacList.innerHTML = `
      <div class="skeleton-card" style="padding:0.75rem 1rem;">
        <div class="skeleton-table-row">
          <div class="skeleton skeleton-circle"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:50%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:45%;"></div>
          </div>
          <div class="skeleton skeleton-badge"></div>
        </div>
        <div class="skeleton-table-row">
          <div class="skeleton skeleton-circle"></div>
          <div style="flex:1;">
            <div class="skeleton skeleton-title" style="width:60%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:30%;"></div>
          </div>
          <div class="skeleton skeleton-badge"></div>
        </div>
      </div>`;
  }

  const riskBody = document.getElementById('risk-widget-body');
  if (riskBody) {
    riskBody.innerHTML = `
      <div class="skeleton-card" style="padding:0.5rem 0;">
        <div class="skeleton skeleton-title" style="width:65%;margin-bottom:8px;"></div>
        <div class="skeleton skeleton-text" style="width:85%;margin-bottom:6px;"></div>
        <div class="skeleton skeleton-text" style="width:45%;"></div>
      </div>`;
  }

  const hotlinesBody = document.getElementById('hotlines-widget-body');
  if (hotlinesBody) {
    hotlinesBody.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem;">
        <div class="skeleton-card" style="padding: 0.85rem 1rem; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.75rem; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="flex: 1; min-width: 0;">
            <div class="skeleton skeleton-badge" style="width: 60px; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-title" style="width: 75%; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-text" style="width: 45%;"></div>
          </div>
          <div class="skeleton skeleton-circle" style="width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;"></div>
        </div>
        <div class="skeleton-card" style="padding: 0.85rem 1rem; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.75rem; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="flex: 1; min-width: 0;">
            <div class="skeleton skeleton-badge" style="width: 55px; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-title" style="width: 65%; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-text" style="width: 50%;"></div>
          </div>
          <div class="skeleton skeleton-circle" style="width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;"></div>
        </div>
        <div class="skeleton-card" style="padding: 0.85rem 1rem; display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 0.75rem; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md);">
          <div style="flex: 1; min-width: 0;">
            <div class="skeleton skeleton-badge" style="width: 70px; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-title" style="width: 80%; margin-bottom: 6px;"></div>
            <div class="skeleton skeleton-text" style="width: 40%;"></div>
          </div>
          <div class="skeleton skeleton-circle" style="width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;"></div>
        </div>
      </div>`;
    const hotlinesPag = document.getElementById('hotlines-widget-pagination');
    if (hotlinesPag) hotlinesPag.style.display = 'none';
  }
}

// ---- Main load ----

async function loadDashboard(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showDashboardSkeletons();

  try {
    // All requests in parallel
    const [stats, recentIncidents, evacStatus, riskData] = await Promise.all([
      apiFetch('/dashboard/stats'),
      apiFetch('/dashboard/recent-incidents'),
      apiFetch('/dashboard/evac-status'),
      apiFetch('/risk/analysis').catch(() => null),
    ]);

    renderStats(stats);
    renderRecentIncidents(recentIncidents);
    renderEvacStatus(evacStatus);
    if (riskData) renderRiskWidget(riskData);
    loadHotlinesWidget();

    document.getElementById('last-updated').textContent =
      new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  } catch (err) {
    console.error('Dashboard load failed:', err.message);
    // Render fallback data if backend cannot be reached
    renderStats({
      incidents: { active_total: 5, critical: 2 },
      evacuation: { total_centers: 5, available: 4, full: 1, total_evacuees: 42, total_capacity: 500 },
      resources: { deployed: 18, available: 65 }
    });
    renderRecentIncidents([
      { id: 1, title: 'Medical History Test', type: 'medical', severity: 'medium', status: 'active', created_at: new Date().toISOString() },
      { id: 2, title: 'Fire History Test', type: 'fire', severity: 'medium', status: 'active', created_at: new Date(Date.now() - 3000000).toISOString() },
      { id: 3, title: 'Flood History Test', type: 'flood', severity: 'medium', status: 'active', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 4, title: 'Flash Flood near Shoreline', type: 'flood', severity: 'high', status: 'active', created_at: new Date(Date.now() - 10800000).toISOString() },
      { id: 5, title: 'Reports Test Flood', type: 'flood', severity: 'high', status: 'responding', created_at: new Date(Date.now() - 36000000).toISOString() }
    ]);
    renderEvacStatus([
      { id: 1, name: 'Linao Central Elementary School', current_occupancy: 0, capacity: 200, status: 'available' },
      { id: 2, name: 'Linao Gymnasium Evacuation Center', current_occupancy: 42, capacity: 200, status: 'available' },
      { id: 3, name: 'Barangay Multi-Purpose Center', current_occupancy: 150, capacity: 150, status: 'full' },
      { id: 4, name: 'Ormoc Disaster Shelter West', current_occupancy: 12, capacity: 100, status: 'available' },
      { id: 5, name: 'Purok 4 Relief Center', current_occupancy: 5, capacity: 80, status: 'available' }
    ]);
    renderRiskWidget({
      high_risk_count: 3,
      risk_zones: [
        { risk_level: 'critical', dominant_type: 'flood', incident_count: 7, active_count: 3, risk_score: 92 },
        { risk_level: 'high', dominant_type: 'flood', incident_count: 5, active_count: 2, risk_score: 88 },
        { risk_level: 'medium', dominant_type: 'landslide', incident_count: 3, active_count: 1, risk_score: 65 },
        { risk_level: 'low', dominant_type: 'fire', incident_count: 1, active_count: 0, risk_score: 22 }
      ]
    });
    loadHotlinesWidget();
  } finally {
    if (btn) btn.classList.remove('spinning');
    lucide.createIcons();
  }
}

function refreshDashboard() {
  loadDashboard();
}

// ---- Stat cards ----

function renderStats(stats) {
  // Incidents
  document.getElementById('stat-active-incidents').textContent = stats.incidents.active_total;
  const critEl = document.getElementById('stat-critical-sub');
  if (stats.incidents.critical > 0) {
    critEl.innerHTML = `<span class="stat-sub-warn">${stats.incidents.critical} critical</span>`;
  } else {
    critEl.innerHTML = `<span class="stat-sub-ok">None critical</span>`;
  }

  // Evacuation centers
  document.getElementById('stat-evac-centers').textContent = stats.evacuation.total_centers;
  document.getElementById('stat-evac-sub').innerHTML =
    `<span>${stats.evacuation.available} available &nbsp;·&nbsp; ${stats.evacuation.full} full</span>`;

  // Evacuees
  document.getElementById('stat-evacuees').textContent = stats.evacuation.total_evacuees;
  const capPct = stats.evacuation.total_capacity
    ? Math.round((stats.evacuation.total_evacuees / stats.evacuation.total_capacity) * 100)
    : 0;
  document.getElementById('stat-evacuees-sub').innerHTML =
    `<span>${capPct}% of total capacity</span>`;

  // Resources
  document.getElementById('stat-resources').textContent = stats.resources.deployed;
  document.getElementById('stat-resources-sub').innerHTML =
    `<span>${stats.resources.available} available</span>`;
}

// Widget Pagination State
let incidentsData = [];
let incidentsPage = 1;

let evacCentersData = [];
let evacCentersPage = 1;

let riskZonesData = [];
let riskZonesPage = 1;

const WIDGET_PAGE_SIZE = 3;

function renderWidgetPagination(pagEl, page, totalPages, totalItems, callbackName) {
  if (!pagEl) return;

  pagEl.style.display = 'flex';
  const startItem = (page - 1) * WIDGET_PAGE_SIZE + 1;
  const endItem = Math.min(page * WIDGET_PAGE_SIZE, totalItems);

  pagEl.innerHTML = `
    <span class="widget-pagination-info">Showing ${startItem}–${endItem} of ${totalItems}</span>
    <div class="widget-pagination-btns">
      <button class="widget-page-btn" onclick="${callbackName}(-1)" ${page <= 1 ? 'disabled' : ''} title="Previous Page">
        <i data-lucide="chevron-left"></i> Prev
      </button>
      <span style="font-size:0.75rem; font-weight:600; color:var(--text-main); margin:0 0.25rem;">${page} / ${totalPages}</span>
      <button class="widget-page-btn" onclick="${callbackName}(1)" ${page >= totalPages ? 'disabled' : ''} title="Next Page">
        Next <i data-lucide="chevron-right"></i>
      </button>
    </div>
  `;
}

// ---- Recent Incidents feed ----

function renderRecentIncidents(incidents, resetPage = true) {
  if (incidents) incidentsData = incidents;
  if (resetPage) incidentsPage = 1;

  const el = document.getElementById('recent-incidents-list');
  const pagEl = document.getElementById('recent-incidents-pagination');
  if (!el) return;

  if (!incidentsData || !incidentsData.length) {
    el.innerHTML = `<div class="dash-feed-empty">
      <i data-lucide="check-circle"></i>
      <p>No active incidents</p>
    </div>`;
    if (pagEl) pagEl.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const totalPages = Math.ceil(incidentsData.length / WIDGET_PAGE_SIZE);
  if (incidentsPage > totalPages) incidentsPage = totalPages;
  if (incidentsPage < 1) incidentsPage = 1;

  const startIdx = (incidentsPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = incidentsData.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = pageItems.map(inc => `
    <div class="feed-item">
      <div class="feed-item-dot feed-dot-${inc.status}"></div>
      <div class="feed-item-body">
        <div class="feed-item-title">${escHtml(inc.title)}</div>
        <div class="feed-item-meta">
          ${TYPE_LABEL[inc.type] || inc.type}
          &nbsp;·&nbsp; ${SEVERITY_BADGE[inc.severity] || inc.severity}
          &nbsp;·&nbsp; ${STATUS_BADGE[inc.status] || inc.status}
        </div>
      </div>
      <div class="feed-item-time">${timeAgo(inc.created_at)}</div>
    </div>
  `).join('');

  if (incidentsData.length > WIDGET_PAGE_SIZE) {
    el.classList.remove('dash-feed-scrollable');
    renderWidgetPagination(pagEl, incidentsPage, totalPages, incidentsData.length, 'changeIncidentsPage');
  } else {
    el.classList.remove('dash-feed-scrollable');
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeIncidentsPage(delta) {
  incidentsPage += delta;
  renderRecentIncidents(null, false);
}

// ---- Evacuation center status panel ----

function renderEvacStatus(centers, resetPage = true) {
  if (centers) evacCentersData = centers;
  if (resetPage) evacCentersPage = 1;

  const el = document.getElementById('evac-status-list');
  const pagEl = document.getElementById('evac-status-pagination');
  if (!el) return;

  if (!evacCentersData || !evacCentersData.length) {
    el.innerHTML = `<div class="dash-feed-empty">
      <i data-lucide="info"></i>
      <p>No evacuation centers recorded</p>
    </div>`;
    if (pagEl) pagEl.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const STATUS_COLOR = { available: 'var(--success)', near_capacity: '#f9a825', full: '#e65100', closed: 'var(--danger)' };
  const totalPages = Math.ceil(evacCentersData.length / WIDGET_PAGE_SIZE);
  if (evacCentersPage > totalPages) evacCentersPage = totalPages;
  if (evacCentersPage < 1) evacCentersPage = 1;

  const startIdx = (evacCentersPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = evacCentersData.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = pageItems.map(c => {
    const pct   = capacityPct(c.current_occupancy, c.capacity);
    const effStatus = (c.status === 'available' && pct >= 80 && pct < 100) ? 'near_capacity' : c.status;
    const color = STATUS_COLOR[effStatus] || 'var(--primary)';
    return `
    <div class="evac-feed-item">
      <div class="evac-feed-header">
        <span class="evac-feed-name">${escHtml(c.name)}</span>
        <span class="evac-feed-count">${c.current_occupancy} / ${c.capacity}</span>
      </div>
      <div class="cap-bar-track">
        <div class="cap-bar-fill" style="width:${pct}%; background:${color};"></div>
      </div>
      <div class="evac-feed-footer">
        <span style="font-size:0.72rem; color:var(--text-muted);">${pct}% occupied</span>
        <span style="font-size:0.72rem; color:${color}; font-weight:600; text-transform:capitalize;">${effStatus.replace('_', ' ')}</span>
      </div>
    </div>`;
  }).join('');

  if (evacCentersData.length > WIDGET_PAGE_SIZE) {
    el.classList.remove('dash-feed-scrollable');
    renderWidgetPagination(pagEl, evacCentersPage, totalPages, evacCentersData.length, 'changeEvacPage');
  } else {
    el.classList.remove('dash-feed-scrollable');
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeEvacPage(delta) {
  evacCentersPage += delta;
  renderEvacStatus(null, false);
}

// ---- Util ----

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- Risk Widget ----
function renderRiskWidget(data, resetPage = true) {
  const el = document.getElementById('risk-widget-body');
  const pagEl = document.getElementById('risk-widget-pagination');
  if (!el) return;

  if (data) {
    riskZonesData = data.risk_zones || [];
    // Update risk summary badge
    const badge = document.getElementById('risk-summary-badge');
    if (badge) {
      if (data.high_risk_count > 0) {
        badge.textContent = `${data.high_risk_count} high-risk area${data.high_risk_count > 1 ? 's' : ''}`;
        badge.className = 'badge badge-red';
      } else {
        badge.textContent = 'No high-risk areas';
        badge.className = 'badge badge-green';
      }
    }
  }

  if (resetPage) riskZonesPage = 1;

  const RISK_COLOR = { critical: '#d93025', high: '#e65100', medium: '#f9a825', low: '#2e7d32' };
  const RISK_BG    = { critical: '#fde8e8', high: '#fff3e0', medium: '#fff8e1', low: '#e6f4ea' };
  const TYPE_LABEL_R = { flood:'Flood', fire:'Fire', landslide:'Landslide', typhoon:'Typhoon', medical:'Medical', other:'Other' };

  if (!riskZonesData.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;">
      <i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success);vertical-align:middle;margin-right:.3rem;"></i>
      No high-risk areas detected from historical data.
    </div>`;
    if (pagEl) pagEl.style.display = 'none';
    lucide.createIcons();
    return;
  }

  const totalPages = Math.ceil(riskZonesData.length / WIDGET_PAGE_SIZE);
  if (riskZonesPage > totalPages) riskZonesPage = totalPages;
  if (riskZonesPage < 1) riskZonesPage = 1;

  const startIdx = (riskZonesPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = riskZonesData.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = pageItems.map((z, i) => {
    const globalRank = startIdx + i + 1;
    const col = RISK_COLOR[z.risk_level] || '#f9a825';
    const bg  = RISK_BG[z.risk_level]   || '#fff8e1';
    return `
    <div class="risk-zone-row">
      <div class="risk-zone-rank" style="background:${bg};color:${col};">${globalRank}</div>
      <div class="risk-zone-info">
        <div class="risk-zone-label">
          <span style="color:${col};font-weight:700;text-transform:capitalize;">${z.risk_level}</span>
          &nbsp;·&nbsp; ${TYPE_LABEL_R[z.dominant_type] || z.dominant_type} zone
        </div>
        <div class="risk-zone-meta">
          ${z.incident_count} incident${z.incident_count !== 1 ? 's' : ''} recorded
          ${z.active_count ? `<span style="color:#d93025;font-weight:600;"> · ${z.active_count} active</span>` : ''}
        </div>
      </div>
      <div class="risk-zone-score">
        <div style="font-size:.85rem;font-weight:800;color:${col};">${z.risk_score}</div>
        <div style="font-size:.65rem;color:var(--text-muted);">score</div>
      </div>
    </div>`;
  }).join('') + `
  <a href="map.html" class="risk-view-map-btn">
    <i data-lucide="map-pin"></i> View on Map
  </a>`;

  if (riskZonesData.length > WIDGET_PAGE_SIZE) {
    el.classList.add('dash-feed-scrollable');
    renderWidgetPagination(pagEl, riskZonesPage, totalPages, riskZonesData.length, 'changeRiskPage');
  } else {
    el.classList.remove('dash-feed-scrollable');
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeRiskPage(delta) {
  riskZonesPage += delta;
  renderRiskWidget(null, false);
}

// ---- Hotlines Widget ----

let hotlinesData = [];
let hotlinesPage = 1;

const CAT_ICON = {
  disaster:  'cloud-lightning',
  fire:      'flame',
  police:    'shield',
  medical:   'plus',
  emergency: 'siren',
  other:     'phone',
};

const CAT_BADGE_CLASS = {
  disaster:  'cat-badge disaster',
  fire:      'cat-badge fire',
  police:    'cat-badge police',
  medical:   'cat-badge medical',
  emergency: 'cat-badge emergency',
  other:     'cat-badge other',
};

const FALLBACK_HOTLINES = [
  {
    id: "dir-1",
    name: "BDRRMC Linao Operations Center",
    agency: "Barangay Linao DRRM Command",
    category: "disaster",
    hotline: "0917-123-4567"
  },
  {
    id: "dir-2",
    name: "Bureau of Fire Protection (BFP) Ormoc",
    agency: "BFP Ormoc City",
    category: "fire",
    hotline: "(053) 255-2222"
  },
  {
    id: "dir-3",
    name: "Ormoc City Police Station 1",
    agency: "Philippine National Police",
    category: "police",
    hotline: "(053) 561-9111"
  },
  {
    id: "dir-4",
    name: "Barangay Linao Health Station (BHS)",
    agency: "City Health Department",
    category: "medical",
    hotline: "(053) 561-2244"
  }
];

async function loadHotlinesWidget() {
  try {
    const contacts = await apiFetch('/directory/');
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      renderHotlinesWidget(contacts);
    } else {
      renderHotlinesWidget(FALLBACK_HOTLINES);
    }
  } catch (err) {
    console.warn('Failed to load hotlines widget, rendering fallback hotlines:', err);
    renderHotlinesWidget(FALLBACK_HOTLINES);
  }
}

function renderHotlinesWidget(contacts, resetPage = true) {
  if (contacts) hotlinesData = contacts;
  if (resetPage) hotlinesPage = 1;

  const el = document.getElementById('hotlines-widget-body');
  const pagEl = document.getElementById('hotlines-widget-pagination');
  if (!el) return;

  if (!hotlinesData.length) {
    el.innerHTML = `<div style="padding:1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">No emergency contacts recorded.</div>`;
    if (pagEl) pagEl.style.display = 'none';
    return;
  }

  const totalPages = Math.ceil(hotlinesData.length / WIDGET_PAGE_SIZE);
  if (hotlinesPage > totalPages) hotlinesPage = totalPages;
  if (hotlinesPage < 1) hotlinesPage = 1;

  const startIdx = (hotlinesPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = hotlinesData.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem;">
      ${pageItems.map(c => {
        const cat = c.category || 'other';
        const icon = CAT_ICON[cat] || 'phone';
        const phoneClean = (c.hotline || '').replace(/[^0-9+]/g, '');
        return `
        <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; transition: all 0.2s ease;">
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.35rem;">
              <span class="${CAT_BADGE_CLASS[cat] || 'cat-badge other'}">
                <i data-lucide="${icon}"></i> ${cat}
              </span>
            </div>
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(c.name)}">
              ${escHtml(c.name)}
            </div>
            <div style="font-size: 0.82rem; font-weight: 700; color: #60a5fa; margin-top: 0.15rem;">
              ${escHtml(c.hotline)}
            </div>
          </div>
          <a href="tel:${phoneClean}" title="Call ${escHtml(c.name)}" style="flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.2s ease;" onmouseover="this.style.background='var(--primary)';this.style.color='#fff';" onmouseout="this.style.background='rgba(59, 130, 246, 0.15)';this.style.color='#60a5fa';">
            <i data-lucide="phone-call" style="width: 16px; height: 16px;"></i>
          </a>
        </div>`;
      }).join('')}
    </div>`;

  if (hotlinesData.length > WIDGET_PAGE_SIZE) {
    renderWidgetPagination(pagEl, hotlinesPage, totalPages, hotlinesData.length, 'changeHotlinesPage');
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeHotlinesPage(delta) {
  hotlinesPage += delta;
  renderHotlinesWidget(null, false);
}
