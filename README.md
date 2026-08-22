# MoneyFlow

Ứng dụng quản lý khoản thu bóng đá, thanh toán bằng QR và đối soát qua webhook.

## Payment webhook

Endpoint:

```text
POST /api/webhooks/payments
Content-Type: application/json
x-webhook-secret: <WEBHOOK_SECRET> # chỉ bắt buộc khi env này được cấu hình
```

Payload:

```json
{
  "amount": null,
  "code": "PAY3FA91C82",
  "content": "Số tiền 120.000 ₫, kèm lời nhắn: \"dong PAY3FA91C82.CT tu 0451000400963 toi 0978618991 tai CAKE\"."
}
```

Khi `amount` là `null`, hệ thống tự đọc số tiền ở đầu `content` (ví dụ `Số tiền 120.000 ₫`). Key `fullContent` cũ vẫn được hỗ trợ để tương thích ngược.

- Đúng số tiền: `PAID`, đồng thời ghi nhận tiền cho từng buổi.
- Thiếu tiền: `UNDERPAID`, chỉ lưu trạng thái để admin xử lý.
- Thừa tiền: `OVERPAID`, chỉ lưu trạng thái để admin xử lý.
- Webhook gọi lặp không cộng tiền lần thứ hai.
- Code chỉ được dùng lại khi danh sách khoản thu và số tiền giống hệt. Nếu dữ liệu thay đổi, code cũ chuyển sang `CANCELLED` và hệ thống tạo code mới.
- Tiền chuyển vào code đã `CANCELLED` sẽ thành `REVIEW_REQUIRED`, không tự phân bổ.

Test một mã đang chờ thanh toán:

```bash
pnpm test:webhook PAY3FA91C82 120000
```

## Android status service

Socket server được triển khai ở repository `app-status-socket`. Web cần các biến:

```env
STATUS_SERVICE_URL="http://app-status-socket:3002"
STATUS_DEVICE_ID="android-main"
STATUS_ADMIN_TOKEN="cùng giá trị với app-status-socket"
```

Hai container phải cùng Docker network:

```bash
docker network create money-check-network
```

Khi chạy container web, thêm:

```bash
--network money-check-network
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
