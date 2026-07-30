// ===== Map Layer Management Panel =====
// Runs inside the left slide-in panel on map.html

let mAllHazard = [], mAllEvac = [], mAllIncidents = [], mAllHospitals = [], mAllStations = [], mAllRoads = [];
let mCurrentForm = null;   // 'hazard' | 'evac' | 'incident' | 'hospital' | 'station'
let mEditingId   = null;
let managePanelOpen = false;

// Note: RISK_COLOR, STATION_LABEL, REASON_LABEL are declared in map.js
const MRISK_COLOR   = { low:'#2e7d32', medium:'#f9a825', high:'#e65100', very_high:'#d93025' };
const MSTATION_LABEL = { bdrrmc:'BDRRMC', fire_station:'Fire Station', police:'Police', bhs:'BHS', coast_guard:'Coast Guard', other:'Other' };
const MREASON_LABEL  = { flood:'Flood', landslide:'Landslide', road_work:'Road Work', accident:'Accident', other:'Other' };

function escH(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g, '&#39;');
}

// Helper to calculate polyline/polygon centroid
function getPolyCenter(coords) {
  if (!coords || !coords.length) return [11.0167, 124.5915];
  let sumLat = 0, sumLng = 0;
  coords.forEach(([lng, lat]) => {
    sumLat += lat;
    sumLng += lng;
  });
  return [sumLat / coords.length, sumLng / coords.length];
}

// Move map smoothly to a layer item location
function mMoveToMap(lat, lng, zoom = 17, title = '') {
  if (typeof map !== 'undefined' && map && lat && lng) {
    let targetLat = Number(lat);
    let targetLng = Number(lng);
    if (targetLat < 11.0100 || targetLat > 11.0270 || targetLng < 124.5820 || targetLng > 124.5980) {
      targetLat = Math.min(11.0250, Math.max(11.0110, targetLat));
      targetLng = Math.min(124.5960, Math.max(124.5840, targetLng));
    }
    map.flyTo([targetLat, targetLng], zoom, { duration: 1.2 });
    if (typeof showToast === 'function') {
      showToast(`Moved map to ${title || 'location'}`, 'info');
    }
  }
}

// Helper to get fallback data if available
function getFallback() {
  if (typeof FALLBACK_LINAO_DATA !== 'undefined' && FALLBACK_LINAO_DATA) {
    return FALLBACK_LINAO_DATA;
  }
  return { hazard_zones: [], evacuation_centers: [], incidents: [], hospitals: [], responder_stations: [], road_closures: [] };
}

// =============================================
// Panel open / close
// =============================================
async function toggleManagePanel() {
  const panel = document.getElementById('manage-panel');
  if (!panel) return;
  managePanelOpen = !managePanelOpen;
  panel.classList.toggle('open', managePanelOpen);

  const mapWrapper = document.querySelector('.map-wrapper');
  if (mapWrapper) {
    mapWrapper.classList.toggle('manage-open', managePanelOpen);
  }
  
  if (typeof map !== 'undefined' && map) {
    setTimeout(() => map.invalidateSize(), 260);
  }

  if (managePanelOpen) {
    const layerPanel = document.querySelector('.layer-panel') || document.querySelector('.pub-toggles');
    if (layerPanel) layerPanel.classList.add('collapsed');
    try {
      await loadAllManage();
    } catch (err) {
      console.warn('Notice loading manage data:', err);
    }
  }
}

function switchManageTab(tab) {
  ['hazard','evac','incidents','hospitals','stations','roads'].forEach(t => {
    const pane = document.getElementById(`mpane-${t}`);
    const tabBtn = document.getElementById(`mtab-${t}`);
    if (pane) pane.style.display = t === tab ? 'flex' : 'none';
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
}

function showMapManageSkeletons() {
  const ids = ['mhz-list', 'mevac-list', 'minc-list', 'mhosp-list', 'msta-list', 'mrd-list'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="manage-item" style="padding:0.75rem;">
          <div class="skeleton-card" style="width:100%;">
            <div class="skeleton skeleton-title" style="width:60%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:40%;"></div>
          </div>
        </div>
        <div class="manage-item" style="padding:0.75rem;">
          <div class="skeleton-card" style="width:100%;">
            <div class="skeleton skeleton-title" style="width:75%;margin-bottom:6px;"></div>
            <div class="skeleton skeleton-text" style="width:50%;"></div>
          </div>
        </div>`;
    }
  });
}

// =============================================
// Load all data for the panel
// =============================================
async function loadAllManage() {
  showMapManageSkeletons();
  await Promise.all([mLoadHazard(), mLoadEvac(), mLoadIncidents(), mLoadHospitals(), mLoadStations(), mLoadRoads()]);
}

// =============================================
// Hazard Zones
// =============================================
async function mLoadHazard() {
  try {
    mAllHazard = await apiFetch('/map/hazard-zones');
  } catch(e) {
    console.warn('Backend unavailable for hazard zones, using sample data:', e);
    const fb = getFallback();
    mAllHazard = fb.hazard_zones || [];
  }
  mRenderHazard(mAllHazard);
}

function mRenderHazard(data) {
  const el = document.getElementById('mhz-list');
  if (!el) return;
  if (!data || !data.length) { 
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No hazard zones yet.</p>`; 
    if (window.lucide) lucide.createIcons(); 
    return; 
  }
  el.innerHTML = data.map(z => {
    const center = getPolyCenter(z.coordinates);
    return `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${center[0]}, ${center[1]}, 16, '${escH(z.name)}')">
        <span class="manage-item-dot" style="background:${z.type==='flood'?'#0077b6':'#e65100'};"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(z.name)}</div>
          <div class="manage-item-sub">${z.type==='flood'?'Flood':'Landslide'} · <span style="color:${MRISK_COLOR[z.risk_level]||'#e65100'};font-weight:600;">${z.risk_level||'high'} risk</span></div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${center[0]}, ${center[1]}, 16, '${escH(z.name)}')"><i data-lucide="navigation"></i></button>
        <button class="action-btn" title="Edit" onclick="mOpenHazardForm('${z.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteHazard('${z.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterHazard() {
  const input = document.getElementById('mhz-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderHazard(mAllHazard.filter(z => (z.name||'').toLowerCase().includes(s)));
}

function mOpenHazardForm(zoneOrId = null) {
  mCurrentForm = 'hazard';
  let zone = null;
  if (typeof zoneOrId === 'string') {
    zone = mAllHazard.find(z => String(z.id) === String(zoneOrId));
  } else if (zoneOrId && typeof zoneOrId === 'object') {
    zone = zoneOrId;
  }

  mEditingId = zone?.id || null;
  document.getElementById('mform-title').textContent = zone ? 'Edit Hazard Zone' : 'Add Hazard Zone';
  document.getElementById('mform-body').innerHTML = `
    <div class="form-group">
      <label>Name *</label>
      <input type="text" id="mf-hz-name" value="${escH(zone?.name||'')}" placeholder="e.g. Sitio 1 Flood Zone" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Type *</label>
        <select id="mf-hz-type">
          <option value="flood"     ${zone?.type==='flood'?'selected':''}>Flood</option>
          <option value="landslide" ${zone?.type==='landslide'?'selected':''}>Landslide</option>
        </select>
      </div>
      <div class="form-group">
        <label>Risk Level</label>
        <select id="mf-hz-risk">
          <option value="low"       ${zone?.risk_level==='low'?'selected':''}>Low</option>
          <option value="medium"    ${zone?.risk_level==='medium'?'selected':''}>Medium</option>
          <option value="high"      ${(!zone||zone?.risk_level==='high')?'selected':''}>High</option>
          <option value="very_high" ${zone?.risk_level==='very_high'?'selected':''}>Very High</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="mf-hz-desc" rows="2" placeholder="Brief description...">${escH(zone?.description||'')}</textarea>
    </div>
    <div class="form-group">
      <label>Coordinates (GeoJSON) *</label>
      <textarea id="mf-hz-coords" rows="3" placeholder='[[lng,lat],[lng,lat],...]'>${zone ? JSON.stringify(zone.coordinates) : ''}</textarea>
      <button type="button" class="btn" onclick="startPinOnMap()" style="width:100%;margin-top:.4rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.45rem;border-radius:6px;">
        <i data-lucide="map-pin" style="width:14px;height:14px;"></i> Click Map to Add Points
      </button>
    </div>
    <p class="error-msg" id="mf-error" style="display:none;color:var(--danger);font-size:.8rem;margin-top:.5rem;"></p>`;
  showManageForm();
}

async function mDeleteHazard(id) {
  if (!confirm('Delete this hazard zone?')) return;
  try {
    await apiFetch(`/map/hazard-zones/${id}`, { method:'DELETE' });
    await mLoadHazard();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderHazardZones === 'function') renderHazardZones(data.hazard_zones || []);
    } catch(e) {}
  } catch(e) { 
    mAllHazard = mAllHazard.filter(z => String(z.id) !== String(id));
    const fb = getFallback();
    fb.hazard_zones = fb.hazard_zones.filter(z => String(z.id) !== String(id));
    mRenderHazard(mAllHazard);
    if (typeof renderHazardZones === 'function') renderHazardZones(fb.hazard_zones);
  }
}

// =============================================
// Evacuation Centers
// =============================================
async function mLoadEvac() {
  try {
    mAllEvac = await apiFetch('/evacuation-centers/');
  } catch(e) {
    console.warn('Backend unavailable for evacuation centers, using sample data:', e);
    const fb = getFallback();
    mAllEvac = fb.evacuation_centers || [];
  }
  mRenderEvac(mAllEvac);
}

function mRenderEvac(data) {
  const el = document.getElementById('mevac-list');
  if (!el) return;
  if (!data || !data.length) {
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No evacuation centers yet.</p>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  el.innerHTML = data.map(c => `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${c.latitude}, ${c.longitude}, 17, '${escH(c.name)}')">
        <span class="manage-item-dot" style="background:#3b82f6;"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(c.name)}</div>
          <div class="manage-item-sub">${c.current_occupancy||0}/${c.capacity||0} occupied · <span style="text-transform:capitalize;">${c.status||'open'}</span></div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${c.latitude}, ${c.longitude}, 17, '${escH(c.name)}')"><i data-lucide="navigation"></i></button>
        <button class="action-btn" title="Edit" onclick="mOpenEvacForm('${c.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteEvac('${c.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterEvac() {
  const input = document.getElementById('mev-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderEvac(mAllEvac.filter(c => (c.name||'').toLowerCase().includes(s)));
}

function mOpenEvacForm(evacOrId = null) {
  mCurrentForm = 'evac';
  let c = null;
  if (typeof evacOrId === 'string') {
    c = mAllEvac.find(item => String(item.id) === String(evacOrId));
  } else if (evacOrId && typeof evacOrId === 'object') {
    c = evacOrId;
  }

  mEditingId = c?.id || null;
  document.getElementById('mform-title').textContent = c ? 'Edit Evacuation Center' : 'Add Evacuation Center';
  document.getElementById('mform-body').innerHTML = `
    <div class="form-group"><label>Center Name *</label><input type="text" id="mf-ev-name" value="${escH(c?.name||'')}" placeholder="e.g. Barangay Linao Covered Court" /></div>
    <div class="form-group"><label>Address</label><input type="text" id="mf-ev-address" value="${escH(c?.address||'')}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Latitude *</label><input type="number" id="mf-ev-lat" step="any" value="${c?.latitude||''}" placeholder="Click map to set" /></div>
      <div class="form-group"><label>Longitude *</label><input type="number" id="mf-ev-lng" step="any" value="${c?.longitude||''}" placeholder="Click map to set" /></div>
    </div>
    <button type="button" class="btn" onclick="startPinOnMap()" style="width:100%;margin-bottom:.6rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.45rem;border-radius:6px;">
      <i data-lucide="map-pin" style="width:14px;height:14px;"></i> Pin on Map (Click Anywhere)
    </button>
    <div class="form-row">
      <div class="form-group"><label>Capacity *</label><input type="number" id="mf-ev-cap" min="1" value="${c?.capacity||100}" /></div>
      <div class="form-group"><label>Current Occupancy</label><input type="number" id="mf-ev-occ" min="0" value="${c?.current_occupancy||0}" /></div>
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="mf-ev-status">
        <option value="open" ${c?.status==='open'?'selected':''}>Open / Available</option>
        <option value="full" ${c?.status==='full'?'selected':''}>Full</option>
        <option value="closed" ${c?.status==='closed'?'selected':''}>Closed</option>
      </select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Contact Person</label><input type="text" id="mf-ev-contactp" value="${escH(c?.contact_person||'')}" /></div>
      <div class="form-group"><label>Contact Number</label><input type="text" id="mf-ev-contactn" value="${escH(c?.contact_number||'')}" /></div>
    </div>
    <p class="error-msg" id="mf-error" style="display:none;color:var(--danger);font-size:.8rem;margin-top:.5rem;"></p>`;
  showManageForm();
  if (c?.latitude && c?.longitude) setPinLocation(c.latitude, c.longitude);
}

async function mDeleteEvac(id) {
  if (!confirm('Delete this evacuation center?')) return;
  try {
    await apiFetch(`/evacuation-centers/${id}`, { method:'DELETE' });
    await mLoadEvac();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderEvacCenters === 'function') renderEvacCenters(data.evacuation_centers || [], true);
    } catch(e) {}
  } catch(e) {
    mAllEvac = mAllEvac.filter(c => String(c.id) !== String(id));
    const fb = getFallback();
    fb.evacuation_centers = fb.evacuation_centers.filter(c => String(c.id) !== String(id));
    mRenderEvac(mAllEvac);
    if (typeof renderEvacCenters === 'function') renderEvacCenters(fb.evacuation_centers, true);
  }
}

// =============================================
// Incidents
// =============================================
async function mLoadIncidents() {
  try {
    mAllIncidents = await apiFetch('/incidents/');
  } catch(e) {
    console.warn('Backend unavailable for incidents, using sample data:', e);
    const fb = getFallback();
    mAllIncidents = fb.incidents || [];
  }
  mRenderIncidents(mAllIncidents);
}

function mRenderIncidents(data) {
  const el = document.getElementById('minc-list');
  if (!el) return;
  if (!data || !data.length) {
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No incidents yet.</p>`;
    if (window.lucide) lucide.createIcons();
    return;
  }
  const INC_COLOR = { active:'#d93025', reported:'#d93025', responding:'#e65100', in_progress:'#e65100', resolved:'#2e7d32' };
  el.innerHTML = data.map(inc => `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${inc.latitude}, ${inc.longitude}, 17, '${escH(inc.title)}')">
        <span class="manage-item-dot" style="background:${INC_COLOR[inc.status]||'#ef4444'};"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(inc.title)}</div>
          <div class="manage-item-sub">${inc.type||inc.category||'incident'} · <span style="text-transform:capitalize;">${inc.severity||'medium'}</span></div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${inc.latitude}, ${inc.longitude}, 17, '${escH(inc.title)}')"><i data-lucide="navigation"></i></button>
        <button class="action-btn" title="Edit" onclick="mOpenIncidentForm('${inc.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteIncident('${inc.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterIncidents() {
  const input = document.getElementById('minc-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderIncidents(mAllIncidents.filter(inc => (inc.title||'').toLowerCase().includes(s)));
}

function mOpenIncidentForm(incOrId = null) {
  mCurrentForm = 'incident';
  let inc = null;
  if (typeof incOrId === 'string') {
    inc = mAllIncidents.find(item => String(item.id) === String(incOrId));
  } else if (incOrId && typeof incOrId === 'object') {
    inc = incOrId;
  }

  mEditingId = inc?.id || null;
  document.getElementById('mform-title').textContent = inc ? 'Edit Incident' : 'Add Incident';
  document.getElementById('mform-body').innerHTML = `
    <div class="form-group"><label>Incident Title *</label><input type="text" id="mf-in-title" value="${escH(inc?.title||'')}" placeholder="e.g. Flooding near Sitio 2" /></div>
    <div class="form-row">
      <div class="form-group">
        <label>Category *</label>
        <select id="mf-in-type">
          <option value="flood" ${inc?.type==='flood'||inc?.category==='flood'?'selected':''}>Flood</option>
          <option value="landslide" ${inc?.type==='landslide'||inc?.category==='landslide'?'selected':''}>Landslide</option>
          <option value="fire" ${inc?.type==='fire'||inc?.category==='fire'?'selected':''}>Fire</option>
          <option value="typhoon" ${inc?.type==='typhoon'||inc?.category==='typhoon'?'selected':''}>Typhoon</option>
          <option value="medical" ${inc?.type==='medical'||inc?.category==='medical'?'selected':''}>Medical</option>
          <option value="other" ${inc?.type==='other'||inc?.category==='other'?'selected':''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label>Severity</label>
        <select id="mf-in-sev">
          <option value="low" ${inc?.severity==='low'?'selected':''}>Low</option>
          <option value="medium" ${(!inc||inc?.severity==='medium')?'selected':''}>Medium</option>
          <option value="high" ${inc?.severity==='high'?'selected':''}>High</option>
          <option value="critical" ${inc?.severity==='critical'?'selected':''}>Critical</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Status</label>
      <select id="mf-in-status">
        <option value="active" ${inc?.status==='active'||inc?.status==='reported'?'selected':''}>Active / Reported</option>
        <option value="responding" ${inc?.status==='responding'||inc?.status==='in_progress'?'selected':''}>Responding</option>
        <option value="resolved" ${inc?.status==='resolved'?'selected':''}>Resolved</option>
      </select>
    </div>
    <div class="form-group">
      <label>Location / Address</label>
      <input type="text" id="mf-in-location" value="${escH(inc?.location||'')}" placeholder="Auto-detected on map click..." />
    </div>
    <div class="form-row">
      <div class="form-group"><label>Latitude *</label><input type="number" id="mf-in-lat" step="any" value="${inc?.latitude||''}" placeholder="Click map to set" /></div>
      <div class="form-group"><label>Longitude *</label><input type="number" id="mf-in-lng" step="any" value="${inc?.longitude||''}" placeholder="Click map to set" /></div>
    </div>
    <button type="button" class="btn" onclick="startPinOnMap()" style="width:100%;margin-bottom:.6rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.45rem;border-radius:6px;">
      <i data-lucide="map-pin" style="width:14px;height:14px;"></i> Pin on Map (Click Anywhere)
    </button>
    <div class="form-group"><label>Description</label><textarea id="mf-in-desc" rows="2">${escH(inc?.description||'')}</textarea></div>
    <p class="error-msg" id="mf-error" style="display:none;color:var(--danger);font-size:.8rem;margin-top:.5rem;"></p>`;
  showManageForm();
  if (inc?.latitude && inc?.longitude) setPinLocation(inc.latitude, inc.longitude);
}

async function mDeleteIncident(id) {
  if (!confirm('Delete this incident?')) return;
  try {
    await apiFetch(`/incidents/${id}`, { method:'DELETE' });
    await mLoadIncidents();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderIncidents === 'function') renderIncidents(data.incidents || [], true);
    } catch(e) {}
  } catch(e) {
    mAllIncidents = mAllIncidents.filter(inc => String(inc.id) !== String(id));
    const fb = getFallback();
    fb.incidents = fb.incidents.filter(inc => String(inc.id) !== String(id));
    mRenderIncidents(mAllIncidents);
    if (typeof renderIncidents === 'function') renderIncidents(fb.incidents, true);
  }
}

// =============================================
// Hospitals
// =============================================
async function mLoadHospitals() {
  try {
    mAllHospitals = await apiFetch('/map/hospitals');
  } catch(e) {
    console.warn('Backend unavailable for hospitals, using sample data:', e);
    const fb = getFallback();
    mAllHospitals = fb.hospitals || [];
  }
  mRenderHospitals(mAllHospitals);
}

function mRenderHospitals(data) {
  const el = document.getElementById('mhosp-list');
  if (!el) return;
  if (!data || !data.length) { 
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No hospitals yet.</p>`; 
    if (window.lucide) lucide.createIcons(); 
    return; 
  }
  el.innerHTML = data.map(h => `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${h.latitude}, ${h.longitude}, 17, '${escH(h.name)}')">
        <span class="manage-item-dot" style="background:#2e7d32;"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(h.name)}</div>
          <div class="manage-item-sub">${h.address ? escH(h.address) : '—'}</div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${h.latitude}, ${h.longitude}, 17, '${escH(h.name)}')"><i data-lucide="navigation"></i></button>
        <button class="action-btn" title="Edit" onclick="mOpenHospitalForm('${h.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteHospital('${h.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterHospitals() {
  const input = document.getElementById('mhosp-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderHospitals(mAllHospitals.filter(h => (h.name||'').toLowerCase().includes(s) || (h.address||'').toLowerCase().includes(s)));
}

function mOpenHospitalForm(hOrId = null) {
  mCurrentForm = 'hospital';
  let h = null;
  if (typeof hOrId === 'string') {
    h = mAllHospitals.find(item => String(item.id) === String(hOrId));
  } else if (hOrId && typeof hOrId === 'object') {
    h = hOrId;
  }

  mEditingId = h?.id || null;
  document.getElementById('mform-title').textContent = h ? 'Edit Hospital' : 'Add Hospital';
  document.getElementById('mform-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="mf-h-name" value="${escH(h?.name||'')}" /></div>
    <div class="form-group"><label>Address</label><input type="text" id="mf-h-address" value="${escH(h?.address||'')}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Latitude *</label><input type="number" id="mf-h-lat" step="any" value="${h?.latitude||''}" placeholder="Click map to set" /></div>
      <div class="form-group"><label>Longitude *</label><input type="number" id="mf-h-lng" step="any" value="${h?.longitude||''}" placeholder="Click map to set" /></div>
    </div>
    <button type="button" class="btn" onclick="startPinOnMap()" style="width:100%;margin-bottom:.6rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.45rem;border-radius:6px;">
      <i data-lucide="map-pin" style="width:14px;height:14px;"></i> Pin on Map (Click Anywhere)
    </button>
    <div class="form-group"><label>Contact Number</label><input type="text" id="mf-h-contact" value="${escH(h?.contact_number||'')}" /></div>
    <div class="form-group"><label>Services</label><input type="text" id="mf-h-services" value="${escH(h?.services||'')}" placeholder="Emergency, Surgery..." /></div>
    <p class="error-msg" id="mf-error" style="display:none;color:var(--danger);font-size:.8rem;margin-top:.5rem;"></p>`;
  showManageForm();
  if (h?.latitude && h?.longitude) setPinLocation(h.latitude, h.longitude);
}

async function mDeleteHospital(id) {
  if (!confirm('Delete this hospital?')) return;
  try {
    await apiFetch(`/map/hospitals/${id}`, { method:'DELETE' });
    await mLoadHospitals();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderHospitals === 'function') renderHospitals(data.hospitals || [], true);
    } catch(e) {}
  } catch(e) {
    mAllHospitals = mAllHospitals.filter(h => String(h.id) !== String(id));
    const fb = getFallback();
    fb.hospitals = fb.hospitals.filter(h => String(h.id) !== String(id));
    mRenderHospitals(mAllHospitals);
    if (typeof renderHospitals === 'function') renderHospitals(fb.hospitals, true);
  }
}

// =============================================
// Responder Stations
// =============================================
async function mLoadStations() {
  try {
    mAllStations = await apiFetch('/map/responder-stations');
  } catch(e) {
    console.warn('Backend unavailable for responder stations, using sample data:', e);
    const fb = getFallback();
    mAllStations = fb.responder_stations || [];
  }
  mRenderStations(mAllStations);
}

function mRenderStations(data) {
  const el = document.getElementById('msta-list');
  if (!el) return;
  if (!data || !data.length) { 
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No stations yet.</p>`; 
    if (window.lucide) lucide.createIcons(); 
    return; 
  }
  const SCOLOR = { bdrrmc:'#6200ea', fire_station:'#d93025', police:'#1a73e8', bhs:'#2e7d32', coast_guard:'#0077b6', other:'#5f6368' };
  el.innerHTML = data.map(s => `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${s.latitude}, ${s.longitude}, 17, '${escH(s.name)}')">
        <span class="manage-item-dot" style="background:${SCOLOR[s.type]||'#5f6368'};"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(s.name)}</div>
          <div class="manage-item-sub">${MSTATION_LABEL[s.type]||s.type}${s.personnel_count ? ' · '+s.personnel_count+' personnel' : ''}</div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${s.latitude}, ${s.longitude}, 17, '${escH(s.name)}')"><i data-lucide="navigation"></i></button>
        <button class="action-btn" title="Edit" onclick="mOpenStationForm('${s.id}')"><i data-lucide="pencil"></i></button>
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteStation('${s.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterStations() {
  const input = document.getElementById('msta-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderStations(mAllStations.filter(st => (st.name||'').toLowerCase().includes(s)));
}

function mOpenStationForm(sOrId = null) {
  mCurrentForm = 'station';
  let s = null;
  if (typeof sOrId === 'string') {
    s = mAllStations.find(item => String(item.id) === String(sOrId));
  } else if (sOrId && typeof sOrId === 'object') {
    s = sOrId;
  }

  mEditingId = s?.id || null;
  document.getElementById('mform-title').textContent = s ? 'Edit Responder Station' : 'Add Responder Station';
  document.getElementById('mform-body').innerHTML = `
    <div class="form-group"><label>Name *</label><input type="text" id="mf-s-name" value="${escH(s?.name||'')}" /></div>
    <div class="form-group">
      <label>Type *</label>
      <select id="mf-s-type">
        <option value="bdrrmc"       ${s?.type==='bdrrmc'?'selected':''}>BDRRMC</option>
        <option value="fire_station" ${s?.type==='fire_station'?'selected':''}>Fire Station</option>
        <option value="police"       ${s?.type==='police'?'selected':''}>Police</option>
        <option value="bhs"          ${s?.type==='bhs'?'selected':''}>BHS</option>
        <option value="coast_guard"  ${s?.type==='coast_guard'?'selected':''}>Coast Guard</option>
        <option value="other"        ${s?.type==='other'?'selected':''}>Other</option>
      </select>
    </div>
    <div class="form-group"><label>Address</label><input type="text" id="mf-s-address" value="${escH(s?.address||'')}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Latitude *</label><input type="number" id="mf-s-lat" step="any" value="${s?.latitude||''}" placeholder="Click map to set" /></div>
      <div class="form-group"><label>Longitude *</label><input type="number" id="mf-s-lng" step="any" value="${s?.longitude||''}" placeholder="Click map to set" /></div>
    </div>
    <button type="button" class="btn" onclick="startPinOnMap()" style="width:100%;margin-bottom:.6rem;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#60a5fa;font-weight:700;font-size:.78rem;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.45rem;border-radius:6px;">
      <i data-lucide="map-pin" style="width:14px;height:14px;"></i> Pin on Map (Click Anywhere)
    </button>
    <div class="form-row">
      <div class="form-group"><label>Contact Number</label><input type="text" id="mf-s-contact" value="${escH(s?.contact_number||'')}" /></div>
      <div class="form-group"><label>Personnel Count</label><input type="number" id="mf-s-personnel" min="0" value="${s?.personnel_count||0}" /></div>
    </div>
    <p class="error-msg" id="mf-error" style="display:none;color:var(--danger);font-size:.8rem;margin-top:.5rem;"></p>`;
  showManageForm();
  if (s?.latitude && s?.longitude) setPinLocation(s.latitude, s.longitude);
}

async function mDeleteStation(id) {
  if (!confirm('Delete this station?')) return;
  try {
    await apiFetch(`/map/responder-stations/${id}`, { method:'DELETE' });
    await mLoadStations();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderStations === 'function') renderStations(data.responder_stations || [], true);
    } catch(e) {}
  } catch(e) {
    mAllStations = mAllStations.filter(st => String(st.id) !== String(id));
    const fb = getFallback();
    fb.responder_stations = fb.responder_stations.filter(st => String(st.id) !== String(id));
    mRenderStations(mAllStations);
    if (typeof renderStations === 'function') renderStations(fb.responder_stations, true);
  }
}

// =============================================
// Road Closures
// =============================================
async function mLoadRoads() {
  try {
    mAllRoads = await apiFetch('/map/road-closures');
  } catch(e) {
    console.warn('Backend unavailable for road closures, using sample data:', e);
    const fb = getFallback();
    mAllRoads = fb.road_closures || [];
  }
  mRenderRoads(mAllRoads);
}

function mRenderRoads(data) {
  const el = document.getElementById('mrd-list');
  if (!el) return;
  if (!data || !data.length) { 
    el.innerHTML = `<p style="padding:1rem;font-size:.8rem;color:var(--text-muted);">No road closures.</p>`; 
    if (window.lucide) lucide.createIcons(); 
    return; 
  }
  el.innerHTML = data.map(r => `
    <div class="manage-item">
      <div class="manage-item-left" style="cursor:pointer;" onclick="mMoveToMap(${r.latitude}, ${r.longitude}, 17, '${escH(r.title)}')">
        <span class="manage-item-dot" style="background:${r.is_active?'#f9a825':'#2e7d32'};"></span>
        <div class="manage-item-info">
          <div class="manage-item-name">${escH(r.title)}</div>
          <div class="manage-item-sub">${MREASON_LABEL[r.reason]||r.reason} · ${r.is_active?'<span style="color:#e65100">Active</span>':'<span style="color:#2e7d32">Resolved</span>'}</div>
        </div>
      </div>
      <div class="manage-item-actions">
        <button class="action-btn" title="Move map to location" onclick="mMoveToMap(${r.latitude}, ${r.longitude}, 17, '${escH(r.title)}')"><i data-lucide="navigation"></i></button>
        ${r.is_active ? `<button class="action-btn" title="Mark Resolved" onclick="mResolveRoad('${r.id}')"><i data-lucide="check"></i></button>` : ''}
        <button class="action-btn action-btn-danger" title="Delete" onclick="mDeleteRoad('${r.id}')"><i data-lucide="trash-2"></i></button>
      </div>
    </div>`).join('');
  if (window.lucide) lucide.createIcons();
}

function mFilterRoads() {
  const input = document.getElementById('mrd-search');
  if (!input) return;
  const s = input.value.toLowerCase();
  mRenderRoads(mAllRoads.filter(r => (r.title||'').toLowerCase().includes(s)));
}

async function mResolveRoad(id) {
  if (!confirm('Mark as resolved?')) return;
  try {
    await apiFetch(`/map/road-closures/${id}/resolve`, { method:'PATCH' });
    await mLoadRoads();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderRoadClosures === 'function') renderRoadClosures(data.road_closures || [], true);
    } catch(e) {}
  } catch(e) {
    const r = mAllRoads.find(item => String(item.id) === String(id));
    if (r) r.is_active = false;
    mRenderRoads(mAllRoads);
    if (typeof renderRoadClosures === 'function') renderRoadClosures(mAllRoads, true);
  }
}

async function mDeleteRoad(id) {
  if (!confirm('Delete this road closure?')) return;
  try {
    await apiFetch(`/map/road-closures/${id}`, { method:'DELETE' });
    await mLoadRoads();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderRoadClosures === 'function') renderRoadClosures(data.road_closures || [], true);
    } catch(e) {}
  } catch(e) {
    mAllRoads = mAllRoads.filter(r => String(r.id) !== String(id));
    const fb = getFallback();
    fb.road_closures = fb.road_closures.filter(r => String(r.id) !== String(id));
    mRenderRoads(mAllRoads);
    if (typeof renderRoadClosures === 'function') renderRoadClosures(fb.road_closures, true);
  }
}

// =============================================
// Inline form overlay
// =============================================
function showManageForm() {
  const overlay = document.getElementById('manage-form-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  // Re-attach pin listener every time a form opens
  attachMapPinListener();
  if (window.lucide) lucide.createIcons();
}

async function mSubmitHazard() {
  const name   = document.getElementById('mf-hz-name').value.trim();
  const type   = document.getElementById('mf-hz-type').value;
  const risk   = document.getElementById('mf-hz-risk').value;
  const desc   = document.getElementById('mf-hz-desc').value.trim();
  const raw    = document.getElementById('mf-hz-coords').value.trim();
  if (!name || !raw) throw new Error('Name and coordinates are required.');
  let coordinates;
  try { coordinates = JSON.parse(raw); } catch { throw new Error('Invalid coordinates format. Use [[lng,lat],[lng,lat],...]'); }
  
  const body = { name, type, risk_level: risk, description: desc || null, coordinates };
  
  try {
    if (mEditingId) await apiFetch(`/map/hazard-zones/${mEditingId}`, { method:'PATCH', body: JSON.stringify(body) });
    else            await apiFetch('/map/hazard-zones', { method:'POST', body: JSON.stringify(body) });
    await mLoadHazard();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderHazardZones === 'function') renderHazardZones(data.hazard_zones || []);
    } catch(e) {}
  } catch(err) {
    console.warn('Saving hazard zone locally:', err);
    const fb = getFallback();
    if (mEditingId) {
      const idx = mAllHazard.findIndex(z => String(z.id) === String(mEditingId));
      if (idx !== -1) mAllHazard[idx] = { ...mAllHazard[idx], ...body };
    } else {
      const newZone = { id: 'hz-' + Date.now(), ...body };
      mAllHazard.push(newZone);
      fb.hazard_zones.push(newZone);
    }
    mRenderHazard(mAllHazard);
    if (typeof renderHazardZones === 'function') renderHazardZones(mAllHazard);
  }
}

async function mSubmitEvac() {
  const name = document.getElementById('mf-ev-name').value.trim();
  const lat  = parseFloat(document.getElementById('mf-ev-lat').value);
  const lng  = parseFloat(document.getElementById('mf-ev-lng').value);
  if (!name || isNaN(lat) || isNaN(lng)) throw new Error('Name and valid latitude/longitude are required.');

  const address = document.getElementById('mf-ev-address').value.trim() || null;
  const capacity = parseInt(document.getElementById('mf-ev-cap').value) || 100;
  const current_occupancy = parseInt(document.getElementById('mf-ev-occ').value) || 0;
  const statusVal = document.getElementById('mf-ev-status').value;
  const contact_person = document.getElementById('mf-ev-contactp').value.trim() || null;
  const contact_number = document.getElementById('mf-ev-contactn').value.trim() || null;

  if (mEditingId) {
    const body = { name, address, latitude: lat, longitude: lng, capacity, current_occupancy, status: statusVal, contact_person, contact_number };
    try {
      await apiFetch(`/evacuation-centers/${mEditingId}`, { method:'PATCH', body: JSON.stringify(body) });
      await mLoadEvac();
      try {
        const data = await apiFetch('/map/layers');
        if (typeof renderEvacCenters === 'function') renderEvacCenters(data.evacuation_centers || [], true);
      } catch(e) {}
    } catch(err) {
      console.warn('Saving evacuation center locally:', err);
      const fb = getFallback();
      const idx = mAllEvac.findIndex(c => String(c.id) === String(mEditingId));
      if (idx !== -1) mAllEvac[idx] = { ...mAllEvac[idx], ...body };
      mRenderEvac(mAllEvac);
      if (typeof renderEvacCenters === 'function') renderEvacCenters(mAllEvac, true);
    }
  } else {
    const body = { name, address, latitude: lat, longitude: lng, capacity, contact_person, contact_number };
    try {
      await apiFetch('/evacuation-centers/', { method:'POST', body: JSON.stringify(body) });
      await mLoadEvac();
      try {
        const data = await apiFetch('/map/layers');
        if (typeof renderEvacCenters === 'function') renderEvacCenters(data.evacuation_centers || [], true);
      } catch(e) {}
    } catch(err) {
      console.warn('Saving evacuation center locally:', err);
      const fb = getFallback();
      const newCenter = { id: 'evac-' + Date.now(), ...body, current_occupancy, status: statusVal };
      mAllEvac.push(newCenter);
      fb.evacuation_centers.push(newCenter);
      mRenderEvac(mAllEvac);
      if (typeof renderEvacCenters === 'function') renderEvacCenters(mAllEvac, true);
    }
  }
}

async function mSubmitIncident() {
  const title = document.getElementById('mf-in-title').value.trim();
  const lat   = parseFloat(document.getElementById('mf-in-lat').value);
  const lng   = parseFloat(document.getElementById('mf-in-lng').value);
  if (!title || isNaN(lat) || isNaN(lng)) throw new Error('Title and valid latitude/longitude are required.');

  const type = document.getElementById('mf-in-type').value;
  const severity = document.getElementById('mf-in-sev').value;
  const statusVal = document.getElementById('mf-in-status').value;
  const description = document.getElementById('mf-in-desc').value.trim() || null;

  if (mEditingId) {
    const body = { title, type, severity, status: statusVal, latitude: lat, longitude: lng, description };
    try {
      await apiFetch(`/incidents/${mEditingId}`, { method:'PATCH', body: JSON.stringify(body) });
      await mLoadIncidents();
      try {
        const data = await apiFetch('/map/layers');
        if (typeof renderIncidents === 'function') renderIncidents(data.incidents || [], true);
      } catch(e) {}
    } catch(err) {
      console.warn('Saving incident locally:', err);
      const fb = getFallback();
      const idx = mAllIncidents.findIndex(inc => String(inc.id) === String(mEditingId));
      if (idx !== -1) mAllIncidents[idx] = { ...mAllIncidents[idx], ...body };
      mRenderIncidents(mAllIncidents);
      if (typeof renderIncidents === 'function') renderIncidents(mAllIncidents, true);
    }
  } else {
    const body = { title, type, severity, latitude: lat, longitude: lng, description };
    try {
      await apiFetch('/incidents/', { method:'POST', body: JSON.stringify(body) });
      await mLoadIncidents();
      try {
        const data = await apiFetch('/map/layers');
        if (typeof renderIncidents === 'function') renderIncidents(data.incidents || [], true);
      } catch(e) {}
    } catch(err) {
      console.warn('Saving incident locally:', err);
      const fb = getFallback();
      const newInc = { id: 'inc-' + Date.now(), ...body, status: statusVal || 'active', reported_at: new Date().toISOString() };
      mAllIncidents.push(newInc);
      fb.incidents.push(newInc);
      mRenderIncidents(mAllIncidents);
      if (typeof renderIncidents === 'function') renderIncidents(mAllIncidents, true);
    }
  }
}

async function mSubmitHospital() {
  const name = document.getElementById('mf-h-name').value.trim();
  const lat  = parseFloat(document.getElementById('mf-h-lat').value);
  const lng  = parseFloat(document.getElementById('mf-h-lng').value);
  if (!name || isNaN(lat) || isNaN(lng)) throw new Error('Name and valid latitude/longitude are required.');
  
  const body = { 
    name, 
    address: document.getElementById('mf-h-address').value.trim()||null,
    latitude: lat, 
    longitude: lng,
    contact_number: document.getElementById('mf-h-contact').value.trim()||null,
    services: document.getElementById('mf-h-services').value.trim()||null 
  };

  try {
    if (mEditingId) await apiFetch(`/map/hospitals/${mEditingId}`, { method:'PATCH', body: JSON.stringify(body) });
    else            await apiFetch('/map/hospitals', { method:'POST', body: JSON.stringify(body) });
    await mLoadHospitals();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderHospitals === 'function') renderHospitals(data.hospitals || [], true);
    } catch(e) {}
  } catch(err) {
    console.warn('Saving hospital locally:', err);
    const fb = getFallback();
    if (mEditingId) {
      const idx = mAllHospitals.findIndex(h => String(h.id) === String(mEditingId));
      if (idx !== -1) mAllHospitals[idx] = { ...mAllHospitals[idx], ...body };
    } else {
      const newHosp = { id: 'hosp-' + Date.now(), ...body };
      mAllHospitals.push(newHosp);
      fb.hospitals.push(newHosp);
    }
    mRenderHospitals(mAllHospitals);
    if (typeof renderHospitals === 'function') renderHospitals(mAllHospitals, true);
  }
}

async function mSubmitStation() {
  const name = document.getElementById('mf-s-name').value.trim();
  const lat  = parseFloat(document.getElementById('mf-s-lat').value);
  const lng  = parseFloat(document.getElementById('mf-s-lng').value);
  if (!name || isNaN(lat) || isNaN(lng)) throw new Error('Name and valid latitude/longitude are required.');
  
  const body = { 
    name, 
    type: document.getElementById('mf-s-type').value,
    address: document.getElementById('mf-s-address').value.trim()||null,
    latitude: lat, 
    longitude: lng,
    contact_number: document.getElementById('mf-s-contact').value.trim()||null,
    personnel_count: parseInt(document.getElementById('mf-s-personnel').value)||0 
  };

  try {
    if (mEditingId) await apiFetch(`/map/responder-stations/${mEditingId}`, { method:'PATCH', body: JSON.stringify(body) });
    else            await apiFetch('/map/responder-stations', { method:'POST', body: JSON.stringify(body) });
    await mLoadStations();
    try {
      const data = await apiFetch('/map/layers');
      if (typeof renderStations === 'function') renderStations(data.responder_stations || [], true);
    } catch(e) {}
  } catch(err) {
    console.warn('Saving station locally:', err);
    const fb = getFallback();
    if (mEditingId) {
      const idx = mAllStations.findIndex(s => String(s.id) === String(mEditingId));
      if (idx !== -1) mAllStations[idx] = { ...mAllStations[idx], ...body };
    } else {
      const newSta = { id: 'sta-' + Date.now(), ...body };
      mAllStations.push(newSta);
      fb.responder_stations.push(newSta);
    }
    mRenderStations(mAllStations);
    if (typeof renderStations === 'function') renderStations(mAllStations, true);
  }
}

// Global interactive pin marker reference
let tempPinMarker = null;

async function autoGeocodeAddress(lat, lng, isRoadOpen) {
  let addrEl = null;
  if (isRoadOpen) {
    addrEl = document.getElementById('road-title');
  } else if (mCurrentForm === 'evac') {
    addrEl = document.getElementById('mf-ev-address');
  } else if (mCurrentForm === 'hospital') {
    addrEl = document.getElementById('mf-h-address');
  } else if (mCurrentForm === 'station') {
    addrEl = document.getElementById('mf-s-address');
  } else if (mCurrentForm === 'incident') {
    addrEl = document.getElementById('mf-in-location');
  }

  if (!addrEl) return;

  const prevPlaceholder = addrEl.placeholder;
  addrEl.placeholder = 'Detecting address...';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);

    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const road = a.road || a.pedestrian || a.suburb || a.neighbourhood || a.village || '';
        const city = a.city || a.town || a.municipality || 'Ormoc City';
        
        let addressParts = [];
        if (road) addressParts.push(road);
        addressParts.push('Barangay Linao');
        addressParts.push(city);

        const formattedAddress = addressParts.filter(Boolean).join(', ');
        addrEl.value = formattedAddress;
        addrEl.placeholder = prevPlaceholder;
        if (typeof showToast === 'function') {
          showToast(`Address detected: ${formattedAddress}`, 'info');
        }
        return;
      }
    }
  } catch (e) {
    console.warn('Reverse geocode fallback:', e);
  }

  // Fallback address generator based on coordinates in Barangay Linao
  let fallbackAddress = 'Barangay Linao, Ormoc City, Leyte';
  if (lat > 11.0220) fallbackAddress = 'Purok 5, Upper Barangay Linao, Ormoc City';
  else if (lat < 11.0130) fallbackAddress = 'Naungan Coastal Area, Barangay Linao, Ormoc City';
  else if (lng < 124.5880) fallbackAddress = 'Linao Bao River Zone, Barangay Linao, Ormoc City';
  else fallbackAddress = 'Barangay Center, Barangay Linao, Ormoc City';

  addrEl.value = fallbackAddress;
  addrEl.placeholder = prevPlaceholder;
}

function setPinLocation(lat, lng) {
  lat = parseFloat(Number(lat).toFixed(6));
  lng = parseFloat(Number(lng).toFixed(6));

  let latEl = null;
  let lngEl = null;

  const roadModal = document.getElementById('road-modal-overlay');
  const isRoadOpen = roadModal && (roadModal.classList.contains('active') || roadModal.style.display === 'flex' || (window.getComputedStyle(roadModal).display !== 'none' && roadModal.style.opacity !== '0'));

  if (isRoadOpen) {
    latEl = document.getElementById('road-lat');
    lngEl = document.getElementById('road-lng');
  } else if (mCurrentForm === 'hazard') {
    latEl = document.getElementById('mf-hz-lat');
    lngEl = document.getElementById('mf-hz-lng');
  } else if (mCurrentForm === 'evac') {
    latEl = document.getElementById('mf-ev-lat');
    lngEl = document.getElementById('mf-ev-lng');
  } else if (mCurrentForm === 'incident') {
    latEl = document.getElementById('mf-in-lat');
    lngEl = document.getElementById('mf-in-lng');
  } else if (mCurrentForm === 'hospital') {
    latEl = document.getElementById('mf-h-lat');
    lngEl = document.getElementById('mf-h-lng');
  } else if (mCurrentForm === 'station') {
    latEl = document.getElementById('mf-s-lat');
    lngEl = document.getElementById('mf-s-lng');
  } else {
    latEl = document.getElementById('road-lat') || document.getElementById('mf-in-lat');
    lngEl = document.getElementById('road-lng') || document.getElementById('mf-in-lng');
  }

  if (latEl) latEl.value = lat;
  if (lngEl) lngEl.value = lng;

  const hzCoordsEl = document.getElementById('mf-hz-coords');
  if (hzCoordsEl && mCurrentForm === 'hazard') {
    let currentCoords = [];
    try {
      if (hzCoordsEl.value.trim()) currentCoords = JSON.parse(hzCoordsEl.value.trim());
    } catch(e) {}
    currentCoords.push([lng, lat]);
    hzCoordsEl.value = JSON.stringify(currentCoords);
  }

  if (typeof map !== 'undefined' && map) {
    if (!tempPinMarker) {
      const customPinHtml = `
        <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:2px solid #ffffff;box-shadow:0 0 14px rgba(239,68,68,0.8);display:flex;align-items:center;justify-content:center;color:#fff;cursor:grab;">
          <i data-lucide="map-pin" style="width:18px;height:18px;"></i>
        </div>`;
      const pinIcon = L.divIcon({
        className: 'interactive-temp-pin',
        html: customPinHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34]
      });
      tempPinMarker = L.marker([lat, lng], { draggable: true, icon: pinIcon }).addTo(map);
      tempPinMarker.on('dragend', function(e) {
        const pos = e.target.getLatLng();
        setPinLocation(pos.lat, pos.lng);
      });
    } else {
      tempPinMarker.setLatLng([lat, lng]);
    }
  }

  if (window.lucide) lucide.createIcons();
  if (typeof showToast === 'function') showToast(`Location pinned at ${lat}, ${lng}`, 'success');

  // Auto-detect editable address from pinned coordinates
  autoGeocodeAddress(lat, lng, isRoadOpen);
}

let pinSavedLayers = [];

function startPinOnMap() {
  const overlay = document.getElementById('manage-form-overlay');
  const managePanel = document.getElementById('manage-panel');
  const roadModal = document.getElementById('road-modal-overlay');
  const mapEl = document.getElementById('map');

  if (overlay && overlay.style.display !== 'none') {
    overlay.style.opacity = '0.15';
    overlay.style.pointerEvents = 'none';
  }
  if (managePanel && managePanel.classList.contains('open')) {
    managePanel.style.opacity = '0.15';
    managePanel.style.pointerEvents = 'none';
  }
  if (roadModal && (roadModal.classList.contains('active') || roadModal.style.display === 'flex')) {
    roadModal.style.opacity = '0.15';
    roadModal.style.pointerEvents = 'none';
  }

  // Turn on clean map placement mode (hides overlay polygons, markers, tooltips, popups)
  if (mapEl) {
    mapEl.classList.add('pin-placement-mode');
    mapEl.style.cursor = 'crosshair';
  }

  // Close any open popups
  if (typeof map !== 'undefined' && map) {
    map.closePopup();
  }

  if (typeof showToast === 'function') {
    showToast('Layers hidden for clear placement. Click anywhere on the map to pin.', 'info', 'Pin Placement Mode');
  }

  function onPinClick(e) {
    setPinLocation(e.latlng.lat, e.latlng.lng);

    // Restore map layers and clean view
    if (mapEl) {
      mapEl.classList.remove('pin-placement-mode');
      mapEl.style.cursor = '';
    }

    if (overlay) {
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
    }
    if (managePanel) {
      managePanel.style.opacity = '1';
      managePanel.style.pointerEvents = 'auto';
    }
    if (roadModal) {
      roadModal.style.opacity = '1';
      roadModal.style.pointerEvents = 'auto';
    }

    if (typeof map !== 'undefined' && map) {
      map.off('click', onPinClick);
    }
  }

  if (typeof map !== 'undefined' && map) {
    map.off('click', onPinClick);
    map.once('click', onPinClick);
  }
}

function clearPinMarker() {
  if (tempPinMarker && typeof map !== 'undefined' && map) {
    map.removeLayer(tempPinMarker);
    tempPinMarker = null;
  }
}

function closeManageForm() {
  const overlay = document.getElementById('manage-form-overlay');
  if (overlay) overlay.style.display = 'none';
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.classList.remove('pin-placement-mode');
  mCurrentForm = null; 
  mEditingId = null;
  clearPinMarker();
}

async function submitManageForm() {
  const errorEl = document.getElementById('mf-error');
  if (errorEl) errorEl.style.display = 'none';

  try {
    if      (mCurrentForm === 'hazard')   await mSubmitHazard();
    else if (mCurrentForm === 'evac')     await mSubmitEvac();
    else if (mCurrentForm === 'incident') await mSubmitIncident();
    else if (mCurrentForm === 'hospital') await mSubmitHospital();
    else if (mCurrentForm === 'station')  await mSubmitStation();
    closeManageForm();
  } catch(e) {
    if (errorEl) { errorEl.textContent = e.message; errorEl.style.display = 'block'; }
  }
}

function attachMapPinListener() {
  if (typeof map === 'undefined' || !map) return;

  // Remove existing listener first to avoid duplicates
  map.off('click', _onMapPinClick);
  map.on('click', _onMapPinClick);
}

function _onMapPinClick(e) {
  // Only activate when a manage form or road modal is open
  const manageOverlay = document.getElementById('manage-form-overlay');
  const roadOverlay   = document.getElementById('road-modal-overlay');
  const isManageOpen  = manageOverlay && manageOverlay.style.display !== 'none';
  const isRoadOpen    = roadOverlay && (roadOverlay.classList.contains('active') || roadOverlay.style.display === 'flex');

  if (isManageOpen && mCurrentForm) {
    setPinLocation(e.latlng.lat, e.latlng.lng);
    L.DomEvent.stopPropagation(e);
  } else if (isRoadOpen) {
    const latEl = document.getElementById('road-lat');
    const lngEl = document.getElementById('road-lng');
    if (latEl) latEl.value = e.latlng.lat.toFixed(6);
    if (lngEl) lngEl.value = e.latlng.lng.toFixed(6);
    if (typeof showToast === 'function') showToast('Coordinates filled from map click', 'success');
  }
}

// Global click map listener to pick coordinates when a form is open
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Poll until map is ready then attach once
    const poll = setInterval(() => {
      if (typeof map !== 'undefined' && map) {
        attachMapPinListener();
        clearInterval(poll);
      }
    }, 300);
  });
}
