# ServiceWatch · Digital Infrastructure Incident Bridge

> **Đồ án tham dự cuộc thi Vibe Code Challenge · Mắt Bão (Bảng Kỹ thuật)**  
> Nền tảng tự động điều phối & cầu nối xử lý sự cố hạ tầng số (Tên miền, DNS, Web Hosting, Email, SSL) — Tối ưu hóa cho hệ sinh thái Mắt Bão Cloud.

---

## 1. Điểm nổi bật của sản phẩm
1. **Bản đồ Phụ thuộc Tài sản số (Digital Asset Dependency Map):** Quản lý tập trung Tên miền, DNS, Hosting, Mail, SSL; tự động nhận diện hiệu ứng sập liên đới (Cascade Failure Analysis) khi một mắt xích gặp sự cố.
2. **Giám sát Đa tầng & Đa Resolver:** Kiểm tra đối chiếu đồng thời từ Google DNS (8.8.8.8), Cloudflare DNS (1.1.1.1), Quad9 (9.9.9.9) và Authoritative Nameserver Mắt Bão (`ns1.matbao.vn`).
3. **Cơ chế Chống báo động giả & Tự sinh Ticket Kỹ thuật:** Xác thực đa vùng, phân loại đúng lỗi và tự động soạn Ticket chuẩn mực kèm log evidence chi tiết, hỗ trợ chủ doanh nghiệp non-tech duyệt gửi 1-chạm.
4. **Sổ tay Ứng cứu Khẩn cấp (Business Remediation Playbook):** Hướng dẫn giảm thiểu thiệt hại theo ngữ cảnh: Kích hoạt trang thông báo bảo trì tạm thời (Failover Static Page), kênh cảnh báo ngoài luồng, khôi phục bản ghi DNS an toàn từ Baseline Snapshot.
5. **Xác thực Phục hồi Tự động & Báo cáo Post-Mortem:** Tự động phát hiện khi dịch vụ ổn định trở lại sau 3 lượt pass liên tiếp (3-Pass Verification), tự động đóng sự cố và xuất báo cáo tổng kết hậu sự cố.
6. **Mô phỏng Sự cố 1-Click (Chaos Studio):** Công cụ dành riêng cho Ban giám khảo kiểm chứng toàn bộ workflow tự động chạy nền trong 5 giây mà không cần chờ sự cố mạng thật.

---

## 2. Công nghệ & Cơ sở dữ liệu
* **Backend:** Node.js (Express), Background Probe Engine chạy nền (cron cycle 8 giây/lần).
* **Database:** SQLite (`better-sqlite3`) — Đọc/ghi (CRUD) dữ liệu thật với 5 bảng quan hệ: `assets`, `monitors`, `probe_results`, `incidents`, `audit_logs`, `system_state`.
* **Frontend:** Vanilla HTML5, High-Contrast Modern Slate CSS (Hỗ trợ 2 chế độ Sáng / Tối, không phụ thuộc thư viện ngoài, tối ưu mobile), Vanilla JS thuần tốc độ cao.
* **100% Mock Data & Tuân thủ An toàn:** Tuyệt đối không chứa mật khẩu hay dữ liệu nhạy cảm của khách hàng, đảm bảo tiêu chí bảo mật tuyệt đối của cuộc thi.

---

## 3. Hướng dẫn chạy thử nghiệm tại máy cục bộ

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi động máy chủ
npm start
# hoặc
node server.js
```

Mở trình duyệt tại: `http://localhost:4100`

---

## 4. Hướng dẫn Ban Giám Khảo kiểm thử (Judging Workflow)

1. Mở trang chủ tại `http://localhost:4100`, quan sát Tấm Khiên An Toàn, các chỉ số KPI và Bản đồ phụ thuộc của `shop-demo.vn`.
2. Tại thanh điều khiển ở góc phải trên cùng Header:
   * Chọn `Mô phỏng: DNS SERVFAIL` rồi nhấn nút **"Giả Lập Lỗi"**.
   * **Quan sát:** Tấm Khiên An Toàn chuyển sang màu đỏ cảnh báo tác động sập liên đới; Bản đồ phụ thuộc đổi sang trạng thái lỗi liên đới (Domain sập kéo theo Web, API, Mail).
   * Chuyển sang tab **"Sự cố & Ticket"**: State Machine tự chuyển sang `Confirmed`, bản thảo ticket kỹ thuật tự động sinh với đầy đủ log. Nhấn nút **"Duyệt & Gửi Phiếu Hỗ Trợ Kỹ Thuật Cho Mắt Bão"** để nhận mã ticket Mắt Bão chính thức.
   * Chuyển sang tab **"Sổ tay Ứng cứu"**: Thử nghiệm nút **"Bật Trang Thông Báo Bảo Trì"** hoặc **"Khôi Phục Bản Ghi DNS Baseline"**.
3. Nhấn lại nút **"Dừng Mô Phỏng"**:
   * Hệ thống tự động đếm 3 lần kiểm tra thành công liên tiếp từ các resolver để loại trừ flapping.
   * Tự động chuyển sự cố sang `Resolved`, toàn bộ dịch vụ xanh trở lại và xuất hiện nút **"Xem Báo Cáo Phục Hồi"**.
4. Chuyển sang tab **"Quản lý Tài sản"**: Thử Thêm, Sửa, Xóa dịch vụ để kiểm chứng thao tác CSDL SQLite thật.
5. Chuyển sang tab **"Nhật ký Kiểm toán"**: Xem lịch sử ghi vết bất biến của mọi hành vi trên hệ thống.

---

## 5. Triển khai lên Vibe Host (`vibehost.matbao.ai`)

1. Đăng nhập vào cổng Vibe Host bằng tài khoản Mắt Bão `@matbao.com`.
2. Tạo ứng dụng mới từ kho Git cá nhân (hoặc đẩy mã nguồn qua Vibe Host CLI).
3. Đặt lệnh khởi động: `node server.js`.
4. Cổng lắng nghe mặc định: Đọc biến môi trường `process.env.PORT` (đã được cấu hình sẵn trong `server.js`).
