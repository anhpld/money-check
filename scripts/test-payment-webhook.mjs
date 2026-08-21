import "dotenv/config";

const [, , rawCode, rawAmount] = process.argv;
const code = rawCode?.trim().toUpperCase();
const amount = rawAmount && /^\d[\d.,\s]*$/.test(rawAmount)
  ? Number(rawAmount.replace(/\D/g, ""))
  : Number.NaN;

if (!code || !/^PAY[A-F0-9]{8}$/.test(code) || !Number.isSafeInteger(amount) || amount <= 0) {
  console.error("Cách dùng: pnpm test:webhook PAYXXXXXXXX 100000");
  process.exit(1);
}

const headers = { "content-type": "application/json" };
if (process.env.WEBHOOK_SECRET) {
  headers["x-webhook-secret"] = process.env.WEBHOOK_SECRET;
}

const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const response = await fetch(`${appUrl}/api/webhooks/payments`, {
  method: "POST",
  headers,
  body: JSON.stringify({ amount, code, content: "abc" }),
});

console.log(`HTTP ${response.status}`);
console.log(JSON.stringify(await response.json(), null, 2));
process.exitCode = response.ok ? 0 : 1;
