// --- MẮT BÃO SERVICEWATCH CLIENT APP ---

let currentChaosMode = false;
let currentChaosType = 'dns_servfail';
let allAssets = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initChaosControls();
  fetchDashboard();
  loadAssets();
  loadPlaybook();
  loadAuditLogs();

  // Polling chu kỳ 3.5 giây để cập nhật trạng thái thời gian thực
  setInterval(() => {
    fetchDashboard(false);
  }, 3500);
});

// 1. Quản lý chuyển Tab
function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      switchTab(targetId);
    });
  });
}

function switchTab(targetId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const activeTabBtn = document.querySelector(`.nav-tab[data-tab="${targetId}"]`);
  const activePane = document.getElementById(targetId);

  if (activeTabBtn) activeTabBtn.classList.add('active');
  if (activePane) activePane.classList.add('active');

  // Nạp dữ liệu đặc thù của tab
  if (targetId === 'tab-assets') loadAssets();
  if (targetId === 'tab-playbook') loadPlaybook();
  if (targetId === 'tab-logs') loadAuditLogs();
}

// 2. Chế độ giả lập sự cố (Chaos Mode)
function initChaosControls() {
  const toggleBtn = document.getElementById('toggleChaosBtn');
  const typeSelect = document.getElementById('chaosTypeSelect');
  const triggerBtn = document.getElementById('triggerProbeBtn');

  toggleBtn.addEventListener('click', async () => {
    const selectedType = typeSelect.value;
    try {
      const res = await fetch('/api/chaos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chaos_type: selectedType })
      });
      const data = await res.json();
      fetchDashboard(true);
    } catch (err) {
      console.error('Lỗi khi toggle chaos:', err);
    }
  });

  triggerBtn.addEventListener('click', async () => {
    triggerBtn.disabled = true;
    triggerBtn.innerText = '⏳ Đang quét...';
    try {
      await fetch('/api/probes/run', { method: 'POST' });
      await fetchDashboard(true);
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.innerText = '🔄 Quét Ngay';
    }
  });
}

// 3. Fetch Dashboard & State Machine
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
  const btnText = document.getElementById('chaosBtnText');
  const pulse = document.getElementById('chaosPulse');
  const typeSelect = document.getElementById('chaosTypeSelect');

  typeSelect.value = sys.chaos_type;

  if (sys.chaos_mode) {
    btn.classList.add('active');
    btnText.innerText = '🟢 Dừng Lỗi -> Chờ Phục Hồi';
    pulse.classList.add('active-chaos');
  } else {
    btn.classList.remove('active');
    btnText.innerText = '⚡ Kích Hoạt Giả Lập Lỗi';
    pulse.classList.remove('active-chaos');
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
    kpiHealthEl.className = 'kpi-value text-success';
    kpiHealthSub.innerText = 'Tất cả dịch vụ hoạt động bình thường';
  } else {
    kpiHealthEl.className = 'kpi-value text-danger';
    kpiHealthSub.innerText = `${degraded} tài sản đang bị ảnh hưởng liên đới`;
  }

  // Incident alert bar
  const alertBar = document.getElementById('activeIncidentAlert');
  const badge = document.getElementById('incidentCountBadge');

  if (openCount > 0) {
    alertBar.style.display = 'flex';
    badge.style.display = 'inline-block';
    badge.innerText = openCount;
    const inc = data.activeIncidents[0];
    document.getElementById('alertTitle').innerText = inc.title;
    document.getElementById('alertDesc').innerText = `Nguyên nhân: ${inc.root_cause_type} · Đơn vị chịu trách nhiệm: ${inc.responsible_provider}`;
  } else {
    alertBar.style.display = 'none';
    badge.style.display = 'none';
  }
}

// 4. Render Bản đồ Phụ thuộc (Dependency Map)
async function renderTopology(data) {
  const treeContainer = document.getElementById('topologyTree');
  const mapPill = document.getElementById('mapPill');

  if (!allAssets.length) {
    const res = await fetch('/api/assets');
    allAssets = await res.json();
  }

  const rootAssets = allAssets.filter(a => !a.parent_asset_id);
  const isHealthy = allAssets.every(a => a.status === 'healthy');

  if (isHealthy) {
    mapPill.className = 'status-pill status-healthy';
    mapPill.innerText = 'Hạ tầng Ổn định';
  } else {
    mapPill.className = 'status-pill status-down';
    mapPill.innerText = 'Phát hiện Sự cố Liên đới';
  }

  let html = '';
  rootAssets.forEach(root => {
    const children = allAssets.filter(a => a.parent_asset_id === root.id);
    html += `
      <div class="tree-root-card">
        <div class="tree-root-info">
          <div class="asset-icon">🌐</div>
          <div class="asset-details">
            <h4>${root.name} <span class="badge badge-sub">${root.provider_name}</span></h4>
            <p>Target: <code>${root.target}</code> · Baseline: ${root.baseline_value || 'Chưa cấu hình'}</p>
          </div>
        </div>
        <div>
          ${renderStatusBadge(root.status)}
        </div>
      </div>
      <div class="tree-children">
    `;

    children.forEach(child => {
      let icon = '💻';
      if (child.type === 'email') icon = '✉️';
      if (child.type === 'ssl') icon = '🔒';
      if (child.type === 'hosting') icon = '☁️';

      html += `
        <div class="tree-child-card">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:16px;">${icon}</span>
            <div>
              <strong style="color:#fff; font-size:13px;">${child.name}</strong>
              <div style="font-size:11px; color:#64748b;">${child.provider_name} · <code>${child.target}</code></div>
            </div>
          </div>
          <div>
            ${renderStatusBadge(child.status)}
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  treeContainer.innerHTML = html;
}

function renderStatusBadge(status) {
  if (status === 'healthy') {
    return `<span class="status-pill status-healthy">● Healthy</span>`;
  }
  if (status === 'down') {
    return `<span class="status-pill status-down">▲ Unreachable</span>`;
  }
  return `<span class="status-pill status-degraded">● Degraded</span>`;
}

// 5. Render Live Probes
function renderProbeTable(probes) {
  const tbody = document.getElementById('probeTableBody');
  if (!probes || !probes.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b;">Chưa có dữ liệu kiểm tra.</td></tr>`;
    return;
  }

  tbody.innerHTML = probes.map(p => {
    const time = new Date(p.checked_at).toLocaleTimeString();
    const isOk = p.status === 'SUCCESS';
    return `
      <tr>
        <td class="mono" style="color:#94a3b8;">${time}</td>
        <td><strong>${p.resolver}</strong></td>
        <td><code>${p.asset_name}</code></td>
        <td><span class="badge badge-sub">${p.monitor_type}</span></td>
        <td class="mono" style="color: ${isOk ? '#00e5bf' : '#ff4d4d'}; font-weight:600;">${p.response_code}</td>
        <td class="mono">${p.latency_ms}ms</td>
        <td>${isOk ? '<span class="status-pill status-healthy">PASS</span>' : '<span class="status-pill status-down">FAIL</span>'}</td>
        <td class="mono" style="font-size:11px; color:#cbd5e1; max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(p.raw_log)}">
          ${escapeHtml(p.raw_log)}
        </td>
      </tr>
    `;
  }).join('');
}

// 6. Incident View & Ticket Bridge
async function renderIncidentView(activeIncidents) {
  const container = document.getElementById('incidentViewContainer');
  const res = await fetch('/api/incidents');
  const allIncidents = await res.json();

  if (!allIncidents.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color:#94a3b8;">
        <div style="font-size:48px; margin-bottom:12px;">✅</div>
        <h3>Không có sự cố nào được ghi nhận</h3>
        <p style="font-size:13px; color:#64748b; margin-top:6px;">Hệ thống đang hoạt động ổn định. Bạn có thể sử dụng thanh "Mô phỏng sự cố" ở trên cùng để kiểm thử.</p>
      </div>
    `;
    return;
  }

  const latest = allIncidents[0];
  const isResolved = latest.status === 'Resolved' || latest.status === 'Closed';

  let stateSteps = `
    <div class="state-breadcrumbs">
      <div class="step-node done">1. Phát hiện (Detected)</div>
      <div class="step-arrow">➔</div>
      <div class="step-node ${latest.status !== 'Suspected' ? 'done' : 'current'}">2. Xác nhận (Confirmed)</div>
      <div class="step-arrow">➔</div>
      <div class="step-node ${latest.ticket_status === 'sent' ? 'done' : 'current'}">3. Soạn & Gửi Ticket</div>
      <div class="step-arrow">➔</div>
      <div class="step-node ${isResolved ? 'done' : ''}">4. Xác minh Phục hồi (3 Passes)</div>
      <div class="step-arrow">➔</div>
      <div class="step-node ${latest.status === 'Closed' ? 'done' : ''}">5. Đóng Sự cố</div>
    </div>
  `;

  let ticketActions = '';
  if (latest.ticket_status === 'sent') {
    ticketActions = `
      <div style="display:flex; align-items:center; gap:12px; background:rgba(0, 229, 191, 0.1); border:1px solid rgba(0, 229, 191, 0.3); padding:10px 16px; border-radius:8px;">
        <span style="font-size:20px;">📬</span>
        <div>
          <strong style="color:#00e5bf;">Đã gửi Ticket thành công tới Mắt Bão Support</strong>
          <div style="font-size:12px; color:#cbd5e1;">Mã phiếu yêu cầu: <code>${latest.external_ticket_id}</code> · Trạng thái: Đang chờ phản hồi SLA</div>
        </div>
      </div>
    `;
  } else {
    ticketActions = `
      <button class="btn btn-primary" onclick="sendTicket(${latest.id})">
        🚀 Phê Duyệt & Gửi Ticket Khẩn Cấp Tới Mắt Bão
      </button>
      <span style="font-size:12px; color:#94a3b8; margin-left:12px;">(Định tuyến chính xác tới đội ngũ chịu trách nhiệm)</span>
    `;
  }

  let reportBtn = '';
  if (latest.post_incident_report) {
    reportBtn = `
      <button class="btn btn-secondary" onclick="viewReport(${latest.id})">
        📋 Xem Báo Cáo Hậu Sự Cố (Post-mortem Report)
      </button>
    `;
  }

  container.innerHTML = `
    <div class="incident-card">
      <div class="incident-card-header">
        <div>
          <span class="status-pill status-${isResolved ? 'healthy' : 'down'}">${latest.severity.toUpperCase()}</span>
          <span class="status-pill" style="margin-left:6px; background:rgba(255,255,255,0.08);">${latest.status}</span>
          <h3 style="margin-top:8px; font-size:18px;">${latest.title}</h3>
          <p style="font-size:12px; color:#94a3b8;">Phát hiện: ${new Date(latest.first_detected_at).toLocaleString()} · Đơn vị chịu trách nhiệm: <strong>${latest.responsible_provider}</strong></p>
        </div>
        <div style="text-align:right;">
          ${reportBtn}
        </div>
      </div>

      ${stateSteps}

      <div style="margin: 16px 0;">
        <h4 style="font-size:13px; color:#ff9142; margin-bottom:6px;">BẢN THẢO TICKET TỰ ĐỘNG (DRAFT TICKET COMPOSER):</h4>
        <div class="ticket-box">${escapeHtml(latest.ticket_body)}</div>
        <div style="margin-top: 12px;">
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
    alert(`🎉 ${data.message}`);
    fetchDashboard(true);
  } catch (err) {
    console.error(err);
    alert('Lỗi khi gửi ticket.');
  }
}

async function viewReport(incidentId) {
  try {
    const res = await fetch(`/api/incidents/${incidentId}`);
    const incident = await res.json();
    document.getElementById('reportBody').innerHTML = `<pre style="font-family:inherit; white-space:pre-wrap;">${escapeHtml(incident.post_incident_report)}</pre>`;
    document.getElementById('reportModal').style.display = 'flex';
  } catch (err) {
    console.error(err);
  }
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
}

// 7. Sổ tay ứng cứu khẩn cấp (Playbook)
async function loadPlaybook() {
  const container = document.getElementById('playbookActionList');
  try {
    const res = await fetch('/api/playbook/1');
    const playbook = await res.json();

    container.innerHTML = playbook.actions.map(act => {
      let actionBtn = '';
      if (act.id === 'failover_page') {
        actionBtn = `
          <button class="btn btn-warning btn-sm" onclick="toggleFailover()">
            ${playbook.failover_active ? '🔴 Tắt Trang Bảo Trì' : '⚡ Kích Hoạt Trang Bảo Trì Tĩnh'}
          </button>
        `;
      } else if (act.id === 'dns_snapshot_rollback') {
        actionBtn = `
          <button class="btn btn-secondary btn-sm" onclick="rollbackDNS()">
            ⏪ Khôi Phục DNS Baseline
          </button>
        `;
      }

      return `
        <div class="playbook-card">
          <div class="playbook-card-top">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="status-pill status-${act.status === 'ACTIVE' || act.status === 'DISPATCHED' ? 'healthy' : 'degraded'}">${act.status}</span>
            </div>
            <h3>${act.title}</h3>
            <p>${act.description}</p>
          </div>
          <div>
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
    const res = await fetch('/api/playbook/toggle-failover', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    loadPlaybook();
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

async function rollbackDNS() {
  if (!confirm('Bạn có chắc muốn khôi phục lại toàn bộ bản ghi DNS về Baseline an toàn gần nhất không?')) return;
  try {
    const res = await fetch('/api/playbook/rollback-dns', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
  }
}

// 8. CRUD Tài sản (Assets Table)
async function loadAssets() {
  const tbody = document.getElementById('assetTableBody');
  const parentSelect = document.getElementById('assetParentId');

  try {
    const res = await fetch('/api/assets');
    allAssets = await res.json();

    parentSelect.innerHTML = `<option value="">-- Không có (Tài sản gốc) --</option>` +
      allAssets.map(a => `<option value="${a.id}">${a.name} (${a.type})</option>`).join('');

    tbody.innerHTML = allAssets.map(a => `
      <tr>
        <td class="mono">#${a.id}</td>
        <td><strong>${escapeHtml(a.name)}</strong></td>
        <td><span class="badge badge-sub">${a.type}</span></td>
        <td class="mono"><code>${escapeHtml(a.target)}</code></td>
        <td>${escapeHtml(a.provider_name)}</td>
        <td>${a.parent_name ? escapeHtml(a.parent_name) : '<span style="color:#64748b;">(Gốc)</span>'}</td>
        <td style="font-size:11px; color:#94a3b8;">${escapeHtml(a.baseline_value || 'N/A')}</td>
        <td>${renderStatusBadge(a.status)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openEditAssetModal(${a.id})">Sửa</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAsset(${a.id})">Xóa</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function openAddAssetModal() {
  document.getElementById('modalTitle').innerText = 'Thêm Tài Sản Mới';
  document.getElementById('assetId').value = '';
  document.getElementById('assetForm').reset();
  document.getElementById('assetModal').style.display = 'flex';
}

function openEditAssetModal(id) {
  const asset = allAssets.find(a => a.id === id);
  if (!asset) return;

  document.getElementById('modalTitle').innerText = `Chỉnh Sửa Tài Sản #${id}`;
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
    alert('Lỗi khi lưu tài sản.');
  }
}

async function deleteAsset(id) {
  if (!confirm(`Bạn có chắc chắn muốn xóa tài sản #${id} khỏi CSDL không?`)) return;
  try {
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    loadAssets();
    fetchDashboard(true);
    loadAuditLogs();
  } catch (err) {
    console.error(err);
    alert('Lỗi khi xóa tài sản.');
  }
}

// 9. Audit Logs
async function loadAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  try {
    const res = await fetch('/api/audit-logs');
    const logs = await res.json();

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="mono">#${l.id}</td>
        <td class="mono" style="color:#94a3b8;">${new Date(l.created_at).toLocaleString()}</td>
        <td><span class="badge badge-sub">${escapeHtml(l.action)}</span></td>
        <td><strong>${escapeHtml(l.actor)}</strong></td>
        <td>${escapeHtml(l.details)}</td>
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
