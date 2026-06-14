// ── CONFIG ──
const API_KEY = '38ebc01294be5ef3a3b25c9405327d34';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL  = 'https://api.openweathermap.org/geo/1.0';

// ── STATE ──
let currentUnit = 'C';
let currentWeatherData = null;
let currentForecastData = null;
let clockInterval = null;
let cityTimezoneOffset = 0;
let animFrameId = null;
let currentWeatherClass = 'weather-clear';
let particles = [];
let shootingStars = [];
let canvas, ctx;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  showState('default');
  initCanvas();
});

// ── CANVAS ──
function initCanvas() {
  canvas = document.getElementById('particleCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ── UNIT TOGGLE ──
function setUnit(unit) {
  currentUnit = unit;
  document.getElementById('celsiusBtn').classList.toggle('active', unit === 'C');
  document.getElementById('fahrenheitBtn').classList.toggle('active', unit === 'F');
  if (currentWeatherData) renderWeather(currentWeatherData, currentForecastData);
}
function toDisplay(kelvin) {
  return currentUnit === 'C'
    ? Math.round(kelvin - 273.15) + '°'
    : Math.round((kelvin - 273.15) * 9/5 + 32) + '°';
}
function toDisplayC(c) {
  return currentUnit === 'C' ? Math.round(c) + '°' : Math.round(c * 9/5 + 32) + '°';
}

// ── SEARCH ──
let suggestionTimeout = null;
function handleKey(e) {
  if (e.key === 'Enter')  { hideSuggestions(); searchWeather(); }
  if (e.key === 'Escape') hideSuggestions();
}
function onSearchInput(e) {
  const val = e.target.value.trim();
  clearTimeout(suggestionTimeout);
  if (val.length < 2) { hideSuggestions(); return; }
  suggestionTimeout = setTimeout(() => fetchSuggestions(val), 350);
}
async function fetchSuggestions(query) {
  try {
    const res = await fetch(`${GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);
    if (!res.ok) return;
    showSuggestions(await res.json());
  } catch { hideSuggestions(); }
}
function showSuggestions(cities) {
  const dropdown = document.getElementById('suggestionsDropdown');
  if (!cities.length) { hideSuggestions(); return; }
  dropdown.innerHTML = cities.map(c => `
    <div class="suggestion-item" onclick="selectSuggestion('${c.name}')">
      <i class="fa-solid fa-location-dot"></i>
      <span class="suggestion-name">${c.name}${c.state ? ', '+c.state : ''}</span>
      <span class="suggestion-country">${c.country}</span>
    </div>`).join('');
  dropdown.classList.add('visible');
}
function hideSuggestions() {
  document.getElementById('suggestionsDropdown').classList.remove('visible');
}
function selectSuggestion(city) {
  document.getElementById('cityInput').value = city;
  hideSuggestions();
  fetchWeatherByCity(city);
}
document.addEventListener('click', e => { if (!e.target.closest('.search-wrapper')) hideSuggestions(); });
async function searchWeather() {
  const city = document.getElementById('cityInput').value.trim();
  if (!city) return;
  await fetchWeatherByCity(city);
}

// ── GEOLOCATION ──
async function getLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }
  showState('loading');
  navigator.geolocation.getCurrentPosition(
    async pos => await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showError('Location access denied.')
  );
}

// ── API ──
async function fetchWeatherByCity(city) {
  showState('loading');
  try {
    const [wRes, fRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}`),
      fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}`)
    ]);
    if (!wRes.ok) throw new Error('City not found');
    const weather = await wRes.json();
    const forecast = await fRes.json();
    currentWeatherData = weather;
    currentForecastData = forecast;
    await fetchAQI(weather.coord.lat, weather.coord.lon);
    renderWeather(weather, forecast);
    showState('weather');
    updateBackground(weather);
    startClock(weather.timezone);
  } catch (err) {
    showError(err.message === 'City not found' ? 'City not found. Check the spelling.' : 'Something went wrong. Try again.');
  }
}
async function fetchWeatherByCoords(lat, lon) {
  try {
    const [wRes, fRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
    ]);
    if (!wRes.ok) throw new Error('Not found');
    const weather = await wRes.json();
    const forecast = await fRes.json();
    currentWeatherData = weather;
    currentForecastData = forecast;
    await fetchAQI(lat, lon);
    renderWeather(weather, forecast);
    showState('weather');
    updateBackground(weather);
    startClock(weather.timezone);
    document.getElementById('cityInput').value = weather.name;
  } catch { showError('Could not fetch weather for your location.'); }
}
async function fetchAQI(lat, lon) {
  try {
    const res = await fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    if (!res.ok) return;
    renderAQI((await res.json()).list[0].main.aqi);
  } catch { document.getElementById('aqiSection').style.display = 'none'; }
}

// ── RENDER ──
function renderWeather(weather, forecast) {
  document.getElementById('cityName').textContent    = weather.name;
  document.getElementById('countryCode').textContent = weather.sys.country;
  document.getElementById('temperature').textContent = toDisplay(weather.main.temp);
  document.getElementById('feelsLike').textContent   = toDisplay(weather.main.feels_like);
  document.getElementById('condition').textContent   = weather.weather[0].description;
  document.getElementById('weatherIconBig').textContent = getWeatherEmoji(weather.weather[0].id, weather.weather[0].icon);

  const humidity = weather.main.humidity;
  document.getElementById('humidity').textContent = humidity + '%';
  document.getElementById('humidityBar').style.width = humidity + '%';

  const windKmh = Math.round(weather.wind.speed * 3.6);
  document.getElementById('windSpeed').textContent = windKmh + ' km/h';
  if (weather.wind.deg !== undefined)
    document.getElementById('windDir').querySelector('i').style.transform = `rotate(${weather.wind.deg}deg)`;

  const visKm = (weather.visibility / 1000).toFixed(1);
  document.getElementById('visibility').textContent = visKm + ' km';
  document.getElementById('visibilityBar').style.width = Math.min((weather.visibility/10000)*100, 100) + '%';

  document.getElementById('pressure').textContent = weather.main.pressure + ' hPa';
  document.getElementById('highLow').textContent  = toDisplay(weather.main.temp_max) + ' / ' + toDisplay(weather.main.temp_min);

  // UV Index via One Call (fallback graceful)
  fetchUVIndex(weather.coord.lat, weather.coord.lon);

  renderSunBar(weather.sys.sunrise, weather.sys.sunset, weather.timezone);
  renderForecast(forecast);

  // Update "change city" button visibility
  document.getElementById('changeCityBtn').style.display = 'flex';
}

async function fetchUVIndex(lat, lon) {
  try {
    const res = await fetch(`${BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    if (!res.ok) { document.getElementById('uvIndex').textContent = 'N/A'; return; }
    const data = await res.json();
    const uv = data.value;
    document.getElementById('uvIndex').textContent = uv;
    document.getElementById('uvBar').style.width = Math.min((uv/11)*100, 100) + '%';
    // Color the bar based on UV level
    let color = '#4ade80';
    if (uv >= 3)  color = 'linear-gradient(90deg,#4ade80,#facc15)';
    if (uv >= 6)  color = 'linear-gradient(90deg,#4ade80,#facc15,#fb923c)';
    if (uv >= 8)  color = 'linear-gradient(90deg,#4ade80,#facc15,#fb923c,#ef4444)';
    if (uv >= 11) color = 'linear-gradient(90deg,#4ade80,#facc15,#fb923c,#ef4444,#9c27b0)';
    document.getElementById('uvBar').style.background = color;
  } catch { document.getElementById('uvIndex').textContent = 'N/A'; }
}

function renderSunBar(sunriseUnix, sunsetUnix, tzOffset) {
  const toLocalTime = unix => {
    const d = new Date((unix + tzOffset) * 1000);
    return d.toUTCString().slice(17, 22);
  };
  document.getElementById('sunriseTime').textContent = toLocalTime(sunriseUnix);
  document.getElementById('sunsetTime').textContent  = toLocalTime(sunsetUnix);
  const now = Date.now() / 1000;
  const total   = sunsetUnix - sunriseUnix;
  const elapsed = Math.max(0, Math.min(now - sunriseUnix, total));
  const progress = elapsed / total;
  const arcEl = document.getElementById('sunArcFill');
  const arcLength = 230;
  arcEl.style.strokeDashoffset = arcLength - (progress * arcLength);
  const t = progress;
  const p0={x:10,y:55}, p1={x:100,y:-20}, p2={x:190,y:55};
  const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x;
  const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y;
  document.getElementById('sunDot').setAttribute('cx', x);
  document.getElementById('sunDot').setAttribute('cy', y);
}

function renderForecast(forecast) {
  const strip = document.getElementById('forecastStrip');
  strip.innerHTML = '';
  const days = {};
  forecast.list.forEach(item => {
    const date   = new Date(item.dt * 1000);
    const dayKey = date.toLocaleDateString('en-US', { weekday:'short' });
    const hour   = date.getHours();
    if (!days[dayKey] || Math.abs(hour-12) < Math.abs(new Date(days[dayKey].dt*1000).getHours()-12))
      days[dayKey] = item;
  });
  Object.entries(days).slice(0,5).forEach(([day, item]) => {
    const high  = Math.round(item.main.temp_max - 273.15);
    const low   = Math.round(item.main.temp_min - 273.15);
    const emoji = getWeatherEmoji(item.weather[0].id, item.weather[0].icon);
    const card  = document.createElement('div');
    card.className = 'forecast-day';
    card.innerHTML = `
      <span class="forecast-day-name">${day}</span>
      <span class="forecast-icon">${emoji}</span>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <span class="forecast-high">${toDisplayC(high)}</span>
        <span class="forecast-low">${toDisplayC(low)}</span>
      </div>`;
    strip.appendChild(card);
  });
}

function renderAQI(aqi) {
  const labels    = ['','Good','Fair','Moderate','Poor','Very Poor'];
  const positions = ['','10%','30%','55%','75%','92%'];
  const colors    = ['','#00c853','#ffeb3b','#ff9800','#f44336','#9c27b0'];
  document.getElementById('aqiSection').style.display = 'block';
  document.getElementById('aqiStatus').textContent    = `AQI ${aqi} — ${labels[aqi]}`;
  document.getElementById('aqiStatus').style.color    = colors[aqi];
  document.getElementById('aqiIndicator').style.left  = positions[aqi];
}

// ── CLOCK ──
function startClock(tzOffsetSec) {
  cityTimezoneOffset = tzOffsetSec;
  if (clockInterval) clearInterval(clockInterval);
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}
function updateClock() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ct  = new Date(utc + cityTimezoneOffset * 1000);
  document.getElementById('localTime').textContent = ct.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
  document.getElementById('dateText').textContent  = ct.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

// ── SATELLITE MAP MODAL ──
function openRadar() {
  if (!currentWeatherData) return;
  const { lat, lon } = currentWeatherData.coord;
  const zoom = 6;
  // OpenWeatherMap tile-based radar overlay on OpenStreetMap
  const url = `https://openweathermap.org/weathermap?basemap=map&cities=false&layer=precipitation&lat=${lat}&lon=${lon}&zoom=${zoom}`;
  document.getElementById('radarFrame').src = url;
  document.getElementById('radarModal').classList.add('visible');
}
function closeRadar() {
  document.getElementById('radarModal').classList.remove('visible');
  document.getElementById('radarFrame').src = '';
}

// ── CHANGE CITY (back button) ──
function goHome() {
  showState('default');
  document.getElementById('cityInput').value = '';
  document.getElementById('changeCityBtn').style.display = 'none';
  stopParticles();
  document.body.className = 'weather-clear';
  document.getElementById('lightOverlay').className = 'light-overlay';
}

// ── BACKGROUND & WEATHER THEMES ──
function updateBackground(weather) {
  const id = weather.weather[0].id;
  const icon = weather.weather[0].icon;
  const isNight = icon.includes('n');
  document.body.className = '';
  let wClass = 'weather-clear';
  if      (isNight)             wClass = 'weather-night';
  else if (id>=200 && id<300)   wClass = 'weather-stormy';
  else if (id>=300 && id<600)   wClass = 'weather-rainy';
  else if (id>=600 && id<700)   wClass = 'weather-snowy';
  else if (id>=700 && id<800)   wClass = 'weather-foggy';
  else if (id===800)            wClass = isNight ? 'weather-night' : 'weather-sunny';
  else if (id>800)              wClass = 'weather-cloudy';
  document.body.classList.add(wClass);
  currentWeatherClass = wClass;

  const overlay = document.getElementById('lightOverlay');
  overlay.className = 'light-overlay';
  if (wClass === 'weather-sunny') overlay.classList.add('sunny');
  if (wClass === 'weather-night') overlay.classList.add('night');

  // apply theme color to hero card
  applyWeatherTheme(wClass);
  startParticles(wClass);
}

function applyWeatherTheme(wClass) {
  const hero = document.querySelector('.weather-hero');
  const themes = {
    'weather-sunny':  'rgba(247,151,30,0.15)',
    'weather-rainy':  'rgba(48,43,99,0.25)',
    'weather-stormy': 'rgba(10,0,16,0.3)',
    'weather-snowy':  'rgba(168,192,255,0.15)',
    'weather-night':  'rgba(2,1,17,0.3)',
    'weather-cloudy': 'rgba(55,59,68,0.2)',
    'weather-foggy':  'rgba(96,108,136,0.2)',
    'weather-clear':  'rgba(15,32,39,0.2)',
  };
  hero.style.background = themes[wClass] || 'rgba(255,255,255,0.10)';
}

// ── PARTICLES ──
function stopParticles() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
  particles = [];
  shootingStars = [];
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function startParticles(wClass) {
  stopParticles();
  if      (wClass === 'weather-rainy')  spawnRain(false);
  else if (wClass === 'weather-stormy') { spawnRain(true); scheduleLightning(); }
  else if (wClass === 'weather-snowy')  spawnSnow();
  else if (wClass === 'weather-night')  { spawnStars(); scheduleShootingStar(); }
  else if (wClass === 'weather-sunny')  spawnSunParticles();
  else if (wClass === 'weather-cloudy' || wClass === 'weather-foggy') spawnClouds();
}

// ── RAIN (vertical streaks with motion blur) ──
function spawnRain(heavy) {
  const count = heavy ? 250 : 150;
  for (let i = 0; i < count; i++) {
    particles.push({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      len:   Math.random() * 25 + 15,
      speed: Math.random() * 14 + 16,
      alpha: Math.random() * 0.5 + 0.25,
      width: Math.random() * 1.2 + 0.4,
      angle: heavy ? 0.25 : 0.08,
    });
  }
  animateRain();
}

function animateRain() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    const dx = Math.sin(p.angle) * p.len;
    const dy = Math.cos(p.angle) * p.len;
    const grad = ctx.createLinearGradient(p.x, p.y, p.x + dx, p.y + dy);
    grad.addColorStop(0, `rgba(174,214,241,0)`);
    grad.addColorStop(1, `rgba(174,214,241,${p.alpha})`);
    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = p.width;
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + dx, p.y + dy);
    ctx.stroke();
    p.y += p.speed;
    p.x += p.speed * Math.sin(p.angle);
    if (p.y > canvas.height + p.len) {
      p.y = -p.len;
      p.x = Math.random() * canvas.width;
    }
  });
  animFrameId = requestAnimationFrame(animateRain);
}

// ── LIGHTNING ──
function scheduleLightning() {
  const flash = () => {
    if (currentWeatherClass !== 'weather-stormy') return;
    triggerLightning();
    setTimeout(flash, Math.random() * 6000 + 3000);
  };
  setTimeout(flash, Math.random() * 3000 + 2000);
}
function triggerLightning() {
  const el = document.getElementById('lightningFlash');
  el.style.transition = 'none';
  el.style.opacity = '0.5';
  setTimeout(() => { el.style.transition = 'opacity 0.3s ease'; el.style.opacity = '0'; }, 80);
  drawLightningBolt();
}
function drawLightningBolt() {
  const startX = Math.random() * canvas.width;
  let x = startX, y = 0;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,210,255,0.95)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  while (y < canvas.height * 0.65) {
    y += Math.random() * 35 + 15;
    x += (Math.random() - 0.5) * 70;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  setTimeout(() => ctx.clearRect(0, 0, canvas.width, canvas.height), 110);
}

// ── SNOW (realistic flakes with crystals) ──
function spawnSnow() {
  for (let i = 0; i < 160; i++) {
    particles.push({
      x:      Math.random() * canvas.width,
      y:      Math.random() * canvas.height,
      r:      Math.random() * 4 + 1.5,
      speed:  Math.random() * 1.5 + 0.5,
      drift:  (Math.random() - 0.5) * 0.8,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.03 + 0.01,
      alpha:  Math.random() * 0.7 + 0.3,
      type:   Math.floor(Math.random() * 3), // 0=circle, 1=cross, 2=star
    });
  }
  animateSnow();
}

function drawSnowflake(x, y, r, alpha, type) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = 'white';
  ctx.strokeStyle = 'white';

  if (type === 0) {
    // Simple circle with inner glow
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    // Soft glow
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    g.addColorStop(0, `rgba(255,255,255,${alpha * 0.4})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 1) {
    // Crystal cross
    ctx.lineWidth = Math.max(1, r * 0.4);
    ctx.lineCap = 'round';
    for (let a = 0; a < 3; a++) {
      const angle = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(angle) * r * 1.5, y - Math.sin(angle) * r * 1.5);
      ctx.lineTo(x + Math.cos(angle) * r * 1.5, y + Math.sin(angle) * r * 1.5);
      ctx.stroke();
    }
  } else {
    // 6-point star
    ctx.lineWidth = Math.max(0.8, r * 0.35);
    ctx.lineCap = 'round';
    for (let a = 0; a < 6; a++) {
      const angle = (a * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * r * 1.8, y + Math.sin(angle) * r * 1.8);
      ctx.stroke();
      // small branches
      const mx = x + Math.cos(angle) * r;
      const my = y + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(mx - Math.cos(angle + 0.7) * r * 0.6, my - Math.sin(angle + 0.7) * r * 0.6);
      ctx.lineTo(mx + Math.cos(angle + 0.7) * r * 0.6, my + Math.sin(angle + 0.7) * r * 0.6);
      ctx.stroke();
    }
  }
}

function animateSnow() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.wobble += p.wobbleSpeed;
    p.x += p.drift + Math.sin(p.wobble) * 0.5;
    p.y += p.speed;
    if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width; }
    if (p.x > canvas.width  + 10) p.x = -10;
    if (p.x < -10)                p.x = canvas.width + 10;
    drawSnowflake(p.x, p.y, p.r, p.alpha, p.type);
  });
  ctx.globalAlpha = 1;
  animFrameId = requestAnimationFrame(animateSnow);
}

// ── STARS + SHOOTING STARS ──
function spawnStars() {
  for (let i = 0; i < 180; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.75,
      r: Math.random() * 1.8 + 0.2,
      baseAlpha: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.015 + 0.004,
      twinkleOffset: Math.random() * Math.PI * 2,
    });
  }
  animateStars();
}
function scheduleShootingStar() {
  const fire = () => {
    if (currentWeatherClass !== 'weather-night') return;
    shootingStars.push({
      x: Math.random() * canvas.width * 0.7,
      y: Math.random() * canvas.height * 0.3,
      len: 0, maxLen: Math.random() * 140 + 80,
      angle: Math.PI/4 + (Math.random()-0.5)*0.3,
      speed: Math.random() * 8 + 6,
      alpha: 1,
    });
    setTimeout(fire, Math.random() * 6000 + 4000);
  };
  setTimeout(fire, 3000);
}
function animateStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const t = Date.now() * 0.001;
  particles.forEach(p => {
    const a = p.baseAlpha * (0.5 + 0.5 * Math.sin(t * p.twinkleSpeed * 60 + p.twinkleOffset));
    ctx.globalAlpha = a;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  shootingStars = shootingStars.filter(s => s.alpha > 0);
  shootingStars.forEach(s => {
    s.len = Math.min(s.len + s.speed, s.maxLen);
    const tx = s.x - Math.cos(s.angle) * s.len;
    const ty = s.y - Math.sin(s.angle) * s.len;
    const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,255,${s.alpha})`);
    ctx.beginPath();
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.8;
    ctx.moveTo(tx, ty);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    s.x += Math.cos(s.angle) * s.speed;
    s.y += Math.sin(s.angle) * s.speed;
    if (s.len >= s.maxLen) s.alpha -= 0.05;
  });
  ctx.globalAlpha = 1;
  animFrameId = requestAnimationFrame(animateStars);
}

// ── SUN PARTICLES ──
function spawnSunParticles() {
  for (let i = 0; i < 55; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.6,
      r: Math.random() * 3 + 1,
      alpha: Math.random() * 0.25 + 0.05,
      vy: -(Math.random() * 0.5 + 0.2),
      vx: (Math.random() - 0.5) * 0.3,
    });
  }
  animateSunParticles();
}
function animateSunParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.y += p.vy; p.x += p.vx; p.alpha -= 0.0004;
    if (p.y < 0 || p.alpha <= 0) {
      p.y = canvas.height * 0.6;
      p.x = Math.random() * canvas.width;
      p.alpha = Math.random() * 0.25 + 0.05;
    }
    ctx.beginPath();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = '#ffd700';
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  animFrameId = requestAnimationFrame(animateSunParticles);
}

// ── REALISTIC CLOUDS ──
function spawnClouds() {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x:     Math.random() * canvas.width * 1.4 - canvas.width * 0.2,
      y:     Math.random() * canvas.height * 0.45 + 30,
      scale: Math.random() * 1.2 + 0.6,
      alpha: Math.random() * 0.09 + 0.04,
      speed: Math.random() * 0.25 + 0.08,
    });
  }
  animateClouds();
}
function drawCloud(x, y, scale, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'white';
  const w = 160 * scale, h = 60 * scale;
  // Draw a realistic puffball cloud using multiple overlapping circles
  const circles = [
    [x,          y,          h * 0.55],
    [x + w*0.25, y - h*0.2,  h * 0.65],
    [x + w*0.5,  y - h*0.3,  h * 0.7],
    [x + w*0.75, y - h*0.15, h * 0.6],
    [x + w,      y,          h * 0.5],
    // bottom fill
    [x + w*0.2,  y + h*0.1,  h * 0.45],
    [x + w*0.5,  y + h*0.1,  h * 0.45],
    [x + w*0.8,  y + h*0.1,  h * 0.45],
  ];
  circles.forEach(([cx, cy, cr]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  });
}
function animateClouds() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.x += p.speed;
    if (p.x > canvas.width + 300) p.x = -300;
    drawCloud(p.x, p.y, p.scale, p.alpha);
  });
  ctx.globalAlpha = 1;
  animFrameId = requestAnimationFrame(animateClouds);
}

// ── EMOJI MAP ──
function getWeatherEmoji(id, icon) {
  const n = icon && icon.includes('n');
  if (id>=200&&id<300)  return '⛈️';
  if (id>=300&&id<400)  return '🌦️';
  if (id>=500&&id<510)  return '🌧️';
  if (id===511)          return '🌨️';
  if (id>=520&&id<600)  return '🌦️';
  if (id>=600&&id<700)  return '❄️';
  if (id===701||id===741) return '🌫️';
  if (id===721)          return '🌤️';
  if (id===731||id===761) return '🌪️';
  if (id===771)          return '💨';
  if (id===781)          return '🌪️';
  if (id===800)          return n ? '🌙' : '☀️';
  if (id===801)          return n ? '🌙' : '🌤️';
  if (id===802)          return '⛅';
  if (id>=803&&id<=804)  return '☁️';
  return '🌡️';
}

// ── STATE MANAGER ──
function showState(state) {
  ['loadingState','errorState','defaultState','weatherMain'].forEach(id =>
    document.getElementById(id).classList.remove('visible'));
  if (state==='loading') document.getElementById('loadingState').classList.add('visible');
  if (state==='error')   document.getElementById('errorState').classList.add('visible');
  if (state==='default') document.getElementById('defaultState').classList.add('visible');
  if (state==='weather') document.getElementById('weatherMain').classList.add('visible');
}
function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  showState('error');
}

// ── HOURLY FORECAST ──
function renderHourly(forecast) {
  const strip = document.getElementById('hourlyStrip');
  strip.innerHTML = '';
  const now = Date.now() / 1000;
  const next = forecast.list.filter(i => i.dt > now).slice(0, 10);
  next.forEach(item => {
    const utc = item.dt + cityTimezoneOffset;
    const d   = new Date(utc * 1000);
    const hr  = d.toUTCString().slice(17, 22);
    const emoji = getWeatherEmoji(item.weather[0].id, item.weather[0].icon);
    const temp  = toDisplayC(Math.round(item.main.temp - 273.15));
    const el = document.createElement('div');
    el.className = 'hourly-item';
    el.innerHTML = `<span class="hourly-time">${hr}</span><span class="hourly-icon">${emoji}</span><span class="hourly-temp">${temp}</span>`;
    strip.appendChild(el);
  });
}

// ── LIFESTYLE TIPS ──
function renderTips(weather) {
  const id = weather.weather[0].id;
  const uv = parseFloat(document.getElementById('uvIndex').textContent) || 0;
  const humidity = weather.main.humidity;
  const wind = Math.round(weather.wind.speed * 3.6);
  const tips = [];

  if (id >= 200 && id < 300) tips.push({ icon: 'fa-bolt', text: 'Stay indoors – thunderstorm' });
  if (id >= 300 && id < 600) tips.push({ icon: 'fa-umbrella', text: 'Carry an umbrella' });
  if (id >= 600 && id < 700) tips.push({ icon: 'fa-snowflake', text: 'Dress in warm layers' });
  if (id === 800) tips.push({ icon: 'fa-glasses', text: 'Wear sunglasses' });
  if (uv >= 6)   tips.push({ icon: 'fa-sun', text: 'Apply sunscreen (High UV)' });
  if (uv >= 3 && uv < 6) tips.push({ icon: 'fa-sun', text: 'Moderate UV – light protection' });
  if (humidity > 75) tips.push({ icon: 'fa-droplet', text: 'High humidity – stay hydrated' });
  if (wind > 40) tips.push({ icon: 'fa-wind', text: 'Strong winds – secure loose items' });
  if (id >= 700 && id < 800) tips.push({ icon: 'fa-eye-slash', text: 'Low visibility – drive carefully' });
  if (id === 800 && wind < 20) tips.push({ icon: 'fa-person-running', text: 'Great day for outdoor activity' });

  const banner = document.getElementById('tipsBanner');
  if (!tips.length) { banner.classList.remove('visible'); return; }

  document.getElementById('tipsInner').innerHTML = tips.slice(0, 5).map(t =>
    `<div class="tip-item"><i class="fa-solid ${t.icon}"></i><span>${t.text}</span></div>`
  ).join('');
  banner.classList.add('visible');
}

// ── PATCH renderWeather to call hourly + tips ──
const _origRender = renderWeather;
renderWeather = function(weather, forecast) {
  _origRender(weather, forecast);
  renderHourly(forecast);
  // tips run after UV fetch settles (slight delay)
  setTimeout(() => renderTips(weather), 1200);
};