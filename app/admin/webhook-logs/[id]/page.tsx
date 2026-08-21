import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/app/components/admin-shell";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getCode(request: unknown) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return "Webhook request";
  const value = (request as Record<string, unknown>).code;
  return typeof value === "string" && value ? value : "Webhook request";
}

export default async function WebhookLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = await getPrisma().webhookLog.findUnique({ where: { id } });
  if (!log) notFound();
  const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "medium" });

  return (
    <AdminShell active="webhooks">
      <div className="page-content webhook-detail-page">
        <Link className="transaction-detail-back" href="/admin/webhook-logs">← Danh sách webhook</Link>
        <header className="webhook-detail-heading">
          <div><p className="eyebrow">CHI TIẾT WEBHOOK</p><h1>{getCode(log.request)}</h1><time>{dateTime.format(log.createdAt)}</time></div>
          <strong className={`webhook-status ${log.status.toLowerCase()}`}>{log.status}</strong>
        </header>
        <section className="panel webhook-json-panel">
          <div><h2>Request JSON</h2><span>ID: {log.id}</span></div>
          <pre>{JSON.stringify(log.request, null, 2)}</pre>
        </section>
      </div>
    </AdminShell>
  );
}
