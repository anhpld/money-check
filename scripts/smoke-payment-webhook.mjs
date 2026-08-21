import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const schema = process.env.DATABASE_SCHEMA ?? "public";
const table = (name) => `"${schema.replaceAll('"', '""')}"."${name}"`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const ids = {
  user: randomUUID(),
  session: randomUUID(),
  member: randomUUID(),
  exact: randomUUID(),
  under: randomUUID(),
  over: randomUUID(),
  cancelled: randomUUID(),
};
const codes = Object.fromEntries(["exact", "under", "over", "cancelled"].map((key) => [
  key,
  `PAY${randomBytes(4).toString("hex").toUpperCase()}`,
]));

async function send(code, amount) {
  const headers = { "content-type": "application/json" };
  if (process.env.WEBHOOK_SECRET) headers["x-webhook-secret"] = process.env.WEBHOOK_SECRET;
  const response = await fetch(`${appUrl}/api/webhooks/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: null,
      code,
      content: `Số tiền ${new Intl.NumberFormat("vi-VN").format(amount)} ₫, kèm lời nhắn: \"dong ${code}.CT smoke test\".`,
    }),
  });
  return { status: response.status, body: await response.json() };
}

async function getStatus(code) {
  const response = await fetch(`${appUrl}/api/payments/${code}/status`, { cache: "no-store" });
  return { status: response.status, body: await response.json() };
}

try {
  await pool.query("BEGIN");
  await pool.query(`INSERT INTO ${table("User")} ("id", "name") VALUES ($1, $2)`, [ids.user, "Webhook smoke test"]);
  await pool.query(
    `INSERT INTO ${table("FootballSession")} ("id", "title", "playedAt", "totalAmount", "status", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_DATE, 3000, 'PUBLISHED', NOW(), NOW())`,
    [ids.session, "Webhook smoke test"],
  );
  await pool.query(
    `INSERT INTO ${table("SessionMember")} ("id", "sessionId", "userId", "amountDue", "createdAt", "updatedAt") VALUES ($1, $2, $3, 1000, NOW(), NOW())`,
    [ids.member, ids.session, ids.user],
  );
  for (const kind of ["exact", "under", "over", "cancelled"]) {
    await pool.query(
      `INSERT INTO ${table("PaymentRequest")} ("id", "userId", "code", "expectedAmount", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, 1000, 'PENDING', NOW(), NOW())`,
      [ids[kind], ids.user, codes[kind]],
    );
    await pool.query(
      `INSERT INTO ${table("PaymentRequestItem")} ("id", "paymentRequestId", "sessionMemberId", "footballAmount", "expectedAmount", "createdAt") VALUES ($1, $2, $3, 1000, 1000, NOW())`,
      [randomUUID(), ids[kind], ids.member],
    );
  }
  await pool.query(`UPDATE ${table("PaymentRequest")} SET "status" = 'CANCELLED', "processedAt" = NOW() WHERE "id" = $1`, [ids.cancelled]);
  await pool.query("COMMIT");

  const results = {
    exact: await send(codes.exact, 1000),
    duplicate: await send(codes.exact, 1000),
    under: await send(codes.under, 900),
    over: await send(codes.over, 1100),
    cancelled: await send(codes.cancelled, 1000),
  };
  const polling = {
    exact: await getStatus(codes.exact),
    under: await getStatus(codes.under),
    over: await getStatus(codes.over),
    cancelled: await getStatus(codes.cancelled),
  };
  const database = await pool.query(
    `SELECT "code", "status", "actualAmount" FROM ${table("PaymentRequest")} WHERE "id" = ANY($1::text[]) ORDER BY "status"`,
    [[ids.exact, ids.under, ids.over, ids.cancelled]],
  );
  const member = await pool.query(`SELECT "amountPaid" FROM ${table("SessionMember")} WHERE "id" = $1`, [ids.member]);
  const webhookLogs = await pool.query(
    `SELECT "status", "request"->>'code' AS "code" FROM ${table("WebhookLog")} WHERE "request"->>'code' = ANY($1::text[]) ORDER BY "createdAt"`,
    [Object.values(codes)],
  );

  const valid = results.exact.body.payment?.status === "PAID"
    && results.duplicate.body.payment?.duplicate === true
    && results.under.body.payment?.status === "UNDERPAID"
    && results.over.body.payment?.status === "OVERPAID"
    && results.cancelled.body.payment?.status === "REVIEW_REQUIRED"
    && polling.exact.body.payment?.status === "PAID"
    && polling.under.body.payment?.status === "UNDERPAID"
    && polling.over.body.payment?.status === "OVERPAID"
    && polling.cancelled.body.payment?.status === "REVIEW_REQUIRED"
    && member.rows[0]?.amountPaid === 1000
    && webhookLogs.rows.length === 5
    && webhookLogs.rows.filter((log) => log.status === "SUCCESS").length === 4
    && webhookLogs.rows.filter((log) => log.status === "DUPLICATE").length === 1;

  console.log(JSON.stringify({ valid, results, polling, database: database.rows, webhookLogs: webhookLogs.rows, amountPaid: member.rows[0]?.amountPaid }, null, 2));
  if (!valid) process.exitCode = 1;
} finally {
  await pool.query(`DELETE FROM ${table("WebhookLog")} WHERE "request"->>'code' = ANY($1::text[])`, [Object.values(codes)]).catch(() => {});
  await pool.query(`DELETE FROM ${table("PaymentRequest")} WHERE "id" = ANY($1::text[])`, [[ids.exact, ids.under, ids.over, ids.cancelled]]).catch(() => {});
  await pool.query(`DELETE FROM ${table("FootballSession")} WHERE "id" = $1`, [ids.session]).catch(() => {});
  await pool.query(`DELETE FROM ${table("User")} WHERE "id" = $1`, [ids.user]).catch(() => {});
  await pool.end();
}
