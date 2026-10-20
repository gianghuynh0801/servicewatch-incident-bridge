# TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD)
# ServiceWatch · Quản Lý Tài Sản Số & Điều Phối Xử Lý Sự Cố

---

## 1. TỔNG QUAN Ý TƯỞNG & ĐỊNH VỊ SẢN PHẨM

* **Tên sản phẩm:** ServiceWatch - Quản Lý Tài Sản Số & Điều Phối Xử Lý Sự Cố
* **Khẩu hiệu (Tagline):** Nền tảng quản lý bản đồ tài sản số và tự động điều phối xử lý sự cố (Tên miền, DNS, Web Hosting, Email, SSL).
* **Định vị:** Quản lý tập trung bản đồ phụ thuộc tài sản số, phát hiện sớm sự cố, đối chiếu đa tầng khử báo động giả và tự động kết nối đúng nhà cung cấp để xử lý nhanh nhất.

---

## 2. BÀI TOÁN THỰC TẾ (PROBLEM STATEMENT)

Doanh nghiệp vừa và nhỏ thường thuê nhiều dịch vụ số phân tán:
1. Tên miền & DNS phân giải
2. Máy chủ Web Hosting / Cloud VPS
3. Hệ thống hòm thư Email doanh nghiệp (MX, SPF, DKIM)
4. Chứng chỉ bảo mật SSL / TLS
5. Các tác vụ định kỳ (Cron Jobs, sao lưu Database)

### Thực trạng khó khăn:
* **Khi sự cố xảy ra ban đêm:** Người quản trị thường phát hiện trễ khi khách hàng phàn nàn. Khi kiểm tra thủ công, họ không phân biệt được lỗi do đâu (do DNS bị ngắt quãng, do hosting quá tải HTTP 503, hay do email bị khóa).
* **Gửi nhầm đầu mối:** Sự cố do máy chủ web bị quá tải nhưng người quản trị lại gửi ticket nhầm sang đơn vị quản lý tên miền, làm mất từ 2 đến 4 giờ chuyển tiếp qua lại.
* **Nội dung ticket thiếu bằng chứng:** Người dùng chỉ báo chung chung "website của tôi bị lỗi", khiến đội hỗ trợ kỹ thuật phải hỏi đi hỏi lại log, IP, resolver, gây chậm trễ khôi phục (MTTR tăng cao).
* **Thời gian lãng phí:** Trung bình mất từ 45 - 90 phút cho mỗi sự cố chỉ để xác minh và gửi được ticket đúng chỗ.

---

## 3. NGƯỜI DÙNG MỤC TIÊU (TARGET AUDIENCE)

1. **Chủ doanh nghiệp & Nhà quản lý kinh doanh:** Người không chuyên sâu kỹ thuật IT, cần nắm bắt ngay tác động thực tế (khách hàng có mua được hàng không, email có bị nghẽn không) và có nút 1-chạm để gửi cứu trợ kỹ thuật.
2. **Kỹ sư vận hành, Webmaster, DevOps:** Cần hệ thống giám sát đa vùng độc lập, tự động cô lập nguyên nhân gốc (RCA), lưu vết bằng chứng (telemetry logs) và hỗ trợ sổ tay ứng cứu (Failover Static Page).
3. **Đội ngũ Hỗ trợ Kỹ thuật của Nhà cung cấp (NOC/Support):** Nhận được phiếu yêu cầu hỗ trợ có cấu trúc chuẩn SRE, kèm đầy đủ log phân giải mạng, giúp xử lý dứt điểm ngay lần đầu (First-Contact Resolution).

---

## 4. PHẠM VI TÍNH NĂNG (PRODUCT SCOPE)

### 4.1. Bản Đồ Phụ Thuộc Tài Sản Số (Digital Asset Dependency Map)
* Quản lý phân cấp hình cây (Tree Topology) giữa Tên miền ➔ DNS ➔ Web Hosting ➔ Email ➔ SSL.
* Tự động tính toán lan truyền sự cố (Blast Radius): khi DNS Authoritative chết, hệ thống lập tức cảnh báo hiệu ứng sập dây chuyền lên Website và Email.

### 4.2. Cơ Chế Giám Sát Đa Tầng & Đồng Thuận Quorum (Chống Báo Động Giả)
* Thăm dò độc lập từ 4 resolver lớn: VNPT (203.162.4.190), Viettel (203.113.131.1), Cloudflare (1.1.1.1) và Authoritative Nameserver.
* **Ngưỡng đồng thuận Quorum:** Chỉ mở sự cố khi có ít nhất 2/3 resolver cùng xác nhận lỗi liên tiếp, loại bỏ 100% tình trạng cache giả hoặc chập chờn mạng cục bộ.

### 4.3. AI SRE Copilot & Cấu Hình API Key Thời Gian Thực
* Tích hợp mô hình Google Gemini 1.5 Flash Cloud phân tích telemetry mạng thô, trích xuất nguyên nhân cốt lõi trong 1.2s.
* Hỗ trợ giao diện cấu hình API Key cá nhân kèm nút kiểm tra kết nối (live ping test).
* Chế độ dự phòng (fallback) tự động sang AI SRE Engine tích hợp sẵn offline (<1s) không phụ thuộc mạng ngoài.

### 4.4. Lộ Trình Xử Lý Sự Cố 3 Bước (3-Step Action Roadmap)
* **Bước 1: Chẩn đoán lỗi & Khử báo động giả:** Tóm tắt 2 dòng ngắn gọn; ẩn chi tiết kỹ thuật sâu bên dưới khối gập/mở.
* **Bước 2: Gửi phiếu hỗ trợ kỹ thuật (Hành động chính):** Nút nổi bật `1-Click Sao Chép & Mở Cổng Dịch Vụ` tự động copy trọn vẹn văn bản ticket và mở Cổng hỗ trợ nhà cung cấp; ẩn khối log thô 50 dòng để người dùng không bị rối loạn.
* **Bước 3: Tự động giám sát & Xác thực phục hồi:** Tự động đo kiểm 3 chu kỳ liên tiếp (3-Pass Verification) để đảm bảo dịch vụ đã thông suốt hoàn toàn trước khi tự động đóng sự cố.

### 4.5. Hạn Dịch Vụ & Giám Sát Tác Vụ Ngầm (Dead Man's Snitch)
* Cảnh báo vòng đời gia hạn tên miền, SSL, gói hosting trước 30/15/7 ngày.
* Giám sát các tiến trình ngầm (Cron Jobs, Database Backup) thông qua Webhook Heartbeat. Báo động khẩn cấp nếu cron bị treo hoặc trễ hẹn quá 120 giây.

### 4.6. Phòng Thí Nghiệm Giả Lập Lỗi (Chaos Lab 1-Click)
* Cung cấp công tắc 1-Click bật/tắt thử nghiệm sự cố (Lỗi Tên miền DNS SERVFAIL hoặc Lỗi Quá tải Web HTTP 503) để kiểm chứng toàn bộ quy trình tự động trong 5 giây.

---

## 5. KIẾN TRÚC KỸ THUẬT & DỮ LIỆU (ARCHITECTURE)

* **Backend:** Node.js, Express REST API, Autonomous Background Probing Worker (chu kỳ 8s).
* **Database:** SQLite (`better-sqlite3`) lưu trữ bền vững với 8 bảng quan hệ: `assets`, `monitors`, `probe_results`, `incidents`, `audit_logs`, `system_state`, `users`, `heartbeats`.
* **Frontend:** Vanilla HTML5 / Modern CSS / Vanilla JavaScript tốc độ cao, hỗ trợ Light & Dark theme, responsive trên thiết bị di động, 100% icon SVG kỹ thuật.
* **An toàn dữ liệu:** 100% dữ liệu thử nghiệm giả lập (mock data), không lưu trữ thông tin mật khẩu hay dữ liệu nhạy cảm của khách hàng thật.

---

## 6. LỢI ÍCH & HIỆU QUẢ KINH DOANH (BUSINESS IMPACT)

1. **Giảm 80% thời gian phục hồi (MTTR):** Rút ngắn quy trình từ 60 phút xuống dưới 5 phút.
2. **Loại bỏ gửi nhầm đầu mối:** Định tuyến chính xác 100% đến đơn vị chịu trách nhiệm thực sự.
3. **Giảm tải cho đội ngũ hỗ trợ:** Phiếu hỗ trợ có sẵn log đo lường giúp kỹ sư xử lý ngay mà không phải hỏi lại thông tin.
4. **Bảo vệ doanh thu kinh doanh:** Cảnh báo sớm giúp doanh nghiệp không bị gián đoạn đơn hàng hay thất lạc email khách hàng quan trọng.
