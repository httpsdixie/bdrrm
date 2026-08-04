// ===== Evacuation Center Module =====

let allCenters = [];
let filteredCenters = [];
let currentEvacPage = 1;
let evacPageSize = 6;
let editingId = null;
let occCapacity = 0;

// ---- Status helpers ----

const STATUS_BADGE = {
  available:     '<span class="badge badge-green"><i data-lucide="check-circle" style="width:11px;height:11px;margin-right:2px;"></i> Available</span>',
  near_capacity: '<span class="badge badge-yellow"><i data-lucide="alert-circle" style="width:11px;height:11px;margin-right:2px;"></i> Near Capacity</span>',
  full:          '<span class="badge badge-orange"><i data-lucide="shield-alert" style="width:11px;height:11px;margin-right:2px;"></i> Full</span>',
  closed:        '<span class="badge badge-red"><i data-lucide="x-circle" style="width:11px;height:11px;margin-right:2px;"></i> Closed</span>',
  maintenance:   '<span class="badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.3);"><i data-lucide="wrench" style="width:11px;height:11px;margin-right:2px;"></i> Maintenance</span>',
};

const STATUS_BAR_GRADIENT = {
  available:     'linear-gradient(90deg, #10b981, #34d399)',
  near_capacity: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
  full:          'linear-gradient(90deg, #ef4444, #f87171)',
  closed:        'linear-gradient(90deg, #64748b, #94a3b8)',
  maintenance:   'linear-gradient(90deg, #64748b, #94a3b8)',
};

function capacityPercent(occupancy, capacity) {
  if (!capacity) return 0;
  return Math.min(100, Math.round((occupancy / capacity) * 100));
}

// Returns the display status. No longer derived from live occupancy — use the stored status directly
function effectiveStatus(c) {
  if (!c) return 'available';
  if (c.status === 'maintenance' || c.status === 'closed') return c.status;
  return c.status || 'available';
}

// Renders a resource availability chip
function resourceChip(icon, label, available) {
  const color   = available ? '#34d399' : '#64748b';
  const bg      = available ? 'rgba(16, 185, 129, 0.14)' : 'rgba(100, 116, 139, 0.08)';
  const border  = available ? 'rgba(16, 185, 129, 0.35)' : 'rgba(100, 116, 139, 0.18)';
  const opacity = available ? '1' : '0.5';
  return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .55rem;border-radius:99px;font-size:.68rem;font-weight:700;background:${bg};border:1px solid ${border};color:${color};opacity:${opacity};">
    <i data-lucide="${icon}" style="width:11px;height:11px;"></i> ${label}
  </span>`;
}

// ---- Load & Render ----

function showEvacuationSkeletons() {
  const sumIds = ['sum-total', 'sum-available', 'sum-full', 'sum-evacuees', 'sum-capacity'];
  sumIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<span class="skeleton skeleton-stat-num"></span>';
  });

  const grid = document.getElementById('evac-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="evac-card">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title" style="width:65%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:40%;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-title" style="width:100%;height:16px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:50%;"></div>
        </div>
      </div>
      <div class="evac-card">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title" style="width:70%;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:45%;margin-bottom:12px;"></div>
          <div class="skeleton skeleton-title" style="width:100%;height:16px;margin-bottom:8px;"></div>
          <div class="skeleton skeleton-text" style="width:55%;"></div>
        </div>
      </div>`;
  }
}

async function loadCenters(btnEl) {
  const btn = btnEl || document.getElementById('refresh-btn');
  if (btn) btn.classList.add('spinning');
  try {
    allCenters = await API.get('/evacuation-centers/');
    renderSummary(allCenters);
    currentEvacPage = 1;
    renderTable(allCenters);
  } catch (err) {
    console.warn('Failed to load evacuation centers:', err);
    allCenters = [];
    renderSummary([]);
    currentEvacPage = 1;
    renderTable([]);
  } finally {
    if (btn) btn.classList.remove('spinning');
  }
}

function renderSummary(data) {
  const activeList = data.filter(c => !c.is_archived && c.status !== 'archived');
  const sumTotal = document.getElementById('sum-total');
  const sumAvail = document.getElementById('sum-available');
  const sumFull  = document.getElementById('sum-full');

  if (sumTotal) sumTotal.textContent = activeList.length;
  if (sumAvail) sumAvail.textContent = activeList.filter(c => c.status === 'available').length;
  if (sumFull)  sumFull.textContent  = activeList.filter(c => c.status === 'full').length;

  // Type breakdown chips
  const breakdown = document.getElementById('sum-type-breakdown');
  if (breakdown) {
    const typeCounts = {};
    activeList.forEach(c => {
      const t = c.type || 'Unclassified';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    if (Object.keys(typeCounts).length === 0) {
      breakdown.innerHTML = '<span style="font-size:.76rem;color:#475569;font-style:italic;">No data</span>';
    } else {
      breakdown.innerHTML = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `
          <span style="display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .6rem;border-radius:99px;font-size:.72rem;font-weight:700;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);color:#93c5fd;white-space:nowrap;">
            <span style="font-size:.85rem;font-weight:800;color:#60a5fa;">${count}</span> ${escHtml(type)}
          </span>`).join('');
    }
    if (window.lucide) lucide.createIcons();
  }
}

function renderTable(data) {
  filteredCenters = data || [];
  const tbody = document.getElementById('evac-table-tbody');
  if (!tbody) return;
  const user = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!filteredCenters.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:2.5rem 1rem;color:#94a3b8;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;">
            <i data-lucide="building-2" style="width:32px;height:32px;color:#64748b;"></i>
            <span style="font-weight:600;">No evacuation centers found</span>
          </div>
        </td>
      </tr>`;
    const infoEl = document.getElementById('evac-pagination-info');
    if (infoEl) infoEl.textContent = 'Showing 0 of 0 centers';
    const numContainer = document.getElementById('evac-page-numbers');
    if (numContainer) numContainer.innerHTML = '';
    const prevBtn = document.getElementById('evac-btn-prev');
    const nextBtn = document.getElementById('evac-btn-next');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Pagination bounds calculation
  const totalItems = filteredCenters.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / evacPageSize));
  if (currentEvacPage > totalPages) currentEvacPage = totalPages;
  if (currentEvacPage < 1) currentEvacPage = 1;

  const startIndex = (currentEvacPage - 1) * evacPageSize;
  const endIndex = Math.min(startIndex + evacPageSize, totalItems);
  const pageSlice = filteredCenters.slice(startIndex, endIndex);

  // Update pagination info & controls
  const infoEl = document.getElementById('evac-pagination-info');
  if (infoEl) infoEl.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${totalItems} entries`;

  const prevBtn = document.getElementById('evac-btn-prev');
  const nextBtn = document.getElementById('evac-btn-next');
  if (prevBtn) prevBtn.disabled = (currentEvacPage === 1);
  if (nextBtn) nextBtn.disabled = (currentEvacPage === totalPages);

  const numContainer = document.getElementById('evac-page-numbers');
  if (numContainer) {
    let pBtns = '';
    for (let p = 1; p <= totalPages; p++) {
      pBtns += `<button class="page-btn ${p === currentEvacPage ? 'active' : ''}" onclick="goToEvacPage(${p})" style="padding:.2rem .55rem;background:${p === currentEvacPage ? 'rgba(59,130,246,0.3)' : 'rgba(30,41,59,0.8)'};border:1px solid ${p === currentEvacPage ? '#3b82f6' : 'rgba(255,255,255,0.1)'};border-radius:6px;color:#f8fafc;cursor:pointer;font-weight:600;font-size:.78rem;">${p}</button>`;
    }
    numContainer.innerHTML = pBtns;
  }

  tbody.innerHTML = pageSlice.map(c => {
    // Live occupancy hidden — do not derive UI from current_occupancy
    const pct = 0;
    const effStatus = effectiveStatus(c);
    const badgeHtml = STATUS_BADGE[effStatus] || STATUS_BADGE[c.status] || `<span class="badge badge-blue">${c.status}</span>`;
    const barGradient = STATUS_BAR_GRADIENT[effStatus] || STATUS_BAR_GRADIENT.available;
    const isFull = effStatus === 'full';

    return `
    <tr onclick="openEvacCenterDetailModal('${c.id}')" style="border-bottom:1px solid rgba(255,255,255,0.06);transition:background .15s ease;cursor:pointer;" onmouseover="this.style.background='rgba(30,41,59,0.4)'" onmouseout="this.style.background='transparent'" title="Click to view full evacuation shelter profile">
      <td style="padding:.9rem 1rem;">
        <div style="display:flex;align-items:center;gap:.75rem;">
          <div style="width:38px;height:38px;border-radius:10px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center;color:#60a5fa;flex-shrink:0;">
            <i data-lucide="building-2" style="width:18px;height:18px;"></i>
          </div>
          <div>
            <div style="font-weight:700;color:var(--text-main);font-size:.92rem;display:flex;align-items:center;gap:.35rem;">
              ${escHtml(c.name)} <i data-lucide="external-link" style="width:12px;height:12px;opacity:.5;color:#60a5fa;"></i>
            </div>
            <div style="font-size:.74rem;color:#60a5fa;margin-top:.15rem;font-weight:600;display:flex;align-items:center;gap:.4rem;">
              <span style="font-family:monospace;background:rgba(59,130,246,0.12);padding:.1rem .35rem;border-radius:4px;border:1px solid rgba(59,130,246,0.25);">
                ${c.year_established ? `Est. ${escHtml(String(c.year_established))}` : 'Baseline Facility'}
              </span>
              <span style="color:var(--text-muted);font-weight:normal;">• ${escHtml(c.type || 'Purpose-Built')}</span>
            </div>
          </div>
        </div>
      </td>
      <td style="padding:.9rem 1rem;max-width:240px;">
        <div style="font-size:.82rem;color:#cbd5e1;line-height:1.3;font-weight:500;">${c.address ? escHtml(c.address) : 'Barangay Linao, Ormoc City'}</div>
        ${c.latitude && c.longitude ? `
        <div style="font-size:.72rem;color:#60a5fa;margin-top:.25rem;display:flex;align-items:center;gap:.25rem;">
          <i data-lucide="map-pin" style="width:11px;height:11px;"></i> Pin: ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}
        </div>` : ''}
      </td>
      <td style="padding:.9rem 1rem;min-width:140px;">
        <div style="font-weight:700;font-size:.85rem;color:var(--text-main);margin-bottom:.25rem;">
          <span style="color:var(--text-muted);font-size:.78rem;font-weight:500;">Capacity: ${c.capacity} Families</span>
        </div>
      </td>
      <td style="padding:.9rem 1rem;text-align:right;" onclick="event.stopPropagation()">
        <div style="display:inline-flex;gap:.4rem;align-items:center;justify-content:flex-end;">
          <button class="action-btn action-btn-primary" onclick="event.stopPropagation(); openEvacCenterDetailModal('${c.id}')" title="View Full Shelter Profile" style="width:34px;height:34px;border-radius:8px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;">
            <i data-lucide="eye" style="width:15px;height:15px;"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); openEditModal('${c.id}')" title="Edit Evacuation Center Specs" style="width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;">
            <i data-lucide="edit-2" style="width:15px;height:15px;"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); openPersonnelModal('${c.id}')" title="Camp Management Personnel Directory" style="width:34px;height:34px;border-radius:8px;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.35);color:#38bdf8;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;">
            <i data-lucide="users" style="width:15px;height:15px;"></i>
          </button>
          <button class="action-btn" onclick="event.stopPropagation(); openFacilitiesModal('${c.id}')" title="JMC2 Series 2021 Standard Camp Facilities Checklist" style="width:34px;height:34px;border-radius:8px;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.35);color:#34d399;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease;">
            <i data-lucide="check-square" style="width:15px;height:15px;"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderCards(data) {
  renderTable(data);
}

function prevEvacPage() {
  if (currentEvacPage > 1) {
    currentEvacPage--;
    renderTable(filteredCenters);
  }
}

function nextEvacPage() {
  const totalPages = Math.ceil(filteredCenters.length / evacPageSize);
  if (currentEvacPage < totalPages) {
    currentEvacPage++;
    renderTable(filteredCenters);
  }
}

function goToEvacPage(page) {
  currentEvacPage = page;
  renderTable(filteredCenters);
}

function changeEvacPageSize(size) {
  evacPageSize = parseInt(size) || 10;
  currentEvacPage = 1;
  renderTable(filteredCenters);
}

function filterCenters() {
  const searchInput = document.getElementById('search-input');
  const typeSel = document.getElementById('filter-type');

  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const type = typeSel ? typeSel.value : '';

  const filtered = allCenters.filter(c => {
    const matchSearch = !search ||
      (c.name || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search) ||
      (c.type || '').toLowerCase().includes(search);

    const matchType = !type || c.type === type;

    return matchSearch && matchType;
  });

  currentEvacPage = 1;
  renderTable(filtered);
}

function quickFilterEvacStatus(statusVal) {
  // Status filters removed from the Evacuation Centers UI. Treat quick filter as a no-op that refreshes the list.
  filterCenters();
}

function resetEvacFilters() {
  const searchInput = document.getElementById('search-input');
  const typeSel = document.getElementById('filter-type');

  if (searchInput) searchInput.value = '';
  if (typeSel) typeSel.value = '';

  filterCenters();
}

// ---- Add / Edit Modal (Part 1: Camp Management Structure) ----

let centerGisMap = null;
let centerGisMarker = null;

function toggleCenterTypeOthers() {
  const sel = document.getElementById('c-type');
  const box = document.getElementById('c-type-others-box');
  if (sel && box) {
    box.style.display = sel.value === 'Others' ? 'block' : 'none';
  }
}

function toggleCenterGisMap() {
  const box = document.getElementById('center-gis-map-box');
  if (!box) return;

  const isHidden = box.style.display === 'none' || !box.style.display;
  box.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    setTimeout(() => {
      initCenterGisMapPicker();
    }, 150);
  }
}

function initCenterGisMapPicker() {
  const container = document.getElementById('center-gis-map-picker');
  if (!container || typeof L === 'undefined') return;

  const curLat = parseFloat(document.getElementById('c-lat').value) || 11.0180;
  const curLng = parseFloat(document.getElementById('c-lng').value) || 124.5920;

  if (centerGisMap) {
    centerGisMap.remove();
    centerGisMap = null;
  }

  centerGisMap = L.map('center-gis-map-picker').setView([curLat, curLng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(centerGisMap);

  centerGisMarker = L.marker([curLat, curLng], { draggable: true }).addTo(centerGisMap);

  function updateCoords(lat, lng) {
    document.getElementById('c-lat').value = lat.toFixed(5);
    document.getElementById('c-lng').value = lng.toFixed(5);
    const badge = document.getElementById('gis-coords-badge');
    if (badge) badge.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  centerGisMarker.on('dragend', function (e) {
    const pos = e.target.getLatLng();
    updateCoords(pos.lat, pos.lng);
  });

  centerGisMap.on('click', function (e) {
    centerGisMarker.setLatLng(e.latlng);
    updateCoords(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => {
    centerGisMap.invalidateSize();
  }, 200);
}

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Evacuation Center';
  document.getElementById('modal-submit-label').textContent = 'Save Center';
  document.getElementById('center-form').reset();
  document.getElementById('center-id').value = '';
  document.getElementById('c-year-established').value = '2010';
  document.getElementById('c-floor-area').value = '100 sq. meters';
  document.getElementById('c-lot-area').value = '20X15 feet';
  document.getElementById('c-capacity').value = '4 families';
  document.getElementById('c-lat').value = '11.0180';
  document.getElementById('c-lng').value = '124.5920';
  document.getElementById('c-type').value = 'Covered Court';
  toggleCenterTypeOthers();

  const gisBox = document.getElementById('center-gis-map-box');
  if (gisBox) gisBox.style.display = 'none';

  document.getElementById('center-error').style.display = 'none';
  const occGroupEl = document.getElementById('occupancy-group'); if (occGroupEl) occGroupEl.style.display = 'none';

  // Initialize Part 2 Core Personnel Roles
  initCorePersonnelRows([]);

  goToEvacStep(1);
  document.getElementById('modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function openEditModal(centerOrId) {
  const center = typeof centerOrId === 'object' ? centerOrId : allCenters.find(c => String(c.id) === String(centerOrId));
  if (!center) return;
  editingId = center.id;
  document.getElementById('modal-title').textContent = 'Edit Evacuation Center';
  document.getElementById('modal-submit-label').textContent = 'Save Changes';
  document.getElementById('center-id').value     = center.id;
  document.getElementById('c-name').value         = center.name;
  document.getElementById('c-address').value      = center.address || '';
  document.getElementById('c-year-established').value = center.year_established || '';
  document.getElementById('c-floor-area').value   = center.floor_area_sqm || center.floor_area || '';
  document.getElementById('c-lot-area').value     = center.lot_area || '';
  document.getElementById('c-lat').value           = center.latitude;
  document.getElementById('c-lng').value           = center.longitude;
  document.getElementById('c-capacity').value      = center.capacity;
  const cOccEl = document.getElementById('c-occupancy'); if (cOccEl) cOccEl.value = center.current_occupancy || 0;
  document.getElementById('c-contact-person').value = center.contact_person || '';
  document.getElementById('c-contact-number').value = center.contact_number || '';

  // Type handling
  const knownTypes = ["Barangay Hall","Chapel/Church","Covered Court","Government Building","School","Open Space","Private Building","Purpose-Built Evacuation Center"];
  const cType = center.type || "Covered Court";
  if (knownTypes.includes(cType)) {
    document.getElementById('c-type').value = cType;
    toggleCenterTypeOthers();
  } else {
    document.getElementById('c-type').value = 'Others';
    toggleCenterTypeOthers();
    const otherInput = document.getElementById('c-type-others');
    if (otherInput) otherInput.value = cType;
  }

  const gisBox = document.getElementById('center-gis-map-box');
  if (gisBox) gisBox.style.display = 'none';

  document.getElementById('center-error').style.display = 'none';
  const occGroupEl = document.getElementById('occupancy-group'); if (occGroupEl) occGroupEl.style.display = 'block';

  // Initialize Part 2 Core Personnel Directory with existing data
  initCorePersonnelRows(center.personnel_directory || []);

  goToEvacStep(1);
  document.getElementById('modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('center-form').reset();
  if (centerGisMap) {
    centerGisMap.remove();
    centerGisMap = null;
  }
  editingId = null;
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

async function submitCenter() {
  const errorEl = document.getElementById('center-error');
  errorEl.style.display = 'none';

  const name          = document.getElementById('c-name').value.trim();
  const address       = document.getElementById('c-address').value.trim();
  const yearEst       = document.getElementById('c-year-established').value.trim() || null;
  const floorArea     = document.getElementById('c-floor-area').value.trim() || null;
  const lotArea       = document.getElementById('c-lot-area').value.trim() || null;
  const lat           = parseFloat(document.getElementById('c-lat').value);
  const lng           = parseFloat(document.getElementById('c-lng').value);
  
  const capacityRaw   = document.getElementById('c-capacity').value.trim();
  let capacity        = parseInt(capacityRaw);
  if (isNaN(capacity)) {
    const match = capacityRaw.match(/\d+/);
    capacity = match ? parseInt(match[0]) : 100;
  }

  const typeSelect    = document.getElementById('c-type').value;
  const typeOthers    = document.getElementById('c-type-others')?.value?.trim() || '';
  const finalType     = typeSelect === 'Others' ? (typeOthers || 'Others') : typeSelect;

  const occEl = document.getElementById('c-occupancy');
  const occupancy     = occEl ? (parseInt(occEl.value) || 0) : 0;
  const contactPerson = document.getElementById('c-contact-person').value.trim();
  const contactNumber = document.getElementById('c-contact-number').value.trim();
  const personnelDir  = getPersonnelDirectoryData();

  if (!name || isNaN(lat) || isNaN(lng) || capacity < 1) {
    showToast('Please fill in all required fields correctly.', 'danger', 'Validation Required');
    return;
  }

  // Occupancy is no longer editable/used by the UI. Keep capacity only.
  const existingStatus = editingId ? (allCenters.find(x => String(x.id) === String(editingId))?.status || 'available') : 'available';

  const payload = {
    name,
    address: address || null,
    year_established: yearEst,
    floor_area_sqm: floorArea,
    lot_area: lotArea,
    type: finalType,
    latitude: lat,
    longitude: lng,
    capacity,
    status: existingStatus,
    contact_person: contactPerson || null,
    contact_number: contactNumber || null,
    personnel_directory: personnelDir,
  };

  try {
    if (editingId) {
      await apiFetch(`/evacuation-centers/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showToast("Evacuation center updated!", "success", "Changes Saved");
    } else {
      await apiFetch('/evacuation-centers/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast("Evacuation center added successfully!", "success", "Center Created");
    }
    closeModal();
    await loadCenters();
  } catch (err) {
    showToast(err.message, 'danger', 'Save Failed');
  }
}

// ---- Archive ----

function archiveCenter(id) {
  confirmAction({
    title: "Archive Evacuation Center?",
    message: "Are you sure you want to archive this evacuation center record?",
    confirmText: "Archive Center",
    type: "primary",
    icon: "archive",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, { method: 'DELETE' });
        showToast("Evacuation center archived", "info", "Center Archived");
        await loadCenters();
      } catch (err) {
        const target = allCenters.find(c => c.id === id);
        if (target) {
          target.is_archived = true;
          target.status = 'archived';
          showToast("Evacuation center archived", "info", "Center Archived");
          filterCenters();
        } else {
          showToast('Archive failed: ' + err.message, "danger", "Error");
        }
      }
    }
  });
}

function unarchiveCenter(id) {
  confirmAction({
    title: "Unarchive Evacuation Center?",
    message: "Restore this evacuation center back to active status?",
    confirmText: "Restore Center",
    type: "info",
    icon: "rotate-ccw",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_archived: false, status: 'available' })
        });
        showToast("Evacuation center restored to active status", "success", "Center Restored");
        await loadCenters();
      } catch (err) {
        const target = allCenters.find(c => c.id === id);
        if (target) {
          target.is_archived = false;
          target.status = 'available';
          showToast("Evacuation center restored to active status", "success", "Center Restored");
          filterCenters();
        }
      }
    }
  });
}

// Occupancy UI and editing have been disabled. Provide no-op stubs to avoid runtime errors from callers.
function openOccupancyModal() { /* disabled */ }
function updateOccPreview() { /* disabled */ }
function closeOccupancyModal() { /* disabled */ }
function closeOccupancyModalOutside() { /* disabled */ }
async function submitOccupancy() { /* disabled */ }

// ---- Delete ----

function deleteCenter(id) {
  confirmAction({
    title: "Delete Evacuation Center?",
    message: "Are you sure you want to remove this evacuation center record? This action cannot be undone.",
    confirmText: "Delete Center",
    type: "primary",
    icon: "trash-2",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${id}`, { method: 'DELETE' });
        showToast("Evacuation center removed", "info", "Center Deleted");
        await loadCenters();
      } catch (err) {
        showToast('Delete failed: ' + err.message, "danger", "Error");
      }
    }
  });
}

// ---- Util ----

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// =============================================
// Evacuation Tracking Modal
// =============================================

let currentTrackingCenterId = null;
let currentTrackingPhase    = 'during';

function switchTrackingPhase(phase) {
  currentTrackingPhase = phase;
  ['before','during','after','history'].forEach(p => {
    const pane = document.getElementById(`phase-pane-${p}`);
    const tab  = document.getElementById(`phase-tab-${p}`);
    if (pane) pane.style.display = p === phase ? 'block' : 'none';
    if (tab)  tab.classList.toggle('active', p === phase);
  });
  const labels = {
    before:  'Phase: Before (Pre-Disaster)',
    during:  'Phase: During (Active)',
    after:   'Phase: After (Post-Disaster)',
    history: 'Historical Utilization Log',
  };
  const lbl = document.getElementById('tracking-phase-label');
  if (lbl) lbl.textContent = labels[phase] || '';

  // Show/hide save button — history tab manages its own save
  const saveBtn = document.getElementById('tracking-save-btn');
  if (saveBtn) saveBtn.style.display = phase === 'history' ? 'none' : '';

  if (phase === 'history') {
    loadHistoryLog();
  } else if (currentTrackingCenterId) {
    resetTrackingForm();
    apiFetch(`/evacuation-tracking/${currentTrackingCenterId}?phase=${phase}`)
      .then(data => { if (data && data.center_id) populateTrackingForm(data); })
      .catch(() => {});
  }
}

async function openTrackingModal(centerId, centerName, initialPhase = 'during') {
  currentTrackingCenterId = centerId;
  currentTrackingPhase    = initialPhase;

  const dirView = document.getElementById('center-directory-view');
  const wsView  = document.getElementById('center-workspace-view');
  if (dirView) dirView.style.display = 'none';
  if (wsView)  wsView.style.display  = 'block';

  const nameEl = document.getElementById('tracking-modal-center-name');
  if (nameEl) nameEl.textContent = centerName;
  
  const errEl = document.getElementById('tracking-error');
  if (errEl) errEl.style.display = 'none';

  switchTrackingPhase(initialPhase);
  resetTrackingForm();
  renderEvacManifestTable();
  try {
    const data = await apiFetch(`/evacuation-tracking/${centerId}?phase=${initialPhase}`);
    if (data && data.center_id) populateTrackingForm(data);
  } catch (_) {}

  // Scroll to top of workspace cleanly
  window.scrollTo({ top: 0, behavior: 'smooth' });
  lucide.createIcons();
}

function closeTrackingModal() {
  const dirView = document.getElementById('center-directory-view');
  const wsView  = document.getElementById('center-workspace-view');
  if (wsView)  wsView.style.display  = 'none';
  if (dirView) dirView.style.display = 'block';
  currentTrackingCenterId = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeTrackingModalOutside(e) {
  if (e.target === e.currentTarget) closeTrackingModal();
}

function resetTrackingForm() {
  // Pre-Disaster (Before) Defaults
  const preStaff = document.getElementById('pre-staff-deployed'); if (preStaff) preStaff.value = 6;
  const preLevel = document.getElementById('pre-readiness-level'); if (preLevel) preLevel.value = 'ready';
  const preChk   = document.getElementById('pre-capacity-check'); if (preChk) preChk.checked = true;
  const preInv   = document.getElementById('pre-inventory-notes'); if (preInv) preInv.value = '150 sleeping mats pre-positioned. 250 disaster food packs staged in bodega. 2 first aid kits refilled.';
  const prePos   = document.getElementById('pre-resource-position'); if (prePos) prePos.value = '1000L potable water tank filled. 5kW backup generator fueled and tested. First aid station established at West Wing.';
  const bMgr     = document.getElementById('before-camp-manager'); if (bMgr) bMgr.value = '';
  const bContact = document.getElementById('before-camp-manager-contact'); if (bContact) bContact.value = '';
  const bOff     = document.getElementById('before-assigned-official'); if (bOff) bOff.value = '';

  // During Disaster Defaults
  // Clear demographic demo fields — no static/demo numbers
  const pwd = document.getElementById('demo-pwd'); if (pwd) pwd.value = '';
  const preg = document.getElementById('demo-pregnant'); if (preg) preg.value = '';
  const child = document.getElementById('demo-children'); if (child) child.value = '';
  const youth = document.getElementById('demo-youth'); if (youth) youth.value = '';
  const senior = document.getElementById('demo-senior'); if (senior) senior.value = '';
  const ip = document.getElementById('demo-ip'); if (ip) ip.value = '';

  const rFood = document.getElementById('relief-food'); if (rFood) rFood.value = 'adequate';
  const rWater = document.getElementById('relief-water'); if (rWater) rWater.value = 'adequate';
  const rCloth = document.getElementById('relief-clothing'); if (rCloth) rCloth.value = 'limited';

  const wSys = document.getElementById('water-system'); if (wSys) wSys.value = 'operational';
  const elec = document.getElementById('electricity'); if (elec) elec.value = 'operational';
  const sig = document.getElementById('internet-signal'); if (sig) sig.value = 'good';

  const mgr = document.getElementById('camp-manager'); if (mgr) mgr.value = '';
  const mgrC = document.getElementById('camp-manager-contact'); if (mgrC) mgrC.value = '';
  const off = document.getElementById('assigned-official'); if (off) off.value = '';
  const rem = document.getElementById('occ-remarks'); if (rem) rem.value = '';

  // Post-Disaster (After) Defaults
  const pServed = document.getElementById('post-total-served'); if (pServed) pServed.value = '';
  const pCond = document.getElementById('post-center-condition'); if (pCond) pCond.value = '';
  const pDmg = document.getElementById('post-damage-notes'); if (pDmg) pDmg.value = '';
  const pUsed = document.getElementById('post-resources-used'); if (pUsed) pUsed.value = '';
  const pRep = document.getElementById('post-replenishment-needed'); if (pRep) pRep.value = '';
}

function populateTrackingForm(d) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  // Demographics
  setVal('demo-pwd', d.demo_pwd); setVal('demo-pregnant', d.demo_pregnant);
  setVal('demo-children', d.demo_children); setVal('demo-youth', d.demo_youth);
  setVal('demo-senior', d.demo_senior); setVal('demo-ip', d.demo_ip);
  // Relief
  setVal('relief-food', d.relief_food); setVal('relief-food-remarks', d.relief_food_remarks);
  setVal('relief-water', d.relief_water); setVal('relief-water-remarks', d.relief_water_remarks);
  setVal('relief-clothing', d.relief_clothing); setVal('relief-clothing-remarks', d.relief_clothing_remarks);
  // Utilities
  setVal('water-system', d.water_system); setVal('electricity', d.electricity);
  setVal('internet-signal', d.internet_signal);
  // Management
  setVal('equipment-notes', d.equipment_notes); setVal('resources-needed', d.resources_needed);
  setVal('camp-manager', d.camp_manager); setVal('camp-manager-contact', d.camp_manager_contact);
  setVal('assigned-official', d.assigned_official); setVal('occ-remarks', d.status_remarks);
  // Before fields
  setVal('pre-staff-deployed', d.pre_staff_deployed); setVal('pre-readiness-level', d.pre_readiness_level);
  setChk('pre-capacity-check', d.pre_capacity_check);
  setVal('pre-inventory-notes', d.pre_inventory_notes); setVal('pre-resource-position', d.pre_resource_position);
  setVal('before-camp-manager', d.camp_manager); setVal('before-camp-manager-contact', d.camp_manager_contact);
  setVal('before-assigned-official', d.assigned_official);
  // After fields
  setVal('post-total-served', d.post_total_served); setVal('post-center-condition', d.post_center_condition);
  setVal('post-damage-notes', d.post_damage_notes); setVal('post-resources-used', d.post_resources_used);
  setVal('post-replenishment-needed', d.post_replenishment_needed);
  // Sector breakdown
  if (d.sector_breakdown && d.sector_breakdown.length) {
    const el = document.getElementById('sector-breakdown');
    if (el) el.value = d.sector_breakdown.map(s => `${s.sector}: ${s.count}`).join('\n');
  }
}

async function submitTracking() {
  if (!currentTrackingCenterId) return;

  const errorEl = document.getElementById('tracking-error');
  errorEl.style.display = 'none';

  const getInt = id => parseInt(document.getElementById(id)?.value) || 0;
  const getStr = id => document.getElementById(id)?.value?.trim() || null;
  const getSel = id => document.getElementById(id)?.value || 'unknown';

  // Parse sector breakdown text → array
  let sectorBreakdown = [];
  const sectorRaw = getStr('sector-breakdown');
  if (sectorRaw) {
    sectorBreakdown = sectorRaw.split('\n')
      .map(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const count = parseInt(parts[1].trim());
          if (!isNaN(count)) return { sector: parts[0].trim(), count };
        }
        return null;
      })
      .filter(Boolean);
  }

  const payload = {
    center_id:        currentTrackingCenterId,
    phase:            currentTrackingPhase,
    demo_pwd:         getInt('demo-pwd'),
    demo_pregnant:    getInt('demo-pregnant'),
    demo_children:    getInt('demo-children'),
    demo_youth:       getInt('demo-youth'),
    demo_senior:      getInt('demo-senior'),
    demo_ip:          getInt('demo-ip'),
    sector_breakdown: sectorBreakdown,
    relief_food:      getSel('relief-food'),
    relief_food_remarks:    getStr('relief-food-remarks'),
    relief_water:     getSel('relief-water'),
    relief_water_remarks:   getStr('relief-water-remarks'),
    relief_clothing:  getSel('relief-clothing'),
    relief_clothing_remarks: getStr('relief-clothing-remarks'),
    water_system:     getSel('water-system'),
    electricity:      getSel('electricity'),
    internet_signal:  getSel('internet-signal'),
    equipment_notes:  getStr('equipment-notes'),
    resources_needed: getStr('resources-needed'),
    camp_manager:     currentTrackingPhase === 'before' ? getStr('before-camp-manager')     : getStr('camp-manager'),
    camp_manager_contact: currentTrackingPhase === 'before' ? getStr('before-camp-manager-contact') : getStr('camp-manager-contact'),
    assigned_official: currentTrackingPhase === 'before' ? getStr('before-assigned-official') : getStr('assigned-official'),
    // Before-phase fields
    pre_capacity_check:    document.getElementById('pre-capacity-check')?.checked || false,
    pre_staff_deployed:    getInt('pre-staff-deployed'),
    pre_readiness_level:   getSel('pre-readiness-level'),
    pre_inventory_notes:   getStr('pre-inventory-notes'),
    pre_resource_position: getStr('pre-resource-position'),
    // After-phase fields
    post_total_served:          getInt('post-total-served'),
    post_center_condition:      getSel('post-center-condition'),
    post_damage_notes:          getStr('post-damage-notes'),
    post_resources_used:        getStr('post-resources-used'),
    post_replenishment_needed:  getStr('post-replenishment-needed'),
  };

  try {
    await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    closeTrackingModal();
    showToast('Evacuation tracking record saved.', 'success', 'Tracking Saved');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// =============================================
// Family & Household Evacuee Manifest Registry
// =============================================

// No seeded demo evac manifests — start empty and rely on persisted user data or backend API
const SEED_EVAC_MANIFESTS = {};

function getEvacManifests() {
  try {
    const stored = localStorage.getItem('drrm_evac_manifests');
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  // Do not write demo/seed data into localStorage. Start with empty manifests if none persisted.
  return {};
}

function saveEvacManifests(data) {
  localStorage.setItem('drrm_evac_manifests', JSON.stringify(data));
}

function renderEvacManifestTable() {
  if (!currentTrackingCenterId) return;
  const manifests = getEvacManifests();
  let centerList = manifests[currentTrackingCenterId];
  if (!centerList || !centerList.length) {
    // No seeded evacuee manifests — leave the list empty
    centerList = [];
  }
  
  const search = (document.getElementById('fam-search-input')?.value || '').toLowerCase();
  const filtered = centerList.filter(f => 
    f.headName.toLowerCase().includes(search) || 
    f.sitio.toLowerCase().includes(search) || 
    (f.room && f.room.toLowerCase().includes(search))
  );

  // Update KPIs
  const totalFamilies = centerList.length;
  const totalIndividuals = centerList.reduce((acc, f) => acc + (parseInt(f.size) || 0), 0);
  const reliefClaimed = centerList.filter(f => f.reliefClaimed).length;
  const vulnerableCount = centerList.reduce((acc, f) => acc + (f.pwd ? 1 : 0) + (f.senior ? 1 : 0) + (f.infant ? 1 : 0), 0);

  const kpiFam = document.getElementById('manifest-kpi-families');
  const kpiInd = document.getElementById('manifest-kpi-individuals');
  const kpiRel = document.getElementById('manifest-kpi-relief-claimed');
  const kpiVul = document.getElementById('manifest-kpi-vulnerable');

  if (kpiFam) kpiFam.textContent = totalFamilies;
  if (kpiInd) kpiInd.textContent = totalIndividuals;
  if (kpiRel) kpiRel.textContent = `${reliefClaimed} / ${totalFamilies}`;
  if (kpiVul) kpiVul.textContent = vulnerableCount;

  const tbody = document.getElementById('fam-manifest-tbody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--text-muted);">No household records found in manifest.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const initials = f.headName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const vulnerBadges = [];
    if (f.pwd) vulnerBadges.push('<span class="badge" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="accessibility" style="width:10px;height:10px;"></i> PWD</span>');
    if (f.senior) vulnerBadges.push('<span class="badge" style="background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="heart" style="width:10px;height:10px;"></i> Senior</span>');
    if (f.infant) vulnerBadges.push('<span class="badge" style="background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);font-size:.65rem;padding:.15rem .4rem;"><i data-lucide="baby" style="width:10px;height:10px;"></i> Infant</span>');

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div style="width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.2);color:var(--primary-light);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.7rem;flex-shrink:0;">
              ${initials}
            </div>
            <div>
              <div style="font-weight:700;color:var(--text-main);">${escHtml(f.headName)}</div>
              <div style="font-size:.68rem;color:var(--text-muted);">${f.contact ? escHtml(f.contact) : 'No phone'}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:600;color:var(--text-main);">${escHtml(f.sitio)}</div>
          <div style="font-size:.68rem;color:var(--text-muted);">${f.room ? escHtml(f.room) : 'General Area'}</div>
        </td>
        <td>
          <span style="font-weight:700;color:var(--primary-light);">${f.size} Members</span>
        </td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:.25rem;">
            ${vulnerBadges.length ? vulnerBadges.join('') : '<span style="font-size:.7rem;color:var(--text-muted);">None</span>'}
          </div>
        </td>
        <td>
          <button class="relief-status-pill ${f.reliefClaimed ? 'claimed' : 'pending'}" onclick="toggleEvacFamilyRelief('${f.id}')">
            <i data-lucide="${f.reliefClaimed ? 'check-circle' : 'clock'}" style="width:12px;height:12px;"></i>
            ${f.reliefClaimed ? 'Issued' : 'Pending'}
          </button>
        </td>
        <td style="text-align:right;">
          <button class="action-btn action-btn-warning" title="Discharge / Exit Workflow" onclick="openDischargeModal('${f.id}', '${escHtml(f.headName)}', ${f.size}, '${f.familyCode || 'FAM-2026-101'}')">
            <i data-lucide="log-out" style="width:12px;height:12px;"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function addEvacFamilyRecord() {
  if (!currentTrackingCenterId) return;

  const headName = document.getElementById('fam-head-name')?.value?.trim();
  const sitio    = document.getElementById('fam-sitio')?.value?.trim();
  const size     = parseInt(document.getElementById('fam-size')?.value) || 1;
  const room     = document.getElementById('fam-room')?.value?.trim() || 'General Area';
  
  // Quick-Tap counters
  const infants  = parseInt(document.getElementById('fam-count-infants')?.textContent || '0');
  const children = parseInt(document.getElementById('fam-count-children')?.textContent || '0');
  const seniors  = parseInt(document.getElementById('fam-count-seniors')?.textContent || '0');
  const pwd      = parseInt(document.getElementById('fam-count-pwd')?.textContent || '0');
  const pregnant = parseInt(document.getElementById('fam-count-pregnant')?.textContent || '0');
  
  const reliefClaimed = document.getElementById('fam-relief-claimed')?.checked || false;

  if (!headName || !sitio) {
    showToast('Please enter Head of Family Name and Sitio / Purok', 'warning', 'Validation Error');
    return;
  }

  try {
    const res = await apiFetch('/evacuation-tracking/families', {
      method: 'POST',
      body: JSON.stringify({
        center_id: currentTrackingCenterId,
        head_name: headName,
        sitio_origin: sitio,
        total_members: size,
        infants_count: infants,
        children_count: children,
        seniors_count: seniors,
        pwd_count: pwd,
        pregnant_lactating_count: pregnant
      })
    });

    const manifests = getEvacManifests();
    if (!manifests[currentTrackingCenterId]) manifests[currentTrackingCenterId] = [];

    manifests[currentTrackingCenterId].unshift({
      id: res.id,
      familyCode: res.family_code,
      qrToken: res.qr_token,
      headName: res.head_name,
      sitio: res.sitio_origin,
      room: room,
      size: res.total_members,
      pwd: res.pwd_count,
      senior: res.seniors_count,
      infant: res.infants_count,
      reliefClaimed: reliefClaimed,
      registeredAt: res.checked_in_at
    });

    saveEvacManifests(manifests);

    // Reset inputs
    document.getElementById('fam-head-name').value = '';
    document.getElementById('fam-sitio').value = '';
    document.getElementById('fam-room').value = '';
    document.getElementById('fam-size').value = '4';
    ['fam-count-infants', 'fam-count-children', 'fam-count-seniors', 'fam-count-pwd', 'fam-count-pregnant'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
    updateTriageVulnerabilityIndex();

    renderEvacManifestTable();
    await loadCenters();
    showToast(`Family ${res.family_code} (${res.head_name}) profiled & registered with QR Token: ${res.qr_token}!`, 'success', 'Family Profiled');
  } catch (err) {
    showToast(err.message || 'Failed to profile family.', 'danger', 'Registration Error');
  }
}

function toggleEvacFamilyRelief(famId) {
  if (!currentTrackingCenterId) return;
  const manifests = getEvacManifests();
  const centerList = manifests[currentTrackingCenterId] || [];
  const target = centerList.find(f => f.id === famId);
  if (target) {
    target.reliefClaimed = !target.reliefClaimed;
    saveEvacManifests(manifests);
    renderEvacManifestTable();
    showToast(`Relief pack status updated for ${target.headName}`, 'info');
  }
}

function deleteEvacFamilyRecord(famId) {
  if (!currentTrackingCenterId) return;
  confirmAction({
    title: 'Discharge Family Unit',
    message: 'Are you sure you want to discharge this family unit from the evacuation manifest?',
    confirmText: 'Confirm Discharge',
    cancelText: 'Cancel',
    type: 'warning',
    icon: 'log-out',
    onConfirm: () => {
      const manifests = getEvacManifests();
      if (manifests[currentTrackingCenterId]) {
        manifests[currentTrackingCenterId] = manifests[currentTrackingCenterId].filter(f => f.id !== famId);
        saveEvacManifests(manifests);
        renderEvacManifestTable();
        showToast('Family unit discharged successfully.', 'info', 'IDP Discharged');
      }
    }
  });
}

// =============================================
// Evacuation History Log
// =============================================

const RELIABILITY_LABEL = { excellent:'Excellent', good:'Good', fair:'Fair', poor:'Poor' };
const RELIABILITY_COLOR = { excellent:'#2e7d32', good:'#1a73e8', fair:'#f9a825', poor:'#d93025' };
const HIST_TYPE_LABEL   = { typhoon:'Typhoon', flood:'Flood', earthquake:'Earthquake', other:'Other' };

async function loadHistoryLog() {
  const container = document.getElementById('history-log-list');
  if (!container || !currentTrackingCenterId) return;
  container.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.82rem;"><i data-lucide="loader" class="spin"></i> Loading...</div>`;
  lucide.createIcons();

  try {
    const data = await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history`);
    renderHistoryLog(data);
  } catch (_) {
    container.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.82rem;">Could not load history.</div>`;
  }
}

function renderHistoryLog(entries) {
  const container = document.getElementById('history-log-list');
  if (!entries || !entries.length) {
    entries = [
      {
        id: 'hist-demo-1',
        event_name: 'Super Typhoon Odette (Category 5)',
        event_type: 'typhoon',
        event_date: '2021-12-16',
        peak_occupancy: 240,
        total_served: 410,
        duration_days: 4,
        reliability_rating: 'good',
        bottlenecks: 'Drinking water refill delay on Day 2 due to flooded access roads. High evacuee influx from coastal Sitio 3.',
        structural_notes: 'Roofing and steel truss structure remained fully intact. Zero structural damage.',
        lessons_learned: 'Pre-position 2 extra 1,000L water bladders prior to Signal #3 warnings.'
      },
      {
        id: 'hist-demo-2',
        event_name: 'Monsoon Flash Flood Inundation',
        event_type: 'flood',
        event_date: '2023-01-10',
        peak_occupancy: 155,
        total_served: 230,
        duration_days: 2,
        reliability_rating: 'excellent',
        bottlenecks: 'Minor intake queue during 02:00 AM emergency arrival.',
        structural_notes: 'Perimeter drainage cleared high water volume efficiently. Facility ground floor stayed dry.',
        lessons_learned: 'Pre-assigning camp management desk staff at front entrance reduced family registration time by 50%.'
      }
    ];
  }
  container.innerHTML = entries.map(e => {
    const rColor = RELIABILITY_COLOR[e.reliability_rating] || '#1a73e8';
    const rLabel = RELIABILITY_LABEL[e.reliability_rating] || e.reliability_rating;
    return `
    <div style="border:1px solid var(--border-color);border-radius:8px;padding:.85rem 1rem;margin-bottom:.65rem;background:var(--bg-card);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.5rem;">
        <div>
          <div style="font-size:.88rem;font-weight:700;color:var(--text-main);">${escHtml(e.event_name)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">
            ${HIST_TYPE_LABEL[e.event_type]||e.event_type} · ${e.event_date} · ${e.duration_days} day${e.duration_days!==1?'s':''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="font-size:.72rem;font-weight:700;color:${rColor};background:${rColor}18;border:1px solid ${rColor}33;padding:.15rem .5rem;border-radius:99px;">${rLabel}</span>
          <button class="action-btn action-btn-danger" title="Delete" onclick="deleteHistoryLog('${e.id}')" style="padding:.25rem;">
            <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
          </button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.4rem;margin-bottom:.5rem;">
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Peak Occupancy</div>
          <div style="font-weight:700;color:var(--text-main);">${e.peak_occupancy}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Total Served</div>
          <div style="font-weight:700;color:var(--text-main);">${e.total_served}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:.4rem .6rem;font-size:.75rem;">
          <div style="color:var(--text-muted);font-size:.65rem;text-transform:uppercase;font-weight:700;">Duration</div>
          <div style="font-weight:700;color:var(--text-main);">${e.duration_days}d</div>
        </div>
      </div>
      ${e.bottlenecks ? `<div style="font-size:.75rem;margin-bottom:.3rem;"><span style="color:var(--text-muted);font-weight:700;">Bottlenecks:</span> ${escHtml(e.bottlenecks)}</div>` : ''}
      ${e.structural_notes ? `<div style="font-size:.75rem;margin-bottom:.3rem;"><span style="color:var(--text-muted);font-weight:700;">Structure:</span> ${escHtml(e.structural_notes)}</div>` : ''}
      ${e.lessons_learned ? `<div style="font-size:.75rem;padding:.35rem .6rem;background:rgba(59,130,246,0.07);border-radius:6px;border:1px solid rgba(59,130,246,0.2);"><span style="color:#60a5fa;font-weight:700;">Lessons:</span> ${escHtml(e.lessons_learned)}</div>` : ''}
    </div>`;
  }).join('');
  lucide.createIcons();
}

async function submitHistoryLog() {
  const name     = document.getElementById('hist-event-name')?.value.trim();
  const type     = document.getElementById('hist-event-type')?.value;
  const date     = document.getElementById('hist-event-date')?.value;
  if (!name || !date) { showToast('Event name and date are required.', 'warning', 'History Log'); return; }

  const payload = {
    event_name:        name,
    event_type:        type,
    event_date:        date,
    peak_occupancy:    parseInt(document.getElementById('hist-peak-occ')?.value)    || 0,
    total_served:      parseInt(document.getElementById('hist-total-served')?.value) || 0,
    duration_days:     parseInt(document.getElementById('hist-duration')?.value)     || 1,
    reliability_rating: document.getElementById('hist-reliability')?.value || 'good',
    bottlenecks:       document.getElementById('hist-bottlenecks')?.value.trim() || null,
    structural_notes:  document.getElementById('hist-structural')?.value.trim()  || null,
    lessons_learned:   document.getElementById('hist-lessons')?.value.trim()     || null,
  };

  try {
    await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history`, {
      method: 'POST', body: JSON.stringify(payload),
    });
    // Clear form
    ['hist-event-name','hist-bottlenecks','hist-structural','hist-lessons'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['hist-peak-occ','hist-total-served'].forEach(id => { const el = document.getElementById(id); if (el) el.value = 0; });
    document.getElementById('hist-duration').value = 1;
    showToast('History log entry saved.', 'success', 'History Saved');
    loadHistoryLog();
  } catch (err) {
    showToast('Failed: ' + err.message, 'danger', 'Error');
  }
}

async function deleteHistoryLog(logId) {
  confirmAction({
    title: 'Delete History Entry?',
    message: 'Remove this historical log entry permanently?',
    confirmText: 'Delete',
    type: 'danger',
    icon: 'trash-2',
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-tracking/${currentTrackingCenterId}/history/${logId}`, { method: 'DELETE' });
        showToast('Entry deleted.', 'info', 'Deleted');
        loadHistoryLog();
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'danger', 'Error');
      }
    }
  });
}

// =============================================
// Resource Optimization Engine
// Evaluates center deficits and auto-recommends
// supplies to procure or ration
// =============================================

function computeResourceRecommendations(centerId) {
  const center   = allCenters.find(c => c.id === centerId);
  if (!center) return [];

  // Live occupancy is not used — recommendations are capacity/status-driven only
  const pct = 0;
  const recs = [];

  // Read current form state (During tab)
  const getSelVal = id => document.getElementById(id)?.value || 'unknown';
  const getIntVal = id => parseInt(document.getElementById(id)?.value) || 0;

  const foodStatus    = getSelVal('relief-food');
  const waterStatus   = getSelVal('relief-water');
  const clothingStatus= getSelVal('relief-clothing');
  const waterSystem   = getSelVal('water-system');
  const elecStatus    = getSelVal('electricity');
  const internet      = getSelVal('internet-signal');
  const pwd           = getIntVal('demo-pwd');
  const pregnant      = getIntVal('demo-pregnant');
  const senior        = getIntVal('demo-senior');
  const children      = getIntVal('demo-children');

  // Occupancy tracking removed from UI — skip occupancy-based recommendations
  // Recommendations will be based on reported supplies, utilities, and manual status assessments.

  // Relief supply
  if (foodStatus === 'none') {
    recs.push({ priority:'critical', icon:'package', item:'Food Packs (Emergency Rations)', reason:'No food supply reported — immediate procurement required' });
  } else if (foodStatus === 'limited') {
    recs.push({ priority:'high', icon:'package', item:'Food Packs (Restock)', reason:'Food supply limited — replenish to cover 3-day minimum' });
  }

  if (waterStatus === 'none') {
    recs.push({ priority:'critical', icon:'droplet', item:'Potable Water / Water Tanker', reason:'No water supply — request LWUA tanker immediately' });
  } else if (waterStatus === 'limited') {
    recs.push({ priority:'high', icon:'droplet', item:'Water Containers / Tanker Refill', reason:'Water supply limited — pre-position reserve containers' });
  }

  if (clothingStatus === 'none' || clothingStatus === 'limited') {
    recs.push({ priority:'medium', icon:'shirt', item:'Clothing / Blankets', reason:'Clothing stock is ' + clothingStatus + ' — coordinate with DSWD for augmentation' });
  }

  // Utilities
  if (waterSystem === 'disrupted' || waterSystem === 'unavailable') {
    recs.push({ priority:'high', icon:'wrench', item:'Water System Repair / Alternative Supply', reason:'Community water system disrupted — deploy emergency water source' });
  }
  if (elecStatus === 'unavailable') {
    recs.push({ priority:'high', icon:'zap', item:'Portable Generator + Fuel', reason:'No electricity — procure generator for lighting and medical equipment' });
  } else if (elecStatus === 'generator') {
    recs.push({ priority:'medium', icon:'fuel', item:'Generator Fuel Reserve', reason:'Running on generator — ensure 72-hour fuel supply' });
  }
  if (internet === 'none' || internet === 'weak') {
    recs.push({ priority:'low', icon:'wifi', item:'Portable WiFi / Signal Booster', reason:'Poor connectivity — coordinate with telecom for temporary signal' });
  }

  // Sanitation
  if (!center.has_sanitation) {
    recs.push({ priority:'high', icon:'bath', item:'Portable Toilets / Sanitation Kits', reason:'No sanitation facility listed — deploy portable units per 20 evacuees' });
  }

  // Medical / special needs
  if (pwd > 0 || pregnant > 0 || senior > 0) {
    recs.push({ priority:'high', icon:'stethoscope', item:'Medical Personnel + First Aid Supplies', reason:`${pwd + pregnant + senior} high-needs evacuees (PWD/pregnant/senior) — medical volunteer required` });
  }
  if (pregnant > 0) {
    recs.push({ priority:'high', icon:'heart-pulse', item:'Maternal Care Supplies', reason:`${pregnant} pregnant evacuee${pregnant>1?'s':''} — OB/midwife and maternal kit needed` });
  }
  if (children > 0) {
    recs.push({ priority:'medium', icon:'baby', item:'Child-Friendly Supplies & Space', reason:`${children} children — allocate child-safe area, toys, and child-sized clothing` });
  }

  // First aid
  if (!center.has_first_aid) {
    recs.push({ priority:'high', icon:'stethoscope', item:'First Aid Kit / Medical Supplies', reason:'No first aid resources recorded — procure basic trauma kit' });
  }

  // Sort: critical first, then high, medium, low
  const ORDER = { critical:0, high:1, medium:2, low:3 };
  recs.sort((a,b) => (ORDER[a.priority]||9) - (ORDER[b.priority]||9));

  return recs;
}

function renderResourceRecommendations() {
  if (!currentTrackingCenterId) return;
  const recs = computeResourceRecommendations(currentTrackingCenterId);
  const container = document.getElementById('resource-recs-container');
  if (!container) return;

  if (!recs.length) {
    container.innerHTML = `<div style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.8rem;"><i data-lucide="check-circle" style="color:var(--success);width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> No critical deficits detected based on current data.</div>`;
    lucide.createIcons();
    return;
  }

  const PRIORITY_COLOR = { critical:'#d93025', high:'#e65100', medium:'#f9a825', low:'#1a73e8' };
  const PRIORITY_BG    = { critical:'rgba(217,48,37,.1)', high:'rgba(230,81,0,.1)', medium:'rgba(249,168,37,.1)', low:'rgba(26,115,232,.1)' };

  container.innerHTML = recs.map(r => `
    <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .75rem;border-radius:7px;background:${PRIORITY_BG[r.priority]};border:1px solid ${PRIORITY_COLOR[r.priority]}33;margin-bottom:.4rem;">
      <i data-lucide="${r.icon}" style="width:16px;height:16px;color:${PRIORITY_COLOR[r.priority]};margin-top:2px;flex-shrink:0;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-size:.8rem;font-weight:700;color:var(--text-main);">${r.item}
          <span style="font-size:.65rem;font-weight:800;text-transform:uppercase;color:${PRIORITY_COLOR[r.priority]};margin-left:.35rem;padding:.08rem .35rem;border-radius:4px;background:${PRIORITY_COLOR[r.priority]}18;">${r.priority}</span>
        </div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">${r.reason}</div>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

// =============================================
// Step Wizard Controller (Part 1 & Part 2)
// =============================================

let currentEvacStep = 1;

function goToEvacStep(step) {
  currentEvacStep = 1;
  const pane1 = document.getElementById('evac-wizard-pane-1');
  const pane2 = document.getElementById('evac-wizard-pane-2');
  const btnSubmit = document.getElementById('evac-btn-submit');

  if (pane1) pane1.style.display = 'block';
  if (pane2) pane2.style.display = 'none';
  if (btnSubmit) btnSubmit.style.display = 'inline-flex';

  if (window.lucide) lucide.createIcons();
}

// =============================================
// CAMP MANAGEMENT PERSONNEL DIRECTORY (Batched Roles)
// =============================================

const CORE_CAMP_ROLES_BATCH_1 = [
  "LGU Camp Coordinator",
  "EC Camp Manager",
  "Assistant Camp Manager"
];

const CORE_CAMP_ROLES_BATCH_2 = [
  "Administrative/Records Officer",
  "Accommodation and Maintenance Officer",
  "Food and Non-Food Item Officer",
  "Safety and Public Safety Officer",
  "Education, Sports, and Recreation Officer",
  "Logistics Officer"
];

const CORE_CAMP_ROLES_BATCH_3 = [
  "WASH Officer",
  "Medical Officer",
  "MHPSS Officer",
  "Nutrition Officer"
];

const ALL_CORE_CAMP_ROLES = [
  ...CORE_CAMP_ROLES_BATCH_1,
  ...CORE_CAMP_ROLES_BATCH_2,
  ...CORE_CAMP_ROLES_BATCH_3
];

const CORE_CAMP_ROLES = ALL_CORE_CAMP_ROLES;

let currentPersonnelCenterId = null;

function parseNameParts(p = {}) {
  if (p.fn || p.first_name || p.ln || p.last_name) {
    return {
      fn: p.fn || p.first_name || '',
      mn: p.mn || p.middle_name || '',
      ln: p.ln || p.last_name || '',
      suf: p.suf || p.suffix || ''
    };
  }
  const nameStr = (p.name || '').trim();
  if (!nameStr) return { fn: '', mn: '', ln: '', suf: '' };
  
  const parts = nameStr.split(/\s+/);
  if (parts.length === 1) return { fn: parts[0], mn: '', ln: '', suf: '' };
  if (parts.length === 2) return { fn: parts[0], mn: '', ln: parts[1], suf: '' };
  if (parts.length === 3) return { fn: parts[0], mn: parts[1], ln: parts[2], suf: '' };
  
  const possibleSuf = parts[parts.length - 1];
  const isSuf = /^(Jr\.?|Sr\.?|I|II|III|IV|V|MD|RN|Engr\.?|RND|RPm)$/i.test(possibleSuf);
  if (isSuf) {
    return {
      fn: parts[0],
      mn: parts.slice(1, -2).join(' '),
      ln: parts[parts.length - 2],
      suf: possibleSuf
    };
  }
  return {
    fn: parts[0],
    mn: parts.slice(1, -1).join(' '),
    ln: parts[parts.length - 1],
    suf: ''
  };
}

function openPersonnelModal(centerOrId) {
  const center = typeof centerOrId === 'object' ? centerOrId : allCenters.find(c => String(c.id) === String(centerOrId));
  if (!center) return;

  currentPersonnelCenterId = center.id;
  const pmIdEl = document.getElementById('pm-center-id');
  if (pmIdEl) pmIdEl.value = center.id;
  
  const nameEl = document.getElementById('personnel-modal-center-name');
  if (nameEl) nameEl.textContent = `${center.name} — Camp Management Personnel`;

  populatePersonnelBatchTables(center.personnel_directory || []);

  const overlay = document.getElementById('personnel-modal-overlay');
  if (overlay) overlay.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closePersonnelModal() {
  const overlay = document.getElementById('personnel-modal-overlay');
  if (overlay) overlay.classList.remove('active');
  currentPersonnelCenterId = null;
}

function closePersonnelModalOutside(e) {
  if (e.target === document.getElementById('personnel-modal-overlay')) closePersonnelModal();
}

function renderBatchPersonnelRow(tbody, role, pData = {}, isCustom = false) {
  const nameParts = parseNameParts(pData);
  let desigOffice = pData.designation || '';
  if (pData.office && !desigOffice.includes(pData.office)) {
    desigOffice = desigOffice ? `${desigOffice} (${pData.office})` : pData.office;
  }
  const contact = pData.contact || pData.contact_number || '';

  const tr = document.createElement('tr');
  tr.className = 'personnel-row';
  tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

  const inputStyle = `width:100%;padding:.35rem .45rem;font-size:.76rem;background:rgba(15,23,42,0.95);border:1px solid rgba(255,255,255,0.22);color:#ffffff;border-radius:6px;box-sizing:border-box;`;

  const roleHTML = isCustom
    ? `<input type="text" class="p-role p-custom-role" value="${escHtml(role)}" placeholder="Custom assignment/role..." style="${inputStyle}background:rgba(15,23,42,0.95);border-color:rgba(56,189,248,0.5);color:#f8fafc;font-weight:600;" />`
    : `<input type="text" class="p-role" value="${escHtml(role)}" readonly style="${inputStyle}background:rgba(30,41,59,0.95);border-color:rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;" />`;

  if (isCustom) {
    tr.innerHTML = `
      <td style="padding:.45rem .35rem;">${roleHTML}</td>
      <td style="padding:.45rem .35rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 48px;gap:.25rem;">
          <input type="text" class="p-fn" placeholder="First" value="${escHtml(nameParts.fn)}" style="${inputStyle}" />
          <input type="text" class="p-mn" placeholder="Middle" value="${escHtml(nameParts.mn)}" style="${inputStyle}" />
          <input type="text" class="p-ln" placeholder="Last" value="${escHtml(nameParts.ln)}" style="${inputStyle}" />
          <input type="text" class="p-suf" placeholder="Suf" value="${escHtml(nameParts.suf)}" style="${inputStyle}" />
        </div>
      </td>
      <td style="padding:.45rem .35rem;">
        <input type="text" class="p-designation" placeholder="Designation / Office..." value="${escHtml(desigOffice)}" style="${inputStyle}" />
      </td>
      <td style="padding:.45rem .35rem;">
        <input type="text" class="p-contact" placeholder="09XX-XXX-XXXX" value="${escHtml(contact)}" style="${inputStyle}" />
      </td>
      <td style="padding:.45rem .2rem;text-align:center;">
        <button type="button" class="btn btn-outline-sm danger" onclick="removePersonnelRow(this)" title="Remove Personnel Row" style="padding:.2rem .4rem;color:#f87171;border-color:rgba(239,68,68,0.3);"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
      </td>
    `;
  } else {
    tr.innerHTML = `
      <td style="padding:.45rem .35rem;">${roleHTML}</td>
      <td style="padding:.45rem .35rem;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 48px;gap:.25rem;">
          <input type="text" class="p-fn" placeholder="First" value="${escHtml(nameParts.fn)}" style="${inputStyle}" />
          <input type="text" class="p-mn" placeholder="Middle" value="${escHtml(nameParts.mn)}" style="${inputStyle}" />
          <input type="text" class="p-ln" placeholder="Last" value="${escHtml(nameParts.ln)}" style="${inputStyle}" />
          <input type="text" class="p-suf" placeholder="Suf" value="${escHtml(nameParts.suf)}" style="${inputStyle}" />
        </div>
      </td>
      <td style="padding:.45rem .35rem;">
        <input type="text" class="p-designation" placeholder="Designation / Office..." value="${escHtml(desigOffice)}" style="${inputStyle}" />
      </td>
      <td style="padding:.45rem .35rem;">
        <input type="text" class="p-contact" placeholder="09XX-XXX-XXXX" value="${escHtml(contact)}" style="${inputStyle}" />
      </td>
    `;
  }

  tbody.appendChild(tr);
}

function populatePersonnelBatchTables(existingData = []) {
  const t1 = document.getElementById('batch-1-tbody');
  const t2 = document.getElementById('batch-2-tbody');
  const t3 = document.getElementById('batch-3-tbody');
  const tc = document.getElementById('batch-custom-tbody');

  if (t1) t1.innerHTML = '';
  if (t2) t2.innerHTML = '';
  if (t3) t3.innerHTML = '';
  if (tc) tc.innerHTML = '';

  const existingMap = {};
  existingData.forEach(p => {
    if (p.role) existingMap[p.role] = p;
  });

  // Part 1: Executive & Camp Management Team
  if (t1) {
    CORE_CAMP_ROLES_BATCH_1.forEach(role => {
      renderBatchPersonnelRow(t1, role, existingMap[role] || {}, false);
    });
  }

  // Part 2: Administrative & Operational Officers
  if (t2) {
    CORE_CAMP_ROLES_BATCH_2.forEach(role => {
      renderBatchPersonnelRow(t2, role, existingMap[role] || {}, false);
    });
  }

  // Part 3: Health Team Sub-roles
  if (t3) {
    CORE_CAMP_ROLES_BATCH_3.forEach(role => {
      renderBatchPersonnelRow(t3, role, existingMap[role] || {}, false);
    });
  }

  // Part 4: Custom Personnel
  if (tc) {
    existingData.forEach(p => {
      if (p.role && !ALL_CORE_CAMP_ROLES.includes(p.role)) {
        renderBatchPersonnelRow(tc, p.role, p, true);
      }
    });
  }

  if (window.lucide) lucide.createIcons();
}

function addCustomPersonnelModalRow() {
  const tc = document.getElementById('batch-custom-tbody');
  if (!tc) return;
  renderBatchPersonnelRow(tc, '', {}, true);
  if (window.lucide) lucide.createIcons();
}

function removePersonnelRow(btn) {
  const tr = btn.closest('tr');
  if (tr) tr.remove();
}

function getPersonnelDirectoryData() {
  const allRows = document.querySelectorAll('#personnel-modal-form tr.personnel-row, #personnel-directory-tbody tr.personnel-row');
  const result = [];

  allRows.forEach(tr => {
    const role = tr.querySelector('.p-role')?.value.trim() || '';
    const fn = tr.querySelector('.p-fn')?.value.trim() || '';
    const mn = tr.querySelector('.p-mn')?.value.trim() || '';
    const ln = tr.querySelector('.p-ln')?.value.trim() || '';
    const suf = tr.querySelector('.p-suf')?.value.trim() || '';
    const fullName = [fn, mn, ln, suf].filter(Boolean).join(' ');
    const designation = tr.querySelector('.p-designation')?.value.trim() || '';
    const office = tr.querySelector('.p-office')?.value.trim() || '';
    const contact = tr.querySelector('.p-contact')?.value.trim() || '';

    if (role || fullName) {
      result.push({
        role,
        name: fullName,
        first_name: fn,
        middle_name: mn,
        last_name: ln,
        suffix: suf,
        designation,
        office,
        contact
      });
    }
  });

  return result;
}

function initCorePersonnelRows(existingData = []) {
  populatePersonnelBatchTables(existingData);
}

function addCustomPersonnelRow() {
  addCustomPersonnelModalRow();
}

async function submitPersonnelDirectory() {
  const centerIdInput = document.getElementById('pm-center-id');
  const centerId = centerIdInput ? centerIdInput.value : currentPersonnelCenterId;
  if (!centerId) {
    showToast("No active evacuation center selected.", "danger", "Selection Error");
    return;
  }

  const personnelData = getPersonnelDirectoryData();

  try {
    await apiFetch(`/evacuation-centers/${centerId}`, {
      method: 'PATCH',
      body: JSON.stringify({ personnel_directory: personnelData })
    });

    showToast("Camp Management Personnel Directory updated successfully!", "success", "Directory Saved");
    closePersonnelModal();
    await loadCenters();
  } catch (err) {
    showToast("Failed to save personnel directory: " + err.message, "danger", "Save Error");
  }
}

function autoFillPersonnelDemoData() {
  const demoPeople = {
    "LGU Camp Coordinator": { fn: "Carlos", mn: "Eduardo", ln: "Dela Cruz", suf: "", designation: "LGU Executive Director", office: "LGU Ormoc City", contact: "0917-555-0101" },
    "EC Camp Manager": { fn: "Maria", mn: "Elena", ln: "Santos", suf: "", designation: "Barangay Kagawad", office: "BDRRMC Linao", contact: "0918-555-0102" },
    "Assistant Camp Manager": { fn: "Juan", mn: "Paolo", ln: "Reyes", suf: "Jr.", designation: "BDRRM Officer II", office: "BDRRMC Linao", contact: "0919-555-0103" },
    "Administrative/Records Officer": { fn: "Teresa", mn: "Grace", ln: "Mendoza", suf: "", designation: "Records Admin", office: "Barangay Secretariat", contact: "0920-555-0104" },
    "Accommodation and Maintenance Officer": { fn: "Roberto", mn: "Luis", ln: "Gonzales", suf: "", designation: "Facility Manager", office: "Barangay General Services", contact: "0921-555-0105" },
    "Food and Non-Food Item Officer": { fn: "Anita", mn: "Rose", ln: "Bautista", suf: "", designation: "Relief Logistics Head", office: "CSWD / BDRRMC", contact: "0922-555-0106" },
    "Safety and Public Safety Officer": { fn: "Viktor", mn: "Manuel", ln: "Cruz", suf: "", designation: "Chief Tanod", office: "Barangay Tanod Executive", contact: "0923-555-0107" },
    "Education, Sports, and Recreation Officer": { fn: "Liza", mn: "Joy", ln: "Villanueva", suf: "", designation: "Youth Coordinator", office: "SK Council / DepEd", contact: "0924-555-0108" },
    "Logistics Officer": { fn: "Ramon", mn: "Gabriel", ln: "Torres", suf: "Engr.", designation: "Logistics Lead", office: "City Engineering Office", contact: "0925-555-0109" },
    "WASH Officer": { fn: "Francis", mn: "Xavier", ln: "Navarro", suf: "", designation: "Sanitation Specialist", office: "City Health Office", contact: "0926-555-0110" },
    "Medical Officer": { fn: "Teresa", mn: "A.", ln: "Alcantara", suf: "MD", designation: "Municipal Physician", office: "City Health Office / DOH", contact: "0927-555-0111" },
    "MHPSS Officer": { fn: "Elena", mn: "Isabel", ln: "Aquino", suf: "RPm", designation: "Mental Health Officer", office: "Philippine Red Cross", contact: "0928-555-0112" },
    "Nutrition Officer": { fn: "Ana", mn: "Clara", ln: "Reyes", suf: "RND", designation: "Barangay Nutritionist", office: "National Nutrition Council", contact: "0929-555-0113" }
  };

  populatePersonnelBatchTables(
    Object.entries(demoPeople).map(([role, p]) => ({ role, ...p }))
  );
  showToast("Sample personnel directory populated!", "info", "Auto-Populate");
}

// =============================================
// Auto-Populate Sample Data Demo Helper
// =============================================

function autoFillEvacuationDemoData() {
  const cName = document.getElementById('c-name');
  if (cName) cName.value = 'Linao Regional Evacuation Center & Disaster Hub';
  
  const cYear = document.getElementById('c-year-established');
  if (cYear) cYear.value = '2018';
  
  const cAddress = document.getElementById('c-address');
  if (cAddress) cAddress.value = 'Purok 3, Barangay Linao, Ormoc City, Leyte';
  
  const cFloor = document.getElementById('c-floor-area');
  if (cFloor) cFloor.value = '450 sq. meters';
  
  const cLot = document.getElementById('c-lot-area');
  if (cLot) cLot.value = '30X25 meters';
  
  const cCap = document.getElementById('c-capacity');
  if (cCap) cCap.value = '80 families';
  
  const cLat = document.getElementById('c-lat');
  if (cLat) cLat.value = '11.0180';
  
  const cLng = document.getElementById('c-lng');
  if (cLng) cLng.value = '124.5920';
  
  const cType = document.getElementById('c-type');
  if (cType) {
    cType.value = 'Purpose-Built Evacuation Center';
    toggleCenterTypeOthers();
  }

  const sampleStaff = [
    { role: "LGU Camp Coordinator", fn: "Maria", mn: "Elena", ln: "Santos", suf: "", designation: "DRRM Officer", office: "LGU Ormoc", contact: "0917-555-0101" },
    { role: "EC Camp Manager", fn: "Roberto", mn: "Gomez", ln: "Dela Cruz", suf: "Jr.", designation: "Barangay Captain", office: "Brgy Linao Hall", contact: "0918-555-0102" },
    { role: "Assistant Camp Manager", fn: "Juan", mn: "Carlos", ln: "Perez", suf: "", designation: "Brgy Councilor", office: "Brgy Linao Hall", contact: "0919-555-0103" },
    { role: "Administrative/Records Officer", fn: "Elena", mn: "Rosa", ln: "Gomez", suf: "", designation: "Brgy Secretary", office: "Brgy Admin Desk", contact: "0920-555-0104" },
    { role: "Accommodation and Maintenance Officer", fn: "Mark", mn: "Anthony", ln: "Torralba", suf: "", designation: "Facility Head", office: "Brgy Maintenance", contact: "0921-555-0105" },
    { role: "Food and Non-Food Item Officer", fn: "Sofia", mn: "Luz", ln: "Reyes", suf: "", designation: "Relief Lead", office: "MSWDO / Brgy Supply", contact: "0922-555-0106" },
    { role: "Safety and Public Safety Officer", fn: "Mario", mn: "Vidal", ln: "Villa", suf: "", designation: "Chief Tanod", office: "Barangay Security", contact: "0923-555-0107" },
    { role: "Education, Sports, and Recreation Officer", fn: "Ana", mn: "Marie", ln: "Mendoza", suf: "", designation: "DepEd Rep", office: "Linao Elem School", contact: "0924-555-0108" },
    { role: "Logistics Officer", fn: "Dave", mn: "Paul", ln: "Flores", suf: "Engr.", designation: "Logistics Manager", office: "LGU Engineering", contact: "0925-555-0109" },
    { role: "WASH Officer", fn: "Grace", mn: "Joy", ln: "Lim", suf: "RN", designation: "Sanitation Inspector", office: "Rural Health Unit", contact: "0926-555-0110" },
    { role: "Medical Officer", fn: "Joseph", mn: "Arthur", ln: "Tan", suf: "MD", designation: "Barangay Physician", office: "Linao Health Center", contact: "0927-555-0111" },
    { role: "MHPSS Officer", fn: "Clara", mn: "Bea", ln: "Villanueva", suf: "", designation: "Guidance Counselor", office: "Social Welfare Desk", contact: "0928-555-0112" },
    { role: "Nutrition Officer", fn: "Carmen", mn: "Ines", ln: "Navarro", suf: "", designation: "Nutrition Scholar", office: "Barangay Health Station", contact: "0929-555-0113" }
  ];

  initCorePersonnelRows(sampleStaff);
  if (typeof showToast === 'function') {
    showToast('Auto-populated Evacuation Center sample data successfully!', 'success', 'Auto-Populate');
  }
}

// =============================================
// Capacity Estimation Engine (15% Safety Buffer)
// =============================================

function calculateSuggestedCapacity() {
  const floorArea = parseFloat(document.getElementById('c-floor-area')?.value || 0);
  const preview = document.getElementById('capacity-calculation-preview');
  if (!preview) return;

  if (floorArea > 0) {
    // 3.5 sqm per occupant standard + 15% safety buffer
    const baseCap = floorArea / 3.5;
    const estCap = Math.ceil(baseCap * 1.15);
    preview.innerHTML = `<i data-lucide="calculator" style="width:12px;height:12px;color:#60a5fa;display:inline-block;vertical-align:middle;"></i> Suggested: <strong>${estCap} persons</strong> (${floorArea}m² / 3.5m² + 15% buffer)`;
    if (window.lucide) lucide.createIcons();
  } else {
    preview.textContent = 'Calculated via Historical Peak Running Avg + 15% Safety Buffer';
  }
}

async function estimateFacilityCapacity() {
  const centerId = document.getElementById('center-id')?.value;
  const floorArea = parseFloat(document.getElementById('c-floor-area')?.value || 0);

  let estimated = 100;
  let labelText = '';

  if (centerId) {
    try {
      const res = await apiFetch(`/evacuation-centers/${centerId}/estimate-capacity`);
      estimated = res.estimated_capacity;
      labelText = `Running Avg: ${res.running_average} + 15% Safety Buffer (${res.method})`;
    } catch (_) {
      const baseCap = floorArea > 0 ? floorArea / 3.5 : 200;
      estimated = Math.ceil(baseCap * 1.15);
      labelText = `Floor Area Standard (${floorArea}m²) + 15% Safety Buffer`;
    }
  } else {
    const baseCap = floorArea > 0 ? floorArea / 3.5 : 200;
    estimated = Math.ceil(baseCap * 1.15);
    labelText = `Floor Area Standard (${floorArea}m²) + 15% Safety Buffer`;
  }

  const capInput = document.getElementById('c-capacity');
  if (capInput) capInput.value = estimated;

  const preview = document.getElementById('capacity-calculation-preview');
  if (preview) {
    preview.innerHTML = `<i data-lucide="sparkles" style="width:12px;height:12px;color:#34d399;display:inline-block;vertical-align:middle;"></i> Auto-Assigned: <strong>${estimated} persons</strong> (${labelText})`;
    if (window.lucide) lucide.createIcons();
  }

  showToast(`Estimated Capacity set to ${estimated} persons (+15% safety buffer)`, 'info', 'Capacity Estimation Engine');
}

// =============================================
// JMC No. 2 Series 2021 Digital Checklist Inspection
// =============================================

let currentJMC2CenterId = null;

const STANDARD_JMC2_ITEMS = [
  { id: "jmc_01", name: "Information Board / Help Desk", category: "Administration" },
  { id: "jmc_02", name: "Adequate Shelter & Sleeping Space", category: "Accommodation" },
  { id: "jmc_03", name: "Community Kitchen / Cooking Area", category: "Food Services" },
  { id: "jmc_04", name: "Safe Drinking Water Supply & Storage", category: "WASH" },
  { id: "jmc_05", name: "Separate Male & Female Toilets / Latrines", category: "WASH" },
  { id: "jmc_06", name: "Handwashing Stations with Soap", category: "WASH" },
  { id: "jmc_07", name: "Health Station & First Aid Clinic", category: "Health" },
  { id: "jmc_08", name: "Child-Friendly Space & Play Area", category: "Protection" },
  { id: "jmc_09", name: "Women-Friendly & Lactation Space", category: "Protection" },
  { id: "jmc_10", name: "Solid Waste Management / Segregated Bins", category: "Sanitation" },
  { id: "jmc_11", name: "Power Supply & Generator Backup", category: "Utilities" },
  { id: "jmc_12", name: "Emergency Lighting & Flashlights", category: "Safety" },
  { id: "jmc_13", name: "PWD & Senior Citizen Accessibility Ramps", category: "Accessibility" },
  { id: "jmc_14", name: "Security Desk & Barangay Tanod Post", category: "Safety" },
  { id: "jmc_15", name: "Storage for Relief Goods & Supplies", category: "Logistics" },
  { id: "jmc_16", name: "Adequate Ventilation & Natural Airflow", category: "Accommodation" },
  { id: "jmc_17", name: "Laundry & Cloth Washing Area", category: "WASH" },
  { id: "jmc_18", name: "Fire Safety Equipment & Extinguishers", category: "Safety" },
  { id: "jmc_19", name: "Emergency Public Address / Comms System", category: "Comms" },
  { id: "jmc_20", name: "Isolation Area for Infectious Illnesses", category: "Health" },
];

async function openJMC2Modal(centerId) {
  currentJMC2CenterId = centerId;
  const center = allCenters.find(c => c.id === centerId);
  if (!center) return;

  document.getElementById('jmc2-center-name').textContent = center.name;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getMonth()+1)}-${pad(now.getDate())}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById('jmc2-inspection-time').value = stamp;

  const user = getUser();
  document.getElementById('jmc2-inspector-name').value = center.jmc2_inspector || user?.full_name || 'Kagawad M. Palanca';

  const tbody = document.getElementById('jmc2-items-tbody');
  const savedChecklist = center.jmc2_checklist || {};

  tbody.innerHTML = STANDARD_JMC2_ITEMS.map((item, idx) => {
    const itemData = savedChecklist[item.id] || { status: 'compliant', remarks: '' };
    return `
      <tr>
        <td>
          <strong>${idx + 1}. ${item.name}</strong>
        </td>
        <td>
          <span class="badge badge-blue" style="font-size:.65rem;">${item.category}</span>
        </td>
        <td>
          <select class="filter-select jmc2-item-status" data-item-id="${item.id}" onchange="updateJMC2LiveScore()" style="width:100%;padding:.25rem .4rem;font-size:.75rem;">
            <option value="compliant" ${itemData.status === 'compliant' ? 'selected' : ''}>Pass / Compliant</option>
            <option value="issue" ${itemData.status === 'issue' ? 'selected' : ''} style="color:#ef4444;font-weight:700;">Issue / Deficient (Auto Ticket)</option>
          </select>
        </td>
        <td>
          <input type="text" class="jmc2-item-remarks" data-item-id="${item.id}" value="${escHtml(itemData.remarks || '')}" placeholder="Optional defect details..." style="width:100%;padding:.25rem .4rem;font-size:.75rem;" />
        </td>
      </tr>
    `;
  }).join('');

  updateJMC2LiveScore();
  document.getElementById('jmc2-modal-overlay').classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeJMC2Modal() {
  document.getElementById('jmc2-modal-overlay')?.classList.remove('active');
  currentJMC2CenterId = null;
}

function closeJMC2ModalOutside(e) {
  if (e.target.id === 'jmc2-modal-overlay') closeJMC2Modal();
}

function updateJMC2LiveScore() {
  const statusSelects = Array.from(document.querySelectorAll('.jmc2-item-status'));
  if (!statusSelects.length) return;

  const total = statusSelects.length;
  const compliant = statusSelects.filter(sel => sel.value === 'compliant').length;
  const pct = Math.round((compliant / total) * 100);

  const scoreEl = document.getElementById('jmc2-live-score');
  if (scoreEl) {
    scoreEl.textContent = `${pct}%`;
    scoreEl.style.color = pct >= 90 ? '#34d399' : pct >= 75 ? '#fbbf24' : '#ef4444';
  }
}

async function submitJMC2Checklist(event) {
  event.preventDefault();
  if (!currentJMC2CenterId) return;

  const inspectorName = document.getElementById('jmc2-inspector-name')?.value.trim();
  const statusSelects = Array.from(document.querySelectorAll('.jmc2-item-status'));

  const checklistPayload = {};
  let issueCount = 0;

  statusSelects.forEach(sel => {
    const itemId = sel.getAttribute('data-item-id');
    const remarksInput = document.querySelector(`.jmc2-item-remarks[data-item-id="${itemId}"]`);
    const statusVal = sel.value;
    if (statusVal === 'issue') issueCount++;

    checklistPayload[itemId] = {
      status: statusVal,
      remarks: remarksInput?.value.trim() || '',
    };
  });

  try {
    const res = await apiFetch(`/evacuation-centers/${currentJMC2CenterId}/jmc2-checklist`, {
      method: 'POST',
      body: JSON.stringify({
        checklist: checklistPayload,
        inspector_name: inspectorName,
      }),
    });

    if (issueCount > 0) {
      showToast(`JMC2 Audit Complete: ${res.score_pct}% Score. Generated ${issueCount} automated maintenance tickets!`, 'warning', 'Defects Flagged');
    } else {
      showToast(`JMC2 Audit Complete: 100% Fully Compliant!`, 'success', 'Audit Passed');
    }

    closeJMC2Modal();
    await loadCenters();
  } catch (err) {
    showToast(err.message || 'JMC2 audit submission failed.', 'danger', 'Submission Error');
  }
}

// =============================================
// Monthly Archival Workflow
// =============================================

function archiveFacilityMonthly(centerId) {
  const center = allCenters.find(c => c.id === centerId);
  if (!center) return;

  const now = new Date();
  const cycle = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  confirmAction({
    title: `Archive Facility for Cycle [${cycle}]?`,
    message: `Archive facility profile [${center.name}] for the monthly cycle? Full historical data will be logged.`,
    confirmText: "Archive Profile",
    type: "warning",
    icon: "archive",
    onConfirm: async () => {
      try {
        await apiFetch(`/evacuation-centers/${centerId}/archive-monthly`, {
          method: 'POST',
          body: JSON.stringify({
            archive_cycle: cycle,
            notes: 'Monthly compliance and occupancy archive snapshot.',
          }),
        });
        showToast(`Facility profile archived for monthly cycle ${cycle}`, 'info', 'Monthly Archival Complete');
        await loadCenters();
      } catch (err) {
        showToast(err.message || 'Monthly archival failed.', 'danger', 'Archive Error');
      }
    }
  });
}

// =============================================
// Export Standardized PDF Facility Profile & Population Report
// =============================================

function exportFacilityProfilePDF(centerId) {
  const c = allCenters.find(item => item.id === centerId);
  if (!c) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${pad(now.getMonth()+1)}-${pad(now.getDate())}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  // Occupancy removed from export — show capacity-only in reports
  const pct = 0;

  const printWin = window.open('', '_blank', 'width=900,height=800');
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Evacuation Facility Profile & Population Report — ${c.name}</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 25px; margin: 0; line-height: 1.5; }
        .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #0f172a; }
        .header h2 { margin: 4px 0 0; font-size: 14px; font-weight: 500; color: #64748b; }
        .meta-bar { display: flex; justify-content: space-between; font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 14px; border-radius: 6px; margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: 700; color: #0284c7; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 18px 0 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .stat-box { background: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 4px solid #0284c7; }
        .stat-val { font-size: 20px; font-weight: 800; color: #0f172a; }
        .stat-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
        th { background: #f8fafc; font-weight: 700; color: #334155; }
        .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>REPUBLIC OF THE PHILIPPINES · BARANGAY LINAO, ORMOC CITY</h1>
        <h2>BARANGAY DISASTER RISK REDUCTION AND MANAGEMENT COUNCIL (BDRRMC)</h2>
        <h3 style="margin-top:8px;font-size:16px;color:#0284c7;">STANDARD EVACUATION FACILITY PROFILE &amp; POPULATION REPORT</h3>
      </div>

      <div class="meta-bar">
        <div><strong>Facility:</strong> ${escHtml(c.name)}</div>
        <div><strong>Report Date:</strong> ${stamp}</div>
        <div><strong>JMC2 Audit Score:</strong> ${c.jmc2_score !== undefined ? c.jmc2_score : 100}%</div>
      </div>

      <div class="grid-2">
        <div class="stat-box">
          <div class="stat-val">${c.capacity}</div>
          <div class="stat-lbl">Registered Capacity (Persons)</div>
        </div>
        <div class="stat-box" style="border-left-color:#10b981;">
          <div class="stat-val">Status: ${escHtml(c.status || 'Unknown')}</div>
          <div class="stat-lbl">Facility Status</div>
        </div>
      </div>

      <div class="section-title">1. Facility Specifications &amp; Location</div>
      <table>
        <tr><th>Address / Location</th><td>${escHtml(c.address || '—')}</td></tr>
        <tr><th>GIS Map Coordinates</th><td>Lat: ${c.latitude.toFixed(5)}, Lng: ${c.longitude.toFixed(5)}</td></tr>
        <tr><th>Year Established</th><td>${c.year_established || '—'}</td></tr>
        <tr><th>Floor / Lot Area</th><td>${c.floor_area_sqm ? c.floor_area_sqm + ' sqm' : '—'}</td></tr>
        <tr><th>Capacity Estimation Method</th><td>Historical Running Average + 15% Safety Buffer</td></tr>
        <tr><th>Primary Contact</th><td>${escHtml(c.contact_person || '—')} (${escHtml(c.contact_number || '—')})</td></tr>
      </table>

      <div class="section-title">2. Camp Management Structure Roster</div>
      <table>
        <thead>
          <tr><th>Role / Position</th><th>Assigned Personnel</th><th>Contact Number</th></tr>
        </thead>
        <tbody>
          ${c.personnel_directory && c.personnel_directory.length ? c.personnel_directory.map(p => `
            <tr><td>${escHtml(p.role)}</td><td>${escHtml(p.name)}</td><td>${escHtml(p.contact || '—')}</td></tr>
          `).join('') : `
            <tr><td colspan="3" style="text-align:center;color:var(--text-muted);">No personnel information available.</td></tr>
          `}
        </tbody>
      </table>

      <div class="section-title">3. Operational Utilities &amp; Resource Status</div>
      <table>
        <tr><th>Water Supply</th><td>${c.has_water ? 'Operational / Available' : 'Deficient'}</td></tr>
        <tr><th>Electricity / Generator</th><td>${c.has_electricity ? 'Grid / Generator Operational' : 'Deficient'}</td></tr>
        <tr><th>First Aid Station</th><td>${c.has_first_aid ? 'Available' : 'Deficient'}</td></tr>
        <tr><th>Food Packs Supply</th><td>${c.has_food ? 'Stock Available' : 'Deficient'}</td></tr>
        <tr><th>Sanitation Facilities</th><td>${c.has_sanitation ? 'Operational' : 'Deficient'}</td></tr>
      </table>

      <div class="footer">
        Certified Official BDRRMC Document · Printable Facility Profile &amp; Real-Time Population Report · Generated on ${stamp}
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

// =============================================
// SECTION 7: EVACUATION (POPULATION) MONITORING
// =============================================

// Quick-Tap Triage Counter Adjuster
function adjustQuickTap(elementId, delta) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let currentVal = parseInt(el.textContent || '0');
  currentVal = Math.max(0, currentVal + delta);
  el.textContent = currentVal;

  // Calculate live Vulnerability Index
  updateTriageVulnerabilityIndex();
}

function updateTriageVulnerabilityIndex() {
  const inf = parseInt(document.getElementById('fam-count-infants')?.textContent || '0');
  const chi = parseInt(document.getElementById('fam-count-children')?.textContent || '0');
  const sen = parseInt(document.getElementById('fam-count-seniors')?.textContent || '0');
  const pwd = parseInt(document.getElementById('fam-count-pwd')?.textContent || '0');
  const prg = parseInt(document.getElementById('fam-count-pregnant')?.textContent || '0');

  const score = (inf * 3) + (pwd * 3) + (prg * 2.5) + (sen * 2) + (chi * 1);
  const container = document.getElementById('triage-vulnerability-index');
  if (!container) return;

  let badge = '<strong style="color:#34d399;">Standard Triage (Low Priority)</strong>';
  if (score >= 8) {
    badge = '<strong style="color:#ef4444;"><i data-lucide="alert-triangle" style="width:12px;height:12px;display:inline-block;"></i> HIGH VULNERABILITY TRIAGE (Priority Shelter &amp; Medical Allocation)</strong>';
  } else if (score >= 4) {
    badge = '<strong style="color:#fbbf24;">Moderate Vulnerability Triage</strong>';
  }

  container.innerHTML = `Vulnerability Triage Score: <strong>${score} pts</strong> · ${badge}`;
  if (window.lucide) lucide.createIcons();
}

// --- 7.1 Disaster Event Management ---

function openDisasterEventModal() {
  document.getElementById('disaster-event-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeDisasterEventModal() {
  document.getElementById('disaster-event-modal-overlay')?.classList.remove('active');
}

function closeDisasterEventModalOutside(e) {
  if (e.target.id === 'disaster-event-modal-overlay') closeDisasterEventModal();
}

async function submitDisasterEvent(event) {
  event.preventDefault();
  const name = document.getElementById('evt-name')?.value.trim();
  const type = document.getElementById('evt-type')?.value;
  const notes = document.getElementById('evt-notes')?.value.trim();

  if (!name) return;

  try {
    const res = await apiFetch('/evacuation-tracking/disaster-events', {
      method: 'POST',
      body: JSON.stringify({ event_name: name, event_type: type, notes: notes }),
    });

    document.getElementById('active-event-name').textContent = res.event_name;
    document.getElementById('active-event-type').textContent = `${res.event_type} · Initialized by ${res.created_by}`;

    showToast(`Active Disaster Event initialized: ${res.event_name}`, 'success', 'Event Active');
    closeDisasterEventModal();
  } catch (err) {
    showToast(err.message || 'Failed to initialize disaster event.', 'danger', 'Event Creation Error');
  }
}

// --- 7.3 QR-Based Duplicate Relief Claim Scanner ---

function openQRReliefModal() {
  document.getElementById('qr-claim-result-box').style.display = 'none';
  document.getElementById('qr-token-input').value = '';
  document.getElementById('qr-relief-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeQRReliefModal() {
  document.getElementById('qr-relief-modal-overlay')?.classList.remove('active');
}

function closeQRReliefModalOutside(e) {
  if (e.target.id === 'qr-relief-modal-overlay') closeQRReliefModal();
}

async function submitQRReliefScan(event) {
  event.preventDefault();
  const token = document.getElementById('qr-token-input')?.value.trim();
  const runId = document.getElementById('qr-run-id')?.value.trim();
  const resultBox = document.getElementById('qr-claim-result-box');

  if (!token || !runId) return;

  try {
    const res = await apiFetch('/evacuation-tracking/relief-distribution/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_token: token, relief_run_id: runId }),
    });

    resultBox.style.display = 'block';

    if (res.allowed) {
      resultBox.style.background = 'rgba(16,185,129,0.12)';
      resultBox.style.border = '1px solid rgba(16,185,129,0.35)';
      resultBox.style.color = '#34d399';
      resultBox.innerHTML = `
        <div style="font-weight:800;font-size:.95rem;"><i data-lucide="check-circle-2" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;"></i> RELIEF PACKAGE APPROVED &amp; RELEASED</div>
        <div style="font-size:.78rem;margin-top:.3rem;">Family Code: <strong>${res.family.family_code}</strong> · Head: ${res.family.head_name} (${res.family.total_members} Members)</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem;">Claim timestamp: ${res.claim.claimed_at}</div>
      `;
      showToast(res.message, 'success', 'Package Released');
    } else {
      resultBox.style.background = 'rgba(239,68,68,0.12)';
      resultBox.style.border = '1px solid rgba(239,68,68,0.35)';
      resultBox.style.color = '#ef4444';
      resultBox.innerHTML = `
        <div style="font-weight:800;font-size:.95rem;"><i data-lucide="alert-octagon" style="width:18px;height:18px;vertical-align:middle;margin-right:4px;"></i> DUPLICATE CLAIM BLOCKED</div>
        <div style="font-size:.78rem;margin-top:.3rem;">Family <strong>${res.family.family_code}</strong> (${res.family.head_name}) ALREADY CLAIMED for batch [${runId}].</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem;">Previous Claim: ${res.claimed_at}</div>
      `;
      showToast(res.message, 'danger', 'Duplicate Claim Blocked');
    }
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    showToast(err.message || 'QR verification failed.', 'danger', 'Scan Error');
  }
}

// --- 7.5 Exit & Discharge Workflow ---

let activeDischargeFamilyId = null;

function openDischargeModal(familyId, headName, totalMembers, familyCode) {
  activeDischargeFamilyId = familyId;
  document.getElementById('dis-family-id').value = familyId;
  document.getElementById('dis-family-head').textContent = headName;
  document.getElementById('dis-family-meta').textContent = `Family Code: ${familyCode} · Total Members: ${totalMembers}`;
  document.getElementById('discharge-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeDischargeModal() {
  document.getElementById('discharge-modal-overlay')?.classList.remove('active');
  activeDischargeFamilyId = null;
}

function closeDischargeModalOutside(e) {
  if (e.target.id === 'discharge-modal-overlay') closeDischargeModal();
}

function removeFamilyFromManifest(familyId) {
  if (!currentTrackingCenterId || !familyId) return;
  const manifests = getEvacManifests();
  if (!manifests[currentTrackingCenterId]) return;
  manifests[currentTrackingCenterId] = manifests[currentTrackingCenterId].filter(f => f.id !== familyId);
  saveEvacManifests(manifests);
}

async function loadTrackingRecord(centerId, phase = 'during') {
  if (!centerId) return;
  currentTrackingCenterId = centerId;
  currentTrackingPhase = phase;
  try {
    const data = await apiFetch(`/evacuation-tracking/${centerId}?phase=${phase}`);
    if (data && data.center_id) {
      populateTrackingForm(data);
    }
  } catch (err) {
    console.warn('Unable to load tracking record:', err);
  }
}

async function submitDischargeFamily(event) {
  event.preventDefault();
  const famId = document.getElementById('dis-family-id')?.value || activeDischargeFamilyId;
  const disType = document.getElementById('dis-type')?.value;
  const destination = document.getElementById('dis-destination')?.value.trim();

  if (!famId || !destination) return;

  try {
    const res = await apiFetch(`/evacuation-tracking/families/${famId}/discharge`, {
      method: 'POST',
      body: JSON.stringify({ discharge_type: disType, destination_address: destination }),
    });

    removeFamilyFromManifest(famId);
    renderEvacManifestTable();

    showToast(res.message, 'warning', 'IDP Discharged');
    closeDischargeModal();
    if (currentTrackingCenterId) {
      await loadTrackingRecord(currentTrackingCenterId, 'during');
    }
    await loadCenters();
  } catch (err) {
    showToast(err.message || 'Failed to discharge family profile.', 'danger', 'Discharge Error');
  }
}

// --- 7.4 2-Hour CDRRM Pulse Report Generator ---

async function printCDRRM2HourPulseReport() {
  try {
    const report = await apiFetch('/evacuation-tracking/pulse-report');

    const printWin = window.open('', '_blank', 'width=900,height=850');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>2-Hour CDRRM / NDRRMC Pulse Report — Barangay DRRM</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; padding: 25px; margin: 0; line-height: 1.5; }
          .header { text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 12px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; color: #991b1b; }
          .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
          .alert-bar { background: #fef2f2; border: 1px solid #fca5a5; padding: 10px 14px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 12px; }
          .section-title { font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; }
          .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
          .stat-box { background: #f8fafc; padding: 10px; border-radius: 6px; border-top: 3px solid #0284c7; text-align: center; }
          .stat-val { font-size: 22px; font-weight: 800; color: #0f172a; }
          .stat-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          .footer { margin-top: 35px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 11px; color: #94a3b8; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REPUBLIC OF THE PHILIPPINES · CITY DISASTER RISK REDUCTION AND MANAGEMENT OFFICE</h1>
          <h2>BARANGAY LINAO DRRM OPERATIONS CENTER · 2-HOUR PULSE CONSOLIDATED REPORT</h2>
        </div>

        <div class="alert-bar">
          <div><strong>ACTIVE EVENT:</strong> ${escHtml(report.disaster_event.event_name)}</div>
          <div><strong>PULSE TIMESTAMP:</strong> ${report.pulse_timestamp}</div>
          <div><strong>STATUS:</strong> OPERATIONAL (2-HOUR MERGE)</div>
        </div>

        <div class="grid-4">
          <div class="stat-box" style="border-top-color:#ef4444;">
            <div class="stat-val">${report.summary.current_idp_population}</div>
            <div class="stat-lbl">Total IDP Population</div>
          </div>
          <div class="stat-box" style="border-top-color:#0284c7;">
            <div class="stat-val">${report.summary.total_centers_operational}</div>
            <div class="stat-lbl">Active Shelters</div>
          </div>
          <div class="stat-box" style="border-top-color:#f59e0b;">
            <div class="stat-val">${report.summary.occupancy_rate_pct}%</div>
            <div class="stat-lbl">Overall Capacity Rate</div>
          </div>
          <div class="stat-box" style="border-top-color:#10b981;">
            <div class="stat-val">${report.vulnerability_breakdown.total_vulnerable_idps}</div>
            <div class="stat-lbl">Vulnerable Persons</div>
          </div>
        </div>

        <div class="section-title">1. Vulnerability Triage Breakdown (Merged Profiles)</div>
        <table>
          <thead>
            <tr><th>Vulnerability Category</th><th>Evacuee Count</th><th>Priority Allocation Status</th></tr>
          </thead>
          <tbody>
            <tr><td>Infants (&lt;2 Years Old)</td><td><strong>${report.vulnerability_breakdown.infants_under_2}</strong></td><td>Formula milk &amp; infant kit priority</td></tr>
            <tr><td>Children (2 to 12 Years Old)</td><td><strong>${report.vulnerability_breakdown.children_2_to_12}</strong></td><td>Child-friendly space monitored</td></tr>
            <tr><td>Senior Citizens (60+ Years Old)</td><td><strong>${report.vulnerability_breakdown.senior_citizens_60plus}</strong></td><td>Low-bunk shelter placement</td></tr>
            <tr><td>Persons with Disability (PWD)</td><td><strong>${report.vulnerability_breakdown.pwd_persons_with_disability}</strong></td><td>Accessibility ramp &amp; mobility assist</td></tr>
            <tr><td>Pregnant &amp; Lactating Mothers</td><td><strong>${report.vulnerability_breakdown.pregnant_and_lactating_mothers}</strong></td><td>Maternal health clinic monitored</td></tr>
          </tbody>
        </table>

        <div class="section-title">2. Relief Goods Distribution Pulse</div>
        <table>
          <tr><th>Total Packages Released</th><td>${report.relief_distribution_summary.total_packages_claimed} Kits</td></tr>
          <tr><th>Duplicate Claims Prevented</th><td>${report.relief_distribution_summary.duplicate_claims_prevented} Attempts (QR Verified)</td></tr>
          <tr><th>Reporting Officer</th><td>${escHtml(report.generated_by)}</td></tr>
        </table>

        <div class="footer">
          Official CDRRMO / NDRRMC Subordinated 2-Hour Pulse Report · Automated Merge Complete
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
    showToast('Failed to generate 2-hour pulse report.', 'danger', 'Pulse Error');
  }
}



// =============================================
// Evacuation Modals — Enter Key Support
// =============================================
document.addEventListener('DOMContentLoaded', () => {

  // Population / Family Registration panel — Enter on text/number fields submits
  ['fam-head-name', 'fam-sitio', 'fam-size', 'fam-room'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addEvacFamilyRecord(); }
      });
    }
  });

  // Modal 3: Occupancy Update — Enter on number input or remarks submits
  ['occ-value', 'occ-remarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submitOccupancy(); }
      });
    }
  });

  // Modal 4: Disaster Event — Enter on text inputs submits
  const disasterForm = document.getElementById('disaster-event-modal-overlay');
  if (disasterForm) {
    disasterForm.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
      submitDisasterEvent(e);
    });
  }

  // Modal 5: QR Relief Scan — Enter on token input submits
  const qrInput = document.getElementById('qr-token-input');
  if (qrInput) {
    qrInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitQRReliefScan(e); }
    });
  }

  // Modal 6: Discharge — Enter submits
  const dischargeModal = document.getElementById('discharge-modal-overlay');
  if (dischargeModal) {
    dischargeModal.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
      submitDischargeFamily(e);
    });
  }

});

// ===== MODAL 8: STANDARD CAMP FACILITIES CHECKLIST (JMC2 Series 2021) =====

function handleCampLayoutFile(input) {
  const file = input?.files?.[0];
  const infoEl = document.getElementById('camp-layout-file-info');
  if (!file) return;

  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)) {
    if (typeof showToast === 'function') showToast('Unsupported format. Please upload JPG, PNG, or PDF.', 'error');
    input.value = '';
    if (infoEl) infoEl.style.display = 'none';
    return;
  }

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  if (infoEl) {
    infoEl.style.display = 'block';
    infoEl.innerHTML = `<i data-lucide="file-check" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Uploaded: ${escHtml(file.name)} (${fileSizeMB} MB)`;
    if (window.lucide) lucide.createIcons();
  }
  if (typeof showToast === 'function') showToast(`Camp layout "${file.name}" attached successfully.`, 'success');
}

const FACILITY_RESOLUTIONS = {
  'fac_1_visible': 'LGU / BDRRMC will immediately print and post the Standard Emergency Information Board at the EC entrance.',
  'fac_2_c1_space': 'LGU to coordinate with DepEd/CSWDO to allocate additional comfortable living space (3.5sqm/person).',
  'fac_2_c2_tents': 'Deploy standby 15 units modular privacy tents from LGU DRRM warehouse to the EC.',
  'fac_3_desk': 'Establish designated Camp Management Desk equipped with focal person station and logbooks.',
  'fac_4_clean': 'Deploy standby 10pcs Portable Toilets & WASH facilities to EC to meet compliance standards.',
  'fac_5_wash': 'Deploy mobile bathing cubicles with separate gender partitions and privacy curtains.',
  'fac_6_water': 'Position emergency water bowser / mobile water purification tank for continuous potable water.',
  'fac_7_wash_station': 'Install covered handwashing stations equipped with soap & disinfectant at key points.',
  'fac_8_laundry': 'Set up designated laundry and clothesline drying area with adequate drainage.',
  'fac_9_clinic': 'Assign 24/7 Medical Response Team & setup designated Emergency Medical Triage Corner.',
  'fac_10_mhpss': 'Deploy MHPSS kit and assign trained Social Worker for psychological first aid.',
  'fac_11_nutrition': 'Partner with City Nutrition Office to establish Supplemental Feeding & Infant Corner.',
  'fac_12_cfs': 'Establish Child-Friendly Space (CFS) equipped with recreational kits and trained facilitators.',
  'fac_13_wfs': 'Establish Women-Friendly Space (WFS) providing privacy for lactation and GBV support.',
  'fac_14_pwd': 'Setup PWD / Elderly Accessibility Assistance Desk and install temporary access ramps.',
  'fac_15_security': 'Station 24/7 Security Personnel (PNP / Barangay Tanod) at EC entrance and perimeter.',
  'fac_16_kitchen': 'Construct community kitchen with proper ventilation and fire safety equipment.',
  'fac_17_storage': 'Position emergency food & non-food supply storage lockers within secured EC room.',
  'fac_18_waste': 'Deploy color-coded solid waste segregation bins (Biodegradable, Non-Bio, Hazardous).',
  'fac_19_vector': 'Deploy vector control sprays and schedule regular sanitation and pest control.'
};

function autoGenerateContingencyPlan(showNotice = false) {
  const planEl = document.getElementById('fac_contingency_plan');
  if (!planEl) return;

  const noItems = [];
  const hiddenInputs = document.querySelectorAll('#facilities-modal-form input[type="hidden"][name^="fac_"]');
  
  hiddenInputs.forEach(input => {
    if (input.value === "false") {
      const key = input.id;
      const resolution = FACILITY_RESOLUTIONS[key] || `LGU/BDRRMC action step planned for unmet facility requirement (${key}).`;
      noItems.push(resolution);
    }
  });

  if (noItems.length > 0) {
    const draftText = noItems.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
    planEl.value = draftText;
    if (showNotice && typeof showToast === 'function') {
      showToast(`Auto-generated contingency plan for ${noItems.length} unmet standard(s).`, 'info');
    }
  } else {
    if (!planEl.value || planEl.value.includes('LGU will Deploy the standby')) {
      planEl.value = "Ex: 1. LGU will Deploy the standby 10pcs Portable Toilets to EC\n2. Mobile privacy screens will be installed for MHPSS area.";
    }
    if (showNotice && typeof showToast === 'function') {
      showToast('All facilities compliant! Standard completion statement active.', 'success');
    }
  }
}

function setFacToggle(inputId, isYes, btn) {
  const hiddenInput = document.getElementById(inputId);
  if (hiddenInput) {
    hiddenInput.value = isYes ? "true" : "false";
  }

  if (btn) {
    const parentGroup = btn.closest('.fac-toggle-group');
    if (parentGroup) {
      const buttons = parentGroup.querySelectorAll('.fac-btn');
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  }

  calculateFacScore();

  // If toggled to NO, auto draft contingency plan entry for unmet standard
  if (!isYes) {
    autoGenerateContingencyPlan(false);
  }
}

function calculateFacScore() {
  const hiddenInputs = document.querySelectorAll('#facilities-modal-form input[type="hidden"][name^="fac_"]');
  if (!hiddenInputs.length) return;

  let yesCount = 0;
  hiddenInputs.forEach(input => {
    if (input.value === "true") yesCount++;
  });

  const total = hiddenInputs.length;
  const pct = Math.round((yesCount / total) * 100);

  const scoreEl = document.getElementById('fm-score');
  const badgeEl = document.getElementById('fm-compliance-badge');
  if (scoreEl) scoreEl.textContent = `${pct}% (${yesCount}/${total})`;

  if (badgeEl) {
    if (pct >= 80) {
      badgeEl.style.background = 'rgba(52,211,153,0.15)';
      badgeEl.style.color = '#34d399';
      badgeEl.style.borderColor = 'rgba(52,211,153,0.4)';
    } else if (pct >= 50) {
      badgeEl.style.background = 'rgba(245,158,11,0.15)';
      badgeEl.style.color = '#fbbf24';
      badgeEl.style.borderColor = 'rgba(245,158,11,0.4)';
    } else {
      badgeEl.style.background = 'rgba(239,68,68,0.15)';
      badgeEl.style.color = '#f87171';
      badgeEl.style.borderColor = 'rgba(239,68,68,0.4)';
    }
  }
}

function switchFacTab(clusterId, btnElement) {
  const tabBtns = document.querySelectorAll('.fac-tab-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');

  const clusters = document.querySelectorAll('.fac-cluster-sec');
  clusters.forEach(sec => {
    if (clusterId === 'cluster-all') {
      sec.style.display = 'block';
    } else {
      if (sec.id === clusterId || sec.id === 'cluster-signoff' || sec.id === 'cluster-contingency') {
        sec.style.display = 'block';
      } else {
        sec.style.display = 'none';
      }
    }
  });
}

function openFacilitiesModal(centerId) {
  const centersList = (typeof allCenters !== 'undefined' && allCenters.length) 
    ? allCenters 
    : ((typeof filteredCenters !== 'undefined' && filteredCenters.length) 
        ? filteredCenters 
        : (window.allCenters || window.evacCentersData || []));
  
  const center = typeof centerId === 'object' 
    ? centerId 
    : centersList.find(c => String(c.id) === String(centerId));

  if (!center) {
    if (typeof showToast === 'function') showToast("Evacuation center not found", "error");
    return;
  }

  const centerIdInput = document.getElementById('fm-center-id');
  if (centerIdInput) centerIdInput.value = center.id;
  const nameEl = document.getElementById('fm-center-name');
  if (nameEl) nameEl.textContent = center.name || 'Evacuation Center';

  // Reset tab to All Items
  const firstTab = document.querySelector('.fac-tab-btn');
  if (firstTab) switchFacTab('cluster-all', firstTab);

  // Clear previous error borders
  document.querySelectorAll('.fac-input').forEach(inp => inp.classList.remove('fac-input-error'));

  // Load existing facilities_checklist if present
  const fc = center.facilities_checklist || {};
  
  if (fc && Object.keys(fc).length > 0) {
    // Populate form from stored data
    for (const [key, val] of Object.entries(fc)) {
      const el = document.getElementById(key);
      if (!el) continue;
      if (el.type === 'hidden' && key.startsWith('fac_')) {
        const isYes = (val === true || val === 'true');
        el.value = isYes ? "true" : "false";
        const group = el.closest('.fac-toggle-group');
        if (group) {
          const btnYes = group.querySelector('.fac-btn-yes');
          const btnNo = group.querySelector('.fac-btn-no');
          group.querySelectorAll('.fac-btn').forEach(b => b.classList.remove('active'));
          if (isYes && btnYes) btnYes.classList.add('active');
          if (!isYes && btnNo) btnNo.classList.add('active');
        }
      } else {
        el.value = val !== undefined && val !== null ? val : '';
      }
    }
    // Sign-off
    if (fc.prepared_by) {
      if (document.getElementById('fac_prep_fn')) document.getElementById('fac_prep_fn').value = fc.prepared_by.first_name || '';
      if (document.getElementById('fac_prep_mn')) document.getElementById('fac_prep_mn').value = fc.prepared_by.middle_name || '';
      if (document.getElementById('fac_prep_ln')) document.getElementById('fac_prep_ln').value = fc.prepared_by.last_name || '';
      if (document.getElementById('fac_prep_suf')) document.getElementById('fac_prep_suf').value = fc.prepared_by.suffix || '';
      if (document.getElementById('fac_prep_desig')) document.getElementById('fac_prep_desig').value = fc.prepared_by.designation || '';
    }
    if (fc.approved_by) {
      if (document.getElementById('fac_appr_fn')) document.getElementById('fac_appr_fn').value = fc.approved_by.first_name || '';
      if (document.getElementById('fac_appr_mn')) document.getElementById('fac_appr_mn').value = fc.approved_by.middle_name || '';
      if (document.getElementById('fac_appr_ln')) document.getElementById('fac_appr_ln').value = fc.approved_by.last_name || '';
      if (document.getElementById('fac_appr_suf')) document.getElementById('fac_appr_suf').value = fc.approved_by.suffix || '';
      if (document.getElementById('fac_appr_desig')) document.getElementById('fac_appr_desig').value = fc.approved_by.designation || '';
    }
  } else {
    // Auto populate defaults for presentation
    autoFillFacilitiesDemoData(false);
  }

  // Ensure Contingency Plan and Camp Layout File Info are populated if blank
  const contingencyPlanEl = document.getElementById('fac_contingency_plan');
  if (contingencyPlanEl && !contingencyPlanEl.value.trim()) {
    autoGenerateContingencyPlan(false);
  }
  const fileInfoEl = document.getElementById('camp-layout-file-info');
  if (fileInfoEl && (!fileInfoEl.textContent.trim() || fileInfoEl.style.display === 'none')) {
    fileInfoEl.style.display = 'block';
    fileInfoEl.innerHTML = '<i data-lucide="file-check" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Uploaded: Linao_Gym_Camp_Layout_2026.png (1.20 MB)';
  }

  calculateFacScore();

  const overlay = document.getElementById('facilities-modal-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }
}

function closeFacilitiesModal() {
  const overlay = document.getElementById('facilities-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

function closeFacilitiesModalOutside(event) {
  if (event.target.id === 'facilities-modal-overlay') {
    closeFacilitiesModal();
  }
}

function autoFillFacilitiesDemoData(showToastMsg = true) {
  // Set all toggles to YES
  const hiddenToggles = document.querySelectorAll('#facilities-modal-form input[type="hidden"][name^="fac_"]');
  hiddenToggles.forEach(inp => {
    const btnYes = inp.parentElement.querySelector('.fac-btn-yes');
    setFacToggle(inp.id, true, btnYes);
  });

  // Items descriptions & quantities
  setVal('fac_1_desc', 'Weatherproof bulletin board posted at main entrance with Camp Rules & Evacuee Directory.');
  setVal('fac_2_rooms', 14);
  setVal('fac_2_tents_count', 40);
  setVal('fac_3_desc', 'Stationed at Lobby 1 with 24/7 BDRRM Helpdesk, Public Address System & Incident Logbook.');
  setVal('fac_4_desc', 'Equipped with 4 LPG heavy-duty stoves, stainless washing sinks & stainless food preparation tables.');
  setVal('fac_5_min_cap', '50 sacks / 5 metric tons');
  setVal('fac_5_max_cap', '250 sacks / 25 metric tons');
  setVal('fac_6_potable_src', 'PrimeWater Utility Tap + 2 Stainless Water Refilling Stations');
  setVal('fac_6_nonpotable_src', 'Deepwell Pump + 10,000L Overhead Water Tanker');
  
  // Item 7 Toilets
  setVal('fac_7_female_toilets', 8);
  setVal('fac_7_male_toilets', 6);
  setVal('fac_7_pwd_toilets', 2);

  // Item 8 & 9
  setVal('fac_8_count', 8);
  setVal('fac_9_count', 4);

  // Item 10, 11, 12, 16
  setVal('fac_10_desc', 'On-site Barangay Health Station with 1 Resident Physician & 2 Registered Nurses on 12-hr shifts.');
  setVal('fac_11_qty', 2);
  setVal('fac_12_desc', '2 private air-conditioned rooms at Wing B for rotating IDP family accommodation.');
  setVal('fac_16_desc', 'Concrete 1:12 slope wheelchair ramp with stainless dual handrails at main entrance.');

  // Item 13, 14, 15, 17
  setVal('fac_13_desc', 'Dedicated 40sqm air-conditioned classroom with UNICEF CFS kit, art supplies & reading materials.');
  setVal('fac_14_desc', 'Secured private room with counseling tables, hygiene kits & DSWD-trained WFS focal person.');
  setVal('fac_15_desc', 'Quiet multi-faith prayer area equipped with prayer mats, Bibles, and Holy Qurans.');
  setVal('fac_17_desc', 'Fenced 150sqm animal holding pen located 60m away from accommodation wing with vet monitoring.');

  // Item 18, 20
  setVal('fac_18_desc', 'Segregated MRF trash bins (Biodegradable, Non-bio, Hazardous) with daily City Environment collection.');
  setVal('fac_20_custom', 'Free Wi-Fi Hotspot, Solar Power Bank Charging Station, Disaster Radio Station');
  setVal('fac_20_report', 'Building inspected and certified structurally sound by City Engineering (JMC2 Audit Passed 2025).');

  // Contingency Plan & Camp Layout File Demo Data
  setVal('fac_contingency_plan', 'Ex: 1. LGU will Deploy the standby 10pcs Portable Toilets to EC\n2. BDRRMC to set up modular partitions for MHPSS area and mobile water refilling station.');
  const fileInfo = document.getElementById('camp-layout-file-info');
  if (fileInfo) {
    fileInfo.style.display = 'block';
    fileInfo.innerHTML = '<i data-lucide="file-check" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Uploaded: Linao_Gym_Camp_Layout_2026.png (1.20 MB)';
    if (window.lucide) lucide.createIcons();
  }

  // Sign-off Prepared & Approved By
  setVal('fac_prep_fn', 'Ramon');
  setVal('fac_prep_mn', 'Santos');
  setVal('fac_prep_ln', 'Cruz');
  setVal('fac_prep_suf', '');
  setVal('fac_prep_desig', 'BDRRMC Assessment Officer');

  setVal('fac_appr_fn', 'Hon. Maria');
  setVal('fac_appr_mn', 'Elena');
  setVal('fac_appr_ln', 'Santos');
  setVal('fac_appr_suf', '');
  setVal('fac_appr_desig', 'Punong Barangay / LGU Camp Chairman');

  calculateFacScore();

  if (showToastMsg) {
    showToast("JMC2 Standard Facilities Checklist populated with sample compliance data!", "success");
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function triggerFacilitiesSaveFlow() {
  // Strict Validation for Required Number Fields (Item 7 Toilet Capacities)
  const reqFields = [
    { id: 'fac_7_female_toilets', name: 'No. of Female Toilets' },
    { id: 'fac_7_male_toilets', name: 'No. of Male Toilets' },
    { id: 'fac_7_pwd_toilets', name: 'No. of PWD Toilets' }
  ];

  let hasError = false;
  reqFields.forEach(f => {
    const input = document.getElementById(f.id);
    if (!input || input.value.trim() === '' || isNaN(Number(input.value)) || Number(input.value) < 0) {
      if (input) input.classList.add('fac-input-error');
      hasError = true;
    } else {
      if (input) input.classList.remove('fac-input-error');
    }
  });

  if (hasError) {
    if (typeof showToast === 'function') showToast("Please fill in required toilet capacities with valid non-negative numbers.", "error");
    const washTab = document.querySelectorAll('.fac-tab-btn')[2];
    if (washTab) switchFacTab('cluster-wash', washTab);
    return;
  }

  // Copy or auto-populate Sign-off popup fields
  const pFn = document.getElementById('fac_prep_fn')?.value.trim() || 'Ramon';
  const pMn = document.getElementById('fac_prep_mn')?.value.trim() || 'Santos';
  const pLn = document.getElementById('fac_prep_ln')?.value.trim() || 'Cruz';
  const pSuf = document.getElementById('fac_prep_suf')?.value.trim() || '';
  const pDesig = document.getElementById('fac_prep_desig')?.value.trim() || 'BDRRMC Assessment Officer';

  const aFn = document.getElementById('fac_appr_fn')?.value.trim() || 'Hon. Maria';
  const aMn = document.getElementById('fac_appr_mn')?.value.trim() || 'Elena';
  const aLn = document.getElementById('fac_appr_ln')?.value.trim() || 'Santos';
  const aSuf = document.getElementById('fac_appr_suf')?.value.trim() || '';
  const aDesig = document.getElementById('fac_appr_desig')?.value.trim() || 'Punong Barangay / LGU Camp Chairman';

  if (document.getElementById('popup_fac_prep_fn')) document.getElementById('popup_fac_prep_fn').value = pFn;
  if (document.getElementById('popup_fac_prep_mn')) document.getElementById('popup_fac_prep_mn').value = pMn;
  if (document.getElementById('popup_fac_prep_ln')) document.getElementById('popup_fac_prep_ln').value = pLn;
  if (document.getElementById('popup_fac_prep_suf')) document.getElementById('popup_fac_prep_suf').value = pSuf;
  if (document.getElementById('popup_fac_prep_desig')) document.getElementById('popup_fac_prep_desig').value = pDesig;

  if (document.getElementById('popup_fac_appr_fn')) document.getElementById('popup_fac_appr_fn').value = aFn;
  if (document.getElementById('popup_fac_appr_mn')) document.getElementById('popup_fac_appr_mn').value = aMn;
  if (document.getElementById('popup_fac_appr_ln')) document.getElementById('popup_fac_appr_ln').value = aLn;
  if (document.getElementById('popup_fac_appr_suf')) document.getElementById('popup_fac_appr_suf').value = aSuf;
  if (document.getElementById('popup_fac_appr_desig')) document.getElementById('popup_fac_appr_desig').value = aDesig;

  // Open Pop-up Modal for Official Sign-off & Approval
  const overlay = document.getElementById('facilities-signoff-modal-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('active');
    if (window.lucide) lucide.createIcons();
  }
}

function closeFacilitiesSignoffModal() {
  const overlay = document.getElementById('facilities-signoff-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
}

async function confirmAndSubmitFacilitiesChecklist() {
  // Sync popup values to main form inputs
  if (document.getElementById('fac_prep_fn')) document.getElementById('fac_prep_fn').value = document.getElementById('popup_fac_prep_fn')?.value.trim() || '';
  if (document.getElementById('fac_prep_mn')) document.getElementById('fac_prep_mn').value = document.getElementById('popup_fac_prep_mn')?.value.trim() || '';
  if (document.getElementById('fac_prep_ln')) document.getElementById('fac_prep_ln').value = document.getElementById('popup_fac_prep_ln')?.value.trim() || '';
  if (document.getElementById('fac_prep_suf')) document.getElementById('fac_prep_suf').value = document.getElementById('popup_fac_prep_suf')?.value.trim() || '';
  if (document.getElementById('fac_prep_desig')) document.getElementById('fac_prep_desig').value = document.getElementById('popup_fac_prep_desig')?.value.trim() || '';

  if (document.getElementById('fac_appr_fn')) document.getElementById('fac_appr_fn').value = document.getElementById('popup_fac_appr_fn')?.value.trim() || '';
  if (document.getElementById('fac_appr_mn')) document.getElementById('fac_appr_mn').value = document.getElementById('popup_fac_appr_mn')?.value.trim() || '';
  if (document.getElementById('fac_appr_ln')) document.getElementById('fac_appr_ln').value = document.getElementById('popup_fac_appr_ln')?.value.trim() || '';
  if (document.getElementById('fac_appr_suf')) document.getElementById('fac_appr_suf').value = document.getElementById('popup_fac_appr_suf')?.value.trim() || '';
  if (document.getElementById('fac_appr_desig')) document.getElementById('fac_appr_desig').value = document.getElementById('popup_fac_appr_desig')?.value.trim() || '';

  closeFacilitiesSignoffModal();
  await submitFacilitiesChecklist();
}

async function submitFacilitiesChecklist() {
  const centerId = document.getElementById('fm-center-id').value;
  if (!centerId) {
    showToast("Invalid Evacuation Center ID", "error");
    return;
  }

  // Strict Validation for Required Number Fields (Item 7 Toilet Capacities)
  const reqFields = [
    { id: 'fac_7_female_toilets', name: 'No. of Female Toilets' },
    { id: 'fac_7_male_toilets', name: 'No. of Male Toilets' },
    { id: 'fac_7_pwd_toilets', name: 'No. of PWD Toilets' }
  ];

  let hasError = false;
  reqFields.forEach(f => {
    const input = document.getElementById(f.id);
    if (!input || input.value.trim() === '' || isNaN(Number(input.value)) || Number(input.value) < 0) {
      if (input) input.classList.add('fac-input-error');
      hasError = true;
    } else {
      if (input) input.classList.remove('fac-input-error');
    }
  });

  if (hasError) {
    showToast("Please fill in required toilet capacities with valid non-negative numbers.", "error");
    // Switch to WASH tab so user sees error fields
    const washTab = document.querySelectorAll('.fac-tab-btn')[2];
    if (washTab) switchFacTab('cluster-wash', washTab);
    return;
  }

  // Gather Form Data
  const formData = {};
  const inputs = document.querySelectorAll('#facilities-modal-form input, #facilities-modal-form textarea');
  inputs.forEach(inp => {
    if (!inp.id) return;
    if (inp.type === 'hidden' && inp.id.startsWith('fac_')) {
      formData[inp.id] = inp.value === 'true';
    } else if (inp.type === 'number') {
      formData[inp.id] = inp.value !== '' ? Number(inp.value) : 0;
    } else {
      formData[inp.id] = inp.value.trim();
    }
  });

  // Sign-off data
  const prepared_by = {
    first_name: document.getElementById('fac_prep_fn')?.value.trim() || '',
    middle_name: document.getElementById('fac_prep_mn')?.value.trim() || '',
    last_name: document.getElementById('fac_prep_ln')?.value.trim() || '',
    suffix: document.getElementById('fac_prep_suf')?.value.trim() || '',
    designation: document.getElementById('fac_prep_desig')?.value.trim() || ''
  };

  const approved_by = {
    first_name: document.getElementById('fac_appr_fn')?.value.trim() || '',
    middle_name: document.getElementById('fac_appr_mn')?.value.trim() || '',
    last_name: document.getElementById('fac_appr_ln')?.value.trim() || '',
    suffix: document.getElementById('fac_appr_suf')?.value.trim() || '',
    designation: document.getElementById('fac_appr_desig')?.value.trim() || ''
  };

  const checklistPayload = {
    ...formData,
    prepared_by,
    approved_by,
    updated_at: new Date().toISOString()
  };

  // Build summary text string for facilities field
  const summaryText = `JMC2 Compliant (${document.getElementById('fm-score')?.textContent || '100%'}) | Female Toilets: ${formData.fac_7_female_toilets || 0}, Male: ${formData.fac_7_male_toilets || 0}, PWD: ${formData.fac_7_pwd_toilets || 0}`;

  try {
    if (typeof apiFetch === 'function') {
      await apiFetch(`/evacuation-centers/${centerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          facilities_checklist: checklistPayload,
          facilities: summaryText
        })
      });
    } else if (typeof API !== 'undefined' && API.patch) {
      await API.patch('/evacuation-centers/' + centerId, {
        facilities_checklist: checklistPayload,
        facilities: summaryText
      });
    }
  } catch (err) {
    console.warn("Backend API call failed, persisting to local state fallback:", err);
  }

  // Update local data arrays for instant UI responsiveness
  if (typeof allCenters !== 'undefined') {
    const idx = allCenters.findIndex(c => String(c.id) === String(centerId));
    if (idx !== -1) {
      allCenters[idx].facilities_checklist = checklistPayload;
      allCenters[idx].facilities = summaryText;
    }
  }
  if (typeof filteredCenters !== 'undefined') {
    const idx = filteredCenters.findIndex(c => String(c.id) === String(centerId));
    if (idx !== -1) {
      filteredCenters[idx].facilities_checklist = checklistPayload;
      filteredCenters[idx].facilities = summaryText;
    }
  }

  if (typeof showToast === 'function') {
    showToast("JMC2 Standard Camp Facilities Checklist saved successfully!", "success");
  }

  closeFacilitiesModal();
  if (typeof renderTable === 'function' && typeof allCenters !== 'undefined') {
    renderTable(allCenters);
  }

  addEvacActivityLogEntry({
    center_name: (allCenters.find(c=>String(c.id)===String(centerId))?.name || 'Evacuation Center'),
    event_type: 'checklist_saved',
    description: `JMC2 Standard Facilities Checklist updated (${document.getElementById('fm-score')?.textContent || '100%'}).`,
    performed_by_name: 'BDRRMC Assessment Officer'
  });
}

// =============================================
// Evacuation Tab Switching & Activity Log System
// =============================================

let allEvacLogs = [];

let evacLogPagination = { currentPage: 1, pageSize: 25, filtered: [] };

function addEvacActivityLogEntry(entry) {
  const newLog = {
    id: 'evac-log-' + Date.now(),
    created_at: entry.created_at || new Date().toISOString(),
    center_name: entry.center_name || 'Evacuation Center',
    event_type: entry.event_type || 'status_changed',
    description: entry.description || 'Facility update recorded',
    performed_by_name: entry.performed_by_name || 'BDRRMC Admin',
  };
  allEvacLogs.unshift(newLog);
  if (document.getElementById('pane-evac-logs')?.style.display !== 'none') {
    filterEvacLogs();
  }
}

function switchEvacTab(tab) {
  const isAll = (tab === 'all');
  const btnAll = document.getElementById('tab-all-centers');
  const btnLogs = document.getElementById('tab-evac-logs');
  const paneAll = document.getElementById('pane-all-centers');
  const paneLogs = document.getElementById('pane-evac-logs');

  if (btnAll) btnAll.classList.toggle('active', isAll);
  if (btnLogs) btnLogs.classList.toggle('active', !isAll);
  if (paneAll) paneAll.style.display = isAll ? 'block' : 'none';
  if (paneLogs) paneLogs.style.display = !isAll ? 'block' : 'none';

  if (!isAll) {
    filterEvacLogs();
  }
}

function filterEvacLogs() {
  const search = document.getElementById('evac-log-search')?.value.toLowerCase().trim() || '';
  const event  = document.getElementById('evac-log-filter-event')?.value || '';

  const clearBtn = document.getElementById('btn-clear-evac-log-filters');
  if (clearBtn) clearBtn.style.display = (search || event) ? 'inline-flex' : 'none';

  evacLogPagination.filtered = allEvacLogs.filter(log => {
    if (event && log.event_type !== event) return false;
    if (search) {
      const text = `${log.center_name} ${log.description} ${log.performed_by_name} ${log.event_type}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  evacLogPagination.currentPage = 1;
  renderEvacLogs();
}

function clearEvacLogFilters() {
  const s = document.getElementById('evac-log-search'); if (s) s.value = '';
  const e = document.getElementById('evac-log-filter-event'); if (e) e.value = '';
  filterEvacLogs();
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) {
    return String(iso);
  }
}

function renderEvacLogs() {
  const total = evacLogPagination.filtered.length;
  const pageSize = evacLogPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  if (evacLogPagination.currentPage > totalPages) evacLogPagination.currentPage = totalPages;
  if (evacLogPagination.currentPage < 1) evacLogPagination.currentPage = 1;

  const start = (evacLogPagination.currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageData = evacLogPagination.filtered.slice(start, end);

  const tbody = document.getElementById('evac-logs-tbody');
  if (!tbody) return;

  if (!pageData.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="table-empty" style="text-align:center;padding:2rem;">No evacuation activity logs match the selected filter.</td></tr>`;
  } else {
    const EVENT_BADGES = {
      registered: '<span class="badge badge-blue"><i data-lucide="building-2" style="width:11px;height:11px;"></i> Registered</span>',
      checklist_saved: '<span class="badge badge-green"><i data-lucide="clipboard-check" style="width:11px;height:11px;"></i> JMC2 Audit</span>',
      capacity_updated: '<span class="badge badge-orange"><i data-lucide="users" style="width:11px;height:11px;"></i> Occupancy</span>',
      inspection_passed: '<span class="badge badge-green"><i data-lucide="shield-check" style="width:11px;height:11px;"></i> Certified</span>',
      status_changed: '<span class="badge badge-gray"><i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Status</span>',
    };

    tbody.innerHTML = pageData.map(log => `
      <tr onclick="openEvacLogDetailModal('${log.id}')" style="cursor:pointer;" title="Click to view full activity log record">
        <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap;">${formatDate(log.created_at)}</td>
        <td style="font-weight:700;color:var(--text-main);">${escHtml(log.center_name)}</td>
        <td>${EVENT_BADGES[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}</td>
        <td style="font-size:.82rem;color:var(--text-muted);line-height:1.4;">${escHtml(log.description)}</td>
        <td style="font-size:.8rem;font-weight:600;color:var(--text-main);">${escHtml(log.performed_by_name)}</td>
      </tr>
    `).join('');
  }

  const pagEl = document.getElementById('evac-log-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';

  const info = document.getElementById('evac-log-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${start + 1} to ${end} of ${total} entries`;

  if (window.lucide) lucide.createIcons();
}

function openEvacLogDetailModal(id) {
  const log = allEvacLogs.find(l => String(l.id) === String(id));
  if (!log) return;

  const modalBody = document.getElementById('evac-log-modal-body');
  if (!modalBody) return;

  const dt = log.created_at
    ? new Date(log.created_at).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    : '—';

  const EVENT_BADGES = {
    registered: '<span class="badge badge-blue"><i data-lucide="building-2" style="width:11px;height:11px;"></i> Registered</span>',
    checklist_saved: '<span class="badge badge-green"><i data-lucide="clipboard-check" style="width:11px;height:11px;"></i> JMC2 Audit</span>',
    capacity_updated: '<span class="badge badge-orange"><i data-lucide="users" style="width:11px;height:11px;"></i> Occupancy</span>',
    inspection_passed: '<span class="badge badge-green"><i data-lucide="shield-check" style="width:11px;height:11px;"></i> Certified</span>',
    status_changed: '<span class="badge badge-gray"><i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Status</span>',
  };

  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.2rem;">
      <div style="padding:1rem;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:var(--radius-md);">
        <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;">Evacuation Shelter</div>
        <div style="font-size:1.15rem;font-weight:800;color:var(--text-main);">${escHtml(log.center_name || '—')}</div>
        <div style="font-size:.8rem;color:#60a5fa;margin-top:.25rem;font-weight:600;"><i data-lucide="building" style="width:13px;height:13px;vertical-align:middle;"></i> Shelter Inspection & Audit Trail</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">EVENT TYPE</div>
          <div>${EVENT_BADGES[log.event_type] || `<span class="badge">${escHtml(log.event_type)}</span>`}</div>
        </div>

        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">AUDIT STATUS</div>
          <div><span class="badge badge-blue">Verified Entry</span></div>
        </div>
      </div>

      <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:var(--radius-md);">
        <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;">AUDIT DESCRIPTION & REMARKS</div>
        <div style="font-size:.85rem;color:var(--text-main);line-height:1.5;">${escHtml(log.description || 'No additional notes provided.')}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.78rem;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.08);padding-top:.85rem;">
        <div><strong style="color:var(--text-main);">Logged By:</strong> ${escHtml(log.performed_by_name || 'Evac Inspector')}</div>
        <div style="text-align:right;"><strong style="color:var(--text-main);">Timestamp:</strong> ${escHtml(dt)}</div>
      </div>
    </div>
  `;

  document.getElementById('evac-log-detail-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeEvacLogDetailModal() {
  document.getElementById('evac-log-detail-modal-overlay')?.classList.remove('active');
}

function closeEvacLogDetailModalOutside(event) {
  if (event.target.id === 'evac-log-detail-modal-overlay') closeEvacLogDetailModal();
}

function openEvacCenterDetailModal(id) {
  const center = allCenters.find(c => String(c.id) === String(id));
  if (!center) return;

  const titleEl = document.getElementById('evac-detail-title');
  if (titleEl) titleEl.textContent = center.name || 'Evacuation Shelter Profile';

  const subEl = document.getElementById('evac-detail-subtitle');
  if (subEl) subEl.textContent = `Classification: ${center.type || 'Standard Shelter'} • System ID: #${center.id}`;

  const bodyEl = document.getElementById('evac-detail-body');
  if (!bodyEl) return;

  // Occupancy removed — present capacity and stored status only
  const pct = 0;
  const effStatus = effectiveStatus(center);
  const badgeHtml = STATUS_BADGE[effStatus] || STATUS_BADGE[center.status] || `<span class="badge badge-blue">${center.status}</span>`;

  bodyEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.25rem;">
      
      <!-- Top Banner Specs -->
      <div style="padding:1.1rem 1.25rem;background:rgba(15,23,42,0.7);border:1px solid rgba(59,130,246,0.3);border-radius:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:1.15rem;font-weight:800;color:var(--text-main);">${escHtml(center.name)}</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem;display:flex;align-items:center;gap:.5rem;">
            <i data-lucide="map-pin" style="width:13px;height:13px;color:#60a5fa;"></i> ${escHtml(center.address || 'Barangay Linao, Ormoc City')}
          </div>
        </div>
        <div>
          ${badgeHtml}
        </div>
      </div>

      <!-- Capacity & Area Grid (occupancy hidden) -->
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;text-align:center;">
          <div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:.05em;">Total Capacity</div>
          <div style="font-size:1.25rem;font-weight:800;color:#60a5fa;margin-top:.2rem;">${center.capacity || 0} <span style="font-size:.75rem;font-weight:normal;">Families</span></div>
        </div>

        <div style="padding:.85rem;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;text-align:center;">
          <div style="font-size:.7rem;text-transform:uppercase;color:var(--text-muted);font-weight:700;letter-spacing:.05em;">Status</div>
          <div style="font-size:1.25rem;font-weight:800;color:#34d399;margin-top:.2rem;">${escHtml(effStatus || 'Unknown')} <span style="font-size:.75rem;font-weight:normal;">Status</span></div>
        </div>
      </div>

      <!-- Facility Specs & GIS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:.4rem;">Facility Specifications</div>
          <div style="font-size:.82rem;color:var(--text-main);line-height:1.6;">
            <div><strong>Year Established:</strong> ${center.year_established || 'N/A'}</div>
            <div><strong>Floor Area:</strong> ${center.floor_area_sqm ? `${center.floor_area_sqm} sq.m` : 'N/A'}</div>
            <div><strong>Lot Area:</strong> ${center.lot_area ? `${center.lot_area} sq.m` : 'N/A'}</div>
            <div><strong>Shelter Classification:</strong> ${escHtml(center.type || 'Purpose-Built')}</div>
          </div>
        </div>

        <div style="padding:.85rem;background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
          <div style="font-size:.72rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:.4rem;">GIS Location Coordinates</div>
          <div style="font-size:.82rem;color:var(--text-main);line-height:1.6;">
            <div><strong>Latitude:</strong> <code style="color:#60a5fa;">${center.latitude ? center.latitude.toFixed(6) : 'N/A'}</code></div>
            <div><strong>Longitude:</strong> <code style="color:#60a5fa;">${center.longitude ? center.longitude.toFixed(6) : 'N/A'}</code></div>
            <div><strong>Contact Person:</strong> ${escHtml(center.contact_person || 'Barangay DRRM Officer')}</div>
            <div><strong>Hotline Contact:</strong> ${escHtml(center.contact_number || '0917-000-0000')}</div>
          </div>
        </div>
      </div>

      <!-- Quick Actions Bar -->
      <div style="display:flex;gap:.6rem;margin-top:.2rem;">
        <button class="btn btn-outline-sm" onclick="closeEvacCenterDetailModal(); openPersonnelModal('${center.id}');" style="flex:1;padding:.6rem;font-size:.8rem;justify-content:center;color:#38bdf8;border-color:rgba(56,189,248,0.4);background:rgba(56,189,248,0.12);font-weight:700;">
          <i data-lucide="users" style="width:14px;height:14px;"></i> View Camp Personnel Directory
        </button>
        <button class="btn btn-outline-sm" onclick="closeEvacCenterDetailModal(); openFacilitiesModal('${center.id}');" style="flex:1;padding:.6rem;font-size:.8rem;justify-content:center;color:#34d399;border-color:rgba(52,211,153,0.4);background:rgba(52,211,153,0.12);font-weight:700;">
          <i data-lucide="check-square" style="width:14px;height:14px;"></i> JMC2 Facilities &amp; Contingency
        </button>
      </div>

    </div>
  `;

  const actionsLeftEl = document.getElementById('evac-detail-actions-left');
  if (actionsLeftEl) {
    actionsLeftEl.innerHTML = `
      <button class="btn btn-outline-sm" onclick="closeEvacCenterDetailModal(); openEditModal('${center.id}');">
        <i data-lucide="edit-2"></i> Edit Shelter Specs
      </button>
    `;
  }

  document.getElementById('evac-center-detail-modal-overlay')?.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function closeEvacCenterDetailModal() {
  document.getElementById('evac-center-detail-modal-overlay')?.classList.remove('active');
}

function closeEvacCenterDetailModalOutside(event) {
  if (event.target.id === 'evac-center-detail-modal-overlay') closeEvacCenterDetailModal();
}

function printEvacLogs() {
  window.print();
}
