// --- SERVICEWATCH FRIENDLY & ENTERPRISE CLIENT SCRIPT ---

let currentChaosMode = false;
let currentChaosType = 'dns_servfail';
let allAssets = [];

// Reusable Pure Vector SVG Icons (No Emojis)
const ICONS = {
  globe: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  website: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  hosting: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  email: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  ssl: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  send: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  fileText: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
};

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initTabs();
  initChaosControls();
  fetchDashboard();
  loadAssets();
  loadPlaybook();
  loadAuditLogs();

  // Polling mỗi 3.5 giây để cập nhật trực tiếp trạng thái
  setInterval(() => {
    fetchDashboard(false);
  }, 3500);
});

// 1. Quản lý Theme Sáng / Tối
function initTheme() {
  const current = localStorage.getItem('servicewatch_theme') || 'light';
  applyTheme(current);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme') || 'light';
      const next = active === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('servicewatch_theme', next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sunIcon = document.getElementById('themeIconSun');
  const moonIcon = document.getElementById('themeIconMoon');
  const label = document.getElementById('themeToggleLabel');

  if (theme === 'dark') {
    if (sunIcon) sunIcon.style.display = 'inline-block';
    if (moonIcon) moonIcon.style.display = 'none';
    if (label) label.innerText = 'Sáng';
  } else {
    if (sunIcon) sunIcon.style.display = 'none';
    if (moonIcon) moonIcon.style.display = 'inline-block';
    if (label) label.innerText = 'Tối';
  }
}

// 2. Quản lý chuyển Tab
function initTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      switchTab(targetId);
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

  if (targetId === 'tab-assets') loadAssets();
  if (targetId === 'tab-playbook') loadPlaybook();
  if (targetId === 'tab-logs') loadAuditLogs();
}

// 3. Chế độ kiểm thử Chaos Studio
function initChaosControls() {
  const toggleBtn = document.getElementById('toggleChaosBtn');
  const typeSelect = document.getElementById('chaosTypeSelect');
  const triggerBtn = document.getElementById('triggerProbeBtn');

  toggleBtn.addEventListener('click', async () => {
    const selectedType = typeSelect.value;
    try {
      await fetch('/api/chaos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaos_type: selectedType })
      });
      fetchDashboard(true);
    } catch (err) {
      console.error('Lỗi khi kích hoạt Chaos:', err);
    }
  });

  triggerBtn.addEventListener('click', async () => {
    triggerBtn.disabled = true;
    try {
      await fetch('/api/probes/run', { method: 'POST' });
      await fetchDashboard(true);
    } finally {
      triggerBtn.disabled = false;
    }
  });
}

// 4. Nạp dữ liệu Dashboard
async function fetchDashboard(forceRender = false) {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

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

  typeSelect.value = sys.chaos_type;

  if (sys.chaos_mode) {
    btn.classList.add('active');
    label.innerText = 'Dừng Mô Phỏng';
    indicator.className = 'status-indicator danger';
  } else {
    btn.classList.remove('active');
    label.innerText = 'Giả Lập Lỗi';
    indicator.className = 'status-indicator';
  }
}

function updateKPIs(data) {
  const total = data.assets.total || 0;
  const healthy = data.assets.healthy || 0;
  const degraded = data.assets.degraded || 0;
  const openCount = (data.activeIncidents || []).length;

  document.getElementById('kpiTotalAssets').innerText = total;
  document.getElementById('kpiOpenIncidents').innerText = openCount;

  const healthPct = total > 0 ? Math.round((healthy / total) * 100) : 100;
  const kpiHealthEl = document.getElementById('kpiHealthStatus');
  const kpiHealthSub = document.getElementById('kpiHealthDetail');

  kpiHealthEl.innerText = `${healthPct}%`;
  if (healthPct === 100) {
    kpiHealthEl.className = 'metric-value status-text-healthy';
    kpiHealthSub.innerText = 'Toàn bộ dịch vụ sẵn sàng';
  } else {
    kpiHealthEl.className = 'metric-value status-text-critical';
    kpiHealthSub.innerText = `${degraded} dịch vụ bị gián đoạn liên đới`;
  }

  // Update Business Health Shield (Dành cho Quản lý & Chủ shop)
  const shield = document.getElementById('businessShield');
  const shieldTitle = document.getElementById('shieldTitle');
  const shieldDesc = document.getElementById('shieldDesc');
  const shieldIconBadge = document.getElementById('shieldIconBadge');
  const pillWeb = document.getElementById('pillWeb');
  const pillMail = document.getElementById('pillMail');
  const pillSsl = document.getElementById('pillSsl');

  if (shield) {
    if (openCount === 0) {
      shield.className = 'business-shield-card healthy';
      shieldIconBadge.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;
      shieldTitle.innerText = 'Hạ Tầng Doanh Nghiệp Đang Hoạt Động An Toàn 100%';
      shieldDesc.innerText = 'Website bán hàng, hòm thư nhận đơn và bảo mật số của bạn đang mở cửa 24/7 đón khách hàng ổn định.';
      if (pillWeb) {
        pillWeb.className = 'quick-pill ok';
        pillWeb.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Web Bán Hàng: Hoạt động</span>`;
      }
      if (pillMail) {
        pillMail.className = 'quick-pill ok';
        pillMail.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Email Công Ty: Thông suốt</span>`;
      }
      if (pillSsl) {
        pillSsl.className = 'quick-pill ok';
        pillSsl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Bảo Mật SSL: An toàn</span>`;
      }
    } else {
      const inc = data.activeIncidents[0];
      shield.className = 'business-shield-card critical';
      shieldIconBadge.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      shieldTitle.innerText = `Cảnh Báo: Phát Hiện Gián Đoạn Kéo Theo Sập Liên Đới!`;
      shieldDesc.innerText = `${inc ? inc.title : 'Sự cố kết nối nghiêm trọng'}. Website và Hộp thư nhận đơn có thể đang bị gián đoạn. Đã chuẩn bị sẵn phiếu hỗ trợ gửi Mắt Bão.`;
      if (pillWeb) {
        pillWeb.className = 'quick-pill fail';
        pillWeb.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Web Bán Hàng: Gián đoạn</span>`;
      }
      if (pillMail) {
        pillMail.className = 'quick-pill fail';
        pillMail.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Email Công Ty: Mất kết nối</span>`;
      }
      if (pillSsl) {
        pillSsl.className = 'quick-pill fail';
        pillSsl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Bảo Mật SSL: Cảnh báo</span>`;
      }
    }
  }

  // Incident active banner
  const alertBar = document.getElementById('activeIncidentAlert');
  const navBadge = document.getElementById('navIncidentBadge');

  if (openCount > 0) {
    alertBar.style.display = 'block';
    navBadge.style.display = 'inline-block';
    navBadge.innerText = openCount;

    const inc = data.activeIncidents[0];
    document.getElementById('alertTitle').innerText = inc.title;
    document.getElementById('alertDesc').innerText = `Nguyên nhân: ${inc.root_cause_type} · Đơn vị tiếp nhận hỗ trợ: ${inc.responsible_provider} · Đã soạn xong Ticket`;
  } else {
    alertBar.style.display = 'none';
    navBadge.style.display = 'none';
  }
}

// 5. Render Bản đồ phụ thuộc (Dependency Topology)
async function renderTopology(data) {
  const treeContainer = document.getElementById('topologyTree');
  const mapBadge = document.getElementById('mapStatusBadge');
  const mapText = document.getElementById('mapStatusText');

  if (!allAssets.length) {
    const res = await fetch('/api/assets');
    allAssets = await res.json();
  }

  const rootAssets = allAssets.filter(a => !a.parent_asset_id);
  const isHealthy = allAssets.every(a => a.status === 'healthy');

  if (isHealthy) {
    mapBadge.className = 'badge-status badge-healthy';
    mapText.innerText = 'Hạ Tầng Ổn Định';
  } else {
    mapBadge.className = 'badge-status badge-down';
    mapText.innerText = 'Phát Hiện Sập Liên Đới';
  }

  let html = '';
  rootAssets.forEach(root => {
    const children = allAssets.filter(a => a.parent_asset_id === root.id);

    html += `
      <div class="topology-node-root">
        <div class="node-main">
          <div class="node-icon-box">
            ${ICONS.globe}
          </div>
          <div class="node-info">
            <h4>
              ${escapeHtml(root.name)} 
              <span class="node-role-badge">Tên Miền Cửa Ngõ</span>
              <span class="node-provider-tag">${escapeHtml(root.provider_name)}</span>
            </h4>
            <div class="node-meta">Địa chỉ: <code>${escapeHtml(root.target)}</code> · Cấu hình chuẩn: ${escapeHtml(root.baseline_value || 'Chưa thiết lập')}</div>
          </div>
        </div>
        <div>
          ${renderBadge(root.status)}
        </div>
      </div>
      <div class="topology-children-group">
    `;

    children.forEach(child => {
      let icon = ICONS.website;
      let roleLabel = 'Website Giới Thiệu';
      if (child.type === 'email') { icon = ICONS.email; roleLabel = 'Hộp Thư Công Ty'; }
      if (child.type === 'ssl') { icon = ICONS.ssl; roleLabel = 'Khóa Bảo Mật SSL'; }
      if (child.type === 'hosting') { icon = ICONS.hosting; roleLabel = 'Máy Chủ Cloud'; }
      if (child.type === 'website') { icon = ICONS.website; roleLabel = 'Website Bán Hàng'; }

      html += `
        <div class="topology-node-child">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="color:var(--text-tertiary); display:flex;">${icon}</span>
            <div>
              <div style="font-weight:600; font-size:13.5px; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                ${escapeHtml(child.name)}
                <span class="node-role-badge">${roleLabel}</span>
              </div>
              <div style="font-size:12px; color:var(--text-tertiary); font-family:var(--font-mono); margin-top:2px;">
                Nhà cung cấp: ${escapeHtml(child.provider_name)} · <code>${escapeHtml(child.target)}</code>
              </div>
            </div>
          </div>
          <div>
            ${renderBadge(child.status)}
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  treeContainer.innerHTML = html;
}

function renderBadge(status) {
  if (status === 'healthy') {
    return `<span class="badge-status badge-healthy"><span class="badge-dot"></span>Hoạt động tốt</span>`;
  }
  if (status === 'down') {
    return `<span class="badge-status badge-down"><span class="badge-dot"></span>Mất kết nối</span>`;
  }
  return `<span class="badge-status badge-degraded"><span class="badge-dot"></span>Chập chờn</span>`;
}

// 6. Render Luồng kiểm tra Live Stream
function renderProbeTable(probes) {
  const tbody = document.getElementById('probeTableBody');
  if (!probes || !probes.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary); padding:20px;">Đang khởi tạo luồng kiểm tra thời gian thực...</td></tr>`;
    return;
  }

  tbody.innerHTML = probes.map(p => {
    const isOk = p.status === 'healthy';
    const date = new Date(p.created_at);
    const time = date.toLocaleTimeString();

    return `
      <tr>
        <td class="code-cell" style="color:var(--text-tertiary);">${time}</td>
        <td><strong>${escapeHtml(p.resolver)}</strong></td>
        <td><code class="code-cell">${escapeHtml(p.asset_name)}</code></td>
        <td><span class="node-provider-tag">${escapeHtml(p.monitor_type)}</span></td>
        <td class="code-cell" style="color: ${isOk ? 'var(--status-emerald)' : 'var(--status-rose)'}; font-weight:700;">${escapeHtml(p.response_code)}</td>
        <td class="code-cell">${p.latency_ms}ms</td>
        <td>
          <span class="badge-status ${isOk ? 'badge-healthy' : 'badge-down'}">
            <span class="badge-dot"></span>${isOk ? 'Hợp lệ' : 'Lỗi'}
          </span>
        </td>
        <td class="code-cell" style="font-size:11.5px; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.raw_log)}">
          ${escapeHtml(p.raw_log)}
        </td>
      </tr>
    `;
  }).join('');
}

// 7. Trung tâm Sự cố & Cầu nối Ticket
async function renderIncidentView(activeIncidents) {
  const container = document.getElementById('incidentViewContainer');
  const res = await fetch('/api/incidents');
  const allIncidents = await res.json();

  if (!allIncidents.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 20px; color:var(--text-tertiary);">
        <div style="margin-bottom:12px; display:inline-flex; padding:14px; border-radius:50%; background:var(--status-emerald-bg); color:var(--status-emerald);">
          ${ICONS.check}
        </div>
        <h4 style="color:var(--text-primary); font-size:16px;">Hạ Tầng Đang Vận Hành An Toàn — Không Có Sự Cố</h4>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Tất cả dịch vụ và hòm thư đều đang hoạt động tốt. Bạn có thể bấm nút "Giả Lập Lỗi" ở góc trên để kiểm chứng quy trình tự động.</p>
      </div>
    `;
    return;
  }

  const latest = allIncidents[0];
  const isResolved = latest.status === 'Resolved' || latest.status === 'Closed';

  let stateSteps = `
    <div class="incident-lifecycle-bar">
      <div class="step-item done">${ICONS.check} 1. Tự Động Phát Hiện</div>
      <div class="step-divider">/</div>
      <div class="step-item ${latest.status !== 'Suspected' ? 'done' : 'active'}">${latest.status !== 'Suspected' ? ICONS.check : '●'} 2. Cô Lập & Tính Tác Động</div>
      <div class="step-divider">/</div>
      <div class="step-item ${latest.ticket_status === 'sent' ? 'done' : 'active'}">${latest.ticket_status === 'sent' ? ICONS.check : '●'} 3. Soạn & Gửi Ticket Mắt Bão</div>
      <div class="step-divider">/</div>
      <div class="step-item ${isResolved ? 'done' : ''}">${isResolved ? ICONS.check : '○'} 4. Xác Thực Phục Hồi (3 Lượt)</div>
      <div class="step-divider">/</div>
      <div class="step-item ${latest.status === 'Closed' ? 'done' : ''}">${latest.status === 'Closed' ? ICONS.check : '○'} 5. Đóng & Xuất Báo Cáo</div>
    </div>
  `;

  let ticketActions = '';
  if (latest.ticket_status === 'sent') {
    ticketActions = `
      <div class="ticket-status-card">
        <span style="color:var(--status-emerald);">${ICONS.check}</span>
        <div>
          <div style="font-weight:700; color:var(--status-emerald-text); font-size:13.5px;">Phiếu Hỗ Trợ Đã Được Gửi Thành Công Sang Kỹ Thuật Mắt Bão</div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Mã phiếu hỗ trợ: <code>${latest.external_ticket_id}</code> · Kỹ sư trực ban đang tiếp nhận xử lý theo cam kết SLA.</div>
        </div>
      </div>
    `;
  } else {
    ticketActions = `
      <button class="btn btn-primary" onclick="sendTicket(${latest.id})">
        ${ICONS.send}
        <span>Duyệt & Gửi Phiếu Hỗ Trợ Kỹ Thuật Cho Mắt Bão</span>
      </button>
      <span style="font-size:12.5px; color:var(--text-tertiary); margin-left:12px;">(Hệ thống tự động liên kết đúng phòng ban phụ trách: ${escapeHtml(latest.responsible_provider)})</span>
    `;
  }

  let reportBtn = '';
  if (latest.post_incident_report) {
    reportBtn = `
      <button class="btn btn-sm btn-secondary" onclick="viewReport(${latest.id})">
        ${ICONS.fileText}
        <span>Xem Báo Cáo Phục Hồi</span>
      </button>
    `;
  }

  // Tóm tắt dễ hiểu cho chủ doanh nghiệp non-tech
  const businessSummaryBox = `
    <div style="background:var(--bg-subtle); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:16px 20px;">
      <h5 style="font-size:14px; font-weight:700; color:var(--text-primary); margin-bottom:6px; display:flex; align-items:center; gap:8px;">
        <span style="color:var(--status-rose);">${ICONS.alert}</span>
        Tóm Tắt Tác Động Thực Tế (Dành Cho Chủ Doanh Nghiệp & Quản Lý)
      </h5>
      <p style="font-size:13px; color:var(--text-secondary); line-height:1.5;">
        ${latest.business_impact || 'Khách hàng có thể không truy cập được website mua hàng và các email gửi đến công ty bị chậm trễ.'}
      </p>
      <div style="display:flex; align-items:center; gap:20px; margin-top:10px; font-size:12px; color:var(--text-tertiary); flex-wrap:wrap;">
        <span>Đơn vị chịu trách nhiệm: <strong style="color:var(--accent-primary);">${escapeHtml(latest.responsible_provider)}</strong></span>
        <span>Thời điểm phát hiện: <strong>${new Date(latest.first_detected_at).toLocaleString()}</strong></span>
        <span>Hỗ trợ khẩn cấp: <strong>1900 1830 (Mắt Bão 24/7)</strong></span>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="incident-container">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="badge-status ${isResolved ? 'badge-healthy' : 'badge-down'}">
              <span class="badge-dot"></span>Mức độ: ${latest.severity}
            </span>
            <span class="node-provider-tag">Trạng thái: ${latest.status}</span>
          </div>
          <h4 style="margin-top:8px; font-size:16px; font-weight:700; color:var(--text-primary);">${escapeHtml(latest.title)}</h4>
          <p style="font-size:12.5px; color:var(--text-tertiary); margin-top:2px;">
            Mã định danh sự cố: <code>#INC-${latest.id}</code> · Tác động liên đới: Website, Email giao dịch
          </p>
        </div>
        <div>
          ${reportBtn}
        </div>
      </div>

      ${businessSummaryBox}

      ${stateSteps}

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--accent-primary); letter-spacing:0.04em;">Nội Dung Phiếu Hỗ Trợ Đã Chuẩn Bị Sẵn (Draft Ticket Composer)</span>
        </div>
        <div class="ticket-composer-box">${escapeHtml(latest.ticket_body)}</div>
        <div style="margin-top: 16px;">
          ${ticketActions}
        </div>
      </div>
    </div>
  `;
}

async function sendTicket(incidentId) {
  try {
    const res = await fetch(`/api/incidents/${incidentId}/send-ticket`, { method: 'POST' });
    const data = await res.json();
    fetchDashboard(true);
  } catch (err) {
    console.error(err);
  }
}

async function viewReport(incidentId) {
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

// 8. Sổ tay ứng cứu khẩn cấp (Playbook)
async function loadPlaybook() {
  const container = document.getElementById('playbookActionList');
  try {
    const res = await fetch('/api/playbook/1');
    const playbook = await res.json();

    container.innerHTML = playbook.actions.map(act => {
      let actionBtn = '';
      if (act.id === 'failover_page') {
        actionBtn = `
          <button class="btn btn-sm btn-secondary" onclick="toggleFailover()">
            <span>${playbook.failover_active ? 'Tắt Trang Bảo Trì' : 'Bật Trang Thông Báo Bảo Trì'}</span>
          </button>
        `;
      } else if (act.id === 'dns_snapshot_rollback') {
        actionBtn = `
          <button class="btn btn-sm btn-secondary" onclick="rollbackDNS()">
            <span>Khôi Phục Bản Ghi DNS Baseline</span>
          </button>
        `;
      }

      return `
        <div class="playbook-card">
          <div>
            <div class="playbook-header">
              <h4>${escapeHtml(act.title)}</h4>
              <span class="badge-status ${act.status === 'ACTIVE' || act.status === 'DISPATCHED' ? 'badge-healthy' : 'badge-degraded'}">
                <span class="badge-dot"></span>${act.status}
              </span>
            </div>
            <p>${escapeHtml(act.description)}</p>
          </div>
          <div style="margin-top:12px;">
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
  try {
    await fetch('/api/playbook/toggle-failover', { method: 'POST' });
    loadPlaybook();
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

async function rollbackDNS() {
  if (!confirm('Xác nhận khôi phục cấu hình bản ghi DNS về Baseline an toàn gần nhất?')) return;
  try {
    await fetch('/api/playbook/rollback-dns', { method: 'POST' });
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

// 9. Quản lý Tài sản số (Assets CRUD CSDL Thật)
async function loadAssets() {
  const tbody = document.getElementById('assetTableBody');
  const parentSelect = document.getElementById('assetParentId');

  try {
    const res = await fetch('/api/assets');
    allAssets = await res.json();

    parentSelect.innerHTML = `<option value="">-- Dịch vụ gốc (Không phụ thuộc dịch vụ khác) --</option>` +
      allAssets.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${a.type})</option>`).join('');

    tbody.innerHTML = allAssets.map(a => `
      <tr>
        <td class="code-cell" style="color:var(--text-tertiary);">#${a.id}</td>
        <td><strong>${escapeHtml(a.name)}</strong></td>
        <td><span class="node-provider-tag">${a.type}</span></td>
        <td class="code-cell"><code>${escapeHtml(a.target)}</code></td>
        <td>${escapeHtml(a.provider_name)}</td>
        <td style="color:var(--text-secondary); font-size:12px;">${a.parent_name ? escapeHtml(a.parent_name) : '<span style="color:var(--text-tertiary);">Dịch vụ Gốc</span>'}</td>
        <td class="code-cell" style="font-size:11px; color:var(--text-tertiary);">${escapeHtml(a.baseline_value || 'N/A')}</td>
        <td>${renderBadge(a.status)}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-secondary" onclick="openEditAssetModal(${a.id})" style="padding:3px 8px;">Sửa</button>
          <button class="btn btn-sm btn-danger-subtle" onclick="deleteAsset(${a.id})" style="padding:3px 8px; margin-left:4px;">Xóa</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function openAddAssetModal() {
  document.getElementById('modalTitle').innerText = 'Thêm Dịch Vụ Mới';
  document.getElementById('assetId').value = '';
  document.getElementById('assetForm').reset();
  document.getElementById('assetModal').style.display = 'flex';
}

function openEditAssetModal(id) {
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

  document.getElementById('assetModal').style.display = 'flex';
}

function closeAssetModal() {
  document.getElementById('assetModal').style.display = 'none';
}

async function handleSaveAsset(e) {
  e.preventDefault();
  const id = document.getElementById('assetId').value;
  const payload = {
    name: document.getElementById('assetName').value,
    type: document.getElementById('assetType').value,
    target: document.getElementById('assetTarget').value,
    provider_name: document.getElementById('assetProvider').value,
    parent_asset_id: document.getElementById('assetParentId').value ? parseInt(document.getElementById('assetParentId').value) : null,
    baseline_value: document.getElementById('assetBaseline').value
  };

  try {
    if (id) {
      await fetch(`/api/assets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  if (!confirm(`Xác nhận xóa dịch vụ #${id} khỏi cơ sở dữ liệu?`)) return;
  try {
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    loadAssets();
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

// 10. Nhật ký Kiểm toán
async function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  try {
    const res = await fetch('/api/audit-logs');
    const logs = await res.json();

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="code-cell" style="color:var(--text-tertiary);">#${l.id}</td>
        <td class="code-cell" style="color:var(--text-tertiary);">${new Date(l.created_at).toLocaleString()}</td>
        <td><span class="node-provider-tag">${escapeHtml(l.action)}</span></td>
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
