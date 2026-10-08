# TÀI LIỆU YÊU CẦU SẢN PHẨM (PRD)
## Mắt Bão ServiceWatch (Incident Bridge)

* **Tên sản phẩm:** Mắt Bão ServiceWatch (Incident Bridge)
* **Nhánh đề tài / Nhóm chủ đề:** Website / Kỹ thuật
* **Bảng thi đề xuất:** Bảng Kỹ thuật (Technical Support / Developers / System Admin)
* **Nền tảng triển khai:** Vibe Host (`vibehost.matbao.ai`)

---

### 1. BÀI TOÁN (PROBLEM STATEMENT)

Doanh nghiệp vừa và nhỏ (SME) ngày nay vận hành trên một hệ sinh thái dịch vụ số phân mảnh: Tên miền và DNS (Mắt Bão), Web Hosting / Cloud Server, Email doanh nghiệp, Chứng chỉ SSL, Cổng thanh toán...

Khi sự cố gián đoạn dịch vụ xảy ra (đặc biệt vào ban đêm hoặc ngoài giờ hành chính), doanh nghiệp đối mặt với 4 nỗi đau lớn:
* **Mù mờ danh mục tài sản số và tác động liên đới (Cascade Impact Blindness):** Doanh nghiệp không có một bản đồ tài sản số tập trung. Khi một mắt xích gặp sự cố, người quản trị không lường trước được hiệu ứng domino: ví dụ một lỗi nhỏ ở DNS Authoritative không chỉ làm sập website mà còn kéo theo toàn bộ hòm thư giao dịch khách hàng và API thanh toán ngừng hoạt động đồng loạt. Ngược lại, khi website báo lỗi, quản trị viên cũng không nắm rõ web đó đang trỏ về máy chủ/nhà cung cấp nào để ứng cứu.
* **Phát hiện chậm và cô lập lỗi thủ công:** Người quản trị mất 30–60 phút tự kiểm tra thủ công bằng các công cụ rời rạc (ping, dig, curl, check port...) nhưng không thể cô lập nguyên nhân gốc nằm ở tầng nào (Domain hết hạn? Authoritative DNS chết? Hosting quá tải HTTP 503? hay lỗi ứng dụng PHP/Database?).
* **Định tuyến sai nhà cung cấp:** Điển hình là website sập do hosting hết RAM nhưng khách hàng lại gửi ticket mắng nhà cung cấp tên miền; hoặc Authoritative DNS bị lỗi làm hỏng cả web lẫn mail nhưng khách chỉ báo lỗi web cho đội hosting, gây lúng túng và mất thời gian xử lý vòng vo.
* **Thời gian gián đoạn kéo dài do thiếu bằng chứng kỹ thuật (MTTR cao):** Khách hàng thường gửi yêu cầu hỗ trợ chung chung kiểu *"Website của tôi không vào được, nhờ kiểm tra"*. Đội hỗ trợ kỹ thuật (TS/SA) của Mắt Bão phải mất nhiều vòng hỏi lại IP, mã lỗi, ảnh chụp màn hình, log phân giải... làm gián đoạn kinh doanh của khách hàng và quá tải nhân sự hỗ trợ.

**ServiceWatch** giải quyết bài toán này bằng cách tự động hóa toàn bộ chu trình: từ lập bản đồ phụ thuộc tài sản số, giám sát đa tầng, phân tích nguyên nhân gốc và tác động liên đới, đến việc tự động soạn sẵn phiếu yêu cầu hỗ trợ (Ticket) chuẩn kỹ thuật gửi đúng nhà cung cấp.

---

### 2. NGƯỜI DÙNG (TARGET USERS)

1. **Quản trị viên hệ thống / IT Doanh nghiệp (SME):** Người chịu trách nhiệm vận hành website, email và hạ tầng số của công ty, cần công cụ phát hiện sớm và hỗ trợ điều phối sự cố nhanh chóng.
2. **Kỹ sư Hỗ trợ Kỹ thuật & Quản trị Hệ thống (TS / SA) Mắt Bão:** Tiếp nhận các phiếu yêu cầu hỗ trợ đã được chuẩn hóa với đầy đủ bằng chứng kỹ thuật (log, resolver status, mã lỗi), giúp bắt tay vào xử lý ngay lập tức mà không cần hỏi lại thông tin.
3. **Ước lượng quy mô:** Hàng chục ngàn khách hàng doanh nghiệp và cá nhân đang sử dụng tên miền, hosting, email trong hệ sinh thái Mắt Bão.

---

### 3. PHẠM VI (SCOPE)

#### 3.1. Ba chức năng cốt lõi hoàn thành trong kỳ thi (In-Scope):
1. **Quản lý Tài sản số & Giám sát Đa tầng (Asset Management & Multi-Probe Dashboard):**
   * Cho phép quản lý danh mục tài sản số (Domain, DNS, Web Hosting, Email, SSL) kèm theo sơ đồ phụ thuộc dịch vụ (Dependency Map).
   * Cơ chế kiểm tra tự động đa tầng: Phân giải DNS (A, MX, NS), Authoritative Nameserver check, HTTP/HTTPS response time và SSL handshake/hạn dùng.
2. **Động cơ Phân tích Sự cố & Soạn Ticket Tự động (Incident Engine & Ticket Composer):**
   * Cơ chế chống báo động giả: Xác thực đa vùng (Multi-resolver confirmation) và lọc trùng sự cố bằng Incident Fingerprint.
   * Phân loại chính xác nguyên nhân gốc (DNS failure vs Hosting HTTP 503 vs Mail MX drop).
   * Tự động xác định nhà cung cấp chịu trách nhiệm và tạo bản thảo Ticket (Draft Ticket) chứa đầy đủ bằng chứng kỹ thuật: Log chi tiết, danh sách record ảnh hưởng, thời điểm phát hiện, tác động kinh doanh. Có nút duyệt gửi an toàn.
3. **Xác thực Phục hồi & Báo cáo Tổng kết Sự cố (Recovery Detector & Post-Incident Report):**
   * Tự động phát hiện khi dịch vụ phục hồi bình thường dựa trên ngưỡng tin cậy (3 lần kiểm tra thành công liên tiếp từ nhiều zone).
   * Tự động đóng sự cố và xuất báo cáo sự cố (Post-mortem report) tóm tắt thời gian gián đoạn (downtime), nguyên nhân và tiến trình phục hồi.
4. **Sổ tay Ứng cứu Khẩn cấp & Cảnh báo Ngoài luồng (Emergency Playbook & Out-of-Band Alerting):**
   * Khi sự cố làm sập email hoặc website, hệ thống kích hoạt **Sổ tay ứng cứu theo ngữ cảnh (Contextual Playbook)**: Hướng dẫn các giải pháp giảm thiểu thiệt hại (kích hoạt trang bảo trì tĩnh, kiểm tra hạn tên miền, hoặc phục hồi bản ghi DNS từ bản sao lưu Baseline Snapshot).
   * Hỗ trợ kênh cảnh báo ngoài luồng (Webhook / Telegram simulator) đảm bảo người quản trị nhận được tin báo ngay cả khi email doanh nghiệp đang tê liệt.
* **Tính năng hỗ trợ Demo (Chaos Simulation Mode):** Một nút bấm giả lập sự cố (DNS SERVFAIL hoặc HTTP 503) để Ban giám khảo kiểm chứng toàn bộ workflow tự động chạy nền từ lúc bắt lỗi, kích hoạt Playbook, tạo Ticket đến khi hồi phục.

#### 3.2. Những gì KHÔNG LÀM trong kỳ thi này (Out of Scope):
* Không tự động can thiệp thay đổi cấu hình DNS hoặc can thiệp máy chủ thực tế của khách hàng.
* Không lưu trữ thông tin nhạy cảm, mật khẩu hoặc khóa API bí mật của khách hàng/nhà cung cấp.
* Không tích hợp Google Search Console hoặc quét log máy chủ nội bộ.
* Không sử dụng tự động hóa trình duyệt (Browser Automation/RPA) để đăng nhập vào portal nhà cung cấp.

---

### 4. LUỒNG CHÍNH (MAIN WORKFLOW)

```text
[1. Khai báo tài sản & Cấu hình kiểm tra]
   ↳ Người dùng thêm Domain, Hosting, Email vào hệ thống.
   ↳ Hệ thống tự động thiết lập bản đồ phụ thuộc (Dependency Map).
          ↓
[2. Giám sát & Phát hiện bất thường]
   ↳ Scheduler chạy ngầm thực hiện các probe (DNS, HTTP, SSL).
   ↳ Khi phát hiện lỗi lần 1: Hệ thống kích hoạt kiểm tra chéo từ nhiều resolver.
          ↓
[3. Phân loại sự cố & Định tuyến nhà cung cấp]
   ↳ Động cơ xác nhận sự cố, tạo Fingerprint chống trùng lặp.
   ↳ Xác định nguyên nhân gốc và dịch vụ bị gián đoạn.
   ↳ Hệ thống chọn đúng Provider liên quan (ví dụ: Mắt Bão DNS).
          ↓
[4. Soạn thảo Ticket & Kích hoạt Playbook Ứng cứu]
   ↳ Bắn cảnh báo ngoài luồng (Telegram / Webhook / SMS) tới quản trị viên.
   ↳ Mở Sổ tay ứng cứu (Playbook): Đưa ra checklist cấp cứu (trang bảo trì, rollback DNS).
   ↳ Tự động sinh bản thảo Ticket đầy đủ log và evidence kỹ thuật gửi nhà cung cấp.
   ↳ Người quản trị xem lại (Preview) và nhấn nút "Gửi Yêu Cầu" (Send to Provider).
          ↓
[5. Xác thực phục hồi & Hoàn tất]
   ↳ Khi hạ tầng hoạt động trở lại, hệ thống kiểm tra 3 lần pass liên tiếp.
   ↳ Tự động chuyển trạng thái sự cố sang "Resolved / Closed".
   ↳ Xuất báo cáo sự cố (Post-Incident Report) lưu vào lịch sử.
```

---

### 5. DỮ LIỆU CẦN LƯU (DATA SPECIFICATION)

Hệ thống sử dụng cơ sở dữ liệu quan hệ (SQLite / PostgreSQL) với 5 bảng dữ liệu hỗ trợ đầy đủ thao tác CRUD:

1. **`assets` (Quản lý tài sản số):**
   * Lưu trữ: `id`, `name`, `type` (domain, hosting, email, ssl), `target` (domain/IP), `provider_name`, `created_at`.
   * Vai trò: Lưu danh mục dịch vụ số và liên kết phụ thuộc giữa chúng.
2. **`monitors` (Cấu hình giám sát):**
   * Lưu trữ: `id`, `asset_id`, `monitor_type` (DNS, HTTP, SSL), `interval_seconds`, `is_active`.
   * Vai trò: Điều khiển chu kỳ chạy của các worker probe ngầm.
3. **`probe_results` (Kết quả đo đạc lịch sử):**
   * Lưu trữ: `id`, `monitor_id`, `checked_at`, `resolver`, `status` (SUCCESS, FAIL), `response_time_ms`, `response_code`, `raw_log`.
   * Vai trò: Cung cấp dữ liệu thô phục vụ bằng chứng kỹ thuật và vẽ biểu đồ trạng thái.
4. **`incidents` (Quản lý sự cố):**
   * Lưu trữ: `id`, `fingerprint`, `title`, `severity` (Warning, Major, Critical), `status` (Suspected, Confirmed, Sent, Resolved, Closed), `root_cause`, `ticket_subject`, `ticket_body`, `first_seen_at`, `resolved_at`.
   * Vai trò: Quản lý vòng đời sự cố và lưu trữ nội dung ticket tự sinh.
5. **`audit_logs` (Nhật ký hoạt động):**
   * Lưu trữ: `id`, `action`, `actor`, `details`, `created_at`.
   * Vai trò: Ghi vết toàn bộ hành vi gửi ticket, can thiệp của người dùng và chuyển dịch trạng thái của hệ thống.

*Cam kết an toàn dữ liệu: 100% dữ liệu dùng để chạy thử nghiệm và demo là MOCK DATA (dữ liệu giả lập, ví dụ: shop-demo.vn, ns1.provider.vn), không chứa bất kỳ dữ liệu khách hàng thật hay bí mật nội bộ nào.*

---

### 6. TIÊU CHÍ HOÀN THÀNH (DEFINITION OF DONE)

Sản phẩm được nghiệm thu đạt khi thỏa mãn toàn bộ các điều kiện sau:
1. **Khả năng truy cập & Giao diện:** Chạy hoàn chỉnh trên đường dẫn công khai của Vibe Host (`*.vibehost.matbao.ai`), giao diện thân thiện, tương thích mượt mà trên cả trình duyệt máy tính và điện thoại di động (Responsive).
2. **Cơ sở dữ liệu hoạt động thật:** Thực hiện thành công các thao tác Thêm, Sửa, Xóa (CRUD) tài sản số và cấu hình giám sát trực tiếp vào CSDL thật.
3. **Workflow tự động chạy ngầm:** Scheduler tự động ghi nhận kết quả probe vào cơ sở dữ liệu theo chu kỳ mà không cần người dùng thao tác thủ công.
4. **Kịch bản Demo Mô phỏng Sự cố (End-to-End Simulation):**
   * Khi kích hoạt chế độ "Simulated Chaos": Hệ thống tự động phát hiện lỗi DNS SERVFAIL / HTTP 503, tự động gom sự cố, xác định đúng nhà cung cấp và tạo ra bản thảo Ticket với đầy đủ thông số kỹ thuật.
   * Người dùng nhấn nút gửi ticket thành công.
   * Khi tắt chế độ lỗi: Hệ thống tự động xác nhận 3 lần kiểm tra thành công, tự đổi trạng thái sang "Resolved" và sinh Báo cáo tổng kết sau sự cố (Post-Incident Report).
5. **Độ hoàn thiện:** Không còn chữ mẫu (lorem ipsum), không còn nút bấm không hoạt động, mã nguồn lưu tại kho GitHub riêng tư và đã phân quyền cho `git@matbao.ai`.
