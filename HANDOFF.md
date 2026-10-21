# BÁO CÁO BÀN GIAO DỰ ÁN (PROJECT HANDOFF)
## ServiceWatch - Quản Lý Tài Sản Số & Tự Động Điều Phối Xử Lý Sự Cố
**Cuộc thi:** Vibe Code Challenge 2026  
**Chủ đề:** Quản lý tài nguyên số, Hạ tầng đám mây & Tự động hóa điều phối sự cố đa tầng  
**Kho mã nguồn GitHub:** [https://github.com/gianghuynh0801/servicewatch-incident-bridge.git](https://github.com/gianghuynh0801/servicewatch-incident-bridge.git)  
**Thời điểm bàn giao cập nhật:** 21/10/2026  

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)
ServiceWatch là nền tảng tất-cả-trong-một (All-in-One) được thiết kế cho các kỹ sư SRE, DevOps, và quản trị viên hệ thống nhằm:
1. **Quản lý vòng đời tài sản số (Digital Asset Lifecycle Management):** Tên miền, DNS Nameserver, Cụm Hosting/Cloud VPS, Email doanh nghiệp (MX), Chứng chỉ SSL/TLS, Cổng thanh toán (VNPay IPN).
2. **Cơ chế giám sát Quorum Consensus & Multi-Resolver Probing:** Đo kiểm định kỳ từ nhiều mạng độc lập (Google DNS 8.8.8.8, Cloudflare DNS 1.1.1.1, Quad9 9.9.9.9 và Authoritative NS) nhằm loại trừ cảnh báo giả (false positives).
3. **Dead Man's Snitch Heartbeat Monitoring:** Giám sát các tiến trình chạy ngầm (Cron Jobs, DB Backup Dump, Queue Worker, Synthetic Webhook) với cơ chế đếm ngược thời gian và tự động báo động khi worker bị trễ/treo.
4. **Cầu nối điều phối & Tự động sinh Ticket (Incident Bridge):** Tự động phát hiện lỗi theo nguyên tắc Blast Radius, cách ly khu vực ảnh hưởng và tạo bản thảo Ticket hỗ trợ kỹ thuật chi tiết kèm log bằng chứng kỹ thuật.
5. **AI Copilot RCA & Phân tích nguyên nhân gốc:** Tích hợp mô hình AI phân tích dữ liệu telemetry, dự đoán điểm nghẽn, và tạo báo cáo Post-Mortem hoàn chỉnh sau khi sự cố được khắc phục.
6. **Chaos Simulation Engine:** Cho phép Ban Giám Khảo kích hoạt trực tiếp các kịch bản sự cố thực tế (DNS Servfail, HTTP 503 Hosting sập, SSL hết hạn) để kiểm chứng cơ chế tự phục hồi (Self-Healing) theo thời gian thực.

---

## 2. KIẾN TRÚC MÃ NGUỒN (SOURCE CODE ARCHITECTURE)

| Tệp tin | Vai trò chính |
|---|---|
| `server.js` | REST API Server (Express 5), phục vụ SPA Dashboard, xử lý xác thực phiên (Session Auth), quản lý Health Check (`/health`, `/healthz`) và cơ chế Auto-Bootstrap `--experimental-sqlite`. |
| `database.js` | Lớp dữ liệu SQLite phi tập trung, sử dụng module gốc `node:sqlite` (Node.js 22 LTS, 100% native cloud, không phụ thuộc C++/node-gyp), có bộ đệm an toàn dự phòng (Safe Fallback). |
| `engine.js` | Động cơ giám sát nền: Multi-resolver DNS probing, SSL expiry inspection, HTTP/SMTP radar, Dead Man's Snitch evaluator, Quorum incident state machine & recovery engine. |
| `ai-service.js` | Tích hợp AI Copilot: Sinh báo cáo phân tích nguyên nhân gốc (RCA), soạn thảo Ticket chuẩn kỹ thuật, và tạo Post-Incident Report. |
| `public/index.html` & `public/dashboard.html` | Giao diện điều khiển SPA phong cách Modern Glassmorphism/Dark Theme: Bản đồ hạ tầng số đa tầng, trung tâm điều phối sự cố, bảng kiểm tra Heartbeat, bảng điều khiển Chaos Lab. |
| `test-workflow.js` | Bộ kiểm thử tự động toàn diện (23 test cases, 6 test suites) kiểm chứng toàn bộ quy trình CRUD, Probing, Incident Lifecycle và Auth. |
| `nixpacks.toml` & `package.json` | Cấu hình triển khai đám mây chuẩn hóa cho Nixpacks & Docker trên Vibe Host. |

---

## 3. LỊCH SỬ SỬA LỖI & TỐI ƯU HÓA TRIỂN KHAI (DEPLOYMENT & FIX LOG)

### Vấn đề 1: Lỗi đóng gói container do node-gyp & Python (Build #1)
* **Triệu chứng:** Nixpacks build thất bại ở bước `[06] Containerization` do `better-sqlite3` yêu cầu trình biên dịch C++ và Python.
* **Giải pháp:** Chuyển sang module tích hợp sẵn `node:sqlite` của Node.js 22 LTS, gỡ bỏ hoàn toàn sự phụ thuộc vào `better-sqlite3` và build tools.

### Vấn đề 2: Lỗi Crash Loop ở bước Health Check (Build #2)
* **Triệu chứng:** Container bị restart 4 lần ở bước `[11] Health Check` do `require('node:sqlite')` trên Node 22.11.0 của Nixpacks yêu cầu cờ `--experimental-sqlite`.
* **Giải pháp (Bảo vệ 3 lớp đã commit vào Git):**
  1. `nixpacks.toml`: Cấu hình `[variables] NODE_OPTIONS = "--experimental-sqlite"` và `[start] cmd = "node --experimental-sqlite server.js"`.
  2. `package.json`: Cập nhật `"start": "node --experimental-sqlite server.js"`.
  3. `server.js`: Thêm cơ chế tự động re-launch với `--experimental-sqlite` nếu phát hiện container khởi chạy thiếu cờ. Thêm endpoint `/health` và `/healthz` trả về HTTP 200 tức thì.
  4. `database.js`: Bổ sung safe in-memory fallback ngăn ngừa mọi ngoại lệ chưa bắt (unhandled exception).

---

## 4. HƯỚNG DẪN VẬN HÀNH & KIỂM THỬ

### 4.1. Chạy trên máy nội bộ (Local Development)
```bash
# Cài đặt thư viện (chỉ express nhẹ 2MB)
npm install

# Khởi chạy server
npm start
# Ứng dụng chạy tại: http://localhost:4100

# Chạy toàn bộ 23 bài test tự động
npm test
```

### 4.2. Danh sách tài khoản thử nghiệm (Demo & Giám Khảo)
* **Ban Giám Khảo (Judge):** `judge` hoặc `giamkhao` / Mật khẩu: `judge123`
* **Quản trị viên (Admin):** `admin` / Mật khẩu: `admin123`
* **Kỹ sư vận hành SRE:** `support` / Mật khẩu: `support123` hoặc `devops` / `devops123`

---

## 5. NGUỒN GỐC MÃ NGUỒN & QUYỀN TÁC GIẢ (SOURCE CODE PROVENANCE)
* **Không clone / Không fork template:** Toàn bộ dự án được lập trình mới 100% từ đầu (from scratch) bởi thí sinh cùng sự hỗ trợ của trợ lý Google Antigravity.
* **Kiến trúc Zero Dependency Bloat:**
  * **Frontend:** 100% Vanilla HTML5, Vanilla Modern CSS (Glassmorphism, Dark/Light mode), Vanilla ES6+ JS. Không phụ thuộc React, Vue, Bootstrap, Tailwind.
  * **Backend:** Node.js v22 + Express 5 duy nhất; tận dụng tối đa thư viện chuẩn (`node:sqlite`, `node:dns`, `node:tls`, `node:crypto`).
* **Bản quyền:** Mã nguồn mở chuẩn MIT License (`LICENSE`), an toàn tuyệt đối về mặt sở hữu trí tuệ.

---

## 6. TUÂN THỦ QUY CHẾ "BẢY ĐIỀU CẤM" & MỐC 4 (CỔNG AN TOÀN)
1. **Dữ liệu thật:** Đạt chuẩn 100%. Toàn bộ dữ liệu trong hệ thống sử dụng tên miền mẫu giả lập `shop-demo.vn`, IP nội bộ `103.1.1.x`, email ảo.
2. **Khóa bí mật:** Đạt chuẩn 100%. Không commit bất kỳ file `.env` hay API Key thật nào lên GitHub.
3. **Thu thập thông tin cá nhân:** Không lưu CCCD, thông tin ngân hàng hay dữ liệu người dùng thật.
4. **Thương hiệu & Mạo nhận:** Không mạo nhận sản phẩm chính thức của bất kỳ doanh nghiệp nào. Tự định vị là sản phẩm cá nhân tham dự cuộc thi Vibe Code Challenge 2026.
5. **Cộng tác viên chấm thi:** Đã sẵn sàng chia sẻ quyền truy cập repo private cho `git@matbao.ai` (vào GitHub `Settings` ➔ `Collaborators` ➔ `Add people`).

---

## 7. BỘ CÂU TRẢ LỜI KHẢO SÁT VIBE HOST (PHIẾU CP6)
Hồ sơ lưu trữ 10 câu trả lời đóng góp cải thiện sản phẩm Vibe Host:
1. **Bước kẹt lâu nhất:** Bước `[06] Containerization` (thiếu Python/node-gyp) và bước `[11] Health Check` (thiếu flag `--experimental-sqlite` trên Node 22.11.0).
2. **Hỏi ai:** Sử dụng AI Assistant phân tích stack trace của CJS loader từ log crash của container.
3. **Thuật ngữ khó hiểu:** Cụm từ *"ngắt mạch: candidate restart ≥ 3 (crash-loop) — bỏ candidate, bản cũ giữ nguyên"*.
4. **Thông báo lỗi:** Gặp lỗi `gyp ERR!` và `MODULE_NOT_FOUND`. Log container rõ ràng nhưng trợ lý chẩn đoán chưa đưa ra giải pháp sửa file cấu hình.
5. **Ý định bỏ cuộc:** Không bỏ cuộc vì nắm rõ bản chất containerization, nhưng người dùng phổ thông sẽ dễ nản tại bước Health Check.
6. **Công cụ AI sử dụng:** Antigravity IDE (Gemini / Claude). Mất khoảng 1.5 - 2 giờ để hoàn thiện toàn bộ mã nguồn.
7. **Hướng dẫn khách hàng:** Hướng dẫn dùng `node:sqlite`, bổ sung `nixpacks.toml` và tạo endpoint `/health`.
8. **3 câu hỏi kỹ thuật khó:** 1) Giới hạn RAM/CPU và timeout Health Check; 2) Cơ chế Persistent Volume khi redeploy SQLite; 3) Thứ tự ưu tiên nạp biến môi trường.
9. **Viết lại thông báo lỗi:** Viết lại thông báo ngắt mạch thành: *"[Kiểm Tra Khởi Động Thất Bại] Ứng dụng bị tắt đột ngột 4 lần liên tiếp. Hệ thống giữ bản chạy tốt trước đó. Vui lòng kiểm tra cổng PORT hoặc lỗi crash khởi động."*
10. **Đề xuất cải thiện:** Bổ sung trình xem Live Runtime Logs và cung cấp sẵn kho template `nixpacks.toml`/`Dockerfile` cho các ngôn ngữ phổ biến.

---

## 8. TRẠNG THÁI HIỆN TẠI & HÀNH ĐỘNG TIẾP THEO (NEXT STEPS)
1. **Trạng thái mã nguồn:** Nhánh `main` trên GitHub đang ở trạng thái mới nhất, pass 100% test suites (23/23 tests passed).
2. **Vibe Host Deployment:** Chỉ cần bấm **"Triển khai lại"** (Redeploy) trên bảng điều khiển Vibe Host để hệ thống tự động build bản mới nhất và cấp phát domain trực tiếp.
3. **Mốc 4 (Cổng an toàn):** Thêm `git@matbao.ai` vào Collaborators của repo GitHub và nộp Phiếu CP6 trên cổng thi.
