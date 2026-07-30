// ===== Serialized Asset Registry Module =====

let allAssets = [];
let editingAssetId = null;
let assetPagination = { currentPage: 1, pageSize: 10, filtered: [] };

const CONDITION_BADGE = {
  new:       '<span class="badge" style="background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.3);">New</span>',
  good:      '<span class="badge" style="background:rgba(59,130,246,.15);color:#60a5fa;border:1px solid rgba(59,130,246,.3);">Good</span>',
  fair:      '<span class="badge" style="background:rgba(234,179,8,.15);color:#fbbf24;border:1px solid rgba(234,179,8,.3);">Fair</span>',
  poor:      '<span class="badge" style="background:rgba(249,115,22,.15);color:#fb923c;border:1px solid rgba(249,115,22,.3);">Poor</span>',
  condemned: '<span class="badge badge-red">Condemned</span>',
};

const ASSET_STATUS_BADGE = {
  available:   '<span class="badge badge-green">Available</span>',
  deployed:    '<span class="badge badge-orange">Deployed</span>',
  maintenance: '<span class="badge badge-red">Maintenance</span>',
  retired:     '<span class="badge" style="background:rgba(148,163,184,.15);color:#94a3b8;border:1px solid rgba(148,163,184,.3);">Retired</span>',
};

function escA(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
}

// ---- Load & Render ----

async function loadAssets() {
  try {
    allAssets = await apiFetch('/assets/');
    renderAssetSummary();
    filterAssets();
  } catch (err) {
    console.warn('Asset load failed:', err);
    allAssets = [];
    renderAssetSummary();
    filterAssets();
  }
}

function renderAssetSummary() {
  const total       = allAssets.length;
  const available   = allAssets.filter(a => a.status === 'available').length;
  const deployed    = allAssets.filter(a => a.status === 'deployed').length;
  const maintenance = allAssets.filter(a => a.status === 'maintenance').length;
  const retired     = allAssets.filter(a => a.status === 'retired').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('asset-sum-total',       total);
  set('asset-sum-available',   available);
  set('asset-sum-deployed',    deployed);
  set('asset-sum-maintenance', maintenance);
  set('asset-sum-retired',     retired);
}

function filterAssets() {
  const search    = (document.getElementById('asset-search')?.value || '').toLowerCase();
  const statusF   = document.getElementById('asset-filter-status')?.value || '';
  const condF     = document.getElementById('asset-filter-condition')?.value || '';

  assetPagination.filtered = allAssets.filter(a => {
    const matchSearch = !search
      || (a.property_code || '').toLowerCase().includes(search)
      || (a.serial_number || '').toLowerCase().includes(search)
      || ((a.resources?.name) || '').toLowerCase().includes(search)
      || (a.acquisition_source || '').toLowerCase().includes(search);
    const matchStatus = !statusF || a.status === statusF;
    const matchCond   = !condF   || a.condition === condF;
    return matchSearch && matchStatus && matchCond;
  });

  assetPagination.currentPage = 1;
  renderAssetsPaginated();
}

function renderAssetsPaginated() {
  const total     = assetPagination.filtered.length;
  const pageSize  = assetPagination.pageSize;
  const totalPages = Math.ceil(total / pageSize) || 1;
  assetPagination.currentPage = Math.max(1, Math.min(assetPagination.currentPage, totalPages));

  const start    = (assetPagination.currentPage - 1) * pageSize;
  const end      = Math.min(start + pageSize, total);
  const pageData = assetPagination.filtered.slice(start, end);

  renderAssetTable(pageData);
  updateAssetPaginationBar(total, total === 0 ? 0 : start + 1, end, assetPagination.currentPage, totalPages);
}

function renderAssetTable(data) {
  const tbody  = document.getElementById('assets-tbody');
  const user   = getUser();
  const canEdit = user && ['admin', 'officer'].includes(user.role);

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">No asset units registered yet.</td></tr>`;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = data.map(a => {
    const resName = a.resources?.name || '—';
    const resType = a.resources?.type || '';
    const iconName = {
      rescue_boat: 'sailboat', ambulance: 'ambulance', fire_truck: 'truck',
      medical_kit: 'cross', food_pack: 'utensils', tent: 'tent',
      vehicle: 'truck', fuel: 'fuel', chainsaw: 'zap', other: 'box',
    }[resType] || 'box';

    const acqDate = a.acquisition_date ? fmtDate(a.acquisition_date) : '—';
    const acqSrc  = a.acquisition_source ? escA(a.acquisition_source) : '—';

    return `
    <tr>
      <td>
        <span style="font-family:monospace;font-size:.85rem;font-weight:700;color:var(--primary);">${escA(a.property_code)}</span>
      </td>
      <td>
        <div class="res-name-cell">
          <div class="res-type-icon"><i data-lucide="${iconName}"></i></div>
          <div>
            <div class="incident-title">${escA(resName)}</div>
            ${a.notes ? `<div class="incident-desc" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escA(a.notes)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>
        <span style="font-family:monospace;font-size:.78rem;color:var(--text-muted);">${a.serial_number ? escA(a.serial_number) : '<span style="color:var(--text-muted)">—</span>'}</span>
      </td>
      <td>${CONDITION_BADGE[a.condition] || a.condition}</td>
      <td>${ASSET_STATUS_BADGE[a.status] || a.status}</td>
      <td>
        <div style="font-size:.78rem;">${acqDate}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">${acqSrc}</div>
      </td>
      <td>
        <div class="table-actions">
          ${canEdit ? `
          <button class="action-btn" title="Edit Unit" onclick='openEditAssetModal(${JSON.stringify(a)})'>
            <i data-lucide="pencil"></i>
          </button>` : ''}
          ${canEdit && a.status !== 'retired' ? `
          <button class="action-btn action-btn-warning" title="Mark as Retired" onclick="retireAsset('${a.id}', '${escA(a.property_code)}')">
            <i data-lucide="archive"></i>
          </button>` : ''}
          ${canEdit ? `
          <button class="action-btn action-btn-danger" title="Delete Record" onclick="deleteAsset('${a.id}', '${escA(a.property_code)}')">
            <i data-lucide="trash-2"></i>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  lucide.createIcons();
}

function updateAssetPaginationBar(total, startDisplay, endDisplay, currentPage, totalPages) {
  const info = document.getElementById('asset-pagination-info');
  if (info) info.textContent = total === 0 ? 'Showing 0 of 0 entries' : `Showing ${startDisplay} to ${endDisplay} of ${total} entries`;

  const prevBtn = document.getElementById('asset-btn-prev');
  const nextBtn = document.getElementById('asset-btn-next');
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  const container = document.getElementById('asset-page-numbers');
  if (container) {
    let html = '';
    for (let p = 1; p <= totalPages; p++) {
      if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
        if (p === 2 && currentPage > 4) html += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        else if (p === totalPages - 1 && currentPage < totalPages - 3) html += `<span style="padding:0 .2rem;color:var(--text-muted);">...</span>`;
        continue;
      }
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToAssetPage(${p})">${p}</button>`;
    }
    container.innerHTML = html;
  }

  const pagEl = document.getElementById('asset-pagination');
  if (pagEl) pagEl.style.display = total === 0 ? 'none' : 'flex';
}

function changeAssetPageSize(val) { assetPagination.pageSize = parseInt(val,10); assetPagination.currentPage = 1; renderAssetsPaginated(); }
function prevAssetPage() { if (assetPagination.currentPage > 1) { assetPagination.currentPage--; renderAssetsPaginated(); } }
function nextAssetPage() { const t = Math.ceil(assetPagination.filtered.length / assetPagination.pageSize) || 1; if (assetPagination.currentPage < t) { assetPagination.currentPage++; renderAssetsPaginated(); } }
function goToAssetPage(p) { assetPagination.currentPage = p; renderAssetsPaginated(); }

// ---- Modal: Add / Edit ----

async function openAddAssetModal() {
  editingAssetId = null;
  document.getElementById('asset-modal-title').innerHTML = '<i data-lucide="tag"></i> Register Asset Unit';
  document.getElementById('asset-submit-label').textContent = 'Register Unit';
  document.getElementById('asset-form').reset();
  document.getElementById('a-id').value = '';
  document.getElementById('asset-error').style.display = 'none';
  await populateAssetResourceDropdown();
  document.getElementById('asset-modal-overlay').classList.add('active');
  lucide.createIcons();
}

function openEditAssetModal(asset) {
  editingAssetId = asset.id;
  document.getElementById('asset-modal-title').innerHTML = '<i data-lucide="pencil"></i> Edit Asset Unit';
  document.getElementById('asset-submit-label').textContent = 'Save Changes';
  document.getElementById('a-id').value              = asset.id;
  document.getElementById('a-property-code').value   = asset.property_code || '';
  document.getElementById('a-serial-number').value   = asset.serial_number || '';
  document.getElementById('a-condition').value        = asset.condition || 'good';
  document.getElementById('a-status').value           = asset.status || 'available';
  document.getElementById('a-acquisition-date').value = asset.acquisition_date ? asset.acquisition_date.substring(0,10) : '';
  document.getElementById('a-acquisition-source').value = asset.acquisition_source || '';
  document.getElementById('a-notes').value            = asset.notes || '';
  document.getElementById('asset-error').style.display = 'none';
  populateAssetResourceDropdown(asset.resource_id);
  document.getElementById('asset-modal-overlay').classList.add('active');
  lucide.createIcons();
}

async function populateAssetResourceDropdown(selectedId) {
  const sel = document.getElementById('a-resource-id');
  if (!allResources.length) {
    sel.innerHTML = '<option value="">— No resources in inventory —</option>';
    return;
  }
  // Group by category for easier selection
  const grouped = {};
  allResources.forEach(r => {
    const cat = r.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(r);
  });
  const CAT_LABEL = {
    disaster: 'Flood & Typhoon', fire: 'Fire Suppression',
    earthquake: 'Earthquake & Landslide', medical: 'Medical Emergency',
    emergency: 'All-Hazard / General', police: 'Police', other: 'Other',
  };
  let html = '<option value="">Select resource...</option>';
  for (const [cat, items] of Object.entries(grouped)) {
    html += `<optgroup label="${CAT_LABEL[cat] || cat}">`;
    items.forEach(r => {
      html += `<option value="${r.id}" ${r.id === selectedId ? 'selected' : ''}>${escA(r.name)}</option>`;
    });
    html += '</optgroup>';
  }
  sel.innerHTML = html;
}

function closeAssetModal() {
  document.getElementById('asset-modal-overlay').classList.remove('active');
  editingAssetId = null;
}

function closeAssetModalOutside(e) {
  if (e.target === document.getElementById('asset-modal-overlay')) closeAssetModal();
}

async function autoFillPropertyCode() {
  try {
    const res = await apiFetch('/assets/generate/code');
    document.getElementById('a-property-code').value = res.property_code;
  } catch (_) {
    // Fallback: generate client-side
    const year   = new Date().getFullYear();
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    document.getElementById('a-property-code').value = `BRG-${year}-${suffix}`;
  }
}

async function submitAsset() {
  const errorEl = document.getElementById('asset-error');
  errorEl.style.display = 'none';

  const resourceId      = document.getElementById('a-resource-id').value;
  const propertyCode    = document.getElementById('a-property-code').value.trim();
  const serialNumber    = document.getElementById('a-serial-number').value.trim();
  const condition       = document.getElementById('a-condition').value;
  const assetStatus     = document.getElementById('a-status').value;
  const acquisitionDate = document.getElementById('a-acquisition-date').value;
  const acquisitionSrc  = document.getElementById('a-acquisition-source').value.trim();
  const notes           = document.getElementById('a-notes').value.trim();

  if (!resourceId || !propertyCode) {
    errorEl.textContent = 'Resource and Property Code are required.';
    errorEl.style.display = 'block';
    return;
  }

  const payload = {
    resource_id: resourceId,
    property_code: propertyCode,
    serial_number: serialNumber || null,
    condition,
    status: assetStatus,
    acquisition_date: acquisitionDate || null,
    acquisition_source: acquisitionSrc || null,
    notes: notes || null,
  };

  try {
    if (editingAssetId) {
      await apiFetch(`/assets/${editingAssetId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      showToast('Asset unit updated!', 'success', 'Saved');
    } else {
      await apiFetch('/assets/', { method: 'POST', body: JSON.stringify(payload) });
      showToast(`Asset unit ${propertyCode} registered!`, 'success', 'Asset Registered');
    }
    closeAssetModal();
    await loadAssets();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

// ---- Retire & Delete ----

function retireAsset(id, code) {
  confirmAction({
    title: 'Retire Asset Unit?',
    message: `Mark <strong>${code}</strong> as Retired? This means the unit is no longer operational.`,
    confirmText: 'Retire Unit',
    type: 'primary',
    icon: 'archive',
    onConfirm: async () => {
      try {
        await apiFetch(`/assets/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'retired' }),
        });
        showToast(`${code} marked as retired.`, 'info', 'Asset Retired');
        await loadAssets();
      } catch (err) {
        showToast('Failed: ' + err.message, 'danger', 'Error');
      }
    },
  });
}

function deleteAsset(id, code) {
  confirmAction({
    title: 'Delete Asset Record?',
    message: `Permanently delete the record for <strong>${code}</strong>? This cannot be undone.`,
    confirmText: 'Delete',
    type: 'primary',
    icon: 'trash-2',
    onConfirm: async () => {
      try {
        await apiFetch(`/assets/${id}`, { method: 'DELETE' });
        showToast(`${code} deleted from registry.`, 'info', 'Record Deleted');
        await loadAssets();
      } catch (err) {
        showToast('Failed: ' + err.message, 'danger', 'Error');
      }
    },
  });
}

// ---- Resource filter dropdown ----

function populateAssetResourceFilter() {
  const sel = document.getElementById('asset-filter-resource');
  if (!sel || !allResources.length) return;
  sel.innerHTML = '<option value="">All Equipment</option>' +
    allResources.map(r =>
      `<option value="${r.id}">${escA(r.name)}</option>`
    ).join('');
}

// Override filterAssets to also handle resource filter
const _baseFilterAssets = filterAssets;
filterAssets = function () {
  const search    = (document.getElementById('asset-search')?.value || '').toLowerCase();
  const statusF   = document.getElementById('asset-filter-status')?.value || '';
  const condF     = document.getElementById('asset-filter-condition')?.value || '';
  const resF      = document.getElementById('asset-filter-resource')?.value || '';

  assetPagination.filtered = allAssets.filter(a => {
    const matchSearch = !search
      || (a.property_code || '').toLowerCase().includes(search)
      || (a.serial_number || '').toLowerCase().includes(search)
      || ((a.resources?.name) || '').toLowerCase().includes(search)
      || (a.acquisition_source || '').toLowerCase().includes(search);
    const matchStatus = !statusF || a.status === statusF;
    const matchCond   = !condF   || a.condition === condF;
    const matchRes    = !resF    || a.resource_id === resF;
    return matchSearch && matchStatus && matchCond && matchRes;
  });

  assetPagination.currentPage = 1;
  renderAssetsPaginated();
};
