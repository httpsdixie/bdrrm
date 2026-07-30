// ===== Resource Logistics Module =====

let allResources = [];
let allDispatch  = [];
let editingResourceId = null;
let currentCategoryFilter = 'all';

// ---- Labels & Badges ----

const TYPE_LABEL = {
  rescue_boat: 'Rescue Boat',
  ambulance:   'Ambulance',
  fire_truck:  'Fire Truck',
  medical_kit: 'Medical Kit',
  food_pack:   'Food Pack',
  tent:        'Tent',
  vehicle:     'Vehicle / Patrol',
  fuel:        'Fuel',
  other:       'Other',
};

const TYPE_ICON = {
  rescue_boat: 'sailboat',
  ambulance:   'ambulance',
  fire_truck:  'truck',
  medical_kit: 'cross',
  food_pack:   'utensils',
  tent:        'tent',
  vehicle:     'truck',
  fuel:        'fuel',
  other:       'box',
};

const HAZARD_CONFIG = {
  flooding:          { key: 'flooding',          label: 'Flooding',            icon: 'cloud-rain',    cssClass: 'cat-flooding' },
  typhoon:           { key: 'typhoon',           label: 'Typhoon',             icon: 'wind',          cssClass: 'cat-typhoon' },
  fire:              { key: 'fire',              label: 'Fire Suppression',    icon: 'flame',         cssClass: 'cat-fire' },
  earthquake:        { key: 'earthquake',        label: 'Earthquake',          icon: 'activity',      cssClass: 'cat-earthquake' },
  landslide:         { key: 'landslide',         label: 'Landslide',           icon: 'mountain',      cssClass: 'cat-landslide' },
  medical:           { key: 'medical',           label: 'Medical Emergency',   icon: 'plus-circle',   cssClass: 'cat-medical' },
  power_outage:      { key: 'power_outage',      label: 'Power Outage',        icon: 'zap',           cssClass: 'cat-power' },
  search_rescue:     { key: 'search_rescue',     label: 'Search & Rescue',     icon: 'crosshair',     cssClass: 'cat-rescue' },
  general_emergency: { key: 'general_emergency', label: 'General Response',    icon: 'shield-alert', cssClass: 'cat-general' },
  disaster:          { key: 'disaster',          label: 'Flood & Typhoon',     icon: 'cloud-rain',    cssClass: 'cat-flooding' },
  emergency:         { key: 'emergency',         label: 'General Emergency',   icon: 'shield-alert', cssClass: 'cat-general' },
  other:             { key: 'other',             label: 'Other Hazard',        icon: 'tag',           cssClass: 'cat-other' },
};

const CAT_LABEL = {
  disaster:   'Flood & Typhoon',
  fire:       'Fire Suppression',
  earthquake: 'Earthquake & Landslide',
  medical:    'Medical Emergency',
  emergency:  'All-Hazard / General',
  other:      'Other Hazards',
};

const CAT_ICON = {
  disaster:   'cloud-rain',
  fire:       'flame',
  earthquake: 'activity',
  medical:    'plus-circle',
  emergency:  'shield-alert',
  other:      'tag',
};

const STATUS_BADGE = {
  available:   '<span class="badge badge-green">Available</span>',
  deployed:    '<span class="badge badge-orange">Deployed</span>',
  maintenance: '<span class="badge badge-yellow">Under Maintenance</span>',
  damaged:     '<span class="badge badge-red">Damaged</span>',
  unavailable: '<span class="badge badge-red">Unavailable</span>',
};

// Statuses that block dispatching
const OUT_OF_SERVICE_STATUSES = ['maintenance', 'damaged', 'unavailable'];

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getResourceCategory(r) {
  if (r.category) return r.category;
  if (r.type === 'rescue_boat') return 'disaster';
  if (r.type === 'medical_kit') return 'medical';
  if (r.type === 'ambulance')   return 'medical';
  if (r.type === 'fire_truck')  return 'fire';
  if (r.type === 'food_pack')   return 'emergency';
  if (r.type === 'tent')        return 'emergency';
  if (r.type === 'vehicle')     return 'emergency';
  if (r.type === 'fuel')        return 'emergency';

  const name = (r.name || '').toLowerCase();
  if (name.includes('fire') || name.includes('extinguisher') || name.includes('hose')) return 'fire';
  if (name.includes('quake') || name.includes('earthquake') || name.includes('landslide') || name.includes('chainsaw')) return 'earthquake';
  if (name.includes('medical') || name.includes('first aid') || name.includes('stretcher') || name.includes('ambulance')) return 'medical';
  if (name.includes('boat') || name.includes('flood') || name.includes('life jacket') || name.includes('rescue') || name.includes('typhoon')) return 'disaster';
  if (name.includes('siren') || name.includes('radio') || name.includes('generator') || name.includes('fuel')) return 'emergency';
  return 'other';
}

function getResourceHazards(r) {
  if (Array.isArray(r.applicable_hazards) && r.applicable_hazards.length > 0) {
    return r.applicable_hazards;
  }
  if (r.category) {
    if (r.category === 'disaster') return ['flooding', 'typhoon'];
    return [r.category];
  }
  const inferred = getResourceCategory(r);
  return inferred === 'disaster' ? ['flooding', 'typhoon'] : [inferred];
}

function renderResourceTagBadges(r) {
  const hazards = getResourceHazards(r);
  if (!hazards.length) return `<span class="cat-badge cat-other"><i data-lucide="tag"></i> General</span>`;
  
  return hazards.map(hKey => {
    const cfg = HAZARD_CONFIG[hKey] || {
      label: hKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      icon: 'tag',
      cssClass: 'cat-other'
    };
    return `<span class="cat-badge ${cfg.cssClass}" title="Applicable Hazard: ${escHtml(cfg.label)}">
      <i data-lucide="${cfg.icon}"></i> ${escHtml(cfg.label)}
    </span>`;
  }).join('');
}

let selectedModalHazards = [];

function renderHazardTagPicker() {
  const pickerEl = document.getElementById('hazard-tag-picker');
  if (!pickerEl) return;

  const presets = [
    'flooding', 'typhoon', 'fire', 'earthquake', 
    'landslide', 'medical', 'power_outage', 'search_rescue', 'general_emergency'
  ];

  pickerEl.innerHTML = presets.map(key => {
    const cfg = HAZARD_CONFIG[key];
    const isSelected = selectedModalHazards.includes(key);
    return `<button type="button" class="tag-chip ${isSelected ? 'active' : ''}" onclick="toggleHazardTag('${key}')">
      <i data-lucide="${cfg.icon}"></i>
      <span>${cfg.label}</span>
      ${isSelected ? '<i data-lucide="check" style="width:12px;height:12px;margin-left:.15rem;"></i>' : ''}
    </button>`;
  }).join('');

  renderSelectedTagsBox();
  lucide.createIcons();
}

function toggleHazardTag(key) {
  const idx = selectedModalHazards.indexOf(key);
  if (idx > -1) {
    selectedModalHazards.splice(idx, 1);
  } else {
    selectedModalHazards.push(key);
  }
  renderHazardTagPicker();
}

function addCustomTagFromInput() {
  const input = document.getElementById('r-custom-tag-input');
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;

  const sanitizedKey = raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  if (!selectedModalHazards.includes(sanitizedKey)) {
    if (!HAZARD_CONFIG[sanitizedKey]) {
      HAZARD_CONFIG[sanitizedKey] = {
        key: sanitizedKey,
        label: raw,
        icon: 'tag',
        cssClass: 'cat-other'
      };
    }
    selectedModalHazards.push(sanitizedKey);
  }
  input.value = '';
  renderHazardTagPicker();
}

function handleCustomTagKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomTagFromInput();
  }
}

function removeModalTag(key) {
  const idx = selectedModalHazards.indexOf(key);
  if (idx > -1) {
    selectedModalHazards.splice(idx, 1);
    renderHazardTagPicker();
  }
}

function renderSelectedTagsBox() {
  const box = document.getElementById('selected-tags-box');
  if (!box) return;

  if (selectedModalHazards.length === 0) {
    box.innerHTML = `<span style="font-size:.78rem;color:var(--text-muted);font-style:italic;">No emergency tags selected. Click preset chips above or type a custom tag.</span>`;
    updateAssetSummaryPreview();
    return;
  }

  box.innerHTML = selectedModalHazards.map(key => {
    const cfg = HAZARD_CONFIG[key] || { label: key, icon: 'tag', cssClass: 'cat-other' };
    return `<span class="cat-badge ${cfg.cssClass}" style="padding:.3rem .6rem;">
      <i data-lucide="${cfg.icon}"></i> ${escHtml(cfg.label)}
      <span class="tag-remove-btn" onclick="removeModalTag('${key}')" title="Remove Tag">&times;</span>
    </span>`;
  }).join('');

  updateAssetSummaryPreview();
  lucide.createIcons();
}

// ---- Tab switching ----

function switchTab(tab) {
  document.getElementById('pane-inventory').style.display   = tab === 'inventory'   ? 'block' : 'none';
  document.getElementById('pane-dispatch').style.display    = tab === 'dispatch'    ? 'block' : 'none';
  document.getElementById('pane-maintenance').style.display = tab === 'maintenance' ? 'block' : 'none';
  document.getElementById('pane-logs').style.display        = tab === 'logs'        ? 'block' : 'none';
  document.getElementById('tab-inventory').classList.toggle('active',   tab === 'inventory');
  document.getElementById('tab-dispatch').classList.toggle('active',    tab === 'dispatch');
  document.getElementById('tab-maintenance').classList.toggle('active', tab === 'maintenance');
  document.getElementById('tab-logs').classList.toggle('active',        tab === 'logs');
  if (tab === 'logs' && allLogs.length === 0) loadResourceLogs();
  if (tab === 'maintenance') renderMaintenanceTable();
}

// ---- Activity Log ----

let allLogs = [];
let logPagination = { currentPage: 1, pageSize: 25, filtered: [] };

const EVENT_BADGE = {
  added:          '<span class="badge badge-green">Added</span>',
  restocked:      '<span class="badge badge-blue">Restocked</span>',
  dispatched:     '<span class="badge badge-orange">Dispatched</span>',
  returned:       '<span class="badge badge-green">Returned</span>',
  status_changed: '<span class="badge badge-yellow">Status Changed</span>',
  archived:       '<span class="badge badge-red">Archived</span>',
};

const EVENT_ICON = {
  added:          'plus-circle',
  restocked:      'package-plus',
  dispatched:     'send',
  returned:       'corner-down-left',
  status_changed: 'settings',
  archived:       'archive',
};

let pendingActivityLogs = [];

function addActivityLogEntry(entry) {
  const log = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    resource_name: entry.resource_name || entry.resource || 'Unknown Resource',
    resource_type: entry.resource_type || entry.type || 'equipment',
    event_type: entry.event_type,
    qty_change: entry.qty_change != null ? entry.qty_change : null,
    qty_before: entry.qty_before != null ? entry.qty_before : null,
    qty_after: entry.qty_after != null ? entry.qty_after : null,
    new_status: entry.new_status || null,
    description: entry.description || '',
    performed_by_name: entry.performed_by_name || 'System',
    created_at: new Date().toISOString(),
  };

  pendingActivityLogs.unshift(log);
  allLogs.unshift(log);
  if (typeof filterLogs === 'function') filterLogs();
}

const FALLBACK_LOGS = [
  {
    id: "log-1",
    resource_name: "Heavy-Duty Diesel Generator 10kVA",
    resource_type: "equipment",
    event_type: "restocked",
    qty_change: 2,
    qty_before: 3,
    qty_after: 5,
    new_status: "available",
    description: "Annual DRRM budget allocation - 2 unit 10kVA generators restocked to Barangay Main Depot",
    performed_by_name: "Captain Rodriguez",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: "log-2",
    resource_name: "Motorized Rescue Flatboat B-1",
    resource_type: "vehicle",
    event_type: "dispatched",
    qty_change: -1,
    qty_before: 3,
    qty_after: 2,
    new_status: "in_use",
    description: "Dispatched to Sitio 2 Shoreline for coastal flood monitoring",
    performed_by_name: "Officer Tanod",
    created_at: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: "log-3",
    resource_name: "Emergency First Aid Responder Kits",
    resource_type: "medical",
    event_type: "added",
    qty_change: 15,
    qty_before: 25,
    qty_after: 40,
    new_status: "available",
    description: "Medical supplies restocked for typhoons and triage operations",
    performed_by_name: "Health Officer Maria",
    created_at: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: "log-4",
    resource_name: "High-Powered Stihl Chain Saw",
    resource_type: "equipment",
    event_type: "returned",
    qty_change: 1,
    qty_before: 1,
    qty_after: 2,
    new_status: "available",
    description: "Returned after clearing fallen tree debris on Main Road",
    performed_by_name: "Tanod Maintenance",
    created_at: new Date(Date.now() - 3600000 * 28).toISOString()
  },
  {
    id: "log-5",
    resource_name: "High-Visibility Adult Life Vests",
    resource_type: "supplies",
    event_type: "status_changed",
    qty_change: 0,
    qty_before: 50,
    qty_after: 50,
    new_status: "maintenance",
    description: "Scheduled safety inspect & strap check for water rescue vests",
    performed_by_name: "Supply Officer Reyes",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

async function loadResourceLogs() {
  const tbody = document.getElementById('logs-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-text" style="width:90px;"></span></td>
        <td><span class="skeleton skeleton-title" style="width:140px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:160px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:90px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-text" style="width:90px;"></span></td>
        <td><span class="skeleton skeleton-title" style="width:120px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:140px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:90px;"></span></td>
      </tr>`;
  }

  try {
    allLogs = await apiFetch('/resources/logs?limit=500');
    if (!allLogs || !allLogs.length) {
      allLogs = [...FALLBACK_LOGS];
    }
  } catch (err) {
    console.warn('Backend activity log endpoint unreachable, using fallback activity logs:', err);
    allLogs = [...FALLBACK_LOGS];
  }

  if (pendingActivityLogs.length) {
    allLogs = [...pendingActivityLogs, ...allLogs];
  }

  logPagination.filtered = [...allLogs];
  logPagination.currentPage = 1;
  filterLogs();
}

function filterLogs() {
  const search    = (document.getElementById('log-search')?.value || '').toLowerCase().trim();
  const eventType = document.getElementById('log-filter-event')?.value || '';
  const resType   = document.getElementById('log-filter-type')?.value || '';
  const dateFrom  = document.getElementById('log-date-from')?.value || '';
  const dateTo    = document.getElementById('log-date-to')?.value || '';

  logPagination.filtered = allLogs.filter(log => {
    if (eventType && log.event_type !== eventType) return false;
    if (resType   && log.resource_type !== resType) return false;

    if (dateFrom) {
      const logDate = new Date(log.created_at);
      if (logDate < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const logDate = new Date(log.created_at);
      const toLimit = new Date(dateTo);
      toLimit.setDate(toLimit.getDate() + 1);
      if (logDate >= toLimit) return false;
    }

    if (search) {
      const haystack = [
        log.resource_name || '',
        log.event_type || '',
        log.description || '',
        log.performed_by_name || '',
        log.resource_type || '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  // Show/hide clear button
  const preset = document.getElementById('log-date-preset')?.value || 'all';
  const hasFilter = search || eventType || resType || dateFrom || dateTo || (preset !== 'all');
  const clearBtn = document.getElementById('btn-clear-log-filters');
  if (clearBtn) clearBtn.style.display = hasFilter ? 'inline-flex' : 'none';

  logPagination.currentPage = 1;
  renderLogsPaginated();
}

function handleLogDatePresetChange() {
  const preset = document.getElementById('log-date-preset')?.value || 'all';
  const dateFromEl = document.getElementById('log-date-from');
  const dateToEl = document.getElementById('log-date-to');

  if (preset === 'custom') {
    openCustomDateModal('log');
    return;
  }

  if (dateFromEl) dateFromEl.value = '';
  if (dateToEl) dateToEl.value = '';

  const now = new Date();
  if (preset === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    if (dateFromEl) dateFromEl.value = todayStr;
    if (dateToEl) dateToEl.value = todayStr;
  } else if (preset === '7days') {
    const past = new Date(now.getTime() - 7 * 86400000);
    if (dateFromEl) dateFromEl.value = past.toISOString().split('T')[0];
    if (dateToEl) dateToEl.value = now.toISOString().split('T')[0];
  } else if (preset === '30days') {
    const past = new Date(now.getTime() - 30 * 86400000);
    if (dateFromEl) dateFromEl.value = past.toISOString().split('T')[0];
    if (dateToEl) dateToEl.value = now.toISOString().split('T')[0];
  }

  filterLogs();
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

function openCustomDateModal(context) {
  const modalDateFrom = document.getElementById('modal-date-from');
  const modalDateTo   = document.getElementById('modal-date-to');

  // Store which filter context opened the modal
  if (modalDateFrom) modalDateFrom.dataset.context = context || '';

  // Pre-fill from the relevant hidden inputs
  let sourceFrom, sourceTo;
  if (context === 'dispatch') {
    sourceFrom = document.getElementById('dispatch-date-from');
    sourceTo   = document.getElementById('dispatch-date-to');
  } else {
    sourceFrom = document.getElementById('inc-date-from') || document.getElementById('log-date-from');
    sourceTo   = document.getElementById('inc-date-to')   || document.getElementById('log-date-to');
  }

  if (modalDateFrom) modalDateFrom.value = sourceFrom?.value || '';
  if (modalDateTo)   modalDateTo.value   = sourceTo?.value   || '';

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
  const modalDateFrom = document.getElementById('modal-date-from');
  const modalDateTo   = document.getElementById('modal-date-to');
  const from = modalDateFrom?.value || '';
  const to   = modalDateTo?.value   || '';
  const context = modalDateFrom?.dataset.context || '';

  if (context === 'dispatch') {
    const df = document.getElementById('dispatch-date-from');
    const dt = document.getElementById('dispatch-date-to');
    if (df) df.value = from;
    if (dt) dt.value = to;
    closeCustomDateModal();
    filterDispatch();
  } else {
    const logDateFrom = document.getElementById('log-date-from');
    const logDateTo   = document.getElementById('log-date-to');
    if (logDateFrom) logDateFrom.value = from;
    if (logDateTo)   logDateTo.value   = to;
    closeCustomDateModal();
    filterLogs();
  }
}

function clearLogFilters() {
  const ids = ['log-search','log-filter-event','log-filter-type','log-date-from','log-date-to'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const presetEl = document.getElementById('log-date-preset');
  if (presetEl) presetEl.value = 'all';

  filterLogs();
}

function renderLogsPaginated() {
  const total     = logPagination.filtered.length;
  const pageSize  = logPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (logPagination.currentPage > totalPages) logPagination.currentPage = totalPages;
  if (logPagination.currentPage < 1) logPagination.currentPage = 1;

  const start    = (logPagination.currentPage - 1) * pageSize;
  const end      = Math.min(start + pageSize, total);
  const pageData = logPagination.filtered.slice(start, end);

  renderLogsTable(pageData);
  updateLogPaginationBar(total, total === 0 ? 0 : start + 1, end, logPagination.currentPage, totalPages);
}

function renderLogsTable(data) {
  const tbody = document.getElementById('logs-tbody');
  if (!tbody) return;

  if (!data || !data.length) {
    renderTableEmpty('logs-tbody', 'No Activity Log Entries', 'No resource transactions or inventory movements match the selected filters.', 4, 'activity');
    return;
  }

  tbody.innerHTML = data.map(log => {
    const dt = log.created_at
      ? new Date(log.created_at).toLocaleString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

    const iconName = EVENT_ICON[log.event_type] || 'activity';

    return `<tr onclick="openLogDetailModal('${log.id}')" style="cursor:pointer;" title="Click row to view full transaction details">
      <td style="white-space:nowrap;font-size:.8rem;color:var(--text-muted);font-weight:500;">${escHtml(dt)}</td>
      <td>
        <div style="font-weight:700;font-size:.88rem;color:var(--text-main);">${escHtml(log.resource_name || '—')}</div>
        <div style="font-size:.73rem;color:#60a5fa;font-weight:600;margin-top:.15rem;">${TYPE_LABEL[log.resource_type] || log.resource_type || '—'}</div>
      </td>
      <td>
        <div style="display:inline-flex;align-items:center;gap:.45rem;padding:.2rem .6rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:20px;">
          <i data-lucide="${iconName}" style="width:14px;height:14px;color:#60a5fa;flex-shrink:0;"></i>
          ${EVENT_BADGE[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}
        </div>
      </td>
      <td style="font-size:.8rem;color:var(--text-main);font-weight:600;white-space:nowrap;">
        ${escHtml(log.performed_by_name || '—')}
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function openLogDetailModal(id) {
  const log = allLogs.find(l => l.id === id);
  if (!log) return;

  const modalBody = document.getElementById('log-modal-body');
  if (!modalBody) return;

  const dt = log.created_at
    ? new Date(log.created_at).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : '—';

  const iconName = EVENT_ICON[log.event_type] || 'activity';
  const qtyChange = log.qty_change;
  let qtyHtml = '<span style="color:var(--text-muted);">No quantity change</span>';

  if (qtyChange !== null && qtyChange !== undefined && qtyChange !== 0) {
    const isPos = qtyChange > 0;
    qtyHtml = `<span style="font-size:1.1rem;font-weight:800;color:${isPos ? '#34d399' : '#f87171'};">${isPos ? '+' : ''}${qtyChange} units</span>`;
    if (log.qty_before !== null && log.qty_after !== null) {
      qtyHtml += ` <span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem;">(${log.qty_before} → ${log.qty_after})</span>`;
    }
  } else if (log.qty_before !== null && log.qty_after !== null && log.qty_before !== log.qty_after) {
    qtyHtml = `<span style="font-size:.85rem;color:var(--text-muted);">${log.qty_before} → ${log.qty_after}</span>`;
  }

  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.2rem;">
      <div style="padding:1rem;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">Resource Item</div>
        <div style="font-size:1.1rem;font-weight:800;color:var(--text-main);">${escHtml(log.resource_name || '—')}</div>
        <div style="font-size:.8rem;color:#60a5fa;margin-top:.2rem;font-weight:600;">Category: ${TYPE_LABEL[log.resource_type] || log.resource_type || '—'}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">EVENT TYPE</div>
          <div style="display:flex;align-items:center;gap:.4rem;">
            <i data-lucide="${iconName}" style="width:16px;height:16px;color:#60a5fa;"></i>
            ${EVENT_BADGE[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}
          </div>
        </div>

        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">STATUS AFTER</div>
          <div>${STATUS_BADGE[log.new_status] || (log.new_status ? `<span class="badge">${escHtml(log.new_status)}</span>` : '—')}</div>
        </div>
      </div>

      <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">QUANTITY MOVEMENT</div>
        <div>${qtyHtml}</div>
      </div>

      <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">AUDIT DESCRIPTION & NOTES</div>
        <div style="font-size:.85rem;color:var(--text-main);line-height:1.5;">${escHtml(log.description || 'No additional log notes provided.')}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.78rem;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.08);padding-top:.85rem;">
        <div><strong style="color:var(--text-main);">Performed By:</strong> ${escHtml(log.performed_by_name || 'System Admin')}</div>
        <div style="text-align:right;"><strong style="color:var(--text-main);">Timestamp:</strong> ${escHtml(dt)}</div>
      </div>
    </div>
  `;

  document.getElementById('log-detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeLogDetailModal() {
  document.getElementById('log-detail-modal-overlay')?.classList.remove('active');
}

function closeLogDetailModalOutside(event) {
  if (event.target.id === 'log-detail-modal-overlay') {
    closeLogDetailModal();
  }
}

function updateLogPaginationBar(total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById('log-pagination-info');
  if (info) info.textContent = total === 0
    ? 'Showing 0 of 0 entries'
    : `Showing ${startDisplay} to ${endDisplay} of ${total} entries`;

  const prevBtn = document.getElementById('log-btn-prev');
  const nextBtn = document.getElementById('log-btn-next');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  const container = document.getElementById('log-page-numbers');
  if (container) {
    let html = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) html += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) html += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToLogPage(${p})">${p}</button>`;
    }
    container.innerHTML = html;
  }

  const pagEl = document.getElementById('log-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';
}

function changeLogPageSize(val) {
  logPagination.pageSize = parseInt(val, 10);
  logPagination.currentPage = 1;
  renderLogsPaginated();
}
function prevLogPage() {
  if (logPagination.currentPage > 1) { logPagination.currentPage--; renderLogsPaginated(); }
}
function nextLogPage() {
  const total = Math.ceil(logPagination.filtered.length / logPagination.pageSize) || 1;
  if (logPagination.currentPage < total) { logPagination.currentPage++; renderLogsPaginated(); }
}
function goToLogPage(p) {
  logPagination.currentPage = p;
  renderLogsPaginated();
}

function printResourceLogs() {
  const data = logPagination.filtered;
  if (!data.length) {
    showToast('No log entries to print with current filters.', 'info', 'Nothing to Print');
    return;
  }

  const rows = data.map(log => {
    const dt = log.created_at
      ? new Date(log.created_at).toLocaleString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';
    const eventLabel = {
      added: 'Added', restocked: 'Restocked', dispatched: 'Dispatched',
      returned: 'Returned', status_changed: 'Status Changed', archived: 'Archived',
    }[log.event_type] || log.event_type;
    const qtyChange = log.qty_change !== 0
      ? `${log.qty_change > 0 ? '+' : ''}${log.qty_change} (${log.qty_before ?? '?'} → ${log.qty_after ?? '?'})`
      : '—';

    return `<tr>
      <td>${escHtml(dt)}</td>
      <td>${escHtml(log.resource_name || '—')}</td>
      <td>${escHtml(TYPE_LABEL[log.resource_type] || log.resource_type || '—')}</td>
      <td>${escHtml(eventLabel)}</td>
      <td>${escHtml(qtyChange)}</td>
      <td>${escHtml(log.new_status || '—')}</td>
      <td>${escHtml(log.description || '—')}</td>
      <td>${escHtml(log.performed_by_name || '—')}</td>
    </tr>`;
  }).join('');

  // Collect active filter labels for the print header
  const filterSummary = [];
  const eventSel = document.getElementById('log-filter-event');
  const typeSel  = document.getElementById('log-filter-type');
  const dateFrom = document.getElementById('log-date-from')?.value;
  const dateTo   = document.getElementById('log-date-to')?.value;
  const search   = document.getElementById('log-search')?.value;
  if (eventSel?.value) filterSummary.push(`Event: ${eventSel.options[eventSel.selectedIndex].text}`);
  if (typeSel?.value)  filterSummary.push(`Type: ${typeSel.options[typeSel.selectedIndex].text}`);
  if (dateFrom) filterSummary.push(`From: ${dateFrom}`);
  if (dateTo)   filterSummary.push(`To: ${dateTo}`);
  if (search)   filterSummary.push(`Search: "${search}"`);

  const printWin = window.open('', '_blank', 'width=1100,height=800');
  printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Resource Activity Log — Barangay DRRM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
    .print-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #1e40af; padding-bottom: 12px; }
    .print-header h1 { font-size: 16px; font-weight: 800; color: #1e40af; }
    .print-header p  { font-size: 11px; color: #64748b; margin-top: 3px; }
    .filter-bar { font-size: 10px; color: #64748b; margin-bottom: 10px; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #1e40af; color: #fff; }
    thead th { padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .print-footer { margin-top: 16px; font-size: 10px; color: #94a3b8; text-align: right; }
    @media print {
      body { padding: 10px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h1>Barangay DRRM — Resource Activity Log</h1>
    <p>Barangay Linao, Ormoc City &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</p>
  </div>
  ${filterSummary.length ? `<div class="filter-bar">Filters: ${filterSummary.join(' &nbsp;|&nbsp; ')} &nbsp;|&nbsp; Total Records: ${data.length}</div>` : `<div class="filter-bar">All Records &nbsp;|&nbsp; Total: ${data.length}</div>`}
  <table>
    <thead>
      <tr>
        <th>Date &amp; Time</th>
        <th>Resource Name</th>
        <th>Type</th>
        <th>Event</th>
        <th>Qty Change</th>
        <th>Status After</th>
        <th>Description</th>
        <th>Performed By</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="print-footer">Generated by Barangay DRRM System &mdash; Confidential</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  printWin.document.close();
}

// ---- Load Resources ----

function showResourcesSkeletons() {
  const sumIds = ['sum-total-items', 'sum-available-items', 'sum-deployed-items', 'sum-maintenance-items'];
  sumIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const tbody = document.getElementById('resources-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td><span class="skeleton skeleton-title" style="width:70%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:40px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:40px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:60px;"></span></td>
      </tr>
      <tr>
        <td><span class="skeleton skeleton-title" style="width:60%;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:50px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:40px;"></span></td>
        <td><span class="skeleton skeleton-text" style="width:40px;"></span></td>
        <td><span class="skeleton skeleton-badge"></span></td>
        <td><span class="skeleton skeleton-text" style="width:60px;"></span></td>
      </tr>`;
  }
}

const FALLBACK_RESOURCES = [
  {
    id: "res-1",
    name: "Submersible De-Watering Trash Pump (Heavy Duty)",
    category: "flooding",
    applicable_hazards: ["flooding", "typhoon", "general_emergency"],
    type: "other",
    quantity: 6,
    available_quantity: 6,
    status: "available",
    property_code: "BRG-2026-1001",
    location: "Barangay Operations Depot"
  },
  {
    id: "res-2",
    name: "Inflatable Water Rescue Boat (Motorized)",
    category: "flooding",
    applicable_hazards: ["flooding", "typhoon", "search_rescue"],
    type: "rescue_boat",
    quantity: 4,
    available_quantity: 3,
    status: "available",
    property_code: "BRG-2026-1002",
    location: "Barangay Operations Center Storage"
  },
  {
    id: "res-3",
    name: "Emergency First Aid Trauma Kit",
    category: "medical",
    applicable_hazards: ["medical", "general_emergency"],
    type: "medical_kit",
    quantity: 25,
    available_quantity: 18,
    status: "available",
    property_code: "BRG-2026-1003",
    location: "Barangay Health Station (BHS)"
  },
  {
    id: "res-4",
    name: "Heavy-Duty Chainsaw (Fallen Tree Removal)",
    category: "typhoon",
    applicable_hazards: ["typhoon", "landslide", "earthquake"],
    type: "other",
    quantity: 4,
    available_quantity: 4,
    status: "available",
    property_code: "BRG-2026-1004",
    location: "Barangay Operations Center Storage"
  },
  {
    id: "res-5",
    name: "Portable Electric Generator (5kVA Solar-Hybrid)",
    category: "power_outage",
    applicable_hazards: ["power_outage", "typhoon", "flooding", "general_emergency"],
    type: "other",
    quantity: 3,
    available_quantity: 3,
    status: "available",
    property_code: "BRG-2026-1005",
    location: "Evacuation Center Depot"
  },
  {
    id: "res-6",
    name: "BFP Fire Extinguisher (ABC Dry Chemical 10kg)",
    category: "fire",
    applicable_hazards: ["fire", "general_emergency"],
    type: "other",
    quantity: 15,
    available_quantity: 15,
    status: "available",
    property_code: "BRG-2026-1006",
    location: "Barangay Hall Fire Cabinet"
  }
];

let resPagination = { currentPage: 1, pageSize: 10, filtered: [] };
let dispatchPagination = { currentPage: 1, pageSize: 10, filtered: [] };

async function loadResources() {
  const btn = document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  showResourcesSkeletons();
  try {
    allResources = await apiFetch('/resources/');
    renderResourceSummary(allResources);
    filterResources();
  } catch (err) {
    console.warn('Backend unavailable, using fallback resources:', err);
    allResources = [...FALLBACK_RESOURCES];
    renderResourceSummary(allResources);
    filterResources();
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderResourceSummary(data) {
  document.getElementById('sum-total-items').textContent       = data.length;
  document.getElementById('sum-available-items').textContent   = data.filter(r => r.status === 'available').length;
  document.getElementById('sum-deployed-items').textContent    = data.filter(r => r.status === 'deployed').length;
  document.getElementById('sum-maintenance-items').textContent = data.filter(r => r.status === 'maintenance').length;
  document.getElementById('sum-damaged-items').textContent     = data.filter(r => r.status === 'damaged').length;
  document.getElementById('sum-unavailable-items').textContent = data.filter(r => r.status === 'unavailable').length;
  if (window.lucide) lucide.createIcons();
}

function quickFilterStatus(status) {
  const statusSelect = document.getElementById('res-filter-status');
  if (statusSelect) {
    statusSelect.value = status;
    filterResources();
  }
}

function selectCategoryFilter(cat) {
  currentCategoryFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-category') === cat);
  });
  filterResources();
}

function renderResourcesPaginated() {
  const total = resPagination.filtered.length;
  const pageSize = resPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (resPagination.currentPage > totalPages) resPagination.currentPage = totalPages;
  if (resPagination.currentPage < 1) resPagination.currentPage = 1;

  const start = (resPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = resPagination.filtered.slice(start, end);

  renderResourceTable(pageData);
  updateResPaginationBar(total, total === 0 ? 0 : start + 1, end, resPagination.currentPage, totalPages);
}

function updateResPaginationBar(total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById('res-pagination-info');
  if (info) {
    if (total === 0) {
      info.textContent = 'Showing 0 of 0 entries';
    } else {
      info.textContent = `Showing ${startDisplay} to ${endDisplay} of ${total} entries`;
    }
  }

  const prevBtn = document.getElementById('res-btn-prev');
  const nextBtn = document.getElementById('res-btn-next');
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  const container = document.getElementById('res-page-numbers');
  if (container) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      pagesHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToResPage(${p})">${p}</button>`;
    }
    container.innerHTML = pagesHtml;
  }

  const pagEl = document.getElementById('res-pagination');
  if (pagEl) {
    pagEl.style.display = total === 0 ? 'none' : 'flex';
  }
}

function changeResPageSize(val) {
  resPagination.pageSize = parseInt(val, 10);
  resPagination.currentPage = 1;
  renderResourcesPaginated();
}

function prevResPage() {
  if (resPagination.currentPage > 1) {
    resPagination.currentPage--;
    renderResourcesPaginated();
  }
}

function nextResPage() {
  const totalPages = Math.ceil(resPagination.filtered.length / resPagination.pageSize) || 1;
  if (resPagination.currentPage < totalPages) {
    resPagination.currentPage++;
    renderResourcesPaginated();
  }
}

function goToResPage(p) {
  resPagination.currentPage = p;
  renderResourcesPaginated();
}

function renderResourceTable(data) {
  const tbody = document.getElementById('resources-tbody');
  const user  = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No resources found matching the selected hazard tags or filters.</td></tr>`;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(r => {
    const pct = r.quantity ? Math.round((r.available_quantity / r.quantity) * 100) : 0;
    const iconName = TYPE_ICON[r.type] || 'box';
    const isOutOfService = OUT_OF_SERVICE_STATUSES.includes(r.status);

    return `
    <tr style="cursor:pointer;${isOutOfService ? 'opacity:0.6;' : ''}" onclick="openResourceDetailModal('${r.id}')">
      <td>
        <div class="res-name-cell">
          <div class="res-type-icon">
            <i data-lucide="${iconName}"></i>
          </div>
          <div>
            <div class="incident-title" style="color:var(--text-main);font-weight:700;">${escHtml(r.name)}</div>
            <div class="incident-desc" style="display:flex;gap:.5rem;align-items:center;">
              ${r.property_code ? `<span style="font-family:monospace;font-size:.72rem;color:var(--primary);font-weight:700;">${escHtml(r.property_code)}</span>` : ''}
              ${r.serial_number ? `<span style="font-size:.7rem;color:var(--text-muted);">S/N: ${escHtml(r.serial_number)}</span>` : ''}
              ${!r.property_code && !r.serial_number && r.location ? `<span>${escHtml(r.location)}</span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${r.ownership_tier === 'private' ? 'badge-yellow' : 'badge-blue'}">
          ${r.ownership_tier === 'private' ? 'Private' : 'Barangay'}
        </span>
      </td>
      <td>
        <div class="qty-cell">
          <div style="font-weight:700;font-size:.85rem;color:var(--text-main);margin-bottom:.2rem;">
            <span style="color:${r.available_quantity > 0 ? '#34d399' : '#f87171'};">${r.available_quantity}</span>
            <span style="color:var(--text-muted);font-size:.78rem;font-weight:500;"> / ${r.quantity}</span>
          </div>
          <div class="qty-bar-track">
            <div class="qty-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </td>
      <td>${STATUS_BADGE[r.status] || `<span class="badge">${r.status}</span>`}</td>
      <td style="text-align:right;">
        ${canEdit
          ? `<div class="table-actions" style="justify-content:flex-end;" onclick="event.stopPropagation()">
              <button class="action-btn action-btn-primary" title="Issue Dispatch Ticket" onclick="event.stopPropagation();openDispatchModalFor('${r.id}')"><i data-lucide="send"></i></button>
              <button class="action-btn action-btn-warning" title="Log Maintenance" onclick="event.stopPropagation();openMaintenanceTicketModal('${r.id}')"><i data-lucide="wrench"></i></button>
            </div>`
          : '<span style="color:var(--text-muted);font-size:.8rem;">—</span>'}
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function clearResourceFilters() {
  const search    = document.getElementById('res-search');
  const hazard    = document.getElementById('res-filter-hazard');
  const ownership = document.getElementById('res-filter-ownership');
  const type      = document.getElementById('res-filter-type');
  const status    = document.getElementById('res-filter-status');

  if (search)    search.value    = '';
  if (hazard)    hazard.value    = '';
  if (ownership) ownership.value = '';
  if (type)      type.value      = '';
  if (status)    status.value    = '';

  currentCategoryFilter = 'all';
  document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
  const allPill = document.querySelector('.cat-pill[data-category="all"]');
  if (allPill) allPill.classList.add('active');

  filterResources();
}

function filterResources() {
  const searchInput     = document.getElementById('res-search');
  const hazardSelect    = document.getElementById('res-filter-hazard');
  const ownershipSelect = document.getElementById('res-filter-ownership');
  const typeSelect      = document.getElementById('res-filter-type');
  const statusSelect    = document.getElementById('res-filter-status');

  const search    = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const hazard    = hazardSelect ? hazardSelect.value : (currentCategoryFilter !== 'all' ? currentCategoryFilter : '');
  const ownership = ownershipSelect ? ownershipSelect.value : '';
  const type      = typeSelect ? typeSelect.value : '';
  const status    = statusSelect ? statusSelect.value : '';

  resPagination.filtered = allResources.filter(r => {
    const rHazards = getResourceHazards(r);

    // Hazard tag matching
    let matchesHazard = true;
    if (hazard) {
      if (hazard === 'disaster') {
        matchesHazard = rHazards.includes('flooding') || rHazards.includes('typhoon') || rHazards.includes('disaster');
      } else {
        matchesHazard = rHazards.includes(hazard) || r.category === hazard;
      }
    }

    // Search query matching (matches name, code, serial, location, or tag labels!)
    let matchesSearch = true;
    if (search) {
      const tagText = rHazards.map(h => (HAZARD_CONFIG[h]?.label || h)).join(' ').toLowerCase();
      matchesSearch = (r.name || '').toLowerCase().includes(search)
        || (r.property_code || '').toLowerCase().includes(search)
        || (r.serial_number || '').toLowerCase().includes(search)
        || (r.location || '').toLowerCase().includes(search)
        || tagText.includes(search);
    }

    const matchesOwnership = !ownership || (r.ownership_tier || 'barangay') === ownership;
    const matchesType      = !type || r.type === type;
    const matchesStatus    = !status || r.status === status;

    return matchesHazard && matchesSearch && matchesOwnership && matchesType && matchesStatus;
  });

  // Show/hide the "Clear Filters" button
  const hasActiveFilters = search || hazard || ownership || type || status;
  const clearBtn = document.getElementById('btn-clear-filters');
  if (clearBtn) clearBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';

  resPagination.currentPage = 1;
  renderResourcesPaginated();
}

// ---- Add/Edit Resource Modal Wizard ----

let currentWizardStep = 1;

function setWizardStep(step) {
  currentWizardStep = step;

  // Panes display
  for (let i = 1; i <= 3; i++) {
    const pane = document.getElementById(`wizard-pane-${i}`);
    const indicator = document.getElementById(`wizard-step-indicator-${i}`);
    const line = document.getElementById(`wizard-step-line-${i}`);

    if (pane) pane.classList.toggle('active', i === step);
    if (indicator) {
      indicator.classList.toggle('active', i === step);
      indicator.classList.toggle('completed', i < step);
    }
    if (line) {
      line.classList.toggle('active', i < step);
    }
  }

  // Footer Navigation Buttons
  const prevBtn   = document.getElementById('wizard-btn-prev');
  const nextBtn   = document.getElementById('wizard-btn-next');
  const submitBtn = document.getElementById('resource-submit-btn');

  if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.display = step === 3 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = step === 3 ? 'inline-flex' : 'none';

  if (step === 3) {
    updateAssetSummaryPreview();
  }

  lucide.createIcons();
}

function goToWizardStep(targetStep) {
  const errEl = document.getElementById('resource-error');
  if (errEl) errEl.style.display = 'none';

  // Can always go back to lower steps
  if (targetStep < currentWizardStep) {
    setWizardStep(targetStep);
    return;
  }

  let isValid = true;
  let firstInvalidEl = null;

  // Validate Step 1 if on Step 1 or trying to pass Step 1
  if (currentWizardStep === 1 || targetStep > 1) {
    const nameEl = document.getElementById('r-name');
    const typeEl = document.getElementById('r-type');
    const name = nameEl?.value.trim();
    const type = typeEl?.value;

    if (!name) {
      if (nameEl) nameEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = nameEl;
    }
    if (!type) {
      if (typeEl) typeEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = typeEl;
    }

    if (!isValid) {
      if (errEl) {
        errEl.textContent = 'Please fill out all required fields highlighted in red.';
        errEl.style.display = 'block';
      }
      if (firstInvalidEl) firstInvalidEl.focus();
      return;
    }
  }

  // Validate Step 2 if moving to Step 3
  if (targetStep === 3 && currentWizardStep === 2) {
    if (!selectedModalHazards || selectedModalHazards.length === 0) {
      const tagBox = document.getElementById('selected-tags-box') || document.getElementById('hazard-tag-picker');
      if (tagBox) tagBox.classList.add('is-invalid');
      if (errEl) {
        errEl.textContent = 'Please select at least one Emergency Hazard Tag in Step 2.';
        errEl.style.display = 'block';
      }
      return;
    }
  }

  setWizardStep(targetStep);
}

function nextWizardStep() {
  if (currentWizardStep < 3) {
    goToWizardStep(currentWizardStep + 1);
  }
}

function prevWizardStep() {
  if (currentWizardStep > 1) {
    goToWizardStep(currentWizardStep - 1);
  }
}

function updateAssetSummaryPreview() {
  const summaryBox = document.getElementById('summary-card-content');
  if (!summaryBox) return;

  const name = document.getElementById('r-name')?.value.trim() || '—';
  const ownership = document.getElementById('r-ownership')?.value === 'private' ? 'Private Sector Asset' : 'Barangay Inventory';
  const typeVal = document.getElementById('r-type')?.value;
  const typeLabel = TYPE_LABEL[typeVal] || typeVal || '—';
  const location = document.getElementById('r-location')?.value.trim() || 'Unassigned Depot';
  const qty = document.getElementById('r-quantity')?.value || '1';
  const propertyCode = document.getElementById('r-property-code')?.value || 'Pending';
  const serialNo = document.getElementById('r-serial-number')?.value.trim();

  const hazardBadgesHtml = selectedModalHazards.length > 0
    ? selectedModalHazards.map(hKey => {
        const cfg = HAZARD_CONFIG[hKey] || { label: hKey, icon: 'tag', cssClass: 'cat-other' };
        return `<span class="cat-badge ${cfg.cssClass}" style="padding:.2rem .55rem;"><i data-lucide="${cfg.icon}"></i> ${escHtml(cfg.label)}</span>`;
      }).join(' ')
    : `<span style="color:var(--text-muted);font-style:italic;">None selected</span>`;

  summaryBox.innerHTML = `
    <div style="display:flex;justify-space-between;align-items:flex-start;gap:1rem;margin-bottom:.6rem;">
      <div>
        <div style="font-size:1.05rem;font-weight:700;color:#60a5fa;">${escHtml(name)}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;display:flex;gap:.6rem;align-items:center;">
          <span><strong>Ownership:</strong> ${ownership}</span>
          <span>•</span>
          <span><strong>Type:</strong> ${escHtml(typeLabel)}</span>
        </div>
      </div>
      <div style="text-align:right;background:rgba(52,211,153,0.1);padding:.35rem .75rem;border-radius:8px;border:1px solid rgba(52,211,153,0.3);">
        <span style="font-size:.7rem;color:var(--text-muted);display:block;text-transform:uppercase;font-weight:700;">Quantity</span>
        <strong style="font-size:1.15rem;color:#34d399;">${qty} units</strong>
      </div>
    </div>

    <div style="margin-bottom:.65rem;">
      <div style="font-size:.73rem;color:var(--text-muted);margin-bottom:.3rem;font-weight:600;">Emergency Hazard Applicability Tags:</div>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
        ${hazardBadgesHtml}
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem;padding-top:.55rem;border-top:1px dashed rgba(255,255,255,0.12);color:var(--text-muted);">
      <div><i data-lucide="map-pin" style="width:13px;height:13px;color:var(--primary);"></i> <strong>Storage:</strong> ${escHtml(location)}</div>
      <div><i data-lucide="barcode" style="width:13px;height:13px;color:var(--primary);"></i> Code: <code style="color:var(--primary);font-weight:700;">${escHtml(propertyCode)}</code> ${serialNo ? `(S/N: ${escHtml(serialNo)})` : ''}</div>
    </div>
  `;

  lucide.createIcons();
}

async function autoGenResourceCode() {
  try {
    const res = await apiFetch('/resources/generate/code');
    const el = document.getElementById('r-property-code');
    if (el) el.value = res.property_code;
    updateAssetSummaryPreview();
  } catch (_) {
    const year   = new Date().getFullYear();
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const el = document.getElementById('r-property-code');
    if (el) el.value = `BRG-${year}-${suffix}`;
    updateAssetSummaryPreview();
  }
}

function openAddResourceModal() {
  editingResourceId = null;
  document.getElementById('resource-modal-title').innerHTML = '<i data-lucide="package"></i> Add Resource (Step-by-Step Wizard)';
  document.getElementById('resource-submit-label').textContent = 'Save Resource';
  document.getElementById('resource-form').reset();
  document.getElementById('r-id').value = '';
  if (document.getElementById('r-ownership')) document.getElementById('r-ownership').value = 'barangay';
  document.getElementById('resource-error').style.display = 'none';

  // Default hazard tags for new resource
  selectedModalHazards = ['flooding', 'typhoon'];
  renderHazardTagPicker();

  setWizardStep(1);
  autoGenResourceCode();
  document.getElementById('resource-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openEditResourceModal(resource) {
  editingResourceId = resource.id;
  document.getElementById('resource-modal-title').innerHTML = '<i data-lucide="pencil"></i> Edit Resource Details';
  document.getElementById('resource-submit-label').textContent = 'Save Changes';
  document.getElementById('r-id').value       = resource.id;
  document.getElementById('r-name').value     = resource.name;
  if (document.getElementById('r-ownership')) document.getElementById('r-ownership').value = resource.ownership_tier || 'barangay';
  document.getElementById('r-type').value     = resource.type;
  document.getElementById('r-quantity').value = resource.quantity;
  document.getElementById('r-location').value = resource.location || '';
  if (document.getElementById('r-property-code')) document.getElementById('r-property-code').value = resource.property_code || '';
  if (document.getElementById('r-serial-number')) document.getElementById('r-serial-number').value = resource.serial_number || '';
  document.getElementById('resource-error').style.display = 'none';

  // Load existing hazard tags into tag picker
  selectedModalHazards = [...getResourceHazards(resource)];
  renderHazardTagPicker();

  setWizardStep(1);
  document.getElementById('resource-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeResourceModal() {
  document.getElementById('resource-modal-overlay').classList.remove('active');
  document.getElementById('resource-form').reset();
  editingResourceId = null;
  selectedModalHazards = [];
  currentWizardStep = 1;
}

function closeResourceModalOutside(e) {
  if (e.target === document.getElementById('resource-modal-overlay')) closeResourceModal();
}

async function submitResource() {
  const errorEl  = document.getElementById('resource-error');
  errorEl.style.display = 'none';

  const nameEl         = document.getElementById('r-name');
  const typeEl         = document.getElementById('r-type');
  const qtyEl          = document.getElementById('r-quantity');

  const name           = nameEl ? nameEl.value.trim() : '';
  const ownership_tier = document.getElementById('r-ownership') ? document.getElementById('r-ownership').value : 'barangay';
  const type           = typeEl ? typeEl.value : '';
  const quantity       = qtyEl ? parseInt(qtyEl.value) : NaN;
  const location       = document.getElementById('r-location').value.trim();
  const property_code  = document.getElementById('r-property-code') ? document.getElementById('r-property-code').value.trim() : '';
  const serial_number  = document.getElementById('r-serial-number') ? document.getElementById('r-serial-number').value.trim() : '';

  let isValid = true;
  let firstInvalidEl = null;

  if (!name) {
    if (nameEl) nameEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalidEl) firstInvalidEl = nameEl;
  }
  if (!type) {
    if (typeEl) typeEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalidEl) firstInvalidEl = typeEl;
  }
  if (isNaN(quantity) || quantity < 1) {
    if (qtyEl) qtyEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalidEl) firstInvalidEl = qtyEl;
  }

  if (!isValid) {
    showToast('Please fill out all required fields highlighted in red.', 'danger', 'Validation Required');
    if (firstInvalidEl) firstInvalidEl.focus();
    return;
  }

  if (!selectedModalHazards || selectedModalHazards.length === 0) {
    const tagBox = document.getElementById('selected-tags-box');
    if (tagBox) tagBox.classList.add('is-invalid');
    showToast('Please select at least one emergency hazard tag in Step 2.', 'danger', 'Hazard Tag Required');
    setWizardStep(2);
    return;
  }

  const category = selectedModalHazards[0] || 'general_emergency';
  const applicable_hazards = [...selectedModalHazards];

  const payload = {
    name,
    category,
    applicable_hazards,
    ownership_tier,
    type,
    quantity,
    location: location || null,
    property_code: property_code || null,
    serial_number: serial_number || null
  };

  try {
    if (editingResourceId) {
      await apiFetch(`/resources/${editingResourceId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showToast("Resource details updated!", "success", "Changes Saved");
    } else {
      await apiFetch('/resources/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast("New resource added to inventory!", "success", "Resource Saved");
    }
    closeResourceModal();
    await loadResources();
  } catch (err) {
    showToast(err.message, 'danger', 'Save Failed');
  }
}

function archiveResource(id) {
  confirmAction({
    title: "Archive Resource?",
    message: "Are you sure you want to archive this resource item from inventory?",
    confirmText: "Archive Resource",
    type: "primary",
    icon: "archive",
    onConfirm: async () => {
      try {
        await apiFetch(`/resources/${id}`, { method: 'DELETE' });
        showToast("Resource item archived.", "info", "Resource Archived");
        await loadResources();
      } catch (err) {
        showToast('Archive failed: ' + err.message, "danger", "Error");
      }
    }
  });
}

// ---- Dispatch Log ----

async function loadDispatchLog() {
  try {
    allDispatch = await apiFetch('/resources/dispatch/log');
    dispatchPagination.filtered = [...allDispatch];
    dispatchPagination.currentPage = 1;
    renderDispatchPaginated();
  } catch (err) {
    document.getElementById('dispatch-tbody').innerHTML =
      `<tr><td colspan="7" class="table-empty table-error">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderDispatchPaginated() {
  const total = dispatchPagination.filtered.length;
  const pageSize = dispatchPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (dispatchPagination.currentPage > totalPages) dispatchPagination.currentPage = totalPages;
  if (dispatchPagination.currentPage < 1) dispatchPagination.currentPage = 1;

  const start = (dispatchPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = dispatchPagination.filtered.slice(start, end);

  renderDispatchTable(pageData);
  updateDispatchPaginationBar(total, total === 0 ? 0 : start + 1, end, dispatchPagination.currentPage, totalPages);
}

function updateDispatchPaginationBar(total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById('dispatch-pagination-info');
  if (info) {
    if (total === 0) {
      info.textContent = 'Showing 0 of 0 entries';
    } else {
      info.textContent = `Showing ${startDisplay} to ${endDisplay} of ${total} entries`;
    }
  }

  const prevBtn = document.getElementById('dispatch-btn-prev');
  const nextBtn = document.getElementById('dispatch-btn-next');
  if (prevBtn) prevBtn.disabled = (currentPage <= 1);
  if (nextBtn) nextBtn.disabled = (currentPage >= totalPages);

  const container = document.getElementById('dispatch-page-numbers');
  if (container) {
    let pagesHtml = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) pagesHtml += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      pagesHtml += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToDispatchPage(${p})">${p}</button>`;
    }
    container.innerHTML = pagesHtml;
  }

  const pagEl = document.getElementById('dispatch-pagination');
  if (pagEl) {
    pagEl.style.display = total === 0 ? 'none' : 'flex';
  }
}

function changeDispatchPageSize(val) {
  dispatchPagination.pageSize = parseInt(val, 10);
  dispatchPagination.currentPage = 1;
  renderDispatchPaginated();
}

function prevDispatchPage() {
  if (dispatchPagination.currentPage > 1) {
    dispatchPagination.currentPage--;
    renderDispatchPaginated();
  }
}

function nextDispatchPage() {
  const totalPages = Math.ceil(dispatchPagination.filtered.length / dispatchPagination.pageSize) || 1;
  if (dispatchPagination.currentPage < totalPages) {
    dispatchPagination.currentPage++;
    renderDispatchPaginated();
  }
}

function goToDispatchPage(p) {
  dispatchPagination.currentPage = p;
  renderDispatchPaginated();
}

function renderDispatchTable(data) {
  const tbody = document.getElementById('dispatch-tbody');
  const user  = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No dispatch records found.</td></tr>`;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(d => {
    const ts = d.dispatched_at_precise || d.dispatched_at;
    const dispatchedAt = ts ? new Date(ts).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) : '—';

    const dueDate = d.due_date
      ? new Date(d.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

    const returnedAt = d.returned_at
      ? new Date(d.returned_at).toLocaleString('en-PH', {
          month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      : null;

    return `
    <tr style="cursor:pointer;" onclick="openDispatchDetailModal('${d.id}')">
      <td>
        <span style="font-family:monospace;font-size:.8rem;font-weight:700;color:var(--primary);">${d.ticket_id || '—'}</span>
      </td>
      <td>
        <div class="incident-title" style="color:var(--text-main);font-weight:700;">${escHtml(d.resources?.name || '—')}</div>
        <div class="incident-desc">${TYPE_LABEL[d.resources?.type] || ''}</div>
      </td>
      <td>
        <div style="font-weight:600;font-size:.83rem;">
          ${escHtml(d.borrower_name || d.users?.full_name || '—')}
          <span style="font-size:.73rem;color:var(--primary);font-weight:700;margin-left:.3rem;">(Qty: ${d.quantity_dispatched})</span>
        </div>
        ${d.borrower_contact ? `<div style="font-size:.72rem;color:var(--text-muted);">${escHtml(d.borrower_contact)}</div>` : ''}
      </td>
      <td>
        ${returnedAt
          ? `<span class="badge badge-green">Returned</span><div style="font-size:.7rem;color:var(--text-muted);margin-top:.2rem;">${returnedAt}</div>`
          : dueDate
            ? `<span class="badge badge-orange">Out</span><div style="font-size:.7rem;color:var(--text-muted);margin-top:.2rem;">Due: ${dueDate}</div>`
            : '<span class="badge badge-orange">Out</span>'}
      </td>
      <td style="text-align:right;">
        <div class="table-actions" style="justify-content:flex-end;" onclick="event.stopPropagation()">
          <button class="action-btn action-btn-info" title="View Ticket" onclick="event.stopPropagation();openDispatchDetailModal('${d.id}')"><i data-lucide="eye"></i></button>
          ${!d.returned_at && canEdit
            ? `<button class="action-btn action-btn-success" title="Confirm Return" onclick="event.stopPropagation();returnResource('${d.id}')"><i data-lucide="corner-down-left"></i></button>`
            : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function handleDispatchDatePresetChange() {
  const preset = document.getElementById('dispatch-filter-date')?.value || '';
  const dateFromEl = document.getElementById('dispatch-date-from');
  const dateToEl   = document.getElementById('dispatch-date-to');

  if (preset === 'custom') {
    openCustomDateModal('dispatch');
    return;
  }

  if (dateFromEl) dateFromEl.value = '';
  if (dateToEl)   dateToEl.value   = '';

  const now = new Date();
  if (preset === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    if (dateFromEl) dateFromEl.value = todayStr;
    if (dateToEl)   dateToEl.value   = todayStr;
  } else if (preset === '7days') {
    const past = new Date(now.getTime() - 7 * 86400000);
    if (dateFromEl) dateFromEl.value = past.toISOString().split('T')[0];
    if (dateToEl)   dateToEl.value   = now.toISOString().split('T')[0];
  } else if (preset === '30days') {
    const past = new Date(now.getTime() - 30 * 86400000);
    if (dateFromEl) dateFromEl.value = past.toISOString().split('T')[0];
    if (dateToEl)   dateToEl.value   = now.toISOString().split('T')[0];
  }

  filterDispatch();
}

function filterDispatch() {
  const search     = (document.getElementById('dispatch-search')?.value || '').toLowerCase();
  const status     = document.getElementById('dispatch-filter-status')?.value || '';
  const dateFrom   = document.getElementById('dispatch-date-from')?.value || '';
  const dateTo     = document.getElementById('dispatch-date-to')?.value || '';
  const datePreset = document.getElementById('dispatch-filter-date')?.value || '';

  dispatchPagination.filtered = allDispatch.filter(d => {
    // Search
    if (search && !(
      (d.ticket_id || '').toLowerCase().includes(search) ||
      (d.resources?.name || '').toLowerCase().includes(search) ||
      (d.borrower_name || '').toLowerCase().includes(search) ||
      (d.purpose || '').toLowerCase().includes(search) ||
      (d.incidents?.title || '').toLowerCase().includes(search) ||
      (d.users?.full_name || '').toLowerCase().includes(search)
    )) return false;

    // Status
    if (status === 'returned' && !d.returned_at) return false;
    if (status === 'out' && d.returned_at) return false;

    // Date range (from hidden inputs)
    if (dateFrom || dateTo) {
      const dispatchedAt = new Date(d.dispatched_at_precise || d.dispatched_at);
      if (dateFrom && dispatchedAt < new Date(dateFrom)) return false;
      if (dateTo) {
        const toLimit = new Date(dateTo);
        toLimit.setDate(toLimit.getDate() + 1);
        if (dispatchedAt >= toLimit) return false;
      }
    }

    return true;
  });

  // Show/hide reset button
  const clearBtn = document.getElementById('dispatch-btn-clear');
  if (clearBtn) clearBtn.style.display = (search || status || datePreset) ? 'inline-flex' : 'none';

  dispatchPagination.currentPage = 1;
  renderDispatchPaginated();
}

function clearDispatchFilters() {
  const ids = ['dispatch-search', 'dispatch-filter-status', 'dispatch-filter-date', 'dispatch-date-from', 'dispatch-date-to'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  filterDispatch();
}

function returnResource(dispatchId) {
  confirmAction({
    title: "Mark as Returned?",
    message: "Confirm that the borrowed equipment has been returned to inventory.",
    confirmText: "Confirm Return",
    type: "primary",
    icon: "corner-down-left",
    onConfirm: async () => {
      try {
        await apiFetch(`/resources/dispatch/${dispatchId}/return`, {
          method: 'PATCH',
          body: JSON.stringify({}),
        });
      const dispatchRecord = allDispatch.find(d => d.id === dispatchId);
      addActivityLogEntry({
        resource_name: dispatchRecord?.resources?.name || 'Unknown Resource',
        resource_type: dispatchRecord?.resources?.type || 'equipment',
        event_type: 'returned',
        qty_change: dispatchRecord ? dispatchRecord.quantity_dispatched : null,
        qty_before: dispatchRecord ? dispatchRecord.quantity_dispatched * -1 : null,
        qty_after: 0,
        new_status: 'available',
        description: `Returned from ${dispatchRecord?.destination || 'deployment'}`,
        performed_by_name: dispatchRecord?.borrower_name || 'Unknown Borrower',
      });
        await loadResources();
        await loadDispatchLog();
      } catch (err) {
        showToast('Failed to return: ' + err.message, 'danger', 'Error');
      }
    },
  });
}

// ---- Dispatch Modal Wizard ----

let currentDispatchWizardStep = 1;

function setDispatchWizardStep(step) {
  currentDispatchWizardStep = step;

  for (let i = 1; i <= 2; i++) {
    const pane = document.getElementById(`dispatch-pane-${i}`);
    const indicator = document.getElementById(`dispatch-wizard-indicator-${i}`);
    const line = document.getElementById(`dispatch-wizard-line-${i}`);

    if (pane) pane.classList.toggle('active', i === step);
    if (indicator) {
      indicator.classList.toggle('active', i === step);
      indicator.classList.toggle('completed', i < step);
    }
    if (line) {
      line.classList.toggle('active', i < step);
    }
  }

  const prevBtn   = document.getElementById('dispatch-btn-prev');
  const nextBtn   = document.getElementById('dispatch-btn-next');
  const submitBtn = document.getElementById('dispatch-submit-btn');

  if (prevBtn) prevBtn.style.visibility = step === 1 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.style.display = step === 2 ? 'none' : 'inline-flex';
  if (submitBtn) submitBtn.style.display = step === 2 ? 'inline-flex' : 'none';

  if (step === 2) {
    updateDispatchTicketPreview();
  }

  lucide.createIcons();
}

function goToDispatchWizardStep(targetStep) {
  const errEl = document.getElementById('dispatch-error');
  if (errEl) errEl.style.display = 'none';

  if (targetStep < currentDispatchWizardStep) {
    setDispatchWizardStep(targetStep);
    return;
  }

  if (currentDispatchWizardStep === 1) {
    const borrowerNameEl = document.getElementById('d-borrower-name');
    const resourceIdEl   = document.getElementById('d-resource');
    const qtyEl          = document.getElementById('d-qty');
    const destinationEl  = document.getElementById('d-destination');

    const borrowerName = borrowerNameEl?.value.trim();
    const resourceId   = resourceIdEl?.value;
    const qty          = parseInt(qtyEl?.value);
    const destination  = destinationEl?.value.trim();

    let isValid = true;
    let firstInvalid = null;

    if (!borrowerName) {
      if (borrowerNameEl) borrowerNameEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = borrowerNameEl;
    }
    if (!destination) {
      if (destinationEl) destinationEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = destinationEl;
    }
    if (!resourceId) {
      if (resourceIdEl) resourceIdEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = resourceIdEl;
    }
    if (isNaN(qty) || qty < 1) {
      if (qtyEl) qtyEl.classList.add('is-invalid');
      isValid = false;
      if (!firstInvalid) firstInvalid = qtyEl;
    }

    if (!isValid) {
      if (errEl) {
        errEl.textContent = 'Please fill out all required fields highlighted in red.';
        errEl.style.display = 'block';
      }
      if (firstInvalid) firstInvalid.focus();
      return;
    }
  }

  setDispatchWizardStep(targetStep);
}

function nextDispatchWizardStep() {
  if (currentDispatchWizardStep < 2) {
    goToDispatchWizardStep(currentDispatchWizardStep + 1);
  }
}

function prevDispatchWizardStep() {
  if (currentDispatchWizardStep > 1) {
    goToDispatchWizardStep(currentDispatchWizardStep - 1);
  }
}

function updateDispatchTicketPreview() {
  const summaryBox = document.getElementById('dispatch-summary-content');
  if (!summaryBox) return;

  const borrowerName = document.getElementById('d-borrower-name')?.value.trim() || '—';
  const contact      = document.getElementById('d-borrower-contact')?.value.trim() || 'No contact provided';
  const destination  = document.getElementById('d-destination')?.value.trim() || 'No destination specified';
  const resourceId   = document.getElementById('d-resource')?.value;
  const res          = allResources.find(r => r.id === resourceId);
  const resourceTitle = res ? res.name : 'No resource selected';
  const qty          = document.getElementById('d-qty')?.value || '1';
  const dueDate      = document.getElementById('d-due-date')?.value
    ? new Date(document.getElementById('d-due-date').value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No return deadline specified';

  const purpose = document.getElementById('d-purpose')?.value.trim() || 'Pending reason entry...';
  const incSelect = document.getElementById('d-incident');
  const incidentTitle = incSelect && incSelect.selectedIndex > 0 ? incSelect.options[incSelect.selectedIndex].text : 'General DRRM Operations';

  summaryBox.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:.65rem;">
      <div>
        <div style="font-size:1.05rem;font-weight:700;color:#60a5fa;">${escHtml(borrowerName)}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;display:flex;gap:.5rem;align-items:center;">
          <span><i data-lucide="phone" style="width:12px;height:12px;"></i> ${escHtml(contact)}</span>
        </div>
      </div>
      <div style="text-align:right;background:rgba(59,130,246,0.12);padding:.35rem .75rem;border-radius:8px;border:1px solid rgba(59,130,246,0.3);">
        <span style="font-size:.7rem;color:var(--text-muted);display:block;text-transform:uppercase;font-weight:700;">Ticket Status</span>
        <strong style="font-size:.85rem;color:#60a5fa;letter-spacing:.03em;">Ready for Dispatch</strong>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);padding:.6rem .8rem;border-radius:8px;margin-bottom:.65rem;border:1px solid rgba(255,255,255,0.06);">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:.72rem;color:var(--text-muted);display:block;">Equipment Item</span>
          <strong style="font-size:.92rem;color:var(--text-main);">${escHtml(resourceTitle)}</strong>
        </div>
        <div style="text-align:right;">
          <span style="font-size:.72rem;color:var(--text-muted);display:block;">Borrow Qty</span>
          <strong style="font-size:1.1rem;color:#f59e0b;">${qty} unit(s)</strong>
        </div>
      </div>
    </div>

    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
      <strong>Destination:</strong> <span style="color:#f59e0b;">${escHtml(destination)}</span>
    </div>

    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem;">
      <strong>Purpose:</strong> <span style="color:var(--text-main);">${escHtml(purpose)}</span>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;font-size:.78rem;padding-top:.5rem;border-top:1px dashed rgba(255,255,255,0.12);color:var(--text-muted);">
      <div><i data-lucide="alert-circle" style="width:13px;height:13px;color:var(--primary);"></i> Incident: <strong>${escHtml(incidentTitle)}</strong></div>
      <div><i data-lucide="calendar" style="width:13px;height:13px;color:var(--primary);"></i> Return Due: <strong>${escHtml(dueDate)}</strong></div>
    </div>
  `;

  lucide.createIcons();
}

async function openDispatchModal() {
  await populateDispatchDropdowns();
  document.getElementById('dispatch-error').style.display = 'none';
  document.getElementById('d-resource').value         = '';
  document.getElementById('d-incident').value         = '';
  document.getElementById('d-qty').value              = '';
  document.getElementById('d-notes').value            = '';
  document.getElementById('d-borrower-name').value    = '';
  document.getElementById('d-borrower-contact').value = '';
  document.getElementById('d-destination').value      = '';
  document.getElementById('d-purpose').value          = '';
  document.getElementById('d-due-date').value         = '';
  document.getElementById('d-avail-info').textContent = '';

  setDispatchWizardStep(1);
  document.getElementById('dispatch-modal-overlay').classList.add('active');
  lucide.createIcons();
}

async function openDispatchModalFor(resourceId) {
  await openDispatchModal();
  document.getElementById('d-resource').value = resourceId;
  updateDispatchAvailable();
  updateDispatchTicketPreview();
}

async function populateDispatchDropdowns() {
  const resSelect = document.getElementById('d-resource');
  const available = allResources.filter(r => r.available_quantity > 0);
  resSelect.innerHTML = '<option value="">Select resource equipment...</option>' +
    available.map(r =>
      `<option value="${r.id}">${escHtml(r.name)} (${r.available_quantity} available)</option>`
    ).join('');

  try {
    const incidents = await apiFetch('/incidents/active');
    const incSelect = document.getElementById('d-incident');
    incSelect.innerHTML = '<option value="">— None / General Operational Use —</option>' +
      incidents.map(i =>
        `<option value="${i.id}">${escHtml(i.title)}</option>`
      ).join('');
  } catch (_) { /* optional */ }
}

function updateDispatchAvailable() {
  const id  = document.getElementById('d-resource').value;
  const res = allResources.find(r => r.id === id);
  const el  = document.getElementById('d-avail-info');
  if (res) {
    el.textContent = `${res.available_quantity} of ${res.quantity} units available in inventory`;
    document.getElementById('d-qty').max = res.available_quantity;
  } else {
    el.textContent = '';
  }
}

function closeDispatchModal() {
  document.getElementById('dispatch-modal-overlay').classList.remove('active');
  currentDispatchWizardStep = 1;
}

function closeDispatchModalOutside(e) {
  if (e.target === document.getElementById('dispatch-modal-overlay')) closeDispatchModal();
}

async function submitDispatch() {
  const errorEl = document.getElementById('dispatch-error');
  errorEl.style.display = 'none';

  const borrowerNameEl = document.getElementById('d-borrower-name');
  const resourceIdEl   = document.getElementById('d-resource');
  const qtyEl          = document.getElementById('d-qty');
  const purposeEl      = document.getElementById('d-purpose');
  const destinationEl  = document.getElementById('d-destination');

  const resourceId      = resourceIdEl ? resourceIdEl.value : '';
  const incidentId      = document.getElementById('d-incident') ? document.getElementById('d-incident').value : '';
  const qty             = qtyEl ? parseInt(qtyEl.value) : NaN;
  const borrowerName    = borrowerNameEl ? borrowerNameEl.value.trim() : '';
  const borrowerContact = document.getElementById('d-borrower-contact') ? document.getElementById('d-borrower-contact').value.trim() : '';
  const destination     = destinationEl ? destinationEl.value.trim() : '';
  const purpose         = purposeEl ? purposeEl.value.trim() : '';
  const dueDate         = document.getElementById('d-due-date') ? document.getElementById('d-due-date').value : '';
  const notes           = document.getElementById('d-notes') ? document.getElementById('d-notes').value.trim() : '';

  let isValid = true;
  let firstInvalid = null;

  if (!borrowerName) {
    if (borrowerNameEl) borrowerNameEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = borrowerNameEl;
  }
  if (!destination) {
    if (destinationEl) destinationEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = destinationEl;
  }
  if (!resourceId) {
    if (resourceIdEl) resourceIdEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = resourceIdEl;
  }
  if (isNaN(qty) || qty < 1) {
    if (qtyEl) qtyEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = qtyEl;
  }
  if (!purpose) {
    if (purposeEl) purposeEl.classList.add('is-invalid');
    isValid = false;
    if (!firstInvalid) firstInvalid = purposeEl;
  }

  if (!isValid) {
    showToast('Please fill out all required fields highlighted in red.', 'danger', 'Validation Required');
    if (firstInvalid) firstInvalid.focus();
    return;
  }

  try {
    await apiFetch('/resources/dispatch', {
      method: 'POST',
      body: JSON.stringify({
        resource_id:         resourceId,
        incident_id:         incidentId || null,
        quantity_dispatched: qty,
        borrower_name:       borrowerName,
        borrower_contact:    borrowerContact || null,
        destination:         destination || null,
        purpose:             purpose,
        due_date:            dueDate || null,
        notes:               notes || null,
      }),
    });
    addActivityLogEntry({
      resource_name: allResources.find(r => r.id === resourceId)?.name || 'Unknown Resource',
      resource_type: allResources.find(r => r.id === resourceId)?.type || 'equipment',
      event_type: 'dispatched',
      qty_change: -qty,
      qty_before: allResources.find(r => r.id === resourceId)?.available_quantity,
      qty_after: (allResources.find(r => r.id === resourceId)?.available_quantity || 0) - qty,
      new_status: 'deployed',
      description: `Dispatched to ${destination} for ${purpose}`,
      performed_by_name: borrowerName || 'Unknown Borrower',
    });
    closeDispatchModal();
    showToast('Dispatch ticket issued!', 'success', 'Equipment Dispatched');
    await loadResources();
    await loadDispatchLog();
    switchTab('dispatch');
  } catch (err) {
    showToast(err.message, 'danger', 'Dispatch Failed');
  }
}

// ---- Restock Modal ----

let restockResourceId = null;

function openRestockModal(id, name) {
  restockResourceId = id;
  document.getElementById('restock-item-name').textContent = name;
  document.getElementById('restock-qty').value = '';
  document.getElementById('restock-notes').value = '';
  document.getElementById('restock-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeRestockModal() {
  document.getElementById('restock-modal-overlay').classList.remove('active');
  restockResourceId = null;
}

function closeRestockModalOutside(e) {
  if (e.target === document.getElementById('restock-modal-overlay')) closeRestockModal();
}

async function submitRestock() {
  const addQty = parseInt(document.getElementById('restock-qty').value);
  const notes  = document.getElementById('restock-notes').value.trim();

  if (isNaN(addQty) || addQty < 1) {
    showToast('Please enter a valid restock quantity (at least 1).', 'danger', 'Invalid Quantity');
    return;
  }

  try {
    await apiFetch(`/resources/${restockResourceId}/restock`, {
      method: 'POST',
      body: JSON.stringify({ add_quantity: addQty, notes: notes || null }),
    });
    const res = allResources.find(r => r.id === restockResourceId);
    addActivityLogEntry({
      resource_name: res?.name || 'Unknown Resource',
      resource_type: res?.type || 'equipment',
      event_type: 'restocked',
      qty_change: addQty,
      qty_before: res?.available_quantity != null ? res.available_quantity : null,
      qty_after: res?.available_quantity != null ? res.available_quantity + addQty : null,
      new_status: 'available',
      description: `Restocked ${addQty} unit(s). ${notes || ''}`.trim(),
      performed_by_name: 'System',
    });
    closeRestockModal();
    showToast(`Successfully added ${addQty} unit(s) to inventory!`, "success", "Resource Restocked");
    await loadResources();
  } catch (err) {
    showToast(err.message, 'danger', 'Restock Failed');
  }
}

// ---- Maintenance Status Modal ----

let maintenanceResourceId = null;

function openMaintenanceModal(id, name, currentStatus) {
  maintenanceResourceId = id;
  document.getElementById('maint-item-name').textContent = name;
  document.getElementById('maint-status').value = currentStatus || 'available';
  document.getElementById('maint-description').value = '';
  document.getElementById('maint-error').style.display = 'none';
  updateMaintenanceBadgePreview();
  document.getElementById('maintenance-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeMaintenanceModal() {
  document.getElementById('maintenance-modal-overlay').classList.remove('active');
  maintenanceResourceId = null;
}

function closeMaintenanceModalOutside(e) {
  if (e.target === document.getElementById('maintenance-modal-overlay')) closeMaintenanceModal();
}

function updateMaintenanceBadgePreview() {
  const status = document.getElementById('maint-status')?.value;
  const previewEl = document.getElementById('maint-badge-preview');
  if (previewEl && status) {
    previewEl.innerHTML = STATUS_BADGE[status] || `<span class="badge">${status}</span>`;
  }
}

async function submitMaintenanceStatus() {
  const errorEl   = document.getElementById('maint-error');
  const status    = document.getElementById('maint-status').value;
  const desc      = document.getElementById('maint-description').value.trim();

  if (!desc) {
    document.getElementById('maint-description').classList.add('is-invalid');
    errorEl.textContent = 'Please provide a description or notes for this status change.';
    errorEl.style.display = 'block';
    return;
  }

  const btnEl = document.getElementById('maint-submit-btn');
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Saving...'; }

  try {
    await apiFetch(`/resources/${maintenanceResourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, maintenance_notes: desc }),
    });
    const idx = allResources.findIndex(r => r.id === maintenanceResourceId);
    if (idx !== -1) {
      allResources[idx].status = status;
      if (OUT_OF_SERVICE_STATUSES.includes(status)) allResources[idx].available_quantity = 0;
      else if (status === 'available') allResources[idx].available_quantity = allResources[idx].quantity;
    }
    const statusLabels = { available:'Available', maintenance:'Under Maintenance', damaged:'Damaged', unavailable:'Unavailable' };
    closeMaintenanceModal();
    showToast(`Status updated to "${statusLabels[status] || status}"`, 'success', 'Status Updated');
    renderResourceSummary(allResources);
    filterResources();
  } catch (err) {
    const idx = allResources.findIndex(r => r.id === maintenanceResourceId);
    if (idx !== -1) {
      allResources[idx].status = status;
      if (OUT_OF_SERVICE_STATUSES.includes(status)) allResources[idx].available_quantity = 0;
      else if (status === 'available') allResources[idx].available_quantity = allResources[idx].quantity;
    }
    closeMaintenanceModal();
    showToast('Status updated locally (backend offline).', 'info', 'Status Updated');
    renderResourceSummary(allResources);
    filterResources();
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i data-lucide="wrench"></i> Update Status'; lucide.createIcons(); }
  }
}

// =============================================
// MAINTENANCE TAB
// =============================================

let allMaintenanceTickets = [
  {
    id: 'seed-1',
    ticket_id: 'MNT-2026-0041',
    resource_id: null,
    resource_name: 'Motorized Rescue Flatboat B-1',
    resource_type: 'rescue_boat',
    maint_type: 'maintenance',
    status: 'maintenance',
    location: 'CDRRMO Repair Shop, Ormoc City',
    technician: 'Engr. Ramos / BFP Mechanic',
    date_out: '2026-07-25',
    date_return: '2026-08-05',
    description: 'Engine seized during flood operations. Oil leak detected in main drive shaft. Sent to CDRRMO shop for full overhaul.',
    notes: 'PO# 2026-045 issued. Under warranty.',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'seed-2',
    ticket_id: 'MNT-2026-0038',
    resource_id: null,
    resource_name: 'Heavy-Duty Diesel Generator 10kVA',
    resource_type: 'other',
    maint_type: 'damage',
    status: 'damaged',
    location: 'Barangay Linao Main Depot',
    technician: 'Supply Officer Reyes',
    date_out: '2026-07-20',
    date_return: '2026-07-30',
    description: 'Generator casing cracked after typhoon Carina. Fuel line damaged. Awaiting spare parts delivery.',
    notes: 'Reported by Capt. Rodriguez.',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'seed-3',
    ticket_id: 'MNT-2026-0035',
    resource_id: null,
    resource_name: 'High-Visibility Adult Life Vests (50 units)',
    resource_type: 'other',
    maint_type: 'inspection',
    status: 'maintenance',
    location: 'Brgy Linao Equipment Room',
    technician: 'Tanod Maintenance Team',
    date_out: '2026-07-28',
    date_return: '2026-07-31',
    description: 'Scheduled bi-annual safety inspection and strap check for all water rescue vests before typhoon season.',
    notes: '12 vests flagged for strap replacement.',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'seed-4',
    ticket_id: 'MNT-2026-0031',
    resource_id: null,
    resource_name: 'BDRRMC Emergency Patrol Utility Vehicle',
    resource_type: 'vehicle',
    maint_type: 'calibration',
    status: 'unavailable',
    location: 'Casa Dela Torre Auto Shop, Ormoc',
    technician: 'Casa Dela Torre Mechanic',
    date_out: '2026-07-15',
    date_return: '2026-08-01',
    description: 'LTO-required annual PMS (Preventive Maintenance Service). Oil change, brake inspection, tire rotation.',
    notes: 'Vehicle plate: ABC-1234. Registration renewal due Aug 2026.',
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'seed-5',
    ticket_id: 'MNT-2026-0027',
    resource_id: null,
    resource_name: 'High-Powered Stihl Chain Saw',
    resource_type: 'other',
    maint_type: 'maintenance',
    status: 'available',
    location: 'Returned to BDRRMC Depot',
    technician: 'Tanod Maintenance',
    date_out: '2026-07-10',
    date_return: '2026-07-14',
    description: 'Blade sharpening and chain lubrication after clearing fallen tree debris on Barangay Main Road post-typhoon.',
    notes: 'Resolved — returned to service on Jul 14.',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
];
let maintPagination = { currentPage: 1, pageSize: 10, filtered: [] };
let currentMaintWizardStep = 1;

const MAINT_TYPE_LABEL = {
  maintenance: 'Maintenance / Repair', damage: 'Damage Report',
  inspection: 'Inspection', calibration: 'Calibration / Service', unavailable: 'Out of Service',
};
const MAINT_TYPE_BADGE = {
  maintenance: '<span class="badge badge-yellow">Maintenance</span>',
  damage:      '<span class="badge badge-red">Damage</span>',
  inspection:  '<span class="badge badge-blue">Inspection</span>',
  calibration: '<span class="badge badge-blue">Calibration</span>',
  unavailable: '<span class="badge badge-red">Out of Service</span>',
};

function generateMaintTicketId() {
  return `MNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function renderMaintenanceTable() {
  const outOfService = allResources.filter(r => OUT_OF_SERVICE_STATUSES.includes(r.status));
  const combined = allMaintenanceTickets.length > 0
    ? allMaintenanceTickets.filter(t => t.status !== 'available')
    : outOfService.map(r => ({
        id: r.id, ticket_id: '—', resource_id: r.id,
        resource_name: r.name, resource_type: r.type,
        maint_type: 'maintenance', status: r.status,
        location: r.location || '—', technician: '—',
        date_out: null, date_return: null,
        description: r.maintenance_notes || '—',
      }));
  maintPagination.filtered = applyMaintFilters(combined);
  maintPagination.currentPage = 1;
  renderMaintPaginated();
}

function applyMaintFilters(list) {
  const search  = (document.getElementById('maint-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('maint-filter-status')?.value || '';
  const typeF   = document.getElementById('maint-filter-type')?.value || '';
  return list.filter(t => {
    if (statusF && t.status !== statusF) return false;
    if (typeF   && t.maint_type !== typeF) return false;
    if (search && ![(t.resource_name||''),(t.location||''),(t.technician||''),(t.ticket_id||'')]
      .join(' ').toLowerCase().includes(search)) return false;
    return true;
  });
}

function filterMaintenance() {
  const s = document.getElementById('maint-search')?.value || '';
  const st = document.getElementById('maint-filter-status')?.value || '';
  const tp = document.getElementById('maint-filter-type')?.value || '';
  const clearBtn = document.getElementById('maint-btn-clear');
  if (clearBtn) clearBtn.style.display = (s||st||tp) ? 'inline-flex' : 'none';
  renderMaintenanceTable();
}

function clearMaintenanceFilters() {
  ['maint-search','maint-filter-status','maint-filter-type'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  filterMaintenance();
}

function renderMaintPaginated() {
  const { filtered, currentPage, pageSize } = maintPagination;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (maintPagination.currentPage > totalPages) maintPagination.currentPage = totalPages;
  if (maintPagination.currentPage < 1) maintPagination.currentPage = 1;
  const start = (maintPagination.currentPage - 1) * pageSize;
  renderMaintTableRows(filtered.slice(start, Math.min(start + pageSize, total)));
  updateMaintPaginationBar(total, start + 1, Math.min(start + pageSize, total), maintPagination.currentPage, totalPages);
}


// ---- Util ----

function renderMaintTableRows(data) {
  const tbody = document.getElementById('maintenance-tbody');
  if (!tbody) return;
  const user = getUser();
  const canEdit = user && ['admin','officer'].includes(user.role);
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No maintenance records. Items set to maintenance, damaged, or unavailable appear here.</td></tr>`;
    lucide.createIcons(); return;
  }
  tbody.innerHTML = data.map(t => {
    const dr = t.date_return ? new Date(t.date_return).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : null;
    return `<tr style="cursor:pointer;" onclick="openMaintDetailModal('${escHtml(t.id)}')">
      <td><span style="font-family:monospace;font-size:.78rem;font-weight:700;color:#f59e0b;">${escHtml(t.ticket_id||'—')}</span></td>
      <td>
        <div class="incident-title" style="font-weight:700;">${escHtml(t.resource_name||'—')}</div>
        <div class="incident-desc">
          ${TYPE_LABEL[t.resource_type]||t.resource_type||''}
          ${t.location ? `<span style="color:var(--text-muted);margin-left:.3rem;">• ${escHtml(t.location)}</span>` : ''}
        </div>
      </td>
      <td>${MAINT_TYPE_BADGE[t.maint_type]||`<span class="badge">${t.maint_type||'—'}</span>`}</td>
      <td>
        ${STATUS_BADGE[t.status]||`<span class="badge">${t.status}</span>`}
        ${dr ? `<div style="font-size:.7rem;color:var(--text-muted);margin-top:.2rem;">Return: ${dr}</div>` : ''}
      </td>
      <td style="text-align:right;">
        <div class="table-actions" style="justify-content:flex-end;" onclick="event.stopPropagation()">
          <button class="action-btn action-btn-info" title="View Ticket" onclick="event.stopPropagation();openMaintDetailModal('${escHtml(t.id)}')"><i data-lucide="clipboard-list"></i></button>
          ${canEdit && t.status !== 'available'
            ? `<button class="action-btn action-btn-success" title="Mark Resolved" onclick="event.stopPropagation();resolveMaintenanceTicket('${escHtml(t.id)}')"><i data-lucide="check-circle"></i></button>`
            : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
  lucide.createIcons();
}

function updateMaintPaginationBar(total, s, e, cur, tot) {
  const info = document.getElementById('maint-pagination-info');
  if (info) info.textContent = total===0 ? 'No entries' : `Showing ${s} to ${e} of ${total} entries`;
  const p = document.getElementById('maint-btn-prev'), n = document.getElementById('maint-btn-next');
  if (p) p.disabled = cur<=1; if (n) n.disabled = cur>=tot;
  const c = document.getElementById('maint-page-numbers');
  if (c) { let h=''; for(let i=1;i<=tot;i++) h+=`<button class="page-btn ${i===cur?'active':''}" onclick="goToMaintPage(${i})">${i}</button>`; c.innerHTML=h; }
  const pg = document.getElementById('maint-pagination');
  if (pg) pg.style.display = total===0 ? 'none' : 'flex';
}

function changeMaintPageSize(v){maintPagination.pageSize=parseInt(v,10);maintPagination.currentPage=1;renderMaintPaginated();}
function prevMaintPage(){if(maintPagination.currentPage>1){maintPagination.currentPage--;renderMaintPaginated();}}
function nextMaintPage(){const t=Math.ceil(maintPagination.filtered.length/maintPagination.pageSize)||1;if(maintPagination.currentPage<t){maintPagination.currentPage++;renderMaintPaginated();}}
function goToMaintPage(p){maintPagination.currentPage=p;renderMaintPaginated();}

function openMaintenanceTicketModal(resourceId) {
  const sel = document.getElementById('maint-resource-select');
  if (sel) {
    sel.innerHTML = '<option value="">Select equipment...</option>' +
      allResources.map(r => `<option value="${r.id}">${escHtml(r.name)} (${r.status})</option>`).join('');
    if (resourceId) sel.value = resourceId;
  }
  ['maint-type','maint-description','maint-location','maint-technician','maint-notes','maint-date-return'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('maint-status').value = 'maintenance';
  document.getElementById('maint-summary-content').innerHTML = '';
  document.getElementById('maint-error').style.display = 'none';
  const dateOutEl = document.getElementById('maint-date-out');
  if (dateOutEl) dateOutEl.value = new Date().toISOString().split('T')[0];
  updateMaintItemInfo();
  setMaintWizardStep(1);
  document.getElementById('maintenance-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openMaintenanceModal(id, name, currentStatus) {
  openMaintenanceTicketModal(id);
  const s = document.getElementById('maint-status');
  if (s && currentStatus) s.value = currentStatus;
}

function closeMaintenanceModal() {
  document.getElementById('maintenance-modal-overlay').classList.remove('active');
  currentMaintWizardStep = 1;
}
function closeMaintenanceModalOutside(e) {
  if (e.target===document.getElementById('maintenance-modal-overlay')) closeMaintenanceModal();
}

function updateMaintItemInfo() {
  const id = document.getElementById('maint-resource-select')?.value;
  const r  = allResources.find(x=>x.id===id);
  const el = document.getElementById('maint-resource-info');
  if (el) el.innerHTML = r ? `${r.available_quantity} of ${r.quantity} available · ${STATUS_BADGE[r.status]||r.status}` : '';
  updateMaintPreview();
}

function updateMaintPreview() {
  const el = document.getElementById('maint-summary-content'); if (!el) return;
  const id=document.getElementById('maint-resource-select')?.value;
  const r=allResources.find(x=>x.id===id);
  const mt=document.getElementById('maint-type')?.value;
  const st=document.getElementById('maint-status')?.value;
  const desc=document.getElementById('maint-description')?.value||'—';
  const loc=document.getElementById('maint-location')?.value||'—';
  const tech=document.getElementById('maint-technician')?.value||'—';
  const dout=document.getElementById('maint-date-out')?.value||'—';
  const dret=document.getElementById('maint-date-return')?.value||'—';
  const notes=document.getElementById('maint-notes')?.value||'';
  el.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem .75rem;font-size:.82rem;">
    <div><span style="color:var(--text-muted);">Equipment:</span> <strong>${r?escHtml(r.name):'—'}</strong></div>
    <div><span style="color:var(--text-muted);">Issue:</span> ${MAINT_TYPE_LABEL[mt]||'—'}</div>
    <div><span style="color:var(--text-muted);">Status:</span> ${STATUS_BADGE[st]||st}</div>
    <div><span style="color:var(--text-muted);">Location:</span> ${escHtml(loc)}</div>
    <div><span style="color:var(--text-muted);">Technician:</span> ${escHtml(tech)}</div>
    <div><span style="color:var(--text-muted);">Date Out:</span> ${dout}</div>
    <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Return By:</span> ${dret}</div>
    <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Description:</span> ${escHtml(desc)}</div>
    ${notes?`<div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Notes:</span> ${escHtml(notes)}</div>`:''}
  </div>`;
  lucide.createIcons();
}

function setMaintWizardStep(step) {
  currentMaintWizardStep = step;
  ['maint-pane-1','maint-pane-2'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.classList.toggle('active',i+1===step);});
  ['maint-wizard-indicator-1','maint-wizard-indicator-2'].forEach((id,i)=>{
    const el=document.getElementById(id); if(!el)return;
    el.classList.toggle('active',i+1===step); el.classList.toggle('completed',i+1<step);
  });
  const line=document.getElementById('maint-wizard-line-1'); if(line)line.classList.toggle('active',step>1);
  const pb=document.getElementById('maint-btn-prev'),nb=document.getElementById('maint-btn-next'),sb=document.getElementById('maint-submit-btn');
  if(pb)pb.style.visibility=step>1?'visible':'hidden';
  if(nb)nb.style.display=step<2?'inline-flex':'none';
  if(sb)sb.style.display=step===2?'inline-flex':'none';
  updateMaintPreview(); lucide.createIcons();
}

function goToMaintWizardStep(step) {
  // Only allow going forward if validation passes; always allow going back
  if (step > currentMaintWizardStep) {
    nextMaintWizardStep();
  } else {
    setMaintWizardStep(step);
  }
}
function prevMaintWizardStep(){if(currentMaintWizardStep>1)setMaintWizardStep(currentMaintWizardStep-1);}

function nextMaintWizardStep() {
  const err = document.getElementById('maint-error');
  err.style.display = 'none';

  // Clear previous invalid states
  ['maint-resource-select','maint-type','maint-description'].forEach(id => {
    document.getElementById(id)?.classList.remove('is-invalid');
  });

  if (currentMaintWizardStep === 1) {
    const rid  = document.getElementById('maint-resource-select')?.value;
    const mt   = document.getElementById('maint-type')?.value;
    const desc = document.getElementById('maint-description')?.value.trim();
    let hasErr = false;

    if (!rid)  { document.getElementById('maint-resource-select').classList.add('is-invalid'); hasErr = true; }
    if (!mt)   { document.getElementById('maint-type').classList.add('is-invalid'); hasErr = true; }
    if (!desc) { document.getElementById('maint-description').classList.add('is-invalid'); hasErr = true; }

    if (hasErr) {
      showToast('Please fill in all required fields.', 'warning', 'Validation Error');
      return;
    }
    setMaintWizardStep(2);
  }
}

async function submitMaintenanceTicket() {
  const err=document.getElementById('maint-error');
  const rid=document.getElementById('maint-resource-select')?.value;
  const mt=document.getElementById('maint-type')?.value;
  const st=document.getElementById('maint-status')?.value;
  const desc=document.getElementById('maint-description')?.value.trim();
  const loc=document.getElementById('maint-location')?.value.trim();
  const tech=document.getElementById('maint-technician')?.value.trim();
  const dout=document.getElementById('maint-date-out')?.value;
  const dret=document.getElementById('maint-date-return')?.value;
  const notes=document.getElementById('maint-notes')?.value.trim();
  if (!loc) {
    document.getElementById('maint-location')?.classList.add('is-invalid');
    err.textContent = 'Please enter the location where the item is being sent.';
    err.style.display = 'block';
    return;
  }
  const btn=document.getElementById('maint-submit-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i data-lucide="loader-2"></i> Saving...';lucide.createIcons();}
  const res=allResources.find(r=>r.id===rid);
  const fullDesc=[desc,loc?`Location: ${loc}`:'',tech?`Technician: ${tech}`:'',notes].filter(Boolean).join(' | ');
  try{await apiFetch(`/resources/${rid}`,{method:'PATCH',body:JSON.stringify({status:st,maintenance_notes:fullDesc})});}catch(_){}
  const idx=allResources.findIndex(r=>r.id===rid);
  if(idx!==-1){
    allResources[idx].status=st; allResources[idx].maintenance_notes=fullDesc;
    allResources[idx].available_quantity=OUT_OF_SERVICE_STATUSES.includes(st)?0:allResources[idx].quantity;
  }
  allMaintenanceTickets.unshift({
    id:`local-${Date.now()}`,ticket_id:generateMaintTicketId(),resource_id:rid,
    resource_name:res?.name||'—',resource_type:res?.type||'—',maint_type:mt,status:st,
    location:loc,technician:tech,date_out:dout,date_return:dret,description:desc,notes,created_at:new Date().toISOString()
  });
  const labels={available:'Available',maintenance:'Under Maintenance',damaged:'Damaged',unavailable:'Unavailable'};
  closeMaintenanceModal();
  showToast(`Ticket logged. Status: ${labels[st]||st}`,'success','Ticket Created');
  renderResourceSummary(allResources); filterResources(); renderMaintenanceTable();
  if(btn){btn.disabled=false;btn.innerHTML='<i data-lucide="wrench"></i> Submit Ticket';lucide.createIcons();}
}

async function resolveMaintenanceTicket(ticketId) {
  confirmAction({title:'Mark as Resolved?',message:'Set this item back to Available?',confirmText:'Mark Available',type:'primary',icon:'check-circle',
    onConfirm:async()=>{
      const t=allMaintenanceTickets.find(x=>x.id===ticketId);
      const rid=t?.resource_id||ticketId;
      try{await apiFetch(`/resources/${rid}`,{method:'PATCH',body:JSON.stringify({status:'available',maintenance_notes:'Resolved — returned to service.'})});}catch(_){}
      const idx=allResources.findIndex(r=>r.id===rid);
      if(idx!==-1){allResources[idx].status='available';allResources[idx].available_quantity=allResources[idx].quantity;}
      if(t) t.status='available';
      showToast('Item marked as Available.','success','Resolved');
      renderResourceSummary(allResources); filterResources(); renderMaintenanceTable();
    }
  });
}

function openMaintDetailModal(ticketId) {
  const t=allMaintenanceTickets.find(x=>x.id===ticketId);
  if(!t){const r=allResources.find(x=>x.id===ticketId);if(r)openResourceDetailModal(r.id);return;}
  const dr=t.date_return?new Date(t.date_return).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'—';
  const bodyEl=document.getElementById('res-detail-body'); if(!bodyEl)return;
  document.getElementById('res-detail-title').textContent=t.resource_name||'Maintenance Ticket';
  document.getElementById('res-detail-subtitle').textContent=`Ticket ${t.ticket_id} · ${MAINT_TYPE_LABEL[t.maint_type]||t.maint_type}`;
  bodyEl.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem;">
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Issue Type</div>
        <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">${MAINT_TYPE_LABEL[t.maint_type]||'—'}</div>
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Status</div>
        ${STATUS_BADGE[t.status]||t.status}
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Return By</div>
        <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">${dr}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;">
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Sent To / Location</div>
        <div style="font-size:.85rem;font-weight:600;color:var(--text-main);">${escHtml(t.location||'—')}</div>
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Technician</div>
        <div style="font-size:.85rem;font-weight:600;color:var(--text-main);">${escHtml(t.technician||'—')}</div>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
      <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Description</div>
      <div style="font-size:.85rem;color:var(--text-main);line-height:1.5;">${escHtml(t.description||'—')}</div>
      ${t.notes?`<div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem;">${escHtml(t.notes)}</div>`:''}
    </div>`;
  document.getElementById('res-detail-actions').innerHTML = t.status!=='available'
    ? `<button class="btn btn-success btn-sm" onclick="closeResourceDetailModal();resolveMaintenanceTicket('${t.id}')"><i data-lucide="check-circle"></i> Mark Resolved</button>`
    : '';
  document.getElementById('resource-detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function updateMaintenanceBadgePreview() {
  const status=document.getElementById('maint-status')?.value;
  const el=document.getElementById('maint-badge-preview');
  if(el&&status) el.innerHTML=STATUS_BADGE[status]||`<span class="badge">${status}</span>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Global Listener to clear invalid highlight when user starts typing/selecting
document.addEventListener('input', function(e) {
  if (e.target && e.target.classList.contains('is-invalid')) {
    e.target.classList.remove('is-invalid');
  }
});
document.addEventListener('change', function(e) {
  if (e.target && e.target.classList.contains('is-invalid')) {
    e.target.classList.remove('is-invalid');
  }
});

// =============================================
// Detail View Modals (Resource, Dispatch, Linked Incident)
// =============================================

function openResourceDetailModal(id) {
  const r = allResources.find(item => item.id === id);
  if (!r) return;

  const pct = r.quantity ? Math.round((r.available_quantity / r.quantity) * 100) : 0;
  const iconName = TYPE_ICON[r.type] || 'box';
  const user = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  document.getElementById('res-detail-title').textContent = r.name;
  document.getElementById('res-detail-subtitle').textContent = `${TYPE_LABEL[r.type] || r.type}${r.property_code ? ' · ' + r.property_code : ''}${r.serial_number ? ' · S/N: ' + r.serial_number : ''}`;

  // Find dispatch history for this item
  const dispatches = allDispatch.filter(d => d.resource_id === id);

  const dispatchHistoryHtml = dispatches.length > 0
    ? dispatches.slice(0, 3).map(d => `
        <div style="padding:.65rem .9rem;background:rgba(15,23,42,0.5);border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;gap:.75rem;">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:700;font-size:.83rem;color:var(--text-main);">${escHtml(d.borrower_name || d.users?.full_name || 'Unknown Borrower')}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(d.purpose || 'No notes')}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            ${d.returned_at ? '<span class="badge badge-green">Returned</span>' : '<span class="badge badge-orange">Out</span>'}
            <div style="font-size:.68rem;color:var(--text-muted);margin-top:.2rem;">${new Date(d.created_at).toLocaleDateString('en-PH', {month:'short',day:'numeric',year:'numeric'})}</div>
          </div>
        </div>
      `).join('')
    : `<div style="font-size:.8rem;color:var(--text-muted);font-style:italic;padding:.5rem 0;">No dispatch records for this item.</div>`;

  const statusColor = { available:'var(--success)', deployed:'var(--warning)', maintenance:'#38bdf8', damaged:'var(--danger)', unavailable:'var(--danger)' };

  const body = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem;">
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Type</div>
        <div style="font-size:.88rem;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:.35rem;">
          <i data-lucide="${iconName}" style="width:14px;height:14px;color:var(--primary);flex-shrink:0;"></i>${TYPE_LABEL[r.type] || r.type}
        </div>
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Ownership</div>
        <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">${r.ownership_tier === 'private' ? 'Private Sector' : 'Barangay Inventory'}</div>
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Status</div>
        <div>${STATUS_BADGE[r.status] || `<span class="badge">${r.status}</span>`}</div>
      </div>
    </div>

    <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem 1rem;margin-bottom:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.55rem;">
        <span style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Inventory</span>
        <span style="font-size:.82rem;font-weight:800;color:${pct >= 50 ? '#34d399' : pct > 0 ? '#fb923c' : '#f87171'};">${r.available_quantity} / ${r.quantity} units &nbsp;·&nbsp; ${pct}%</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${pct >= 50 ? '#34d399' : pct > 0 ? '#fb923c' : '#f87171'};border-radius:99px;transition:width .4s ease;"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem;">
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Storage Location</div>
        <div style="font-size:.85rem;font-weight:600;color:var(--text-main);display:flex;align-items:center;gap:.35rem;">
          <i data-lucide="map-pin" style="width:13px;height:13px;color:var(--primary);flex-shrink:0;"></i>${escHtml(r.location || 'Barangay Linao DRRM Depot')}
        </div>
      </div>
      <div style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);padding:.85rem;">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem;">Hazard Tags</div>
        <div class="hazard-badge-list" style="gap:.3rem;">${renderResourceTagBadges(r)}</div>
      </div>
    </div>

    <div>
      <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">Recent Dispatch Activity</div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">${dispatchHistoryHtml}</div>
    </div>
  `;

  document.getElementById('res-detail-body').innerHTML = body;

  const actions = `
    ${canEdit ? `<button class="btn btn-outline btn-sm" onclick="closeResourceDetailModal();openRestockModal('${r.id}', '${escHtml(r.name)}')"><i data-lucide="plus-circle"></i> Restock</button>` : ''}
    ${canEdit ? `<button class="btn btn-warning btn-sm" onclick="closeResourceDetailModal();openMaintenanceTicketModal('${r.id}')"><i data-lucide="wrench"></i> Maintenance</button>` : ''}
    <button class="btn btn-primary btn-sm" onclick="closeResourceDetailModal();openDispatchModalFor('${r.id}')"><i data-lucide="send"></i> Dispatch</button>
  `;
  document.getElementById('res-detail-actions').innerHTML = actions;

  document.getElementById('resource-detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeResourceDetailModal() {
  document.getElementById('resource-detail-modal-overlay').classList.remove('active');
}

function closeResourceDetailModalOutside(e) {
  if (e.target === document.getElementById('resource-detail-modal-overlay')) closeResourceDetailModal();
}

function openDispatchDetailModal(id) {
  const d = allDispatch.find(item => item.id === id);
  if (!d) return;

  const user = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);
  const dispatchedAt = d.created_at ? new Date(d.created_at).toLocaleString('en-PH') : '—';
  const returnedAt = d.returned_at ? new Date(d.returned_at).toLocaleString('en-PH') : null;
  const dueDate = d.due_date ? new Date(d.due_date).toLocaleDateString('en-PH') : null;

  document.getElementById('disp-detail-title').textContent = `Ticket: ${d.ticket_id || 'N/A'}`;
  document.getElementById('disp-detail-subtitle').textContent = `Equipment: ${d.resources?.name || 'Item'} (${d.quantity_dispatched} units)`;

  const body = `
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;margin-bottom:1.2rem;background:rgba(15,23,42,0.4);padding:1rem;border-radius:var(--radius-md);border:1px solid var(--border-color);">
      <div>
        <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Resource Item</div>
        <div style="font-size:.88rem;font-weight:700;color:#60a5fa;">${escHtml(d.resources?.name || '—')}</div>
      </div>
      <div>
        <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Quantity Dispatched</div>
        <div style="font-size:.88rem;font-weight:700;">${d.quantity_dispatched} Units</div>
      </div>
      <div>
        <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Borrower / Recipient</div>
        <div style="font-size:.88rem;font-weight:600;">${escHtml(d.borrower_name || d.users?.full_name || '—')}</div>
        ${d.borrower_contact ? `<div style="font-size:.72rem;color:var(--text-muted);">${escHtml(d.borrower_contact)}</div>` : ''}
      </div>
      <div>
        <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Status</div>
        <div>${returnedAt ? '<span class="badge badge-green">Returned</span>' : '<span class="badge badge-orange">Out on Field</span>'}</div>
      </div>
    </div>

    <div style="margin-bottom:1.2rem;">
      <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.35rem;">Purpose &amp; Deployment Notes</div>
      <div style="font-size:.88rem;padding:.75rem;background:rgba(15,23,42,0.6);border-radius:8px;border:1px solid var(--border-color);line-height:1.5;">${escHtml(d.purpose || d.notes || 'No notes specified.')}</div>
    </div>

    ${d.incidents?.title ? `
    <div style="margin-bottom:1.2rem;padding:.75rem;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.3);border-radius:8px;cursor:pointer;" onclick="viewLinkedIncident('${d.incident_id}')">
      <div style="font-size:.68rem;font-weight:700;color:#60a5fa;text-transform:uppercase;margin-bottom:.2rem;">Linked Operation / Incident</div>
      <div style="font-size:.88rem;font-weight:700;color:#ffffff;display:flex;align-items:center;gap:.35rem;"><i data-lucide="triangle-alert" style="width:15px;height:15px;color:var(--warning);"></i> ${escHtml(d.incidents.title)} <span style="font-size:.72rem;color:#60a5fa;margin-left:auto;">View Incident Report &rarr;</span></div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;font-size:.78rem;color:var(--text-muted);">
      <div><strong style="color:var(--text-main);">Dispatched At:</strong> ${dispatchedAt}</div>
      <div><strong style="color:var(--text-main);">${returnedAt ? 'Returned At:' : 'Expected Due:'}</strong> ${returnedAt || dueDate || 'Indefinite'}</div>
    </div>
  `;

  document.getElementById('disp-detail-body').innerHTML = body;

  const actions = (!d.returned_at && canEdit) ? `
    <button class="btn btn-primary btn-sm" onclick="closeDispatchDetailModal();returnResource('${d.id}')"><i data-lucide="corner-down-left"></i> Confirm Return</button>
  ` : '';
  document.getElementById('disp-detail-actions').innerHTML = actions;

  document.getElementById('dispatch-detail-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeDispatchDetailModal() {
  document.getElementById('dispatch-detail-modal-overlay').classList.remove('active');
}

function closeDispatchDetailModalOutside(e) {
  if (e.target === document.getElementById('dispatch-detail-modal-overlay')) closeDispatchDetailModal();
}

async function viewLinkedIncident(incidentId) {
  if (!incidentId) return;
  try {
    let inc = null;
    const res = await apiFetch(`/incidents/${incidentId}`);
    inc = res;

    if (!inc) {
      showToast('Incident record not found.', 'warning', 'Unavailable');
      return;
    }

    document.getElementById('inc-detail-title').textContent = inc.title || 'Incident Report';
    document.getElementById('inc-detail-subtitle').textContent = `Category: ${inc.type || 'General'} • Severity: ${inc.severity || 'Normal'}`;

    const body = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem;background:rgba(15,23,42,0.4);padding:1rem;border-radius:var(--radius-md);border:1px solid var(--border-color);">
        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Severity</div>
          <div style="font-size:.88rem;font-weight:700;color:${inc.severity === 'high' || inc.severity === 'critical' ? 'var(--danger)' : 'var(--warning)'};text-transform:capitalize;">${inc.severity || 'Normal'}</div>
        </div>
        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Status</div>
          <div>${STATUS_BADGE[inc.status] || inc.status || 'Active'}</div>
        </div>
        <div>
          <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.2rem;">Validation</div>
          <div>${inc.validation_status || 'verified'}</div>
        </div>
      </div>

      ${inc.description ? `
      <div style="margin-bottom:1rem;">
        <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem;">Description / Remarks</div>
        <div style="font-size:.85rem;padding:.75rem;background:rgba(15,23,42,0.6);border-radius:8px;border:1px solid var(--border-color);">${escHtml(inc.description)}</div>
      </div>` : ''}

      ${inc.location_address ? `
      <div style="margin-bottom:1rem;">
        <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:.25rem;">Location</div>
        <div style="font-size:.88rem;font-weight:600;"><i data-lucide="map-pin" style="width:14px;height:14px;color:var(--primary);"></i> ${escHtml(inc.location_address)}</div>
      </div>` : ''}

      <div style="font-size:.75rem;color:var(--text-muted);">
        Reported Date: ${formatDate(inc.created_at)}
      </div>
    `;

    document.getElementById('inc-detail-body').innerHTML = body;
    document.getElementById('linked-incident-modal-overlay').classList.add('active');
    lucide.createIcons();
  } catch (err) {
    showToast('Failed to load incident details: ' + err.message, 'danger', 'Error');
  }
}

function closeLinkedIncidentModal() {
  document.getElementById('linked-incident-modal-overlay').classList.remove('active');
}

function closeLinkedIncidentModalOutside(e) {
  if (e.target === document.getElementById('linked-incident-modal-overlay')) closeLinkedIncidentModal();
}


// =============================================
// Export Functions
// =============================================

// Close export dropdown when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('export-dropdown-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const menu = document.getElementById('export-dropdown-menu');
    if (menu) menu.style.display = 'none';
  }
});

function toggleExportDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('export-dropdown-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  if (menu.style.display === 'block') lucide.createIcons();
}

// ---------- Shared helpers ----------

function _getExportRows(data) {
  return data.map(r => ({
    'Property Code':    r.property_code || '—',
    'Resource Name':    r.name,
    'Type':             TYPE_LABEL[r.type] || r.type,
    'Ownership':        r.ownership_tier === 'private' ? 'Private Sector' : 'Barangay',
    'Total Qty':        r.quantity,
    'Available Qty':    r.available_quantity,
    'Status':           r.status,
    'Hazard Tags':      getResourceHazards(r).map(h => HAZARD_CONFIG[h]?.label || h).join('; '),
    'Storage Location': r.location || '—',
    'Serial No':        r.serial_number || '—',
  }));
}

function _getActiveFilterLabel() {
  const parts = [];
  const search    = document.getElementById('res-search')?.value.trim();
  const hazard    = document.getElementById('res-filter-hazard')?.value;
  const ownership = document.getElementById('res-filter-ownership')?.value;
  const type      = document.getElementById('res-filter-type')?.value;
  const status    = document.getElementById('res-filter-status')?.value;
  if (search)    parts.push(`Search: "${search}"`);
  if (hazard)    parts.push(`Hazard: ${hazard}`);
  if (ownership) parts.push(`Tier: ${ownership}`);
  if (type)      parts.push(`Type: ${type}`);
  if (status)    parts.push(`Status: ${status}`);
  return parts.length ? parts.join(' | ') : 'All Resources';
}

// ---------- PDF Export ----------

function exportResourcesPDF() {
  if (!window.jspdf) {
    showToast('PDF library not loaded. Check internet connection.', 'danger', 'Export Failed');
    return;
  }
  const { jsPDF } = window.jspdf;
  const data = resPagination.filtered;
  if (!data.length) { showToast('No resources to export.', 'info', 'Empty'); return; }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

  // Header
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageW, 52, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Barangay DRRM — Resource Inventory Report', 36, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Barangay Linao, Ormoc City  |  Generated: ${now}`, 36, 36);
  doc.text(`Filter: ${_getActiveFilterLabel()}  |  Total Records: ${data.length}`, 36, 48);

  // Summary row
  const available   = data.filter(r => r.status === 'available').length;
  const deployed    = data.filter(r => r.status === 'deployed').length;
  const outOfSvc    = data.filter(r => ['maintenance','damaged','unavailable'].includes(r.status)).length;
  doc.setFillColor(241, 245, 249);
  doc.rect(0, 52, pageW, 24, 'F');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${data.length}   Available: ${available}   Deployed: ${deployed}   Out-of-Service: ${outOfSvc}`, 36, 67);

  // Table
  doc.autoTable({
    startY: 82,
    head: [['Property Code', 'Resource Name', 'Type', 'Tier', 'Total', 'Available', 'Status', 'Hazard Tags', 'Location']],
    body: data.map(r => [
      r.property_code || '—',
      r.name,
      TYPE_LABEL[r.type] || r.type,
      r.ownership_tier === 'private' ? 'Private' : 'Barangay',
      r.quantity,
      r.available_quantity,
      r.status,
      getResourceHazards(r).map(h => HAZARD_CONFIG[h]?.label || h).join(', '),
      r.location || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 4 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 140 },
      2: { cellWidth: 65 },
      3: { cellWidth: 55 },
      4: { cellWidth: 35, halign: 'center' },
      5: { cellWidth: 45, halign: 'center' },
      6: { cellWidth: 60 },
      7: { cellWidth: 100 },
      8: { cellWidth: 'auto' },
    },
    didDrawPage: function(d) {
      // Footer on each page
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Barangay DRRM System — Confidential  |  Page ${d.pageNumber} of ${pageCount}`,
        36, doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  const filename = `DRRM-Resources-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
  showToast(`PDF exported: ${filename}`, 'success', 'Export Complete');
}

// ---------- CSV Export ----------

function _buildCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.map(escape).join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ].join('\r\n');
}

function _downloadCSV(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportResourcesCSV() {
  const data = resPagination.filtered;
  if (!data.length) { showToast('No resources to export.', 'info', 'Empty'); return; }
  const rows = _getExportRows(data);
  const filename = `DRRM-Resources-${new Date().toISOString().slice(0,10)}.csv`;
  _downloadCSV(_buildCSV(rows), filename);
  showToast(`CSV exported: ${filename}`, 'success', 'Export Complete');
}

function exportDispatchCSV() {
  if (!allDispatch.length) { showToast('No dispatch records to export.', 'info', 'Empty'); return; }
  const rows = allDispatch.map(d => ({
    'Ticket ID':      d.ticket_id || '—',
    'Resource':       d.resources?.name || '—',
    'Type':           TYPE_LABEL[d.resources?.type] || d.resources?.type || '—',
    'Qty Dispatched': d.quantity_dispatched,
    'Borrower':       d.borrower_name || '—',
    'Contact':        d.borrower_contact || '—',
    'Destination':    d.destination || '—',
    'Purpose':        d.purpose || '—',
    'Dispatched At':  d.dispatched_at ? new Date(d.dispatched_at).toLocaleString('en-PH') : '—',
    'Due Date':       d.due_date || '—',
    'Returned At':    d.returned_at ? new Date(d.returned_at).toLocaleString('en-PH') : 'Not Returned',
    'Notes':          d.notes || '—',
  }));
  const filename = `DRRM-DispatchLog-${new Date().toISOString().slice(0,10)}.csv`;
  _downloadCSV(_buildCSV(rows), filename);
  showToast(`CSV exported: ${filename}`, 'success', 'Export Complete');
}

function exportActivityLogCSV() {
  const data = logPagination.filtered.length ? logPagination.filtered : allLogs;
  if (!data.length) { showToast('No activity log entries to export.', 'info', 'Empty'); return; }
  const rows = data.map(l => ({
    'Date/Time':      l.created_at ? new Date(l.created_at).toLocaleString('en-PH') : '—',
    'Resource Name':  l.resource_name || '—',
    'Resource Type':  TYPE_LABEL[l.resource_type] || l.resource_type || '—',
    'Event Type':     l.event_type,
    'Qty Change':     l.qty_change ?? '',
    'Qty Before':     l.qty_before ?? '',
    'Qty After':      l.qty_after ?? '',
    'Status After':   l.new_status || '—',
    'Description':    l.description || '—',
    'Performed By':   l.performed_by_name || '—',
  }));
  const filename = `DRRM-ActivityLog-${new Date().toISOString().slice(0,10)}.csv`;
  _downloadCSV(_buildCSV(rows), filename);
  showToast(`Activity log exported: ${filename}`, 'success', 'Export Complete');
}

// ---------- Excel Export ----------

function exportResourcesExcel() {
  if (!window.XLSX) {
    showToast('Excel library not loaded. Check internet connection.', 'danger', 'Export Failed');
    return;
  }
  const data = resPagination.filtered;
  if (!data.length) { showToast('No resources to export.', 'info', 'Empty'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Inventory
  const inventoryRows = _getExportRows(data);
  const wsInventory   = XLSX.utils.json_to_sheet(inventoryRows);
  // Column widths
  wsInventory['!cols'] = [
    {wch:14},{wch:42},{wch:16},{wch:14},{wch:10},{wch:12},{wch:16},{wch:40},{wch:32},{wch:20}
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventory');

  // Sheet 2: Summary stats
  const summary = [
    ['Barangay DRRM — Resource Inventory Summary'],
    [`Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}`],
    [`Filter Applied: ${_getActiveFilterLabel()}`],
    [],
    ['Metric', 'Count'],
    ['Total Resources',       data.length],
    ['Available',             data.filter(r => r.status === 'available').length],
    ['Deployed',              data.filter(r => r.status === 'deployed').length],
    ['Under Maintenance',     data.filter(r => r.status === 'maintenance').length],
    ['Damaged',               data.filter(r => r.status === 'damaged').length],
    ['Unavailable',           data.filter(r => r.status === 'unavailable').length],
    [],
    ['By Type', 'Count'],
    ...Object.entries(
      data.reduce((acc, r) => { const t = TYPE_LABEL[r.type] || r.type; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
    ),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{wch:28},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 3: Dispatch Log (if loaded)
  if (allDispatch.length) {
    const dispatchRows = allDispatch.map(d => ({
      'Ticket ID':      d.ticket_id || '—',
      'Resource':       d.resources?.name || '—',
      'Qty':            d.quantity_dispatched,
      'Borrower':       d.borrower_name || '—',
      'Contact':        d.borrower_contact || '—',
      'Destination':    d.destination || '—',
      'Purpose':        d.purpose || '—',
      'Dispatched At':  d.dispatched_at ? new Date(d.dispatched_at).toLocaleString('en-PH') : '—',
      'Due Date':       d.due_date || '—',
      'Status':         d.returned_at ? 'Returned' : 'Out',
    }));
    const wsDispatch = XLSX.utils.json_to_sheet(dispatchRows);
    wsDispatch['!cols'] = [{wch:14},{wch:36},{wch:6},{wch:22},{wch:16},{wch:28},{wch:36},{wch:20},{wch:12},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsDispatch, 'Dispatch Log');
  }

  const filename = `DRRM-Resources-${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast(`Excel exported: ${filename}`, 'success', 'Export Complete');
}

// =============================================
// Bulk CSV Import
// =============================================

const IMPORT_REQUIRED_COLS  = ['name', 'type', 'quantity'];
const IMPORT_OPTIONAL_COLS  = ['location', 'status', 'ownership_tier', 'hazard_tags', 'property_code', 'serial_number'];
const VALID_TYPES    = ['rescue_boat','ambulance','fire_truck','vehicle','medical_kit','food_pack','tent','fuel','other'];
const VALID_STATUSES = ['available','maintenance','damaged','unavailable'];

let importParsedRows = [];

function downloadImportTemplate() {
  const template = [
    {
      name: 'Inflatable Rescue Boat (Example)',
      type: 'rescue_boat',
      quantity: 2,
      location: 'Barangay Operations Center Storage',
      status: 'available',
      ownership_tier: 'barangay',
      hazard_tags: 'flooding;typhoon;search_rescue',
      property_code: 'BRG-2026-XXXX',
      serial_number: 'YAMAHA-RB-2026-001',
    },
    {
      name: 'Emergency First Aid Kit (Example)',
      type: 'medical_kit',
      quantity: 10,
      location: 'BHS Storage',
      status: 'available',
      ownership_tier: 'barangay',
      hazard_tags: 'medical;general_emergency',
      property_code: '',
      serial_number: '',
    }
  ];
  _downloadCSV(_buildCSV(template), 'DRRM-Resources-Import-Template.csv');
  showToast('Template downloaded. Fill it in and re-upload.', 'success', 'Template Ready');
}

function openImportModal() {
  resetImport();
  document.getElementById('import-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function closeImportModal() {
  document.getElementById('import-modal-overlay').classList.remove('active');
  resetImport();
}

function closeImportModalOutside(e) {
  if (e.target === document.getElementById('import-modal-overlay')) closeImportModal();
}

function resetImport() {
  importParsedRows = [];
  document.getElementById('import-step-upload').style.display  = 'block';
  document.getElementById('import-step-preview').style.display = 'none';
  document.getElementById('import-progress-wrap').style.display = 'none';
  document.getElementById('import-submit-btn').style.display   = 'none';
  document.getElementById('import-upload-error').style.display = 'none';
  const fi = document.getElementById('import-file-input');
  if (fi) fi.value = '';
}

function handleImportDrop(e) {
  e.preventDefault();
  const dropZone = document.getElementById('import-drop-zone');
  if (dropZone) {
    dropZone.style.borderColor = 'rgba(59,130,246,0.4)';
    dropZone.style.background  = 'rgba(59,130,246,0.04)';
  }
  const file = e.dataTransfer?.files?.[0];
  if (file) processImportFile(file);
}

function handleImportFileSelect(e) {
  const file = e.target.files?.[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  const errEl = document.getElementById('import-upload-error');
  errEl.style.display = 'none';

  if (!file.name.endsWith('.csv')) {
    errEl.textContent = 'Only .csv files are accepted.';
    errEl.style.display = 'block';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    errEl.textContent = 'File is too large. Maximum size is 5MB.';
    errEl.style.display = 'block';
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
    complete: function(results) {
      if (!results.data || results.data.length === 0) {
        errEl.textContent = 'The CSV file appears to be empty.';
        errEl.style.display = 'block';
        return;
      }
      // Check required columns exist
      const headers = Object.keys(results.data[0] || {});
      const missing = IMPORT_REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) {
        errEl.textContent = `Missing required columns: ${missing.join(', ')}. Download the template for the correct format.`;
        errEl.style.display = 'block';
        return;
      }
      importParsedRows = validateImportRows(results.data);
      showImportPreview(importParsedRows);
    },
    error: function(err) {
      errEl.textContent = 'Failed to parse CSV: ' + err.message;
      errEl.style.display = 'block';
    }
  });
}

function validateImportRows(rows) {
  return rows.map((row, idx) => {
    const errors = [];
    const name     = (row.name || '').trim();
    const type     = (row.type || '').trim().toLowerCase();
    const qty      = parseInt(row.quantity);
    const status   = (row.status || 'available').trim().toLowerCase();
    const tier     = (row.ownership_tier || 'barangay').trim().toLowerCase();

    if (!name)                              errors.push('Name is required');
    if (!VALID_TYPES.includes(type))        errors.push(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
    if (isNaN(qty) || qty < 1)              errors.push('Quantity must be a positive number');
    if (!VALID_STATUSES.includes(status) && status !== '')  errors.push(`Invalid status "${status}"`);

    // Parse hazard tags: semicolon or comma separated
    const hazardRaw  = (row.hazard_tags || '').trim();
    const hazardTags = hazardRaw
      ? hazardRaw.split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean)
      : ['general_emergency'];

    return {
      _rowNum:       idx + 2, // +2: 1 for header, 1 for 1-index
      _valid:        errors.length === 0,
      _errors:       errors,
      name,
      type,
      quantity:      isNaN(qty) ? 0 : qty,
      location:      (row.location || '').trim() || null,
      status:        VALID_STATUSES.includes(status) ? status : 'available',
      ownership_tier: ['barangay','private'].includes(tier) ? tier : 'barangay',
      applicable_hazards: hazardTags,
      category:      hazardTags[0] || 'general_emergency',
      property_code: (row.property_code || '').trim() || null,
      serial_number: (row.serial_number || '').trim() || null,
    };
  });
}

function showImportPreview(rows) {
  document.getElementById('import-step-upload').style.display  = 'none';
  document.getElementById('import-step-preview').style.display = 'block';

  const validCount   = rows.filter(r => r._valid).length;
  const invalidCount = rows.filter(r => !r._valid).length;

  document.getElementById('import-stats').innerHTML =
    `<span style="color:#34d399;font-weight:700;">${validCount} valid row(s)</span> ready to import` +
    (invalidCount ? ` &nbsp;|&nbsp; <span style="color:#f87171;font-weight:700;">${invalidCount} row(s) with errors</span> will be skipped` : '');

  // Header
  document.getElementById('import-preview-thead').innerHTML = `<tr>
    <th>#</th>
    <th>Name</th>
    <th>Type</th>
    <th>Qty</th>
    <th>Status</th>
    <th>Ownership</th>
    <th>Location</th>
    <th>Hazard Tags</th>
    <th>Issues</th>
  </tr>`;

  // Body
  document.getElementById('import-preview-tbody').innerHTML = rows.map(r => `
    <tr class="${r._valid ? 'import-row-valid' : 'import-row-invalid'}">
      <td style="color:var(--text-muted);">${r._rowNum}</td>
      <td style="font-weight:600;">${escHtml(r.name || '—')}</td>
      <td>${escHtml(TYPE_LABEL[r.type] || r.type || '—')}</td>
      <td>${r.quantity}</td>
      <td>${escHtml(r.status)}</td>
      <td>${escHtml(r.ownership_tier)}</td>
      <td>${escHtml(r.location || '—')}</td>
      <td style="font-size:.72rem;">${r.applicable_hazards.join(', ')}</td>
      <td style="font-size:.72rem;color:#f87171;">${r._errors.join('; ') || '✓'}</td>
    </tr>
  `).join('');

  document.getElementById('import-submit-btn').style.display = validCount > 0 ? 'inline-flex' : 'none';
  document.getElementById('import-submit-label').textContent  = `Import ${validCount} Valid Row(s)`;
}

async function runBulkImport() {
  const validRows = importParsedRows.filter(r => r._valid);
  if (!validRows.length) return;

  const submitBtn = document.getElementById('import-submit-btn');
  const progressWrap = document.getElementById('import-progress-wrap');
  const progressBar  = document.getElementById('import-progress-bar');
  const progressLabel = document.getElementById('import-progress-label');

  submitBtn.disabled = true;
  progressWrap.style.display = 'block';

  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    progressLabel.textContent = `Importing… ${i + 1} / ${validRows.length}  (${succeeded} saved, ${failed} failed)`;
    progressBar.style.width   = `${Math.round(((i + 1) / validRows.length) * 100)}%`;

    try {
      await apiFetch('/resources/', {
        method: 'POST',
        body: JSON.stringify({
          name:               row.name,
          type:               row.type,
          quantity:           row.quantity,
          location:           row.location,
          status:             row.status,
          ownership_tier:     row.ownership_tier,
          applicable_hazards: row.applicable_hazards,
          category:           row.category,
          property_code:      row.property_code,
          serial_number:      row.serial_number,
        }),
      });
      succeeded++;
    } catch (err) {
      failed++;
      console.warn(`Row ${row._rowNum} failed:`, err.message);
    }

    // Small delay to avoid rate limiting
    if (i < validRows.length - 1) await new Promise(r => setTimeout(r, 120));
  }

  progressBar.style.width   = '100%';
  progressLabel.textContent = `Done — ${succeeded} imported, ${failed} failed.`;

  if (succeeded > 0) {
    showToast(`${succeeded} resource(s) imported successfully${failed ? `, ${failed} skipped due to errors` : '!'}.`, 'success', 'Import Complete');
    await loadResources();
    if (allLogs.length) await loadResourceLogs();
  } else {
    showToast('All rows failed to import. Check console for details.', 'danger', 'Import Failed');
  }

  submitBtn.disabled = false;
  setTimeout(() => closeImportModal(), 2200);
}
