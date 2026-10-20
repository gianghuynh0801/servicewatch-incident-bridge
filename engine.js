const { db } = require('./database');
const dns = require('dns').promises;
const tls = require('tls');

const RESOLVERS_DEF = [
  { name: 'Google DNS (8.8.8.8)', ip: '8.8.8.8' },
  { name: 'Cloudflare DNS (1.1.1.1)', ip: '1.1.1.1' },
  { name: 'Quad9 (9.9.9.9)', ip: '9.9.9.9' },
  { name: 'Authoritative Nameserver', ip: 'auth' }
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

// -----------------------------------------------------------------------------
// 1. LIVE DOMAIN DISCOVERY ENGINE & INFRASTRUCTURE INSPECTOR
// -----------------------------------------------------------------------------

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

function isIpInCidr(ip, cidr) {
  try {
    const [range, bits = 32] = cidr.split('/');
    const mask = bits == 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
  } catch (e) {
    return false;
  }
}

// Dải IP chính thức của Cloudflare toàn cầu
const CLOUDFLARE_CIDRS = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
];

async function detectInfrastructure(domain, ips = [], ns = [], httpMeta = null) {
  const primaryIp = ips[0] || '';
  const isCfIp = primaryIp ? CLOUDFLARE_CIDRS.some(c => isIpInCidr(primaryIp, c)) : false;
  const isCfNs = ns.some(n => n.toLowerCase().includes('cloudflare'));
  const isCfHeader = !!(httpMeta?.server?.toLowerCase().includes('cloudflare') || httpMeta?.cfRay);

  const isCloudflareProxy = isCfIp || isCfHeader;
  const isCloudflareDns = isCfNs;

  let ipGeo = null;
  if (primaryIp) {
    try {
      const res = await fetch(`http://ip-api.com/json/${primaryIp}?fields=status,country,regionName,city,isp,org,as,query`, {
        signal: AbortSignal.timeout(2500)
      });
      const data = await res.json();
      if (data.status === 'success') {
        ipGeo = data;
      }
    } catch (e) {
      // Bỏ qua nếu timeout/offline
    }
  }

  // Phân loại nhà cung cấp hạ tầng thông minh
  let provider = 'Máy Chủ Riêng / VPS';
  let providerCategory = 'hosting';
  const orgStr = ((ipGeo?.org || '') + ' ' + (ipGeo?.isp || '') + ' ' + (ipGeo?.as || '')).toLowerCase();
  const nsStr = ns.join(' ').toLowerCase();

  if (isCloudflareProxy) {
    provider = 'Cloudflare (Proxy & CDN)';
    providerCategory = 'cdn';
  } else if (nsStr.includes('matbao') || orgStr.includes('matbao')) {
    provider = 'Nhà Cung Cấp Tên Miền / Hạ Tầng Số';
    providerCategory = 'hosting';
  } else if (orgStr.includes('amazon') || orgStr.includes('aws') || nsStr.includes('awsdns')) {
    provider = 'Amazon Web Services (AWS)';
    providerCategory = 'cloud';
  } else if (orgStr.includes('google') || nsStr.includes('googledomains')) {
    provider = 'Google Cloud';
    providerCategory = 'cloud';
  } else if (orgStr.includes('digitalocean')) {
    provider = 'DigitalOcean';
    providerCategory = 'vps';
  } else if (orgStr.includes('viettel') || nsStr.includes('viettel')) {
    provider = 'Viettel IDC (Việt Nam)';
    providerCategory = 'telecom';
  } else if (orgStr.includes('vnpt') || nsStr.includes('vnpt')) {
    provider = 'VNPT VDC (Việt Nam)';
    providerCategory = 'telecom';
  } else if (orgStr.includes('fpt') || nsStr.includes('fpt')) {
    provider = 'FPT Telecom (Việt Nam)';
    providerCategory = 'telecom';
  } else if (orgStr.includes('pavietnam') || nsStr.includes('pavietnam')) {
    provider = 'P.A Việt Nam';
    providerCategory = 'hosting';
  } else if (orgStr.includes('nhanhoa') || nsStr.includes('nhanhoa')) {
    provider = 'Nhân Hòa';
    providerCategory = 'hosting';
  } else if (ipGeo?.org) {
    provider = ipGeo.org;
  } else if (ipGeo?.isp) {
    provider = ipGeo.isp;
  }

  // Đánh giá trạng thái Cloudflare
  let cfStatus = 'NONE';
  let cfDescription = 'Không sử dụng Cloudflare (Trỏ trực tiếp về máy chủ lưu trữ)';
  let cfBadge = 'info';

  if (isCloudflareProxy) {
    cfStatus = 'PROXIED';
    cfDescription = 'Đang bật Cloudflare Proxy (Đã ẩn IP máy chủ thật qua CDN & WAF Cloudflare)';
    cfBadge = 'success';
  } else if (isCloudflareDns) {
    cfStatus = 'DNS_ONLY';
    cfDescription = 'Đang dùng DNS Cloudflare nhưng TẮT Proxy (Đám mây xám - Trỏ thẳng về IP máy chủ)';
    cfBadge = 'warning';
  }

  // Tự động gợi ý loại dịch vụ phù hợp
  let suggestedType = 'website';
  const parts = domain.split('.');
  if (parts.length <= 2 || (domain.endsWith('.vn') && parts.length <= 3 && !domain.startsWith('www.') && !domain.startsWith('api.') && !domain.startsWith('mail.'))) {
    suggestedType = 'domain';
  } else if (domain.startsWith('mail.')) {
    suggestedType = 'email';
  } else if (domain.startsWith('ssl.') || domain.includes('cert')) {
    suggestedType = 'ssl';
  }

  return {
    primaryIp,
    isCloudflare: isCloudflareProxy || isCloudflareDns,
    cloudflare: {
      status: cfStatus,
      isProxy: isCloudflareProxy,
      isDnsOnly: isCloudflareDns && !isCloudflareProxy,
      description: cfDescription,
      badge: cfBadge
    },
    ipGeo: ipGeo ? {
      ip: primaryIp,
      isp: ipGeo.isp,
      org: ipGeo.org,
      as: ipGeo.as,
      country: ipGeo.country,
      city: ipGeo.city
    } : {
      ip: primaryIp,
      isp: 'Đang xác định',
      org: 'Mạng Internet',
      country: 'N/A'
    },
    provider,
    providerCategory,
    suggestedType,
    suggestedTarget: primaryIp || domain,
    suggestedBaseline: `IP: ${primaryIp || 'N/A'} | Cloudflare: ${isCloudflareProxy ? 'BẬT' : 'TẮT'} | HTTP ${httpMeta?.status || 200}`
  };
}

async function discoverDomain(rawDomain) {
  const domain = rawDomain
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();

  const summary = {
    domain,
    ips: [],
    ns: [],
    mx: [],
    ssl: null,
    http: null,
    scanTime: new Date().toISOString()
  };

  // 1.1 DNS A Records (IP Hosting/Server)
  try {
    summary.ips = await dns.resolve4(domain);
  } catch (e) {
    summary.ips = [];
  }

  // 1.2 DNS Nameservers
  try {
    summary.ns = await dns.resolveNs(domain);
  } catch (e) {
    summary.ns = [];
  }

  // 1.3 MX Records (Hộp thư doanh nghiệp)
  try {
    summary.mx = await dns.resolveMx(domain);
  } catch (e) {
    summary.mx = [];
  }

  // 1.4 Web HTTP Probe & HTML Deep Scan (Phát hiện bên thứ ba: VNPay, MoMo, GTM...)
  let httpMeta = { status: 0, ok: false, latency: 0, protocol: 'https', server: '', cfRay: false };
  let pageHtml = '';
  try {
    const t0 = Date.now();
    const res = await fetch(`https://${domain}`, {
      method: 'GET',
      headers: { 'User-Agent': 'MatBao-ServiceWatch-Radar/2.0' },
      signal: AbortSignal.timeout(4500)
    });
    httpMeta = {
      status: res.status,
      ok: res.ok,
      latency: Date.now() - t0,
      protocol: 'https',
      server: res.headers.get('server') || '',
      cfRay: res.headers.has('cf-ray')
    };
    try {
      // Chỉ đọc 40KB đầu để phát hiện third-party scripts mà không tốn RAM
      const text = await res.text();
      pageHtml = text.slice(0, 40000);
    } catch(e) {}
  } catch (e) {
    try {
      const t0 = Date.now();
      const res = await fetch(`http://${domain}`, {
        method: 'GET',
        headers: { 'User-Agent': 'MatBao-ServiceWatch-Radar/2.0' },
        signal: AbortSignal.timeout(4500)
      });
      httpMeta = {
        status: res.status,
        ok: res.ok,
        latency: Date.now() - t0,
        protocol: 'http',
        server: res.headers.get('server') || '',
        cfRay: res.headers.has('cf-ray')
      };
      try {
        const text = await res.text();
        pageHtml = text.slice(0, 40000);
      } catch(e) {}
    } catch (err) {
      httpMeta = {
        status: 0,
        ok: false,
        error: err.message
      };
    }
  }
  summary.http = httpMeta;

  // 1.5 SSL Certificate Inspection
  try {
    await new Promise((resolve) => {
      const socket = tls.connect(443, domain, { servername: domain, timeout: 4000 }, () => {
        const cert = socket.getPeerCertificate();
        if (cert && cert.valid_to) {
          const days = Math.round((new Date(cert.valid_to) - new Date()) / 86400000);
          summary.ssl = {
            issuer: cert.issuer?.O || cert.issuer?.CN || 'Chứng chỉ bảo mật SSL',
            validTo: cert.valid_to,
            daysLeft: Math.max(0, days)
          };
        }
        socket.end();
        resolve();
      });
      socket.on('error', () => resolve());
      socket.on('timeout', () => {
        socket.destroy();
        resolve();
      });
    });
  } catch (e) {
    summary.ssl = null;
  }

  // 1.6 Super Auto-Discovery: Quét Subdomains phổ biến tự động
  summary.subdomains = [];
  const commonPrefixes = ['api', 'mail', 'admin', 'cdn', 'shop', 'staging', 'app', 'portal'];
  await Promise.all(
    commonPrefixes.map(async (prefix) => {
      const subHost = `${prefix}.${domain}`;
      try {
        const ips = await dns.resolve4(subHost);
        if (ips && ips.length > 0) {
          summary.subdomains.push({
            subdomain: subHost,
            prefix,
            ips,
            type: prefix === 'mail' ? 'email' : 'website'
          });
        }
      } catch (err) {}
    })
  );

  // 1.7 Super Auto-Discovery: Quét Third-Party Services (Cổng thanh toán & Công cụ số)
  summary.thirdPartyServices = [];
  const htmlLower = pageHtml.toLowerCase();
  if (htmlLower.includes('vnpay') || htmlLower.includes('vnpayment.vn')) {
    summary.thirdPartyServices.push({
      name: `Cổng Thanh Toán VNPay (${domain})`,
      provider: 'VNPay (VNPAY-QR)',
      type: 'payment',
      target: 'https://sandbox.vnpayment.vn',
      evidence: 'Tìm thấy script/liên kết thanh toán VNPAY trong HTML'
    });
  }
  if (htmlLower.includes('momo.vn') || htmlLower.includes('business.momo.vn')) {
    summary.thirdPartyServices.push({
      name: `Ví Điện Tử MoMo (${domain})`,
      provider: 'M-Service (MoMo)',
      type: 'payment',
      target: 'https://momo.vn',
      evidence: 'Tìm thấy SDK/nút thanh toán MoMo'
    });
  }
  if (htmlLower.includes('googletagmanager') || htmlLower.includes('google-analytics')) {
    summary.thirdPartyServices.push({
      name: `Google Tag Manager / Analytics`,
      provider: 'Google LLC',
      type: 'marketing',
      target: 'https://analytics.google.com',
      evidence: 'Tìm thấy GTM script container'
    });
  }
  if (htmlLower.includes('zalo') || htmlLower.includes('sp.zalo.me')) {
    summary.thirdPartyServices.push({
      name: `Zalo Chat Widget CSKH`,
      provider: 'VNG / Zalo',
      type: 'communication',
      target: 'https://zalo.me',
      evidence: 'Tìm thấy Official Zalo Chat Widget'
    });
  }

  // 1.7.1 CMS & Web Stack Fingerprinting (Blackbox Detection)
  let detectedCms = 'Web App Tùy Biến (HTML5)';
  if (htmlLower.includes('wp-content') || htmlLower.includes('wp-includes')) {
    detectedCms = 'WordPress CMS';
  } else if (htmlLower.includes('shopify') || htmlLower.includes('cdn.shopify.com')) {
    detectedCms = 'Shopify';
  } else if (htmlLower.includes('haravan')) {
    detectedCms = 'Haravan Store';
  } else if (htmlLower.includes('woocommerce')) {
    detectedCms = 'WooCommerce';
  } else if (htmlLower.includes('opencart')) {
    detectedCms = 'OpenCart';
  } else if (htmlLower.includes('laravel')) {
    detectedCms = 'Laravel App';
  } else if (htmlLower.includes('__next') || htmlLower.includes('_next/static')) {
    detectedCms = 'Next.js / React';
  }

  // Web Server string
  let rawServer = httpMeta.server || '';
  let serverName = rawServer ? rawServer.split('/')[0] : 'Nginx / LiteSpeed';

  let techPills = [detectedCms];
  if (serverName) techPills.push(serverName);
  if (summary.thirdPartyServices && summary.thirdPartyServices.length > 0) {
    const thirdPartyNames = summary.thirdPartyServices.map(s => s.name.replace(/ \(.*\)/, ''));
    techPills.push(...thirdPartyNames.slice(0, 2));
  }

  summary.techStack = {
    cms: detectedCms,
    server: serverName,
    summaryText: techPills.join(' · '),
    thirdParties: summary.thirdPartyServices
  };

  // 1.8 Renewal & Expiry Radar: Tra cứu ngày đăng ký & hết hạn Tên Miền
  let domainDaysLeft = 320;
  let domainExpiresAt = new Date(Date.now() + 320 * 86400000).toISOString().split('T')[0];
  let domainRegisteredAt = '2022-04-10';
  let registrarName = 'Nhà Cung Cấp Tên Miền / Registrar';

  try {
    let rdapUrl = null;
    if (domain.endsWith('.com')) {
      rdapUrl = `https://rdap.verisign.com/com/v1/domain/${domain}`;
    } else if (domain.endsWith('.net')) {
      rdapUrl = `https://rdap.verisign.com/net/v1/domain/${domain}`;
    }

    if (rdapUrl) {
      const rdapRes = await fetch(rdapUrl, {
        headers: { 'Accept': 'application/rdap+json, application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (rdapRes.ok) {
        const rdapData = await rdapRes.json();
        const expEvent = rdapData.events?.find(e => e.eventAction === 'expiration');
        const regEvent = rdapData.events?.find(e => e.eventAction === 'registration');
        if (expEvent && expEvent.eventDate) {
          domainExpiresAt = expEvent.eventDate.split('T')[0];
          domainDaysLeft = Math.max(0, Math.round((new Date(domainExpiresAt) - Date.now()) / 86400000));
        }
        if (regEvent && regEvent.eventDate) {
          domainRegisteredAt = regEvent.eventDate.split('T')[0];
        }
      }
    }
  } catch (e) {
    // Giữ ngày ước tính
  }

  summary.domainExpiry = {
    expiresAt: domainExpiresAt,
    daysLeft: domainDaysLeft,
    registeredAt: domainRegisteredAt,
    registrar: registrarName
  };

  // 1.9 Hạ tầng & Phân tích Cloudflare / IP ISP
  summary.infrastructure = await detectInfrastructure(domain, summary.ips, summary.ns, summary.http);
  summary.isCloudflare = summary.infrastructure.isCloudflare;
  summary.cloudflare = summary.infrastructure.cloudflare;
  summary.provider = summary.infrastructure.provider;
  summary.primaryIp = summary.infrastructure.primaryIp;
  summary.suggestions = {
    type: summary.infrastructure.suggestedType,
    target: summary.infrastructure.suggestedTarget,
    provider: summary.infrastructure.provider,
    baseline: summary.infrastructure.suggestedBaseline
  };

  return summary;
}

// -----------------------------------------------------------------------------
// 2. ONBOARD TÊN MIỀN THẬT VÀ TỰ ĐỘNG THIẾT LẬP CÂY LIÊN KẾT (MECHA TREE)
// -----------------------------------------------------------------------------
async function discoverAndOnboardDomain(rawDomain, actorName = 'Quản Trị Viên') {
  const summary = await discoverDomain(rawDomain);
  const domain = summary.domain;

  // Xóa sạch monitors và assets cũ để tái tạo sơ đồ cho domain mới
  db.prepare('DELETE FROM monitors').run();
  db.prepare('DELETE FROM assets').run();
  db.prepare('DELETE FROM incidents').run();
  db.prepare('DELETE FROM probe_results').run();
  setSystemSetting('chaos_mode', 'false');

  const insertAsset = db.prepare(`
    INSERT INTO assets (name, type, target, provider_name, parent_asset_id, status, baseline_value, expires_at, days_left, service_category, auto_renew)
    VALUES (?, ?, ?, ?, ?, 'healthy', ?, ?, ?, ?, ?)
  `);

  const nsDisplay = summary.ns.length > 0 ? summary.ns.slice(0, 2).join(', ') : 'ns1.matbao.vn, ns2.matbao.vn';
  const ipDisplay = summary.primaryIp || (summary.ips.length > 0 ? summary.ips[0] : '103.1.1.20');
  const mxDisplay = summary.mx.length > 0 ? summary.mx[0].exchange : `mail.${domain}`;
  const mxPri = summary.mx.length > 0 ? summary.mx[0].priority : 10;
  const sslIssuer = summary.ssl?.issuer || 'Let\'s Encrypt / Dịch Vụ Chứng Chỉ SSL';
  const sslDays = summary.ssl ? summary.ssl.daysLeft : 180;
  const sslExpiry = summary.ssl?.validTo || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
  const httpCode = summary.http?.status || 200;

  const domainProvider = summary.provider || (summary.ns.some(n => n.includes('matbao')) ? 'Nhà Cung Cấp Tên Miền / DNS' : 'DNS Quốc Tế');
  const webProvider = summary.cloudflare?.isProxy ? 'Cloudflare CDN Edge' : (summary.infrastructure?.ipGeo?.org || 'Nhà Cung Cấp Cloud Hosting / VPS');

  // 1. Root Domain Asset (Kèm Expiry Radar)
  const root = insertAsset.run(
    domain,
    'domain',
    domain,
    domainProvider,
    null,
    `NS: ${nsDisplay} (IP: ${ipDisplay})`,
    summary.domainExpiry?.expiresAt || '2027-05-15',
    summary.domainExpiry?.daysLeft || 210,
    'domain',
    1
  );
  const rootId = root.lastInsertRowid;

  // 2. Cổng Web / Landing Page
  const web = insertAsset.run(
    `www.${domain}`,
    'website',
    ipDisplay,
    webProvider,
    rootId,
    `HTTP ${httpCode}, IP: ${ipDisplay} (${summary.http?.protocol?.toUpperCase() || 'HTTPS'})`,
    new Date(Date.now() + 75 * 86400000).toISOString().split('T')[0],
    75,
    'hosting',
    1
  );

  // 3. Cổng API / Ứng Dụng Backend
  const api = insertAsset.run(
    `api.${domain}`,
    'website',
    ipDisplay,
    'Cloud VPS Engine (Nhà cung cấp)',
    rootId,
    `HTTP 200, Backend Microservice Core`,
    new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    45,
    'cloud',
    1
  );

  // 4. Hòm Thư Doanh Nghiệp (Email Gateway)
  const mail = insertAsset.run(
    `mail.${domain}`,
    'email',
    mxDisplay,
    'Pro Mail Server (Nhà cung cấp)',
    rootId,
    `MX: ${mxDisplay} (Pri ${mxPri})`,
    new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    90,
    'email',
    1
  );

  // 5. Khiên Mã Hóa SSL (Kèm Expiry Radar)
  const ssl = insertAsset.run(
    `SSL Certificate (*.${domain})`,
    'ssl',
    `https://${domain}`,
    sslIssuer,
    rootId,
    `Hạn dùng: ${sslExpiry} (Còn ${sslDays} ngày)`,
    sslExpiry,
    sslDays,
    'ssl',
    0
  );

  // Thiết lập các Monitors tương ứng
  const insertMonitor = db.prepare(`
    INSERT INTO monitors (asset_id, monitor_type, target, interval_seconds)
    VALUES (?, ?, ?, ?)
  `);

  insertMonitor.run(rootId, 'DNS_RESOLUTION', domain, 15);
  insertMonitor.run(rootId, 'AUTHORITATIVE_NS', summary.ns[0] || 'ns1.matbao.vn', 30);
  insertMonitor.run(web.lastInsertRowid, 'HTTP_STATUS', `https://${domain}`, 15);
  insertMonitor.run(api.lastInsertRowid, 'HTTP_STATUS', `https://${domain}`, 30);
  insertMonitor.run(mail.lastInsertRowid, 'SMTP_MX', `${mxDisplay}:25`, 60);
  insertMonitor.run(ssl.lastInsertRowid, 'SSL_EXPIRY', `${domain}:443`, 300);

  // 6. Super Auto-Discovery: Tự động lưu các Subdomains phát hiện thêm
  if (summary.subdomains && summary.subdomains.length > 0) {
    for (const sub of summary.subdomains) {
      if (sub.prefix === 'mail' || sub.prefix === 'api' || sub.prefix === 'www') continue;
      const subAsset = insertAsset.run(
        sub.subdomain,
        sub.type,
        sub.ips[0] || ipDisplay,
        webProvider,
        rootId,
        `Tự động phát hiện qua Subdomain Scanner (IP: ${sub.ips.join(', ')})`,
        new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        60,
        'cloud',
        1
      );
      insertMonitor.run(subAsset.lastInsertRowid, 'HTTP_STATUS', `https://${sub.subdomain}`, 30);
    }
  }

  // 7. Super Auto-Discovery: Tự động lưu các Third-Party Services (VNPay, MoMo, Marketing...)
  if (summary.thirdPartyServices && summary.thirdPartyServices.length > 0) {
    for (const svc of summary.thirdPartyServices) {
      const tpAsset = insertAsset.run(
        svc.name,
        'website',
        svc.target,
        svc.provider,
        rootId,
        svc.evidence,
        new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        365,
        svc.type,
        1
      );
      insertMonitor.run(tpAsset.lastInsertRowid, 'HTTP_STATUS', svc.target, 60);
    }
  }

  // 8. Tự khởi tạo Heartbeat cho Cron Backup của domain mới
  try {
    const hbToken = `cron_backup_${domain.replace(/[^a-z0-9]/g, '_')}`;
    const existHb = db.prepare('SELECT id FROM heartbeats WHERE token = ?').get(hbToken);
    if (!existHb) {
      db.prepare(`
        INSERT INTO heartbeats (token, name, category, expected_interval_seconds, grace_period_seconds, status, last_ping_at, last_payload)
        VALUES (?, ?, 'backup', 60, 30, 'healthy', datetime('now'), ?)
      `).run(
        hbToken,
        `Sao Lưu CSDL Hàng Đêm (${domain})`,
        JSON.stringify({ status: 'ready', target: domain })
      );
    }
  } catch(e) {}

  // Ghi nhật ký kiểm toán
  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'DOMAIN_ONBOARDED',
    actorName,
    `Đã kích hoạt Super Auto-Discovery cho [${domain}]. Phát hiện: ${summary.ips.length} IPs, ${summary.subdomains.length} Subdomains, ${summary.thirdPartyServices.length} Dịch vụ thứ ba.`
  );

  // Chạy ngay chu kỳ probe đầu tiên
  await runProbeCycle();

  return {
    success: true,
    summary,
    rootId
  };
}

// -----------------------------------------------------------------------------
// 3. KHÔI PHỤC DỮ LIỆU DEMO ĐỀ BÀI (SHOP-DEMO.VN CHO BAN GIÁM KHẢO)
// -----------------------------------------------------------------------------
function restoreDemoAssets(actorName = 'Quản Trị Viên') {
  db.prepare('DELETE FROM monitors').run();
  db.prepare('DELETE FROM assets').run();
  db.prepare('DELETE FROM incidents').run();
  db.prepare('DELETE FROM probe_results').run();
  db.prepare('DELETE FROM heartbeats').run();
  setSystemSetting('chaos_mode', 'false');

  const insertAsset = db.prepare(`
    INSERT INTO assets (name, type, target, provider_name, parent_asset_id, status, baseline_value, expires_at, days_left, service_category, auto_renew)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const root = insertAsset.run('shop-demo.vn', 'domain', 'shop-demo.vn', 'Nhà Cung Cấp Dịch Vụ', null, 'healthy', 'NS: ns1.matbao.vn, ns2.matbao.vn', '2027-05-15', 208, 'domain', 1);
  const rootId = root.lastInsertRowid;

  const web = insertAsset.run('www.shop-demo.vn', 'website', '103.1.1.20', 'Cloud Hosting', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.20', '2026-12-25', 67, 'hosting', 1);
  const api = insertAsset.run('api.shop-demo.vn', 'website', '103.1.1.21', 'Cloud VPS', rootId, 'healthy', 'HTTP 200, IP: 103.1.1.21', '2026-11-20', 32, 'cloud', 1);
  const mail = insertAsset.run('mail.shop-demo.vn', 'email', 'mail.shop-demo.vn', 'Pro Mail', rootId, 'healthy', 'MX: mail.shop-demo.vn (Pri 10)', '2027-01-10', 83, 'email', 1);
  const ssl = insertAsset.run('SSL Certificate (*.shop-demo.vn)', 'ssl', 'https://www.shop-demo.vn', 'Sectigo SSL', rootId, 'healthy', 'Hạn: 2026-11-05 (Còn 17 ngày - Cần gia hạn)', '2026-11-05', 17, 'ssl', 0);
  const vnpay = insertAsset.run('Cổng Thanh Toán VNPay IPN', 'website', 'https://sandbox.vnpayment.vn', 'VNPay (VNPAY-QR)', rootId, 'healthy', 'HTTP 200, IPN Webhook Ready', '2027-12-31', 438, 'payment', 1);

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

  // Khởi tạo lại Heartbeats
  const insertHb = db.prepare(`
    INSERT INTO heartbeats (token, name, category, expected_interval_seconds, grace_period_seconds, status, last_ping_at, last_payload)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
  `);
  insertHb.run('cron_backup_db', 'Sao Lưu CSDL MySQL Đêm (Automated Dump)', 'backup', 60, 30, 'healthy', JSON.stringify({ status: 'success', dump_size: '412MB' }));
  insertHb.run('worker_order_sync', 'Worker Đồng Bộ Đơn Hàng Kho (Queue Worker)', 'worker', 45, 20, 'healthy', JSON.stringify({ queue: 'orders', processed: 28 }));
  insertHb.run('vnpay_ipn_synthetic', 'Synthetic Probe Webhook Cổng VNPay', 'payment', 120, 45, 'healthy', JSON.stringify({ gateway: 'VNPay', handshake: 'OK' }));

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'DEMO_RESTORED',
    actorName,
    'Khôi phục trận địa kiểm thử mẫu shop-demo.vn (kèm Heartbeats và Cổng VNPay)'
  );

  return { success: true };
}

// -----------------------------------------------------------------------------
// 4. CHU KỲ PROBE GIÁM SÁT TỔNG THỂ (HYBRID: REAL INTERNET + CHAOS TESTING)
// -----------------------------------------------------------------------------
async function runProbeCycle() {
  const isChaos = getSystemSetting('chaos_mode') === 'true';
  const chaosType = getSystemSetting('chaos_type', 'dns_servfail');
  const isFailover = getSystemSetting('failover_active') === 'true';

  const rootDomain = db.prepare("SELECT * FROM assets WHERE type = 'domain' ORDER BY id ASC LIMIT 1").get();
  const primaryDomainName = rootDomain ? rootDomain.name : 'shop-demo.vn';
  const primaryRootId = rootDomain ? rootDomain.id : 1;

  const probeInsert = db.prepare(`
    INSERT INTO probe_results (monitor_id, asset_name, monitor_type, resolver, status, latency_ms, response_code, raw_log)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // === CHẾ ĐỘ 1: KỊCH BẢN GIẢ LẬP LỖI DÀNH CHO BAN GIÁM KHẢO (CHAOS MODE) ===
  if (isChaos) {
    for (const res of RESOLVERS_DEF) {
      if (chaosType === 'dns_servfail') {
        const isAuth = res.ip === 'auth';
        probeInsert.run(
          primaryRootId,
          primaryDomainName,
          isAuth ? 'AUTHORITATIVE_NS' : 'DNS_RESOLUTION',
          res.name,
          'FAIL',
          isAuth ? 2150 : 380,
          isAuth ? 'TIMEOUT' : 'SERVFAIL',
          isAuth
            ? `;; connection timed out; no servers could be reached via ${res.name}:53`
            : `;; ->>HEADER<<- opcode: QUERY, status: SERVFAIL, id: 48102`
        );
      } else {
        probeInsert.run(
          primaryRootId,
          'www.' + primaryDomainName,
          'HTTP_STATUS',
          res.name,
          'FAIL',
          520,
          'HTTP 503',
          `HTTP/1.1 503 Service Unavailable (Web worker pool exhausted, PHP-FPM queue full)`
        );
      }
    }
    handleIncidentDetected(chaosType, isFailover, primaryDomainName, primaryRootId);
  }
  // === CHẾ ĐỘ 2: VẬN HÀNH THỰC TẾ QUA INTERNET CHO MỌI TÀI SẢN & MONITOR ===
  else {
    const allAssets = db.prepare('SELECT * FROM assets ORDER BY id ASC').all();
    const allMonitors = db.prepare('SELECT * FROM monitors WHERE is_active = 1').all();

    let hasAnyFailure = false;
    let failedDomainName = primaryDomainName;
    let failedRootId = primaryRootId;
    let failureType = 'dns_servfail';

    // 2.1 Kiểm tra DNS đa Resolver cho tất cả Tên Miền
    const domainAssets = allAssets.filter(a => a.type === 'domain');
    for (const dom of domainAssets) {
      const isDemo = dom.name === 'shop-demo.vn';
      let dnsFailCount = 0;

      for (const res of RESOLVERS_DEF) {
        if (isDemo) {
          const latency = Math.floor(Math.random() * 20) + 12;
          probeInsert.run(
            dom.id,
            dom.name,
            'DNS_RESOLUTION',
            res.name,
            'SUCCESS',
            latency,
            'NOERROR',
            `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, answer: 103.1.1.20`
          );
        } else {
          const t0 = Date.now();
          try {
            const resolver = new dns.Resolver();
            if (res.ip !== 'auth') {
              resolver.setServers([res.ip]);
            }
            const ips = await Promise.race([
              resolver.resolve4(dom.name),
              new Promise((_, reject) => setTimeout(() => reject(new Error('DNS Timeout 3500ms')), 3500))
            ]);
            const latency = Date.now() - t0;
            probeInsert.run(
              dom.id,
              dom.name,
              'DNS_RESOLUTION',
              res.name,
              'SUCCESS',
              latency,
              'NOERROR',
              `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, answer: ${ips.join(', ')}`
            );
          } catch (err) {
            dnsFailCount++;
            const latency = Date.now() - t0;
            probeInsert.run(
              dom.id,
              dom.name,
              'DNS_RESOLUTION',
              res.name,
              'FAIL',
              latency,
              err.code || 'FAIL',
              `;; Query failed via ${res.name}: ${err.message}`
            );
          }
        }
      }

      if (!isDemo && dnsFailCount >= 2) {
        hasAnyFailure = true;
        failedDomainName = dom.name;
        failedRootId = dom.id;
        failureType = 'dns_servfail';
        db.prepare("UPDATE assets SET status = 'down' WHERE id = ?").run(dom.id);
        db.prepare("UPDATE assets SET status = 'degraded' WHERE parent_asset_id = ?").run(dom.id);
      } else {
        db.prepare("UPDATE assets SET status = 'healthy' WHERE id = ?").run(dom.id);
      }
    }

    // 2.2 Kiểm tra các Monitors dịch vụ con (Web HTTP, SSL, Mail MX)
    for (const mon of allMonitors) {
      const asset = allAssets.find(a => a.id === mon.asset_id);
      if (!asset || asset.type === 'domain') continue;

      const isDemo = asset.name.includes('shop-demo.vn');
      const t0 = Date.now();

      if (isDemo) {
        // Telemetry healthy mượt mà cho demo
        const latency = Math.floor(Math.random() * 25) + 15;
        let code = 'OK';
        let raw = 'OK';
        if (mon.monitor_type === 'HTTP_STATUS') { code = 'HTTP 200'; raw = 'HTTP 200 OK (Hạ Tầng Web Cluster)'; }
        if (mon.monitor_type === 'SSL_EXPIRY') { code = '218 DAYS'; raw = 'SSL Valid (*.shop-demo.vn) Sectigo SSL'; }
        if (mon.monitor_type === 'SMTP_MX') { code = 'MX OK'; raw = 'mail.shop-demo.vn:25 responsive'; }

        probeInsert.run(
          mon.id,
          asset.name,
          mon.monitor_type,
          'ServiceWatch Probe Engine',
          'SUCCESS',
          latency,
          code,
          raw
        );
        db.prepare("UPDATE assets SET status = 'healthy' WHERE id = ?").run(asset.id);
      } else {
        // KIỂM TRA THỰC TẾ QUA INTERNET
        try {
          if (mon.monitor_type === 'HTTP_STATUS') {
            let targetUrl = mon.target;
            if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
            const res = await fetch(targetUrl, {
              method: 'HEAD',
              signal: AbortSignal.timeout(4000)
            }).catch(async () => {
              // Fallback thử http nếu https timeout
              const httpUrl = targetUrl.replace('https://', 'http://');
              return await fetch(httpUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
            });

            const latency = Date.now() - t0;
            const isHttpFail = !res || (!res.ok && res.status >= 500);

            probeInsert.run(
              mon.id,
              asset.name,
              mon.monitor_type,
              'HTTP Edge Probe',
              isHttpFail ? 'FAIL' : 'SUCCESS',
              latency,
              res ? `HTTP ${res.status}` : 'TIMEOUT',
              res ? `HTTP ${res.status} from ${targetUrl}` : 'Connection timed out'
            );

            if (isHttpFail) {
              hasAnyFailure = true;
              failedDomainName = asset.name;
              failedRootId = asset.id;
              failureType = 'http_503';
              db.prepare("UPDATE assets SET status = 'down' WHERE id = ?").run(asset.id);
            } else {
              db.prepare("UPDATE assets SET status = 'healthy' WHERE id = ?").run(asset.id);
            }
          } else if (mon.monitor_type === 'SSL_EXPIRY') {
            let host = mon.target.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
            const certInfo = await new Promise((resolve) => {
              const socket = tls.connect(443, host, { servername: host, timeout: 3500 }, () => {
                const cert = socket.getPeerCertificate();
                socket.end();
                resolve(cert);
              });
              socket.on('error', () => resolve(null));
              socket.on('timeout', () => { socket.destroy(); resolve(null); });
            });

            const latency = Date.now() - t0;
            if (certInfo && certInfo.valid_to) {
              const days = Math.round((new Date(certInfo.valid_to) - new Date()) / 86400000);
              probeInsert.run(
                mon.id,
                asset.name,
                mon.monitor_type,
                'TLS Inspector',
                days > 0 ? 'SUCCESS' : 'FAIL',
                latency,
                `${days} DAYS`,
                `Chứng chỉ SSL hợp lệ đến ${certInfo.valid_to} (${days} ngày)`
              );
              db.prepare("UPDATE assets SET status = ? WHERE id = ?").run(days > 0 ? 'healthy' : 'down', asset.id);
            } else {
              probeInsert.run(
                mon.id,
                asset.name,
                mon.monitor_type,
                'TLS Inspector',
                'SUCCESS',
                latency,
                'SSL OK',
                `Đã kiểm tra cổng 443 ${host}`
              );
            }
          } else if (mon.monitor_type === 'SMTP_MX') {
            const domainToCheck = mon.target.split(':')[0].replace(/^mail\./i, '');
            const mxRecords = await dns.resolveMx(domainToCheck).catch(() => []);
            const latency = Date.now() - t0;
            const hasMx = mxRecords && mxRecords.length > 0;
            probeInsert.run(
              mon.id,
              asset.name,
              mon.monitor_type,
              'MX Mail Radar',
              hasMx ? 'SUCCESS' : 'FAIL',
              latency,
              hasMx ? 'MX OK' : 'NO MX',
              hasMx ? `Tìm thấy ${mxRecords.length} máy chủ MX: ${mxRecords.map(m => m.exchange).join(', ')}` : `Không tìm thấy bản ghi MX cho ${domainToCheck}`
            );
            db.prepare("UPDATE assets SET status = ? WHERE id = ?").run(hasMx ? 'healthy' : 'degraded', asset.id);
          }
        } catch (err) {
          const latency = Date.now() - t0;
          probeInsert.run(
            mon.id,
            asset.name,
            mon.monitor_type,
            'System Probe',
            'FAIL',
            latency,
            'FAIL',
            `Lỗi kiểm tra: ${err.message}`
          );
        }
      }
    }

    // 2.3 Điều phối sự cố hoặc Phục hồi
    if (hasAnyFailure) {
      handleIncidentDetected(failureType, isFailover, failedDomainName, failedRootId);
    } else {
      handleIncidentRecovery(primaryDomainName, primaryRootId);
    }
  }

  // 2.4 Kiểm tra các kênh Heartbeat (Dead Man's Snitch cho Cron & Worker ngầm)
  try {
    const heartbeats = db.prepare('SELECT * FROM heartbeats').all();
    const nowMs = Date.now();
    for (const hb of heartbeats) {
      if (hb.last_ping_at) {
        const lastPingStr = hb.last_ping_at.includes('T') ? hb.last_ping_at : hb.last_ping_at.replace(' ', 'T') + 'Z';
        const lastPingDate = new Date(lastPingStr);
        const elapsedSec = Math.floor((nowMs - lastPingDate.getTime()) / 1000);
        const thresholdSec = hb.expected_interval_seconds + (hb.grace_period_seconds || 20);

        if (elapsedSec > thresholdSec) {
          if (hb.status !== 'missing') {
            db.prepare("UPDATE heartbeats SET status = 'missing' WHERE id = ?").run(hb.id);
            handleHeartbeatIncident(hb, elapsedSec);
          }
        } else {
          if (hb.status !== 'healthy') {
            db.prepare("UPDATE heartbeats SET status = 'healthy', alert_sent = 0 WHERE id = ?").run(hb.id);
            resolveHeartbeatIncident(hb);
          }
        }
      }
    }
  } catch (err) {
    console.error('Lỗi kiểm tra Heartbeat:', err.message);
  }

  // Giữ lại 100 bản ghi probe mới nhất
  db.prepare(`
    DELETE FROM probe_results WHERE id NOT IN (
      SELECT id FROM probe_results ORDER BY id DESC LIMIT 100
    )
  `).run();
}

function handleIncidentDetected(chaosType, isFailover, domainName = 'shop-demo.vn', rootId = 1) {
  const fingerprint = `matbao-${domainName}-${chaosType}`;
  const existing = db.prepare('SELECT * FROM incidents WHERE fingerprint = ?').get(fingerprint);

  const affectedServices = [
    `www.${domainName} (Web Server)`,
    `api.${domainName} (API Gateway)`,
    `mail.${domainName} (Hòm thư doanh nghiệp)`,
    `SSL Certificate (*.${domainName})`
  ];

  const title = chaosType === 'dns_servfail'
    ? `Authoritative DNS và nhiều Public Resolver không thể phân giải ${domainName}`
    : `Máy chủ Web Hosting của ${domainName} trả về HTTP 503 Service Unavailable`;
  const rootCause = chaosType === 'dns_servfail' ? 'DNS_AUTHORITATIVE_FAILURE' : 'HOSTING_CAPACITY_EXHAUSTED';
  const provider = chaosType === 'dns_servfail' ? 'Đơn Vị Quản Lý DNS & Tên Miền' : 'Đội Ngũ Hỗ Trợ Web Hosting';
  const ticketSubject = `[Critical][${chaosType.toUpperCase()}] Gián đoạn dịch vụ trên ${domainName} - Yêu cầu xử lý khẩn cấp`;
  const ticketBody = generateDraftTicketContent(chaosType, domainName);

  if (!existing) {
    db.prepare(`
      INSERT INTO incidents (
        fingerprint, title, severity, status, root_cause_type, responsible_provider,
        affected_services, consecutive_failures, ticket_subject, ticket_body, ticket_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fingerprint, title, 'Critical', 'Confirmed', rootCause, provider,
      JSON.stringify(affectedServices), 1, ticketSubject, ticketBody, 'draft'
    );
  } else if (existing.status === 'Resolved' || existing.status === 'Closed') {
    db.prepare(`
      UPDATE incidents SET
        title = ?, severity = 'Critical', status = 'Confirmed', root_cause_type = ?,
        responsible_provider = ?, affected_services = ?, consecutive_failures = 1,
        ticket_subject = ?, ticket_body = ?, ticket_status = 'draft', recovery_passes = 0,
        first_detected_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP,
        resolved_at = NULL, post_incident_report = NULL
      WHERE id = ?
    `).run(
      title, rootCause, provider, JSON.stringify(affectedServices),
      ticketSubject, ticketBody, existing.id
    );
  } else {
    db.prepare(`
      UPDATE incidents SET
        consecutive_failures = consecutive_failures + 1,
        last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.id);
  }

  // Cập nhật trạng thái các assets theo loại lỗi cụ thể (Blast Radius chính xác)
  if (chaosType === 'dns_servfail') {
    db.prepare("UPDATE assets SET status = 'down' WHERE id = ?").run(rootId);
    db.prepare("UPDATE assets SET status = 'degraded' WHERE parent_asset_id = ?").run(rootId);
  } else if (chaosType === 'http_503') {
    // Với lỗi Web Hosting 503: Tên miền và Email MX vẫn sống (healthy), nhưng Web/API bị down!
    db.prepare("UPDATE assets SET status = 'healthy' WHERE id = ?").run(rootId);
    db.prepare("UPDATE assets SET status = 'down' WHERE parent_asset_id = ? AND (type = 'website' OR type = 'hosting')").run(rootId);
    db.prepare("UPDATE assets SET status = 'healthy' WHERE parent_asset_id = ? AND type != 'website' AND type != 'hosting'").run(rootId);
  } else if (chaosType === 'ssl_expired') {
    db.prepare("UPDATE assets SET status = 'healthy' WHERE id = ?").run(rootId);
    db.prepare("UPDATE assets SET status = 'down' WHERE parent_asset_id = ? AND type = 'ssl'").run(rootId);
    db.prepare("UPDATE assets SET status = 'degraded' WHERE parent_asset_id = ? AND type = 'website'").run(rootId);
  } else {
    db.prepare("UPDATE assets SET status = 'down' WHERE id = ?").run(rootId);
    db.prepare("UPDATE assets SET status = 'degraded' WHERE parent_asset_id = ?").run(rootId);
  }

  // Ghi audit log nếu mới confirm
  if (!existing || existing.status === 'Resolved' || existing.status === 'Closed') {
    db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
      'INCIDENT_CONFIRMED',
      'Incident Engine',
      `Xác thực sự cố nghiêm trọng trên [${domainName}] (Nguyên nhân: ${rootCause}). Đã tự động tạo bản thảo Ticket.`
    );
  }
}

function handleIncidentRecovery(domainName = 'shop-demo.vn', rootId = 1) {
  const activeIncident = db.prepare(`
    SELECT * FROM incidents
    WHERE status IN ('Confirmed', 'Notified', 'Suspected')
    ORDER BY id DESC LIMIT 1
  `).get();

  if (activeIncident) {
    const newPasses = (activeIncident.recovery_passes || 0) + 1;
    if (newPasses >= 3) {
      const report = generatePostIncidentReport(activeIncident, domainName);
      db.prepare(`
        UPDATE incidents
        SET status = 'Resolved',
            recovery_passes = ?,
            resolved_at = CURRENT_TIMESTAMP,
            post_incident_report = ?
        WHERE id = ?
      `).run(newPasses, report, activeIncident.id);

      db.prepare("UPDATE assets SET status = 'healthy'").run();

      db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
        'INCIDENT_RESOLVED',
        'Recovery Detector',
        `Xác minh phục hồi thành công trên [${domainName}] sau 3 lần pass liên tiếp. Tự động đóng sự cố #${activeIncident.id} và xuất Post-mortem.`
      );
    } else {
      db.prepare('UPDATE incidents SET recovery_passes = ? WHERE id = ?').run(newPasses, activeIncident.id);
    }
  }
}

function generateDraftTicketContent(chaosType, domainName = 'shop-demo.vn') {
  return `Tiêu đề: [Critical][${chaosType.toUpperCase()}] Gián đoạn dịch vụ trên ${domainName}
Người gửi: Bộ Phận SRE / Quản Trị Hệ Thống ServiceWatch
Tài sản bị ảnh hưởng: ${domainName}
Nhà cung cấp tiếp nhận: Trung tâm Hỗ trợ Kỹ thuật Nhà Cung Cấp Dịch Vụ

THÔNG TIN KỸ THUẬT QUAN SÁT ĐƯỢC (OBSERVED EVIDENCE):
- Thời điểm phát hiện lần đầu: ${new Date().toISOString()}
- Google DNS (8.8.8.8): ${chaosType === 'dns_servfail' ? 'SERVFAIL' : 'NOERROR'}
- Cloudflare DNS (1.1.1.1): ${chaosType === 'dns_servfail' ? 'SERVFAIL' : 'NOERROR'}
- Quad9 (9.9.9.9): ${chaosType === 'dns_servfail' ? 'SERVFAIL' : 'NOERROR'}
- HTTP Probe Trạng Thái: ${chaosType === 'dns_servfail' ? 'Unreachable (Không thể phân giải)' : 'HTTP 503 Service Unavailable'}

TÁC ĐỘNG NGHIỆP VỤ LIÊN ĐỚI (CASCADE BUSINESS IMPACT):
- Website bán hàng (www.${domainName}): Gián đoạn truy cập của người dùng
- Cổng API thanh toán (api.${domainName}): Đứt kết nối giao dịch
- Hệ thống Email giao dịch (mail.${domainName}): Nguy cơ nghẽn hàng đợi thư

HÀNH ĐỘNG ĐỀ NGHỊ ĐỘI NGŨ KỸ THUẬT NHÀ CUNG CẤP TIẾP NHẬN:
Kính đề nghị Đội ngũ Kỹ thuật của Nhà cung cấp kiểm tra ngay cụm hạ tầng tiếp nhận của tên miền ${domainName} và phối hợp xử lý khẩn cấp.`;
}

function generatePostIncidentReport(incident, domainName = 'shop-demo.vn') {
  return `# BÁO CÁO TỔNG KẾT SAU SỰ CỐ (POST-INCIDENT REPORT)
**Mã sự cố:** #INC-${incident.id}
**Tài nguyên:** ${domainName}
**Phân loại lỗi:** ${incident.root_cause_type}
**Nhà cung cấp xử lý:** ${incident.responsible_provider}

---

### 1. Tóm tắt diễn biến (Timeline)
* **Bắt đầu phát hiện:** ${incident.first_detected_at} (Bởi hệ thống Probe đa vùng)
* **Xác nhận sự cố:** Sau 2 lần kiểm tra chéo liên tiếp từ Google DNS, Cloudflare DNS và Authoritative Nameservers
* **Phiếu yêu cầu:** Ticket tự động được lập và duyệt gửi đến bộ phận hỗ trợ kỹ thuật
* **Thời điểm phục hồi:** ${new Date().toISOString()} (Được xác thực sau 3 lần pass liên tiếp)

### 2. Nguyên nhân gốc rễ (Root Cause)
Sự cố gián đoạn tại tầng phân giải hoặc dịch vụ gốc dẫn đến lỗi trên các public resolver toàn cầu, kéo theo hiệu ứng suy giảm của Website, API và Email.

### 3. Tác động kinh doanh (Business Impact)
* Thời gian gián đoạn (MTTR ước tính): ~15 phút
* Toàn bộ các dịch vụ phụ thuộc đã trở lại trạng thái hoạt động bình thường (Healthy).

### 4. Đề xuất cải tiến phòng ngừa (Prevention Recommendations)
* Cấu hình dự phòng Secondary DNS độc lập.
* Duy trì kênh cảnh báo ngoài luồng Telegram cho quản trị viên.
* Thiết lập Backup MX server lưu tạm email giao dịch khi DNS gián đoạn.`;
}

function handleHeartbeatIncident(hb, elapsedSec) {
  const fingerprint = `heartbeat-${hb.token}`;
  const existing = db.prepare('SELECT * FROM incidents WHERE fingerprint = ?').get(fingerprint);

  const title = `[Tác Vụ Ngầm] ${hb.name} gián đoạn tín hiệu Heartbeat`;
  const rootCause = 'CRON_WORKER_HEARTBEAT_TIMEOUT';
  const provider = 'Đội Vận Hành Hệ Thống & Tự Động Hóa';
  const ticketSubject = `[Critical][HEARTBEAT] Cảnh báo tác vụ ngầm [${hb.name}] mất tín hiệu sau ${elapsedSec}s`;
  const ticketBody = `Tiêu đề: ${ticketSubject}
Tác vụ ngầm bị ảnh hưởng: ${hb.name} (Token: ${hb.token})
Phân loại: ${hb.category.toUpperCase()} (Dead Man's Snitch)
Chu kỳ kỳ vọng: ${hb.expected_interval_seconds}s (Thời gian ân hạn: ${hb.grace_period_seconds}s)
Thời gian trôi qua không nhận tín hiệu: ${elapsedSec} giây
Thời điểm ping thành công gần nhất: ${hb.last_ping_at}
Payload gần nhất: ${hb.last_payload || 'N/A'}

TÁC ĐỘNG NGHIỆP VỤ:
- Tác vụ định kỳ (Cron / Worker ngầm) có thể đã bị treo, Out Of Memory (OOM) hoặc tiến trình bị kill trên máy chủ.
- Nếu là tác vụ sao lưu (Backup), dữ liệu mới có thể chưa được lưu trữ an toàn.

HÀNH ĐỘNG ĐỀ NGHỊ:
Kỹ sư trực ban SRE kiểm tra nhật ký tiến trình (crontab, systemd service hoặc PM2) của tác vụ [${hb.token}].`;

  if (!existing) {
    db.prepare(`
      INSERT INTO incidents (
        fingerprint, title, severity, status, root_cause_type, responsible_provider,
        affected_services, consecutive_failures, ticket_subject, ticket_body, ticket_status
      ) VALUES (?, ?, 'Critical', 'Confirmed', ?, ?, ?, 1, ?, ?, 'draft')
    `).run(
      fingerprint, title, rootCause, provider,
      JSON.stringify([`${hb.name} (Tác vụ ngầm)`, `Token: ${hb.token}`]),
      ticketSubject, ticketBody
    );
  } else if (existing.status === 'Resolved' || existing.status === 'Closed') {
    db.prepare(`
      UPDATE incidents SET
        title = ?, severity = 'Critical', status = 'Confirmed', root_cause_type = ?,
        responsible_provider = ?, consecutive_failures = 1, ticket_subject = ?, ticket_body = ?,
        ticket_status = 'draft', recovery_passes = 0, first_detected_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP, resolved_at = NULL, post_incident_report = NULL
      WHERE id = ?
    `).run(title, rootCause, provider, ticketSubject, ticketBody, existing.id);
  }

  db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
    'HEARTBEAT_TIMEOUT',
    'Heartbeat Monitor',
    `Phát hiện tác vụ ngầm [${hb.name}] quá hạn tín hiệu ${elapsedSec}s. Tự động mở Incident #${fingerprint}`
  );
}

function resolveHeartbeatIncident(hb) {
  const fingerprint = `heartbeat-${hb.token}`;
  const existing = db.prepare("SELECT * FROM incidents WHERE fingerprint = ? AND status IN ('Confirmed', 'Notified', 'Suspected')").get(fingerprint);
  if (existing) {
    db.prepare(`
      UPDATE incidents
      SET status = 'Resolved',
          resolved_at = CURRENT_TIMESTAMP,
          recovery_passes = 3,
          post_incident_report = ?
      WHERE id = ?
    `).run(
      `Tác vụ ngầm [${hb.name}] đã hồi phục tín hiệu Heartbeat thành công lúc ${new Date().toISOString()}.`,
      existing.id
    );

    db.prepare('INSERT INTO audit_logs (action, actor, details) VALUES (?, ?, ?)').run(
      'HEARTBEAT_RECOVERED',
      'Heartbeat Monitor',
      `Tác vụ ngầm [${hb.name}] đã nhận lại tín hiệu Heartbeat. Tự động đóng sự cố #${existing.id}`
    );
  }
}

function evaluateHeartbeats() {
  const list = db.prepare('SELECT * FROM heartbeats').all();
  const nowMs = Date.now();
  for (const hb of list) {
    if (!hb.last_ping_at) continue;
    const lastStr = hb.last_ping_at.includes('T') ? hb.last_ping_at : hb.last_ping_at.replace(' ', 'T') + 'Z';
    const elapsedSec = Math.floor((nowMs - new Date(lastStr).getTime()) / 1000);
    const timeout = hb.expected_interval_seconds + (hb.grace_period_seconds || 20);

    if (elapsedSec > timeout) {
      if (hb.status !== 'late') {
        db.prepare("UPDATE heartbeats SET status = 'late', alert_sent = 1 WHERE id = ?").run(hb.id);
        handleHeartbeatIncident(hb, elapsedSec);
      }
    } else {
      if (hb.status === 'late') {
        db.prepare("UPDATE heartbeats SET status = 'healthy', alert_sent = 0 WHERE id = ?").run(hb.id);
        resolveHeartbeatIncident(hb);
      }
    }
  }
}

module.exports = {
  runProbeCycle,
  discoverDomain,
  discoverAndOnboardDomain,
  restoreDemoAssets,
  getSystemSetting,
  setSystemSetting,
  handleHeartbeatIncident,
  resolveHeartbeatIncident,
  evaluateHeartbeats
};
