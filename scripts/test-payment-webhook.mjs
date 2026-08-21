const [, , code, amount, content = `Số tiền ${Number(process.argv[3] ?? 0).toLocaleString("vi-VN")} ₫, kèm lời nhắn: \"dong ${code ?? ""}\".`] = process.argv;

if (!code || !amount) {
  console.error("Cách dùng: pnpm test:webhook PAYXXXXXXXX 100000 \"Nội dung đầy đủ\"");
  process.exit(1);
}

const headers = { "content-type": "application/json" };
if (process.env.WEBHOOK_SECRET) {
  headers["x-webhook-secret"] = process.env.WEBHOOK_SECRET;
}

const response = await fetch(`${process.env.APP_URL ?? "http://localhost:3000"}/api/webhooks/payments`, {
  method: "POST",
  headers,
  body: JSON.stringify({ amount: null, code, content }),
});

console.log(`HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
process.exitCode = response.ok ? 0 : 1;
