const { db } = require('./database');

const RESOLVERS = [
  'Google DNS (8.8.8.8)',
  'Cloudflare DNS (1.1.1.1)',
  'Quad9 (9.9.9.9)',
  'Authoritative (ns1.matbao.vn)'
];

function getSystemSetting(key, defaultValue = 'false') {
  const row = db.prepare('SELECT value FROM system_state WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSystemSetting(key, value) {
  db.prepare(`
    INSERT INTO system_state (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value.toString());
}

// Chạy 1 chu kỳ probe và phân tích sự cố
function runProbeCycle() {
  const isChaos = getSystemSetting('chaos_mode') === 'true';
  const chaosType = getSystemSetting('chaos_type', 'dns_servfail');
  const isFailover = getSystemSetting('failover_active') === 'true';

  const assets = db.prepare('SELECT * FROM assets').all();
  const probeInsert = db.prepare(`
    INSERT INTO probe_results (monitor_id, asset_name, monitor_type, resolver, status, latency_ms, response_code, raw_log)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let cycleHasError = false;

  // 1. Thực hiện các probe
  for (const resolver of RESOLVERS) {
    if (isChaos && chaosType === 'dns_servfail') {
      cycleHasError = true;
      const isAuth = resolver.includes('ns1.matbao.vn');
      probeInsert.run(
        1,
        'shop-demo.vn',
        isAuth ? 'AUTHORITATIVE_NS' : 'DNS_RESOLUTION',
        resolver,
        'FAIL',
        isAuth ? 2150 : 380,
        isAuth ? 'TIMEOUT' : 'SERVFAIL',
        isAuth
          ? `;; connection timed out; no servers could be reached via ${resolver}:53`
          : `;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 48102`
      );
    } else if (isChaos && chaosType === 'http_503') {
      cycleHasError = true;
      probeInsert.run(
        3,
        'www.shop-demo.vn',
        'HTTP_STATUS',
        resolver,
        'FAIL',
        520,
        'HTTP 503',
        `HTTP/1.1 503 Service Unavailable (Web worker pool exhausted, PHP-FPM queue full)`
      );
    } else {
      // Normal healthy checks
      const latency = Math.floor(Math.random() * 25) + 12;
      probeInsert.run(
        1,
        'shop-demo.vn',
        'DNS_RESOLUTION',
        resolver,
        'SUCCESS',
        latency,
        'NOERROR',
        `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, answer: 103.1.1.20`
      );
    }
  }

  // 2. Phân tích Incident Engine
  if (cycleHasError) {
    handleIncidentDetected(chaosType, isFailover);
  } else {
    handleIncidentRecovery();
  }

  // Giới hạn bảng probe_results chỉ giữ 100 bản ghi mới nhất để nhẹ DB
  db.prepare(`
    DELETE FROM probe_results WHERE id NOT IN (
      SELECT id FROM probe_results ORDER BY id DESC LIMIT 100
    )
  `).run();
}

function handleIncidentDetected(chaosType, isFailover) {
  const fingerprint = `matbao-shop-demo.vn-${chaosType}`;
  const existing = db.prepare('SELECT * FROM incidents WHERE fingerprint = ?').get(fingerprint);

  const affectedServices = [
    'www.shop-demo.vn (Cloud Hosting)',
    'api.shop-demo.vn (Cloud VPS)',
    'mail.shop-demo.vn (Doanh nghiệp Pro)',
    'SSL Certificate'
  ];

  if (!existing || existing.status === 'Resolved' || existing.status === 'Closed') {
    // Tạo mới incident ở mức Suspected/Confirmed
    const ticketSubject = `[Critical][DNS] Nhiều resolver không phân giải được shop-demo.vn (SERVFAIL/Timeout)`;
    const ticketBody = generateDraftTicketContent(chaosType);

    db.prepare(`
      INSERT INTO incidents (
        fingerprint, title, severity, status, root_cause_type, responsible_provider,
        affected_services, consecutive_failures, ticket_subject, ticket_body, ticket_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fingerprint,
      chaosType === 'dns_servfail'
        ? 'Authoritative DNS và nhiều Public Resolver không thể phân giải shop-demo.vn'
        : 'Web Hosting trả về HTTP 503 Service Unavailable',
      'Critical',
      'Confirmed',
      chaosType === 'dns_servfail' ? 'DNS_AUTHORITATIVE_FAILURE' : 'HOSTING_CAPACITY_EXHAUSTED',
      chaosType === 'dns_servfail' ? 'Mắt Bão DNS Team' : 'Mắt Bão Hosting Support',
      JSON.stringify(affectedServices),
      1,
      ticketSubject,
      ticketBody,
      'draft'
    );

    // Cập nhật trạng thái các assets
    db.prepare("UPDATE assets SET status = 'down' WHERE name = 'shop-demo.vn'").run();
    db.prepare("UPDATE assets SET status = 'degraded' WHERE parent_asset_id = 1").run();

    // Ghi audit log
    db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
      'INCIDENT_CONFIRMED',
      'Incident Engine',
      `Phát hiện và xác nhận sự cố ${chaosType} trên shop-demo.vn. Đã tự động lập bản thảo ticket gửi Mắt Bão.`
    );
  } else {
    // Tăng số lần fail liên tiếp
    db.prepare(`
      UPDATE incidents
      SET consecutive_failures = consecutive_failures + 1,
          last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.id);
  }
}

function handleIncidentRecovery() {
  const activeIncident = db.prepare(`
    SELECT * FROM incidents
    WHERE status IN ('Confirmed', 'Notified', 'Suspected')
    ORDER BY id DESC LIMIT 1
  `).get();

  if (activeIncident) {
    const newPasses = (activeIncident.recovery_passes || 0) + 1;
    if (newPasses >= 3) {
      // Đủ 3 lần check pass liên tiếp từ nhiều resolver -> Phục hồi hoàn toàn
      const report = generatePostIncidentReport(activeIncident);
      db.prepare(`
        UPDATE incidents
        SET status = 'Resolved',
            recovery_passes = ?,
            resolved_at = CURRENT_TIMESTAMP,
            post_incident_report = ?
        WHERE id = ?
      `).run(newPasses, report, activeIncident.id);

      // Cập nhật lại assets về healthy
      db.prepare("UPDATE assets SET status = 'healthy'").run();

      db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
        'INCIDENT_RESOLVED',
        'Recovery Detector',
        `Xác minh phục hồi thành công sau 3 lần pass liên tiếp. Tự động đóng sự cố #${activeIncident.id} và xuất Báo cáo Post-mortem.`
      );
    } else {
      db.prepare('UPDATE incidents SET recovery_passes = ? WHERE id = ?').run(newPasses, activeIncident.id);
    }
  }
}

function generateDraftTicketContent(chaosType) {
  return `Tiêu đề: [Critical][DNS] Nhiều resolver không phân giải được shop-demo.vn
Người gửi: Quản trị viên (Công ty An Phát Demo)
Tài sản bị ảnh hưởng: shop-demo.vn (ID: ASSET-001)
Nhà cung cấp tiếp nhận: Trung tâm Hỗ trợ Kỹ thuật Mắt Bão

THÔNG TIN KỸ THUẬT QUAN SÁT ĐƯỢC (OBSERVED EVIDENCE):
- Thời điểm phát hiện lần đầu: ${new Date().toISOString()}
- Google DNS (8.8.8.8): SERVFAIL (Latency: 380ms)
- Cloudflare DNS (1.1.1.1): SERVFAIL (Latency: 395ms)
- Quad9 (9.9.9.9): SERVFAIL (Latency: 410ms)
- Authoritative NS (ns1.matbao.vn:53): Connection Timed Out (2150ms)

TÁC ĐỘNG NGHIỆP VỤ LIÊN ĐỚI (CASCADE BUSINESS IMPACT):
- Website bán hàng (www.shop-demo.vn): Unreachable (Đứt kết nối)
- Cổng API thanh toán (api.shop-demo.vn): Gián đoạn giao dịch
- Hệ thống Email giao dịch (mail.shop-demo.vn): Không nhận được thư (MX resolve fail)

HÀNH ĐỘNG YÊU CẦU:
Kính đề nghị Đội ngũ Kỹ thuật Mắt Bão kiểm tra ngay cụm máy chủ Authoritative Nameserver (ns1.matbao.vn) và xác minh trạng thái phân giải Zone shop-demo.vn.`;
}

function generatePostIncidentReport(incident) {
  return `# BÁO CÁO TỔNG KẾT SAU SỰ CỐ (POST-INCIDENT REPORT)
**Mã sự cố:** #INC-${incident.id}
**Tài nguyên:** shop-demo.vn
**Phân loại lỗi:** ${incident.root_cause_type}
**Nhà cung cấp xử lý:** ${incident.responsible_provider}

---

### 1. Tóm tắt diễn biến (Timeline)
* **Bắt đầu phát hiện:** ${incident.first_detected_at} (Bởi hệ thống Probe đa vùng)
* **Xác nhận sự cố:** Sau 2 lần kiểm tra chéo liên tiếp từ Google DNS, Cloudflare DNS và ns1.matbao.vn
* **Phiếu yêu cầu:** Ticket tự động được lập và duyệt gửi đến bộ phận hỗ trợ kỹ thuật
* **Thời điểm phục hồi:** ${new Date().toISOString()} (Được xác thực sau 3 lần pass liên tiếp)

### 2. Nguyên nhân gốc rễ (Root Cause)
Sự cố gián đoạn phân giải tại cụm Authoritative Nameserver dẫn đến mã lỗi SERVFAIL trên các public resolver toàn cầu, kéo theo hiệu ứng sập liên đới của Website, API và Email.

### 3. Tác động kinh doanh (Business Impact)
* Thời gian gián đoạn (MTTR ước tính): ~15 phút
* Toàn bộ 4 dịch vụ phụ thuộc đã trở lại trạng thái hoạt động bình thường (Healthy).

### 4. Đề xuất cải tiến phòng ngừa (Prevention Recommendations)
* Cấu hình dự phòng Secondary DNS độc lập.
* Duy trì kênh cảnh báo ngoài luồng Telegram cho quản trị viên.
* Thiết lập Backup MX server lưu tạm email giao dịch khi DNS gián đoạn.`;
}

module.exports = {
  runProbeCycle,
  getSystemSetting,
  setSystemSetting
};
