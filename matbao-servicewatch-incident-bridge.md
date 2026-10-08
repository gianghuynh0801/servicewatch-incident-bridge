# Mắt Bão ServiceWatch / Incident Bridge

## 1. Tóm tắt ý tưởng

Mắt Bão ServiceWatch là một nền tảng giám sát và tự động điều phối xử lý sự cố cho hệ sinh thái dịch vụ số của doanh nghiệp: domain, DNS, website, hosting, email, SSL, API và cloud server.

Hệ thống không chỉ phát hiện website hoặc DNS bị lỗi, mà còn:

- Xác định loại sự cố.
- Xác định tài sản và dịch vụ bị ảnh hưởng.
- Xác định nhà cung cấp chịu trách nhiệm.
- Thu thập bằng chứng kỹ thuật.
- Tạo email hoặc ticket có cấu trúc.
- Theo dõi phản hồi và thời gian xử lý.
- Phát hiện dịch vụ hồi phục.
- Tự động đóng incident và tạo báo cáo sau sự cố.

### Định vị

> Phát hiện sớm sự cố hạ tầng số và tự động kết nối đúng nhà cung cấp để xử lý.

### Tên gợi ý

- Mắt Bão ServiceWatch.
- Mắt Bão Incident Bridge.
- Mắt Bão InfraWatch.
- Mắt Bão OpsBridge.

---

## 2. Bài toán thực tế

Doanh nghiệp thường thuê nhiều dịch vụ khác nhau:

- Tên miền.
- DNS.
- Hosting hoặc Cloud Hosting.
- Email doanh nghiệp.
- SSL.
- Cloud Server/VPS.
- Database.
- API và webhook.
- Backup.

Khi sự cố xảy ra vào ban đêm, người quản trị thường phải tự kiểm tra thủ công:

1. Website có truy cập được không?
2. DNS có phân giải được không?
3. Lỗi nằm ở domain, DNS, hosting hay ứng dụng?
4. Email có bị ảnh hưởng không?
5. Nhà cung cấp nào cần liên hệ?
6. Gửi ticket cho ai?
7. Nội dung ticket cần có thông tin gì?
8. Đã khôi phục chưa?

Nếu chỉ gửi một email cảnh báo kiểu “website down”, đội hỗ trợ phải hỏi lại nhiều thông tin. Ý tưởng này biến quá trình đó thành một workflow có cấu trúc.

---

## 3. Ví dụ sự cố

### Tình huống

Doanh nghiệp có:

```text
shop-demo.vn
├── www.shop-demo.vn
│   └── Cloud Hosting
├── api.shop-demo.vn
│   └── Cloud Server
├── mail.shop-demo.vn
│   └── Email doanh nghiệp
└── SSL certificate
```

Lúc 22:15, hệ thống kiểm tra:

```text
A record: SERVFAIL
MX record: SERVFAIL
NS1: timeout
NS2: timeout
HTTP: unreachable
```

### Hệ thống xử lý

```text
1. Probe đầu tiên thất bại.
2. Probe thứ hai thất bại.
3. Resolver khác cũng thất bại.
4. Authoritative nameserver không phản hồi.
5. Hệ thống phân loại Critical DNS incident.
6. Dependency map cho biết website, API và email có thể bị ảnh hưởng.
7. Provider resolver xác định nhà cung cấp DNS.
8. Hệ thống tạo draft ticket có bằng chứng.
9. Người quản trị xác nhận gửi ticket.
10. DNS hồi phục sau đó.
11. Hệ thống xác minh recovery.
12. Incident được đóng và tạo báo cáo.
```

---

## 4. Luồng hoạt động tổng thể

```text
Scheduled checks
       ↓
Phát hiện lỗi
       ↓
Kiểm tra lại từ nhiều resolver/khu vực
       ↓
Phân loại nguyên nhân
       ↓
Xác định provider bị ảnh hưởng
       ↓
Tạo incident
       ↓
Gửi email / mở ticket / webhook
       ↓
Theo dõi phản hồi
       ↓
Tự đóng khi dịch vụ hồi phục
```

---

## 5. Không chỉ dùng ping DNS

Từ “ping DNS” cần được tách thành nhiều nhóm kiểm tra.

### 5.1. DNS resolution check

Kiểm tra:

- Có resolve được không.
- Thời gian phản hồi.
- Mã kết quả: `NOERROR`, `NXDOMAIN`, `SERVFAIL`, timeout.
- IP trả về có khớp baseline không.
- Record có bị thay đổi bất ngờ không.

### 5.2. Authoritative nameserver check

Không chỉ hỏi public resolver. Cần kiểm tra trực tiếp các authoritative nameserver:

```text
ns1.provider.vn
ns2.provider.vn
```

Mục tiêu là phân biệt:

- Resolver cache bị lỗi.
- Một khu vực mạng bị lỗi.
- Authoritative DNS thực sự không phản hồi.

### 5.3. Record-specific check

| Record | Ý nghĩa |
|---|---|
| A/AAAA | Website hoặc API |
| CNAME | Alias sang dịch vụ khác |
| MX | Email |
| TXT SPF | Xác thực email |
| DKIM | Chữ ký email |
| DMARC | Chính sách xác thực |
| NS | Nhà cung cấp DNS |
| CAA | Nhà cung cấp được phép cấp SSL |

Một lỗi A record không nhất thiết ảnh hưởng email. Nhưng lỗi NS hoặc zone có thể ảnh hưởng nhiều nhóm cùng lúc.

### 5.4. HTTP check

Sau khi DNS resolve được, kiểm tra tiếp:

- HTTP status.
- HTTPS handshake.
- Redirect.
- Response time.
- Nội dung kỳ vọng.
- Health endpoint.

### 5.5. SMTP và email check

Kiểm tra:

- MX resolve.
- SMTP port.
- TLS handshake.
- SPF/DKIM/DMARC.
- Gửi email test đến mailbox sandbox nếu được phép.

---

## 6. Các loại sự cố

Hệ thống cần phân biệt rõ loại lỗi, không gọi mọi lỗi là DNS:

```text
DNS resolution failure
DNS record drift
HTTP availability failure
TLS/SSL failure
Application response failure
Database dependency failure
Email delivery failure
Provider-wide incident
Unknown
```

### Ví dụ

```text
DNS: OK
HTTP: 503
```

Nguyên nhân có thể là:

- Web server quá tải.
- PHP-FPM chết.
- Database unavailable.
- Ứng dụng deploy lỗi.
- WAF chặn request.
- Hosting hết tài nguyên.

Ticket phải được định tuyến đến hosting/application team, không phải gửi nhầm như một DNS incident.

---

## 7. Xác minh sự cố trước khi gửi

Không nên gửi ticket chỉ sau một lần kiểm tra thất bại.

### Ngưỡng đề xuất

Chỉ mở incident khi có một trong các điều kiện:

- Fail liên tiếp 2–3 lần.
- Fail từ ít nhất 2 resolver.
- Authoritative nameserver cũng fail.
- Có ít nhất một tín hiệu phụ cùng lỗi.
- Lỗi kéo dài vượt ngưỡng đã cấu hình.

### Ví dụ

```text
Một resolver timeout một lần:
→ Warning, chưa gửi provider.

Ba resolver SERVFAIL liên tiếp:
→ Confirmed DNS incident.

DNS OK nhưng HTTP 503 từ ba khu vực:
→ Hosting/application incident.
```

---

## 8. Mức độ sự cố và hành động

| Mức độ | Ví dụ | Hành động |
|---|---|---|
| Warning | Một resolver timeout một lần | Ghi log, tiếp tục theo dõi |
| Degraded | DNS latency tăng trong 10 phút | Cảnh báo nội bộ |
| Major | Website HTTP 503 từ nhiều khu vực | Tạo incident, email nội bộ, có thể tạo ticket |
| Critical | DNS không resolve, NS timeout, website và mail bị ảnh hưởng | Gửi provider ticket, escalation, theo dõi recovery |

---

## 9. Liên kết với Digital Asset Dependency Map

Đây là điểm khác biệt quan trọng so với DNS monitoring thông thường.

Ví dụ dependency map:

```text
congty.vn
├── DNS Provider: Mắt Bão
├── Hosting Provider: Mắt Bão
├── Email Provider: Mắt Bão
└── Payment Provider: VNPay
```

Khi sự cố xảy ra, hệ thống định tuyến như sau:

| Sự cố | Nhà cung cấp/đội nhận |
|---|---|
| NS timeout | DNS provider |
| HTTP 503 | Hosting provider |
| SMTP connection fail | Email provider |
| Payment callback fail | Payment provider |
| SSL handshake fail | Hosting/SSL owner |
| Database connection fail | Hosting/DB owner |

Hệ thống không chỉ báo “DNS lỗi”, mà phải trả lời:

> Sự cố nằm ở đâu, ảnh hưởng đến dịch vụ nào, ai chịu trách nhiệm và ticket cần gửi gì?

---

## 10. Nội dung ticket tự động

Ticket phải chứa đủ thông tin để nhà cung cấp điều tra ngay.

```text
Subject:
[Critical][DNS] Multiple resolvers unable to resolve congty.vn

Customer:
Công ty An Phát

Affected domain:
congty.vn

First detected:
2026-10-01 22:15:00 +07

Last observed:
2026-10-01 22:22:00 +07

Affected records:
A, MX

Observed results:
- Google DNS: SERVFAIL
- Cloudflare DNS: SERVFAIL
- Quad9 DNS: timeout
- ns1.provider.vn: timeout
- ns2.provider.vn: timeout

HTTP checks:
- https://www.congty.vn: unreachable
- https://api.congty.vn: unreachable

Business impact:
- Website unavailable
- API unavailable
- Email delivery may be affected

Recent changes:
- No approved DNS change recorded in the last 24 hours

Requested action:
Please investigate authoritative DNS availability and confirm incident status.
```

---

## 11. Kênh tạo yêu cầu

Không phải nhà cung cấp nào cũng có API tạo ticket. Hệ thống nên hỗ trợ nhiều adapter:

| Kênh | Cách dùng |
|---|---|
| Email | Gửi tới địa chỉ support |
| REST API | Tạo ticket nếu provider hỗ trợ |
| Webhook | Gửi sang hệ thống incident |
| Slack/Teams | Báo nội bộ |
| Manual export | Xuất nội dung ticket |
| Browser automation | Chỉ cân nhắc sau, rủi ro cao |

### MVP nên ưu tiên

1. Email.
2. Webhook.
3. Mock ticket API để demo.

Không nên lưu mật khẩu portal của nhà cung cấp trong MVP.

---

## 12. Tự động gửi hay cần duyệt?

### Chế độ tự động

Dùng khi:

- Provider đã được xác minh.
- Email support cố định.
- Nội dung theo template.
- Incident đạt ngưỡng Critical.
- Người dùng đã bật policy cho phép gửi tự động.

### Chế độ cần duyệt

Hệ thống tạo draft để người quản trị xem:

- Người nhận.
- Tiêu đề.
- Nội dung.
- Bằng chứng.
- Tài sản bị ảnh hưởng.

Sau đó người dùng bấm xác nhận gửi.

MVP nên sử dụng chế độ draft + approval để tránh gửi nhầm hoặc tạo ticket lặp.

---

## 13. Chống gửi ticket trùng

Nếu DNS lỗi 30 phút và hệ thống check mỗi phút, không được tạo 30 ticket.

### Incident fingerprint

```text
provider + domain + failure_type + affected_records
```

Ví dụ:

```text
matbao + congty.vn + dns_servfail + A/MX
```

Nếu fingerprint giống nhau, hệ thống cập nhật incident cũ.

### State machine

```text
Healthy
  ↓
Suspected
  ↓
Confirmed
  ↓
Notified
  ↓
Acknowledged
  ↓
Investigating
  ↓
Resolved
  ↓
Closed
```

---

## 14. Theo dõi phản hồi và escalation

Ví dụ timeline:

```text
22:15 — Detected
22:17 — Confirmed
22:18 — Ticket sent
22:30 — No acknowledgement
22:45 — Escalated
23:10 — Provider replied
23:25 — Checks recovered
23:40 — Incident closed
```

### SLA timer mẫu

```text
Critical:
- Acknowledge within 15 minutes.
- Escalate after 30 minutes.

Major:
- Acknowledge within 1 hour.
- Escalate after 2 hours.
```

Nếu provider không phản hồi, hệ thống có thể:

- Gửi follow-up.
- Báo quản trị viên.
- Gửi escalation tới contact thứ hai.
- Tạo internal incident.
- Hiển thị cảnh báo SLA breach.

---

## 15. Tự động xác minh recovery

Không nên đóng incident ngay sau một lần check thành công.

### Điều kiện recovery đề xuất

- 3 lần check thành công liên tiếp.
- Từ ít nhất 2 khu vực.
- DNS record khớp baseline.
- HTTP status bình thường.
- MX check thành công nếu trước đó email bị ảnh hưởng.

### Email recovery mẫu

```text
Subject:
[Resolved] DNS issue for congty.vn

Resolved at:
2026-10-01 23:25 +07

Duration:
70 minutes

Recovery evidence:
- DNS resolved from 5/5 resolvers.
- Authoritative NS healthy.
- Website HTTP 200.
- MX record available.
```

---

## 16. Phát hiện drift

Mỗi lần kiểm tra mới cần so sánh với baseline.

### Ví dụ

Ngày 1:

```text
www.congty.vn → 103.1.1.1
MX → mail.congty.vn
```

Ngày 10:

```text
www.congty.vn → 103.2.2.2
MX → Google Workspace
```

Hệ thống tạo drift event:

```text
- A record đã đổi IP.
- MX đã đổi nhà cung cấp.
- Email dependency không còn khớp bản đồ cũ.
```

Nếu thay đổi quan trọng, yêu cầu người dùng xác nhận:

> Có phải doanh nghiệp đã chuyển email sang Google Workspace không?

---

## 17. Điểm mù và cách khắc phục

### 17.1. DNS lỗi chưa chắc do DNS provider

Có thể do resolver, ISP, DNSSEC, domain hết hạn, zone bị xóa hoặc firewall.

**Cách xử lý:** kiểm tra nhiều resolver, authoritative nameserver, HTTP và lịch sử thay đổi.

### 17.2. Website lỗi nhưng DNS bình thường

Có thể do hosting, ứng dụng, database, WAF hoặc tài nguyên máy chủ.

**Cách xử lý:** phân loại sự cố theo DNS/HTTP/TLS/application/database/email.

### 17.3. Provider không có API

**Cách xử lý:** hỗ trợ email, webhook, manual export và adapter API khi có.

### 17.4. Gửi ticket trùng

**Cách xử lý:** fingerprint, deduplication và state machine.

### 17.5. Dependency bị bỏ sót

DNS không phát hiện được cron, webhook, queue, IP trực tiếp hoặc API ít khi gọi.

**Cách xử lý:** kết hợp DNS/HTTP, config, source, log, runtime test và xác nhận thủ công.

### 17.6. Dữ liệu bị lỗi thời

**Cách xử lý:** lưu `last_checked`, freshness, baseline và drift detection.

### 17.7. AI suy luận sai provider

**Cách xử lý:** hiển thị evidence, confidence, trạng thái `Potential` hoặc `Unverified`; không biến suy đoán thành fact.

---

## 18. Thiết kế multi-source discovery

### Nguồn 1: DNS và TLS

- A/AAAA.
- CNAME.
- MX.
- TXT.
- SPF.
- DKIM.
- DMARC.
- Certificate SAN.
- Certificate issuer.
- Certificate expiry.

### Nguồn 2: HTTP và website scan

- Redirect.
- HTTP status.
- Header.
- HTML.
- JavaScript.
- External domains.
- API endpoint công khai.
- Form action.

### Nguồn 3: Config đã che secret

- `.env.example`.
- `docker-compose.yml`.
- `wp-config.php` đã che secret.
- Cấu hình SMTP.
- Danh sách webhook.
- Danh sách cron.
- OpenAPI specification.

### Nguồn 4: Log

- Access log.
- Error log.
- DNS query log.
- Webhook log.
- Email delivery log.
- Reverse proxy log.

### Nguồn 5: Người dùng xác nhận

```text
Website này có dùng cổng thanh toán không?
[Không] [Có: VNPay] [Chưa biết]
```

---

## 19. Confidence và evidence

Mỗi relationship cần có:

- Nguồn phát hiện.
- Thời điểm kiểm tra.
- Mức độ tin cậy.
- Trạng thái xác minh.
- Bằng chứng.

### Trạng thái

```text
Detected
Potential
Confirmed
User-declared
Stale
Rejected
```

### Điểm tham khảo

| Bằng chứng | Điểm |
|---|---:|
| Người dùng xác nhận | +40 |
| Runtime log | +35 |
| DNS trực tiếp liên quan | +20 |
| Tìm thấy trong config | +20 |
| Tìm thấy trong source | +15 |
| Fingerprint provider | +10 |
| Dữ liệu cũ | -15 |

Điểm chỉ là chỉ báo. Không nên hiển thị như sự thật tuyệt đối.

---

## 20. Mô hình dữ liệu

### `monitors`

```text
id
asset_id
monitor_type
target
interval_seconds
regions
enabled
threshold_config
```

### `probe_results`

```text
id
monitor_id
checked_at
region
status
latency_ms
response_code
error_code
raw_result
```

### `incidents`

```text
id
fingerprint
title
severity
status
root_cause_type
first_detected_at
last_seen_at
resolved_at
confidence
```

### `incident_assets`

```text
incident_id
asset_id
impact_type
evidence
```

### `provider_connectors`

```text
id
provider_name
channel_type
endpoint
recipient
credential_ref
enabled
```

### `outbound_actions`

```text
id
incident_id
channel
action_type
status
sent_at
acknowledged_at
external_ticket_id
```

### `audit_logs`

```text
id
actor_id
action_type
entity_type
entity_id
before_data
after_data
created_at
```

---

## 21. Kiến trúc hệ thống

```text
                 ┌──────────────────┐
                 │ Scheduler/Queue  │
                 └────────┬─────────┘
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
   DNS Probe        HTTP Probe        SSL Probe
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                 ┌──────────────────┐
                 │ Result Aggregator│
                 └────────┬─────────┘
                          ▼
                 ┌──────────────────┐
                 │ Incident Engine  │
                 └────────┬─────────┘
                          ▼
                ┌───────────────────┐
                │ Provider Resolver │
                └────────┬──────────┘
                         ▼
             ┌────────────────────────┐
             │ Email/API/Webhook      │
             │ Ticket Adapter          │
             └────────────────────────┘
```

### Module chính

- `Probe Scheduler`.
- `DNS Checker`.
- `HTTP Checker`.
- `TLS Checker`.
- `SMTP Checker`.
- `Baseline Manager`.
- `Incident Correlator`.
- `Provider Resolver`.
- `Ticket Composer`.
- `Notification Dispatcher`.
- `Escalation Manager`.
- `Recovery Detector`.
- `Audit Log`.

---

## 22. Google Search Console integration

Website có thể kết nối Google Search Console qua OAuth 2.0 và dùng dữ liệu như một nguồn evidence bổ sung.

### Có thể lấy

- Search Analytics: clicks, impressions, CTR, average position.
- Query và page performance.
- Sitemap status.
- URL Inspection.
- Danh sách property người dùng có quyền.

### Vai trò trong sản phẩm

```text
Domain
  ↓
Website
  ↓
Google Search Console Property
  ↓
Sitemap
  ↓
Indexed URLs
  ↓
Search Performance
```

Ví dụ sau migration:

```text
- HTTP 200.
- SSL hợp lệ.
- Search Console connected.
- Sitemap submitted.
- Trang traffic cao cần inspect.
- So sánh click/impression trước và sau thay đổi.
```

### Lưu ý

Search Console không thay thế monitoring realtime. Dữ liệu có độ trễ và API có quota. Chỉ nên inspect các URL quan trọng, URL vừa thay đổi hoặc URL có lỗi.

---

## 23. MVP trong hai tuần

### Monitor

- DNS A.
- DNS MX.
- DNS NS.
- HTTP status.
- SSL expiry.

### Provider

- Một provider mẫu là Mắt Bão.
- Một provider khác để chứng minh extensibility.
- Email support.
- Webhook mock hoặc ticket API giả lập.

### Incident scenarios

1. DNS trả `SERVFAIL`.
2. A record đổi bất ngờ.
3. Website trả HTTP 503.
4. SSL sắp hết hạn.
5. MX không resolve được.

### Tính năng bắt buộc

- Multi-check confirmation.
- Incident deduplication.
- Severity.
- Evidence timeline.
- Draft ticket.
- Gửi email sau khi người dùng xác nhận.
- Recovery detection.
- Audit log.

### Kế hoạch 14 ngày

#### Ngày 1–2

- Chốt asset model.
- Chốt incident model.
- Chốt provider connector.
- Chuẩn bị dữ liệu mô phỏng.

#### Ngày 3–4

- CRUD domain, website, hosting, email, SSL.
- Tạo dependency map.

#### Ngày 5–6

- DNS probe.
- HTTP probe.
- SSL probe.
- Lưu probe results.

#### Ngày 7–8

- Incident engine.
- Threshold.
- Severity.
- Fingerprint và deduplication.

#### Ngày 9–10

- Provider resolver.
- Ticket composer.
- Email/webhook adapter.
- Draft + approval.

#### Ngày 11

- Recovery detector.
- SLA timer.
- Escalation.

#### Ngày 12

- Dashboard.
- Timeline.
- Evidence panel.
- Incident detail page.

#### Ngày 13

- Google Search Console connection hoặc mock integration.
- Post-incident report.

#### Ngày 14

- Dữ liệu demo.
- Kiểm thử end-to-end.
- Chuẩn bị thuyết trình.

---

## 24. Kịch bản demo dự thi

### Bối cảnh

```text
Domain: shop-demo.vn
DNS provider: Mắt Bão
Hosting provider: Mắt Bão
Email provider: Mắt Bão
```

### Sự cố mô phỏng

```text
A record: SERVFAIL
MX record: SERVFAIL
NS1: timeout
NS2: timeout
HTTP: unreachable
```

### Luồng demo

1. Dashboard hiển thị monitor đang hoạt động.
2. Probe đầu tiên fail.
3. Probe từ resolver thứ hai cũng fail.
4. Hệ thống xác nhận Critical DNS incident.
5. Dependency map liệt kê website, API và email bị ảnh hưởng.
6. Provider resolver xác định Mắt Bão là bên liên quan.
7. Ticket draft được sinh tự động.
8. Người dùng kiểm tra evidence và bấm Send.
9. Hệ thống tạo ticket ID giả lập.
10. Dữ liệu mô phỏng được khôi phục.
11. Hệ thống xác nhận recovery sau ba lần pass.
12. Incident chuyển sang Closed.
13. Post-incident report được tạo.

### Câu nói nổi bật

> Hệ thống không chỉ báo DNS lỗi. Nó xác định sự cố có khả năng nằm ở authoritative DNS, chỉ ra website, API và email bị ảnh hưởng, đồng thời chuẩn bị ticket gửi đúng nhà cung cấp kèm đầy đủ bằng chứng.

---

## 25. Điểm mới so với DNS monitoring thông thường

DNS monitoring và alert qua email/webhook đã tồn tại. Vì vậy, phần “ping DNS rồi gửi mail” nếu đứng riêng sẽ chưa đủ mới.

Điểm khác biệt của sản phẩm là:

- Hiểu dependency map.
- Xác định provider chịu trách nhiệm.
- Phân biệt DNS, hosting, mail và SSL incident.
- Gom nhiều lỗi thành một incident.
- Tạo ticket có bằng chứng kỹ thuật.
- Theo dõi acknowledgement và SLA.
- Tự phát hiện recovery.
- Sinh post-incident report.
- Có chế độ approval trước khi gửi.
- Liên kết tác động kỹ thuật với business service.

### Định vị

> Không chỉ phát hiện sự cố, mà tự động điều phối quy trình xử lý sự cố với đúng nhà cung cấp.

---

## 26. Các giới hạn cần nói rõ

MVP không nên hứa phát hiện 100% dependency.

Các điểm mù gồm:

- Cron job chạy ít khi.
- Webhook hoặc API chỉ được gọi trong điều kiện đặc biệt.
- Kết nối bằng IP trực tiếp.
- Dependency nằm trong hệ thống nội bộ.
- Payment gateway có whitelist IP.
- Queue và worker bất đồng bộ.
- Backup không được kiểm tra restore.
- Provider không có API.
- Dữ liệu scan bị lỗi thời.

Thông điệp nên dùng:

> Hệ thống lập bản đồ dựa trên nhiều nguồn, hiển thị bằng chứng và mức độ tin cậy; khi dữ liệu chưa đủ, hệ thống đánh dấu unknown thay vì kết luận chắc chắn.

---

## 27. Nguyên tắc sản phẩm

1. Không phát hiện được không có nghĩa là không tồn tại.
2. Mọi dependency quan trọng phải có bằng chứng.
3. Mọi suy luận của AI phải hiển thị độ tin cậy.
4. Mọi thay đổi nguy hiểm phải yêu cầu người xác nhận.
5. Mọi bản đồ phải có thời gian kiểm tra và trạng thái lỗi thời.
6. Không tự lưu password, API key hoặc secret.
7. Không tự gửi ticket nếu chưa đạt ngưỡng và policy cho phép.
8. Không tự đóng incident chỉ sau một lần check thành công.
9. Mọi outbound action phải có audit log.
10. Ưu tiên giải thích rõ ràng hơn là tự động hóa quá mức.

---

## 28. Kết luận

Mắt Bão ServiceWatch/Incident Bridge là sự kết hợp của:

```text
Dependency Map
+ Synthetic Monitoring
+ Incident Correlation
+ Provider Routing
+ Ticket Automation
+ Recovery Verification
+ Optional Google Search Console Evidence
```

Sản phẩm phù hợp với lĩnh vực domain, hosting, email, cloud và website của Mắt Bão. Để hoàn thiện trong cuộc thi, cần tập trung vào một vòng đời incident hoàn chỉnh:

```text
Detect → Verify → Understand impact → Route → Notify → Escalate → Recover → Report
```

Giá trị cốt lõi:

> Tự động xác định sự cố đang nằm ở đâu, ảnh hưởng đến dịch vụ nào, nhà cung cấp nào chịu trách nhiệm và ticket cần gửi gì để xử lý nhanh nhất.
