'use strict';

// ============================================================
//  AirWatch v2 — script.js
//
//  PERUBAHAN UTAMA dari v1:
//    1. fetchLive() → pakai get_latest.php (1 baris, ringan)
//    2. loadHistory() → pakai get_history.php?granularity=30min
//    3. Interval fetchLive: 3s → 10s (sinkron dengan ESP8266)
//    4. parseStatus() diperbaiki (legacy mapping tidak dipakai lagi)
//    5. gasCategory(), tempCategory(), humCategory() = SINGLE SOURCE OF TRUTH
//       Semua halaman (Dashboard, History, Alerts) memakai fungsi yang sama
//    6. Status dari database TIDAK PERNAH dipakai → selalu dihitung ulang dari gas
// ============================================================

/* ── CONFIG ─────────────────────────────────────────────────
   Ganti BASE_URL sesuai lokasi deploy.
   Gunakan path relatif jika script.js dan PHP di server sama.
   Gunakan URL absolut jika berbeda domain/IP.
   ─────────────────────────────────────────────────────────── */
const BASE_URL = 'https://airmonitoringinformatika.xo.je';

/* ── DARK MODE ───────────────────────────────────────────── */
const dmToggle = document.getElementById('dm-toggle');
const dmIcon   = document.getElementById('dm-icon');

function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  dmIcon.className = on ? 'fas fa-sun' : 'fas fa-moon';
  localStorage.setItem('dm', on ? '1' : '0');
}
// Restore saved preference
setDarkMode(localStorage.getItem('dm') === '1');
dmToggle.addEventListener('click', () => setDarkMode(!document.body.classList.contains('dark')));

/* ── I18N — LANGUAGE SYSTEM ──────────────────────────────── */
const TRANSLATIONS = {
  id: {
    // Navigation
    nav_dashboard: 'Dashboard', nav_sensors: 'Sensors',
    nav_history: 'History',    nav_alerts: 'Alerts',
    // Header
    live: 'Live',
    brand_name: 'Sistem Monitoring Kualitas Udara',
    brand_loc: 'Informatika — Universitas Tanjungpura, Pontianak',
    // Dashboard
    dash_title: 'Dashboard Overview',
    dash_desc: 'Pemantauan kualitas udara Informatika Untan secara real-time',
    aqi_eyebrow: 'Kualitas Udara Saat Ini',
    chart_title: 'Tren Sensor — 24 Jam',
    chart_sub: 'Data real-time setiap 3 detik',
    cat_title: 'Kategori Kualitas Udara',
    cat_good: 'Kualitas udara sangat memuaskan, aman',
    cat_moderate: 'Dapat diterima, kecuali yang sensitif',
    cat_poor: 'Tidak sehat bagi kelompok sensitif',
    cat_unhealthy: 'Berbahaya bagi semua orang',
    cat_severe: 'Bahaya tinggi, hindari luar ruangan',
    cat_hazardous: 'Darurat — hindari semua aktivitas luar',
    rec_title: 'Rekomendasi Cerdas',
    rec_sub: 'Berdasarkan kondisi udara, suhu, dan kelembapan saat ini',
    // History
    hist_title: 'Data History',
    hist_desc: 'Riwayat per jam — data >3 hari otomatis dihapus',
    f_all: 'Semua',
    d_all: 'All Days', d_today: 'Hari Ini',
    d_yesterday: 'Kemarin', d_2days: '2 Hari Lalu', d_3days: '3 Hari Lalu',
    // Alerts
    alerts_title: 'Alerts',
    alerts_desc: 'Peringatan kondisi Poor / Unhealthy / Severe / Hazardous',
    alerts_safe_title: 'Kondisi Aman',
    alerts_safe_desc: 'Tidak ada peringatan kualitas udara.',
    // Card labels
    lbl_temperature: 'Temperature', lbl_humidity: 'Humidity',
    lbl_gas: 'Gas Level (Indeks Gas)',
    lbl_suhu: 'Suhu', lbl_kelembapan: 'Kelembapan', lbl_indeks_gas: 'Indeks Gas',
    lbl_sampel: 'Sampel', lbl_status: 'Status',
    // AQI summary
    aqi_good: 'Kualitas udara sangat baik. Aman untuk semua aktivitas dalam dan luar ruangan.',
    aqi_moderate: 'Kualitas udara cukup baik. Kelompok sensitif sebaiknya membatasi aktivitas luar.',
    aqi_poor: 'Kualitas udara mulai menurun. Kurangi aktivitas berat di luar ruangan.',
    aqi_unhealthy: 'Kualitas udara tidak sehat. Hindari aktivitas luar dan gunakan masker.',
    aqi_severe: 'Kualitas udara sangat buruk. Tetap di dalam ruangan dan batasi paparan udara luar.',
    aqi_hazardous: 'Udara berbahaya! Hindari seluruh aktivitas luar dan tutup ventilasi ruangan.',
    // Recommendations
    rec_gas_hazardous: 'Udara berada pada tingkat berbahaya. Tetap di dalam ruangan, tutup semua ventilasi, dan hindari seluruh aktivitas luar.',
    rec_gas_severe: 'Kualitas udara sangat buruk. Disarankan tetap di dalam ruangan dan batasi paparan udara luar semaksimal mungkin.',
    rec_gas_unhealthy: 'Udara tidak sehat. Kurangi aktivitas luar ruangan dan gunakan masker bila harus keluar.',
    rec_gas_poor: 'Kualitas udara mulai menurun. Kelompok sensitif sebaiknya mengurangi aktivitas luar ruangan.',
    rec_gas_moderate: 'Kualitas udara cukup baik dan masih aman untuk aktivitas harian.',
    rec_gas_good: 'Kualitas udara sangat baik dan nyaman untuk semua aktivitas.',
    rec_temp_extremehot: 'Suhu sangat panas. Hindari paparan matahari berlebih dan pastikan tubuh tetap terhidrasi.',
    rec_temp_hot_humid: 'Cuaca panas dan lembap. Kurangi aktivitas berat, perbanyak minum air, dan jaga sirkulasi ruangan.',
    rec_temp_hot: 'Hindari aktivitas berat di luar ruangan saat suhu panas. Tetap terhidrasi dengan minum air yang cukup.',
    rec_temp_freezing: 'Suhu sangat dingin. Gunakan pakaian tebal dan batasi paparan di luar ruangan.',
    rec_temp_chilly: 'Suhu terasa dingin. Gunakan pakaian hangat agar tubuh tetap nyaman.',
    rec_temp_pleasant: 'Suhu nyaman untuk beraktivitas normal. Cocok untuk kegiatan dalam maupun luar ruangan.',
    rec_temp_default: 'Suhu dalam kondisi baik. Cocok untuk beraktivitas.',
    rec_hum_humid: 'Kelembapan tinggi terdeteksi. Tingkatkan ventilasi ruangan untuk mengurangi kelembapan dan risiko jamur.',
    rec_hum_dry: 'Udara cenderung kering. Perbanyak minum air dan pertimbangkan penggunaan humidifier di ruangan.',
    rec_hum_optimal: 'Kelembapan dalam batas optimal. Pertahankan sirkulasi udara ruangan yang baik.',
    // History summary
    h_air_good: 'Udara bersih', h_air_moderate: 'Udara cukup baik',
    h_air_poor: 'Udara menurun', h_air_unhealthy: 'Udara tidak sehat',
    h_air_severe: 'Udara berbahaya', h_air_hazardous: 'Udara sangat berbahaya',
    h_air_unknown: 'Udara tidak diketahui',
    h_hot: ', suhu panas', h_extremehot: ', suhu sangat panas',
    h_chilly: ', suhu dingin', h_humid: ', lembap tinggi', h_dry: ', udara kering',
    // Loading
    loading: 'Memuat data sensor…',
    no_data: 'Tidak ada data untuk filter ini.',
    no_alert: 'Tidak ada peringatan kualitas udara.',
    load_fail: 'Gagal memuat data. Pastikan server PHP aktif.',
    updating: 'Diperbarui: ',
    loading_update: 'Menunggu data…',
    // Chart toggles
    tog_gas: 'Indeks Gas', tog_temp: 'Suhu °C', tog_hum: 'Kelembapan %',
    // Sensors page
    sensors_title: 'Sensor Terhubung',
    sensors_desc: 'Hardware sensor aktif — seret untuk melihat dari berbagai sudut',
    mq_model: 'Sensor Kualitas Gas',
    dht_model: 'Sensor Suhu & Kelembapan',
    about_sensor: 'Tentang Sensor',
    mq_desc: 'MQ-135 mendeteksi gas berbahaya seperti amonia (NH₃), nitrogen oksida, alkohol, benzena, CO₂, dan asap. Ideal untuk monitoring kualitas udara ruangan laboratorium dan koridor.',
    dht_desc: 'DHT11 mengukur suhu dan kelembapan secara bersamaan melalui sinyal digital satu kabel. Mudah diintegrasikan dengan ESP8266/ESP32 dan Arduino untuk monitoring lingkungan.',
    drag_rotate: 'Seret untuk memutar',
    lbl_gas_short: 'Indeks Gas',
    lbl_status: 'Status',
    status_online: 'Online',
    // Config page
    cfg_title: 'Konfigurasi', cfg_desc: 'Detail konfigurasi hardware, jaringan, threshold, dan status sistem',
    cfg_hardware: 'Hardware', cfg_network: 'Jaringan',
    cfg_status: 'Status Sistem',
    cfg_thresh_gas: 'Threshold Kualitas Udara (MQ-135)',
    cfg_thresh_temp: 'Threshold Suhu (DHT11)',
    cfg_thresh_hum: 'Threshold Kelembapan (DHT11)',
    // About page
    about_title: 'Sistem Monitoring Kualitas Udara',
    about_desc: 'Dirancang untuk membantu sivitas akademika dan masyarakat memantau kualitas udara area indoor maupun outdoor secara real-time menggunakan teknologi IoT.',
    about_kp_title: 'Kerja Praktik IoT',
    about_kp_desc: 'Project KP berbasis Internet of Things dengan implementasi sensor lingkungan dan web dashboard real-time.',
    about_univ_title: 'Informatika Untan',
    about_univ_desc: 'Dirancang untuk membantu sivitas akademika memantau kualitas udara di ruang lab dan koridor Informatika Untan.',
    about_hw_title: 'ESP8266 + Sensor',
    about_hw_desc: 'Hardware menggunakan NodeMCU ESP8266 dengan sensor MQ-135 (gas) dan DHT11 (suhu & kelembapan).',
    // Category labels
    cat_lbl_good: 'Baik', cat_lbl_moderate: 'Sedang',
    cat_lbl_poor: 'Buruk', cat_lbl_unhealthy: 'Tidak Sehat',
    cat_lbl_severe: 'Sangat Tidak Sehat', cat_lbl_hazardous: 'Berbahaya',
    // Temp & hum badges
    temp_freezing: 'Sangat Dingin', temp_chilly: 'Dingin',
    temp_cool: 'Sejuk', temp_pleasant: 'Nyaman',
    temp_hot: 'Panas', temp_extremehot: 'Sangat Panas',
    hum_dry: 'Sangat Kering', hum_optimal: 'Optimal', hum_humid: 'Terlalu Lembap',
    // Nav extra
    nav_main: 'Menu Utama', nav_info: 'Info',
    nav_config: 'Konfigurasi', nav_about: 'Tentang',
    lbl_temperature: 'Suhu', lbl_humidity: 'Kelembapan',
    lbl_gas: 'Level Gas (Indeks Gas)',
  },
  en: {
    nav_dashboard: 'Dashboard', nav_sensors: 'Sensors',
    nav_history: 'History',    nav_alerts: 'Alerts',
    live: 'Live',
    brand_name: 'Air Quality Monitoring System',
    brand_loc: 'Informatics — Tanjungpura University, Pontianak',
    dash_title: 'Dashboard Overview',
    dash_desc: 'Real-time air quality monitoring at Informatics Untan',
    aqi_eyebrow: 'Current Air Quality',
    chart_title: 'Sensor Trend — 24 Hours',
    chart_sub: 'Real-time data every 3 seconds',
    cat_title: 'Air Quality Categories',
    cat_good: 'Air quality is satisfying and safe',
    cat_moderate: 'Acceptable, except for sensitive groups',
    cat_poor: 'Unhealthy for sensitive groups',
    cat_unhealthy: 'Dangerous for everyone',
    cat_severe: 'High danger, avoid outdoor activities',
    cat_hazardous: 'Emergency — avoid all outdoor activities',
    rec_title: 'Smart Recommendations',
    rec_sub: 'Based on current air, temperature, and humidity conditions',
    hist_title: 'Data History',
    hist_desc: 'Hourly records — data older than 3 days is auto-deleted',
    f_all: 'All',
    d_all: 'All Days', d_today: 'Today',
    d_yesterday: 'Yesterday', d_2days: '2 Days Ago', d_3days: '3 Days Ago',
    alerts_title: 'Alerts',
    alerts_desc: 'Warnings for Poor / Unhealthy / Severe / Hazardous conditions',
    alerts_safe_title: 'All Clear',
    alerts_safe_desc: 'No air quality warnings at this time.',
    lbl_temperature: 'Temperature', lbl_humidity: 'Humidity',
    lbl_gas: 'Gas Level (Gas Index)',
    lbl_suhu: 'Temp', lbl_kelembapan: 'Humidity', lbl_indeks_gas: 'Gas Index',
    lbl_sampel: 'Samples', lbl_status: 'Status',
    aqi_good: 'Air quality is excellent. Safe for all indoor and outdoor activities.',
    aqi_moderate: 'Air quality is acceptable. Sensitive groups should limit outdoor activity.',
    aqi_poor: 'Air quality is declining. Reduce strenuous outdoor activities.',
    aqi_unhealthy: 'Air quality is unhealthy. Avoid outdoor activities and wear a mask.',
    aqi_severe: 'Air quality is very poor. Stay indoors and limit exposure to outdoor air.',
    aqi_hazardous: 'Hazardous air! Avoid all outdoor activities and close ventilation.',
    rec_gas_hazardous: 'Air is at hazardous levels. Stay indoors, close all vents, and avoid any outdoor activity.',
    rec_gas_severe: 'Air quality is very poor. Stay indoors and minimize outdoor air exposure.',
    rec_gas_unhealthy: 'Air is unhealthy. Reduce outdoor activity and wear a mask if going outside.',
    rec_gas_poor: 'Air quality is declining. Sensitive groups should reduce outdoor activities.',
    rec_gas_moderate: 'Air quality is acceptable and safe for daily activities.',
    rec_gas_good: 'Air quality is excellent and comfortable for all activities.',
    rec_temp_extremehot: 'Extremely hot temperature. Avoid excessive sun exposure and stay hydrated.',
    rec_temp_hot_humid: 'Hot and humid weather. Reduce strenuous activity, drink more water, and maintain ventilation.',
    rec_temp_hot: 'Avoid strenuous outdoor activity in hot weather. Stay hydrated.',
    rec_temp_freezing: 'Extremely cold temperature. Wear thick clothing and limit outdoor exposure.',
    rec_temp_chilly: 'Chilly temperature. Wear warm clothing to stay comfortable.',
    rec_temp_pleasant: 'Comfortable temperature for normal activities. Great for indoor and outdoor activities.',
    rec_temp_default: 'Temperature is fine. Good for activities.',
    rec_hum_humid: 'High humidity detected. Improve room ventilation to reduce humidity and mold risk.',
    rec_hum_dry: 'Air is dry. Drink more water and consider using a humidifier.',
    rec_hum_optimal: 'Humidity is at optimal levels. Maintain good air circulation.',
    h_air_good: 'Clean air', h_air_moderate: 'Fairly good air',
    h_air_poor: 'Declining air', h_air_unhealthy: 'Unhealthy air',
    h_air_severe: 'Hazardous air', h_air_hazardous: 'Very hazardous air',
    h_air_unknown: 'Unknown air condition',
    h_hot: ', hot temperature', h_extremehot: ', extreme heat',
    h_chilly: ', chilly temperature', h_humid: ', high humidity', h_dry: ', dry air',
    loading: 'Loading sensor data…',
    no_data: 'No data for this filter.',
    no_alert: 'No air quality warnings.',
    load_fail: 'Failed to load data. Please check the PHP server.',
    updating: 'Updated: ',
    loading_update: 'Waiting for data…',
    // Chart toggles
    tog_gas: 'Gas Index', tog_temp: 'Temp °C', tog_hum: 'Humidity %',
    // Sensors page
    sensors_title: 'Connected Sensors',
    sensors_desc: 'Active hardware sensors — drag to view from different angles',
    mq_model: 'Gas Quality Sensor',
    dht_model: 'Temperature & Humidity Sensor',
    about_sensor: 'About Sensor',
    mq_desc: 'MQ-135 detects hazardous gases such as ammonia (NH₃), nitrogen oxides, alcohol, benzene, CO₂, and smoke. Ideal for air quality monitoring in laboratory rooms and corridors.',
    dht_desc: 'DHT11 measures temperature and humidity simultaneously via a single-wire digital signal. Easy to integrate with ESP8266/ESP32 and Arduino for environmental monitoring.',
    drag_rotate: 'Drag to rotate',
    lbl_gas_short: 'Gas Index',
    lbl_status: 'Status',
    status_online: 'Online',
    // Config page
    cfg_title: 'Configuration', cfg_desc: 'Hardware, network, threshold, and system status details',
    cfg_hardware: 'Hardware', cfg_network: 'Network',
    cfg_status: 'System Status',
    cfg_thresh_gas: 'Air Quality Threshold (MQ-135)',
    cfg_thresh_temp: 'Temperature Threshold (DHT11)',
    cfg_thresh_hum: 'Humidity Threshold (DHT11)',
    // About page
    about_title: 'Air Quality Monitoring System',
    about_desc: 'Designed to help the academic community monitor indoor and outdoor air quality in real-time using IoT technology.',
    about_kp_title: 'IoT Internship Project',
    about_kp_desc: 'IoT-based internship project with environmental sensor implementation and real-time web dashboard.',
    about_univ_title: 'Informatics Untan',
    about_univ_desc: 'Designed to help the academic community monitor air quality in Informatics Untan labs and corridors.',
    about_hw_title: 'ESP8266 + Sensors',
    about_hw_desc: 'Hardware uses NodeMCU ESP8266 with MQ-135 (gas) and DHT11 (temperature & humidity) sensors.',
    // Category labels
    cat_lbl_good: 'Good', cat_lbl_moderate: 'Moderate',
    cat_lbl_poor: 'Poor', cat_lbl_unhealthy: 'Unhealthy',
    cat_lbl_severe: 'Severe', cat_lbl_hazardous: 'Hazardous',
    // Temp & hum badges
    temp_freezing: 'Freezing', temp_chilly: 'Chilly',
    temp_cool: 'Cool', temp_pleasant: 'Pleasant',
    temp_hot: 'Hot', temp_extremehot: 'Extreme Hot',
    hum_dry: 'Too Dry', hum_optimal: 'Optimal', hum_humid: 'Too Humid',
    // Nav extra
    nav_main: 'Main Menu', nav_info: 'Info',
    nav_config: 'Configuration', nav_about: 'About',
    lbl_temperature: 'Temperature', lbl_humidity: 'Humidity',
    lbl_gas: 'Gas Level (Gas Index)',
  }
};

let currentLang = localStorage.getItem('lang') || 'id';

// ── Early declarations — needed by refreshLiveBadges called from applyLang ──
let prevVals     = {temp:null, hum:null, gas:null};
let lastUpdateTime = null;
let prevGasCat   = '';
let prevRecState = { temp: null, hum: null, gas: null, cats: {t:null, h:null, g:null} };
let histAll = [], histFilter = 'All', histDateFilter = 'all';
const TEMP_ICO = {
  freezing:'ico-temp-cold', chilly:'ico-temp-cold', cool:'ico-temp-cool',
  pleasant:'ico-temp-normal', hot:'ico-temp-warm',  extremehot:'ico-temp-hot'
};
const HUM_ICO = {dry:'ico-hum-dry', optimal:'ico-hum-normal', humid:'ico-hum-wet'};
const CAT_PRIORITY_EN = ['hazardous','severe','unhealthy','poor','moderate','good'];
const DANGER_CATS_EN  = ['poor','unhealthy','severe','hazardous'];

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
      || (TRANSLATIONS['id'][key])
      || key;
}

function applyLang(fullRefresh) {
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  // Update select options
  document.querySelectorAll('option[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  // Update html lang attribute
  document.documentElement.lang = currentLang;
  // Update active state on lang buttons
  document.querySelectorAll('.lang-opt').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === currentLang);
  });
  // fullRefresh: only when user clicks switch (all functions ready)
  if (fullRefresh && typeof refreshLiveBadges === 'function') refreshLiveBadges();
  // Save
  localStorage.setItem('lang', currentLang);
}

// Language switch click
document.getElementById('lang-switch').addEventListener('click', e => {
  const opt = e.target.closest('.lang-opt');
  if (!opt) return;
  currentLang = opt.dataset.lang;
  applyLang(true);  // fullRefresh=true — badges + history re-rendered
});

// Apply on load
applyLang();

/* ── SIDEBAR TOGGLE ─────────────────────────────────────── */
const sidebar    = document.getElementById('sidebar');
const sbToggle   = document.getElementById('sb-toggle');
const sbBackdrop = document.getElementById('sb-backdrop');
const isMobile   = () => window.innerWidth <= 768;

sbToggle.addEventListener('click', () => {
  if (isMobile()) {
    sidebar.classList.toggle('open');
    sbBackdrop.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
  }
});
sbBackdrop.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sbBackdrop.classList.remove('show');
});

/* ── NAVIGATION ─────────────────────────────────────────── */
function navigateTo(pg) {
  document.querySelectorAll('.nitem').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + pg);
  if (pageEl) pageEl.classList.add('active');
  document.querySelectorAll('[data-page="'+pg+'"]').forEach(el => el.classList.add('active'));
  if (pg === 'history' || pg === 'alerts') loadHistory();
  if (isMobile()) {
    sidebar.classList.remove('open');
    sbBackdrop.classList.remove('show');
  }
}

document.querySelectorAll('.nitem[data-page]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.page));
});
document.querySelectorAll('.bn-item[data-page]').forEach(el => {
  el.addEventListener('click', () => navigateTo(el.dataset.page));
});

/* ── CLOCK ──────────────────────────────────────────────── */
(function tick() {
  const now  = new Date();
  const time = now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
  const date = now.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'});
  document.getElementById('datetime').textContent = time + ' | ' + date;
  setTimeout(tick, 10000);
})();

/* ── FLOATING PARTICLES ─────────────────────────────────── */
function spawnParticle() {
  const p = document.createElement('div');
  p.className = 'dash-particle';
  const colors = ['#c7d2fe','#a5b4fc','#bfdbfe','#bbf7d0','#fde68a','#fce7f3','#d1fae5'];
  const sz = Math.random() * 4 + 2;
  p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}vw;bottom:${Math.random()*20}vh;background:${colors[Math.floor(Math.random()*colors.length)]};--tx:${(Math.random()-0.5)*60}px;animation-duration:${Math.random()*6+5}s;animation-delay:${Math.random()*3}s;border-radius:50%;`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), (Math.random()*6+5)*1000+3000);
}
setInterval(spawnParticle, 1400);

/* ── 3D SENSOR DRAG ─────────────────────────────────────── */
function init3D(wrapId, innerId) {
  const wrap  = document.getElementById(wrapId);
  const inner = document.getElementById(innerId);
  if (!wrap || !inner) return;
  let isDrag=false, startX=0, startY=0, rotX=15, rotY=-20;
  let velX=0, velY=0, lastX=0, lastY=0, raf=null;
  function applyRot() { inner.style.transform=`rotateX(${rotX}deg) rotateY(${rotY}deg)`; }
  function inertia() {
    velX*=0.92; velY*=0.92;
    rotX+=velX; rotY+=velY;
    rotX=Math.max(-45,Math.min(45,rotX));
    applyRot();
    if(Math.abs(velX)>0.05||Math.abs(velY)>0.05) raf=requestAnimationFrame(inertia);
  }
  wrap.addEventListener('mousedown', e=>{isDrag=true;startX=e.clientX;startY=e.clientY;lastX=e.clientX;lastY=e.clientY;cancelAnimationFrame(raf);});
  window.addEventListener('mousemove', e=>{
    if(!isDrag)return;
    velY=(e.clientX-lastX)*0.4;velX=-(e.clientY-lastY)*0.4;
    rotY+=(e.clientX-startX)*0.4;rotX-=(e.clientY-startY)*0.4;
    rotX=Math.max(-45,Math.min(45,rotX));
    applyRot();startX=e.clientX;startY=e.clientY;lastX=e.clientX;lastY=e.clientY;
  });
  window.addEventListener('mouseup',()=>{if(isDrag){isDrag=false;raf=requestAnimationFrame(inertia);}});
  wrap.addEventListener('touchstart',e=>{const t=e.touches[0];isDrag=true;startX=t.clientX;startY=t.clientY;lastX=t.clientX;lastY=t.clientY;cancelAnimationFrame(raf);},{passive:true});
  window.addEventListener('touchmove',e=>{
    if(!isDrag)return;const t=e.touches[0];
    velY=(t.clientX-lastX)*0.4;velX=-(t.clientY-lastY)*0.4;
    rotY+=(t.clientX-startX)*0.4;rotX-=(t.clientY-startY)*0.4;
    rotX=Math.max(-45,Math.min(45,rotX));
    applyRot();startX=t.clientX;startY=t.clientY;lastX=t.clientX;lastY=t.clientY;
  },{passive:true});
  window.addEventListener('touchend',()=>{if(isDrag){isDrag=false;raf=requestAnimationFrame(inertia);}});
  let idleT=null;
  function startIdle(){idleT=setInterval(()=>{rotY+=0.4;applyRot();},30);}
  function stopIdle(){clearInterval(idleT);}
  wrap.addEventListener('mouseenter',stopIdle);
  wrap.addEventListener('mouseleave',startIdle);
  startIdle(); applyRot();
}
init3D('s3d-mq135','s3d-mq135-inner');
init3D('s3d-dht11','s3d-dht11-inner');

/* ── CHART TOGGLES ──────────────────────────────────────── */
let chartToggles = { aq: true, temp: false, hum: false };

function applyChartToggles() {
  ['aq','temp','hum'].forEach(k => {
    const el = document.getElementById('tog-'+k);
    el.classList.toggle('active',   chartToggles[k]);
    el.classList.toggle('inactive', !chartToggles[k]);
    if (mainChart) mainChart.data.datasets.forEach(ds => {
      if (ds._key === k) ds.hidden = !chartToggles[k];
    });
  });
  if (mainChart) mainChart.update();
}

['aq','temp','hum'].forEach(k => {
  document.getElementById('tog-'+k).addEventListener('click', () => {
    chartToggles[k] = !chartToggles[k];
    applyChartToggles();
  });
});

/* ── MAIN CHART ─────────────────────────────────────────── */
const mctx = document.getElementById('main-chart').getContext('2d');
function makeGrad(ctx, r,g,b) {
  const gr = ctx.createLinearGradient(0,0,0,255);
  gr.addColorStop(0,   `rgba(${r},${g},${b},0.22)`);
  gr.addColorStop(0.55,`rgba(${r},${g},${b},0.05)`);
  gr.addColorStop(1,   `rgba(${r},${g},${b},0)`);
  return gr;
}
const gGas  = makeGrad(mctx,99,102,241);
const gTemp = makeGrad(mctx,249,115,22);
const gHum  = makeGrad(mctx,14,165,233);

const mainChart = new Chart(mctx, {
  type:'line',
  data:{
    labels:[],
    datasets:[
      {_key:'aq',   label:t('tog_gas'),  data:[], borderColor:'#6366f1', backgroundColor:gGas,  borderWidth:2.5, tension:0.5, fill:true,  pointBackgroundColor:'#6366f1', pointBorderColor:'rgba(255,255,255,0.9)', pointBorderWidth:2, pointRadius:3, pointHoverRadius:6, hidden:false},
      {_key:'temp', label:t('tog_temp'),  data:[], borderColor:'#f97316', backgroundColor:gTemp, borderWidth:2,   tension:0.5, fill:true,  pointBackgroundColor:'#f97316', pointBorderColor:'rgba(255,255,255,0.9)', pointBorderWidth:2, pointRadius:3, pointHoverRadius:6, hidden:true},
      {_key:'hum',  label:t('tog_hum'),  data:[], borderColor:'#0ea5e9', backgroundColor:gHum,  borderWidth:2,   tension:0.5, fill:true,  pointBackgroundColor:'#0ea5e9', pointBorderColor:'rgba(255,255,255,0.9)', pointBorderWidth:2, pointRadius:3, pointHoverRadius:6, hidden:true}
    ]
  },
  options:{
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{display:false},
      tooltip:{
        backgroundColor:'rgba(255,255,255,0.96)',
        titleColor:'#334155', bodyColor:'#0f172a',
        borderColor:'rgba(99,102,241,0.2)', borderWidth:1,
        padding:12, cornerRadius:12,
        callbacks:{
          title: i => i[0].label,
          label: i => {
            const labels = ['Indeks Gas', 'Suhu', 'Kelembapan'];
            const units  = ['','°C','%'];
            return ` ${labels[i.datasetIndex]}: ${i.raw}${units[i.datasetIndex]}`;
          }
        }
      }
    },
    scales:{
      x:{grid:{color:'rgba(0,0,0,0.04)',drawBorder:false},ticks:{color:'#94a3b8',font:{size:10,family:'JetBrains Mono'},maxTicksLimit:8},border:{display:false}},
      y:{grid:{color:'rgba(0,0,0,0.04)',drawBorder:false},ticks:{color:'#94a3b8',font:{size:10,family:'JetBrains Mono'}},border:{display:false}}
    },
    interaction:{intersect:false,mode:'index'},
    animation:{duration:800,easing:'easeInOutCubic'},
    transitions:{active:{animation:{duration:200}}}
  }
});

/* ── SPARKLINES ─────────────────────────────────────────── */
const spBuf = {temp:[],hum:[],gas:[]};
const spCh  = {};
function mkSp(id,clr){
  const c = document.getElementById('spark-'+id).getContext('2d');
  const gr = c.createLinearGradient(0,0,0,36);
  gr.addColorStop(0, clr.replace('1)','0.2)'));
  gr.addColorStop(1, clr.replace('1)','0)'));
  spCh[id] = new Chart(c, {
    type:'line',
    data:{labels:[],datasets:[{data:[],borderColor:clr,backgroundColor:gr,borderWidth:1.8,tension:0.5,fill:true,pointRadius:0}]},
    options:{responsive:false,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{enabled:false}},
      scales:{x:{display:false},y:{display:false}},
      animation:{duration:600,easing:'easeInOutCubic'},
      transitions:{active:{animation:{duration:0}}}}
  });
}
mkSp('temp','rgba(99,102,241,1)');
mkSp('hum', 'rgba(14,165,233,1)');
mkSp('gas', 'rgba(16,185,129,1)');
function pushSp(id,v){
  const max=18;
  if(spBuf[id].length>=max){spBuf[id].shift();spCh[id].data.labels.shift();spCh[id].data.datasets[0].data.shift();}
  spBuf[id].push(v);spCh[id].data.labels.push('');spCh[id].data.datasets[0].data.push(v);
  spCh[id].update();
}

// ============================================================
//  CATEGORY LOGIC — SINGLE SOURCE OF TRUTH
//  ⚠ JANGAN DIUBAH tanpa update threshold di Config page juga
//
//  Semua halaman (Dashboard, History, Alerts) memakai fungsi ini.
//  PHP/database TIDAK menyimpan status.
//  Status SELALU dihitung dari nilai gas/temp/humidity.
// ============================================================

/*
  GAS (Indeks 0–500):
  0–50    → good
  51–100  → moderate
  101–150 → poor
  151–200 → unhealthy
  201–300 → severe
  301+    → hazardous

  TEMP (°C):
  <1      → freezing
  1–10.9  → chilly
  11–20.9 → cool
  21–30.9 → pleasant
  31–40.9 → hot
  41+     → extremehot

  HUM (%):
  <30     → dry
  30–60   → optimal
  >60     → humid
*/

function gasCategory(g) {
  g = parseInt(g) || 0;
  if (g <= 50)  return 'good';
  if (g <= 100) return 'moderate';
  if (g <= 150) return 'poor';
  if (g <= 200) return 'unhealthy';
  if (g <= 300) return 'severe';
  return 'hazardous';
}

function tempCategory(t) {
  t = parseFloat(t) || 0;
  if (t < 1)  return 'freezing';
  if (t <= 10) return 'chilly';
  if (t <= 20) return 'cool';
  if (t <= 30) return 'pleasant';
  if (t <= 40) return 'hot';
  return 'extremehot';
}

function humCategory(h) {
  h = parseFloat(h) || 0;
  if (h < 30)  return 'dry';
  if (h <= 60) return 'optimal';
  return 'humid';
}

// ── Display maps ─────────────────────────────────────────────
function GAS_DISP(gc) {
  const map = {
    good:      {key:'good',      icon:'fa-check-circle',      badgeClass:'badge-good',      orbClass:'aq-good',      fillClass:'aq-good',      scoreClass:'score-good',      mIco:'ico-gas-good',      mBadgeC:'mb-ok'},
    moderate:  {key:'moderate',  icon:'fa-circle-info',       badgeClass:'badge-moderate',  orbClass:'aq-moderate',  fillClass:'aq-moderate',  scoreClass:'score-moderate',  mIco:'ico-gas-moderate',  mBadgeC:'mb-warn'},
    poor:      {key:'poor',      icon:'fa-exclamation-circle',badgeClass:'badge-poor',      orbClass:'aq-poor',      fillClass:'aq-poor',      scoreClass:'score-poor',      mIco:'ico-gas-poor',      mBadgeC:'mb-warn'},
    unhealthy: {key:'unhealthy', icon:'fa-times-circle',      badgeClass:'badge-unhealthy', orbClass:'aq-unhealthy', fillClass:'aq-unhealthy', scoreClass:'score-unhealthy', mIco:'ico-gas-unhealthy', mBadgeC:'mb-bad'},
    severe:    {key:'severe',    icon:'fa-biohazard',         badgeClass:'badge-severe',    orbClass:'aq-severe',    fillClass:'aq-severe',    scoreClass:'score-severe',    mIco:'ico-gas-severe',    mBadgeC:'mb-sev'},
    hazardous: {key:'hazardous', icon:'fa-skull-crossbones',  badgeClass:'badge-hazardous', orbClass:'aq-hazardous', fillClass:'aq-hazardous', scoreClass:'score-hazardous', mIco:'ico-gas-hazardous', mBadgeC:'mb-haz'},
  };
  const e = map[gc] || map.good;
  const lbl = t('cat_lbl_' + e.key);
  return { ...e, label: lbl, mBadge: {c: e.mBadgeC, t: lbl} };
}
function TEMP_BADGE(tc) {
  const cls = {freezing:'mb-bad',chilly:'mb-warn',cool:'mb-ok',pleasant:'mb-ok',hot:'mb-warn',extremehot:'mb-bad'};
  return {c: cls[tc]||'mb-ok', t: t('temp_'+tc)};
}
function HUM_BADGE(hc) {
  const cls = {dry:'mb-bad', optimal:'mb-ok', humid:'mb-warn'};
  return {c: cls[hc]||'mb-ok', t: t('hum_'+hc)};
}

function getAqiSummary(gc) {
  return t('aqi_' + gc);
}

/* ── SMART RECOMMENDATION ───────────────────────────────── */
function buildRecommendations(t_val, h, g) {
  const gc = gasCategory(g);
  const tc = tempCategory(t_val);
  const hc = humCategory(h);
  const recs = [];

  if (gc === 'hazardous')     recs.push({ico:'☠️', txt: t('rec_gas_hazardous')});
  else if (gc === 'severe')   recs.push({ico:'⚠️', txt: t('rec_gas_severe')});
  else if (gc === 'unhealthy')recs.push({ico:'😷', txt: t('rec_gas_unhealthy')});
  else if (gc === 'poor')     recs.push({ico:'😮', txt: t('rec_gas_poor')});
  else if (gc === 'moderate') recs.push({ico:'🌬️', txt: t('rec_gas_moderate')});
  else                        recs.push({ico:'✅', txt: t('rec_gas_good')});

  if (tc === 'extremehot')    recs.push({ico:'🔥', txt: t('rec_temp_extremehot')});
  else if (tc === 'hot')      recs.push(hc === 'humid'
    ? {ico:'🌡️', txt: t('rec_temp_hot_humid')}
    : {ico:'☀️', txt: t('rec_temp_hot')});
  else if (tc === 'freezing') recs.push({ico:'🥶', txt: t('rec_temp_freezing')});
  else if (tc === 'chilly')   recs.push({ico:'❄️', txt: t('rec_temp_chilly')});
  else if (tc === 'pleasant') recs.push({ico:'😊', txt: t('rec_temp_pleasant')});
  else                        recs.push({ico:'🌤️', txt: t('rec_temp_default')});

  if (hc === 'humid')         recs.push({ico:'💧', txt: t('rec_hum_humid')});
  else if (hc === 'dry')      recs.push({ico:'🏜️', txt: t('rec_hum_dry')});
  else                        recs.push({ico:'✨', txt: t('rec_hum_optimal')});

  return recs;
}

/* ── APPLY HERO ─────────────────────────────────────────── */
function applyHero(gc, g, t, h) {
  const d    = GAS_DISP(gc);
  const hero = document.getElementById('aqi-hero');
  ['aq-good','aq-moderate','aq-poor','aq-unhealthy','aq-severe','aq-hazardous'].forEach(c => hero.classList.remove(c));
  hero.classList.add(d.orbClass);

  const orb = document.getElementById('aqi-orb');
  ['aq-good','aq-moderate','aq-poor','aq-unhealthy','aq-severe','aq-hazardous'].forEach(c => orb.classList.remove(c));
  orb.classList.add(d.orbClass);

  document.getElementById('aqi-icon').className = 'fas ' + d.icon;

  const scoreEl = document.getElementById('aqi-score');
  scoreEl.className = 'aqi-score ' + d.scoreClass;
  if (gc !== prevGasCat) {
    scoreEl.style.animation = 'none';
    void scoreEl.offsetWidth;
    scoreEl.style.animation = 'vup 0.6s cubic-bezier(.4,0,.2,1)';
  }

  const cur = parseInt(scoreEl.textContent) || 0;
  if (cur !== g) {
    let start = null;
    const dur = 800;
    function animScore(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      scoreEl.textContent = Math.round(cur + (g - cur) * (1 - Math.pow(1-p, 3)));
      if (p < 1) requestAnimationFrame(animScore);
    }
    requestAnimationFrame(animScore);
  }

  const badge = document.getElementById('aqi-cat-badge');
  badge.className = 'aqi-cat-badge ' + d.badgeClass;
  badge.innerHTML = `<i class="fas ${d.icon}"></i>&nbsp;${d.label}`;

  const sumEl = document.getElementById('aqi-summary');
  if (gc !== prevGasCat) {
    sumEl.style.opacity = '0';
    sumEl.style.transform = 'translateY(5px)';
    setTimeout(() => {
      sumEl.textContent = getAqiSummary(gc);
      sumEl.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      sumEl.style.opacity = '1';
      sumEl.style.transform = 'translateY(0)';
    }, 200);
  } else {
    sumEl.textContent = getAqiSummary(gc);
  }

  const fill = document.getElementById('aqi-fill');
  fill.style.width = Math.min((g / 400) * 100, 100) + '%';
  ['aq-good','aq-moderate','aq-poor','aq-unhealthy','aq-severe','aq-hazardous'].forEach(c => fill.classList.remove(c));
  fill.classList.add(d.fillClass);

  updateRecommendations(t, h, g);
  prevGasCat = gc;
}

/* ── SMART RECOMMENDATION — NO FLICKER ─────────────────── */

function updateRecommendations(t, h, g) {
  const gc = gasCategory(g);
  const tc = tempCategory(t);
  const hc = humCategory(h);
  const hasChanged = (
    prevRecState.temp === null ||
    Math.abs(prevRecState.temp - t) > 0.5 ||
    Math.abs(prevRecState.hum  - h) > 2   ||
    Math.abs(prevRecState.gas  - g) > 5   ||
    prevRecState.cats.t !== tc ||
    prevRecState.cats.h !== hc ||
    prevRecState.cats.g !== gc
  );
  const recs = buildRecommendations(t, h, g);
  const list = document.getElementById('rec-list');
  const nums = ['p1','p2','p3'];
  if (hasChanged) {
    list.innerHTML = recs.map((r, i) => `
      <div class="rec-item" style="animation-delay:${i*0.07}s">
        <div class="rec-num ${nums[i]||'p3'}">${i+1}</div>
        <div class="rec-ico">${r.ico}</div>
        <div class="rec-txt">${r.txt}</div>
      </div>`).join('');
  } else {
    recs.forEach((r, i) => {
      const item = list.querySelectorAll('.rec-item')[i];
      if (item) {
        const txtEl = item.querySelector('.rec-txt');
        const icoEl = item.querySelector('.rec-ico');
        if (txtEl) txtEl.textContent = r.txt;
        if (icoEl) icoEl.textContent = r.ico;
      }
    });
  }
  prevRecState = { temp: t, hum: h, gas: g, cats: {t:tc, h:hc, g:gc} };
}

/* ── APPLY CARDS ─────────────────────────────────────────── */
function setVal(id, html, changed) {
  const el = document.getElementById(id);
  if (changed) { el.classList.remove('vup'); void el.offsetWidth; el.classList.add('vup'); }
  el.innerHTML = html;
}

function getHumColor(hc) {
  if (hc === 'dry')     return 'rgba(244,114,182,1)';
  if (hc === 'optimal') return 'rgba(147,197,253,1)';
  return 'rgba(59,130,246,1)';
}
function getTempColor(tc) {
  const map = {
    freezing:'rgba(30,64,175,1)',  chilly:'rgba(59,130,246,1)',
    cool:'rgba(96,165,250,1)',     pleasant:'rgba(129,140,248,1)',
    hot:'rgba(249,115,22,1)',      extremehot:'rgba(239,68,68,1)'
  };
  return map[tc] || 'rgba(99,102,241,1)';
}
function getGasColor(gc) {
  const map = {
    good:'rgba(34,197,94,1)',     moderate:'rgba(234,179,8,1)',
    poor:'rgba(249,115,22,1)',    unhealthy:'rgba(239,68,68,1)',
    severe:'rgba(168,85,247,1)', hazardous:'rgba(127,29,29,1)'
  };
  return map[gc] || 'rgba(16,185,129,1)';
}

function updateSparklineColor(id, color) {
  if (spCh[id]) {
    spCh[id].data.datasets[0].borderColor = color;
    const ctx = spCh[id].ctx;
    const gr  = ctx.createLinearGradient(0, 0, 0, 36);
    gr.addColorStop(0, color.replace('1)', '0.2)'));
    gr.addColorStop(1, color.replace('1)', '0)'));
    spCh[id].data.datasets[0].backgroundColor = gr;
    spCh[id].update('none');
  }
}

function applyCards(temp_val, h, g) {
  const gc = gasCategory(g);
  const tc = tempCategory(temp_val);
  const hc = humCategory(h);

  const humCard = document.querySelector('.mc-hum');
  if (humCard) {
    ['hum-dry','hum-optimal','hum-humid'].forEach(c => humCard.classList.remove(c));
    humCard.classList.add('hum-' + hc);
  }
  const tempCard = document.querySelector('.mc-temp');
  if (tempCard) {
    ['temp-freezing','temp-chilly','temp-cool','temp-pleasant','temp-hot','temp-extremehot']
      .forEach(c => tempCard.classList.remove(c));
    tempCard.classList.add('temp-' + tc);
  }
  const gasCard = document.querySelector('.mc-gas');
  if (gasCard) {
    ['gas-good','gas-moderate','gas-poor','gas-unhealthy','gas-severe','gas-hazardous']
      .forEach(c => gasCard.classList.remove(c));
    gasCard.classList.add('gas-' + gc);
  }

  document.getElementById('ico-temp').className = 'mcard-ico ' + TEMP_ICO[tc];
  document.getElementById('ico-hum').className  = 'mcard-ico ' + HUM_ICO[hc];
  document.getElementById('ico-gas').className  = 'mcard-ico ' + GAS_DISP(gc).mIco;

  function setBadge(id, obj) {
    const el = document.getElementById(id);
    el.textContent = obj.t;
    el.className   = 'mbadge ' + obj.c;
  }
  setBadge('badge-temp', TEMP_BADGE(tc));
  setBadge('badge-hum',  HUM_BADGE(hc));
  setBadge('badge-gas',  GAS_DISP(gc).mBadge);

  updateSparklineColor('temp', getTempColor(tc));
  updateSparklineColor('hum',  getHumColor(hc));
  updateSparklineColor('gas',  getGasColor(gc));
}

/* ── REFRESH ALL LIVE BADGES (called from applyLang on lang switch) ── */
function refreshLiveBadges() {
  // Pakai data real jika ada, fallback ke default agar badge tetap ter-render
  const t_val = (prevVals.temp !== null) ? prevVals.temp : 27;
  const h     = (prevVals.hum  !== null) ? prevVals.hum  : 55;
  const g     = (prevVals.gas  !== null) ? prevVals.gas  : 0;
  const gc    = gasCategory(g);
  const d     = GAS_DISP(gc);

  // Re-apply all cards (badges + icons)
  applyCards(t_val, h, g);

  // AQI hero badge
  const badge = document.getElementById('aqi-cat-badge');
  if (badge) badge.innerHTML = `<i class="fas ${d.icon}"></i>&nbsp;${d.label}`;

  // Sensor page gas status
  const sg = document.getElementById('s-gas-status');
  if (sg) sg.textContent = d.label;

  // AQI summary text
  const sumEl = document.getElementById('aqi-summary');
  if (sumEl) sumEl.textContent = getAqiSummary(gc);

  // Last update text
  const lu = document.getElementById('last-update');
  if (lu && lastUpdateTime) lu.textContent = t('updating') + lastUpdateTime;

  // Refresh chart dataset labels
  if (typeof mainChart !== 'undefined' && mainChart) {
    mainChart.data.datasets[0].label = t('tog_gas');
    mainChart.data.datasets[1].label = t('tog_temp');
    mainChart.data.datasets[2].label = t('tog_hum');
    mainChart.update('none');
  }
  // Refresh chart stat label
  const cstatL = document.querySelector('.cstat-l');
  if (cstatL) cstatL.textContent = t('tog_gas');
  // Re-render history/alerts if loaded
  if (histAll && histAll.length) { renderHistory(); renderAlerts(); }
}

// ============================================================
//  LIVE FETCH
//  Memakai endpoint baru get_latest.php (1 baris saja)
//  Interval: 10000ms (sinkron dengan interval ESP8266)
// ============================================================

function fetchLive() {
  fetch(BASE_URL + '/get_latest.php')
    .then(r => r.json())
    .then(d => {
      if (!d || d.error) return;

      const t_val = parseFloat(d.temperature);
      const h  = parseFloat(d.humidity);
      const g  = parseInt(d.gas);
      const gc = gasCategory(g);  // ← status dihitung di JS, bukan dari DB

      applyHero(gc, g, t_val, h);
      applyCards(t_val, h, g);

      setVal('temp', `${t_val}&thinsp;<span class="mcard-unit">°C</span>`,   t !== prevVals.temp);
      setVal('hum',  `${h}&thinsp;<span class="mcard-unit">%</span>`,    h !== prevVals.hum);
      setVal('gas',  `${g}&thinsp;<span class="mcard-unit">PPM</span>`,  g !== prevVals.gas);
      prevVals = {temp:t_val, hum:h, gas:g};

      pushSp('temp', t); pushSp('hum', h); pushSp('gas', g);

      const ts = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
      const MAX_PTS = 50;
      if (mainChart.data.labels.length >= MAX_PTS) {
        mainChart.data.labels.shift();
        mainChart.data.datasets.forEach(ds => ds.data.shift());
      }
      mainChart.data.labels.push(ts);
      mainChart.data.datasets[0].data.push(g);
      mainChart.data.datasets[1].data.push(t_val);
      mainChart.data.datasets[2].data.push(h);
      mainChart.update('none');
      document.getElementById('chart-latest').textContent = g;

      document.getElementById('s-temp').innerHTML = `${t_val} <span class="svunit">°C</span>`;
      document.getElementById('s-hum').innerHTML  = `${h} <span class="svunit">%</span>`;
      document.getElementById('s-gas').innerHTML  = `${g} <span class="svunit">PPM</span>`;
      const sg = document.getElementById('s-gas-status');
      sg.textContent = GAS_DISP(gc).label;
      sg.style.color = '';

      const now = new Date().toLocaleString('id-ID');
      lastUpdateTime = now;
      document.getElementById('last-update').textContent = t('updating') + now;
      document.getElementById('cfg-lastupdate').textContent = now;

      ['cfg-device','cfg-db','cfg-mq','cfg-dht'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.className='status-dot online'; el.innerHTML='<span class="dot"></span>Online'; }
      });
    })
    .catch(e => {
      console.warn('[fetchLive] Error:', e);
      const dev = document.getElementById('cfg-device');
      if (dev) { dev.className='status-dot offline'; dev.innerHTML='<span class="dot"></span>Offline'; }
    });
}

setInterval(fetchLive, 10000);  // 3 detik
document.getElementById('last-update').textContent = t('loading_update');
fetchLive();

// ============================================================
//  HISTORY SYSTEM
//  Memakai endpoint baru get_history.php?granularity=30min
//  Status selalu dihitung dari gas menggunakan gasCategory()
// ============================================================


/* ── Robust date parser ─────────────────────────────────── */
function parseDate(str) {
  if (!str) return null;
  const months = {
    'Jan':0,'Feb':1,'Mar':2,'Apr':3,'Mei':4,'May':4,'Jun':5,'Jul':6,
    'Agu':7,'Aug':7,'Sep':8,'Okt':9,'Oct':9,'Nov':10,'Des':11,'Dec':11
  };
  const parts = str.trim().split(' ');
  if (parts.length >= 4) {
    const day   = parseInt(parts[0]);
    const month = months[parts[1]];
    const year  = parseInt(parts[2]);
    const timeParts = (parts[3] || '00:00:00').split(':');
    const hour  = parseInt(timeParts[0]) || 0;
    const min   = parseInt(timeParts[1]) || 0;
    const sec   = parseInt(timeParts[2]) || 0;
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day, hour, min, sec);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function modeOf(arr) {
  const freq = {};
  let best = arr[0], bestN = 0;
  arr.forEach(v => {
    freq[v] = (freq[v] || 0) + 1;
    if (freq[v] > bestN) { bestN = freq[v]; best = v; }
  });
  return best;
}

/* ── Render helper functions ─────────────────────────────── */
function hBadgeClass(cat) {
  const map = {good:'hb-g',moderate:'hb-m',poor:'hb-po',unhealthy:'hb-u',severe:'hb-sv',hazardous:'hb-h'};
  return map[cat] || 'hb-g';
}
function hCatLabel(cat) {
  const map = {good:'Good',moderate:'Moderate',poor:'Poor',unhealthy:'Unhealthy',severe:'Severe',hazardous:'Hazardous'};
  return map[cat] || cat;
}
function hSummaryText(cat, temp, hum) {
  const tc = tempCategory(temp), hc = humCategory(hum);
  const airKey = {
    good:'h_air_good', moderate:'h_air_moderate', poor:'h_air_poor',
    unhealthy:'h_air_unhealthy', severe:'h_air_severe', hazardous:'h_air_hazardous'
  }[cat] || 'h_air_unknown';
  const tPart = tc==='hot'? t('h_hot') : tc==='extremehot'? t('h_extremehot') : tc==='chilly'? t('h_chilly') : '';
  const hPart = hc==='humid'? t('h_humid') : hc==='dry'? t('h_dry') : '';
  return t(airKey) + tPart + hPart + '.';
}

function filterByDate(rows, dateFilter) {
  if (dateFilter === 'all') return rows;
  const now       = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.filter(r => {
    const rDate     = parseDate(r.slot_time);
    if (!rDate) return false;
    const rDayStart = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());
    const diffDays  = Math.round(Math.abs(todayStart - rDayStart) / 86400000);
    if (dateFilter === 'today')     return diffDays === 0;
    if (dateFilter === 'yesterday') return diffDays === 1;
    if (dateFilter === '2days')     return diffDays === 2;
    if (dateFilter === '3days')     return diffDays === 3;
    return true;
  });
}

/* ── Render History ─────────────────────────────────────── */
function renderHistory() {
  const list = document.getElementById('hist-list');
  let rows = filterByDate(histAll, histDateFilter);

  // Hitung status dari gas — TIDAK menggunakan status dari DB
  let display = rows.map(r => ({
    slot_time:    r.slot_time,
    label:        r.slot_time,
    cat:          gasCategory(r.gas),     // ← single source of truth
    temp:         parseFloat(r.temperature),
    hum:          parseFloat(r.humidity),
    gas:          parseInt(r.gas),
    sample_count: r.sample_count || 0
  }));

  if (histFilter !== 'All') {
    const fCat = histFilter.toLowerCase();
    display = display.filter(h => h.cat === fCat);
  }

  if (!display.length) {
    list.innerHTML = `<div class="empty-s"><i class="fas fa-inbox"></i>${t('no_data')}</div>`;
    return;
  }

  list.innerHTML = display.map(h => `
    <div class="hist-item">
      <div class="hhour">
        <i class="fas fa-clock" style="color:#94a3b8;font-size:9px;margin-right:4px"></i>${h.label}
      </div>
      <div class="hbadge ${hBadgeClass(h.cat)}">${hCatLabel(h.cat)}</div>
      <div class="hdata">
        <div class="hcell"><div class="hlbl">${t('lbl_suhu')}</div>      <div class="hval">${h.temp}°C</div></div>
        <div class="hcell"><div class="hlbl">${t('lbl_kelembapan')}</div><div class="hval">${h.hum}%</div></div>
        <div class="hcell"><div class="hlbl">${t('lbl_indeks_gas')}</div><div class="hval">${h.gas}</div></div>
        ${h.sample_count ? `<div class="hcell"><div class="hlbl">${t('lbl_sampel')}</div><div class="hval">${h.sample_count}</div></div>` : ''}
      </div>
      <div class="hsum">${hSummaryText(h.cat, h.temp, h.hum)}</div>
    </div>`).join('');
}

/* ── Render Alerts ──────────────────────────────────────── */
function renderAlerts() {
  const container = document.getElementById('alert-list');

  // Status dihitung dari gas — TIDAK dari DB
  const dangerous = histAll
    .map(r => ({
      slot_time: r.slot_time,
      cat:       gasCategory(r.gas),  // ← single source of truth
      temp:      parseFloat(r.temperature),
      hum:       parseFloat(r.humidity),
      gas:       parseInt(r.gas)
    }))
    .filter(h => DANGER_CATS_EN.includes(h.cat));

  if (!dangerous.length) {
    container.innerHTML = `
      <div class="alert-safe">
        <i class="fas fa-shield-check"></i>
        <h3>${t('alerts_safe_title')}</h3>
        <p>${t('alerts_safe_desc')}</p>
      </div>`;
    return;
  }

  container.innerHTML = dangerous.map(h => `
    <div class="alert-item">
      <div class="hhour">${h.slot_time}</div>
      <div class="hbadge ${hBadgeClass(h.cat)}">${hCatLabel(h.cat)}</div>
      <div class="hsum">${hSummaryText(h.cat, h.temp, h.hum)}</div>
    </div>
  `).join('');
}

/* ── Load History — memakai endpoint baru ────────────────── */
function loadHistory() {
  // Tentukan parameter days berdasarkan filter aktif
  const daysMap = { all:'7', today:'1', yesterday:'2', '2days':'3', '3days':'4' };
  const daysParam = daysMap[histDateFilter] || '7';

  fetch(`${BASE_URL}/get_history.php?granularity=30min&days=${daysParam}`)
    .then(r => r.json())
    .then(data => {
      histAll = Array.isArray(data) ? data : [];
      renderHistory();
      renderAlerts();
    })
    .catch(() => {
      const msg = `<div class="empty-s"><i class="fas fa-exclamation-circle"></i>${t('load_fail')}</div>`;
      document.getElementById('hist-list').innerHTML  = msg;
      document.getElementById('alert-list').innerHTML = msg;
    });
}

/* ── History filter chips ───────────────────────────────── */
document.querySelectorAll('.fchip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.fchip').forEach(x => x.className='fchip');
    const f = c.dataset.f;
    histFilter = f;
    const classMap = {
      All:'act', Good:'act-g', Moderate:'act-m', Poor:'act-po',
      Unhealthy:'act-u', Severe:'act-s', Hazardous:'act-h'
    };
    c.classList.add(classMap[f] || 'act');
    renderHistory();
  });
});

/* ── Date dropdown ──────────────────────────────────────── */
document.getElementById('hist-date-sel').addEventListener('change', function() {
  histDateFilter = this.value;
  loadHistory();  // reload dari server dengan parameter days yang sesuai
});

// ── Re-apply language AFTER all functions are defined ────
// This ensures badges render correctly in the active language on first load
refreshLiveBadges();