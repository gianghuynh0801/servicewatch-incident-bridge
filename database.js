const path = require('path');
const dbPath = path.join(__dirname, 'servicewatch.db');

let db;
try {
  // 1. Prefer Node 22 built-in node:sqlite (100% cloud native, zero C++ build, no Python/node-gyp needed)
  const { DatabaseSync } = require('node:sqlite');
  const dbSync = new DatabaseSync(dbPath);
  dbSync.pragma = function(str) {
    try {
      dbSync.exec('PRAGMA ' + str);
    } catch (e) {}
  };
  db = dbSync;
} catch (e) {
  // 2. Fallback to better-sqlite3 if on older Node or local dev
  try {
    const BetterSqlite = require('better-sqlite3');
    db = new BetterSqlite(dbPath);
  } catch (err2) {
    console.error('Không thể khởi tạo cơ sở dữ liệu SQLite:', err2.message);
    throw err2;
  }
}

// Enable foreign keys and WAL mode for high performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'domain', 'website', 'hosting', 'email', 'ssl'
      target TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      parent_asset_id INTEGER,
      status TEXT DEFAULT 'healthy', -- 'healthy', 'warning', 'down'
      baseline_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      monitor_type TEXT NOT NULL, -- 'DNS_RESOLUTION', 'AUTHORITATIVE_NS', 'HTTP_STATUS', 'SSL_EXPIRY', 'SMTP_MX'
      target TEXT NOT NULL,
      interval_seconds INTEGER DEFAULT 60,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS probe_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER,
      asset_name TEXT NOT NULL,
      monitor_type TEXT NOT NULL,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolver TEXT NOT NULL, -- 'Google DNS', 'Cloudflare DNS', 'Quad9', 'ns1.matbao.vn'
      status TEXT NOT NULL, -- 'SUCCESS', 'FAIL'
      latency_ms INTEGER DEFAULT 0,
      response_code TEXT,
      raw_log TEXT
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      severity TEXT NOT NULL, -- 'Warning', 'Major', 'Critical'
      status TEXT NOT NULL, -- 'Suspected', 'Confirmed', 'Notified', 'Resolved', 'Closed'
      root_cause_type TEXT NOT NULL,
      responsible_provider TEXT NOT NULL,
      affected_services TEXT, -- JSON array of affected service names
      consecutive_failures INTEGER DEFAULT 1,
      ticket_subject TEXT,
      ticket_body TEXT,
      ticket_status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'sent'
      external_ticket_id TEXT,
      recovery_passes INTEGER DEFAULT 0,
      first_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      duration_minutes INTEGER DEFAULT 0,
      post_incident_report TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor TEXT DEFAULT 'System',
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      organization TEXT DEFAULT 'Công ty TNHH An Phát Demo',
      role TEXT DEFAULT 'admin', -- 'admin', 'judge', 'operator'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'cron', -- 'cron', 'worker', 'backup', 'payment'
      expected_interval_seconds INTEGER DEFAULT 60,
      grace_period_seconds INTEGER DEFAULT 30,
      status TEXT DEFAULT 'healthy', -- 'healthy', 'late', 'missing'
      last_ping_at DATETIME,
      last_payload TEXT,
      alert_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration các cột mới cho assets nếu chưa có
  try { db.exec('ALTER TABLE assets ADD COLUMN expires_at TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE assets ADD COLUMN days_left INTEGER'); } catch(e) {}
  try { db.exec('ALTER TABLE assets ADD COLUMN service_category TEXT DEFAULT "core"'); } catch(e) {}
  try { db.exec('ALTER TABLE assets ADD COLUMN auto_renew INTEGER DEFAULT 1'); } catch(e) {}

  // Seed default system settings
  const getSetting = db.prepare('SELECT value FROM system_state WHERE key = ?');
  if (!getSetting.get('chaos_mode')) {
    db.prepare('INSERT INTO system_state (key, value) VALUES (?, ?)').run('chaos_mode', 'false');
  }
  if (!getSetting.get('chaos_type')) {
    db.prepare('INSERT INTO system_state (key, value) VALUES (?, ?)').run('chaos_type', 'dns_servfail');
  }
  if (!getSetting.get('failover_active')) {
    db.prepare('INSERT INTO system_state (key, value) VALUES (?, ?)').run('failover_active', 'false');
  }

  // Ensure standard demo accounts are ready
  ensureDemoAccounts();

  // Seed mock assets if empty
  const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
  if (assetCount === 0) {
    seedInitialData();
  }

  // Seed mock heartbeats if empty
  seedInitialHeartbeats();
}

const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_servicewatch_salt_2026').digest('hex');
}

function createSession(token, userId) {
  db.prepare('INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId);
}

function getUserByToken(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.organization, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token);
}

function deleteSession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function ensureDemoAccounts() {
  const upsert = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, organization, role)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      full_name = excluded.full_name,
      role = excluded.role
  `);

  // 1. Quản trị viên chỉ huy (Admin)
  upsert.run(
    'admin',
    'admin@servicewatch.vn',
    hashPassword('admin123'),
    'Nguyễn Văn An (Trưởng Quản Trị Hệ Thống)',
    'Công ty TNHH An Phát Demo',
    'admin'
  );

  // 2. Tài khoản Ban Giám Khảo (Judge / giamkhao)
  upsert.run(
    'judge',
    'judge@matbao.ai',
    hashPassword('judge123'),
    'Ban Giám Khảo (Vibe Code Challenge)',
    'Hội Đồng Giám Khảo Đánh Giá',
    'judge'
  );
  upsert.run(
    'giamkhao',
    'giamkhao@matbao.ai',
    hashPassword('judge123'),
    'Ban Giám Khảo (Vibe Code Challenge)',
    'Hội Đồng Giám Khảo Đánh Giá',
    'judge'
  );

  // 3. Kỹ sư trực ban SRE (support / devops)
  upsert.run(
    'support',
    'support@matbao.net',
    hashPassword('support123'),
    'Kỹ Sư Vận Hành Hạ Tầng (SRE)',
    'Phòng Kỹ Thuật Vận Hành',
    'operator'
  );
  upsert.run(
    'devops',
    'devops@shop-demo.vn',
    hashPassword('devops123'),
    'Trần Minh Trực (Kỹ Sư Trực Ban SRE)',
    'Phòng Kỹ Thuật An Phát',
    'operator'
  );
}

function seedInitialData() {
  const insertAsset = db.prepare(`
    INSERT INTO assets (name, type, target, provider_name, parent_asset_id, status, baseline_value, expires_at, days_left, service_category, auto_renew)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Root Domain
  const root = insertAsset.run('shop-demo.vn', 'domain', 'shop-demo.vn', 'Nhà Cung Cấp Dịch Vụ', null, 'healthy', 'NS: ns1.matbao.vn, ns2.matbao.vn', '2027-05-15', 208, 'domain', 1);
  const rootId = root.lastInsertRowid;

  // Sub assets linked to root
  const web = insertAsset.run('www.shop-demo.vn', 'website', '103.1.1.20', 'Cloud Hosting', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.20', '2026-12-25', 67, 'hosting', 1);
  const api = insertAsset.run('api.shop-demo.vn', 'website', '103.1.1.21', 'Cloud VPS', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.21', '2026-11-20', 32, 'cloud', 1);
  const mail = insertAsset.run('mail.shop-demo.vn', 'email', 'mail.shop-demo.vn', 'Pro Mail', rootId, 'healthy', 'MX: mail.shop-demo.vn (Pri 10)', '2027-01-10', 83, 'email', 1);
  const ssl = insertAsset.run('SSL Certificate (*.shop-demo.vn)', 'ssl', 'https://www.shop-demo.vn', 'Sectigo SSL', rootId, 'healthy', 'Hạn: 2026-11-05 (Còn 17 ngày - Cần gia hạn)', '2026-11-05', 17, 'ssl', 0);
  const vnpay = insertAsset.run('Cổng Thanh Toán VNPay IPN', 'website', 'https://sandbox.vnpayment.vn', 'VNPay (VNPAY-QR)', rootId, 'healthy', 'HTTP 200, IPN Webhook Ready', '2027-12-31', 438, 'payment', 1);

  // Monitors
  const insertMonitor = db.prepare(`
    INSERT INTO monitors (asset_id, monitor_type, target, interval_seconds)
    VALUES (?, ?, ?, ?)
  `);

  insertMonitor.run(rootId, 'DNS_RESOLUTION', 'shop-demo.vn', 30);
  insertMonitor.run(rootId, 'AUTHORITATIVE_NS', 'ns1.matbao.vn', 30);
  insertMonitor.run(web.lastInsertRowid, 'HTTP_STATUS', 'https://www.shop-demo.vn', 30);
  insertMonitor.run(api.lastInsertRowid, 'HTTP_STATUS', 'https://api.shop-demo.vn/health', 30);
  insertMonitor.run(mail.lastInsertRowid, 'SMTP_MX', 'mail.shop-demo.vn:25', 60);
  insertMonitor.run(ssl.lastInsertRowid, 'SSL_EXPIRY', 'www.shop-demo.vn:443', 300);
  insertMonitor.run(vnpay.lastInsertRowid, 'HTTP_STATUS', 'https://sandbox.vnpayment.vn', 60);

  // Initial audit log
  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)')
    .run('SYSTEM_INIT', 'System', 'Khởi tạo hệ thống ServiceWatch và nạp dữ liệu mẫu shop-demo.vn (Kèm hạn gia hạn & Cổng VNPay)');
}

function seedInitialHeartbeats() {
  const count = db.prepare('SELECT COUNT(*) as count FROM heartbeats').get().count;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO heartbeats (token, name, category, expected_interval_seconds, grace_period_seconds, status, last_ping_at, last_payload)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);

  insert.run(
    'cron_backup_db',
    'Sao Lưu CSDL MySQL Đêm (Automated Dump)',
    'backup',
    60,
    30,
    'healthy',
    JSON.stringify({ status: 'success', dump_size: '412MB', duration_sec: 14 })
  );

  insert.run(
    'worker_order_sync',
    'Worker Đồng Bộ Đơn Hàng Kho (Queue Worker)',
    'worker',
    45,
    20,
    'healthy',
    JSON.stringify({ queue: 'orders', processed: 28, failed: 0 })
  );

  insert.run(
    'vnpay_ipn_synthetic',
    'Synthetic Probe Webhook Cổng VNPay',
    'payment',
    120,
    45,
    'healthy',
    JSON.stringify({ gateway: 'VNPay', sandbox_handshake: 'HTTP 200', latency_ms: 110 })
  );

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)')
    .run('HEARTBEAT_INIT', 'System', 'Khởi tạo 3 kênh Heartbeat Monitor (Dead Man\'s Snitch) mẫu cho Cron Backup, Worker và VNPay');
}

module.exports = {
  db,
  initDatabase,
  hashPassword,
  createSession,
  getUserByToken,
  deleteSession
};
