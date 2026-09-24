# Thiết Kế Chi Tiết: Dashboard Tổng Quan Cho Web Money-Check

**Ngày lập:** 2026-09-24  
**Trạng thái:** Chờ phê duyệt (Pending Review)

## 1. Mục Tiêu & Phạm Vi
Bổ sung trang **Tổng quan** (Dashboard tổng hợp) vào phân hệ Quản trị (`/admin`) của ứng dụng web `money-check`:
- Cung cấp cái nhìn toàn diện về tài chính dòng tiền (tổng tiền, thực thu, nợ đọng, tỷ lệ thanh toán).
- Phân tích chi tiết từng thành viên trong đội bóng: kết hợp cả khía cạnh **chi phí / nghĩa vụ đóng tiền** và **thành tích thi đấu** (số trận ra sân, bàn thắng, kiến tạo).
- Trực quan hóa số liệu thông qua biểu đồ cột bằng thư viện `recharts`.
- Hỗ trợ xem linh hoạt theo **Tháng** (mặc định tháng hiện tại) hoặc xem toàn bộ lịch sử.

---

## 2. Kiến Trúc Điều Hướng & Cấu Trúc URL

### 2.1 Thay đổi cấu trúc URL
- `/admin`: Trang **Tổng quan** (Dashboard chính) — quản trị viên vào sẽ thấy ngay bức tranh hoạt động và tài chính tháng.
- `/admin/users`: Trang **Quản lý người dùng** (chuyển logic từ trang `/admin` cũ sang).
- Bộ lọc thời gian: URL search param `?month=YYYY-MM` (ví dụ `?month=2026-09`) hoặc `?month=all`. Mặc định khi không truyền param là tháng hiện tại theo múi giờ `Asia/Ho_Chi_Minh`.

### 2.2 Điều hướng Sidebar & Mobile Menu
- Bật mục menu **"Tổng quan"** (icon grid/dashboard) lên đầu danh sách, trỏ tới `/admin` (`active === "overview"`).
- Cập nhật mục menu **"Người dùng"** trỏ tới `/admin/users` (`active === "users"`).
- Đồng bộ trên cả `AdminShell` (desktop) và `MobileAdminMenu` (mobile).

---

## 3. Kiến Trúc Kỹ Thuật & Công Nghệ

- **Framework:** Next.js 16 (App Router), React 19.
- **Thư viện đồ thị:** `recharts` (phiên bản tương thích React 19).
- **Mô hình xử lý:**
  - **Server Component (`app/admin/page.tsx`):** Truy vấn dữ liệu từ PostgreSQL qua Prisma, tính toán tổng hợp (aggregation), xử lý múi giờ và param lọc tháng.
  - **Client Component (`app/admin/overview-charts.tsx`):** Đóng gói phần render biểu đồ của `recharts` với tính năng responsive (`ResponsiveContainer`), tooltip tương tác khi hover/tap.
- **Styling:** CSS variables hiện tại (`--brand`, `--brand-soft`, `--cream`, `--muted`, `--ink`), Tailwind CSS và thẻ panel tiêu chuẩn của ứng dụng.

---

## 4. Chi Tiết Các Khối Chức Năng Trên Trang Tổng Quan

### 4.1 Thanh điều khiển & Bộ lọc tháng
- Tiêu đề trang: "Tổng quan hoạt động & tài chính".
- Dropdown chọn tháng: Liệt kê danh sách các tháng có phát sinh trận đấu/khoản thu (sắp xếp giảm dần từ mới nhất đến cũ nhất) + tùy chọn "Tất cả các tháng".

### 4.2 Thẻ chỉ số tổng quan (KPI Cards - 4 thẻ chính)
1. **Tổng phát sinh:** Tổng tiền tất cả các khoản thu/trận đấu trong tháng (`sum(totalAmount)` hoặc `sum(amountDue)`).
2. **Thực thu:** Tổng số tiền các thành viên đã nộp (`sum(amountPaid)`).
3. **Còn thiếu (Nợ đọng):** Tổng số tiền nợ chưa thanh toán (`sum(amountDue - amountPaid)` với những người còn nợ).
4. **Tỷ lệ thu:** Phần trăm thu tiền đã đạt (`(Thực thu / Tổng phát sinh) * 100`).
- *Chỉ số phụ:* Tổng số trận đấu (`MATCH`) và số khoản thu khác (`GENERAL`) được tổ chức trong tháng.

### 4.3 Khối Biểu Đồ Trực Quan (`recharts`)
Gồm 2 biểu đồ đặt song song trên màn hình lớn (desktop) hoặc xếp dọc trên điện thoại:

1. **Biểu đồ cột: Tiến độ thu tiền theo từng khoản thu/trận đấu:**
   - Trục X: Tên trận đấu / khoản thu (kèm ngày diễn ra).
   - Cột so sánh:
     - Cột 1 (Màu trung tính/xám): Số tiền cần thu (`allocated/amountDue`).
     - Cột 2 (Màu xanh chủ đạo `var(--brand)`): Số tiền đã thực thu (`amountPaid`).
   - Tooltip: Hiển thị chi tiết số tiền Cần thu, Đã thu, Còn thiếu, và Tỷ lệ hoàn thành (%).

2. **Biểu đồ thanh ngang: Top thành viên tích cực trong tháng:**
   - Trục Y: Tên thành viên.
   - Trục X: Số lần tham gia trận đấu.
   - Thể hiện trực quan top thành viên ra sân nhiều nhất, tooltip hiển thị thêm số bàn thắng và kiến tạo.

### 4.4 Bảng Thống Kê Chi Tiết Từng Thành Viên
Bảng tổng hợp hợp nhất cả dữ liệu chi phí và hoạt động trong kỳ:
- **Cột dữ liệu:**
  1. STT / Thứ hạng.
  2. Thành viên (Avatar + Tên).
  3. Trận tham gia (Số trận ra sân).
  4. Bàn thắng (Goals).
  5. Kiến tạo (Assists).
  6. Đóng góp (G + A).
  7. Cần đóng (VNĐ).
  8. Đã đóng (VNĐ).
  9. Còn nợ (VNĐ) — làm nổi bật màu cam/đỏ nếu `> 0`.
  10. Trạng thái (Huy hiệu: "Đã hoàn thành" hoặc "Còn nợ").
- Danh sách sắp xếp mặc định: Người còn nợ nhiều nhất lên đầu, tiếp đến theo số trận tham gia và đóng góp.

---

## 5. Kế Hoạch Thay Đổi Files & Triển Khai

1. **Dependencies:** Thêm `recharts` vào `package.json`.
2. **Components & Pages:**
   - `app/admin/users/page.tsx`: Tạo mới để chứa trang quản lý người dùng chuyển sang.
   - `app/admin/page.tsx`: Viết lại thành trang Tổng quan với Server Component data loader.
   - `app/admin/overview-charts.tsx`: Tạo mới component Client chứa 2 biểu đồ `recharts`.
   - `app/components/admin-shell.tsx`: Cập nhật menu: bổ sung `overview` link `/admin`, chuyển `users` sang `/admin/users`.
   - `app/components/mobile-admin-menu.tsx`: Bổ sung `overview` vào danh sách `navigation`.
   - `app/globals.css`: Bổ sung styles cho thẻ KPI dashboard, layout grid biểu đồ, badge nợ đọng.
3. **Kiểm thử & Đóng gói:**
   - Chạy thử nghiệm build Docker / deploy cục bộ.
   - Kiểm tra hiển thị responsive trên giao diện mobile và desktop.
   - Kiểm tra các trường hợp không có dữ liệu (tháng trống) hiển thị trạng thái thân thiện.
