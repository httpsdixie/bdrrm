// ===== Shared GIS Map Module =====
// Used by both map.html (authenticated) and public.html (citizen view)

let map;
let heatmapLayer = null;
let heatmapVisible = false;
let allIncidentData = []; // kept for heatmap

const layers = {
  incidents:  L.layerGroup(),
  evac:       L.layerGroup(),
  flood:      L.layerGroup(),
  landslide:  L.layerGroup(),
  hospitals:  L.layerGroup(),
  stations:   L.layerGroup(),
  roads:      L.layerGroup(),
  risk:       L.layerGroup(),
};

// =============================================
// SVG icon factory
// =============================================
function makeSvgIcon(svgPath, stroke, bg, size = 32, pulse = false) {
  const pulseRing = pulse ? `<div class="marker-pulse-ring"></div>` : '';
  return L.divIcon({
    html: `<div class="marker-pin-wrap" style="color:${stroke};">
      ${pulseRing}
      <div style="width:${size}px;height:${size}px;border-radius:50%;
        background:${bg};border:2px solid ${stroke};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,.3), 0 0 0 2px ${stroke}33;cursor:pointer;position:relative;z-index:2;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size*.5}" height="${size*.5}"
          viewBox="0 0 24 24" fill="none" stroke="${stroke}"
          stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </div>
    </div>`,
    className: '', iconSize: [size, size],
    iconAnchor: [size/2, size/2], popupAnchor: [0, -(size/2+4)],
  });
}

const SVG = {
  incident: `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  evac:     `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>`,
  hospital: `<rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`,
  station:  `<circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>`,
  road:     `<line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>`,
};

const EVAC_COLOR = { available:'#1558b0', near_capacity:'#b45309', full:'#e65100', closed:'#d93025', maintenance:'#64748b' };
const EVAC_BG    = { available:'#e8f0fe', near_capacity:'#fef3c7', full:'#fff3e0', closed:'#fde8e8', maintenance:'#f1f5f9' };
const INC_COLOR  = { active:'#d93025',   responding:'#e65100', resolved:'#2e7d32' };
const INC_BG     = { active:'#fde8e8',   responding:'#fff3e0', resolved:'#e6f4ea' };
const RISK_COLOR = { flood:{ stroke:'#0077b6', fill:'#0077b6' }, landslide:{ stroke:'#e65100', fill:'#e65100' } };
const STATION_COLOR = { bdrrmc:'#6200ea', fire_station:'#d93025', police:'#1a73e8', bhs:'#2e7d32', coast_guard:'#0077b6', other:'#5f6368' };

// Barangay Linao geographic bounding box
const LINAO_BOUNDS = {
  minLat: 11.0090, maxLat: 11.0280,
  minLng: 124.5800, maxLng: 124.6030,
};

const TYPE_LABEL   = { flood:'Flood', fire:'Fire', landslide:'Landslide', typhoon:'Typhoon', medical:'Medical', other:'Other' };
const REASON_LABEL = { flood:'Flood', landslide:'Landslide', road_work:'Road Work', accident:'Accident', other:'Other' };
const STATION_LABEL = { bdrrmc:'BDRRMC', fire_station:'Fire Station', police:'Police', bhs:'BHS', coast_guard:'Coast Guard', other:'Station' };

function capPct(occ, cap) { return cap ? Math.min(100, Math.round((occ/cap)*100)) : 0; }

function mapResourceChip(iconName, label, available) {
  const color   = available ? '#34d399' : '#64748b';
  const bg      = available ? 'rgba(52,211,153,0.12)' : 'rgba(100,116,139,0.08)';
  const border  = available ? 'rgba(52,211,153,0.3)' : 'rgba(100,116,139,0.2)';
  const opacity = available ? '1' : '0.45';
  return `<span style="display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .45rem;border-radius:99px;font-size:.68rem;font-weight:700;background:${bg};border:1px solid ${border};color:${color};opacity:${opacity};"><i data-lucide="${iconName}" style="width:12px;height:12px;"></i> ${label}</span>`;
}

function formatDate(iso) {
  if (!iso) return '<span style="color:var(--text-muted);font-style:italic;">Recently Recorded</span>';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '<span style="color:var(--text-muted);font-style:italic;">Recently Recorded</span>';
  return d.toLocaleString('en-PH', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// =============================================
let baseTileLayers = {};
let activeBaseKey = 'streets';

// Initialise map
// =============================================
async function initMap(authenticated = false) {
  map = L.map('map', { zoomControl: false }).setView([11.0167, 124.5915], 15);

  // Basemap Tile Layers
  baseTileLayers = {
    streets: L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }),
    satellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    }),
    cyclosm: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.cyclosm.org">CyclOSM</a>'
    }),
    bing: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19, attribution: '&copy; Esri World Imagery'
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://carto.com/">CARTO</a>'
    })
  };

  // Default basemap is Google Streets
  baseTileLayers[activeBaseKey].addTo(map);

  Object.values(layers).forEach(lg => lg.addTo(map));

  // Official Barangay Linao boundary polygon (restored by user request)
  L.polygon([
    [11.0260, 124.5800],
    [11.0280, 124.5980],
    [11.0210, 124.6030],
    [11.0100, 124.6010],
    [11.0090, 124.5900],
    [11.0130, 124.5800],
  ], {
    color: '#3b82f6', weight: 2.5, fillColor: '#3b82f6',
    fillOpacity: 0.08, dashArray: '6, 4'
  })
    .addTo(map)
    .bindPopup(`
      <div style="padding:2px;">
        <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.55rem;">
          <div class="info-section-icon-badge" style="width:28px;height:28px;border-radius:8px;">
            <i data-lucide="map-pin" style="width:14px;height:14px;color:#60a5fa;"></i>
          </div>
          <div>
            <div style="font-weight:800;color:#fff;font-size:.88rem;line-height:1.2;">Barangay Linao</div>
            <div style="font-size:.72rem;color:#94a3b8;margin-top:1px;">Ormoc City, Leyte, Philippines</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:.35rem;font-size:.75rem;margin-top:.5rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.32rem .55rem;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.07);">
            <span style="color:#94a3b8;">Coordinates (center)</span>
            <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#60a5fa;">11.0167° N, 124.5915° E</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.32rem .55rem;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.07);">
            <span style="color:#94a3b8;">Est. Elevation</span>
            <span style="font-weight:700;color:#cbd5e1;">~6.0m (19.7 ft) ASL</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:.32rem .55rem;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid rgba(255,255,255,0.07);">
            <span style="color:#94a3b8;">Risk Profile</span>
            <span style="font-weight:700;color:#f97316;">Coastal / Riverine Lowland</span>
          </div>
        </div>
      </div>
    `);


  // Right-click — show coords and prefill road modal
  map.on('contextmenu', e => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`<strong>Coordinates</strong><br>Lat: <code>${lat}</code><br>Lng: <code>${lng}</code>`)
      .openOn(map);
    const latEl = document.getElementById('road-lat');
    const lngEl = document.getElementById('road-lng');
    if (latEl) { latEl.value = lat; lngEl.value = lng; }
  });

  // Close info panel when clicking the map background
  // but NOT when a manage form or road closure pin placement is active
  map.on('click', () => {
    const manageOverlay = document.getElementById('manage-form-overlay');
    const isManageOpen  = manageOverlay && manageOverlay.style.display !== 'none' && manageOverlay.style.pointerEvents !== 'none';
    if (!isManageOpen && document.getElementById('info-panel')) {
      closeInfoPanel();
    }
  });

  // 1. Render initial reference layer dataset IMMEDIATELY on load (guarantees all layers populated)
  const initialData = getPublicMapPayload(null);
  allIncidentData = initialData.incidents || [];
  try { buildHeatmap(allIncidentData); } catch (e) { console.warn('Heatmap init notice:', e); }
  try { renderIncidents(initialData.incidents || [], authenticated); } catch (e) { console.warn('Incidents init notice:', e); }
  try { renderEvacCenters(initialData.evacuation_centers || [], authenticated); } catch (e) { console.warn('Evac init notice:', e); }
  try { renderHazardZones(initialData.hazard_zones || []); } catch (e) { console.warn('Hazard zones init notice:', e); }
  try { renderHospitals(initialData.hospitals || [], authenticated); } catch (e) { console.warn('Hospitals init notice:', e); }
  try { renderStations(initialData.responder_stations || [], authenticated); } catch (e) { console.warn('Stations init notice:', e); }
  try { renderRoadClosures(initialData.road_closures || [], authenticated); } catch (e) { console.warn('Road closures init notice:', e); }

  if (authenticated) {
    try { loadRiskZones(); } catch (e) { console.warn('Risk zones init notice:', e); }
  } else {
    try { loadPublicRiskZones(); } catch (e) { console.warn('Public risk zones init notice:', e); }
  }

  // Invalidate map size to force Leaflet to recalculate container viewport bounds immediately on open
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 100);

  // 2. Async non-blocking background sync with live API server (safely merges live data without wiping empty layers)
  (async () => {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('spinning');
    try {
      let raw;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      if (authenticated) {
        try {
          raw = await apiFetch('/map/layers');
          const allInc = await apiFetch('/incidents/');
          if (allInc && allInc.length) allIncidentData = allInc;
        } catch (_) {}
      } else {
        try {
          // Use shared apiFetch helper (returns null on failure)
          try {
            raw = await apiFetch('/map/public');
          } catch (_) { raw = null; }
          clearTimeout(timeoutId);
        } catch (_) {}
      }

      if (raw) {
        const payload = getPublicMapPayload(raw);
        allIncidentData = payload.incidents || [];
        try { buildHeatmap(allIncidentData); } catch (_) {}
        try { renderIncidents(payload.incidents || [], authenticated); } catch (_) {}
        try { renderEvacCenters(payload.evacuation_centers || [], authenticated); } catch (_) {}
        try { renderHazardZones(payload.hazard_zones || []); } catch (_) {}
        try { renderHospitals(payload.hospitals || [], authenticated); } catch (_) {}
        try { renderStations(payload.responder_stations || [], authenticated); } catch (_) {}
        try { renderRoadClosures(payload.road_closures || [], authenticated); } catch (_) {}
      }
    } catch (err) {
      console.warn('Backend live sync notice:', err.message);
    } finally {
      if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
  })();
}

// Safely construct map payload by merging database data with baseline reference points
function getPublicMapPayload(raw) {
  const empty = { incidents: [], evacuation_centers: [], hazard_zones: [], hospitals: [], responder_stations: [], road_closures: [] };
  if (!raw || typeof raw !== 'object') return sanitizeLinaoData(empty);

  return sanitizeLinaoData({
    incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
    evacuation_centers: Array.isArray(raw.evacuation_centers) ? raw.evacuation_centers : [],
    hazard_zones: Array.isArray(raw.hazard_zones) ? raw.hazard_zones : [],
    hospitals: Array.isArray(raw.hospitals) ? raw.hospitals : [],
    responder_stations: Array.isArray(raw.responder_stations) ? raw.responder_stations : [],
    road_closures: Array.isArray(raw.road_closures) ? raw.road_closures : [],
  });
}

// Helper to sanitize & clamp any legacy database points/polygons to inside Barangay Linao bounds
function sanitizeLinaoData(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') return rawInput;
  // Deep clone to prevent mutating global reference objects
  const data = JSON.parse(JSON.stringify(rawInput));

  const clampLat = (lat) => Math.min(11.0250, Math.max(11.0115, Number(lat) || 11.0180));
  const clampLng = (lng) => Math.min(124.5965, Math.max(124.5845, Number(lng) || 124.5920));

  ['incidents', 'evacuation_centers', 'hospitals', 'responder_stations', 'road_closures'].forEach(key => {
    if (Array.isArray(data[key])) {
      data[key].forEach(item => {
        if (item && item.latitude !== undefined && item.longitude !== undefined) {
          item.latitude = clampLat(item.latitude);
          item.longitude = clampLng(item.longitude);
        }
      });
    }
  });

  if (Array.isArray(data.hazard_zones)) {
    data.hazard_zones.forEach(zone => {
      if (!zone) return;
      let coords = zone.coordinates;
      if (typeof coords === 'string') {
        try { coords = JSON.parse(coords); } catch (e) { coords = []; }
      }
      if (Array.isArray(coords)) {
        // Normalize every coordinate to GeoJSON order: [lng, lat]
        zone.coordinates = coords.map(pt => {
          if (Array.isArray(pt) && pt.length >= 2) {
            const a = Number(pt[0]);
            const b = Number(pt[1]);
            // Heuristic: longitude is ~120..130, latitude is ~5..20 for this region
            let lng = a, lat = b;
            if (a > 50 && (b > -90 && b < 90)) {
              // [lng, lat]
              lng = a; lat = b;
            } else if (b > 50 && (a > -90 && a < 90)) {
              // [lat, lng] detected -> swap
              lng = b; lat = a;
            }
            // Clamp to barangay bounds to avoid outliers
            return [clampLng(lng), clampLat(lat)];
          }
          return pt;
        });
      }
    });
  }

  return data;
}

// Coordinate normalization helpers (canonical GeoJSON order: [lng, lat])
function normalizePoint(pt) {
  // Accept [lng,lat] or [lat,lng], or objects {lat, lng}
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const a = Number(pt[0]);
    const b = Number(pt[1]);
    if (!isNaN(a) && !isNaN(b)) {
      // Heuristic: longitude ~ 120..130, latitude ~ 5..20 for this region
      if (a > 50 && (b > -90 && b < 90)) {
        return [a, b]; // already [lng, lat]
      }
      if (b > 50 && (a > -90 && a < 90)) {
        return [b, a]; // swapped [lat, lng]
      }
      // fallback: treat first as lng if it looks like it
      if (Math.abs(a) > Math.abs(b)) return [a, b];
      return [b, a];
    }
  }
  if (typeof pt === 'object' && pt !== null) {
    const lat = Number(pt.latitude ?? pt.lat ?? pt.y);
    const lng = Number(pt.longitude ?? pt.lng ?? pt.x);
    if (!isNaN(lat) && !isNaN(lng)) return [lng, lat];
  }
  return null;
}

function normalizeCoords(coords) {
  if (!coords) return [];
  let parsed = coords;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch(e) { parsed = []; }
  }
  // If GeoJSON wrapped (e.g., [ [ [lng,lat], ... ] ]) flatten one level
  if (Array.isArray(parsed) && parsed.length && Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) parsed = parsed[0];
  if (!Array.isArray(parsed)) return [];
  const out = [];
  parsed.forEach(pt => {
    const n = normalizePoint(pt);
    if (n) out.push(n);
  });
  return out;
}

function toLeafletLatLngs(coords) {
  // Convert array of [lng,lat] -> array of [lat,lng] for Leaflet
  if (!Array.isArray(coords)) return [];
  return coords.map(pt => {
    if (Array.isArray(pt) && pt.length >= 2) return [Number(pt[1]), Number(pt[0])];
    return pt;
  });
}

// =============================================
// Heatmap & Polygon Center Helper
// =============================================
function getPolyCenter(coords) {
  try {
    let parsed = coords;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch(e) { parsed = []; }
    }
    if (!Array.isArray(parsed) || !parsed.length) return [];

    // Flatten nested GeoJSON coordinates if applicable (e.g., [[ [lng,lat], ... ]])
    if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      parsed = parsed[0];
    }

    let latSum = 0, lngSum = 0, count = 0;
    parsed.forEach(pt => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const a = Number(pt[0]);
        const b = Number(pt[1]);
        if (isNaN(a) || isNaN(b)) return;
        // Normalize to [lng, lat] then accumulate
        let lng = a, lat = b;
        if (a > 50 && (b > -90 && b < 90)) {
          lng = a; lat = b; // already [lng,lat]
        } else if (b > 50 && (a > -90 && a < 90)) {
          lng = b; lat = a; // was [lat,lng]
        }
        latSum += lat;
        lngSum += lng;
        count++;
      }
    });

    if (count > 0) return [latSum / count, lngSum / count];
  } catch(err) {
    console.warn('Error calculating poly center:', err);
  }
  return [];
}

function buildHeatmap(incidents) {
  if (heatmapLayer && typeof map !== 'undefined' && map) {
    try { map.removeLayer(heatmapLayer); } catch(e) {}
    heatmapLayer = null;
  }

  // Combine incidents for heatmap
  let rawIncidents = (Array.isArray(incidents) && incidents.length) ? incidents : [];

  const WEIGHT = { critical: 1.0, high: 0.8, medium: 0.5, low: 0.3 };
  let points = [];

  rawIncidents.forEach(inc => {
    const lat = Number(inc.latitude || inc.lat);
    const lng = Number(inc.longitude || inc.lng);
    if (lat && lng) {
      const w = WEIGHT[inc.severity] || 0.6;
      points.push([lat, lng, w]);
      // Add minor cluster points around the incident location for rich visual density
      points.push([lat + 0.0006, lng + 0.0005, w * 0.75]);
      points.push([lat - 0.0005, lng - 0.0006, w * 0.75]);
      points.push([lat + 0.0003, lng - 0.0004, w * 0.85]);
    }
  });

  if (!points.length) return;

  if (typeof L.heatLayer === 'function') {
    try {
      heatmapLayer = L.heatLayer(points, {
        radius: 42,
        blur: 28,
        maxZoom: 17,
        minOpacity: 0.35,
        gradient: { 0.2: '#3b82f6', 0.4: '#eab308', 0.7: '#f97316', 1.0: '#ef4444' },
      });
    } catch(err) {
      console.warn('L.heatLayer error, using SVG radial heat fallback:', err);
    }
  }

  // Self-contained fallback SVG/Canvas heat layer group if Leaflet.heat is unavailable
  if (!heatmapLayer) {
    heatmapLayer = L.layerGroup();
    points.forEach(([lat, lng, w]) => {
      const circle = L.circle([lat, lng], {
        radius: 120 + (w * 180),
        stroke: false,
        fillColor: w >= 0.8 ? '#ef4444' : (w >= 0.5 ? '#f97316' : '#eab308'),
        fillOpacity: 0.25 * w,
        className: 'incident-heat-blob'
      });
      circle.addTo(heatmapLayer);
    });
  }

  if (heatmapVisible && heatmapLayer && typeof map !== 'undefined' && map) {
    heatmapLayer.addTo(map);
  }
}

function toggleHeatmap() {
  const btn = document.getElementById('heatmap-btn');
  heatmapVisible = !heatmapVisible;

  if (heatmapVisible) {
    buildHeatmap(allIncidentData);
    if (btn) {
      btn.classList.add('heatmap-on');
      btn.innerHTML = '<i data-lucide="flame"></i> Hide High-Risk Overlay';
    }
    if (typeof showToast === 'function') {
      showToast('Red glowing areas show where most emergencies happen.', 'info', 'High-Risk Areas Shown');
    }
  } else {
    if (heatmapLayer && typeof map !== 'undefined' && map) {
      try { map.removeLayer(heatmapLayer); } catch(e) {}
    }
    if (btn) {
      btn.classList.remove('heatmap-on');
      btn.innerHTML = '<i data-lucide="flame"></i> High-Risk Areas';
    }
    if (typeof showToast === 'function') {
      showToast('Returned to standard map view.', 'info', 'High-Risk Overlay Hidden');
    }
  }
  if (window.lucide && lucide.createIcons) lucide.createIcons();
}

// =============================================
// Basemap Switcher
// =============================================
const BASEMAP_NAMES = {
  streets: 'Streets View', satellite: 'Satellite View', osm: 'OpenStreetMap',
  topo: 'Topographic Map', cyclosm: 'CyclOSM Terrain', bing: 'Satellite HD', dark: 'Dark Vector'
};

const BASEMAP_THUMBS = {
  streets:   'https://a.basemaps.cartocdn.com/rastertiles/voyager/13/3687/7137.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3687/7137.png',
  osm:       'https://tile.openstreetmap.org/13/3687/7137.png',
  topo:      'https://tile.opentopomap.org/13/3687/7137.png',
  cyclosm:   'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/13/3687/7137.png',
  bing:      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3687/7137.png',
  dark:      'https://a.basemaps.cartocdn.com/dark_all/13/3687/7137.png'
};

function toggleBasemapPicker() {
  const card = document.getElementById('basemap-options');
  if (card) card.classList.toggle('open');

  const isOpen = card && card.classList.contains('open');

  const mapControls = document.querySelector('.map-controls-stack');
  if (mapControls) {
    mapControls.classList.toggle('basemap-open', isOpen);
  }

  // Auto-collapse Emergency Hotlines widget when Basemap Picker opens to avoid UI overlap
  if (isOpen) {
    const hotlinesCard = document.getElementById('pub-hotlines');
    const hotlinesChev = document.getElementById('pub-hotlines-chevron');
    if (hotlinesCard && !hotlinesCard.classList.contains('collapsed')) {
      hotlinesCard.classList.add('collapsed');
      if (hotlinesChev) hotlinesChev.style.transform = 'rotate(180deg)';
    }
  }
}

function switchBaseMap(key) {
  if (!baseTileLayers[key]) return;
  if (baseTileLayers[activeBaseKey]) map.removeLayer(baseTileLayers[activeBaseKey]);
  activeBaseKey = key;
  baseTileLayers[key].addTo(map);

  const labelEl = document.getElementById('basemap-trigger-label');
  const thumbEl = document.getElementById('basemap-trigger-thumb');
  if (labelEl) labelEl.textContent = BASEMAP_NAMES[key] || key;
  if (thumbEl) thumbEl.style.backgroundImage = `url('${BASEMAP_THUMBS[key]}')`;

  document.querySelectorAll('.basemap-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === key);
  });

  const optionsCard = document.getElementById('basemap-options');
  if (optionsCard) optionsCard.classList.remove('open');

  const mapControls = document.querySelector('.map-controls-stack');
  if (mapControls) mapControls.classList.remove('basemap-open');
}

// =============================================
// Info Side Panel
// =============================================
function openInfoPanel(typeBadge, typeColor, title, bodyHtml, actionsHtml = '') {
  const panel = document.getElementById('info-panel');
  if (!panel) return;

  const badgeEl = document.getElementById('panel-type-badge');
  if (badgeEl) {
    badgeEl.innerHTML = typeBadge;
    badgeEl.style.background = `linear-gradient(135deg, ${typeColor}28, ${typeColor}12)`;
    badgeEl.style.border = `1px solid ${typeColor}50`;
    badgeEl.style.color = typeColor;
    badgeEl.style.boxShadow = 'none';
  }

  const titleEl = document.getElementById('panel-title');
  if (titleEl) {
    titleEl.textContent = title;
    // Remove any existing subtitle or hero card
    const existingSub = document.getElementById('panel-subtitle');
    if (existingSub) existingSub.remove();
    const existingHero = document.getElementById('panel-hero-card');
    if (existingHero) existingHero.remove();
  }

  const bodyEl = document.getElementById('panel-body');
  if (bodyEl) bodyEl.innerHTML = bodyHtml;

  const actionsEl = document.getElementById('panel-actions');
  if (actionsEl) {
    const hasActions = actionsHtml && actionsHtml.trim().length > 0;
    actionsEl.innerHTML = hasActions ? actionsHtml : '';
    if (hasActions) {
      actionsEl.style.setProperty('display', 'flex', 'important');
    } else {
      actionsEl.style.setProperty('display', 'none', 'important');
    }
  }

  panel.classList.add('open');

  const layerPanel = document.querySelector('.layer-panel') || document.querySelector('.pub-toggles');
  if (layerPanel) {
    layerPanel.classList.add('shift-left');
    layerPanel.classList.add('collapsed');
  }

  // Auto-collapse Emergency Hotlines widget when Info Panel opens to avoid UI overlap
  const hotlinesCard = document.getElementById('pub-hotlines');
  const hotlinesChev = document.getElementById('pub-hotlines-chevron');
  if (hotlinesCard && !hotlinesCard.classList.contains('collapsed')) {
    hotlinesCard.classList.add('collapsed');
    if (hotlinesChev) hotlinesChev.style.transform = 'rotate(180deg)';
  }

  setTimeout(() => { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 260);
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function closeInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) panel.classList.remove('open');

  const layerPanel = document.querySelector('.layer-panel') || document.querySelector('.pub-toggles');
  if (layerPanel) layerPanel.classList.remove('shift-left');

  setTimeout(() => { map.invalidateSize(); }, 260);
}

function field(label, value) {
  if (value === undefined || value === null || value === '') return '';

  const cleanLabel = String(label).trim();
  const lowerLabel = cleanLabel.toLowerCase();

  // Special card for Coordinates
  if (lowerLabel === 'coordinates' || lowerLabel === 'location coords') {
    return `<div class="info-field info-field-coords">
      <div class="info-field-label"><i data-lucide="crosshair"></i> ${cleanLabel}</div>
      <div class="info-field-value coords-value-wrap">
        <code>${value}</code>
        <button type="button" class="copy-coords-btn" onclick="navigator.clipboard.writeText('${value}'); this.classList.add('copied'); this.innerText='Copied!'; setTimeout(()=>{ this.classList.remove('copied'); this.innerHTML='<i data-lucide=\\'copy\\'></i>'; if(typeof lucide !== 'undefined') lucide.createIcons(); }, 1500);" title="Copy Coordinates">
          <i data-lucide="copy"></i>
        </button>
      </div>
    </div>`;
  }

  // Special card for Contact Number / Phone fields
  if (lowerLabel.includes('contact') || lowerLabel.includes('phone') || lowerLabel.includes('hotline')) {
    let plainText = String(value);
    if (plainText.includes('<')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = value;
      plainText = tempDiv.textContent || tempDiv.innerText || plainText;
    }
    plainText = plainText.trim();
    const rawNumber = plainText.replace(/[^0-9+]/g, '');

    // Only render interactive CALL button if there is a valid phone number (>= 7 digits)
    const hasValidPhone = rawNumber.length >= 7;

    if (hasValidPhone) {
      const telHref = `tel:${rawNumber}`;
      return `<div class="info-field info-field-contact">
        <div class="info-field-label"><i data-lucide="phone"></i> ${cleanLabel}</div>
        <div class="info-field-value contact-value-wrap">
          <a href="${telHref}" class="phone-call-btn" title="Click to call ${plainText}">
            <span class="phone-call-left">
              <i data-lucide="phone-call" class="phone-call-icon"></i>
              <span class="phone-call-text">${plainText}</span>
            </span>
            <span class="phone-call-badge"><i data-lucide="phone-outgoing"></i> Call</span>
          </a>
        </div>
      </div>`;
    } else {
      // If no direct number or no valid phone digits available, display clean info text without call button
      return `<div class="info-field">
        <div class="info-field-label"><i data-lucide="phone-off"></i> ${cleanLabel}</div>
        <div class="info-field-value" style="color:var(--text-muted); font-style:italic;">${plainText}</div>
      </div>`;
    }
  }

  // Special formatting for comma-separated Facilities / Capabilities / Services
  if (lowerLabel.includes('facility') || lowerLabel.includes('facilities') || lowerLabel.includes('service') || lowerLabel.includes('capability')) {
    if (typeof value === 'string' && value.includes(',') && !value.includes('<div')) {
      const items = value.split(',').map(s => s.trim()).filter(Boolean);
      const chipsHtml = items.map(item => `<span class="info-chip"><i data-lucide="check" style="width:11px;height:11px;color:#60a5fa;"></i> ${item}</span>`).join('');
      return `<div class="info-field">
        <div class="info-field-label"><i data-lucide="activity"></i> ${cleanLabel}</div>
        <div class="info-chips-container">${chipsHtml}</div>
      </div>`;
    }
  }

  // Icon mapping for labels
  let iconName = '';
  if (lowerLabel.includes('address') || lowerLabel.includes('location') || lowerLabel.includes('coordinates')) iconName = 'map-pin';
  else if (lowerLabel.includes('contact') || lowerLabel.includes('phone')) iconName = 'phone';
  else if (lowerLabel.includes('service') || lowerLabel.includes('capability') || lowerLabel.includes('facility') || lowerLabel.includes('facilities')) iconName = 'activity';
  else if (lowerLabel.includes('susceptibility') || lowerLabel.includes('risk')) iconName = 'shield-alert';
  else if (lowerLabel.includes('score')) iconName = 'bar-chart-2';
  else if (lowerLabel.includes('dominant') || lowerLabel.includes('type') || lowerLabel.includes('category')) iconName = 'layers';
  else if (lowerLabel.includes('status')) iconName = 'activity';
  else if (lowerLabel.includes('severity')) iconName = 'alert-triangle';
  else if (lowerLabel.includes('capacity') || lowerLabel.includes('occupancy') || lowerLabel.includes('personnel')) iconName = 'users';
  else if (lowerLabel.includes('route') || lowerLabel.includes('bypass') || lowerLabel.includes('road')) iconName = 'navigation';
  else if (lowerLabel.includes('reason')) iconName = 'info';
  else if (lowerLabel.includes('date') || lowerLabel.includes('time')) iconName = 'calendar';
  else if (lowerLabel.includes('description')) iconName = 'align-left';
  else if (lowerLabel.includes('reported') || lowerLabel.includes('historical')) iconName = 'clock';
  else if (lowerLabel.includes('remarks')) iconName = 'message-square';

  const iconHtml = iconName ? `<i data-lucide="${iconName}" class="info-label-icon"></i> ` : '';

  return `<div class="info-field">
    <div class="info-field-label">${iconHtml}${cleanLabel}</div>
    <div class="info-field-value">${value}</div>
  </div>`;
}

function infoSection(title, icon, contentHtml) {
  if (!contentHtml || !contentHtml.trim()) return '';
  const iconMarkup = icon ? `<div class="info-section-icon-badge"><i data-lucide="${icon}"></i></div>` : '';
  return `<div class="info-section">
    <div class="info-section-header">${iconMarkup}<span>${title}</span></div>
    ${contentHtml}
  </div>`;
}

// =============================================
// Render Layers
// =============================================

// Auto-generated subtitle descriptions for each marker/zone type
const MARKER_SUBTITLES = {
  incident:   'An incident is an emergency event — like a fire, flood, or accident — reported within Barangay Linao that requires immediate attention or response from local authorities.',
  evac:       'An evacuation center is a designated safe shelter where residents can stay during emergencies like typhoons or floods. It provides temporary housing, food, and basic services.',
  hospital:   'A hospital or health station provides emergency medical care, first aid, triage, and basic health services to residents during and after disaster events.',
  bdrrmc:     'The BDRRMC (Barangay Disaster Risk Reduction and Management Committee) is the local emergency operations center responsible for coordinating all disaster response activities in the barangay.',
  fire_station: 'A fire station is home to the Bureau of Fire Protection (BFP) personnel and equipment, ready to respond to fires, rescue operations, and other emergencies.',
  police:     'A police sub-station is a local outpost of the Philippine National Police (PNP), providing security, law enforcement, and emergency assistance to residents.',
  coast_guard:'The Philippine Coast Guard responds to maritime emergencies, search and rescue operations, and disaster response along coastal areas.',
  other:      'This is an emergency response station that provides local disaster preparedness and relief support for the community.',
  road:       'A road closure marks a blocked or impassable road due to a disaster event, flooding, debris, or ongoing rescue operations. Use alternative routes.',
  flood:      'A flood hazard zone is an area identified by the CPDO as prone to flooding based on historical data, terrain, and proximity to rivers or the coast.',
  landslide:  'A landslide hazard zone is a slope area identified by the CPDO as susceptible to soil erosion or ground movement, especially during intense or prolonged rainfall.',
  risk_zone:  'A risk zone is an area assessed to have elevated combined disaster risk based on local hazard mapping and population vulnerability data.'
};

function injectPanelSubtitle(text) {
  // Remove existing hero card if present
  const existingHero = document.getElementById('panel-hero-card');
  if (existingHero) existingHero.remove();

  const existingSub = document.getElementById('panel-subtitle');
  if (existingSub) existingSub.remove();

  if (!text) return;

  const titleEl = document.getElementById('panel-title');
  if (titleEl && titleEl.parentElement) {
    const subEl = document.createElement('div');
    subEl.id = 'panel-subtitle';
    subEl.className = 'panel-subtitle-text';
    subEl.textContent = text;
    titleEl.parentElement.appendChild(subEl);
  }
}

function renderIncidents(incidents, auth = false) {
  layers.incidents.clearLayers();
  incidents.forEach(inc => {
    const c = INC_COLOR[inc.status] || INC_COLOR.active;
    const b = INC_BG[inc.status]   || INC_BG.active;
    const isLiveActive = (inc.status === 'active' || inc.status === 'reported' || inc.status === 'in_progress');
    const marker = L.marker([inc.latitude, inc.longitude], { icon: makeSvgIcon(SVG.incident, c, b, 32, isLiveActive) });

    marker.bindTooltip(inc.title, { direction: 'top', offset: [0, -10] });

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const SEV_COLOR = { low:'#2e7d32', medium:'#1a73e8', high:'#e65100', critical:'#d93025' };
      const sevColor = SEV_COLOR[inc.severity] || '#5f6368';
      const body = `
        ${infoSection('INCIDENT OVERVIEW', 'alert-triangle', field('Type', TYPE_LABEL[inc.type] || inc.type) + field('Severity', `<span style="color:${sevColor};font-weight:700;text-transform:capitalize;">${inc.severity}</span>`) + field('Status', `<span style="color:${c};font-weight:700;text-transform:capitalize;">${inc.status}</span>`) + (inc.description ? field('Description', inc.description) : ''))}
        ${infoSection('REPORT & TIMELINE', 'clock', (inc.users ? field('Reported By', inc.users.full_name) : '') + field('Date Reported', formatDate(inc.created_at)))}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', `${inc.latitude.toFixed(5)}, ${inc.longitude.toFixed(5)}`))}`;
      const actions = auth ? `<a href="incidents.html" class="btn btn-primary" style="flex:1;"><i data-lucide="external-link"></i> Manage</a>` : '';
      openInfoPanel(`<i data-lucide="triangle-alert"></i> Incident`, c, inc.title, body, actions);
      injectPanelSubtitle(MARKER_SUBTITLES.incident);
    });

    marker.addTo(layers.incidents);
  });
}

function renderEvacCenters(centers, auth = false) {
  layers.evac.clearLayers();
  centers.forEach(c => {
    // Live occupancy tracking removed — use stored status directly
    const effStatus = (c.status === 'maintenance' || c.status === 'closed') ? c.status : (c.status || 'available');
    const col = EVAC_COLOR[effStatus] || EVAC_COLOR.available;
    const bg  = EVAC_BG[effStatus]   || EVAC_BG.available;
    const barColor = pct >= 100 ? '#d93025' : pct >= 80 ? '#f9a825' : '#2e7d32';
    const marker = L.marker([c.latitude, c.longitude], { icon: makeSvgIcon(SVG.evac, col, bg) });

    marker.bindTooltip(c.name, { direction: 'top', offset: [0, -10] });

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      // Combined Contact Person & Contact Number into a single clean card
      let contactVal = '';
      if (c.contact_person && c.contact_number) {
        contactVal = `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
          <span style="font-weight:700;color:var(--text-main);">${c.contact_person}</span>
          <a href="tel:${c.contact_number}" style="color:var(--primary);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:.35rem;background:rgba(59,130,246,0.12);padding:3px 8px;border-radius:6px;border:1px solid rgba(59,130,246,0.25);font-size:0.8rem;"><i data-lucide="phone" style="width:12px;height:12px;"></i>${c.contact_number}</a>
        </div>`;
      } else if (c.contact_person) {
        contactVal = `<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
          <span style="font-weight:700;color:var(--text-main);">${c.contact_person}</span>
          <span style="color:var(--text-muted);font-style:italic;font-size:0.78rem;">No direct number</span>
        </div>`;
      } else if (c.contact_number) {
        contactVal = `<a href="tel:${c.contact_number}" style="color:var(--primary);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:.35rem;"><i data-lucide="phone" style="width:13px;height:13px;"></i>${c.contact_number}</a>`;
      } else {
        contactVal = '<span style="color:var(--text-muted);font-style:italic;">Not available</span>';
      }
      const contactEntry = field('Contact Details', contactVal);

      const body = `
        ${infoSection('FACILITY OVERVIEW', 'house', (c.address ? field('Address', c.address) : '') + field('Status', `<span style="color:${col};font-weight:700;text-transform:capitalize;">${effStatus.replace('_', ' ')}</span>`))}
        ${infoSection('CAPACITY', 'users', field('Capacity', `<div><strong>${c.capacity}</strong> persons</div>`))}
        ${infoSection('EMERGENCY CONTACT', 'phone', contactEntry)}
        ${infoSection('SERVICES & RESOURCES', 'activity', (c.facilities ? field('Facilities', c.facilities) : '') + ((c.has_water !== undefined) ? field('Available Resources', `<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.2rem;">${mapResourceChip('droplets', 'Water', c.has_water)}${mapResourceChip('zap', 'Electricity', c.has_electricity)}${mapResourceChip('heart-pulse', 'First Aid', c.has_first_aid)}${mapResourceChip('utensils', 'Food', c.has_food)}${mapResourceChip('bath', 'Sanitation', c.has_sanitation)}</div>`) : ''))}
        ${c.status_remarks ? infoSection('REMARKS & NOTES', 'message-square', field('Remarks', `<div style="font-size:.82rem;background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2);border-radius:6px;padding:.4rem .65rem;">${c.status_remarks}</div>`)) : ''}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`))}`;
      const actions = auth ? `<a href="evacuation.html" class="btn btn-primary" style="flex:1;"><i data-lucide="external-link"></i> Manage</a>` : '';
      openInfoPanel(`<i data-lucide="house"></i> Evacuation Center`, col, c.name, body, actions);
      injectPanelSubtitle(MARKER_SUBTITLES.evac);
    });

    marker.addTo(layers.evac);
  });
}

function renderHazardZones(zones) {
  layers.flood.clearLayers();
  layers.landslide.clearLayers();

  if (!Array.isArray(zones)) return;

  const SUSCEPTIBILITY_CFG = {
    very_high: { stroke: '#dc2626', fill: '#dc2626', opacity: 0.12, label: 'Very High Susceptibility' },
    high:      { stroke: '#ea580c', fill: '#ea580c', opacity: 0.10, label: 'High Susceptibility' },
    medium:    { stroke: '#d97706', fill: '#d97706', opacity: 0.08, label: 'Moderate Susceptibility' },
    moderate:  { stroke: '#d97706', fill: '#d97706', opacity: 0.08, label: 'Moderate Susceptibility' },
    low:       { stroke: '#059669', fill: '#059669', opacity: 0.06, label: 'Low Susceptibility' }
  };

  zones.forEach(z => {
    if (!z || !z.coordinates) return;
    let coords = z.coordinates;
    if (typeof coords === 'string') {
      try { coords = JSON.parse(coords); } catch (e) { coords = []; }
    }
    if (!Array.isArray(coords)) return;

    const normalized = normalizeCoords(coords);
    const latlngs = toLeafletLatLngs(normalized);

    if (!latlngs || !latlngs.length) return;

    const sc = SUSCEPTIBILITY_CFG[z.risk_level] || SUSCEPTIBILITY_CFG.high;

    const poly = L.polygon(latlngs, {
      color: sc.stroke, weight: 1.5, fillColor: sc.fill, fillOpacity: sc.opacity,
      dashArray: z.type === 'flood' ? '6,4' : '3,3',
      className: 'hazard-moving-border',
    });

    poly.bindTooltip(z.name, { direction: 'center', sticky: true });

    poly.on('click', e => {
      L.DomEvent.stopPropagation(e);

      // Auto-generated plain-language hazard explanations by type
      const hazardInfo = {
        flood: {
          title: 'What is a Flood?',
          text: 'A flood happens when water overflows onto land that is normally dry. This can occur due to heavy or prolonged rainfall, river overflow, or storm surges from the sea. Low-lying areas and those near rivers or the coast are most at risk.'
        },
        landslide: {
          title: 'What is a Landslide?',
          text: 'A landslide happens when dirt, rocks, and mud break loose and slide quickly down a hillside. This usually occurs during heavy rain. The water soaks deeply into the ground, making the soil too heavy, wet, and weak to stay in place — just like a wet sandcastle that eventually collapses.'
        }
      };

      const info = hazardInfo[z.type] || null;
      const infoBlock = info ? `
        <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:0.35rem;">${info.title}</div>
          <div style="font-size:0.82rem;color:#cbd5e1;line-height:1.6;">${info.text}</div>
        </div>` : '';

      const bounds = poly.getBounds();
      const center = bounds.getCenter();
      const centerCoords = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;

      const body = `
        ${infoSection('HAZARD CLASSIFICATION', 'shield-alert', field('Type', z.type === 'flood' ? 'Flood Hazard Zone' : 'Landslide Hazard Zone') + field('Susceptibility Level', `<span style="color:${sc.stroke};font-weight:700;">${sc.label}</span>`) + (z.description ? field('CPDO Description', z.description) : ''))}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', centerCoords))}`;
      openInfoPanel(`<i data-lucide="shield-alert"></i> CPDO Hazard Zone`, sc.stroke, z.name, body);
      injectPanelSubtitle(MARKER_SUBTITLES[z.type] || null);

      // Remove old inline subtitle injection block (now handled by injectPanelSubtitle)
    });

    if (z.type === 'flood') poly.addTo(layers.flood);
    else poly.addTo(layers.landslide);
  });
}

// =============================================
// GPS Pinpoint User Geolocation
// =============================================
let userLocationMarker = null;

function locateUser() {
  const btn = document.getElementById('locate-btn');
  if (btn) btn.classList.add('locating');

  const linaoCenter = [11.0180, 124.5920]; // Barangay Linao Center / Hall

  if (map) {
    map.flyTo(linaoCenter, 15.5, { duration: 1.2 });
  }

  setTimeout(() => {
    if (btn) btn.classList.remove('locating');
  }, 1200);

  if (typeof showToast === 'function') {
    showToast('Recentered map view to Barangay Linao, Ormoc City', 'info', 'Map View');
  }
}

function renderHospitals(hospitals, auth = false) {
  layers.hospitals.clearLayers();
  hospitals.forEach(h => {
    const marker = L.marker([h.latitude, h.longitude], { icon: makeSvgIcon(SVG.hospital, '#2e7d32', '#e6f4ea') });
    marker.bindTooltip(h.name, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${infoSection('LOCATION & ADDRESS', 'map-pin', h.address ? field('Address', h.address) : '')}
        ${infoSection('MEDICAL SERVICES', 'activity', h.services ? field('Services', h.services) : '')}
        ${infoSection('EMERGENCY CONTACT', 'phone', h.contact_number ? field('Contact Number', h.contact_number) : '')}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', `${h.latitude.toFixed(5)}, ${h.longitude.toFixed(5)}`))}`;
      openInfoPanel(`<i data-lucide="cross"></i> Hospital`, '#2e7d32', h.name, body);
      injectPanelSubtitle(MARKER_SUBTITLES.hospital);
    });
    marker.addTo(layers.hospitals);
  });
}

function renderStations(stations, auth = false) {
  layers.stations.clearLayers();
  stations.forEach(s => {
    const col = STATION_COLOR[s.type] || STATION_COLOR.other;
    const marker = L.marker([s.latitude, s.longitude], { icon: makeSvgIcon(SVG.station, col, '#f3e8ff') });
    marker.bindTooltip(s.name, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${infoSection('STATION OVERVIEW', 'building-2', field('Type', STATION_LABEL[s.type] || s.type) + (s.address ? field('Address', s.address) : '') + (s.personnel_count ? field('Personnel', s.personnel_count + ' persons') : ''))}
        ${infoSection('EMERGENCY CONTACT', 'phone', s.contact_number ? field('Contact Number', s.contact_number) : '')}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`))}`;
      openInfoPanel(`<i data-lucide="radio-tower"></i> Responder Station`, col, s.name, body);
      injectPanelSubtitle(MARKER_SUBTITLES[s.type] || MARKER_SUBTITLES.other);
    });
    marker.addTo(layers.stations);
  });
}

function renderRoadClosures(closures, auth = false) {
  layers.roads.clearLayers();
  closures.forEach(r => {
    const marker = L.marker([r.latitude, r.longitude], { icon: makeSvgIcon(SVG.road, '#f9a825', '#fff8e1') });
    marker.bindTooltip(r.title, { direction: 'top', offset: [0, -10] });
    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const body = `
        ${infoSection('INCIDENT DETAILS', 'alert-triangle', field('Reason', REASON_LABEL[r.reason] || r.reason) + field('Start Time', formatDate(r.start_time || r.created_at || r.reported_at)) + (r.est_clearance_time ? field('Est. Clearance Time', formatDate(r.est_clearance_time)) : ''))}
        ${infoSection('TRAFFIC MANAGEMENT', 'route', r.bypass_route ? field('Recommended Bypass Route', r.bypass_route) : field('Bypass Route', 'Use Barangay Linao Circumferential Bypass'))}
        ${infoSection('REPORTED BY', 'user', (r.users ? field('Reported By', r.users.full_name) : ''))}
        ${infoSection('GEOGRAPHIC LOCATION', 'map-pin', field('Coordinates', `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`))}`;
      const actions = auth ? `<button onclick="resolveRoadClosure('${r.id}')" class="btn btn-primary" style="flex:1;"><i data-lucide="check"></i> Mark Resolved</button>` : '';
      openInfoPanel(`<i data-lucide="road"></i> Road Closure`, '#f9a825', r.title, body, actions);
      injectPanelSubtitle(MARKER_SUBTITLES.road);
    });
    marker.addTo(layers.roads);
  });
}

// =============================================
// Layer toggle
// =============================================
function toggleLayer(name) {
  const cb = document.getElementById(`toggle-${name}`);
  if (!cb) return;
  if (cb.checked) map.addLayer(layers[name]);
  else map.removeLayer(layers[name]);
}

let allLayersVisible = true;

function toggleAllLayers() {
  allLayersVisible = !allLayersVisible;
  setAllLayers(allLayersVisible);
}

function setAllLayers(visible) {
  allLayersVisible = visible;
  Object.keys(layers).forEach(name => {
    const cb = document.getElementById(`toggle-${name}`);
    if (!cb) return;
    cb.checked = visible;
    if (visible) map.addLayer(layers[name]);
    else map.removeLayer(layers[name]);
  });
  updateToggleAllBtnState(visible);
}

function updateToggleAllBtnState(visible) {
  const btn = document.getElementById('toggle-all-layers-btn');
  if (!btn) return;
  if (visible) {
    btn.innerHTML = '<i data-lucide="eye-off"></i> Hide All Layers';
    btn.style.background = 'rgba(239, 68, 68, 0.15)';
    btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    btn.style.color = '#fca5a5';
  } else {
    btn.innerHTML = '<i data-lucide="eye"></i> Show All Layers';
    btn.style.background = 'var(--primary)';
    btn.style.borderColor = 'var(--primary)';
    btn.style.color = '#ffffff';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleLayerPanel() {
  const panel = document.getElementById('layer-panel');
  if (panel) panel.classList.toggle('collapsed');
}

function togglePubLayers() {
  const panel = document.getElementById('pub-toggles');
  if (panel) panel.classList.toggle('collapsed');
}

// =============================================
// Road Closure Modal
// =============================================
function openRoadClosureModal() {
  const modal = document.getElementById('road-modal-overlay');
  if (!modal) return;
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.classList.add('active');
  const err = document.getElementById('road-error');
  if (err) err.style.display = 'none';
  lucide.createIcons();
}

function closeRoadModal() {
  const modal = document.getElementById('road-modal-overlay');
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.classList.remove('pin-placement-mode');
}

function closeRoadModalOutside(e) {
  if (e.target === document.getElementById('road-modal-overlay')) closeRoadModal();
}

async function submitRoadClosure() {
  const errorEl = document.getElementById('road-error');
  if (errorEl) errorEl.style.display = 'none';
  const title  = document.getElementById('road-title').value.trim();
  const reason = document.getElementById('road-reason').value;
  const lat    = parseFloat(document.getElementById('road-lat').value);
  const lng    = parseFloat(document.getElementById('road-lng').value);

  if (!title || isNaN(lat) || isNaN(lng)) {
    if (errorEl) {
      errorEl.textContent = 'Please fill in title and click on the map to set coordinates.';
      errorEl.style.display = 'block';
    }
    return;
  }

  const body = { title, reason, latitude: lat, longitude: lng, is_active: true };

  try {
    await apiFetch('/map/road-closures', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    closeRoadModal();
    document.getElementById('road-title').value = '';
    const data = await apiFetch('/map/layers');
    if (typeof renderRoadClosures === 'function') renderRoadClosures(data.road_closures || [], true);
    if (typeof showToast === 'function') showToast('Road closure reported successfully!', 'success');
  } catch (err) {
    console.warn('Failed to save road closure:', err);
    closeRoadModal();
    document.getElementById('road-title').value = '';
    if (typeof mLoadRoads === 'function') mLoadRoads();
    if (typeof showToast === 'function') showToast('Failed to report road closure. Please try again.', 'danger');
  }
}

async function resolveRoadClosure(id) {
  confirmAction({
    title: 'Resolve Road Closure',
    message: 'Mark this road closure as resolved? This will clear the road hazard on the GIS map.',
    confirmText: 'Mark Resolved',
    cancelText: 'Cancel',
    type: 'info',
    icon: 'check-circle',
    onConfirm: async () => {
      try {
        await apiFetch(`/map/road-closures/${id}/resolve`, { method: 'PATCH' });
        closeInfoPanel();
        showToast('Road closure marked as resolved.', 'success', 'GIS Map Updated');
        const data = await apiFetch('/map/layers');
        renderRoadClosures(data.road_closures || [], true);
      } catch (err) {
        showToast(err.message || 'Failed to resolve road closure', 'danger', 'Error');
      }
    }
  });
}

// =============================================
// Proactive Risk Mapping
// =============================================

const RISK_COLORS = {
  critical: { stroke: '#ec4899', fill: '#ec4899', bg: '#fce7f3' },
  high:     { stroke: '#f43f5e', fill: '#f43f5e', bg: '#ffe4e6' },
  medium:   { stroke: '#f9a825', fill: '#f9a825', bg: '#fff8e1' },
  low:      { stroke: '#2e7d32', fill: '#2e7d32', bg: '#e6f4ea' },
};

const RISK_RADIUS = { critical: 280, high: 220, medium: 170, low: 130 };

const TYPE_LABEL_RISK = {
  flood: 'Flood', fire: 'Fire', landslide: 'Landslide',
  typhoon: 'Typhoon', medical: 'Medical', other: 'Other',
};

async function loadRiskZones() {
  try {
    const data = await apiFetch('/risk/analysis');
    renderRiskZones(data.risk_zones || [], true);
    updateRiskBadge(data);
  } catch (err) {
    console.warn('Risk analysis unavailable:', err.message);
  }
}

async function loadPublicRiskZones() {
  // No static fallback risk zones: do not render demo markers. Start with empty set.
  renderRiskZones([], false);
  updateRiskBadge({});

  // Fast background sync with backend to populate live risk zones
  try {
    const data = await apiFetch('/risk/public/summary');
    if (data && data.risk_zones && data.risk_zones.length) {
      renderRiskZones(data.risk_zones, false);
      updateRiskBadge(data);
    }
  } catch (_) {
    // keep empty state if backend unavailable
  }
}

function renderRiskZones(zones, authenticated) {
  layers.risk.clearLayers();

  if (!Array.isArray(zones)) return;

  zones.forEach(z => {
    // Filter out any risk zone generated outside Barangay Linao bounds
    if (z.latitude < 11.0100 || z.latitude > 11.0270 || z.longitude < 124.5820 || z.longitude > 124.5980) {
      return;
    }

    const c = RISK_COLORS[z.risk_level] || RISK_COLORS.medium;
    const r = RISK_RADIUS[z.risk_level] || 150;

    // Pulsing circle for critical/high zones
    const circle = L.circle([z.latitude, z.longitude], {
      radius: r,
      color: c.stroke,
      weight: z.risk_level === 'critical' ? 2 : 1.5,
      fillColor: c.fill,
      fillOpacity: z.risk_level === 'critical' ? 0.18 : (z.risk_level === 'high' ? 0.12 : 0.08),
      dashArray: '5,5',
      className: 'hazard-moving-border',
    });

    circle.on('click', e => {
      L.DomEvent.stopPropagation(e);

      const RISK_COLOR_TEXT = {
        critical: '#d93025', high: '#e65100', medium: '#f9a825', low: '#2e7d32'
      };
      const col = RISK_COLOR_TEXT[z.risk_level] || '#f9a825';

      let bodyHtml = `
        <div class="info-section">
          <div class="info-section-header"><i data-lucide="shield-alert"></i> RISK & HAZARD METRICS</div>
          ${field('Risk Level', `<span style="color:${col};font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">${z.risk_level.toUpperCase()}</span>`)}
          ${field('Risk Score', `<div style="display:flex;align-items:center;gap:.75rem;margin-top:.2rem;"><div style="flex:1;height:8px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.4);"><div style="width:${z.risk_score}%;height:100%;background:${col};border-radius:99px;box-shadow:0 0 10px ${col}80;"></div></div><span style="font-family:'JetBrains Mono',monospace;font-weight:800;color:#fff;">${z.risk_score}/100</span></div>`)}
          ${field('Dominant Hazard Type', `${TYPE_LABEL_RISK[z.dominant_type] || z.dominant_type}`)}
        </div>

        <div class="info-section">
          <div class="info-section-header"><i data-lucide="map-pin"></i> LOCATION & COORDINATES</div>
          ${field('Coordinates', `${z.latitude.toFixed(5)}, ${z.longitude.toFixed(5)}`)}
        </div>
`;

      if (authenticated && z.recommended_resources?.length) {
        bodyHtml += field('Recommended Pre-staged Resources', `<div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.3rem;">${z.recommended_resources.map(r => `
              <span style="display:inline-flex;align-items:center;gap:.2rem;background:#e8f0fe;color:#1558b0;border-radius:99px;padding:.15rem .55rem;font-size:.72rem;font-weight:600;">${r}</span>`).join('')}</div>`);
      }

      if (authenticated && z.recent_incidents?.length) {
        bodyHtml += field('Recent Incidents in This Area', `<div>${z.recent_incidents.map(i => `
              <div style="font-size:.78rem;padding:.3rem 0;border-bottom:1px solid #f1f3f4;"><span style="font-weight:600;">${i.title}</span><span style="color:var(--text-muted);margin-left:.3rem;">${TYPE_LABEL_RISK[i.type]||i.type}</span></div>`).join('')}</div>`);
      }

      const actions = authenticated ? `
        <a href="resources.html" class="btn btn-primary" style="flex:1;">
          <i data-lucide="send"></i> Pre-stage Resources
        </a>` : '';

      openInfoPanel(
        `<i data-lucide="shield-alert"></i> Risk Zone`, col,
        `${z.risk_level.charAt(0).toUpperCase() + z.risk_level.slice(1)} Risk Area`,
        bodyHtml, actions
      );
      injectPanelSubtitle(MARKER_SUBTITLES.risk_zone);
    });

    circle.addTo(layers.risk);
  });
}

// Update the risk badge in the map toolbar if it exists
function updateRiskBadge(data) {
  const badge = document.getElementById('risk-badge');
  if (!badge) return;
  const high = data.high_risk_count || 0;
  if (high > 0) {
    badge.textContent = high + ' high-risk';
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}
