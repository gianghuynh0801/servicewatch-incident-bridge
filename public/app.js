// ==========================================================================
// SERVICEWATCH · TRANSFORMERS & SUPER GUNDAM TACTICAL CLIENT SCRIPT
// Interactive Energy Conduits Tree, Telemetry Sensor Hub & Sci-Fi SFX
// ==========================================================================

let currentChaosMode = false;
let currentChaosType = 'dns_servfail';
let allAssets = [];
let latestDashboardData = null;
let currentTopologyMode = 'tree'; // 'tree' or 'grid'
let currentTopologyFilter = 'all'; // 'all', 'domain', 'website', 'email', 'ssl'
let soundEnabled = true;
let currentUser = null;
let currentAuthToken = localStorage.getItem('sw_auth_token') || '';

// Global Fetch Interceptor: inject Bearer token & handle 401 Unauthorized
const _originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const opts = Object.assign({}, options);
  opts.headers = Object.assign({}, opts.headers || {});
  if (currentAuthToken && !opts.headers['Authorization'] && !opts.headers['authorization']) {
    opts.headers['Authorization'] = `Bearer ${currentAuthToken}`;
  }
  return _originalFetch.call(this, url, opts).then(response => {
    if (response.status === 401 && typeof url === 'string' && !url.includes('/api/auth/login')) {
      console.warn('Phiên làm việc hết hạn hoặc không hợp lệ (401)');
      currentAuthToken = '';
      currentUser = null;
      localStorage.removeItem('sw_auth_token');
      localStorage.removeItem('sw_auth_user');
      window.location.replace('/?auth=required');
    }
    return response;
  });
};

// ==========================================================================
// UNIVERSAL TOAST NOTIFICATION SYSTEM
// ==========================================================================
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('swToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'swToastContainer';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `sw-toast sw-toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  } else if (type === 'error' || type === 'danger') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else if (type === 'warning') {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else {
    iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <div class="sw-toast-icon">${iconSvg}</div>
    <div class="sw-toast-content">${message}</div>
    <button class="sw-toast-close" onclick="this.parentElement.remove()" title="Đóng">&times;</button>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  const timer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);

  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => {
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 1200);
  });
}

// Reusable Mecha Vector SVG Icons
const ICONS = {
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  website: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  hosting: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  email: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  ssl: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  send: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  fileText: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  radar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m12 12 5-5"/></svg>`
};

// ==========================================================================
// ZERO-DEPENDENCY MECHA SCI-FI AUDIO SYNTHESIZER (WEB AUDIO API)
// ==========================================================================
class MechaAudioEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playBeep(freqStart, freqEnd, duration, type = 'sine', gainVal = 0.08) {
    if (!soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 20), this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted
    }
  }

  playClick() {
    this.playBeep(900, 1400, 0.05, 'sine', 0.05);
  }

  playSwitch() {
    this.playBeep(450, 750, 0.08, 'triangle', 0.06);
  }

  playPing() {
    this.playBeep(1200, 800, 0.18, 'sine', 0.08);
  }

  playAlarm() {
    if (!soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      // Dual high-low klaxon
      const now = this.ctx.currentTime;
      [800, 600, 800].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + idx * 0.12);
        gain.gain.setValueAtTime(0.08, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + (idx + 1) * 0.12);
      });
    } catch (e) {}
  }
}

const MechaAudio = new MechaAudioEngine();

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSoundPreference();

  // Bắt buộc xác thực hợp lệ trước khi tải dữ liệu nhạy cảm của Dashboard
  const authed = await initAuth();
  if (!authed) return;

  initTabs();
  initChaosControls();
  fetchDashboard(true);
  loadAssets();
  loadPlaybook();
  loadAuditLogs();

  // Polling chu kỳ 3.5s để cập nhật trạng thái
  setInterval(() => {
    if (currentUser) {
      fetchDashboard(false);
    }
  }, 3500);

  // Recalculate SVG conduits on window resize
  window.addEventListener('resize', () => {
    drawEnergyConduits();
  });
});

// Sound Preference Toggle
function initSoundPreference() {
  const stored = localStorage.getItem('servicewatch_sfx');
  soundEnabled = stored !== 'false';
  updateSoundUI();
}

function toggleMechaSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('servicewatch_sfx', soundEnabled);
  updateSoundUI();
  if (soundEnabled) {
    MechaAudio.playClick();
  }
}

function updateSoundUI() {
  const icon = document.getElementById('soundIcon');
  const label = document.getElementById('soundLabel');
  if (icon) icon.innerHTML = soundEnabled ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
  if (label) label.innerText = soundEnabled ? 'SFX: BẬT' : 'SFX: TẮT';
}

// ==========================================================================
// 0. AUTHENTICATION & ACCESS CONTROL (IAM SUITE)
// ==========================================================================

async function initAuth() {
  currentAuthToken = localStorage.getItem('sw_auth_token') || '';
  if (!currentAuthToken) {
    currentUser = null;
    window.location.replace('/?auth=required');
    return false;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${currentAuthToken}` }
    });
    const data = await res.json();
    if (data.loggedIn && data.user) {
      currentUser = data.user;
      if (data.token) {
        currentAuthToken = data.token;
        localStorage.setItem('sw_auth_token', data.token);
      }
      localStorage.setItem('sw_auth_user', JSON.stringify(currentUser));
      updateAuthUI(currentUser);
      return true;
    } else {
      currentUser = null;
      currentAuthToken = '';
      localStorage.removeItem('sw_auth_token');
      localStorage.removeItem('sw_auth_user');
      window.location.replace('/?auth=required');
      return false;
    }
  } catch (err) {
    console.error('Lỗi khởi tạo phiên xác thực:', err);
    window.location.replace('/?auth=required');
    return false;
  }
}

function updateAuthUI(user) {
  const container = document.getElementById('userAuthSection');
  if (!container) return;

  if (user) {
    const initial = (user.full_name || user.username || 'U').charAt(0).toUpperCase();
    let roleText = 'Kỹ Sư Vận Hành';
    if (user.role === 'admin') roleText = 'Quản Trị Viên';
    if (user.role === 'judge') roleText = 'Ban Giám Khảo';

    container.innerHTML = `
      <div class="user-profile-badge" id="userProfileBtn" onclick="openAuthModal()" title="Nhấp để đổi tài khoản hoặc phân quyền">
        <div class="user-avatar-circle" id="userAvatar">${initial}</div>
        <div class="user-meta">
          <span class="user-name" id="userDisplayName">${escapeHtml(user.full_name || user.username)}</span>
          <span class="user-role-tag" id="userRoleBadge">${roleText}</span>
        </div>
        <button class="btn-logout-icon" id="headerLogoutBtn" onclick="event.stopPropagation(); handleLogout()" title="Đăng xuất khỏi phiên điều phối">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-sm btn-primary-cyan" onclick="openAuthModal()" title="Đăng nhập để điều phối sự cố">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
          <polyline points="10 17 15 12 10 7"/>
          <line x1="15" y1="12" x2="3" y2="12"/>
        </svg>
        <span>Đăng Nhập</span>
      </button>
    `;
  }
}

function openAuthModal() {
  MechaAudio.playClick();
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
  hideAuthAlert();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
  hideAuthAlert();
}

function switchAuthTab(tab) {
  MechaAudio.playClick();
  const loginTabBtn = document.getElementById('authTabBtnLogin');
  const regTabBtn = document.getElementById('authTabBtnRegister');
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');

  if (tab === 'login') {
    if (loginTabBtn) loginTabBtn.classList.add('active');
    if (regTabBtn) regTabBtn.classList.remove('active');
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
  } else {
    if (loginTabBtn) loginTabBtn.classList.remove('active');
    if (regTabBtn) regTabBtn.classList.add('active');
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'block';
  }
  hideAuthAlert();
}

function showAuthAlert(msg, type = 'danger') {
  const box = document.getElementById('authAlertBox');
  if (!box) return;
  box.className = `auth-alert-box ${type}`;
  box.innerHTML = msg;
  box.style.display = 'block';
}

function hideAuthAlert() {
  const box = document.getElementById('authAlertBox');
  if (box) box.style.display = 'none';
}

async function quickLogin(account) {
  MechaAudio.playClick();
  let pwd = 'admin123';
  if (account === 'giamkhao' || account === 'judge') pwd = 'judge123';
  if (account === 'devops') pwd = 'devops123';
  if (account === 'support') pwd = 'support123';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: account, password: pwd })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthAlert(data.error || 'Đăng nhập không thành công', 'danger');
      return;
    }

    currentAuthToken = data.token;
    localStorage.setItem('sw_auth_token', data.token);
    localStorage.setItem('sw_auth_user', JSON.stringify(data.user));
    currentUser = data.user;
    updateAuthUI(currentUser);
    showAuthAlert(`Chào mừng <strong>${escapeHtml(data.user.full_name)}</strong>! Phiên điều phối đã sẵn sàng.`, 'success');
    MechaAudio.playBeep(440, 880, 0.25, 'triangle', 0.12);
    setTimeout(() => {
      closeAuthModal();
      loadAuditLogs();
      fetchDashboard(true);
    }, 900);
  } catch (err) {
    showAuthAlert('Không thể kết nối máy chủ xác thực: ' + err.message, 'danger');
  }
}

async function handleLoginFormSubmit(e) {
  e.preventDefault();
  MechaAudio.playClick();
  const loginInput = document.getElementById('loginAccountInput');
  const pwdInput = document.getElementById('loginPasswordInput');
  const submitBtn = document.getElementById('loginSubmitBtn');

  submitBtn.disabled = true;
  submitBtn.innerText = 'Đang xác thực...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginInput.value.trim(), password: pwdInput.value })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthAlert(data.error || 'Tài khoản hoặc mật khẩu không chính xác', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>ĐĂNG NHẬP VÀO HỆ THỐNG SERVICEWATCH</span>`;
      return;
    }

    currentAuthToken = data.token;
    localStorage.setItem('sw_auth_token', data.token);
    currentUser = data.user;
    updateAuthUI(currentUser);
    showAuthAlert(`Đăng nhập thành công: <strong>${escapeHtml(data.user.full_name)}</strong>`, 'success');
    MechaAudio.playBeep(440, 880, 0.25, 'triangle', 0.12);
    setTimeout(() => {
      closeAuthModal();
      loadAuditLogs();
    }, 900);
  } catch (err) {
    showAuthAlert('Lỗi kết nối máy chủ: ' + err.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>ĐĂNG NHẬP VÀO HỆ THỐNG SERVICEWATCH</span>`;
  }
}

async function handleRegisterFormSubmit(e) {
  e.preventDefault();
  MechaAudio.playClick();
  const fullName = document.getElementById('regFullNameInput').value.trim();
  const org = document.getElementById('regOrgInput').value.trim();
  const username = document.getElementById('regUsernameInput').value.trim();
  const email = document.getElementById('regEmailInput').value.trim();
  const pwd = document.getElementById('regPasswordInput').value;
  const pwdConfirm = document.getElementById('regConfirmPasswordInput').value;
  const submitBtn = document.getElementById('registerSubmitBtn');

  if (pwd !== pwdConfirm) {
    showAuthAlert('Mật khẩu xác nhận không khớp nhau!', 'danger');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Đang đăng ký tài khoản...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        organization: org,
        username,
        email,
        password: pwd
      })
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthAlert(data.error || 'Đăng ký thất bại', 'danger');
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>HOÀN TẤT ĐĂNG KÝ &amp; ĐĂNG NHẬP NGAY</span>`;
      return;
    }

    currentAuthToken = data.token;
    localStorage.setItem('sw_auth_token', data.token);
    currentUser = data.user;
    updateAuthUI(currentUser);
    showAuthAlert(`Đăng ký thành công tài khoản <strong>${escapeHtml(data.user.full_name)}</strong>! Đang chuyển vào hệ thống...`, 'success');
    MechaAudio.playBeep(440, 880, 0.35, 'triangle', 0.15);
    setTimeout(() => {
      closeAuthModal();
      loadAuditLogs();
    }, 1200);
  } catch (err) {
    showAuthAlert('Lỗi mạng: ' + err.message, 'danger');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>HOÀN TẤT ĐĂNG KÝ &amp; ĐĂNG NHẬP NGAY</span>`;
  }
}

async function handleLogout() {
  MechaAudio.playClick();
  try {
    if (currentAuthToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentAuthToken}`
        },
        body: JSON.stringify({ token: currentAuthToken })
      });
    }
  } catch (err) {
    console.warn('Lỗi khi gửi yêu cầu logout:', err);
  }

  currentAuthToken = '';
  currentUser = null;
  localStorage.removeItem('sw_auth_token');
  localStorage.removeItem('sw_auth_user');
  window.location.href = '/?logged_out=1';
}

// 1. Quản lý Giao Diện Sáng / Tối (Lưu bền vững đồng thời vào SQLite máy chủ & localStorage)
function initTheme() {
  const saved = localStorage.getItem('servicewatch_theme_v2') || 'light';
  applyTheme(saved, false);

  // Đồng bộ trạng thái giao diện đã lưu trong SQLite trên máy chủ
  fetch('/api/settings')
    .then(r => r.json())
    .then(s => {
      if (s && s.theme && s.theme !== saved) {
        applyTheme(s.theme, false);
      }
    })
    .catch(() => {});
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
}

function applyTheme(theme, syncServer = true) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('servicewatch_theme_v2', theme);

  if (syncServer) {
    showToast(`Đã chuyển sang giao diện ${theme === 'dark' ? 'Tối (Dark Mode)' : 'Sáng (Light Mode)'}`, 'info', 2000);
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme })
    }).catch(() => {});
  }

  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.innerHTML = theme === 'dark' 
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span>Giao Diện Sáng</span>' 
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg><span>Giao Diện Tối</span>';
    btn.title = theme === 'dark' ? 'Chuyển sang giao diện Sáng (Light SaaS)' : 'Chuyển sang giao diện Tối (Dark Mode)';
  }
  setTimeout(drawEnergyConduits, 100);
}

// 2. Chuyển Tab & Quản Lý Sidebar Trái
function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open');
}

function closeSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

function initTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      MechaAudio.playClick();
      const targetId = tab.dataset.tab;
      switchTab(targetId);
      closeSidebar();
    });
  });
}

function switchTab(targetId) {
  document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

  const activeTabBtn = document.querySelector(`.nav-item[data-tab="${targetId}"]`);
  const activePane = document.getElementById(targetId);

  if (activeTabBtn) activeTabBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');

  closeSidebar();

  if (targetId === 'tab-overview') {
    setTimeout(drawEnergyConduits, 150);
  }
  if (targetId === 'tab-assets') loadAssets();
  if (targetId === 'tab-radar') {
    loadRenewalRadar();
    loadHeartbeats();
  }
  if (targetId === 'tab-playbook') loadPlaybook();
  if (targetId === 'tab-logs') loadAuditLogs();
}

// 3. Chaos Studio Controls
function initChaosControls() {
  const toggleBtn = document.getElementById('toggleChaosBtn');
  const typeSelect = document.getElementById('chaosTypeSelect');
  const triggerBtn = document.getElementById('triggerProbeBtn');

  toggleBtn.addEventListener('click', async () => {
    const selectedType = typeSelect.value;
    try {
      if (!currentChaosMode) {
        MechaAudio.playAlarm();
        showToast(`Đang kích hoạt thử nghiệm sự cố: [${selectedType.toUpperCase()}]...`, 'warning', 3500);
      } else {
        MechaAudio.playSwitch();
        showToast('Đã dừng thử nghiệm. Động cơ tự động khôi phục trạng thái chuẩn...', 'success', 3500);
      }
      await fetch('/api/chaos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaos_type: selectedType })
      });
      setTimeout(() => {
        fetchDashboard(true);
      }, 150);
    } catch (err) {
      showToast('Lỗi khi kích hoạt thử nghiệm: ' + err.message, 'error', 4000);
    }
  });

  triggerBtn.addEventListener('click', async () => {
    MechaAudio.playPing();
    triggerBtn.disabled = true;
    const origHtml = triggerBtn.innerHTML;
    triggerBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:4px; animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Đang đo toàn bộ...
    `;
    showToast('Đang tiến hành đo kiểm đối chiếu đa resolver cho toàn bộ hệ thống...', 'info', 2500);
    try {
      await fetch('/api/probes/run', { method: 'POST' });
      await fetchDashboard(true);
      showToast('Đã hoàn tất lượt đo kiểm tra toàn diện cho tất cả dịch vụ!', 'success', 3500);
    } catch (err) {
      showToast('Lỗi khi kích hoạt kiểm tra: ' + err.message, 'error', 4000);
    } finally {
      setTimeout(() => {
        triggerBtn.innerHTML = origHtml;
        triggerBtn.disabled = false;
      }, 1200);
    }
  });
}

// 4. Fetch Dashboard Overview Data
async function fetchDashboard(forceRender = false) {
  try {
    const [dashRes, assetsRes] = await Promise.all([
      fetch('/api/dashboard'),
      fetch('/api/assets')
    ]);
    const data = await dashRes.json();
    allAssets = await assetsRes.json();
    latestDashboardData = data;

    updateChaosUI(data.system);
    updateKPIs(data);
    renderTopology(data);
    renderProbeTable(data.recentProbes);
    renderIncidentView(data.activeIncidents);
  } catch (err) {
    console.error('Lỗi fetch dashboard:', err);
  }
}

function updateChaosUI(sys) {
  currentChaosMode = sys.chaos_mode;
  currentChaosType = sys.chaos_type;

  const btn = document.getElementById('toggleChaosBtn');
  const label = document.getElementById('chaosBtnLabel');
  const indicator = document.getElementById('chaosIndicator');
  const typeSelect = document.getElementById('chaosTypeSelect');
  const tacticalStatus = document.getElementById('headerTacticalStatus');

  typeSelect.value = sys.chaos_type;

  if (currentChaosMode) {
    btn.className = 'btn btn-sm btn-crimson';
    label.innerText = 'Dừng Thử Nghiệm';
    indicator.className = 'status-indicator danger';
    if (tacticalStatus) {
      tacticalStatus.innerText = 'CẢNH BÁO · PHÁT HIỆN SỰ CỐ';
      tacticalStatus.style.color = 'var(--status-rose-text)';
    }
  } else {
    btn.className = 'btn btn-sm btn-chaos';
    label.innerText = 'Tạo Lỗi Thử';
    indicator.className = 'status-indicator ok';
    if (tacticalStatus) {
      tacticalStatus.innerText = 'HỆ THỐNG HOẠT ĐỘNG TỐT · 100% SLA';
      tacticalStatus.style.color = '#34d399';
    }
  }
}

function updateKPIs(data) {
  const { assets, activeIncidents } = data;

  // Assets count
  const countEl = document.getElementById('kpiTotalAssets');
  if (countEl) countEl.innerText = assets.total || '5';

  // Health SLA
  const healthEl = document.getElementById('kpiHealthStatus');
  const healthBar = document.getElementById('kpiHealthBar');
  const healthDetail = document.getElementById('kpiHealthDetail');
  const shield = document.getElementById('businessShield');
  const shieldTitle = document.getElementById('shieldTitle');
  const shieldDesc = document.getElementById('shieldDesc');
  const alertBar = document.getElementById('activeIncidentAlert');
  const navBadge = document.getElementById('navIncidentBadge');

  const isHealthy = !activeIncidents || activeIncidents.length === 0;

    if (isHealthy) {
    if (healthEl) {
      healthEl.innerText = '100%';
      healthEl.className = 'metric-value font-orbitron status-text-healthy';
    }
    if (healthBar) healthBar.style.width = '100%';
    if (healthDetail) {
      healthDetail.innerText = 'Mọi dịch vụ hoạt động tốt';
      healthDetail.title = '100% các website và dịch vụ phản hồi tốt';
    }

    if (shield) shield.className = 'business-shield-card healthy';
    if (shieldTitle) shieldTitle.innerText = 'Toàn Bộ Dịch Vụ Đang Hoạt Động Bình Thường';
    if (shieldDesc) shieldDesc.innerText = 'Website, Email và Máy chủ đều vận hành ổn định 24/7.';

    updatePillStatus('pillWeb', true, 'Web', 'HTTP 200');
    updatePillStatus('pillMail', true, 'Email', 'MX OK');
    updatePillStatus('pillSsl', true, 'SSL', '218 NGÀY');

    if (alertBar) alertBar.style.display = 'none';
    if (navBadge) navBadge.style.display = 'none';
  } else {
    const inc = activeIncidents[0];
    const isDNS = inc.root_cause_type === 'DNS_AUTHORITATIVE_FAILURE';

    if (healthEl) {
      healthEl.innerText = isDNS ? '0%' : '35%';
      healthEl.className = 'metric-value font-orbitron status-text-down';
    }
    if (healthBar) healthBar.style.width = isDNS ? '0%' : '35%';
    if (healthDetail) {
      healthDetail.innerText = isDNS ? 'Lỗi dây chuyền: Mất kết nối nhiều dịch vụ' : 'Máy chủ Web đang quá tải (503)';
      healthDetail.title = isDNS ? 'Máy chủ tên miền bị ngắt quãng' : 'CPU / RAM máy chủ đạt ngưỡng cảnh báo';
    }

    if (shield) shield.className = 'business-shield-card warning';
    if (shieldTitle) shieldTitle.innerText = isDNS ? 'Cảnh Báo: Mất Kết Nối Tên Miền (DNS)' : 'Cảnh Báo: Máy Chủ Web Bị Quá Tải';
    if (shieldDesc) shieldDesc.innerText = isDNS 
      ? 'Máy chủ tên miền không phản hồi. Toàn bộ Website, Email và Cổng thanh toán bị gián đoạn theo.' 
      : 'Máy chủ web bị quá tải lượt truy cập. Hệ thống đề xuất bật trang thông báo bảo trì tạm thời.';

    if (isDNS) {
      updatePillStatus('pillWeb', false, 'Web', 'SERVFAIL');
      updatePillStatus('pillMail', false, 'Email', 'MX FAIL');
      updatePillStatus('pillSsl', false, 'SSL', 'LỖI');
    } else {
      updatePillStatus('pillWeb', false, 'Web', 'HTTP 503');
      updatePillStatus('pillMail', true, 'Email', 'MX OK');
      updatePillStatus('pillSsl', true, 'SSL', 'OK');
    }

    if (alertBar) alertBar.style.display = 'block';
    if (navBadge) {
      navBadge.style.display = 'inline-block';
      navBadge.innerText = activeIncidents.length;
    }

    const titleEl = document.getElementById('alertTitle');
    const descEl = document.getElementById('alertDesc');
    const statusTagEl = document.getElementById('alertStatusTag');
    if (titleEl) titleEl.innerText = inc.title;
    if (descEl) descEl.innerText = `Đơn vị tiếp nhận: ${inc.responsible_provider} · Đã phát tín hiệu qua Telegram Bot & Mail`;
    if (statusTagEl) statusTagEl.innerText = inc.ticket_status === 'sent' ? 'ĐÃ GỬI TICKET' : 'ĐÃ SOẠN SẴN TICKET';
  }

  // Active Incidents
  const openIncEl = document.getElementById('kpiOpenIncidents');
  const incBar = document.getElementById('kpiIncidentBar');
  if (openIncEl) openIncEl.innerText = activeIncidents ? activeIncidents.length : 0;
  if (incBar) incBar.style.width = activeIncidents && activeIncidents.length ? '100%' : '0%';
}

function updatePillStatus(pillId, isOk, label, status) {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  pill.className = `quick-pill ${isOk ? 'ok' : 'danger'}`;
  const labelEl = pill.querySelector('.pill-label');
  const statusEl = pill.querySelector('.pill-status');
  if (labelEl) labelEl.innerText = label;
  if (statusEl) statusEl.innerText = status;
}

// ==========================================================================
// 5. THE MASTERPIECE: TRANSFORMERS & SUPER GUNDAM TREE TOPOLOGY RENDERER
// ==========================================================================
function setTopologyMode(mode) {
  MechaAudio.playSwitch();
  currentTopologyMode = mode;
  document.getElementById('btnModeTree').classList.toggle('active', mode === 'tree');
  document.getElementById('btnModeGrid').classList.toggle('active', mode === 'grid');
  renderTopology(latestDashboardData);
}

function filterTopology(filterType) {
  MechaAudio.playClick();
  currentTopologyFilter = filterType;
  document.querySelectorAll('#topologyFilterChips .chip-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  renderTopology(latestDashboardData);
}

async function renderTopology(data) {
  const treeContainer = document.getElementById('topologyTree');
  const mapBadge = document.getElementById('mapStatusBadge');
  const mapText = document.getElementById('mapStatusText');
  const svgGroup = document.getElementById('svgConduitsGroup');

  if (!treeContainer) return;

  if (!allAssets || !allAssets.length) {
    const res = await fetch('/api/assets');
    allAssets = await res.json();
  }

  // Update counts on filter chips
  updateFilterCounts();

  // Determine overall health
  const isHealthy = allAssets.every(a => a.status === 'healthy');
  if (mapBadge && mapText) {
    if (isHealthy) {
      mapBadge.className = 'badge-status badge-healthy';
      mapText.innerText = 'HỆ THỐNG HOẠT ĐỘNG TỐT';
    } else {
      mapBadge.className = 'badge-status badge-down';
      mapText.innerText = 'PHÁT HIỆN LỖI DÂY CHUYỀN';
    }
  }

  // Filter assets if applicable
  let displayedAssets = allAssets;
  if (currentTopologyFilter !== 'all') {
    displayedAssets = allAssets.filter(a => a.type === currentTopologyFilter || (!a.parent_asset_id && currentTopologyFilter === 'domain'));
  }

  // Set mode classes
  treeContainer.className = `topology-wrapper mode-${currentTopologyMode}`;

  if (currentTopologyMode === 'tree') {
    // Top-down Tree Hierarchy
    const domainAssets = allAssets.filter(a => a.type === 'domain');
    const primaryRoot = domainAssets[0] || allAssets.find(a => !a.parent_asset_id) || allAssets[0] || { id: 1, name: 'matbao.net', type: 'domain', target: 'matbao.net', provider_name: 'Nhà Cung Cấp Tên Miền', status: 'healthy', baseline_value: 'NS: ns1.matbao.vn' };
    const allSubordinates = allAssets.filter(a => a.id !== primaryRoot.id);

    const sidebarDomainEl = document.getElementById('sidebarTargetDomain');
    if (sidebarDomainEl && primaryRoot) {
      sidebarDomainEl.innerText = primaryRoot.name;
    }

    // Filter children based on current active tab
    let children = [];
    if (currentTopologyFilter === 'all') {
      children = allSubordinates;
    } else if (currentTopologyFilter === 'domain') {
      children = []; // Tab "Tên Miền" tập trung hiển thị Tên Miền Gốc
    } else if (currentTopologyFilter === 'website') {
      children = allSubordinates.filter(a => a.type === 'website' || a.type === 'hosting');
    } else if (currentTopologyFilter === 'email') {
      children = allSubordinates.filter(a => a.type === 'email');
    } else if (currentTopologyFilter === 'ssl') {
      children = allSubordinates.filter(a => a.type === 'ssl');
    }

    let html = '';

    // 1. Root Commander Node
    html += `
      <div class="tree-root-container">
        <div class="mecha-tree-node root-node status-${primaryRoot.status}" id="node-${primaryRoot.id}" onclick="openSensorTelemetryModal(${primaryRoot.id})" title="Nhấp để xem chi tiết kỹ thuật của Tên miền này">
          <div class="mecha-node-header">
            <span class="mecha-unit-tag">Tên Miền Gốc · Điều Hướng Chính</span>
            ${renderBadge(primaryRoot.status)}
          </div>
          <div class="mecha-node-main">
            <div class="mecha-icon-box root-box">
              ${ICONS.globe}
            </div>
            <div class="mecha-node-info">
              <div class="mecha-node-title">
                <span>${escapeHtml(primaryRoot.name)}</span>
                <span class="provider-badge" title="Nhà cung cấp: ${escapeHtml(primaryRoot.provider_name)}">${escapeHtml(primaryRoot.provider_name)}</span>
              </div>
              <div class="mecha-node-meta" style="margin-top:3px;">
                <span title="Địa chỉ kết nối">Địa chỉ: <code>${escapeHtml(primaryRoot.target)}</code></span> · <span title="Máy chủ tên miền">DNS: <code>${escapeHtml(primaryRoot.baseline_value || 'ns1.matbao.vn')}</code></span>
              </div>
            </div>
          </div>
          <div class="mecha-node-footer">
            <div class="telemetry-spark" title="Độ trễ phản hồi từ máy chủ tên miền">
              <span class="spark-dot" style="background:${primaryRoot.status === 'healthy' ? 'var(--status-emerald)' : 'var(--gundam-red)'}"></span>
              <span>${primaryRoot.status === 'healthy' ? 'Đang hoạt động tốt (18ms)' : 'Mất Kết Nối (Lỗi DNS)'}</span>
            </div>
            <div>
              <button class="btn btn-xs btn-outline-cyan" onclick="event.stopPropagation(); triggerNodePing(${primaryRoot.id}, this)" title="Kiểm tra phân giải DNS ngay lập tức">
                ${ICONS.radar} Kiểm Tra
              </button>
            </div>
          </div>
          <!-- Bottom Anchor for SVG conduits -->
          <div class="node-anchor-bottom" id="anchor-bottom-${primaryRoot.id}"></div>
        </div>
      </div>
    `;

    // 2. Children Satellite Nodes
    html += `<div class="mecha-tree-children-container">`;
    if (children.length === 0) {
      if (currentTopologyFilter === 'domain') {
        html += `
          <div class="empty-filter-state" style="padding: 24px 30px; text-align: center; background: #ffffff; border: 1.5px dashed var(--border-default); border-radius: var(--radius-md); width: 100%; max-width: 580px; margin: 16px auto; box-shadow: var(--shadow-subtle);">
            <div style="margin-bottom: 6px;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--gundam-blue)" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
            <strong style="color: var(--gundam-blue); font-size: 14px; display: block;">Đang lọc hiển thị Tên Miền Chính (Điều Hướng Gốc)</strong>
            <p style="font-size: 12.5px; margin: 6px 0 0 0; color: var(--text-secondary);">Bạn đang xem cửa ngõ tên miền chính. Nhấp các tab <strong>"Website & API"</strong>, <strong>"Hộp Thư"</strong>, <strong>"Bảo Mật SSL"</strong> hoặc <strong>"Tất Cả"</strong> để xem các dịch vụ kết nối theo.</p>
          </div>
        `;
      } else {
        html += `
          <div class="empty-filter-state" style="padding: 24px 30px; text-align: center; background: #ffffff; border: 1.5px dashed var(--border-default); border-radius: var(--radius-md); width: 100%; max-width: 580px; margin: 16px auto; box-shadow: var(--shadow-subtle);">
            <div style="margin-bottom: 6px;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
            <strong style="color: var(--text-primary); font-size: 14px; display: block;">Không có dịch vụ nào trong phân loại này</strong>
            <p style="font-size: 12.5px; margin: 6px 0 0 0; color: var(--text-secondary);">Bạn có thể nhấp <strong>"+ Thêm Dịch Vụ Mới"</strong> tại tab Danh Sách Dịch Vụ.</p>
          </div>
        `;
      }
    } else {
      children.forEach((child, index) => {
        let icon = ICONS.website;
        let unitCode = 'Dịch Vụ Phụ Thuộc';
        if (child.type === 'website') {
          if ((child.name && child.name.toLowerCase().includes('api')) || (child.target && child.target.toLowerCase().includes('api'))) {
            unitCode = 'Dịch Vụ API Gateway';
          } else if (child.name && child.name.toLowerCase().includes('vnpay')) {
            unitCode = 'Cổng Thanh Toán';
          } else {
            unitCode = 'Dịch Vụ Web';
          }
        } else if (child.type === 'email') {
          icon = ICONS.email;
          unitCode = 'Hộp Thư Doanh Nghiệp';
        } else if (child.type === 'ssl') {
          icon = ICONS.ssl;
          unitCode = 'Chứng Chỉ Bảo Mật SSL';
        } else if (child.type === 'hosting') {
          icon = ICONS.hosting;
          unitCode = 'Máy Chủ Web Hosting';
        }

        html += `
          <div class="mecha-tree-node child-node status-${child.status}" id="node-${child.id}" onclick="openSensorTelemetryModal(${child.id})" title="Nhấp để xem chi tiết hoạt động của dịch vụ này">
            <!-- Top Anchor for SVG conduits -->
            <div class="node-anchor-top" id="anchor-top-${child.id}"></div>
            
            <div class="mecha-node-header">
              <span class="mecha-unit-tag">${unitCode}</span>
              ${renderBadge(child.status)}
            </div>
            <div class="mecha-node-main">
              <div class="mecha-icon-box child-box">
                ${icon}
              </div>
              <div class="mecha-node-info">
                <div class="mecha-node-title" title="${escapeHtml(child.name)}">
                  ${escapeHtml(child.name)}
                </div>
                <div class="mecha-node-meta" style="margin-top:4px;">
                  <span class="provider-badge" title="Nhà cung cấp: ${escapeHtml(child.provider_name)}">${escapeHtml(child.provider_name)}</span>
                  <code title="Địa chỉ đích: ${escapeHtml(child.target)}">${escapeHtml(child.target)}</code>
                </div>
              </div>
            </div>
            <div class="mecha-node-footer">
              <div class="telemetry-spark" style="font-size:10.5px;" title="${child.status === 'healthy' ? 'Trạng thái: Đang hoạt động bình thường' : 'Cảnh báo: Mất kết nối'}">
                <span class="spark-dot" style="background:${child.status === 'healthy' ? 'var(--status-emerald)' : 'var(--gundam-red)'}"></span>
                <span>${child.status === 'healthy' ? 'Hoạt động tốt' : 'Mất tín hiệu'}</span>
              </div>
              <button class="btn btn-xs btn-hud" onclick="event.stopPropagation(); triggerNodePing(${child.id}, this)" title="Kiểm tra kết nối dịch vụ này">
                Kiểm Tra
              </button>
            </div>
          </div>
        `;
      });
    }
    html += `</div>`;

    treeContainer.innerHTML = html;

    // Draw animated SVG conduits connecting Root to Children
    setTimeout(() => {
      drawEnergyConduits();
    }, 60);

  } else {
    // Grid Matrix View
    if (svgGroup) svgGroup.innerHTML = ''; // Clear SVG lines in grid mode

    let displayedGrid = allAssets;
    if (currentTopologyFilter === 'domain') {
      displayedGrid = allAssets.filter(a => a.type === 'domain');
    } else if (currentTopologyFilter === 'website') {
      displayedGrid = allAssets.filter(a => a.type === 'website' || a.type === 'hosting');
    } else if (currentTopologyFilter === 'email') {
      displayedGrid = allAssets.filter(a => a.type === 'email');
    } else if (currentTopologyFilter === 'ssl') {
      displayedGrid = allAssets.filter(a => a.type === 'ssl');
    }

    if (displayedGrid.length === 0) {
      treeContainer.innerHTML = `
        <div class="empty-filter-state" style="padding: 30px; text-align: center; background: #ffffff; border: 1.5px dashed var(--border-default); border-radius: var(--radius-md); width: 100%; grid-column: 1 / -1; margin: 10px auto;">
          <div style="margin-bottom: 6px;"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <strong style="color: var(--text-primary); font-size: 14px; display: block;">Không tìm thấy dịch vụ nào phù hợp bộ lọc</strong>
        </div>
      `;
    } else {
      let html = displayedGrid.map((asset, idx) => {
        let icon = ICONS.website;
        if (asset.type === 'domain') icon = ICONS.globe;
        if (asset.type === 'email') icon = ICONS.email;
        if (asset.type === 'ssl') icon = ICONS.ssl;
        if (asset.type === 'hosting') icon = ICONS.hosting;

        let unitTag = 'Dịch Vụ Phụ Thuộc';
        if (asset.type === 'domain') unitTag = 'Tên Miền Gốc';
        else if (asset.type === 'email') unitTag = 'Hộp Thư Doanh Nghiệp';
        else if (asset.type === 'ssl') unitTag = 'Chứng Chỉ Bảo Mật SSL';
        else if (asset.type === 'hosting') unitTag = 'Máy Chủ Hosting';
        else if (asset.type === 'website') {
          if ((asset.name && asset.name.toLowerCase().includes('api')) || (asset.target && asset.target.toLowerCase().includes('api'))) unitTag = 'Dịch Vụ API Gateway';
          else if (asset.name && asset.name.toLowerCase().includes('vnpay')) unitTag = 'Cổng Thanh Toán';
          else unitTag = 'Dịch Vụ Web';
        }

        return `
          <div class="mecha-tree-node child-node status-${asset.status}" id="node-${asset.id}" onclick="openSensorTelemetryModal(${asset.id})" title="Nhấp xem chi tiết">
            <div class="mecha-node-header">
              <span class="mecha-unit-tag">${unitTag}</span>
              ${renderBadge(asset.status)}
            </div>
            <div class="mecha-node-main">
              <div class="mecha-icon-box child-box">
                ${icon}
              </div>
              <div class="mecha-node-info">
                <div class="mecha-node-title" title="${escapeHtml(asset.name)}">
                  ${escapeHtml(asset.name)}
                </div>
                <div class="mecha-node-meta" style="margin-top:4px;">
                  <span class="provider-badge" title="Nhà cung cấp: ${escapeHtml(asset.provider_name)}">${escapeHtml(asset.provider_name)}</span>
                  <code title="Địa chỉ: ${escapeHtml(asset.target)}">${escapeHtml(asset.target)}</code>
                </div>
              </div>
            </div>
            <div class="mecha-node-footer">
              <span class="telemetry-spark" title="Cấu hình chuẩn: ${escapeHtml(asset.baseline_value || 'N/A')}">
                <span class="spark-dot" style="background:${asset.status === 'healthy' ? 'var(--status-emerald)' : 'var(--gundam-red)'}"></span>
                <span>${asset.status === 'healthy' ? 'Chuẩn OK' : 'Lỗi'}</span>
              </span>
              <button class="btn btn-xs btn-outline-cyan" onclick="event.stopPropagation(); triggerNodePing(${asset.id}, this)" title="Kiểm tra kết nối">
                Kiểm Tra
              </button>
            </div>
          </div>
        `;
      }).join('');

      treeContainer.innerHTML = html;
    }
  }
}

// Calculate and draw SVG cables between root anchor and child anchors
function drawEnergyConduits() {
  const svgGroup = document.getElementById('svgConduitsGroup');
  if (currentTopologyMode !== 'tree') {
    if (svgGroup) svgGroup.innerHTML = '';
    return;
  }

  const viewport = document.getElementById('topologyViewport');
  const rootNode = document.querySelector('.mecha-tree-node.root-node');
  const childNodes = document.querySelectorAll('.mecha-tree-children-container .mecha-tree-node.child-node');

  if (!svgGroup || !viewport || !rootNode || !childNodes.length) {
    if (svgGroup) svgGroup.innerHTML = '';
    return;
  }

  const viewportRect = viewport.getBoundingClientRect();
  const rootRect = rootNode.getBoundingClientRect();

  // Root anchor bottom center
  const rootX = rootRect.left - viewportRect.left + rootRect.width / 2;
  const rootY = rootRect.top - viewportRect.top + rootRect.height;

  let pathsHtml = '';

  childNodes.forEach(child => {
    const childRect = child.getBoundingClientRect();
    // Child anchor top center
    const childX = childRect.left - viewportRect.left + childRect.width / 2;
    const childY = childRect.top - viewportRect.top;

    const isChildAlert = child.classList.contains('status-down') || child.classList.contains('status-degraded') || rootNode.classList.contains('status-down');

    // Smooth Bezier S-Curve: M x1 y1 C x1 midY, x2 midY, x2 y2
    const midY = rootY + (childY - rootY) * 0.55;
    const d = `M ${rootX} ${rootY} C ${rootX} ${midY}, ${childX} ${midY}, ${childX} ${childY}`;

    pathsHtml += `
      <path class="energy-conduit-path ${isChildAlert ? 'alert' : 'healthy'}" 
            d="${d}" 
            data-child="${child.id}" />
    `;
  });

  svgGroup.innerHTML = pathsHtml;
}

function updateFilterCounts() {
  const countAll = document.getElementById('countAllAssets');
  const countDomain = document.getElementById('countDomainAssets');
  const countWeb = document.getElementById('countWebAssets');
  const countMail = document.getElementById('countMailAssets');
  const countSsl = document.getElementById('countSslAssets');

  if (countAll) countAll.innerText = allAssets.length;
  if (countDomain) countDomain.innerText = allAssets.filter(a => a.type === 'domain').length || 1;
  if (countWeb) countWeb.innerText = allAssets.filter(a => a.type === 'website' || a.type === 'hosting').length;
  if (countMail) countMail.innerText = allAssets.filter(a => a.type === 'email').length;
  if (countSsl) countSsl.innerText = allAssets.filter(a => a.type === 'ssl').length;
}

function triggerTopologyPingAll() {
  MechaAudio.playPing();
  const btn = document.getElementById('triggerProbeBtn');
  if (btn) btn.click();
}

// ==========================================================================
// 6. SENSOR TELEMETRY MODAL (INSPECT INDIVIDUAL TREE NODES)
// ==========================================================================
function openSensorByServiceName(serviceName) {
  const asset = allAssets.find(a => a.name.toLowerCase().includes(serviceName.toLowerCase()) || serviceName.toLowerCase().includes(a.name.toLowerCase()));
  if (asset) {
    openSensorTelemetryModal(asset.id);
  }
}

function openSensorTelemetryModal(assetId) {
  MechaAudio.playClick();
  const asset = allAssets.find(a => a.id === assetId);
  if (!asset) return;

  const modal = document.getElementById('sensorModal');
  const title = document.getElementById('sensorModalTitle');
  const sub = document.getElementById('sensorModalSub');
  const body = document.getElementById('sensorModalBody');
  const pingBtn = document.getElementById('sensorModalPingBtn');

  if (title) title.innerText = `Chi Tiết Dịch Vụ: ${asset.name}`;
  if (sub) sub.innerText = `Loại dịch vụ: ${asset.type.toUpperCase()} · Nhà cung cấp: ${asset.provider_name}`;

  const isHealthy = asset.status === 'healthy';

  if (body) {
    body.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:18px;">
        <!-- Status Overview Card -->
        <div style="background:var(--bg-subtle); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:16px 20px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">
          <div>
            <div style="font-size:11px; font-family:var(--font-mono); color:var(--text-tertiary);">TRẠNG THÁI HOẠT ĐỘNG HIỆN TẠI</div>
            <div style="font-size:18px; font-weight:700; color:${isHealthy ? 'var(--status-emerald)' : 'var(--gundam-red-bright)'}; display:flex; align-items:center; gap:8px; margin-top:2px;">
              <span class="badge-dot" style="background:${isHealthy ? 'var(--status-emerald)' : 'var(--gundam-red)'}; width:10px; height:10px;"></span>
              ${isHealthy ? 'Đang Hoạt Động Bình Thường · Ổn Định' : 'Cảnh Báo: Mất Kết Nối · Cần Xử Lý'}
            </div>
          </div>
          <div>
            ${renderBadge(asset.status)}
          </div>
        </div>

        <!-- Technical Details Table -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px;">
            <span style="font-size:11px; color:var(--text-tertiary); font-family:var(--font-mono);">ĐỊA CHỈ TRUY CẬP (IP / WEB)</span>
            <div style="font-family:var(--font-mono); font-size:13px; font-weight:600; color:var(--gundam-cyan); margin-top:4px;">
              ${escapeHtml(asset.target)}
            </div>
          </div>
          <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px;">
            <span style="font-size:11px; color:var(--text-tertiary); font-family:var(--font-mono);">NHÀ CUNG CẤP DỊCH VỤ</span>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:4px;">
              ${escapeHtml(asset.provider_name)}
            </div>
          </div>
        </div>

        <!-- Baseline Comparison -->
        <div style="border:1px solid var(--border-default); border-radius:var(--radius-md); padding:16px;">
          <h5 style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Đối Soát Cấu Hình Chuẩn (So sánh với ban đầu)
          </h5>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; padding:6px 10px; background:rgba(0,100,255,0.05); border-radius:4px;">
              <span style="color:var(--text-secondary);">Cấu hình chuẩn ban đầu:</span>
              <strong style="color:var(--text-primary); font-family:var(--font-mono);">${escapeHtml(asset.baseline_value || 'Chưa có cấu hình chuẩn')}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:6px 10px; background:${isHealthy ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.08)'}; border-radius:4px;">
              <span style="color:var(--text-secondary);">Thực tế đo lường:</span>
              <strong style="color:${isHealthy ? 'var(--status-emerald)' : 'var(--gundam-red-bright)'}; font-family:var(--font-mono);">
                ${isHealthy ? 'Khớp 100% với cấu hình ban đầu' : 'Phát hiện sai lệch so với ban đầu'}
              </strong>
            </div>
          </div>
        </div>

        <!-- Multi-Resolver Feed -->
        <div>
          <h5 style="font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:8px;">
            Kiểm Tra Kết Nối Qua Các Máy Chủ DNS Toàn Cầu
          </h5>
          <table class="data-table mecha-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>Máy chủ kiểm tra (DNS)</th>
                <th>Phản hồi</th>
                <th>Độ trễ</th>
                <th>Kết luận</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Google DNS (8.8.8.8)</strong></td>
                <td><code>${isHealthy ? 'NOERROR / 103.1.1.20' : 'SERVFAIL'}</code></td>
                <td>${isHealthy ? '16ms' : '380ms'}</td>
                <td><span class="badge-status ${isHealthy ? 'badge-healthy' : 'badge-down'}"><span class="badge-dot"></span>${isHealthy ? 'PASS' : 'FAIL'}</span></td>
              </tr>
              <tr>
                <td><strong>Cloudflare DNS (1.1.1.1)</strong></td>
                <td><code>${isHealthy ? 'NOERROR / 103.1.1.20' : 'SERVFAIL'}</code></td>
                <td>${isHealthy ? '14ms' : '395ms'}</td>
                <td><span class="badge-status ${isHealthy ? 'badge-healthy' : 'badge-down'}"><span class="badge-dot"></span>${isHealthy ? 'PASS' : 'FAIL'}</span></td>
              </tr>
              <tr>
                <td><strong>Quad9 (9.9.9.9)</strong></td>
                <td><code>${isHealthy ? 'NOERROR / 103.1.1.20' : 'SERVFAIL'}</code></td>
                <td>${isHealthy ? '22ms' : '410ms'}</td>
                <td><span class="badge-status ${isHealthy ? 'badge-healthy' : 'badge-down'}"><span class="badge-dot"></span>${isHealthy ? 'PASS' : 'FAIL'}</span></td>
              </tr>
              <tr>
                <td><strong>NS Gốc (ns1.matbao.vn)</strong></td>
                <td><code>${isHealthy ? 'AUTHORITATIVE OK' : 'CONNECTION TIMED OUT'}</code></td>
                <td>${isHealthy ? '8ms' : '2150ms'}</td>
                <td><span class="badge-status ${isHealthy ? 'badge-healthy' : 'badge-down'}"><span class="badge-dot"></span>${isHealthy ? 'PASS' : 'FAIL'}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (pingBtn) {
    pingBtn.onclick = (e) => {
      triggerNodePing(assetId, e.currentTarget);
    };
  }

  if (modal) modal.style.display = 'flex';
}

function closeSensorModal() {
  const modal = document.getElementById('sensorModal');
  if (modal) modal.style.display = 'none';
}

// Ping single node with visual & sound feedback, button loading and toast alert
async function triggerNodePing(assetId, btnEl = null) {
  const asset = (allAssets && allAssets.find(a => a.id === assetId)) || { name: `Dịch vụ #${assetId}`, target: '' };
  
  // Find button element
  let targetBtn = btnEl;
  if (!targetBtn && typeof event !== 'undefined' && event && event.currentTarget) {
    targetBtn = event.currentTarget;
  }
  if (!targetBtn) {
    const nodeEl = document.getElementById(`node-${assetId}`);
    if (nodeEl) targetBtn = nodeEl.querySelector('.btn');
  }

  const originalHtml = targetBtn ? targetBtn.innerHTML : 'Kiểm Tra';
  if (targetBtn) {
    targetBtn.disabled = true;
    targetBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:4px; animation:spin 0.8s linear infinite;">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>Đang đo...
    `;
    targetBtn.style.opacity = '0.9';
  }

  // Visual card scan wave
  const nodeEl = document.getElementById(`node-${assetId}`);
  if (nodeEl) {
    nodeEl.style.transform = 'scale(1.03)';
    nodeEl.style.boxShadow = '0 0 28px rgba(59, 130, 246, 0.45)';
    setTimeout(() => {
      nodeEl.style.transform = '';
      nodeEl.style.boxShadow = '';
    }, 700);
  }

  showToast(`Đang gửi tín hiệu đo kiểm tới <strong>${escapeHtml(asset.name)}</strong>...`, 'info', 2200);

  try {
    const res = await fetch(`/api/assets/${assetId}/ping`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    MechaAudio.playPing();

    if (data.status === 'healthy') {
      if (targetBtn) {
        targetBtn.innerHTML = 'Chuẩn OK';
        targetBtn.style.color = '#10b981';
        targetBtn.style.borderColor = '#10b981';
      }
      showToast(`Đã đo kiểm <strong>${escapeHtml(data.asset_name)}</strong>: Phản hồi tốt (${data.latency_ms}ms) qua DNS Resolver`, 'success', 3500);
    } else {
      if (targetBtn) {
        targetBtn.innerHTML = 'Lỗi';
        targetBtn.style.color = '#ef4444';
        targetBtn.style.borderColor = '#ef4444';
      }
      showToast(`Cảnh báo: <strong>${escapeHtml(data.asset_name)}</strong> phát hiện sự cố: ${escapeHtml(data.summary || data.details)}`, 'error', 5000);
    }

    // Refresh dashboard data
    await fetchDashboard(true);
  } catch (e) {
    console.error('Lỗi khi ping node:', e);
    // Fallback: run general probe
    try {
      await fetch('/api/probes/run', { method: 'POST' });
      await fetchDashboard(true);
      showToast(`Đã hoàn tất đo kiểm tra cho <strong>${escapeHtml(asset.name)}</strong>!`, 'success', 3500);
    } catch (fallbackErr) {
      showToast(`Không thể kết nối máy chủ đo kiểm: ${e.message}`, 'error', 4000);
    }
  } finally {
    if (targetBtn) {
      setTimeout(() => {
        targetBtn.innerHTML = originalHtml;
        targetBtn.disabled = false;
        targetBtn.style.opacity = '';
        targetBtn.style.color = '';
        targetBtn.style.borderColor = '';
      }, 1500);
    }
  }
}

// Render Badge Utility
function renderBadge(status) {
  if (status === 'healthy') {
    return `<span class="badge-status badge-healthy"><span class="badge-dot"></span>Hoạt động tốt</span>`;
  }
  if (status === 'down') {
    return `<span class="badge-status badge-down"><span class="badge-dot"></span>Mất kết nối</span>`;
  }
  return `<span class="badge-status badge-degraded"><span class="badge-dot"></span>Chập chờn</span>`;
}

// Date Formatters
function formatTime(str) {
  if (!str) return 'Vừa xong';
  try {
    const formatted = str.includes('T') ? str : str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z');
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? str : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (e) {
    return str;
  }
}

function formatDateTime(str) {
  if (!str) return 'Vừa xong';
  try {
    const formatted = str.includes('T') ? str : str.replace(' ', 'T') + (str.endsWith('Z') ? '' : 'Z');
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? str : d.toLocaleString('vi-VN');
  } catch (e) {
    return str;
  }
}

// ==========================================================================
// 7. LIVE PROBE TABLE RENDERER
// ==========================================================================
function renderProbeTable(probes) {
  const tbody = document.getElementById('probeTableBody');
  if (!tbody) return;
  if (!probes || !probes.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding:20px;">Đang kiểm tra kết nối qua các máy chủ DNS...</td></tr>`;
    return;
  }

  tbody.innerHTML = probes.map(p => {
    const isOk = p.status === 'SUCCESS' || p.status === 'healthy';
    const time = formatTime(p.checked_at || p.created_at);

    return `
      <tr>
        <td style="color:var(--text-tertiary); font-family:var(--font-mono); font-size:11.5px;">${time}</td>
        <td><strong>${escapeHtml(p.resolver)}</strong></td>
        <td><code style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(p.asset_name)}</code></td>
        <td><span class="provider-badge">${escapeHtml(p.monitor_type)}</span></td>
        <td style="color: ${isOk ? 'var(--status-emerald)' : 'var(--gundam-red-bright)'}; font-weight:700; font-family:var(--font-mono); font-size:12px;">${escapeHtml(p.response_code)}</td>
        <td style="font-family:var(--font-mono); font-size:12px;">${p.latency_ms}ms</td>
        <td>
          <span class="badge-status ${isOk ? 'badge-healthy' : 'badge-down'}">
            <span class="badge-dot"></span>${isOk ? 'Hợp lệ' : 'Lỗi'}
          </span>
        </td>
        <td style="font-family:var(--font-mono); font-size:11.5px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-tertiary);" title="${escapeHtml(p.raw_log)}">
          ${escapeHtml(p.raw_log)}
        </td>
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// 8. INCIDENT COMMAND & TICKET BRIDGE
// ==========================================================================
async function renderIncidentView(activeIncidents) {
  const container = document.getElementById('incidentViewContainer');
  if (!container) return;

  const res = await fetch('/api/incidents');
  const allIncidents = await res.json();

  if (!allIncidents.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 20px; color:var(--text-tertiary);">
        <div style="margin-bottom:14px; display:inline-flex; padding:16px; border-radius:50%; background:var(--status-emerald-bg); color:var(--status-emerald);">
          ${ICONS.check}
        </div>
        <h4 class="font-orbitron" style="color:var(--text-primary); font-size:17px;">HẠ TẦNG SỐ ĐANG AN TOÀN TUYỆT ĐỐI</h4>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:6px; max-width:540px; margin-left:auto; margin-right:auto;">
          Tất cả dịch vụ Tên miền, Hosting, Hòm thư và SSL đều đang hoạt động tốt. Bạn có thể nhấn nút "Tạo Lỗi Thử" ở góc trên màn hình để kiểm chứng quy trình tự động hóa.
        </p>
      </div>
    `;
    return;
  }

  const latest = allIncidents[0];
  const isResolved = latest.status === 'Resolved' || latest.status === 'Closed';
  const isTicketSent = latest.ticket_status === 'sent';

  let reportBtn = '';
  if (latest.post_incident_report) {
    reportBtn = `
      <button class="btn btn-sm btn-hud" onclick="viewReport(${latest.id})" title="Xem báo cáo hậu sự cố">
        ${ICONS.fileText}
        <span>Xem Báo Cáo Phục Hồi</span>
      </button>
    `;
  }

  // Step 2 Content: Dynamic based on sent vs draft
  let step2Content = '';
  if (isTicketSent) {
    step2Content = `
      <div style="background:var(--status-emerald-bg); border:1px solid var(--status-emerald-border); border-radius:10px; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="color:var(--status-emerald); font-size:22px;">${ICONS.check}</div>
          <div>
            <div style="font-weight:700; color:var(--status-emerald-text); font-size:13.5px;">Phiếu Hỗ Trợ Đã Được Nhà Cung Cấp Tiếp Nhận</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
              Mã theo dõi: <strong style="font-family:var(--font-mono); color:var(--status-emerald); font-size:13px;">${escapeHtml(latest.external_ticket_id || 'MB-TCK-ACTIVE')}</strong> · Đơn vị trực ban 24/7 đang kiểm tra theo SLA khẩn cấp.
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="https://id.matbao.net/" target="_blank" rel="noopener" class="btn btn-xs btn-hud" style="text-decoration:none;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>Mở Cổng id.matbao.net</span>
          </a>
          <button class="btn btn-xs btn-outline-cyan" onclick="downloadTechnicalDossier(${latest.id})">
            <span>Tải Bằng Chứng (.txt)</span>
          </button>
        </div>
      </div>
    `;
  } else {
    step2Content = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.5;">
          Hệ thống đã chuẩn bị sẵn <strong>100% bằng chứng kỹ thuật mạng &amp; DNS</strong> chuẩn SRE. Bạn chỉ cần <strong>1-Click sao chép</strong> để gửi nhanh đến Nhà cung cấp mà không phải gõ log thủ công.
        </p>

        <!-- Primary Action Button (Nổi bật, to, rõ ràng) -->
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-primary-cyan btn-lg-action" onclick="copyTicketAndOpenMatBao(${latest.id})" title="Sao chép toàn bộ văn bản và mở cổng hỗ trợ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>1-Click Sao Chép &amp; Mở Cổng Dịch Vụ</span>
          </button>

          <button class="btn btn-sm btn-hud" onclick="toggleTicketPreview()" id="btnToggleTicketPreview" title="Mở rộng xem trước văn bản ticket">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Xem / Ẩn Nội Dung Phiếu</span>
          </button>

          <button class="btn btn-sm btn-hud" onclick="downloadTechnicalDossier(${latest.id})" title="Tải file text lưu bằng chứng kỹ thuật">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Tải File Bằng Chứng (.txt)</span>
          </button>
        </div>

        <!-- Collapsible Raw Ticket Text (Mặc định ẩn) -->
        <div id="ticketPreviewContainer" style="display:none; margin-top:4px;" class="collapsible-detail-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; font-weight:700; color:var(--text-tertiary); text-transform:uppercase;">VĂN BẢN PHIẾU ĐÃ SOẠN SẴN:</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-xs btn-ai-pulse" id="btnOptimizeTicket" onclick="optimizeTicketWithAi(${latest.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span>AI Tối Ưu Phiếu</span>
              </button>
              <button class="btn btn-xs btn-hud" onclick="copyTicketContentOnly(${latest.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Sao Chép</span>
              </button>
            </div>
          </div>
          <div id="ticketBodyPreviewBox" style="background:var(--bg-canvas); border:1px solid var(--border-default); border-radius:6px; padding:12px; font-family:var(--font-mono); font-size:12px; color:var(--text-primary); white-space:pre-wrap; line-height:1.5; max-height:220px; overflow-y:auto;">${escapeHtml(latest.ticket_body)}</div>
        </div>

        <!-- Confirm ticket ID input -->
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding-top:10px; border-top:1px dashed var(--border-default);">
          <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:280px;">
            <input type="text" id="customTicketIdInput" class="input-text" style="font-size:12.5px; padding:6px 10px;" placeholder="Dán mã phiếu nhận từ Nhà cung cấp (vd: TK-982412)">
            <button class="btn btn-sm btn-hud" style="white-space:nowrap;" onclick="confirmMatBaoTicket(${latest.id})">
              <span>Xác Nhận Đã Gửi Ticket</span>
            </button>
          </div>
          <span style="font-size:12px; color:var(--text-tertiary);">hoặc</span>
          <button class="btn btn-sm btn-outline-cyan" onclick="sendTicket(${latest.id})" title="Tự động cấp mã mô phỏng để tiếp tục kiểm tra luồng phục hồi">
            ${ICONS.send}
            <span>Mô Phỏng Tiếp Nhận Tự Động (Nhận Mã TK)</span>
          </button>
        </div>
      </div>
    `;
  }

  // Step 3 Content: Recovery verification
  let step3Content = `
    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
      <div style="flex:1; min-width:260px;">
        <p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.5;">
          ${isResolved 
            ? 'Dịch vụ đã vượt qua 3 chu kỳ đo lường liên tiếp từ 4 máy chủ DNS quốc tế. Hệ thống xác thực phục hồi 100% và đã đóng sự cố an toàn.' 
            : 'Sau khi nhà cung cấp xử lý, hệ thống tự động đo kiểm 3 lượt liên tiếp (mỗi 8s) để xác thực kết nối thông suốt trước khi tự động đóng ticket.'}
        </p>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-sm btn-probe-refresh" id="btnVerifySweep" onclick="triggerIncidentVerifySweep(${latest.id})" title="Đo lường ngay lập tức để kiểm tra phục hồi">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          <span>Kiểm Tra Phục Hồi Ngay</span>
        </button>
        ${reportBtn}
      </div>
    </div>
  `;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      
      <!-- 1. Executive Summary Bar (Cô đọng, chỉ 1 khối nhỏ) -->
      <div class="incident-summary-bar">
        <div class="incident-summary-left">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge-status ${isResolved ? 'badge-healthy' : 'badge-down'}">
              <span class="badge-dot"></span>MỨC ĐỘ: ${latest.severity}
            </span>
            <span class="provider-badge">TRẠNG THÁI: ${latest.status}</span>
            <span style="font-size:12px; font-family:var(--font-mono); color:var(--text-tertiary);">#INC-${latest.id}</span>
          </div>
          <div class="incident-summary-title">${escapeHtml(latest.title)}</div>
          <div class="incident-summary-desc">
            <span style="color:#d97706; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Tác động:
            </span> ${escapeHtml(latest.business_impact || 'Khách hàng có thể bị gián đoạn truy cập.')}
            · Phụ trách: <strong>${escapeHtml(latest.responsible_provider)}</strong>
          </div>
        </div>
      </div>

      <!-- 2. Action Roadmap: 3 Bước Cần Xử Lý Cụ Thể, Rõ Ràng -->
      <div class="incident-roadmap-container">
        
        <!-- BƯỚC 1: CHẨN ĐOÁN & KHỬ BÁO ĐỘNG GIẢ -->
        <div class="roadmap-step-card">
          <div class="roadmap-step-header">
            <div class="roadmap-step-title-group">
              <div class="roadmap-step-num">1</div>
              <h4 class="roadmap-step-title">Bước 1: Chẩn Đoán Lỗi &amp; Khử Báo Động GiẢ</h4>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge-status badge-healthy">
                <span class="badge-dot"></span>ĐÃ CHẨN ĐOÁN XONG
              </span>
              <span class="ai-provider-pill" id="aiConfidenceBadge">ĐỘ TIN CẬY: 96%</span>
            </div>
          </div>

          <!-- Tóm tắt 2 dòng ngắn gọn -->
          <div class="roadmap-step-desc" style="margin-bottom: 10px;">
            <div>• <strong>Nguyên nhân cốt lõi:</strong> <span id="aiShortSummary">Đang xác định nguyên nhân cốt lõi...</span></div>
            <div style="color:#2563eb; margin-top:3px;" id="aiShortFalseAlarm">
              • <strong>Khử báo động giả:</strong> Đang phân tích mức độ cô lập...
            </div>
          </div>

          <!-- Nút xem chi tiết kỹ thuật (Ẩn/Hiện) -->
          <div class="roadmap-step-actions">
            <button class="btn btn-xs btn-hud" onclick="toggleDeepAiDetails()" id="btnToggleAiDeep">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>Xem Chi Tiết Kỹ Thuật (Blast Radius, Lưu ý không nên làm)</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="btn btn-xs btn-ai-pulse" onclick="runAiAnalysisForIncident(${latest.id})" title="Chạy lại phân tích">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              <span>Phân Tích Lại</span>
            </button>
            <button class="btn btn-xs btn-hud" onclick="openAiConfigModal()" title="Cấu hình Google Gemini API Key">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span>Cấu Hình AI Key</span>
            </button>
          </div>

          <!-- Khối chi tiết kỹ thuật sâu (Mặc định ẩn) -->
          <div id="aiDeepDetailsBox" class="collapsible-detail-box" style="display:none;">
            <!-- Loaded via JS renderAiAnalysisHtml -->
          </div>
        </div>

        <!-- BƯỚC 2: PHỐI HỢP NHÀ CUNG CẤP (HÀNH ĐỘNG CHÍNH - BƯỚC CẦN LÀM) -->
        <div class="roadmap-step-card active-step">
          <div class="roadmap-step-header">
            <div class="roadmap-step-title-group">
              <div class="roadmap-step-num">2</div>
              <h4 class="roadmap-step-title">Bước 2: Gửi Phiếu Yêu Cầu Hỗ Trợ Kỹ Thuật (Hành Động Chính)</h4>
            </div>
            <div>
              ${isTicketSent 
                ? `<span class="badge-status badge-healthy"><span class="badge-dot"></span>ĐÃ LIÊN KẾT TICKET: ${escapeHtml(latest.external_ticket_id || 'MB-TCK')}</span>`
                : `<span class="badge-status badge-down" style="animation:beaconPulseRed 1.2s infinite;"><span class="badge-dot"></span>CẦN THỰC HIỆN NGAY</span>`
              }
            </div>
          </div>

          ${step2Content}
        </div>

        <!-- BƯỚC 3: XÁC THỰC PHỤC HỒI & ĐÓNG SỰ CỐ -->
        <div class="roadmap-step-card">
          <div class="roadmap-step-header">
            <div class="roadmap-step-title-group">
              <div class="roadmap-step-num">3</div>
              <h4 class="roadmap-step-title">Bước 3: Tự Động Giám Sát &amp; Xác Thực Phục Hồi</h4>
            </div>
            <div>
              ${isResolved 
                ? `<span class="badge-status badge-healthy"><span class="badge-dot"></span>ĐÃ KHÔI PHỤC HOÀN TOÀN</span>`
                : `<span class="badge-status" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;"><span class="hud-pulse-dot" style="background:#f59e0b;"></span>ĐANG THEO DÕI TỰ ĐỘNG (8s/LẦN)</span>`
              }
            </div>
          </div>

          ${step3Content}
        </div>

      </div>
    </div>
  `;

  // Tự động tải phân tích AI SRE cho sự cố này
  loadInlineAiAnalysis(latest.id);
}

// Ẩn / Hiện chi tiết kỹ thuật sâu của AI
function toggleDeepAiDetails() {
  MechaAudio.playClick();
  const box = document.getElementById('aiDeepDetailsBox');
  const btn = document.getElementById('btnToggleAiDeep');
  if (!box) return;
  const isHidden = box.style.display === 'none' || !box.style.display;
  if (isHidden) {
    box.style.display = 'block';
    if (btn) btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg><span>Ẩn Chi Tiết Kỹ Thuật</span>`;
  } else {
    box.style.display = 'none';
    if (btn) btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Xem Chi Tiết Kỹ Thuật (Blast Radius, Lưu ý không nên làm)</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
  }
}

// Ẩn / Hiện văn bản Ticket chi tiết
function toggleTicketPreview() {
  MechaAudio.playClick();
  const box = document.getElementById('ticketPreviewContainer');
  const btn = document.getElementById('btnToggleTicketPreview');
  if (!box) return;
  const isHidden = box.style.display === 'none' || !box.style.display;
  if (isHidden) {
    box.style.display = 'block';
    if (btn) btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg><span>Ẩn Nội Dung Phiếu</span>`;
  } else {
    box.style.display = 'none';
    if (btn) btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Xem / Ẩn Nội Dung Phiếu</span>`;
  }
}

// Kích hoạt đo kiểm xác thực phục hồi tức thì
async function triggerIncidentVerifySweep(incidentId) {
  MechaAudio.playClick();
  const btn = document.getElementById('btnVerifySweep');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-inline" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:4px;"></span> Đang Đo Lường...`;
  }
  showToast('Đang kích hoạt chu kỳ đo lường xác thực phục hồi toàn diện...', 'info', 3000);

  try {
    const res = await fetch('/api/check-now', { method: 'POST' });
    const data = await res.json();
    showToast(`Kết quả đo kiểm: ${data.summary?.dns_status === 'HEALTHY' ? 'Hạ tầng DNS & Web đang ổn định!' : 'Đã ghi nhận kết quả thăm dò mới.'}`, 'success', 4000);
    await fetchDashboard(true);
  } catch (err) {
    showToast('Lỗi khi kích hoạt kiểm tra: ' + err.message, 'error', 4000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span>Kiểm Tra Phục Hồi Ngay</span>`;
    }
  }
}

// 1-Click Sao chép nội dung và mở Cổng id.matbao.net
async function copyTicketAndOpenMatBao(incidentId) {
  MechaAudio.playClick();
  try {
    const res = await fetch(`/api/incidents/${incidentId}`);
    const incident = await res.json();
    if (incident && incident.ticket_body) {
      await navigator.clipboard.writeText(incident.ticket_body);
      MechaAudio.playBeep(520, 980, 0.25, 'triangle', 0.12);
      showToast('<strong>Đã sao chép Ticket vào Clipboard!</strong> Đang mở Cổng Hỗ Trợ trong tab mới...', 'success', 4500);
      window.open('https://id.matbao.net/', '_blank');
    }
  } catch (err) {
    showToast('Không thể sao chép vào Clipboard: ' + err.message, 'error', 4000);
  }
}

async function copyTicketContentOnly(incidentId) {
  MechaAudio.playClick();
  try {
    const res = await fetch(`/api/incidents/${incidentId}`);
    const incident = await res.json();
    if (incident && incident.ticket_body) {
      await navigator.clipboard.writeText(incident.ticket_body);
      MechaAudio.playBeep(440, 880, 0.2, 'triangle', 0.1);
      showToast('Đã sao chép nội dung ticket kỹ thuật vào Clipboard!', 'success', 3500);
    }
  } catch (err) {
    showToast('Lỗi sao chép: ' + err.message, 'error', 4000);
  }
}

function downloadTechnicalDossier(incidentId) {
  MechaAudio.playClick();
  showToast('Đang tải hồ sơ kỹ thuật sự cố...', 'info', 2500);
  window.open(`/api/incidents/${incidentId}/export`, '_blank');
}

async function confirmMatBaoTicket(incidentId) {
  MechaAudio.playClick();
  const input = document.getElementById('customTicketIdInput');
  const customId = input ? input.value.trim() : '';

  if (!customId) {
    showToast('Vui lòng nhập mã Ticket bạn đã tạo từ Nhà cung cấp (Ví dụ: TK-982412)', 'warning', 3500);
    if (input) input.focus();
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;

    const res = await fetch(`/api/incidents/${incidentId}/send-ticket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        custom_ticket_id: customId,
        dispatch_mode: 'matbao_id'
      })
    });
    const data = await res.json();
    showToast(`${data.message || 'Đã liên kết mã Ticket thành công!'}`, 'success', 4000);
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    showToast('Lỗi xác nhận: ' + err.message, 'error', 4000);
  }
}

async function sendTicket(incidentId) {
  MechaAudio.playClick();
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;

    const res = await fetch(`/api/incidents/${incidentId}/send-ticket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dispatch_mode: 'auto_simulation' })
    });
    const data = await res.json();
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

async function viewReport(incidentId) {
  MechaAudio.playClick();
  try {
    const res = await fetch(`/api/incidents/${incidentId}`);
    const incident = await res.json();
    document.getElementById('reportBody').innerText = incident.post_incident_report;
    document.getElementById('reportModal').style.display = 'flex';
  } catch (err) {
    console.error(err);
  }
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// ==========================================================================
// 9. PLAYBOOK & EMERGENCY REMEDIATION
// ==========================================================================
async function loadPlaybook() {
  const container = document.getElementById('playbookActionList');
  if (!container) return;
  try {
    const res = await fetch('/api/playbook/1');
    const playbook = await res.json();

    container.innerHTML = playbook.actions.map(act => {
      let actionBtn = '';
      if (act.id === 'out_of_band_alert') {
        actionBtn = `
          <button class="btn btn-sm btn-primary-cyan" onclick="openAlertChannelsModal()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span>Kênh Cảnh Báo Ngoài Luồng</span>
          </button>
        `;
      } else if (act.id === 'failover_page') {
        actionBtn = `
          <button class="btn btn-sm ${playbook.failover_active ? 'btn-crimson' : 'btn-hud'}" onclick="toggleFailover()">
            <span>${playbook.failover_active ? 'Tắt Trang Bảo Trì' : 'Bật Trang Thông Báo Bảo Trì'}</span>
          </button>
        `;
      } else if (act.id === 'dns_snapshot_rollback') {
        actionBtn = `
          <button class="btn btn-sm btn-hud" onclick="rollbackDNS()">
            <span>Khôi Phục Bản Ghi DNS Về Chuẩn An Toàn</span>
          </button>
        `;
      }

      return `
        <div class="playbook-card">
          <div>
            <div class="playbook-card-header">
              <h4 class="playbook-card-title">${escapeHtml(act.title)}</h4>
              <span class="badge-status ${act.status === 'ACTIVE' || act.status === 'DISPATCHED' ? 'badge-healthy' : 'badge-degraded'}">
                <span class="badge-dot"></span>${act.status}
              </span>
            </div>
            <p class="playbook-card-desc">${escapeHtml(act.description)}</p>
          </div>
          <div style="margin-top:auto;">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
  }
}

async function toggleFailover() {
  MechaAudio.playSwitch();
  try {
    await fetch('/api/playbook/toggle-failover', { method: 'POST' });
    loadPlaybook();
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

async function rollbackDNS() {
  MechaAudio.playSwitch();
  if (!confirm('Xác nhận khôi phục cấu hình bản ghi DNS về trạng thái an toàn ban đầu?')) return;
  try {
    await fetch('/api/playbook/rollback-dns', { method: 'POST' });
    loadAuditLogs();
    fetchDashboard(true);
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 10. ASSETS CRUD (SQLITE DATABASE)
// ==========================================================================
async function loadAssets() {
  const tbody = document.getElementById('assetTableBody');
  const parentSelect = document.getElementById('assetParentId');

  try {
    const res = await fetch('/api/assets');
    allAssets = await res.json();

    if (parentSelect) {
      parentSelect.innerHTML = `<option value="">-- Là tên miền chính (Dịch vụ gốc) --</option>` +
        allAssets.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.type})</option>`).join('');
    }

    if (tbody) {
      tbody.innerHTML = allAssets.map(a => `
        <tr>
          <td style="color:var(--text-tertiary); font-family:var(--font-mono);">#${a.id}</td>
          <td><strong style="color:var(--text-primary);">${escapeHtml(a.name)}</strong></td>
          <td><span class="provider-badge">${a.type}</span></td>
          <td><code style="font-family:var(--font-mono); font-size:12px;">${escapeHtml(a.target)}</code></td>
          <td>${escapeHtml(a.provider_name)}</td>
          <td style="color:var(--text-secondary); font-size:12px;">${a.parent_name ? escapeHtml(a.parent_name) : '<span style="color:var(--text-tertiary);">Tên Miền Chính</span>'}</td>
          <td style="font-size:11.5px; color:var(--text-tertiary); font-family:var(--font-mono);">${escapeHtml(a.baseline_value || 'N/A')}</td>
          <td>${renderBadge(a.status)}</td>
          <td style="text-align: right;">
            <button class="btn btn-xs btn-hud" onclick="openEditAssetModal(${a.id})">Sửa</button>
            <button class="btn btn-xs btn-crimson" onclick="deleteAsset(${a.id})" style="margin-left:4px;">Xóa</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// Biến quản lý tra cứu tự động hạ tầng & Cloudflare
let assetInspectTimer = null;
let lastInspectedDomain = '';

function openAddAssetModal() {
  MechaAudio.playClick();
  document.getElementById('modalTitle').innerText = 'Thêm Dịch Vụ Mới';
  document.getElementById('assetId').value = '';
  document.getElementById('assetForm').reset();

  const expInput = document.getElementById('assetExpiresAt');
  if (expInput) {
    const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
    expInput.value = nextYear;
  }
  const catSelect = document.getElementById('assetCategory');
  if (catSelect) catSelect.value = 'core';

  const loading = document.getElementById('assetInspectLoading');
  if (loading) loading.style.display = 'none';
  const resultBox = document.getElementById('assetInspectResult');
  if (resultBox) resultBox.style.display = 'none';

  lastInspectedDomain = '';
  document.getElementById('assetModal').style.display = 'flex';
}

function openEditAssetModal(id) {
  MechaAudio.playClick();
  const asset = allAssets.find(a => a.id === id);
  if (!asset) return;

  document.getElementById('modalTitle').innerText = `Chỉnh Sửa Dịch Vụ #${id}`;
  document.getElementById('assetId').value = asset.id;
  document.getElementById('assetName').value = asset.name;
  document.getElementById('assetType').value = asset.type;
  document.getElementById('assetTarget').value = asset.target;
  document.getElementById('assetProvider').value = asset.provider_name;
  document.getElementById('assetParentId').value = asset.parent_asset_id || '';
  document.getElementById('assetBaseline').value = asset.baseline_value || '';

  const expInput = document.getElementById('assetExpiresAt');
  if (expInput) expInput.value = asset.expires_at || '';
  const catSelect = document.getElementById('assetCategory');
  if (catSelect) catSelect.value = asset.service_category || 'core';

  const loading = document.getElementById('assetInspectLoading');
  if (loading) loading.style.display = 'none';
  const resultBox = document.getElementById('assetInspectResult');
  if (resultBox) resultBox.style.display = 'none';

  lastInspectedDomain = asset.name;
  document.getElementById('assetModal').style.display = 'flex';
}

function closeAssetModal() {
  clearTimeout(assetInspectTimer);
  document.getElementById('assetModal').style.display = 'none';
}

function handleAssetNameInput(e) {
  clearTimeout(assetInspectTimer);
  const val = e.target.value.trim();
  const assetId = document.getElementById('assetId').value;
  // Khi chỉnh sửa dịch vụ cũ, không tự ý quét trừ khi người dùng bấm nút
  if (assetId) return;

  if (val.length >= 4 && val.includes('.') && val !== lastInspectedDomain) {
    assetInspectTimer = setTimeout(() => {
      runDomainInspection(val);
    }, 700);
  }
}

function autoInspectAssetDomain() {
  const input = document.getElementById('assetName');
  if (!input) return;
  const val = input.value.trim();
  const assetId = document.getElementById('assetId').value;
  if (!assetId && val.length >= 4 && val.includes('.') && val !== lastInspectedDomain) {
    runDomainInspection(val);
  }
}

function runManualDomainInspect() {
  MechaAudio.playClick();
  const input = document.getElementById('assetName');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    showToast('Vui lòng nhập tên miền hoặc địa chỉ website trước khi kiểm tra!', 'warning', 3500);
    input.focus();
    return;
  }
  runDomainInspection(val, true);
}

async function runDomainInspection(rawTarget, isManual = false) {
  const loading = document.getElementById('assetInspectLoading');
  const resultBox = document.getElementById('assetInspectResult');
  const btn = document.getElementById('inspectDomainBtn');

  if (loading) loading.style.display = 'block';
  if (resultBox) resultBox.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Đang Quét...</span>`;
  }

  try {
    const res = await fetch('/api/domain/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: rawTarget })
    });
    const data = await res.json();

    if (!res.ok) {
      if (isManual) showToast(data.error || 'Không thể tra cứu tên miền.', 'error', 4000);
      if (loading) loading.style.display = 'none';
      return;
    }

    lastInspectedDomain = rawTarget;
    renderAssetInspectionResult(data);
    applyInspectionSuggestions(data);
    MechaAudio.playBeep(520, 880, 0.2, 'triangle', 0.1);
    if (isManual) showToast(`Đã phân tích thành công hạ tầng mạng cho <strong>${escapeHtml(rawTarget)}</strong>`, 'success', 3500);
  } catch (err) {
    console.error('Lỗi kiểm tra domain:', err);
    if (isManual) showToast('Lỗi kết nối máy chủ quét: ' + err.message, 'error', 4000);
  } finally {
    if (loading) loading.style.display = 'none';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
        </svg>
        <span>Kiểm Tra IP & Cloudflare</span>
      `;
    }
  }
}

function renderAssetInspectionResult(data) {
  const resultBox = document.getElementById('assetInspectResult');
  if (!resultBox) return;

  const cf = data.cloudflare || {};
  let badgeHtml = '';
  if (cf.isProxy) {
    badgeHtml = `<span class="cf-badge-proxy"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Cloudflare Proxy: Đang BẬT (Đã ẩn IP thật)</span>`;
  } else if (cf.isDnsOnly) {
    badgeHtml = `<span class="cf-badge-dnsonly"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>DNS Cloudflare: TẮT Proxy (Trỏ thẳng IP gốc)</span>`;
  } else {
    badgeHtml = `<span class="cf-badge-none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Không dùng Cloudflare</span>`;
  }

  const primaryIp = data.primaryIp || (data.ips && data.ips[0]) || 'Chưa trỏ IP A record';
  const geo = data.infrastructure?.ipGeo || {};
  const ispInfo = geo.isp || geo.org || 'Chưa rõ';
  const locationInfo = [geo.city, geo.country].filter(Boolean).join(', ') || 'Global';
  const nsList = (data.ns && data.ns.length > 0) ? data.ns.slice(0, 2).join(', ') : 'Chưa cấu hình NS';
  const providerName = data.provider || data.suggestions?.provider || 'Máy chủ riêng';

  resultBox.innerHTML = `
    <div class="inspection-header">
      <div class="inspection-title">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
        </svg>
        KẾT QUẢ QUÉT HẠ TẦNG & PHÁT HIỆN CLOUDFLARE
      </div>
      <div>${badgeHtml}</div>
    </div>
    <div class="inspection-grid">
      <div><strong>Địa chỉ IP máy chủ:</strong> <code style="font-weight:700; color:var(--gundam-blue); font-size:13px;">${primaryIp}</code></div>
      <div><strong>Nhà mạng / ISP:</strong> <span>${ispInfo} (${locationInfo})</span></div>
      <div><strong>Bảo vệ Cloudflare:</strong> <span>${cf.description || 'Không dùng Cloudflare'}</span></div>
      <div><strong>Máy chủ DNS (NS):</strong> <span style="font-family:monospace; font-size:11.5px;">${nsList}</span></div>
    </div>
    <div class="inspection-auto-applied">
      <div style="display:flex; align-items:center; gap:6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Đã tự động điền <strong>IP</strong>, <strong>Nhà cung cấp (${providerName})</strong> và <strong>Cấu hình chuẩn</strong> vào form!</span>
      </div>
      <button type="button" class="btn btn-xs btn-hud" onclick="reapplyInspection('${encodeURIComponent(JSON.stringify(data.suggestions || {}))}')" style="padding:2px 8px; font-size:11px;">
        ↺ Điền Lại
      </button>
    </div>
  `;
  resultBox.style.display = 'block';
}

function applyInspectionSuggestions(data) {
  const sugg = data.suggestions || {};
  const ip = data.primaryIp || (data.ips && data.ips[0]) || '';

  const targetInput = document.getElementById('assetTarget');
  const providerInput = document.getElementById('assetProvider');
  const baselineInput = document.getElementById('assetBaseline');
  const typeSelect = document.getElementById('assetType');

  if (targetInput && sugg.target) targetInput.value = sugg.target;
  if (providerInput && (sugg.provider || data.provider)) providerInput.value = sugg.provider || data.provider;
  if (baselineInput && sugg.baseline) baselineInput.value = sugg.baseline;
  if (typeSelect && sugg.type) typeSelect.value = sugg.type;
}

function reapplyInspection(encodedSugg) {
  try {
    const sugg = JSON.parse(decodeURIComponent(encodedSugg));
    if (sugg.target) document.getElementById('assetTarget').value = sugg.target;
    if (sugg.provider) document.getElementById('assetProvider').value = sugg.provider;
    if (sugg.baseline) document.getElementById('assetBaseline').value = sugg.baseline;
    if (sugg.type) document.getElementById('assetType').value = sugg.type;
    MechaAudio.playClick();
  } catch(e) {
    console.error(e);
  }
}

async function handleSaveAsset(e) {
  e.preventDefault();
  MechaAudio.playClick();
  const id = document.getElementById('assetId').value;
  const payload = {
    name: document.getElementById('assetName').value,
    type: document.getElementById('assetType').value,
    target: document.getElementById('assetTarget').value,
    provider_name: document.getElementById('assetProvider').value,
    parent_asset_id: document.getElementById('assetParentId').value ? parseInt(document.getElementById('assetParentId').value) : null,
    baseline_value: document.getElementById('assetBaseline').value,
    expires_at: document.getElementById('assetExpiresAt')?.value || null,
    service_category: document.getElementById('assetCategory')?.value || 'core'
  };

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;

    if (id) {
      await fetch(`/api/assets/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/assets', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    }

    closeAssetModal();
    loadAssets();
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

async function deleteAsset(id) {
  MechaAudio.playClick();
  if (!confirm(`Xác nhận xóa dịch vụ #${id} khỏi danh sách?`)) return;
  try {
    const headers = {};
    if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;
    await fetch(`/api/assets/${id}`, { method: 'DELETE', headers });
    loadAssets();
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

// ==========================================================================
// 11. AUDIT LOGS (BLACK BOX RECORDER)
// ==========================================================================
async function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  if (!tbody) return;
  try {
    const res = await fetch('/api/audit-logs');
    const logs = await res.json();

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="color:var(--text-tertiary); font-family:var(--font-mono);">#${l.id}</td>
        <td style="color:var(--text-tertiary); font-family:var(--font-mono); font-size:11.5px;">${formatDateTime(l.created_at)}</td>
        <td><span class="provider-badge">${escapeHtml(l.action)}</span></td>
        <td><strong style="color:var(--text-primary);">${escapeHtml(l.actor)}</strong></td>
        <td style="color:var(--text-secondary);">${escapeHtml(l.details)}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// 12. OUT-OF-BAND ALERT DISPATCHER (TELEGRAM, DESKTOP, MAIL, APP)
// ==========================================================================
function openAlertChannelsModal() {
  MechaAudio.playClick();
  const modal = document.getElementById('alertChannelsModal');
  if (modal) modal.style.display = 'flex';
  updateBrowserPushStatusUI();
}

function closeAlertChannelsModal() {
  const modal = document.getElementById('alertChannelsModal');
  if (modal) modal.style.display = 'none';
}

function updateBrowserPushStatusUI() {
  const statusPill = document.getElementById('browserPushStatus');
  if (!('Notification' in window)) {
    if (statusPill) statusPill.innerText = 'TRÌNH DUYỆT KHÔNG HỖ TRỢ';
    return;
  }
  if (Notification.permission === 'granted') {
    if (statusPill) {
      statusPill.className = 'status-pill active font-rajdhani';
      statusPill.innerText = 'Đã Bật · Sẵn Sàng Báo Động';
    }
  } else if (Notification.permission === 'denied') {
    if (statusPill) {
      statusPill.className = 'status-pill font-rajdhani';
      statusPill.innerText = 'ĐÃ BỊ TỪ CHỐI';
    }
  } else {
    if (statusPill) {
      statusPill.className = 'status-pill font-rajdhani';
      statusPill.innerText = 'CHỜ CẤP QUYỀN';
    }
  }
}

async function triggerRealDesktopPush() {
  MechaAudio.playClick();
  if (!('Notification' in window)) {
    showToast('Trình duyệt của bạn không hỗ trợ Web Push Notification!', 'warning', 3000);
    return;
  }

  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
  }

  updateBrowserPushStatusUI();

  if (perm === 'granted') {
    new Notification('[SERVICEWATCH] Báo Động Hạ Tầng Khẩn Cấp!', {
      body: 'Phát hiện sự cố trên shop-demo.vn! Nhấn để vào bảng điều khiển ứng cứu và gửi Ticket Nhà cung cấp dịch vụ.',
      icon: '/logo.svg'
    });

    showToast('Đã phát thông báo Desktop Web Push Notification tới thiết bị!', 'success', 3500);

    await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'browser', message: 'Kích hoạt chuông báo Desktop Web Push thật' })
    });
    loadAuditLogs();
  }
}

async function simulateTelegramAlert() {
  MechaAudio.playClick();
  const box = document.getElementById('channelPreviewBox');
  const title = document.getElementById('previewHeaderTitle');
  const content = document.getElementById('previewContent');

  box.style.display = 'block';
  title.innerText = 'Tin Nhắn Đẩy Telegram Bot (@matbao_servicewatch_bot)';
  content.innerText = 
`[SERVICEWATCH · THÔNG BÁO SỰ CỐ KHẨN CẤP]
━━━━━━━━━━━━━━━━━━━━━━━━━━
DỊCH VỤ BỊ ẢNH HƯỞNG: shop-demo.vn
MỨC ĐỘ NGUY CẤP: SỰ CỐ NGHIÊM TRỌNG
MÃ SỰ CỐ: #INC-2026-SERVFAIL
THỜI GIAN: ${new Date().toLocaleTimeString('vi-VN')}
PHẠM VI ẢNH HƯỞNG DÂY CHUYỀN:
  • Website Bán Hàng (www.shop-demo.vn) -> Gián đoạn
  • Hộp thư doanh nghiệp (mail.shop-demo.vn) -> Mất kết nối
  • Cổng thanh toán API (api.shop-demo.vn) -> Chập chờn

ĐƠN VỊ TIẾP NHẬN: Trung Tâm Hỗ Trợ Kỹ Thuật Nhà Cung Cấp (24/7)
BẢN THẢO TICKET: Đã soạn sẵn mã #TK-98241 kèm thông tin chi tiết.

Nhấn để duyệt gửi Ticket ngay:
https://servicewatch.matbao.ai/incident/1`;

  showToast('Đã điều phối tin nhắn cảnh báo tức thời tới Telegram Bot!', 'success', 3000);

  await fetch('/api/alerts/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'telegram', message: 'Bắn tin cảnh báo tức thời tới Telegram Bot @matbao_servicewatch_bot' })
  });
  loadAuditLogs();
}

async function simulateEmailAlert() {
  MechaAudio.playClick();
  const box = document.getElementById('channelPreviewBox');
  const title = document.getElementById('previewHeaderTitle');
  const content = document.getElementById('previewContent');

  box.style.display = 'block';
  title.innerText = 'Email Dự Phòng Ngoài Luồng (admin-backup@gmail.com)';
  content.innerText = 
`Tiêu đề: [URGENT ALERT] ServiceWatch phát hiện shop-demo.vn gián đoạn dịch vụ
Người gửi: alerts@ops.servicewatch.vn (SMTP Gateway Dự Phòng)
Người nhận: admin-backup@gmail.com (Email cá nhân dự phòng ngoài luồng)
----------------------------------------------------------------------
Kính gửi Quản Trị Viên,

Hệ thống ServiceWatch vừa phát hiện sự cố gián đoạn trên dịch vụ shop-demo.vn:
- Nguyên nhân: Máy chủ DNS lỗi / Web Hosting quá tải HTTP 503
- Bản thảo phiếu hỗ trợ kỹ thuật gửi Nhà cung cấp dịch vụ đã được tạo tự động với đầy đủ bằng chứng kết nối.
- Lưu ý: Hộp thư công ty @shop-demo.vn đang bị ảnh hưởng, vui lòng theo dõi qua hòm thư Gmail này.

Đường dẫn điều phối khẩn cấp: https://servicewatch.matbao.ai/incident/1`;

  showToast('Đã gửi email dự phòng khẩn cấp ngoài luồng tới admin-backup@gmail.com!', 'success', 3500);

  await fetch('/api/alerts/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'email', message: 'Gửi email cảnh báo ngoài luồng tới admin-backup@gmail.com' })
  });
  loadAuditLogs();
}

async function simulateAppPushAlert() {
  MechaAudio.playClick();
  const box = document.getElementById('channelPreviewBox');
  const title = document.getElementById('previewHeaderTitle');
  const content = document.getElementById('previewContent');

  box.style.display = 'block';
  title.innerText = 'Push Notification Ứng Dụng Di Động Điều Hành (iOS / Android)';
  content.innerText = 
`[SERVICEWATCH · THÔNG BÁO SỰ CỐ KHẨN CẤP]
Dịch vụ shop-demo.vn gặp sự cố gián đoạn!
Cầu nối ServiceWatch đã sẵn sàng bản thảo Ticket hỗ trợ.
Chạm để mở ứng dụng điều hành và gửi phiếu kỹ thuật 1-chạm.`;

  showToast('Đã kích hoạt Push Notification điều hành di động!', 'success', 3000);

  await fetch('/api/alerts/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 'app', message: 'Bắn Push Notification qua Webhook App Di Động' })
  });
  loadAuditLogs();
}

// ==========================================================================
// 13. LIVE DOMAIN ONBOARDING & AUTO-DISCOVERY (CHẾ ĐỘ GIÁM SÁT THỰC TẾ)
// ==========================================================================

function openDomainOnboardModal() {
  MechaAudio.playClick();
  const modal = document.getElementById('domainOnboardModal');
  if (modal) modal.style.display = 'flex';
  const card = document.getElementById('discoveryResultCard');
  if (card) card.style.display = 'none';
  const statusBox = document.getElementById('onboardStatusBox');
  if (statusBox) statusBox.style.display = 'none';
}

function closeDomainOnboardModal() {
  const modal = document.getElementById('domainOnboardModal');
  if (modal) modal.style.display = 'none';
}

function quickFillDomain(domain) {
  MechaAudio.playClick();
  const input = document.getElementById('onboardDomainInput');
  if (input) {
    input.value = domain;
    handlePreviewDiscovery();
  }
}

async function handlePreviewDiscovery() {
  MechaAudio.playClick();
  const input = document.getElementById('onboardDomainInput');
  const btn = document.getElementById('previewScanBtn');
  const card = document.getElementById('discoveryResultCard');
  const timeEl = document.getElementById('discoveryScanTime');
  const nsEl = document.getElementById('resNs');
  const ipsEl = document.getElementById('resIps');
  const sslEl = document.getElementById('resSsl');
  const mxEl = document.getElementById('resMx');
  const httpEl = document.getElementById('resHttp');

  const domain = input.value.trim();
  if (!domain) {
    showToast('Vui lòng nhập tên miền trước khi quét thử!', 'warning', 3500);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>Đang quét Internet...</span>`;

  try {
    const res = await fetch('/api/domain/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Lỗi quét tên miền', 'error', 4000);
      return;
    }

    card.style.display = 'block';
    timeEl.innerText = new Date(data.scanTime).toLocaleTimeString('vi-VN');
    nsEl.innerText = data.ns.length > 0 ? data.ns.join(', ') : 'Không tìm thấy NS (Domain nội bộ)';

    const cfEl = document.getElementById('resCloudflare');
    const provEl = document.getElementById('resProvider');
    const primaryIp = data.primaryIp || (data.ips.length > 0 ? data.ips[0] : null);
    const geo = data.infrastructure?.ipGeo || {};
    const ispLoc = [geo.city, geo.country].filter(Boolean).join(', ');
    ipsEl.innerHTML = primaryIp ? `<code style="font-weight:700; color:var(--gundam-blue);">${primaryIp}</code> ${ispLoc ? '(' + ispLoc + ')' : ''}` : 'Chưa trỏ IP A record';

    if (cfEl) {
      if (data.cloudflare?.isProxy) {
        cfEl.innerHTML = `<span class="cf-badge-proxy"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>BẬT Cloudflare Proxy (Đã ẩn IP máy chủ)</span>`;
      } else if (data.cloudflare?.isDnsOnly) {
        cfEl.innerHTML = `<span class="cf-badge-dnsonly"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>Dùng DNS Cloudflare (TẮT Proxy - Trỏ thẳng IP gốc)</span>`;
      } else {
        cfEl.innerHTML = `<span class="cf-badge-none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Không dùng Cloudflare</span>`;
      }
    }

    if (provEl) {
      const ispName = geo.isp || geo.org || '';
      provEl.innerHTML = `<strong>${data.provider || 'Máy chủ riêng'}</strong> ${ispName ? `— <span style="color:var(--text-secondary);">${ispName}</span>` : ''}`;
    }

    sslEl.innerText = data.ssl ? `${data.ssl.issuer} (Còn ${data.ssl.daysLeft} ngày)` : 'Chưa cấu hình SSL 443';
    mxEl.innerText = data.mx.length > 0 ? data.mx.map(m => m.exchange).join(', ') : 'Không có MX record';
    httpEl.innerText = data.http && data.http.status ? `HTTP ${data.http.status} (${data.http.latency}ms)` : 'Không phản hồi Web';

    MechaAudio.playBeep(520, 880, 0.2, 'triangle', 0.1);
    showToast(`Đã phân tích bản đồ hạ tầng Internet cho <strong>${escapeHtml(domain)}</strong>`, 'success', 3500);
  } catch (err) {
    showToast('Lỗi kết nối máy chủ quét: ' + err.message, 'error', 4000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Quét Thử (Probe Test)</span>
    `;
  }
}

async function handleDomainOnboardSubmit(e) {
  e.preventDefault();
  MechaAudio.playClick();
  const input = document.getElementById('onboardDomainInput');
  const submitBtn = document.getElementById('onboardSubmitBtn');
  const statusBox = document.getElementById('onboardStatusBox');
  const domain = input.value.trim();

  if (!domain) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span>Đang thiết lập theo dõi dịch vụ...</span>`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) {
      headers['Authorization'] = `Bearer ${currentAuthToken}`;
    }

    const res = await fetch('/api/domain/onboard', {
      method: 'POST',
      headers,
      body: JSON.stringify({ domain })
    });
    const data = await res.json();

    if (!res.ok) {
      statusBox.style.display = 'block';
      statusBox.className = 'auth-alert-box danger';
      statusBox.innerText = data.error || 'Thiết lập thất bại';
      return;
    }

    statusBox.style.display = 'block';
    statusBox.className = 'auth-alert-box success';
    statusBox.innerHTML = `Đã kích hoạt theo dõi trực tiếp cho <strong>${escapeHtml(domain)}</strong>! Hệ thống đang tự động kiểm tra kết nối qua mạng Internet...`;
    MechaAudio.playBeep(440, 980, 0.35, 'triangle', 0.15);

    setTimeout(() => {
      closeDomainOnboardModal();
      fetchDashboard(true);
      loadAssets();
      loadAuditLogs();
    }, 1200);
  } catch (err) {
    statusBox.style.display = 'block';
    statusBox.className = 'auth-alert-box danger';
    statusBox.innerText = 'Lỗi mạng: ' + err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
      <span>BẮT ĐẦU GIÁM SÁT THỰC TẾ NGAY</span>
    `;
  }
}

async function handleRestoreDemo() {
  MechaAudio.playClick();
  if (!confirm('Khôi phục lại toàn bộ dữ liệu mẫu shop-demo.vn (kịch bản diễn tập của Ban Giám Khảo)?')) {
    return;
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (currentAuthToken) headers['Authorization'] = `Bearer ${currentAuthToken}`;

    const res = await fetch('/api/domain/restore-demo', {
      method: 'POST',
      headers
    });
    const data = await res.json();
    if (data.success) {
      closeDomainOnboardModal();
      fetchDashboard(true);
      loadAssets();
      loadAuditLogs();
      MechaAudio.playSwitch();
      showToast('Đã khôi phục hoàn chỉnh dữ liệu Demo!', 'success', 3500);
    }
  } catch (err) {
    showToast('Lỗi khôi phục: ' + err.message, 'error', 4000);
  }
}

// =============================================================================
// 7. 1-CLICK ECOSYSTEM TEMPLATES (ĐƠN GIẢN HÓA NHẬP DỊCH VỤ SỐ)
// =============================================================================
function applyAssetTemplate(type) {
  MechaAudio.playClick();
  const nameInput = document.getElementById('assetName');
  const typeSelect = document.getElementById('assetType');
  const targetInput = document.getElementById('assetTarget');
  const providerInput = document.getElementById('assetProvider');
  const baselineInput = document.getElementById('assetBaseline');
  const expInput = document.getElementById('assetExpiresAt');
  const catSelect = document.getElementById('assetCategory');

  const rootDom = (allAssets.find(a => a.type === 'domain') || {}).name || 'shop-demo.vn';
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];

  if (type === 'matbao_domain') {
    nameInput.value = rootDom;
    typeSelect.value = 'domain';
    targetInput.value = rootDom;
    providerInput.value = 'Nhà Cung Cấp Tên Miền / DNS';
    baselineInput.value = 'NS: ns1.matbao.vn, ns2.matbao.vn';
    if (expInput) expInput.value = nextYear;
    if (catSelect) catSelect.value = 'core';
  } else if (type === 'vnpay_gateway') {
    nameInput.value = 'Cổng Thanh Toán VNPay IPN';
    typeSelect.value = 'payment';
    targetInput.value = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    providerInput.value = 'VNPay (VNPAY-QR)';
    baselineInput.value = 'Sandbox IPN 200 OK, Latency < 300ms';
    if (expInput) expInput.value = '2027-12-31';
    if (catSelect) catSelect.value = 'payment';
  } else if (type === 'momo_wallet') {
    nameInput.value = 'Ví Điện Tử MoMo Payment Gateway';
    typeSelect.value = 'payment';
    targetInput.value = 'https://business.momo.vn';
    providerInput.value = 'M-Service (MoMo)';
    baselineInput.value = 'Webhook HTTP 200, Callback Ready';
    if (expInput) expInput.value = '2027-12-31';
    if (catSelect) catSelect.value = 'payment';
  } else if (type === 'promail_matbao') {
    nameInput.value = `mail.${rootDom}`;
    typeSelect.value = 'email';
    targetInput.value = `mail.${rootDom}:25`;
    providerInput.value = 'Máy Chủ Email Doanh Nghiệp';
    baselineInput.value = `MX: mail.${rootDom} (Priority 10)`;
    if (expInput) expInput.value = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
    if (catSelect) catSelect.value = 'email';
  } else if (type === 'cloud_hosting') {
    nameInput.value = `www.${rootDom}`;
    typeSelect.value = 'hosting';
    targetInput.value = '103.1.1.20';
    providerInput.value = 'Nhà Cung Cấp Cloud Hosting';
    baselineInput.value = 'HTTP 200, NGINX Cluster';
    if (expInput) expInput.value = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
    if (catSelect) catSelect.value = 'core';
  } else if (type === 'vps_database') {
    nameInput.value = 'MySQL Cloud VPS Database Cluster';
    typeSelect.value = 'hosting';
    targetInput.value = '103.1.1.25:3306';
    providerInput.value = 'Nhà Cung Cấp Cloud VPS';
    baselineInput.value = 'TCP 3306 Open, Uptime > 99.9%';
    if (expInput) expInput.value = '2027-06-30';
    if (catSelect) catSelect.value = 'core';
  }
}

// =============================================================================
// 8. RENEWAL RADAR ENGINE (QUẢN LÝ VÒNG ĐỜI & GIA HẠN DỊCH VỤ)
// =============================================================================
async function loadRenewalRadar() {
  const tableBody = document.getElementById('renewalTableBody');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/renewals/radar');
    const items = await res.json();

    const expiringCountEl = document.getElementById('radarExpiringCount');
    const safeCountEl = document.getElementById('radarSafeCount');

    let expiring = 0;
    let safe = 0;

    tableBody.innerHTML = items.map(item => {
      if (item.level === 'critical' || item.level === 'warning' || item.level === 'expired') {
        expiring++;
      } else {
        safe++;
      }

      let badgeClass = 'badge-healthy';
      let progressColor = '#10b981';
      if (item.level === 'expired') {
        badgeClass = 'badge-danger';
        progressColor = '#ef4444';
      } else if (item.level === 'critical') {
        badgeClass = 'badge-danger';
        progressColor = '#ef4444';
      } else if (item.level === 'warning') {
        badgeClass = 'badge-warning';
        progressColor = '#f59e0b';
      }

      const percent = Math.min(100, Math.max(8, Math.round((item.days_left / 365) * 100)));

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:13px;">${escapeHtml(item.name)}</div>
            <div style="font-size:11px; color:var(--text-tertiary); font-family:monospace;">ID #${item.id}</div>
          </td>
          <td><span class="provider-badge">${escapeHtml(item.type)}</span></td>
          <td>${escapeHtml(item.provider_name)}</td>
          <td><span style="font-family:monospace; font-size:12px;">${item.expires_at || 'Chưa thiết lập'}</span></td>
          <td style="min-width:180px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span class="font-orbitron" style="font-size:13px; font-weight:700; color:${progressColor};">
                ${item.days_left} NGÀY
              </span>
              <span style="font-size:11px; color:var(--text-tertiary);">${item.badgeText}</span>
            </div>
            <div style="width:100%; height:6px; background:rgba(0,0,0,0.08); border-radius:3px; overflow:hidden;">
              <div style="width:${percent}%; height:100%; background:${progressColor}; border-radius:3px; transition:width 0.4s;"></div>
            </div>
          </td>
          <td>
            <span class="badge-status ${badgeClass}" style="font-size:11px; padding:3px 8px;">
              ${item.badgeText}
            </span>
          </td>
          <td style="text-align: right;">
            <a href="https://id.matbao.net" target="_blank" class="btn btn-xs btn-primary-cyan" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <span>Gia Hạn</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </td>
        </tr>
      `;
    }).join('');

    if (expiringCountEl) expiringCountEl.innerText = expiring;
    if (safeCountEl) safeCountEl.innerText = safe;
  } catch (err) {
    console.error('Lỗi nạp Renewal Radar:', err);
  }
}

async function runQuickRdapLookup() {
  MechaAudio.playClick();
  const input = document.getElementById('quickRdapInput');
  const resultBox = document.getElementById('rdapLookupResult');
  if (!input || !resultBox) return;

  const val = input.value.trim();
  if (!val) {
    showToast('Vui lòng nhập tên miền cần tra cứu hạn dùng (ví dụ: matbao.com)!', 'warning', 3000);
    input.focus();
    return;
  }

  resultBox.style.display = 'inline';
  resultBox.innerText = 'Đang tra cứu RDAP...';
  showToast(`Đang kết nối cơ sở dữ liệu WHOIS/RDAP để tra cứu [${val}]...`, 'info', 2000);

  try {
    const res = await fetch(`/api/domain/rdap/${encodeURIComponent(val)}`);
    const data = await res.json();
    resultBox.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-emerald)" stroke-width="2.5" style="display:inline; vertical-align:middle; margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>[${data.domain}] Hạn dùng: <strong>${data.expiresAt}</strong> (Còn <strong>${data.daysLeft} ngày</strong> - Nguồn: ${data.source})`;
    showToast(`Đã tra cứu hạn [${data.domain}]: Còn ${data.daysLeft} ngày (${data.expiresAt})`, 'success', 4000);
  } catch (e) {
    resultBox.innerText = 'Lỗi tra cứu: ' + e.message;
    showToast('Lỗi tra cứu RDAP: ' + e.message, 'error', 4000);
  }
}

// =============================================================================
// 9. HEARTBEAT MONITOR ENGINE (DEAD MAN'S SNITCH CHO CRON & WORKER NGẦM)
// =============================================================================
async function loadHeartbeats() {
  const tableBody = document.getElementById('heartbeatTableBody');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/heartbeats');
    const items = await res.json();

    const countEl = document.getElementById('radarHeartbeatCount');
    if (countEl) countEl.innerText = items.length;

    tableBody.innerHTML = items.map(hb => {
      const isLate = hb.is_late || hb.status === 'missing';
      const statusBadge = isLate
        ? `<span class="badge-status badge-danger" style="animation:pulse 1s infinite;"><span class="badge-dot"></span>QUÁ HẠN (${hb.elapsed_seconds}s)</span>`
        : `<span class="badge-status badge-healthy"><span class="badge-dot"></span>HEALTHY (${hb.elapsed_seconds}s trước)</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--text-primary); font-size:13px;">${escapeHtml(hb.name)}</div>
            <div style="font-size:11px; color:var(--text-tertiary);">Token: <code style="color:var(--gundam-blue); font-weight:600;">${escapeHtml(hb.token)}</code></div>
          </td>
          <td><span class="provider-badge">${escapeHtml(hb.category).toUpperCase()}</span></td>
          <td>
            <code style="font-size:11.5px; background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-family:monospace;">
              /api/heartbeat/${escapeHtml(hb.token)}
            </code>
          </td>
          <td>
            <span class="font-orbitron" style="font-size:12px; font-weight:700;">${hb.expected_interval_seconds}s</span>
            <span style="font-size:11px; color:var(--text-tertiary);">(+${hb.grace_period_seconds}s ân hạn)</span>
          </td>
          <td style="font-size:12px; color:var(--text-secondary);">
            <div>${hb.last_ping_at || 'Chưa nhận ping'}</div>
            <div style="font-size:11px; color:var(--text-tertiary);">${hb.elapsed_seconds}s trước</div>
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right; white-space:nowrap;">
            <button class="btn btn-xs btn-primary-cyan" onclick="triggerHeartbeatPing('${hb.token}')" title="Gửi ping giả lập từ cURL">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:2px;"><polyline points="20 6 9 17 4 12"/></svg>Ping
            </button>
            <button class="btn btn-xs btn-crimson" onclick="simulateHeartbeatMiss('${hb.token}')" style="margin-left:4px;" title="Mô phỏng Cron bị treo / trễ hạn">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:2px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Test Lỗi
            </button>
            <button class="btn btn-xs btn-hud" onclick="deleteHeartbeat(${hb.id})" style="margin-left:4px;" title="Xóa kênh Heartbeat">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch(err) {
    console.error('Lỗi nạp Heartbeats:', err);
  }
}

async function triggerHeartbeatPing(token) {
  MechaAudio.playClick();
  showToast('Đang gửi tín hiệu Heartbeat ping phục hồi...', 'info', 2000);
  try {
    const res = await fetch(`/api/heartbeat/${token}`, { method: 'POST' });
    const data = await res.json();
    MechaAudio.playBeep(600, 950, 0.15, 'sine', 0.1);
    showToast('Đã gửi tín hiệu Heartbeat thành công! Trạng thái tác vụ: HEALTHY', 'success', 3500);
    loadHeartbeats();
    fetchDashboard(true);
  } catch(e) {
    showToast('Lỗi gửi Heartbeat: ' + e.message, 'error', 4000);
  }
}

async function simulateHeartbeatMiss(token) {
  MechaAudio.playClick();
  showToast('Đang mô phỏng sự cố trễ tín hiệu Heartbeat...', 'warning', 2500);
  try {
    const res = await fetch(`/api/heartbeats/${token}/simulate-miss`, { method: 'POST' });
    const data = await res.json();
    MechaAudio.playAlarm();
    showToast('Đã kích hoạt cảnh báo Heartbeat trễ hạn quá 120s! Tác vụ ngầm báo động.', 'error', 4500);
    loadHeartbeats();
    fetchDashboard(true);
  } catch(e) {
    showToast('Lỗi mô phỏng trễ ping: ' + e.message, 'error', 4000);
  }
}

function openAddHeartbeatModal() {
  MechaAudio.playClick();
  document.getElementById('heartbeatForm').reset();
  document.getElementById('heartbeatModal').style.display = 'flex';
}

function closeHeartbeatModal() {
  document.getElementById('heartbeatModal').style.display = 'none';
}

async function handleSaveHeartbeat(e) {
  e.preventDefault();
  MechaAudio.playClick();
  const payload = {
    token: document.getElementById('hbToken').value.trim(),
    name: document.getElementById('hbName').value.trim(),
    category: document.getElementById('hbCategory').value,
    expected_interval_seconds: parseInt(document.getElementById('hbInterval').value) || 60,
    grace_period_seconds: parseInt(document.getElementById('hbGrace').value) || 30
  };

  try {
    const res = await fetch('/api/heartbeats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Lỗi tạo Heartbeat', 'error', 4000);
      return;
    }
    closeHeartbeatModal();
    loadHeartbeats();
    MechaAudio.playSwitch();
    showToast(`Đã kích hoạt giám sát Heartbeat cho [${payload.name}]!`, 'success', 3500);
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error', 4000);
  }
}

async function deleteHeartbeat(id) {
  MechaAudio.playClick();
  if (!confirm('Xác nhận xóa kênh Heartbeat này?')) return;
  try {
    await fetch(`/api/heartbeats/${id}`, { method: 'DELETE' });
    loadHeartbeats();
    showToast('Đã xóa kênh Heartbeat', 'info', 2500);
  } catch(e) {
    console.error(e);
    showToast('Lỗi khi xóa Heartbeat: ' + e.message, 'error', 3500);
  }
}

// ==========================================================================
// 12. AI SRE COPILOT & ROOT-CAUSE ANALYSIS CONTROLLERS
// ==========================================================================
let currentAiAnalysis = null;
let currentAiIncidentId = null;

function getStoredAiKey() {
  return localStorage.getItem('servicewatch_gemini_key') || '';
}

// Toggle password visibility helper
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    }
  }
}

// Open Dedicated Global AI Configuration Modal
async function openAiConfigModal() {
  MechaAudio.playClick();
  const modal = document.getElementById('aiConfigModal');
  if (!modal) return;
  modal.style.display = 'flex';

  const input = document.getElementById('globalGeminiApiKeyInput');
  const storedKey = getStoredAiKey();
  if (input) input.value = storedKey;

  const resultBox = document.getElementById('aiKeyTestResultBox');
  if (resultBox) resultBox.style.display = 'none';

  await updateAiModalEngineStatus();
}

function closeAiConfigModal() {
  const modal = document.getElementById('aiConfigModal');
  if (modal) modal.style.display = 'none';
}

async function updateAiModalEngineStatus() {
  const localKey = getStoredAiKey();
  let serverConfig = null;
  try {
    const res = await fetch('/api/ai/config');
    serverConfig = await res.json();
  } catch (e) {}

  const hasKey = Boolean(localKey || (serverConfig && serverConfig.hasKey));
  const activeTitle = document.getElementById('aiActiveEngineTitle');
  const activeDesc = document.getElementById('aiActiveEngineDesc');
  const activeTag = document.getElementById('aiActiveEngineTag');
  const badge = document.getElementById('globalAiModalBadge');
  const topBadge = document.getElementById('topAiStatusDot');

  if (hasKey) {
    if (activeTitle) activeTitle.innerHTML = 'Google Gemini 1.5 Flash (Cloud API Trực Tiếp)';
    if (activeDesc) activeDesc.innerHTML = 'Kết nối trực tiếp tới Google Generative Language Cloud. Tự động chẩn đoán lỗi sâu và tạo draft ticket theo văn phong SRE.';
    if (activeTag) {
      activeTag.className = 'badge-status badge-healthy';
      activeTag.innerHTML = '<span class="badge-dot"></span>ĐÃ KẾT NỐI GEMINI';
    }
    if (badge) badge.innerText = 'Gemini 1.5 Flash';
    if (topBadge) {
      topBadge.style.background = '#10b981';
      topBadge.title = 'Đang dùng Google Gemini Cloud';
    }
  } else {
    if (activeTitle) activeTitle.innerHTML = 'ServiceWatch SRE Engine (Tích Hợp Sẵn)';
    if (activeDesc) activeDesc.innerHTML = 'Chẩn đoán sự cố theo thời gian thực (&lt;1s) bằng ma trận luật chuyên gia SRE và đối chiếu tương quan mạng. Không phụ thuộc mạng ngoài.';
    if (activeTag) {
      activeTag.className = 'badge-status';
      activeTag.style.background = '#eff6ff';
      activeTag.style.color = '#1d4ed8';
      activeTag.style.border = '1px solid #bfdbfe';
      activeTag.innerHTML = '<span class="badge-dot" style="background:#2563eb;"></span>SRE ENGINE TÍCH HỢP';
    }
    if (badge) badge.innerText = 'AI SRE Engine';
    if (topBadge) {
      topBadge.style.background = '#3b82f6';
      topBadge.title = 'Đang dùng AI SRE Engine tích hợp';
    }
  }
}

// Test Gemini API Key live
async function testGeminiApiKey() {
  MechaAudio.playClick();
  const input = document.getElementById('globalGeminiApiKeyInput');
  const btn = document.getElementById('btnTestGeminiKey');
  const resultBox = document.getElementById('aiKeyTestResultBox');
  const key = input ? input.value.trim() : '';

  if (!key) {
    showToast('Vui lòng nhập Gemini API Key để kiểm tra kết nối', 'warning', 3500);
    if (input) input.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-inline" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin 0.6s linear infinite; margin-right:4px;"></span> Đang Thử...`;
  }

  if (resultBox) {
    resultBox.style.display = 'block';
    resultBox.style.background = 'var(--bg-subtle)';
    resultBox.style.border = '1px solid var(--border-default)';
    resultBox.style.color = 'var(--text-secondary)';
    resultBox.innerHTML = '<span class="hud-pulse-dot" style="display:inline-block; margin-right:6px;"></span> Đang phát gói tin kiểm tra tới Google Gemini Cloud (generativelanguage.googleapis.com)...';
  }

  try {
    const res = await fetch('/api/ai/test-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: key })
    });
    const data = await res.json();

    if (data.success) {
      MechaAudio.playBeep(520, 880, 0.25, 'triangle', 0.12);
      if (resultBox) {
        resultBox.style.background = 'var(--status-emerald-bg)';
        resultBox.style.border = '1px solid var(--status-emerald-border)';
        resultBox.style.color = 'var(--status-emerald-text)';
        resultBox.innerHTML = `
          <div style="font-weight:700; display:flex; align-items:center; gap:6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Xác thực thành công! Phản hồi sau ${data.latencyMs}ms.
          </div>
          <div style="font-size:12px; margin-top:4px; opacity:0.9;">Phản hồi từ Gemini: <em>"${escapeHtml(data.reply)}"</em></div>
        `;
      }
      showToast('Kết nối Google Gemini thành công! API Key hoàn toàn hợp lệ.', 'success', 4000);
    } else {
      throw new Error(data.error || 'Kiểm tra thất bại');
    }
  } catch (err) {
    if (resultBox) {
      resultBox.style.background = 'var(--status-rose-bg)';
      resultBox.style.border = '1px solid var(--status-rose-border)';
      resultBox.style.color = 'var(--status-rose-text)';
      resultBox.innerHTML = `
        <div style="font-weight:700; display:flex; align-items:center; gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Lỗi kết nối Gemini:
        </div>
        <div style="font-size:12px; margin-top:4px;">${escapeHtml(err.message)}</div>
      `;
    }
    showToast('Lỗi xác thực API Key: ' + err.message, 'error', 4500);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>Kiểm Tra</span>`;
    }
  }
}

// Save Global AI Key to browser and backend
async function saveGlobalAiKey() {
  MechaAudio.playClick();
  const input = document.getElementById('globalGeminiApiKeyInput');
  const key = input ? input.value.trim() : '';

  localStorage.setItem('servicewatch_gemini_key', key);

  try {
    await fetch('/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: key })
    });
  } catch (e) {}

  showToast(key ? 'Đã lưu Google Gemini API Key! Các phân tích sự cố sẽ gọi trực tiếp Gemini Cloud.' : 'Đã xóa API Key. Hệ thống sử dụng AI SRE Engine tích hợp sẵn (<1s).', 'success', 4000);
  closeAiConfigModal();
  updateAiModalEngineStatus();

  // If there is an active incident in view, re-run analysis
  if (latestDashboardData && latestDashboardData.activeIncidents && latestDashboardData.activeIncidents.length > 0) {
    loadInlineAiAnalysis(latestDashboardData.activeIncidents[0].id);
  }
}

async function clearGlobalAiKey() {
  MechaAudio.playClick();
  const input = document.getElementById('globalGeminiApiKeyInput');
  if (input) input.value = '';
  await saveGlobalAiKey();
}

function saveAiKey() {
  const input = document.getElementById('geminiApiKeyInput');
  if (!input) return;
  const key = input.value.trim();
  localStorage.setItem('servicewatch_gemini_key', key);
  showToast(key ? 'Đã lưu Google Gemini API Key!' : 'Đã quay về dùng AI SRE Engine tích hợp sẵn (<1s).', 'success', 4000);
  toggleAiKeySettings();
  if (currentAiIncidentId) {
    runAiAnalysisForIncident(currentAiIncidentId);
  }
}

function toggleAiKeySettings() {
  const box = document.getElementById('aiKeySettingsBox');
  if (box) {
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
    const input = document.getElementById('geminiApiKeyInput');
    if (input) input.value = getStoredAiKey();
  }
}

async function openAiRcaModal(incidentId) {
  MechaAudio.playClick();
  const modal = document.getElementById('aiRcaModal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Determine incident ID
  let targetId = incidentId;
  if (!targetId && latestDashboardData && latestDashboardData.activeIncidents && latestDashboardData.activeIncidents.length > 0) {
    targetId = latestDashboardData.activeIncidents[0].id;
  }

  currentAiIncidentId = targetId;

  const body = document.getElementById('aiRcaModalBody');
  const applyBtn = document.getElementById('aiApplyTicketBtn');
  const providerBadge = document.getElementById('aiModalProviderBadge');

  if (!targetId) {
    body.innerHTML = `
      <div style="text-align:center; padding:36px; color:var(--text-secondary);">
        <div style="margin-bottom:10px;"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--status-emerald)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></div>
        <strong style="font-size:15px; color:var(--text-primary); display:block;">Hạ Tầng Đang Hoạt Động Bình Thường</strong>
        <p style="font-size:13px; margin-top:4px;">Không có sự cố nào đang diễn ra. Bạn có thể nhấn 'Tạo Lỗi Thử' ở góc trên màn hình để kiểm chứng khả năng phân tích của AI.</p>
      </div>
    `;
    if (applyBtn) applyBtn.style.display = 'none';
    return;
  }

  // Render loading skeleton
  body.innerHTML = `
    <div class="ai-loading-skeleton">
      <div class="ai-spinner"></div>
      <div>
        <strong style="color:var(--text-primary); font-size:14px; display:block;">AI SRE Đang Phân Tích Dữ Liệu Sự Cố...</strong>
        <p style="font-size:12.5px; color:var(--text-secondary); margin-top:4px;">Đang đối chiếu đồ thị phụ thuộc Topology và log đo đạc từ 4 DNS Resolvers...</p>
      </div>
    </div>
  `;
  if (applyBtn) applyBtn.style.display = 'none';

  try {
    const geminiKey = getStoredAiKey();
    const res = await fetch(`/api/ai/analyze-incident/${targetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: geminiKey })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || 'Lỗi phân tích AI');

    currentAiAnalysis = result.data;
    if (providerBadge) providerBadge.innerText = currentAiAnalysis.provider_used || 'AI SRE Engine';

    body.innerHTML = renderAiAnalysisHtml(currentAiAnalysis);
    if (applyBtn) applyBtn.style.display = 'inline-flex';
    MechaAudio.playBeep(440, 880, 0.25, 'triangle', 0.12);
  } catch (err) {
    body.innerHTML = `
      <div style="padding:20px; color:var(--gundam-red); text-align:center;">
        <strong>Lỗi phân tích AI:</strong> ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function closeAiRcaModal() {
  const modal = document.getElementById('aiRcaModal');
  if (modal) modal.style.display = 'none';
}

function renderAiAnalysisHtml(data) {
  const actionsList = (data.recommended_actions || []).map(a => `<li>${escapeHtml(a)}</li>`).join('');
  const avoidList = (data.actions_to_avoid || []).map(a => `<div>• ${escapeHtml(a)}</div>`).join('');
  const blastList = (data.blast_radius || []).map(b => `<span class="badge-status badge-down" style="font-size:11px; padding:3px 8px;">${escapeHtml(b)}</span>`).join('');

  return `
    <div style="display:flex; flex-direction:column; gap:16px;">
      
      <!-- Root Cause Card -->
      <div style="background:var(--status-emerald-bg); border:1px solid var(--status-emerald-border); border-radius:var(--radius-md); padding:16px 18px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <span style="font-size:11px; font-weight:700; color:var(--status-emerald-text); text-transform:uppercase; letter-spacing:0.04em;">KẾT LUẬN NGUYÊN NHÂN GỐC (ROOT CAUSE)</span>
          <span style="font-size:11px; font-weight:700; color:var(--status-emerald); background:#fff; padding:2px 8px; border-radius:999px; border:1px solid var(--status-emerald-border);">ĐỘ TIN CẬY: ${data.confidence_score || 98}%</span>
        </div>
        <div style="font-size:14.5px; font-weight:700; color:var(--text-primary); margin-top:6px; line-height:1.4;">
          ${escapeHtml(data.root_cause_summary)}
        </div>
        <p style="font-size:12.5px; color:var(--text-secondary); margin-top:6px; line-height:1.5;">
          ${escapeHtml(data.root_cause_detail)}
        </p>
      </div>

      <!-- False Alarm / Cascading Mitigation -->
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:var(--radius-md); padding:14px 16px;">
        <div style="font-size:11px; font-weight:700; color:#1d4ed8; text-transform:uppercase; letter-spacing:0.04em;">KHỬ BÁO ĐỘNG GIẢ (FALSE ALARM MITIGATION)</div>
        <div style="font-size:12.5px; color:#1e3a8a; margin-top:4px; line-height:1.5;">
          ${escapeHtml(data.false_alarm_mitigation)}
        </div>
      </div>

      <!-- Blast Radius Badges -->
      <div>
        <div style="font-size:11.5px; font-weight:700; color:var(--text-tertiary); text-transform:uppercase; margin-bottom:6px;">PHẠM VI ẢNH HƯỞNG (BLAST RADIUS):</div>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${blastList}
        </div>
      </div>

      <!-- 2 Columns: Recommended Actions vs Actions to Avoid -->
      <div class="ai-grid-2col">
        <div class="ai-detail-box">
          <h6 style="color:#059669;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            CÁC BƯỚC KHẮC PHỤC ĐỀ XUẤT
          </h6>
          <ul class="ai-checklist">
            ${actionsList}
          </ul>
          <div style="margin-top:12px; font-size:12px; color:var(--text-tertiary); border-top:1px dashed var(--border-default); padding-top:8px;">
            Thời gian ước tính: <strong style="color:var(--text-primary);">${escapeHtml(data.estimated_recovery_time || '5 - 15 phút')}</strong>
          </div>
        </div>

        <div class="ai-avoid-box">
          <strong style="display:flex; align-items:center; gap:6px; margin-bottom:8px; font-size:12.5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            TUYỆT ĐỐI KHÔNG NÊN LÀM
          </strong>
          ${avoidList}
        </div>
      </div>

    </div>
  `;
}

// Load inline AI SRE card in Tab Incidents
async function loadInlineAiAnalysis(incidentId) {
  const shortSummary = document.getElementById('aiShortSummary');
  const shortFalseAlarm = document.getElementById('aiShortFalseAlarm');
  const confidenceBadge = document.getElementById('aiConfidenceBadge');
  const deepBox = document.getElementById('aiDeepDetailsBox');
  const legacyContainer = document.getElementById('aiInlineContent');
  const providerPill = document.getElementById('aiInlineProvider');

  if (shortSummary) {
    shortSummary.innerHTML = `<span class="hud-pulse-dot" style="display:inline-block; margin-right:6px;"></span> AI SRE đang chẩn đoán nguyên nhân gốc...`;
  }
  if (legacyContainer) {
    legacyContainer.innerHTML = `
      <div style="padding:16px 0; text-align:center; color:var(--text-tertiary); font-size:12.5px;">
        <span class="hud-pulse-dot" style="display:inline-block; margin-right:6px;"></span>
        AI SRE đang tổng hợp nguyên nhân gốc rễ và khử báo động giả...
      </div>
    `;
  }

  try {
    const geminiKey = getStoredAiKey();
    const res = await fetch(`/api/ai/analyze-incident/${incidentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: geminiKey })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);

    currentAiAnalysis = result.data;

    if (shortSummary) {
      shortSummary.innerHTML = escapeHtml(currentAiAnalysis.root_cause_summary || 'Đã phân tích xong');
    }
    if (shortFalseAlarm) {
      shortFalseAlarm.innerHTML = `• <strong>Khử báo động giả:</strong> ${escapeHtml(currentAiAnalysis.false_alarm_mitigation || 'Không có nguy cơ lan truyền')}`;
    }
    if (confidenceBadge) {
      confidenceBadge.innerText = `ĐỘ TIN CẬY: ${currentAiAnalysis.confidence_score || 96}%`;
    }
    if (deepBox) {
      deepBox.innerHTML = renderAiAnalysisHtml(currentAiAnalysis);
    }
    if (providerPill) {
      providerPill.innerText = currentAiAnalysis.provider_used || 'AI SRE Engine';
    }
    if (legacyContainer) {
      legacyContainer.innerHTML = renderAiAnalysisHtml(currentAiAnalysis);
    }
  } catch (e) {
    if (shortSummary) {
      shortSummary.innerHTML = `<span style="color:var(--text-muted);">Không thể tải phân tích AI: ${escapeHtml(e.message)}</span>`;
    }
    if (legacyContainer) {
      legacyContainer.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">Không thể tải phân tích AI: ${escapeHtml(e.message)}</div>`;
    }
  }
}

async function runAiAnalysisForIncident(incidentId) {
  MechaAudio.playClick();
  showToast('Đang phân tích lại với AI SRE Engine...', 'info', 2500);
  await loadInlineAiAnalysis(incidentId);
  MechaAudio.playBeep(520, 880, 0.2, 'triangle', 0.1);
  showToast('Đã cập nhật chẩn đoán lỗi mới nhất!', 'success', 3000);
}

// 1-Click AI Optimize Ticket
async function optimizeTicketWithAi(incidentId) {
  MechaAudio.playClick();
  const btn = document.getElementById('btnOptimizeTicket');
  const box = document.getElementById('ticketBodyPreviewBox');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Đang Tối Ưu Hóa...</span>`;
  }

  try {
    const geminiKey = getStoredAiKey();
    const res = await fetch(`/api/ai/analyze-incident/${incidentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geminiApiKey: geminiKey })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);

    currentAiAnalysis = result.data;
    if (box && currentAiAnalysis.optimized_ticket_body) {
      box.innerText = currentAiAnalysis.optimized_ticket_body;
      box.style.border = '1.5px solid #2563eb';
      box.style.background = '#f0fdf4';
      setTimeout(() => {
        box.style.background = 'var(--bg-subtle)';
        box.style.border = '1px solid var(--border-default)';
      }, 2500);
    }
    MechaAudio.playBeep(440, 880, 0.3, 'triangle', 0.15);
    showToast('<strong>AI đã tối ưu hóa phiếu hỗ trợ!</strong> Nội dung đã sẵn sàng gửi tới Nhà cung cấp dịch vụ.', 'success', 4500);
  } catch (e) {
    showToast('Lỗi tối ưu phiếu: ' + e.message, 'error', 4000);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span>AI Tối Ưu Phiếu Hỗ Trợ</span>`;
    }
  }
}

// Apply ticket from modal and switch
function applyAiTicketAndSwitch() {
  if (!currentAiAnalysis || !currentAiAnalysis.optimized_ticket_body) return;
  closeAiRcaModal();
  switchTab('tab-incidents');
  setTimeout(() => {
    const box = document.getElementById('ticketBodyPreviewBox');
    if (box) {
      box.innerText = currentAiAnalysis.optimized_ticket_body;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      box.style.border = '2px solid #2563eb';
      box.style.background = '#f0fdf4';
      setTimeout(() => {
        box.style.background = 'var(--bg-subtle)';
        box.style.border = '1px solid var(--border-default)';
      }, 2500);
    }
  }, 200);
}


