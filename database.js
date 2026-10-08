const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'servicewatch.db');
const db = new Database(dbPath);

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
  `);

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

  // Seed mock assets if empty
  const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
  if (assetCount === 0) {
    seedInitialData();
  }
}

function seedInitialData() {
  const insertAsset = db.prepare(`
    INSERT INTO assets (name, type, target, provider_name, parent_asset_id, status, baseline_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Root Domain
  const root = insertAsset.run('shop-demo.vn', 'domain', 'shop-demo.vn', 'Mắt Bão', null, 'healthy', 'NS: ns1.matbao.vn, ns2.matbao.vn');
  const rootId = root.lastInsertRowid;

  // Sub assets linked to root
  const web = insertAsset.run('www.shop-demo.vn', 'website', '103.1.1.20', 'Mắt Bão Cloud Hosting', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.20');
  const api = insertAsset.run('api.shop-demo.vn', 'website', '103.1.1.21', 'Mắt Bão Cloud VPS', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.21');
  const mail = insertAsset.run('mail.shop-demo.vn', 'email', 'mail.shop-demo.vn', 'Mắt Bão Pro Mail', rootId, 'healthy', 'MX: mail.shop-demo.vn (Pri 10)');
  const ssl = insertAsset.run('SSL Certificate (*.shop-demo.vn)', 'ssl', 'https://www.shop-demo.vn', 'Sectigo / Mắt Bão', rootId, 'healthy', 'Valid until 2027-05-15 (Days left: 218)');

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

  // Initial audit log
  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)')
    .run('SYSTEM_INIT', 'System', 'Khởi tạo hệ thống ServiceWatch và nạp dữ liệu mẫu shop-demo.vn');
}

module.exports = {
  db,
  initDatabase
};
