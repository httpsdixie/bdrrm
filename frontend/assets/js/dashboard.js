// ===== Dashboard Module =====

const SEVERITY_BADGE = {
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
  const ids = ['stat-active-incidents', 'stat-evac-centers', 'stat-resources'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const subs = ['stat-incidents-total-sub', 'stat-evac-sub', 'stat-resources-sub'];
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

// ===== Chart State =====
let trendsChartInstance = null;
let distributionChartInstance = null;
let currentAnalyticsData = null;
let activeTrendsPeriod = '6m';

const AUTO_SYNC_INTERVAL_SECONDS = 300;

// ---- Main load ----

async function loadDashboard(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showDashboardSkeletons();

  try {
    // All requests in parallel
    const [stats, recentIncidents, evacStatus, analyticsData] = await Promise.all([
      API.get('/dashboard/stats'),
      API.get('/dashboard/recent-incidents'),
      API.get('/dashboard/evac-status'),
      API.get('/dashboard/analytics').catch(() => null),
    ]);

    renderStats(stats);
    renderRecentIncidents(recentIncidents);
    renderEvacStatus(evacStatus);
    renderAnalyticsCharts(analyticsData);
    loadHotlinesWidget();

    document.getElementById('last-updated').textContent =
      new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  } catch (err) {
    console.error('Dashboard load failed:', err.message);
    renderStats(null);
    renderRecentIncidents([]);
    renderEvacStatus([]);
    renderAnalyticsCharts(null);
    loadHotlinesWidget();
  } finally {
    const timeEl = document.getElementById('last-updated');
    if (timeEl) {
      timeEl.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    }
    if (btn) btn.classList.remove('spinning');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// ---- Chart Rendering Logic ----

function renderAnalyticsCharts(data) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js library is not loaded');
    return;
  }
  currentAnalyticsData = data || null;
  initTrendsChart(activeTrendsPeriod);
  initResourceStatusChart();
}

function initTrendsChart(periodKey = '6m') {
  const canvas = document.getElementById('incidentTrendsChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (trendsChartInstance) {
    trendsChartInstance.destroy();
  }

  const data = currentAnalyticsData;
  const periodData = (data && data.periods && data.periods[periodKey])
    ? data.periods[periodKey]
    : { labels: [], incidents: [], resolved: [] };

  // Create smooth gradients
  const gradBlue = ctx.createLinearGradient(0, 0, 0, 260);
  gradBlue.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
  gradBlue.addColorStop(1, 'rgba(59, 130, 246, 0.01)');

  const gradGreen = ctx.createLinearGradient(0, 0, 0, 260);
  gradGreen.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
  gradGreen.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

  trendsChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: periodData.labels,
      datasets: [
        {
          label: 'Total Incidents',
          data: periodData.incidents,
          borderColor: '#3b82f6',
          backgroundColor: gradBlue,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#60a5fa',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#3b82f6',
          pointHoverBorderWidth: 3,
        },
        {
          label: 'Resolved Incidents',
          data: periodData.resolved,
          borderColor: '#10b981',
          backgroundColor: gradGreen,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#34d399',
          pointBorderColor: '#0f172a',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#10b981',
          pointHoverBorderWidth: 3,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            padding: 12
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#ffffff',
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
          bodyColor: '#cbd5e1',
          bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
          borderColor: 'rgba(59, 130, 246, 0.3)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 5,
          usePointStyle: true
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' }
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 11 }
          },
          title: {
            display: true,
            text: 'Incidents',
            color: '#64748b',
            font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' }
          }
        }
      }
    }
  });
}

function initResourceStatusChart() {
  const canvas = document.getElementById('resourceStatusChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (distributionChartInstance) {
    distributionChartInstance.destroy();
  }

  // Fetch live resource status counts
  API.get('/resources/').then(resources => {
    const counts = { available: 0, maintenance: 0, damaged: 0, borrowed: 0, other: 0 };
    (resources || []).forEach(r => {
      const s = (r.status || '').toLowerCase();
      if (s === 'available')   counts.available++;
      else if (s === 'maintenance') counts.maintenance++;
      else if (s === 'damaged')     counts.damaged++;
      else if (s === 'borrowed')    counts.borrowed++;
      else                          counts.other++;
    });

    const total = (resources || []).length;
    const labels = ['Available', 'Maintenance', 'Damaged', 'Borrowed', 'Other'];
    const values = [counts.available, counts.maintenance, counts.damaged, counts.borrowed, counts.other];
    const bgColors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: '#1e293b',
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
              boxWidth: 10, boxHeight: 10,
              usePointStyle: true,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#ffffff',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
            bodyColor: '#cbd5e1',
            bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function(context) {
                const pct = total ? Math.round((context.parsed / total) * 100) : 0;
                return ` ${context.label}: ${context.parsed} (${pct}%)`;
              },
              afterBody: function() {
                return [`Total Assets: ${total}`];
              }
            }
          }
        }
      }
    });
  }).catch(() => {
    // fallback — empty chart
    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#334155'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
    });
  });
}

function updateTrendsChartPeriod(periodKey) {
  activeTrendsPeriod = periodKey;
  ['6m', '30d', '7d'].forEach(p => {
    const btn = document.getElementById(`btn-period-${p}`);
    if (btn) {
      if (p === periodKey) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });
  initTrendsChart(periodKey);
}


function refreshDashboard() {
  loadDashboard();
}

// ---- Stat cards ----

function renderStats(stats) {
  if (!stats) {
    // No connection — show dashes
    ['stat-active-incidents', 'stat-evac-centers', 'stat-resources'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    const subIds = ['stat-incidents-total-sub', 'stat-evac-sub', 'stat-resources-sub'];
    subIds.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Incidents
  document.getElementById('stat-active-incidents').textContent = stats.incidents.active_total;
  const totalSubEl = document.getElementById('stat-incidents-total-sub');
  if (totalSubEl) {
    totalSubEl.innerHTML = `<span class="badge badge-red" style="font-weight:700;font-size:0.75rem;">${stats.incidents.total} Total Recorded</span>`;
  }

  // Evacuation centers
  document.getElementById('stat-evac-centers').textContent = stats.evacuation.total_centers;
  document.getElementById('stat-evac-sub').innerHTML =
    `<span class="badge badge-blue" style="font-weight:700;font-size:0.75rem;">${stats.evacuation.facilities_evaluated} Evaluated</span> <span class="badge badge-orange" style="font-weight:700;font-size:0.75rem;margin-left:0.25rem;">${stats.evacuation.staffed_centers} Staffed</span>`;

  // Resources
  document.getElementById('stat-resources').textContent = stats.resources.total_items;
  document.getElementById('stat-resources-sub').innerHTML =
    `<span class="badge badge-orange" style="font-weight:700;font-size:0.75rem;">${stats.resources.available} Standby / Ready</span>`;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Widget Pagination State
let incidentsData = [];
let incidentsPage = 1;

let evacCentersData = [];
let evacCentersPage = 1;

const WIDGET_PAGE_SIZE = 3;
const HOTLINES_PAGE_SIZE = 4;

function renderWidgetPagination(pagEl, page, totalPages, totalItems, callbackName, pageSize) {
  if (!pagEl) return;
  const ps = pageSize || WIDGET_PAGE_SIZE;

  pagEl.style.display = 'flex';
  const startItem = (page - 1) * ps + 1;
  const endItem = Math.min(page * ps, totalItems);

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

// Live Telemetry Auto-Sync Timer
let autoSyncSeconds = AUTO_SYNC_INTERVAL_SECONDS;
let autoSyncTimerId = null;

function startAutoSyncTimer() {
  if (autoSyncTimerId) clearInterval(autoSyncTimerId);
  autoSyncSeconds = AUTO_SYNC_INTERVAL_SECONDS;

  const syncDisplay = document.getElementById('sync-countdown');
  if (syncDisplay) {
    syncDisplay.textContent = formatCountdown(autoSyncSeconds);
  }

  autoSyncTimerId = setInterval(() => {
    autoSyncSeconds--;
    if (syncDisplay) syncDisplay.textContent = formatCountdown(autoSyncSeconds);

    if (autoSyncSeconds <= 0) {
      autoSyncSeconds = AUTO_SYNC_INTERVAL_SECONDS;
      if (syncDisplay) syncDisplay.textContent = formatCountdown(autoSyncSeconds);
      loadDashboard();
    }
  }, 1000);
}

function formatCountdown(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

// Start auto sync on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoSyncTimer);
} else {
  startAutoSyncTimer();
}

let currentIncidentFilter = 'all';

function filterIncidents(filter, btn) {
  currentIncidentFilter = filter;
  const group = btn ? btn.parentElement : null;
  if (group) {
    group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }
  renderRecentIncidents(null, true);
}

// ---- Recent Incidents feed ----

function renderRecentIncidents(incidents, resetPage = true) {
  if (incidents) incidentsData = incidents;
  if (resetPage) incidentsPage = 1;

  const el = document.getElementById('recent-incidents-list');
  const pagEl = document.getElementById('recent-incidents-pagination');
  if (!el) return;

  let filtered = incidentsData;
  if (currentIncidentFilter !== 'all') {
    if (currentIncidentFilter === 'active') {
      filtered = incidentsData.filter(inc => ['ongoing', 'active', 'responding'].includes((inc.status || '').toLowerCase()));
    } else {
      filtered = incidentsData.filter(inc => (inc.status || '').toLowerCase() === currentIncidentFilter);
    }
  }

  if (!filtered || !filtered.length) {
    const filterText = currentIncidentFilter === 'all' ? 'active' : currentIncidentFilter;
    const formattedText = filterText.charAt(0).toUpperCase() + filterText.slice(1);
    el.innerHTML = `
      <div class="dash-feed-empty">
        <div class="dash-feed-empty-icon success">
          <i data-lucide="shield-check"></i>
        </div>
        <div class="dash-feed-empty-text">
          <p class="dash-feed-empty-title">No ${formattedText} Incidents</p>
          <span class="dash-feed-empty-sub">All monitored sitios in Barangay Linao are reporting clear operational status.</span>
        </div>
      </div>`;
    if (pagEl) pagEl.style.display = 'none';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const totalPages = Math.ceil(filtered.length / WIDGET_PAGE_SIZE);
  if (incidentsPage > totalPages) incidentsPage = totalPages;
  if (incidentsPage < 1) incidentsPage = 1;

  const startIdx = (incidentsPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = pageItems.map((inc, i) => {
    const dataIdx = startIdx + i;
    return `
    <div class="feed-item" onclick="openIncidentDetailModal(${dataIdx})" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.85rem 1.15rem;" title="Click to view full incident details">
      <div style="display:flex; align-items:center; gap:0.75rem; min-width:0;">
        <div class="feed-item-dot feed-dot-${inc.status}"></div>
        <div style="min-width:0;">
          <div class="feed-item-title" style="font-size:0.91rem; font-weight:700; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(inc.title)}</div>
          <div class="feed-item-meta" style="font-size:0.78rem; color:#94a3b8; margin-top:0.18rem; display:flex; align-items:center; gap:0.4rem;">
            <span style="color:#cbd5e1; font-weight:600;">${TYPE_LABEL[inc.type] || inc.type}</span>
            <span style="color:#64748b;">·</span>
            <span style="color:#94a3b8;">${timeAgo(inc.created_at)}</span>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
        ${STATUS_BADGE[inc.status] || inc.status}
      </div>
    </div>`;
  }).join('');

  if (filtered.length > WIDGET_PAGE_SIZE) {
    el.classList.remove('dash-feed-scrollable');
    renderWidgetPagination(pagEl, incidentsPage, totalPages, filtered.length, 'changeIncidentsPage');
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
    el.innerHTML = `
      <div class="dash-feed-empty">
        <div class="dash-feed-empty-icon info">
          <i data-lucide="house-plug"></i>
        </div>
        <div class="dash-feed-empty-text">
          <p class="dash-feed-empty-title">No Evacuation Facilities Recorded</p>
          <span class="dash-feed-empty-sub">Registered evacuation facilities will appear here once added.</span>
        </div>
      </div>`;
    if (pagEl) pagEl.style.display = 'none';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const STATUS_BADGES_MAP = {
    available: '<span class="badge badge-green">Available</span>',
    closed:    '<span class="badge badge-blue">Closed</span>',
    active:    '<span class="badge badge-orange">Active</span>',
  };

  const totalPages = Math.ceil(evacCentersData.length / WIDGET_PAGE_SIZE);
  if (evacCentersPage > totalPages) evacCentersPage = totalPages;
  if (evacCentersPage < 1) evacCentersPage = 1;

  const startIdx = (evacCentersPage - 1) * WIDGET_PAGE_SIZE;
  const pageItems = evacCentersData.slice(startIdx, startIdx + WIDGET_PAGE_SIZE);

  el.innerHTML = pageItems.map((c, i) => {
    const cap = c.capacity || 0;
    const statusKey = (c.status || 'available').toLowerCase();
    const badgeHtml = STATUS_BADGES_MAP[statusKey] || `<span class="badge badge-green">${escHtml(c.status || 'Available')}</span>`;
    const evacKey = c.id !== undefined ? JSON.stringify(c.id) : startIdx + i;

    const typeLabel = c.type ? escHtml(c.type) : null;

    return `
    <div class="evac-feed-item" onclick="openEvacDetailModal(${evacKey})" style="cursor:pointer; padding:1rem 1.15rem;" title="Click to view shelter status">
      <div class="evac-feed-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="evac-feed-name" style="font-size:0.92rem; font-weight:700; color:#ffffff;">${escHtml(c.name)}</div>
          ${typeLabel ? `<div style="font-size:0.75rem; color:#64748b; font-weight:500; margin-top:0.15rem;">${typeLabel}</div>` : ''}
        </div>
        <span style="font-size:0.8rem; color:#94a3b8; font-weight:500; flex-shrink:0;">Capacity: <span style="color:#60a5fa; font-weight:700;">${cap}</span></span>
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

const DASH_DEFAULT_HOTLINES = [
  { id: 'h-1', name: 'Barangay Linao BDRRMC Command', agency: 'BDRRMC', category: 'command', hotline: '(053) 561-2345 / 0917-123-4567' },
  { id: 'h-2', name: 'CDRRMO Ormoc Emergency Operations', agency: 'CDRRMO', category: 'command', hotline: '(053) 561-8888 / 911' },
  { id: 'h-3', name: 'Ormoc City Fire Station (BFP)', agency: 'BFP', category: 'fire', hotline: '(053) 561-2222 / 0928-555-1199' },
  { id: 'h-4', name: 'Ormoc City PNP Central Station', agency: 'PNP', category: 'fire', hotline: '(053) 561-3333 / 0998-598-8123' },
  { id: 'h-5', name: 'Barangay Linao Health Center', agency: 'City Health', category: 'medical', hotline: '0917-888-4321' },
  { id: 'h-6', name: 'Ormoc District Hospital (OMVH)', agency: 'OMVH', category: 'medical', hotline: '(053) 561-4444' }
];

async function loadHotlinesWidget() {
  try {
    const contacts = await apiFetch('/directory/');
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      renderHotlinesWidget(contacts);
    } else {
      renderHotlinesWidget(DASH_DEFAULT_HOTLINES);
    }
  } catch (err) {
    console.warn('Failed to load hotlines widget:', err);
    renderHotlinesWidget(DASH_DEFAULT_HOTLINES);
  }
}

function renderHotlinesWidget(contacts, resetPage = true) {
  if (contacts) hotlinesData = contacts;
  if (resetPage) hotlinesPage = 1;

  const el = document.getElementById('hotlines-widget-body');
  const pagEl = document.getElementById('hotlines-widget-pagination');
  if (!el) return;

  if (!hotlinesData.length) {
    el.innerHTML = `
      <div class="dash-feed-empty sm" style="margin: 0;">
        <div class="dash-feed-empty-icon info sm">
          <i data-lucide="phone"></i>
        </div>
        <div class="dash-feed-empty-text">
          <p class="dash-feed-empty-title" style="font-size:0.88rem;">No Emergency Contacts Recorded</p>
          <span class="dash-feed-empty-sub">Hotlines and emergency agency numbers will appear here once added.</span>
        </div>
      </div>`;
    if (pagEl) pagEl.style.display = 'none';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  const totalPages = Math.ceil(hotlinesData.length / HOTLINES_PAGE_SIZE);
  if (hotlinesPage > totalPages) hotlinesPage = totalPages;
  if (hotlinesPage < 1) hotlinesPage = 1;

  const startIdx = (hotlinesPage - 1) * HOTLINES_PAGE_SIZE;
  const pageItems = hotlinesData.slice(startIdx, startIdx + HOTLINES_PAGE_SIZE);

  el.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.85rem;">
      ${pageItems.map(c => {
        const cat = c.category || 'other';
        const icon = CAT_ICON[cat] || 'phone';
        const phoneClean = (c.hotline || '').replace(/[^0-9+]/g, '');
        const safeId = (c.id || '').replace(/'/g, "\\'");
        return `
        <div onclick="viewHotlineModal('${safeId}')" style="cursor: pointer; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; transition: all 0.2s ease;" onmouseover="this.style.borderColor='rgba(59,130,246,0.5)';" onmouseout="this.style.borderColor='var(--border-color)';">
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
          <a href="tel:${phoneClean}" onclick="event.stopPropagation();" title="Call ${escHtml(c.name)}" style="flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.2s ease;" onmouseover="this.style.background='var(--primary)';this.style.color='#fff';" onmouseout="this.style.background='rgba(59, 130, 246, 0.15)';this.style.color='#60a5fa';">
            <i data-lucide="phone-call" style="width: 16px; height: 16px;"></i>
          </a>
        </div>`;
      }).join('')}
    </div>`;

  if (hotlinesData.length > HOTLINES_PAGE_SIZE) {
    renderWidgetPagination(pagEl, hotlinesPage, totalPages, hotlinesData.length, 'changeHotlinesPage', HOTLINES_PAGE_SIZE);
  } else {
    if (pagEl) pagEl.style.display = 'none';
  }

  lucide.createIcons();
}

function changeHotlinesPage(delta) {
  hotlinesPage += delta;
  renderHotlinesWidget(null, false);
}

// ==========================================================================
// Interactive Item Detail Modals Handlers
// ==========================================================================

function openIncidentDetailModal(idx) {
  const inc = incidentsData[idx];
  if (!inc) return;

  const modal = document.getElementById('incident-detail-modal');
  const content = document.getElementById('inc-modal-content');
  if (!modal || !content) return;

  const typeName = TYPE_LABEL[inc.type] || inc.type || 'General Incident';
  const statusHtml = STATUS_BADGE[inc.status] || inc.status || '<span class="badge badge-orange">Ongoing</span>';

  content.innerHTML = `
    <div style="margin-bottom: 1.2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.6rem;">
        <h4 style="font-size:1.15rem; font-weight:800; color:#ffffff; margin:0; line-height:1.3;">${escHtml(inc.title || 'Emergency Incident')}</h4>
        <span style="font-size:0.75rem; color:#94a3b8; white-space:nowrap; margin-top:0.2rem;">${timeAgo(inc.created_at)}</span>
      </div>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
        ${statusHtml}
      </div>
    </div>
    
    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:1.1rem; margin-bottom:1.2rem;">
      <div style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.4rem;">Incident Summary &amp; Description</div>
      <div style="color:#e2e8f0; line-height:1.5;">${escHtml(inc.description || 'No additional notes provided for this incident record.')}</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; background:rgba(255,255,255,0.02); border-radius:12px; padding:1rem; border:1px solid rgba(255,255,255,0.05);">
      <div>
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; text-transform:uppercase;">Location / Purok</div>
        <div style="font-weight:700; color:#ffffff; margin-top:0.15rem; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="map-pin" style="width:14px; height:14px; color:#60a5fa;"></i>
          ${escHtml(inc.location || 'Purok 3, Barangay Linao')}
        </div>
      </div>
      <div>
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; text-transform:uppercase;">Reported By</div>
        <div style="font-weight:700; color:#ffffff; margin-top:0.15rem; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="user" style="width:14px; height:14px; color:#4ade80;"></i>
          ${escHtml(inc.reporter_name || 'Resident / BDRRM Command')}
        </div>
      </div>
    </div>
  `;
  modal.classList.add('active', 'open');
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeIncidentDetailModal() {
  const modal = document.getElementById('incident-detail-modal');
  if (modal) {
    modal.classList.remove('active', 'open');
    modal.style.display = 'none';
  }
}

function openEvacDetailModal(id) {
  let c = evacCentersData.find(item => item.id == id || item.id === id);
  if (!c && typeof id === 'number') c = evacCentersData[id];
  if (!c) return;

  const modal = document.getElementById('evac-detail-modal');
  const content = document.getElementById('evac-modal-content');
  if (!modal || !content) return;

  const statusKey = (c.status || 'available').toLowerCase();
  const STATUS_LABEL = { available: 'Available', closed: 'Closed', active: 'Active', full: 'Full' };
  const STATUS_COLOR = { available: '#34d399', closed: '#60a5fa', active: '#fbbf24', full: '#f87171' };
  const statusLabel = STATUS_LABEL[statusKey] || c.status || 'Available';
  const statusColor = STATUS_COLOR[statusKey] || '#34d399';

  content.innerHTML = `
    <div style="margin-bottom:1.2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:0.5rem;">
        <h4 style="font-size:1.1rem; font-weight:800; color:#ffffff; margin:0; line-height:1.3;">${escHtml(c.name || 'Evacuation Center')}</h4>
        <span style="font-size:0.75rem; font-weight:800; color:${statusColor}; text-transform:uppercase; letter-spacing:0.04em; white-space:nowrap; margin-top:0.2rem;">${statusLabel}</span>
      </div>
      ${c.type ? `<div style="font-size:0.8rem; color:#64748b; font-weight:500; display:flex; align-items:center; gap:0.35rem;"><i data-lucide="building-2" style="width:13px;height:13px;color:#475569;"></i> ${escHtml(c.type)}</div>` : ''}
    </div>

    <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:1rem; margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <i data-lucide="users" style="width:16px;height:16px;color:#60a5fa;"></i>
        <span style="font-size:0.8rem; color:#94a3b8; font-weight:600;">Capacity</span>
      </div>
      <span style="font-size:1.1rem; font-weight:900; color:#60a5fa;">${c.capacity || 0} <span style="font-size:0.75rem; color:#94a3b8; font-weight:500;">persons</span></span>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; background:rgba(255,255,255,0.02); border-radius:12px; padding:1rem; border:1px solid rgba(255,255,255,0.05);">
      <div>
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:0.25rem;">Location / Address</div>
        <div style="font-weight:600; color:#e2e8f0; font-size:0.85rem; display:flex; align-items:flex-start; gap:0.35rem;">
          <i data-lucide="map-pin" style="width:13px;height:13px;color:#60a5fa;margin-top:2px;flex-shrink:0;"></i>
          ${escHtml(c.address || 'Barangay Linao, Ormoc City')}
        </div>
      </div>
      <div>
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; text-transform:uppercase; margin-bottom:0.25rem;">Contact Person</div>
        <div style="font-weight:700; color:#ffffff; font-size:0.85rem; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="user" style="width:13px;height:13px;color:#4ade80;flex-shrink:0;"></i>
          ${escHtml(c.contact_person || '—')}
        </div>
        ${c.contact_number ? `<div style="font-size:0.78rem; color:#60a5fa; font-weight:600; margin-top:0.2rem;">${escHtml(c.contact_number)}</div>` : ''}
      </div>
    </div>
  `;

  modal.classList.add('active', 'open');
  modal.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeEvacDetailModal() {
  const modal = document.getElementById('evac-detail-modal');
  if (modal) {
    modal.classList.remove('active', 'open');
    modal.style.display = 'none';
  }
}


// =============================================
// ADD EMERGENCY HOTLINE MODAL & HANDLERS
// =============================================
function openAddHotlineModal() {
  const overlay = document.getElementById('add-hotline-modal-overlay');
  if (overlay) {
    overlay.classList.add('active', 'open');
    overlay.style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
      const nameInput = document.getElementById('hotline-add-name');
      if (nameInput) nameInput.focus();
    }, 100);
  }
}

function closeAddHotlineModal() {
  const overlay = document.getElementById('add-hotline-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active', 'open');
    overlay.style.display = 'none';
  }
}

async function submitAddHotline(e) {
  e.preventDefault();
  const name = document.getElementById('hotline-add-name').value.trim();
  const category = document.getElementById('hotline-add-category').value;
  const hotline = document.getElementById('hotline-add-number').value.trim();
  const secondary = document.getElementById('hotline-add-secondary').value.trim() || null;
  const address = document.getElementById('hotline-add-address').value.trim() || null;

  if (!name || !hotline) {
    if (typeof showToast === 'function') showToast('Please enter both name and hotline number.', 'warning');
    return;
  }

  const btn = document.getElementById('hotline-add-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Saving...';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  const newContact = {
    id: 'h-' + Date.now(),
    name: name,
    agency: name,
    category: category,
    hotline: hotline,
    secondary_number: secondary,
    address: address,
    available_24h: true
  };

  try {
    const res = await apiFetch('/directory/', {
      method: 'POST',
      body: JSON.stringify({
        name: name,
        agency: name,
        category: category,
        hotline: hotline,
        secondary_number: secondary,
        address: address,
        available_24h: true
      })
    });
    if (res && res.id) {
      newContact.id = res.id;
    }
  } catch (err) {
    console.warn('Backend directory save fallback to client state:', err);
  }

  // Prepend to hotlinesData so user immediately sees it in the dashboard grid
  if (typeof hotlinesData !== 'undefined' && Array.isArray(hotlinesData)) {
    hotlinesData.unshift(newContact);
  } else {
    hotlinesData = [newContact];
  }
  renderHotlinesWidget(hotlinesData, true);

  if (typeof showToast === 'function') {
    showToast(`Emergency hotline for "${name}" registered successfully!`, 'success', 'Hotline Added');
  }

  closeAddHotlineModal();

  // Reset form inputs
  document.getElementById('hotline-add-name').value = '';
  document.getElementById('hotline-add-number').value = '';
  document.getElementById('hotline-add-secondary').value = '';
  document.getElementById('hotline-add-address').value = '';

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check"></i> Save Hotline';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function autofillAddHotline() {
  const nameEl = document.getElementById('hotline-add-name');
  const catEl = document.getElementById('hotline-add-category');
  const numEl = document.getElementById('hotline-add-number');
  const secEl = document.getElementById('hotline-add-secondary');
  const addrEl = document.getElementById('hotline-add-address');

  if (nameEl) nameEl.value = 'Linao ERU Rescue Team Alpha';
  if (catEl) catEl.value = 'command';
  if (numEl) numEl.value = '(053) 561-9911 / 0917-555-8822';
  if (secEl) secEl.value = '0998-111-2233';
  if (addrEl) addrEl.value = 'Sitio 3 Riverside, Barangay Linao, Ormoc City';

  if (typeof showToast === 'function') {
    showToast('Autofilled sample emergency hotline details!', 'info', 'Demo Helper');
  }
}

function viewHotlineModal(id) {
  const contact = (hotlinesData || []).find(c => String(c.id) === String(id));
  if (!contact) return;

  const overlay = document.getElementById('view-hotline-modal-overlay');
  const titleEl = document.getElementById('view-hotline-title');
  const subEl = document.getElementById('view-hotline-sub');
  const bodyEl = document.getElementById('view-hotline-body');
  const callBtn = document.getElementById('view-hotline-call-btn');

  if (!overlay || !bodyEl) return;

  if (titleEl) titleEl.textContent = contact.name || 'Emergency Hotline';
  if (subEl) subEl.textContent = (contact.agency || contact.category || 'Emergency').toUpperCase() + ' • OFFICIAL DIRECTORY';

  const cat = (contact.category || 'other').toLowerCase();
  const icon = CAT_ICON[cat] || 'phone';
  const badgeClass = CAT_BADGE_CLASS[cat] || 'cat-badge other';
  const phoneClean = (contact.hotline || '').replace(/[^0-9+]/g, '');

  if (callBtn) {
    callBtn.href = `tel:${phoneClean}`;
    callBtn.setAttribute('title', `Call ${contact.name}`);
  }

  bodyEl.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); padding:0.85rem 1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.08);">
      <span class="${badgeClass}" style="font-size:0.8rem; padding:0.3rem 0.65rem;">
        <i data-lucide="${icon}"></i> ${(contact.category || 'other').toUpperCase()}
      </span>
      <span style="font-size:0.75rem; color:#4ade80; font-weight:700; display:flex; align-items:center; gap:0.3rem;">
        <i data-lucide="check-circle-2" style="width:14px; height:14px;"></i> 24/7 Operational Status
      </span>
    </div>

    <div style="background:rgba(15,23,42,0.8); border:1px solid rgba(59,130,246,0.25); border-radius:12px; padding:1.1rem;">
      <div style="font-size:0.75rem; color:#94a3b8; font-weight:700; text-transform:uppercase; margin-bottom:0.25rem;">Primary Hotline Number</div>
      <div style="font-size:1.2rem; font-weight:900; color:#60a5fa; letter-spacing:0.02em;">
        <i data-lucide="phone" style="width:18px; height:18px; display:inline; margin-right:0.3rem; vertical-align:-3px;"></i>
        ${escHtml(contact.hotline || 'N/A')}
      </div>
      ${contact.secondary_number ? `
        <div style="margin-top:0.75rem; pt-0.5rem; border-top:1px dashed rgba(255,255,255,0.1);">
          <div style="font-size:0.72rem; color:#94a3b8; font-weight:600;">Secondary / Backup Number</div>
          <div style="font-size:0.95rem; font-weight:700; color:#e2e8f0; margin-top:0.15rem;">
            ${escHtml(contact.secondary_number)}
          </div>
        </div>
      ` : ''}
    </div>

    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <div style="background:rgba(255,255,255,0.02); padding:0.85rem 1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="building" style="width:13px; height:13px; color:#60a5fa;"></i> Agency / Unit
        </div>
        <div style="font-weight:700; color:#ffffff; font-size:0.92rem; margin-top:0.2rem;">
          ${escHtml(contact.agency || contact.name)}
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.02); padding:0.85rem 1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
        <div style="font-size:0.72rem; color:#94a3b8; font-weight:600; display:flex; align-items:center; gap:0.35rem;">
          <i data-lucide="map-pin" style="width:13px; height:13px; color:#f59e0b;"></i> Station / Location Address
        </div>
        <div style="font-weight:600; color:#cbd5e1; font-size:0.88rem; margin-top:0.2rem;">
          ${escHtml(contact.address || 'Barangay Linao Operational Sector, Ormoc City')}
        </div>
      </div>
    </div>
  `;

  overlay.classList.add('active', 'open');
  overlay.style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeViewHotlineModal() {
  const overlay = document.getElementById('view-hotline-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active', 'open');
    overlay.style.display = 'none';
  }
}



