# Mắt Bão ServiceWatch (Incident Bridge)

> **Dự án tham dự cuộc thi Vibe Code Challenge · Mắt Bão (Bảng Kỹ thuật)**  
> Nền tảng tự động điều phối & cầu nối xử lý sự cố hạ tầng số (Tên miền, DNS, Web Hosting, Email, SSL).

---

## 🌟 Điểm nổi bật của sản phẩm
1. **Bản đồ Phụ thuộc Tài sản số (Digital Asset Dependency Map):** Quản lý tập trung Domain, DNS, Hosting, Mail, SSL; tự động nhận diện hiệu ứng sập liên đới (Cascade Impact) khi một mắt xích gặp sự cố.
2. **Giám sát Đa tầng & Đa Resolver:** Kiểm tra đồng thời từ Google DNS (8.8.8.8), Cloudflare DNS (1.1.1.1), Quad9 (9.9.9.9) và Authoritative Nameserver Mắt Bão (`ns1.matbao.vn`).
3. **Cơ chế Chống báo động giả & Tự sinh Ticket Kỹ thuật:** Xác thực đa vùng, phân loại đúng lỗi và tự động soạn Ticket chuẩn kỹ thuật kèm log evidence chi tiết.
4. **Sổ tay Ứng cứu Khẩn cấp (Incident Playbook):** Hướng dẫn giảm thiểu thiệt hại theo ngữ cảnh: Kích hoạt trang bảo trì tạm thời (Failover Static Page), kênh cảnh báo ngoài luồng qua Telegram/Zalo, khôi phục bản ghi DNS an toàn từ Baseline Snapshot.
5. **Xác thực Phục hồi Tự động:** Tự động phát hiện khi dịch vụ ổn định trở lại sau 3 lần pass liên tiếp, tự động đóng sự cố và xuất **Báo cáo sau sự cố (Post-mortem Report)**.
6. **Mô phỏng Sự cố 1-Click (Chaos Simulator):** Nút gạt dành riêng cho Ban giám khảo kiểm chứng toàn bộ chu trình tự động mà không cần chờ sự cố mạng thật.

---

## 🛠️ Công nghệ & Cơ sở dữ liệu
* **Backend:** Node.js (Express)
* **Database:** SQLite (`better-sqlite3`) — Đọc/ghi (CRUD) dữ liệu thật với 5 bảng quan hệ: `assets`, `monitors`, `probe_results`, `incidents`, `audit_logs`.
* **Frontend:** Vanilla HTML5, Modern CSS (Glassmorphism, Dark Canvas, Responsive di động), Vanilla JS thuần tốc độ cao.
* **100% Mock Data:** Tuyệt đối không chứa mật khẩu hay dữ liệu nhạy cảm của khách hàng, đảm bảo tiêu chí an toàn của cuộc thi.

---

## 🚀 Hướng dẫn chạy thử nghiệm tại máy cục bộ

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi động máy chủ
npm start
# hoặc
npm run dev
```

Mở trình duyệt tại: `http://localhost:3000`

---

## 📋 Hướng dẫn Ban giám khảo kiểm thử (Testing Guide)
1. Mở trang chủ tại `http://localhost:3000`, quan sát các chỉ số KPI và Bản đồ phụ thuộc của `shop-demo.vn`.
2. Tại thanh **MÔ PHỎNG SỰ CỐ (CHAOS SIMULATOR)** ở trên cùng:
   * Chọn `Lỗi 1: Authoritative DNS SERVFAIL` rồi nhấn nút **"⚡ Kích Hoạt Giả Lập Lỗi"**.
   * Quan sát: Đèn cảnh báo chuyển đỏ, Bản đồ phụ thuộc đổi sang trạng thái lỗi liên đới (Domain sập kéo theo Web, API, Mail).
   * Chuyển sang tab **"🚨 Sự cố & Ticket"**: Thấy State Machine tự chuyển sang `Confirmed`, bản thảo ticket kỹ thuật tự động sinh với đầy đủ log. Nhấn nút **"🚀 Phê Duyệt & Gửi Ticket"** để nhận mã ticket Mắt Bão.
   * Chuyển sang tab **"🛡️ Sổ tay Ứng cứu"**: Thử nghiệm nút **"Kích hoạt Trang bảo trì"** hoặc **"Khôi phục DNS Baseline"**.
3. Nhấn lại nút **"🟢 Dừng Lỗi -> Chờ Phục Hồi"**:
   * Hệ thống tự động đếm 3 lần kiểm tra thành công liên tiếp từ các resolver.
   * Tự động chuyển sự cố sang `Resolved` và xuất hiện nút **"📋 Xem Báo Cáo Hậu Sự Cố"**.
4. Chuyển sang tab **"🗂️ Quản lý Tài sản"**: Thử Thêm, Sửa, Xóa tài sản để kiểm chứng thao tác CSDL thật.
