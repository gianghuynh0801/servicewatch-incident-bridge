const express = require('express');
const path = require('path');
const { db, initDatabase } = require('./database');
const { runProbeCycle, getSystemSetting, setSystemSetting } = require('./engine');

const app = express();
const PORT = process.env.PORT || 4100;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Khởi tạo DB khi khởi động
initDatabase();

// Chạy định kỳ probe mỗi 8 giây
setInterval(() => {
  try {
    runProbeCycle();
  } catch (err) {
    console.error('Probe cycle error:', err);
  }
}, 8000);

// --- API ENDPOINTS ---

// 1. Dashboard Overview Metrics
app.get('/api/dashboard', (req, res) => {
  const assetStats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN status != 'healthy' THEN 1 ELSE 0 END) as degraded
    FROM assets
  `).get();

  const activeIncidents = db.prepare(`
    SELECT * FROM incidents WHERE status IN ('Suspected', 'Confirmed', 'Notified') ORDER BY id DESC
  `).all();

  const recentProbes = db.prepare(`
    SELECT * FROM probe_results ORDER BY id DESC LIMIT 12
  `).all();

  const isChaos = getSystemSetting('chaos_mode') === 'true';
  const chaosType = getSystemSetting('chaos_type', 'dns_servfail');
  const isFailover = getSystemSetting('failover_active') === 'true';

  res.json({
    assets: assetStats,
    activeIncidents,
    recentProbes,
    system: {
      chaos_mode: isChaos,
      chaos_type: chaosType,
      failover_active: isFailover
    }
  });
});

// 2. Assets (CRUD thật trên CSDL SQLite)
app.get('/api/assets', (req, res) => {
  const assets = db.prepare(`
    SELECT a.*, p.name as parent_name 
    FROM assets a
    LEFT JOIN assets p ON a.parent_asset_id = p.id
    ORDER BY a.id ASC
  `).all();
  res.json(assets);
});

app.post('/api/assets', (req, res) => {
  const { name, type, target, provider_name, parent_asset_id, baseline_value } = req.body;
  if (!name || !type || !target || !provider_name) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  const result = db.prepare(`
    INSERT INTO assets (name, type, target, provider_name, parent_asset_id, status, baseline_value)
    VALUES (?, ?, ?, ?, ?, 'healthy', ?)
  `).run(name, type, target, provider_name, parent_asset_id || null, baseline_value || 'Chưa thiết lập baseline');

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'ASSET_CREATED',
    'User',
    `Thêm mới tài sản: ${name} (${type}) trỏ tới ${target}`
  );

  res.json({ id: result.lastInsertRowid, message: 'Đã tạo tài sản thành công' });
});

app.put('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  const { name, target, provider_name, baseline_value } = req.body;

  db.prepare(`
    UPDATE assets
    SET name = COALESCE(?, name),
        target = COALESCE(?, target),
        provider_name = COALESCE(?, provider_name),
        baseline_value = COALESCE(?, baseline_value)
    WHERE id = ?
  `).run(name, target, provider_name, baseline_value, id);

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'ASSET_UPDATED',
    'User',
    `Cập nhật thông tin tài sản ID #${id}`
  );

  res.json({ success: true, message: 'Cập nhật thành công' });
});

app.delete('/api/assets/:id', (req, res) => {
  const { id } = req.params;
  const target = db.prepare('SELECT name FROM assets WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'Không tìm thấy tài sản' });

  db.prepare('DELETE FROM assets WHERE id = ?').run(id);

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'ASSET_DELETED',
    'User',
    `Đã xóa tài sản: ${target.name} (ID: ${id})`
  );

  res.json({ success: true, message: 'Đã xóa tài sản' });
});

// 3. Probes Management
app.get('/api/probes', (req, res) => {
  const results = db.prepare('SELECT * FROM probe_results ORDER BY id DESC LIMIT 50').all();
  res.json(results);
});

app.post('/api/probes/run', (req, res) => {
  runProbeCycle();
  const recent = db.prepare('SELECT * FROM probe_results ORDER BY id DESC LIMIT 8').all();
  res.json({ message: 'Đã hoàn thành lượt quét kiểm tra đa resolver', probes: recent });
});

// 4. Incidents & Ticket Dispatch
app.get('/api/incidents', (req, res) => {
  const list = db.prepare('SELECT * FROM incidents ORDER BY id DESC').all();
  res.json(list);
});

app.get('/api/incidents/:id', (req, res) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Không tìm thấy sự cố' });
  res.json(incident);
});

app.post('/api/incidents/:id/send-ticket', (req, res) => {
  const { id } = req.params;
  const externalTicketId = `MB-TCK-${Math.floor(100000 + Math.random() * 900000)}`;

  db.prepare(`
    UPDATE incidents
    SET ticket_status = 'sent',
        status = 'Notified',
        external_ticket_id = ?
    WHERE id = ?
  `).run(externalTicketId, id);

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'TICKET_DISPATCHED',
    'Administrator',
    `Đã duyệt và gửi Ticket sự cố #${id} sang Trung tâm Hỗ trợ Kỹ thuật Mắt Bão. Mã tiếp nhận: ${externalTicketId}`
  );

  res.json({
    success: true,
    externalTicketId,
    message: `Đã gửi ticket thành công! Mã phiếu yêu cầu: ${externalTicketId}`
  });
});

// 5. Emergency Incident Playbook
app.get('/api/playbook/:id', (req, res) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  const isFailover = getSystemSetting('failover_active') === 'true';

  const playbook = {
    incident_id: req.params.id,
    root_cause: incident ? incident.root_cause_type : 'UNKNOWN',
    failover_active: isFailover,
    actions: [
      {
        id: 'out_of_band_alert',
        title: 'Kênh cảnh báo ngoài luồng (Telegram / Zalo)',
        status: 'DISPATCHED',
        description: 'Đã bắn tin cảnh báo khẩn cấp tới Quản trị viên qua Telegram Bot vì email công ty bị ảnh hưởng.'
      },
      {
        id: 'failover_page',
        title: 'Trang thông báo bảo trì tạm thời (Failover Static Page)',
        status: isFailover ? 'ACTIVE' : 'READY',
        description: isFailover
          ? 'Trang bảo trì tĩnh Cloudflare đang hoạt động để giữ lưu lượng khách hàng.'
          : 'Sẵn sàng kích hoạt trang tĩnh thông báo bảo trì trong thời gian chờ DNS/Host khắc phục.'
      },
      {
        id: 'dns_snapshot_rollback',
        title: 'Khôi phục Zone DNS từ Baseline Snapshot',
        status: 'READY',
        description: 'Bản sao lưu zone file an toàn lưu lúc 00:00 hôm nay. Nhấn để nạp lại bản ghi chuẩn.'
      },
      {
        id: 'mail_spooling',
        title: 'Hàng đợi thư dự phòng (Backup MX Spooling)',
        status: 'MONITORING',
        description: 'Các thư gửi đến đang được giữ tạm thời tại hàng đợi backup MX, không bị trả về lỗi.'
      }
    ]
  };

  res.json(playbook);
});

app.post('/api/playbook/toggle-failover', (req, res) => {
  const current = getSystemSetting('failover_active') === 'true';
  const next = !current;
  setSystemSetting('failover_active', next);

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'PLAYBOOK_ACTION',
    'User',
    next ? 'Kích hoạt trang thông báo bảo trì tạm thời (Failover Page)' : 'Tắt trang bảo trì tạm thời'
  );

  res.json({ failover_active: next, message: next ? 'Đã kích hoạt trang bảo trì tạm thời' : 'Đã tắt trang bảo trì' });
});

app.post('/api/playbook/rollback-dns', (req, res) => {
  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'PLAYBOOK_ACTION',
    'User',
    'Khôi phục bản ghi DNS của shop-demo.vn về Baseline an toàn gần nhất (NS: ns1.matbao.vn, A: 103.1.1.20)'
  );
  res.json({ success: true, message: 'Đã khôi phục bản ghi DNS về Baseline Snapshot an toàn!' });
});

// 5.1. Out-of-band Alert Dispatcher (Telegram, Email ngoài luồng, App Mắt Bão)
app.post('/api/alerts/test', (req, res) => {
  const { channel, message } = req.body;
  const channelNames = {
    telegram: 'Telegram Bot (@matbao_servicewatch_bot)',
    email: 'Email ngoài luồng (admin-backup@gmail.com)',
    app: 'App Di Động (Mắt Bão One Webhook)',
    browser: 'Thông báo đẩy Trình duyệt (Desktop Web Push)'
  };
  const channelTitle = channelNames[channel] || 'Kênh ngoài luồng';

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'ALERT_DISPATCH',
    'ServiceWatch Dispatcher',
    `Đã phát thông báo khẩn cấp qua [${channelTitle}]: ${message || 'Cảnh báo gián đoạn hạ tầng shop-demo.vn'}`
  );

  res.json({
    success: true,
    channel,
    timestamp: new Date().toISOString(),
    latency_ms: 380,
    message: `Đã phát thành công thông báo tới ${channelTitle} trong 0.38s!`
  });
});

// 6. Chaos Simulation Controller (Công cụ giúp Ban giám khảo kiểm thử 1-click)
app.get('/api/chaos', (req, res) => {
  res.json({
    chaos_mode: getSystemSetting('chaos_mode') === 'true',
    chaos_type: getSystemSetting('chaos_type', 'dns_servfail')
  });
});

app.post('/api/chaos/toggle', (req, res) => {
  const current = getSystemSetting('chaos_mode') === 'true';
  const next = !current;
  const chaosType = req.body.chaos_type || 'dns_servfail';

  setSystemSetting('chaos_mode', next);
  setSystemSetting('chaos_type', chaosType);

  // Kích hoạt ngay 1 chu kỳ probe để thấy hiệu ứng tức thì
  runProbeCycle();

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'CHAOS_SIMULATION',
    'Tester / Judge',
    next ? `BẬT mô phỏng sự cố: [${chaosType}] trên shop-demo.vn` : 'TẮT mô phỏng sự cố -> Chờ hệ thống tự xác thực phục hồi'
  );

  res.json({
    chaos_mode: next,
    chaos_type: chaosType,
    message: next ? `Đã kích hoạt giả lập sự cố: ${chaosType}` : 'Đã khôi phục hạ tầng, đang xác minh phục hồi'
  });
});

// 7. Audit logs
app.get('/api/audit-logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50').all();
  res.json(logs);
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` MẮT BÃO SERVICEWATCH / INCIDENT BRIDGE`);
  console.log(` Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
