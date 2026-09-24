# Overview Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng trang Dashboard Tổng quan tại `/admin` cho ứng dụng web `money-check` với 4 thẻ KPI tài chính, 2 biểu đồ Recharts (tiến độ thu tiền & top thành viên), bảng chi tiết nghĩa vụ đóng tiền & thành tích của từng thành viên, kèm bộ lọc theo tháng.

**Architecture:** Server Component tại `app/admin/page.tsx` truy vấn PostgreSQL thông qua Prisma để tổng hợp số liệu theo tháng hoặc toàn thời gian. Client Component `app/admin/overview-charts.tsx` phụ trách hiển thị biểu đồ tương tác Recharts. Cập nhật điều hướng sidebar và mobile menu để `/admin` trỏ về Tổng quan và `/admin/users` trỏ về Quản lý người dùng.

**Tech Stack:** Next.js 16 (App Router), React 19, Recharts, Prisma, PostgreSQL, Tailwind CSS v4, DaisyUI.

**Spec:** `docs/superpowers/specs/2026-09-24-overview-dashboard-design.md`

## Global Constraints

- Menu Tổng quan nằm ở vị trí đầu tiên trong Sidebar và Mobile Menu, trỏ tới `/admin`.
- Trang Người dùng chuyển sang `/admin/users`, giữ nguyên đầy đủ chức năng quản lý người dùng hiện tại.
- Hỗ trợ xem số liệu theo tháng qua URL parameter `?month=YYYY-MM` hoặc `?month=all`. Mặc định khi không có param là tháng hiện tại theo múi giờ `Asia/Ho_Chi_Minh`.
- Biểu đồ phải tương thích hoàn toàn với React 19 và hiển thị responsive mượt mà trên cả desktop và mobile.
- Giữ vững tone & mood thiết kế hiện tại: màu chủ đạo `#12624c` (`--brand`), nền `--cream`, các card panel bo góc tiêu chuẩn.

## Review Focus

1. **Tháng không có dữ liệu trận đấu hoặc khoản thu nào:** Dashboard hiển thị trạng thái rỗng thân thiện (empty state) mà không gây crash hay lỗi chia cho 0 (`NaN%`).
2. **Thành viên có trận đấu nhưng không phát sinh phí (miễn phí) hoặc ngược lại:** Bảng thành viên tính toán chính xác tổng chi phí cần đóng, đã đóng và nợ đọng.
3. **Múi giờ `playedAt`:** Lưu ý trường `playedAt` trong DB dạng Date (`@db.Date`), cần bóc tách đúng `YYYY-MM` theo giờ Việt Nam (`Asia/Ho_Chi_Minh`).
4. **Hiển thị biểu đồ trên màn hình nhỏ:** Biểu đồ không bị tràn khung (overflow) hay bể chữ trục X/Y trên thiết bị di động.
5. **Đăng nhập và phân quyền:** Truy cập `/admin` và `/admin/users` đều được bảo vệ bởi middleware xác thực admin trong `proxy.ts`.

---

### Task 1: Thêm thư viện `recharts` vào dự án

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: npm registry
- Produces: `recharts` available in `node_modules`

- [ ] **Step 1: Cập nhật package.json bổ sung `recharts`**

Thêm `recharts` vào mục `dependencies` của `package.json`.

- [ ] **Step 2: Cài đặt và cập nhật lockfile**

Chạy cài đặt thông qua container Docker hoặc pnpm để cập nhật `pnpm-lock.yaml`.

- [ ] **Step 3: Kiểm tra import thử nghiệm**

Kiểm tra import `recharts` không bị lỗi cú pháp hay thiếu module.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "deps: add recharts for dashboard data visualization"
```

---

### Task 2: Tái cấu trúc Route: Chuyển User Manager sang `/admin/users` & Cập nhật Navigation

**Files:**
- Create: `app/admin/users/page.tsx`
- Modify: `app/components/admin-shell.tsx`
- Modify: `app/components/mobile-admin-menu.tsx`

**Interfaces:**
- Consumes: `UsersManager` từ `@/app/components/users-manager`
- Produces: Route `/admin/users` và các link menu điều hướng kích hoạt `overview`

- [ ] **Step 1: Tạo route `app/admin/users/page.tsx`**

Chuyển nội dung hiển thị `UsersManager` từ `app/admin/page.tsx` (hoặc `app/page.tsx`) sang route mới `app/admin/users/page.tsx`.

- [ ] **Step 2: Cập nhật `AdminShell`**

Cập nhật `AdminSection` union type thêm `"overview"`. Thay đổi mục "Tổng quan" từ thẻ disabled thành `<Link href="/admin">`, và sửa link "Người dùng" thành `/admin/users`.

- [ ] **Step 3: Cập nhật `MobileAdminMenu`**

Thêm item `{ key: "overview", href: "/admin", label: "Tổng quan" }` lên đầu mảng `navigation`, cập nhật key `users` href thành `/admin/users`.

- [ ] **Step 4: Commit**

```bash
git add app/admin/users/page.tsx app/components/admin-shell.tsx app/components/mobile-admin-menu.tsx
git commit -m "feat(nav): enable overview menu at /admin and move users to /admin/users"
```

---

### Task 3: Xây dựng Module tổng hợp dữ liệu Dashboard

**Files:**
- Create: `lib/dashboard.ts`

**Interfaces:**
- Consumes: Prisma models (`FootballSession`, `SessionMember`, `User`)
- Produces: 
  - `getAvailableMonths(): Promise<Array<{ key: string; label: string }>>`
  - `getDashboardData(selectedMonth?: string): Promise<DashboardData>`

- [ ] **Step 1: Định nghĩa kiểu dữ liệu `DashboardData`**

Bao gồm:
- `kpi`: `totalAmount`, `totalPaid`, `outstanding`, `completionRate`, `matchCount`, `otherCount`
- `chartSessions`: `Array<{ name: string; date: string; amountDue: number; amountPaid: number; outstanding: number }>`
- `chartTopMembers`: `Array<{ name: string; appearances: number; goals: number; assists: number }>`
- `memberRows`: `Array<{ id: string; name: string; avatarKey: string | null; appearances: number; goals: number; assists: number; contributions: number; amountDue: number; amountPaid: number; outstanding: number }>`
- `availableMonths`: `Array<{ key: string; label: string }>`
- `currentMonth`: `string`

- [ ] **Step 2: Cài đặt logic truy vấn và tổng hợp trong `lib/dashboard.ts`**

Viết các hàm query Prisma, lọc theo `playedAt` từ đầu tháng đến cuối tháng (hoặc `all`), tính tổng hợp số tiền và số bàn thắng/kiến tạo/ra sân.

- [ ] **Step 3: Kiểm tra tính toán độc lập**

Viết script test ngắn chạy qua node/docker kiểm tra output dữ liệu trả về chính xác với dữ liệu thực tế trong DB.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard.ts
git commit -m "feat(dashboard): add data aggregation queries and metric helpers"
```

---

### Task 4: Tạo Client Component Biểu Đồ `OverviewCharts`

**Files:**
- Create: `app/admin/overview-charts.tsx`

**Interfaces:**
- Consumes: `chartSessions` và `chartTopMembers` từ `DashboardData`
- Produces: Giao diện 2 biểu đồ Recharts responsive

- [ ] **Step 1: Tạo Client Component `"use client"`**

Xây dựng component `OverviewCharts` nhập các thành phần từ `recharts` (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `CartesianGrid`).

- [ ] **Step 2: Tùy biến Tooltip hiển thị chuẩn tiền tệ VNĐ**

Format tooltip hiển thị rõ ràng: Cần thu (VNĐ), Đã thu (VNĐ), Còn thiếu (VNĐ) và Tỷ lệ %.

- [ ] **Step 3: Xử lý fallback khi danh sách trống**

Nếu tháng được chọn chưa có trận/khoản thu nào, hiển thị card thông báo nhẹ nhàng thay vì để biểu đồ trống rỗng.

- [ ] **Step 4: Commit**

```bash
git add app/admin/overview-charts.tsx
git commit -m "feat(dashboard): add interactive recharts client component"
```

---

### Task 5: Xây dựng Trang Tổng Quan `app/admin/page.tsx` và Bộ Lọc Tháng

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `app/admin/month-selector.tsx`

**Interfaces:**
- Consumes: `lib/dashboard.ts`, `app/admin/overview-charts.tsx`, `AdminShell`
- Produces: Trang Dashboard hoàn chỉnh tại `/admin`

- [ ] **Step 1: Tạo `MonthSelector` client component**

Dropdown chuyển nhanh giữa các tháng và xem "Tất cả các tháng", cập nhật URL qua `router.push('/admin?month=' + value)`.

- [ ] **Step 2: Cài đặt Server Component `app/admin/page.tsx`**

Đọc `searchParams`, gọi `getDashboardData(month)`, render:
- Header & `MonthSelector`
- 4 thẻ KPI cards
- Component `OverviewCharts`
- Bảng chi tiết thành viên đầy đủ: Cần đóng, Đã đóng, Còn nợ (highlight cảnh báo), Ra sân, Bàn thắng, Kiến tạo.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx app/admin/month-selector.tsx
git commit -m "feat(dashboard): implement overview dashboard page with kpis, charts and member table"
```

---

### Task 6: Bổ sung CSS Styling cho Dashboard

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Tailwind classes và biến CSS (`--brand`, `--brand-soft`, `--cream`)
- Produces: Styles cho KPI grid, Chart container, Month selector, Table status badges

- [ ] **Step 1: Thêm styles cho KPI summary cards**

Grid 4 cột trên desktop, 2 cột trên tablet/mobile, hiển thị số to rõ, viền bo tròn nhẹ, badge màu sắc phù hợp.

- [ ] **Step 2: Thêm styles cho container biểu đồ**

Đảm bảo chiều cao biểu đồ tối ưu (320px–360px) và không tràn mép trên điện thoại.

- [ ] **Step 3: Thêm styles cho các badge trạng thái nợ / đã xong trong bảng**

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style(dashboard): add responsive styles for kpi cards, charts and table"
```

---

### Task 7: Build & Kiểm Thử Toàn Diện

**Files:**
- Verify toàn bộ ứng dụng

- [ ] **Step 1: Chạy build thử nghiệm Docker**

Chạy build container để đảm bảo Next.js compile thành công 100%, không phát sinh lỗi kiểu dữ liệu (TypeScript) hay linting.

- [ ] **Step 2: Deploy container mới**

Khởi động lại container `money-check` với code mới qua `deploy.sh`.

- [ ] **Step 3: Kiểm tra truy cập thực tế bằng Browser/cURL**

Kiểm tra HTTP status tại `/admin`, `/admin/users`, `/admin?month=2026-09`, `/admin?month=all`. Xác nhận các thẻ KPI và biểu đồ hiển thị đúng số liệu thực tế.

- [ ] **Step 4: Commit và hoàn tất**
