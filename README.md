# MoneyFlow

Ứng dụng quản lý hoạt động và khoản thu cho nhóm bóng đá **FC ĐÔNG ĐÔ**: lưu trận đấu, đối thủ, người tham gia, bàn thắng/kiến tạo, tạo các khoản thu linh hoạt, thanh toán QR và đối soát webhook.

Tài liệu này là điểm bắt đầu cho developer và coding agent/LLM. Khi tài liệu và code khác nhau, ưu tiên hành vi trong code, sau đó cập nhật lại tài liệu trong cùng thay đổi.

## Tổng quan nghiệp vụ

Hệ thống có hai khu vực:

- **Client công khai** (`/client`): thành viên xem các khoản còn thiếu, chọn khoản cần thanh toán và tạo mã QR.
- **Admin** (`/admin`): quản lý thành viên, trận đấu, thống kê, khoản thu, giao dịch, webhook và cấu hình tích hợp.

Luồng chính:

1. Mọi nghiệp vụ nằm trong `FootballSession` (khoản thu). `kind = MATCH` là khoản thu của một trận; `kind = GENERAL` là áo, quỹ hoặc nội dung khác.
2. Với khoản `MATCH`, mỗi `SessionMember` được tính một lần tham gia và có thể lưu bàn thắng, kiến tạo, miễn đóng. Người miễn đóng vẫn tham gia nhưng nghĩa vụ tài chính bằng 0.
3. Thành viên của khoản `GENERAL` chỉ là người cần đóng tiền và không làm tăng thống kê số trận.
4. Tiền được chia theo tổng số suất (`slots`) và làm tròn lên 1.000 VND, nhưng admin có thể sửa số tiền từng người.
5. Khoản thu `DRAFT` chưa hiển thị cho client. Khi `PUBLISHED`, thành viên có thể chọn nhiều khoản và thanh toán chung một QR.
6. Server snapshot các khoản vào `PaymentRequest` có code `PAYXXXXXXXX`; webhook đối chiếu số tiền và cộng dồn lịch sử đã trả.
7. Tăng nghĩa vụ sau khi đã đóng chỉ tạo phần chênh còn thiếu; giảm thấp hơn số đã đóng được coi là hoàn tất và không tạo số dư âm.

## Công nghệ

- Next.js `16.3.1`, App Router và Server Actions
- React `19.2`
- TypeScript 5
- PostgreSQL
- Prisma `7.9` với `@prisma/adapter-pg`
- Tailwind CSS 4 và CSS ứng dụng tại `app/globals.css`
- pnpm `10.23`
- Node.js 24 trong Docker

> Đây là Next.js 16. Trước khi sửa routing, Proxy, caching, Server Actions hoặc API của framework, đọc tài liệu đúng phiên bản tại `node_modules/next/dist/docs/`. Không dựa hoàn toàn vào kiến thức Next.js phiên bản cũ.

## Cấu trúc dự án

```text
app/
  admin/                     Route chuẩn của giao diện quản trị
    collections/             Quản lý khoản thu
    statistics/              Tổng hợp số trận, bàn thắng và kiến tạo
    transactions/            Danh sách và chi tiết giao dịch
    webhook-logs/            Nhật ký webhook
    settings/                Tích hợp, đồng bộ và reset dữ liệu
  api/
    auth/                    Đăng nhập/đăng xuất admin
    avatars/                 Đọc avatar từ local storage
    payments/                Trạng thái giao dịch và tải QR
    webhooks/payments/       Nhận webhook thanh toán
  client/                    Giao diện công khai cho thành viên
  collections/               Implementation UI/action của khoản thu
  transactions/              Implementation UI/action của giao dịch
  actions.ts                 Server Actions quản lý user
  globals.css                Style chính của toàn ứng dụng
lib/
  admin-auth.ts              Cookie session và credential admin
  admin-session.ts           Kiểm tra session trong server code
  avatar-storage.ts          Validate và lưu avatar trên filesystem
  messenger-message.ts       Gọi Messenger service đã cấu hình
  money.ts                   Parse, format và chia tiền
  payment-totals.ts          Tính số đã trả/còn thiếu
  prisma.ts                  Prisma singleton dùng adapter PostgreSQL
prisma/
  schema.prisma              Data model chuẩn
  migrations/                Lịch sử migration PostgreSQL
scripts/                     Script test webhook
storage/avatars/             Avatar runtime; không commit vào Git
proxy.ts                     Auth gate và redirect cấp request
```

Các page dưới `app/admin/collections` và `app/admin/transactions` hiện re-export implementation từ `app/collections` và `app/transactions`. URL canonical vẫn là `/admin/...`; các URL cũ `/collections/...` và `/transactions/...` được `proxy.ts` redirect sang `/admin/...`.

## Route map

| Method/route | Quyền truy cập | Mục đích |
| --- | --- | --- |
| `GET /` | Công khai | Redirect sang `/client` |
| `GET /client` | Công khai | Danh sách thành viên active |
| `GET /client/[userId]` | Công khai | Các khoản còn thiếu của thành viên |
| `GET /login` | Công khai | Đăng nhập admin |
| `GET /admin/**` | Admin | Toàn bộ giao diện quản trị |
| `GET /admin/collections/**` | Admin | Khoản thu tiền trận và khoản thu chung |
| `GET /admin/statistics` | Admin | Tổng hợp thành tích từng người |
| `POST /api/auth/login` | Công khai | Tạo cookie session admin |
| `POST /api/auth/logout` | Công khai | Xóa cookie session admin |
| `GET /api/avatars/[key]` | Công khai | Trả avatar đã lưu |
| `GET /api/payments/[code]/status` | Công khai | Poll trạng thái thanh toán |
| `GET /api/payments/[code]/qr` | Công khai | Proxy/tải ảnh QR từ VietQR |
| `POST /api/webhooks/payments` | Secret tùy cấu hình | Nhận giao dịch ngân hàng |

Mọi route khác đi qua `proxy.ts`. API không public trả `401` nếu thiếu session; page admin redirect về `/login?next=...`.

## Data model

Các model chính trong `prisma/schema.prisma`:

- `User`: thành viên, avatar và trạng thái active.
- `Opponent`: danh mục đối thủ cho dropdown; đối thủ mới được tạo trực tiếp từ form khoản thu loại trận đấu.
- `FootballSession`: khoản thu duy nhất của hệ thống. `MATCH` chứa thêm đối thủ/tỷ số và được tính thống kê; `GENERAL` không được tính là trận.
- `SessionMember`: thành viên của khoản thu. Với `MATCH`, record này đồng thời là một lần tham gia và chứa miễn đóng, bàn thắng, kiến tạo; với `GENERAL`, nó chỉ là nghĩa vụ tài chính.
- `SessionChargeOption`: khoản bổ sung tùy chọn có tên và giá linh hoạt.
- `PaymentRequest`: một yêu cầu thanh toán và payment code duy nhất.
- `PaymentRequestItem`: snapshot khoản tiền của từng buổi tại thời điểm tạo QR.
- `PaymentRequestItemOption`: snapshot từng tùy chọn đi kèm payment item.
- `ManualPaymentOption`: tùy chọn đã được admin ghi nhận thanh toán thủ công.
- `WebhookLog`: payload và kết quả của mọi webhook đã nhận.
- `Setting`: cấu hình dạng `type + key`, hiện dùng cho Messenger.

### Trạng thái khoản thu

- `DRAFT`: chưa hiển thị cho client.
- `PUBLISHED`: client nhìn thấy và có thể thanh toán.
- `CLOSED`: đã đóng. Xóa khoản thu là soft delete: đặt `CLOSED` và `deletedAt`, không xóa lịch sử vật lý.

### Trạng thái payment request

- `PENDING`: đang chờ webhook.
- `PAID`: nhận đúng tiền và đã phân bổ.
- `UNDERPAID`: nhận thiếu tiền; không tự phân bổ.
- `OVERPAID`: nhận thừa tiền; không tự phân bổ.
- `CANCELLED`: code không còn hiệu lực.
- `REVIEW_REQUIRED`: cần admin kiểm tra và có thể xác nhận thủ công. Trạng thái này còn trong model/UI nhưng hiện không có nhánh runtime nào tạo mới; xem phần **Known gaps**.

## Các invariant quan trọng

Không phá vỡ những nguyên tắc sau khi sửa logic thanh toán:

1. Mỗi user có tối đa một `PaymentRequest` ở trạng thái `PENDING`. Ràng buộc này nằm trong partial unique index của migration và không biểu diễn được đầy đủ trong Prisma schema.
2. Payment item và option là **snapshot**. Không tính lại giao dịch lịch sử từ dữ liệu khoản thu hiện tại.
3. Chỉ webhook đúng số tiền mới tự tăng `SessionMember.amountPaid`; thiếu hoặc thừa tiền chỉ cập nhật trạng thái giao dịch.
4. Webhook phải idempotent. Conditional `updateMany(... status: PENDING)` là cơ chế claim để hai webhook đồng thời không cộng tiền hai lần.
5. Trạng thái payment không còn `PENDING` được xem là terminal trong webhook hiện tại và không bị webhook đến muộn thay đổi.
6. Nếu nội dung của payment đang chờ không còn khớp khoản nợ/tùy chọn mới, request cũ bị `CANCELLED` và một code mới được tạo.
7. Khi admin ghi nhận tiền mặt, mọi payment `PENDING` chứa khoản tương ứng phải bị hủy để tránh trả trùng.
8. Không được bỏ một thành viên đã phát sinh thanh toán khỏi khoản thu.
9. Các phép ghi liên quan nhiều bảng phải nằm trong Prisma transaction.
10. Server Action có quyền admin phải tự gọi `isAdminAuthenticated()`; không chỉ dựa vào Proxy.
11. Chỉ `SessionMember` thuộc `FootballSession.kind = MATCH` được tính vào thống kê tham gia, bàn thắng và kiến tạo.
12. Option đã trả không được bù vào khoản chính còn thiếu. Số dư khoản chính là `max(amountDue - amountPaid, 0)`.

## Tính tiền

- Tiền được lưu bằng số nguyên VND, không dùng số thực hoặc decimal.
- `allocateBySlots()` tính `ceil(totalAmount / totalSlots / 1000) * 1000` cho mỗi suất.
- Một thành viên có thể có nhiều suất.
- Tổng khoản chính còn thiếu là `max(amountDue - amountPaid, 0)`. Option là khoản độc lập, không làm giảm nghĩa vụ chính.
- Một nghĩa vụ có thể được thanh toán nhiều lần. Không ghi đè `amountPaid`; webhook và thanh toán thủ công phải cộng dồn.
- Dùng helper trong `lib/payment-totals.ts` thay vì tự viết lại công thức.

## Payment webhook

Endpoint:

```http
POST /api/webhooks/payments
Content-Type: application/json
x-webhook-secret: <WEBHOOK_SECRET>
```

`x-webhook-secret` hoặc `Authorization: Bearer <WEBHOOK_SECRET>` chỉ bắt buộc khi `WEBHOOK_SECRET` được cấu hình. Production phải luôn cấu hình secret.

Payload:

```json
{
  "amount": 120000,
  "code": "PAY3FA91C82",
  "content": "Số tiền 120.000 ₫, kèm lời nhắn: dong PAY3FA91C82."
}
```

`amount` có thể là number, chuỗi số hoặc `null`. Nếu không có amount hợp lệ, server thử đọc số tiền ở đầu `content`. Field cũ `fullContent` vẫn được hỗ trợ để tương thích ngược.

Webhook luôn ghi `WebhookLog`, kể cả JSON lỗi, sai secret, không tìm thấy code, request trùng hoặc lỗi server. Nội dung raw lỗi JSON bị giới hạn 20.000 ký tự; content hợp lệ tối đa 10.000 ký tự.

Test một code đang chờ thanh toán:

```bash
pnpm test:webhook PAY3FA91C82 120000
```

Smoke test theo cấu hình mặc định của script:

```bash
pnpm test:webhook:smoke
```

## Auth và bảo mật

Admin session là cookie HttpOnly, SameSite Lax, thời hạn 7 ngày và được ký HMAC. `proxy.ts` chỉ thực hiện optimistic check; các Server Action quan trọng kiểm tra session lại ở server.

Hiện tại username, password và session secret đang hard-code trong `lib/admin-auth.ts`. Đây là cấu hình tạm thời, chưa phù hợp production. Khi cải thiện auth cần:

- chuyển credential và session secret sang secret environment/runtime;
- lưu password dưới dạng hash nếu có database account;
- giữ constant-time comparison;
- không log password, API key, token hoặc cookie;
- giữ kiểm tra quyền bên trong Server Actions và route nhạy cảm.

Thông tin ngân hàng VietQR hiện cũng đang hard-code ở cả `app/client/payment-dialog.tsx` và `app/api/payments/[code]/qr/route.ts`; phải sửa đồng bộ cho đến khi được đưa về một config server-side duy nhất.

## Biến môi trường

Copy `.env.example` thành `.env` cho local development:

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@DATABASE_HOST:DATABASE_PORT/postgres?schema=money_check"
DATABASE_SCHEMA="money_check"
APP_URL="https://example.com"
WEBHOOK_SECRET="change-me-in-production"
AVATAR_STORAGE_DIR="storage/avatars"
STATUS_SERVICE_URL="http://app-status-socket:3002"
STATUS_DEVICE_ID="android-main"
STATUS_ADMIN_TOKEN="replace-with-a-random-admin-token"
```

| Biến | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | Có | PostgreSQL connection string; Prisma config và runtime cùng sử dụng |
| `DATABASE_SCHEMA` | Không | Schema truyền cho Prisma adapter, mặc định `public` |
| `APP_URL` | Khuyến nghị | Public origin dùng khi Proxy tạo redirect sau reverse proxy |
| `WEBHOOK_SECRET` | Có ở production | Xác thực payment webhook; để trống đồng nghĩa webhook mở |
| `AVATAR_STORAGE_DIR` | Không | Thư mục avatar, mặc định `storage/avatars` |
| `STATUS_SERVICE_URL` | Cho status check | URL của Android status service |
| `STATUS_DEVICE_ID` | Không | Device cần kiểm tra, mặc định `android-main` |
| `STATUS_ADMIN_TOKEN` | Cho status check | Bearer token của Android status service |

Messenger API URL, API key và chat URL được admin lưu trong bảng `Setting`, không lấy từ environment.

Không commit `.env`, credential thật hoặc database dump.

## Chạy local

Yêu cầu:

- Node.js tương thích Next.js 16; production image đang dùng Node 24
- pnpm 10
- PostgreSQL đang chạy và truy cập được

```bash
pnpm install
copy .env.example .env
pnpm db:migrate
pnpm dev
```

Mở `http://localhost:3000`. Root sẽ redirect sang client; admin ở `http://localhost:3000/admin`.

Các command thường dùng:

```bash
pnpm dev          # development server
pnpm lint         # ESLint
pnpm build        # production build
pnpm start        # chạy build Next.js thông thường
pnpm db:generate  # generate Prisma client
pnpm db:push      # đồng bộ schema khi phát triển; không thay migration production
pnpm db:migrate   # prisma migrate deploy
pnpm db:studio    # Prisma Studio
```

Prisma client được generate vào `app/generated/prisma/` và không nên sửa thủ công.

Migration `20260921020000_unify_matches_into_collections` nhập dữ liệu thể thao từ mô hình `Match` tách riêng trở lại khoản thu:

- mọi `FootballSession` hiện có được gán `kind = MATCH` và tiếp tục được tính là một trận;
- đối thủ, tỷ số, miễn đóng, bàn thắng và kiến tạo được chuyển nguyên vẹn sang `FootballSession`/`SessionMember`;
- các bảng trung gian `Match` và `MatchParticipant` được xóa sau khi chuyển dữ liệu;
- toàn bộ ID khoản thu, `PaymentRequest`, webhook và số đã trả được giữ nguyên nên không mất lịch sử tài chính.

## Docker và deploy

`Dockerfile` có ba target hữu ích:

- `builder`: generate Prisma client và build Next.js.
- `migrator`: chạy `pnpm db:migrate`.
- `runner`: image production standalone, chạy bằng user không phải root.

Quy trình deploy nên chạy migrator trước khi chuyển traffic sang runner. Mount volume bền vững vào `/app/storage` hoặc trỏ `AVATAR_STORAGE_DIR` tới persistent storage; nếu không avatar sẽ mất khi container được thay.

Ứng dụng lắng nghe port `3000`, host `0.0.0.0` trong container.

### Android status service

Socket/status server nằm ở repository riêng `app-status-socket`. Khi chạy Docker, hai service cần cùng network, ví dụ:

```bash
docker network create money-check-network
```

Gắn cả web và status service vào `money-check-network`, rồi dùng hostname nội bộ trong `STATUS_SERVICE_URL`, ví dụ `http://app-status-socket:3002`.

## Avatar

- Chấp nhận JPG, PNG và WebP, tối đa 2 MB.
- File upload được kiểm tra MIME và magic bytes.
- Đồng bộ avatar từ xa chỉ chấp nhận HTTPS từ domain Facebook/Facebook CDN.
- Tên file được tạo từ user UUID và random UUID; API không chấp nhận path tùy ý.
- Filesystem và database không chung transaction. Code có cleanup best-effort khi thao tác database thất bại; giữ đặc tính này khi sửa upload/delete.

## Quy ước khi thay đổi code

1. Đọc `AGENTS.md` và tài liệu Next.js cục bộ liên quan trước khi dùng API framework.
2. Không sửa file trong `app/generated/prisma/`.
3. Thay đổi schema phải có migration mới; không sửa migration đã chạy ở production.
4. Giữ URL canonical dưới `/admin`; cân nhắc tương thích các redirect cũ.
5. Revalidate các page bị ảnh hưởng sau Server Action mutation.
6. Không nhân bản logic tính tiền; dùng `lib/money.ts` và `lib/payment-totals.ts`.
7. Với webhook/payment, kiểm tra cả idempotency, concurrency và snapshot semantics.
8. Thêm env mới vào `.env.example` và bảng biến môi trường trong README.
9. Trước khi bàn giao, tối thiểu chạy `pnpm lint` và `pnpm build`; chạy test webhook nếu thay đổi payment flow.
10. Không xóa hoặc ghi đè dữ liệu production bằng `db:push`; production dùng migration.

## Known gaps / technical debt

- Credential admin và HMAC secret đang hard-code.
- Bank ID/account của VietQR bị lặp và hard-code ở client lẫn server.
- `REVIEW_REQUIRED` tồn tại trong schema, UI và thao tác xác nhận thủ công, nhưng webhook hiện coi mọi trạng thái khác `PENDING` là terminal. Vì vậy webhook đến code `CANCELLED` chỉ bị bỏ qua/log, không chuyển sang `REVIEW_REQUIRED`. README cũ mô tả khác với implementation này.
- Chưa có test suite tự động đầy đủ; hiện chủ yếu có script test webhook.
- Một số page canonical trong `app/admin` chỉ re-export implementation từ route cũ, làm cấu trúc route khó theo dõi hơn cần thiết.
- `FootballSession` và các field `footballAmount` là tên kỹ thuật legacy của lớp khoản thu. Chúng được giữ để migration an toàn; có thể đổi tên trong một migration chuyên biệt sau.
- Messenger API key đang lưu trong database dưới dạng text; cần cân nhắc mã hóa at rest và cơ chế rotate secret.
- Avatar dùng local filesystem nên deployment nhiều replica cần shared storage hoặc object storage.

Khi xử lý một mục trong danh sách này, cập nhật hoặc xóa mục tương ứng trong cùng PR/commit.
