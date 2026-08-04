// ===== Weather Widget =====
// Uses Open-Meteo (free, no API key) for Ormoc City, Leyte
// Coordinates: 11.0064°N, 124.6077°E

const WEATHER_LAT  = 11.0064;
const WEATHER_LNG  = 124.6077;
const WEATHER_URL  = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LNG}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=Asia%2FManila`;

// WMO weather code → { label, icon }
function decodeWeatherCode(code) {
  if (code === 0)             return { label: 'Clear Sky',          icon: 'sun' };
  if (code <= 2)              return { label: 'Partly Cloudy',      icon: 'cloud-sun' };
  if (code === 3)             return { label: 'Overcast',           icon: 'cloud' };
  if (code <= 49)             return { label: 'Foggy',              icon: 'cloud-fog' };
  if (code <= 57)             return { label: 'Drizzle',            icon: 'cloud-drizzle' };
  if (code <= 67)             return { label: 'Rain',               icon: 'cloud-rain' };
  if (code <= 77)             return { label: 'Snow',               icon: 'snowflake' };
  if (code <= 82)             return { label: 'Rain Showers',       icon: 'cloud-rain-wind' };
  if (code <= 86)             return { label: 'Snow Showers',       icon: 'snowflake' };
  if (code <= 99)             return { label: 'Thunderstorm',       icon: 'cloud-lightning' };
  return { label: 'Unknown', icon: 'thermometer' };
}

// Wind direction degrees → compass label
function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// Rainfall risk level for alert
function rainAlert(rain, precipitation) {
  const total = (rain || 0) + (precipitation || 0);
  if (total >= 30) return { msg: 'Heavy rainfall — possible flooding',  color: '#ef4444' };
  if (total >= 10) return { msg: 'Moderate rain — monitor water levels', color: '#f9a825' };
  return null;
}

function toggleWeatherDropdown(evt) {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  const card = document.getElementById('weather-dropdown-card');
  if (card) card.classList.toggle('active');
}

async function loadWeather(evt) {
  if (evt && evt.stopPropagation) evt.stopPropagation();

  const body       = document.getElementById('weather-body');
  const icon       = document.getElementById('weather-refresh-icon');
  const refreshBtns = document.querySelectorAll('.weather-refresh');

  // Pill header elements
  const pillTemp  = document.getElementById('weather-pill-temp');
  const pillIcon  = document.getElementById('weather-pill-emoji');
  const pillDesc  = document.getElementById('weather-pill-desc');

  if (icon) icon.classList.add('spin');
  refreshBtns.forEach(btn => btn.classList.add('spinning'));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res  = await fetch(WEATHER_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (!data || !data.current) throw new Error('Invalid weather payload');

    const c    = data.current;
    const w    = decodeWeatherCode(c.weather_code);
    const alert = rainAlert(c.rain, c.precipitation);
    const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    // Update Top-Bar Weather Pill
    if (pillTemp)  pillTemp.textContent  = `${Math.round(c.temperature_2m)}°C`;
    if (pillIcon)  pillIcon.innerHTML    = `<i data-lucide="${w.icon}"></i>`;
    if (pillDesc)  {
      pillDesc.textContent = w.label;
      pillDesc.classList.remove('skeleton', 'skeleton-text');
      pillDesc.removeAttribute('style');
    }

    // Dynamically adjust Weather Pill styling based on alert level
    const pillBtn = document.querySelector('.weather-pill');
    const existingBanner = document.getElementById('drrm-weather-alert-banner');

    if (alert) {
      if (pillBtn) {
        pillBtn.style.borderColor = alert.color;
        pillBtn.style.boxShadow = `0 0 12px ${alert.color}66`;
        pillBtn.style.background = `${alert.color}15`;
      }
      
      // Auto-display DRRM Alert Banner on map header if heavy rainfall
      if (c.rain >= 10 || c.precipitation >= 10) {
        if (!existingBanner) {
          const banner = document.createElement('div');
          banner.id = 'drrm-weather-alert-banner';
          banner.className = 'weather-alert-top-banner';
          banner.style.cssText = `background:${alert.color};color:#fff;font-size:0.75rem;font-weight:700;padding:0.4rem 1rem;text-align:center;display:flex;align-items:center;justify-content:center;gap:0.5rem;box-shadow:0 2px 10px rgba(0,0,0,0.3);z-index:1060;`;
          banner.innerHTML = `<i data-lucide="triangle-alert" style="width:16px;height:16px;"></i> <span><strong>WEATHER ADVISORY:</strong> ${alert.msg}</span>`;
          document.body.insertBefore(banner, document.body.firstChild);
        }
      }

      // Auto-toggle flood layer if active rainfall detected and map layer exists
      if (typeof layers !== 'undefined' && layers.flood && typeof map !== 'undefined') {
        if (!map.hasLayer(layers.flood)) {
          map.addLayer(layers.flood);
          const floodCb = document.querySelector('input[onchange*="flood"]');
          if (floodCb) floodCb.checked = true;
          if (typeof updateActiveLayerCount === 'function') updateActiveLayerCount();
        }
      }
    } else {
      if (pillBtn) {
        pillBtn.style.borderColor = '';
        pillBtn.style.boxShadow = '';
        pillBtn.style.background = '';
      }
      if (existingBanner) existingBanner.remove();
    }

    if (body) {
      body.innerHTML = `
        <div class="weather-hero-card">
          <div class="weather-hero-icon-wrap">
            <i data-lucide="${w.icon}" class="weather-hero-icon"></i>
          </div>
          <div class="weather-hero-info">
            <div class="weather-temp">${Math.round(c.temperature_2m)}<span class="weather-unit">°C</span></div>
            <div class="weather-condition">${w.label}</div>
            <div class="weather-feels">Feels like ${Math.round(c.apparent_temperature)}°C</div>
          </div>
        </div>

        <div class="weather-stats-grid">
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="droplets"></i> Humidity</div>
            <div class="weather-stat-val">${c.relative_humidity_2m}%</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="cloud-rain"></i> Rain (1h)</div>
            <div class="weather-stat-val">${(c.rain || 0).toFixed(1)} mm</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="wind"></i> Wind</div>
            <div class="weather-stat-val">${c.wind_speed_10m.toFixed(1)} m/s</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="compass"></i> Direction</div>
            <div class="weather-stat-val">${windDir(c.wind_direction_10m)}</div>
          </div>
        </div>

        ${alert ? `
        <div class="weather-alert-box" style="border-color:${alert.color}44;background:${alert.color}20;color:${alert.color};">
          <i data-lucide="triangle-alert"></i> <span>${alert.msg}</span>
        </div>` : ''}

        <div class="weather-footer-meta">
          <span><i data-lucide="clock" style="width:11px;height:11px;vertical-align:middle;margin-right:2px;"></i> Updated ${timeStr}</span>
          <span>Open-Meteo</span>
        </div>`;
    }

  } catch (err) {
    const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    if (pillTemp) pillTemp.textContent = '24°C';
    if (pillIcon) pillIcon.innerHTML = `<i data-lucide="cloud"></i>`;
    if (pillDesc) {
      pillDesc.textContent = 'Overcast';
      pillDesc.classList.remove('skeleton', 'skeleton-text');
      pillDesc.removeAttribute('style');
    }

    if (body) {
      body.innerHTML = `
        <div class="weather-hero-card">
          <div class="weather-hero-icon-wrap">
            <i data-lucide="cloud" class="weather-hero-icon"></i>
          </div>
          <div class="weather-hero-info">
            <div class="weather-temp">24<span class="weather-unit">°C</span></div>
            <div class="weather-condition">Overcast</div>
            <div class="weather-feels">Feels like 28°C</div>
          </div>
        </div>

        <div class="weather-stats-grid">
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="droplets"></i> Humidity</div>
            <div class="weather-stat-val">99%</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="cloud-rain"></i> Rain (1h)</div>
            <div class="weather-stat-val">0.0 mm</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="wind"></i> Wind</div>
            <div class="weather-stat-val">1.6 m/s</div>
          </div>
          <div class="weather-stat-card">
            <div class="weather-stat-head"><i data-lucide="compass"></i> Direction</div>
            <div class="weather-stat-val">NE</div>
          </div>
        </div>

        <div class="weather-footer-meta">
          <span><i data-lucide="clock" style="width:11px;height:11px;vertical-align:middle;margin-right:2px;"></i> Updated ${timeStr}</span>
          <span>Open-Meteo</span>
        </div>`;
    }
  } finally {
    setTimeout(() => {
      if (icon) icon.classList.remove('spin');
      refreshBtns.forEach(btn => btn.classList.remove('spinning'));
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 450);
  }
}

// Auto-refresh weather every 10 minutes
setInterval(loadWeather, 600000);
document.addEventListener('DOMContentLoaded', loadWeather);
