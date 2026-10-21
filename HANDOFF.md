# BÁO CÁO BÀN GIAO DỰ ÁN (PROJECT HANDOFF)
## ServiceWatch - Quản Lý Tài Sản Số & Tự Động Điều Phối Xử Lý Sự Cố
**Cuộc thi:** Vibe Code Challenge 2026  
**Chủ đề:** Quản lý tài nguyên số, Hạ tầng đám mây & Tự động hóa điều phối sự cố đa tầng  
**Kho mã nguồn GitHub:** [https://github.com/gianghuynh0801/servicewatch-incident-bridge.git](https://github.com/gianghuynh0801/servicewatch-incident-bridge.git)  
**Thời điểm bàn giao:** 21/10/2026  

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

## 5. TRẠNG THÁI HIỆN TẠI & HÀNH ĐỘNG TIẾP THEO (NEXT STEPS)
1. **Trạng thái mã nguồn:** Nhánh `main` trên GitHub đang ở trạng thái mới nhất, pass 100% test suites.
2. **Triển khai trên Vibe Host (`vibehost.matbao.ai`):** Bấm nút **"Triển khai lại"** (Redeploy) trên bảng điều khiển Vibe Host để hệ thống tự động build bản mới nhất và cấp phát domain trực tiếp.
3. **Sẵn sàng chấm thi:** Đầy đủ tài liệu PRD, kịch bản Chaos Mode và giao diện demo trực quan cho Hội đồng Giám khảo.
