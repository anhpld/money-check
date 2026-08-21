import Link from "next/link";
import { AdminShell } from "@/app/components/admin-shell";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function getRequestValue(request: unknown, key: string) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return "—";
  const value = (request as Record<string, unknown>)[key];
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" || typeof value === "number" ? String(value) : "—";
}

function pageHref(page: number) {
  return page > 1 ? `/admin/webhook-logs?page=${page}` : "/admin/webhook-logs";
}

export default async function WebhookLogsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const requestedPage = /^\d+$/.test(rawPage ?? "") ? Math.max(Number(rawPage), 1) : 1;
  const prisma = getPrisma();
  const total = await prisma.webhookLog.count();
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const logs = await prisma.webhookLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <AdminShell active="webhooks">
      <div className="page-content webhook-page">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">NHẬT KÝ HỆ THỐNG</p><h1>Webhook đã nhận</h1><p>Theo dõi request gửi từ bên thứ ba và kết quả xử lý.</p></div>
          <div className="webhook-total"><span>Tổng log</span><strong>{total}</strong></div>
        </div>

        {logs.length ? (
          <section className="panel webhook-list">
            <div className="webhook-list-header"><span>Thời gian</span><span>Code</span><span>Số tiền</span><span>Trạng thái</span></div>
            {logs.map((log) => (
              <Link className="webhook-row" href={`/admin/webhook-logs/${log.id}`} key={log.id}>
                <time>{dateTime.format(log.createdAt)}</time>
                <code>{getRequestValue(log.request, "code")}</code>
                <span>{getRequestValue(log.request, "amount")}</span>
                <strong className={`webhook-status ${log.status.toLowerCase()}`}>{log.status}</strong>
              </Link>
            ))}
          </section>
        ) : (
          <section className="panel webhook-empty"><h2>Chưa có webhook</h2><p>Request sẽ xuất hiện tại đây sau khi bên thứ ba gọi webhook thanh toán.</p></section>
        )}

        {total ? (
          <nav className="transaction-pagination" aria-label="Phân trang webhook log">
            <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} / {total}</span>
            <div><Link className={currentPage === 1 ? "disabled" : undefined} aria-disabled={currentPage === 1} href={pageHref(Math.max(currentPage - 1, 1))}>Trước</Link><strong>Trang {currentPage}/{totalPages}</strong><Link className={currentPage === totalPages ? "disabled" : undefined} aria-disabled={currentPage === totalPages} href={pageHref(Math.min(currentPage + 1, totalPages))}>Sau</Link></div>
          </nav>
        ) : null}
      </div>
    </AdminShell>
  );
}
