# TỔNG QUAN KIẾN TRÚC AGENT AI VŨ QUANG BÌNH (FC ĐÔNG ĐÔ)

Tài liệu này tổng hợp toàn bộ cấu trúc hệ thống, kiến trúc bộ não AI, cơ chế ký ức tự học 3 tầng, hệ thống công cụ (Tool Calling), và hạ tầng gửi tin thời gian thực của Trợ lý ảo Vũ Quang Bình.

---

## 1. Bản sắc & Vai trò (Persona & Core Identity)

* **Tên hiển thị:** Vũ Quang Bình
* **Tài khoản Facebook Bot:** `100008683443702`
* **Vai trò:** Trợ lý ảo kiêm thủ quỹ và chuyên gia thu nợ của đội bóng FC Đông Đô; trợ lý thân cận của Đội trưởng Đức Anh.
* **Phong cách giao tiếp:**
  * Thân mật, tếu táo, tự nhiên, mang đậm chất bóng đá sân cỏ phủi.
  * Xưng "em", gọi "anh" (hoặc xưng hô theo ngữ cảnh anh em trong đội).
  * Thi thoảng chêm vài từ ngữ đùa bỗ bã của anh em (vl, đm, vãi, mẹ...).
  * **Quy tắc phát ngôn:** Tuyệt đối không dùng Markdown (không `**`, `*`, list markdown, tiêu đề) để gửi tin nhắn Messenger mượt mà; độ dài 1-2 câu, súc tích, phản xạ nhanh.
  * **Chặn ngoài lề:** Gạt đi các câu hỏi không liên quan đến đội bóng (code, thời tiết, chính trị...), yêu cầu tập trung chuyên môn đá bóng và nợ nần.

---

## 2. Sơ đồ Tổng thể Hệ thống (System Architecture Diagram)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NHÓM MESSENGER FC ĐÔNG ĐÔ                                 │
│                 (Prod: 2245150785540070 | Test: 954763997032636)                       │
└───────────────────────────▲───────────────────────────────┬────────────────────────────┘
                            │ Tin nhắn phản hồi             │ Tin nhắn / Tag / Reply
                            │ (kèm thẻ tag @[Tên])          ▼
┌───────────────────────────┴────────────────────────────────────────────────────────────┐
│                    DAEMON: messenger-listener (Node.js + shan-fca)                    │
│                                                                                        │
│  1. MQTT Listener: Bắt sự kiện tin nhắn thời gian thực.                                │
│  2. Rolling Message Buffer: Lưu trượt 15 - 35 tin gần nhất trong RAM.                   │
│  3. Trigger Engine: Kích hoạt khi có tag bot, reply bot, hoặc chữ "Bình".               │
│  4. Typing Indicator: Bật ngay icon "Đang soạn tin..." tránh cảm giác trễ.             │
│  5. Context Assembler: Bơm Đồng hồ thực + Hồ sơ người hỏi + Bảng tin 3 ngày toàn đội.  │
│  6. HTTP Socket Server (Port 3003): Gửi tin nhắn siêu tốc kèm mention thật.             │
└───────────────────────────▲───────────────────────────────┬────────────────────────────┘
                            │                               │
       Gọi Tool / Đọc Data  │                               │ Prompt + Tools
                            ▼                               ▼
┌───────────────────────────────────────┐       ┌────────────────────────────────────────┐
│        CƠ SỞ DỮ LIỆU POSTGRESQL       │       │         LLM ENGINE (PORTAL API)        │
│        (Schema: money_check)          │       │                                        │
│  - User (Profile, Soul)               │       │  Model: cx/gpt-5.6-luna                │
│  - UserMemory (Episodes 3 ngày)       │       │  Endpoint: https://raykllx.abc-tunnel… │
│  - FootballSession & SessionMember    │       │  Hỗ trợ Function Calling 2 nhịp        │
│  - Setting (Prompt, URL, Config)      │       └────────────────────────────────────────┘
└───────────────────────────────────────┘
                            ▲
                            │ Lệnh thực thi bắn tin
┌───────────────────────────┴────────────────────────────────────────────────────────────┐
│                       HỆ THỐNG HẸN GIỜ: HERMES CRON BRIDGE                             │
│                                                                                        │
│  - hermes-cron-bridge.service (Port 3004): HTTP Bridge điều khiển Hermes CLI.          │
│  - Hermes Agent Cron Engine: Lên lịch hẹn thời gian thực (ISO 8601 UTC+7).             │
│  - Runner Script (send_messenger_group.py): Đến giờ tự kích hoạt bắn tin qua socket.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Bộ Não & Mô hình LLM (LLM & Runtime Engine)

* **Mô hình chỉ định:** `cx/gpt-5.6-luna` (OpenAI-compatible Chat Completions API).
* **Đặc trưng:** Suy luận nhanh, khả năng hiểu tiếng Việt lóng/sân cỏ xuất sắc, hỗ trợ Function Calling (Tool Use) đa tầng.
* **Cơ chế gọi 2 nhịp (Two-turn Function Calling):**
  1. **Nhịp 1:** Nhận tin nhắn + danh sách 12 Tools ➔ Model quyết định trả lời trực tiếp hoặc gọi 1 hay nhiều Tools.
  2. **Thực thi:** `messenger-listener` chạy hàm nội bộ truy vấn PostgreSQL hoặc gọi Cron Bridge.
  3. **Nhịp 2:** Nạp kết quả Tool trở lại context ➔ Model sinh câu trả lời tự nhiên theo đúng phong cách Vũ Quang Bình.

---

## 4. Kiến trúc Ký ức Tự học 3 Tầng (3-Tier Self-Evolving Memory System)

Hệ thống ký ức được phân cấp rõ ràng theo mức độ tin cậy và vòng đời:

| Tầng Ký Ức | Tên Gọi | Vòng Đời | Lưu Trữ | Quyền Hạn & Cơ Chế Cập Nhật |
| :--- | :--- | :--- | :--- | :--- |
| **Tầng 1** | **👑 Hồ sơ Cá nhân (User Profile)** | Bất biến / Chính thức | `User.profile` (`TEXT`) | **Chỉ DUY NHẤT Đội trưởng Đức Anh** (FB ID: `100002974774231`) tag bot mới được set (qua tool `cap_nhat_ho_so_thanh_vien`). Người khác yêu cầu bot từ chối ngay. |
| **Tầng 2** | **✨ Tính cách & Phong cách (Soul)** | Lâu dài | `User.personaPrompt` (`TEXT`) | **Tự học ngầm & Tự cô đọng:** Học từ các câu chat tag bot và quét định kỳ mẻ 20 tin. Khi độ dài vượt quá 100 ký tự, kích hoạt hàm tóm tắt AI cô đọng thành 1 câu đúc kết súc tích dưới 20 từ, chống phình to hay lặp từ rác. |
| **Tầng 3** | **⏳ Ký ức Sự việc & Lời hứa (Episodes)** | Tạm thời (**Hạn 3 ngày**) | Bảng `UserMemory` | **Tự động hết hạn:** Lưu các việc ngắn hạn (hứa khao, xin nghỉ, đau chân, nộp tiền...). Sau 72h tự động bị lọc bỏ và dọn sạch khỏi database. |

---

## 5. Cơ chế Chống Trùng Lặp Ngữ Nghĩa (Semantic Deduplication)

Để tránh hiện tượng cùng một lời hứa/sự việc bị lưu lặp nhiều lần (ví dụ: *"hứa chuyển 100k"* và *"hứa 100.000 đồng"*):

1. **Chặn tại Prompt AI:**
   * Khi trích xuất ký ức (cả trực tiếp lẫn mẻ 20 tin), hệ thống bơm danh sách sự việc đã có trong 3 ngày qua của người đó.
   * Chỉ thị nghiêm ngặt: *Nếu sự việc mới trùng ý hoặc tương đồng với sự việc đã lưu thì bắt buộc trả về null (bỏ qua).*
2. **Lưới an toàn thuật toán tại Database (`areFactsSimilar`):**
   * Chuẩn hóa số tiền & số đếm: `100k` = `100.000` = `100000`.
   * Bóc tách các từ khóa nội dung chính (loại bỏ hư từ tiếng Việt).
   * So sánh độ trùng lặp Jaccard / Overlap: nếu trùng ý >45-55%, hệ thống **không tạo bản ghi mới** mà chỉ cập nhật `createdAt = NOW()` của bản ghi cũ để gia hạn.

---

## 6. Pipeline Nạp Ngữ Cảnh Tức Thì (Realtime Context Pipeline)

Mỗi khi có tin nhắn kích hoạt bot trong nhóm, hệ thống lắp ráp một ngữ cảnh đa chiều trước khi gửi cho Luna:

1. **[Đồng hồ thời gian thực tế]:** Múi giờ Việt Nam UTC+7 (Thứ, ngày/tháng/năm, giờ:phút:giây) để tính chuẩn lịch hẹn và độ tươi của sự kiện.
2. **[System Prompt]:** Bản sắc, vai trò, quy tắc bốc số liệu nợ/bàn thắng và nguyên tắc phát ngôn.
3. **[Hồ sơ người hỏi]:** Profile, Soul, và các sự việc 3 ngày qua của chính người đang nhắn tin.
4. **[Bảng tin Sự việc & Kèo / Lời hứa 3 ngày của cả đội]:**
   * Bảng tin tổng hợp toàn bộ lời hứa/sự việc nóng của anh em trong đội (đã lọc sạch trùng lặp, gắn nhãn *[Hôm nay 25/09]*, *[24/09]*...).
   * Giúp bot có khả năng **xâu chuỗi đa sự việc** (Cross-referencing) như: Minh Đức hứa 100k + Đức Thắng ghi 3 bàn ➔ nhắc đòi tiền thưởng ngay.
   * **Tối ưu gọn gàng:** Không nhồi nhét danh sách 13 thành viên dư thừa vào prompt, vì mỗi dòng sự việc đã mang sẵn tên người liên quan; khi cần danh sách đầy đủ, bot đã có sẵn tool `danh_sach_thanh_vien`.
5. **[15 tin nhắn gần nhất trong nhóm]:** Đảm bảo tính liên tục của luồng hội thoại, hiểu được các câu nói cộc lốc hoặc đính chính.
6. **[Dữ liệu công nợ tức thời]:** Tra cứu nợ nần trực tiếp từ database.

---

## 7. Hệ thống 12 Công cụ (Function Calling Tools)

Bot được trang bị 12 công cụ chuyên biệt để thao tác với dữ liệu:

### Nhóm 1: Thống kê & Công nợ đội bóng
1. `tra_cuu_thanh_vien`: Tra cứu toàn diện một thành viên (nợ quỹ, số trận, bàn thắng, kiến tạo, profile, soul, sự việc 3 ngày).
2. `bang_xep_hang`: Xem Top 5 theo: ghi bàn (`ghi_ban`), kiến tạo (`kien_tao`), số trận ra sân (`ra_san`), đóng tiền nhiều nhất (`dong_tien`), nợ nhiều nhất (`con_no`).
3. `tra_cuu_tran_dau`: Tìm kiếm thông tin trận đấu (ngày đá, tỷ số, đối thủ, danh sách ra sân, người ghi bàn/kiến tạo).
4. `thong_tin_quy`: Báo cáo tài chính tổng quan (tổng thu, tổng chi, số dư quỹ hiện tại, tổng nợ còn tồn).
5. `danh_sach_thanh_vien`: Liệt kê danh sách các thành viên đang hoạt động (`isActive = true`) kèm vị trí thi đấu chính thức.

### Nhóm 2: Quản lý Ký ức (CRUD Memory)
6. `ghi_nho_thong_tin`: Chủ động ghi nhớ một thông tin/sự việc mới về thành viên khi được dặn dò.
7. `xem_ky_uc_thanh_vien`: Xem lại toàn bộ ký ức còn hiệu lực trong 3 ngày của một người.
8. `cap_nhat_ky_uc`: Sửa đổi một ký ức đã lưu khi có đính chính.
9. `xoa_ky_uc`: Xóa bỏ (quên đi) một ký ức theo yêu cầu.

### Nhóm 3: Phân quyền Đội trưởng Đức Anh (Admin-only Tools)
10. `cap_nhat_ho_so_thanh_vien`: Cập nhật vị trí thi đấu, số áo, vai trò chính thức vào `User.profile`. **Chỉ Đội trưởng Đức Anh mới có quyền.**
11. `cap_nhat_ban_thang_kien_tao`: Cập nhật số bàn thắng hoặc kiến tạo của thành viên trong trận đấu cụ thể vào `SessionMember`. **Chỉ Đội trưởng Đức Anh mới có quyền.** Nếu người khác yêu cầu, bot từ chối và báo: *"để em báo cáo cho anh Đức Anh"*.

### Nhóm 4: Hẹn giờ & Tự động hóa
12. `dat_lich_nhac_nho`: Đặt lịch hẹn nhắc nhở công việc, dậy sớm, mang áo đấu... Kết nối trực tiếp Hermes Cron Engine để bắn tin tự động khi đến giờ.

---

## 8. Hệ thống Hẹn Giờ Nhắc Nhở Tự Động (Hermes Cron Bridge)

Luồng hoạt động khi có thành viên dặn dò hẹn giờ:

```
Thành viên: "@Vũ Quang Bình tý 8h nhắc ông B dậy đi đá bóng nhé"
   │
   ▼
Bot gọi tool: dat_lich_nhac_nho(tieu_de, thoi_gian, noi_dung_nhac_nho, thread_id)
   │
   ▼
POST http://127.0.0.1:3004/api/cron/create (hermes-cron-bridge)
   │
   ▼
Chuẩn hóa thời gian tự nhiên: "tý 8h", "20h tối nay" ➔ ISO 8601 (2026-09-25T20:00:00+07:00)
   │
   ▼
Thực thi lệnh: hermes cron create --no-agent --schedule "..." --command "python3 send_messenger_group.py ..."
   │
   ▼ [Đến giờ hẹn]
Script send_messenger_group.py chạy ➔ Bắn POST tới http://127.0.0.1:3003/api/send-message
   │
   ▼
Bot Vũ Quang Bình tự động gửi tin nhắn kèm thẻ tag thật vào đúng nhóm Messenger!
```

---

## 9. Hạ tầng Gửi Tin Siêu Tốc & An Toàn Kiểm Thử

* **HTTP Socket Nội Bộ (Port 3003):**
  * Tích hợp trực tiếp bên trong tiến trình của `messenger-listener`.
  * Endpoint `POST /api/send-message`: Phân giải thẻ tag `@[Tên Người]` thành `mentions` cấu trúc chuẩn của Facebook. Độ trễ gửi tin cực thấp (<0.05s), không cần mở trình duyệt headless.
* **Fallback Service (`send-message-fb`):**
  * Container Chromium Playwright dự phòng trong trường hợp socket bận hoặc gửi mẫu văn bản đặc biệt.
* **Quy tắc An Toàn Kiểm Thử Tuyệt Đối:**
  * **Test Thread ID:** `954763997032636`
  * **Prod Thread ID:** `2245150785540070` ("20h45 sân ĐÔNG ĐÔ")
  * Cơ chế chọn môi trường (`targetEnv`: `test` | `prod`) trên Web `/admin/settings` đảm bảo trong lúc test/phát triển, **không một tin nhắn thử nghiệm nào được phép lọt vào nhóm Prod**.

---

## 10. Quản trị Tập Trung & Triển Khai (Web Admin & Deployment)

* **Giao diện Web Quản trị:**
  * URL Production: `https://fcdongdo.duckdns.org` (Cổng nội bộ `3000`).
  * URL Staging/Preview: `http://34.21.166.188:3005` (Container cách ly `money-check-preview`).
* **Các module quản trị AI trên Web:**
  * `/admin/settings`: Quản trị tập trung LLM API Key, URL, Model, System Prompt, Prompt Nhắc nợ thông minh AI, Toggle bật/tắt gửi tin AI, Cấu hình URL nhóm Test & Prod.
  * `/admin/users`: Quản lý danh sách thành viên, mở Modal 3 tầng ký ức (👑 Profile, ✨ Soul, ⏳ 3-day Episodes) để xem trực quan và can thiệp thủ công khi cần.
* **Quy trình Triển khai Chuẩn (One-command Deploy):**
  * Khi có thay đổi code web: Push lên `origin/main`, sau đó chạy:
    ```bash
    bash deploy.sh
    ```
  * Script tự động pull code, migrate Prisma DB, build Docker image và khởi động lại container production không gián đoạn.
