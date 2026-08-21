import Link from "next/link";
import { AdminShell } from "@/app/components/admin-shell";
import { isPaymentStatus, paymentStatusLabels, paymentStatusOptions } from "@/app/transactions/payment-status";
import { getPrisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function pageHref(status: string | undefined, page: number) {
  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/admin/transactions?${value}` : "/admin/transactions";
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status: rawStatus, page: rawPage } = await searchParams;
  const selectedStatus = isPaymentStatus(rawStatus) ? rawStatus : undefined;
  const requestedPage = /^\d+$/.test(rawPage ?? "") ? Math.max(Number(rawPage), 1) : 1;
  const prisma = getPrisma();
  const where = selectedStatus ? { status: selectedStatus } : undefined;
  const [filteredCount, groupedStatuses] = await Promise.all([
    prisma.paymentRequest.count({ where }),
    prisma.paymentRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const totalPages = Math.max(Math.ceil(filteredCount / PAGE_SIZE), 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const transactions = await prisma.paymentRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (currentPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      user: { select: { name: true } },
      items: {
        orderBy: { sessionMember: { session: { playedAt: "desc" } } },
        include: {
          sessionMember: {
            include: { session: { select: { title: true, playedAt: true } } },
          },
        },
      },
    },
  });

  const counts = new Map(groupedStatuses.map((group) => [group.status, group._count._all]));
  const total = groupedStatuses.reduce((sum, group) => sum + group._count._all, 0);
  const needsReview = (counts.get("UNDERPAID") ?? 0)
    + (counts.get("OVERPAID") ?? 0)
    + (counts.get("REVIEW_REQUIRED") ?? 0);

  return (
    <AdminShell active="transactions">
      <div className="page-content transactions-page">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">ĐỐI SOÁT THANH TOÁN</p><h1>Danh sách giao dịch</h1><p>Theo dõi mã QR và kết quả nhận tiền từ webhook.</p></div>
        </div>

        <section className="transaction-summary" aria-label="Thống kê giao dịch">
          <div><span>Tổng giao dịch</span><strong>{total}</strong></div>
          <div className="pending"><span>Đang chờ</span><strong>{counts.get("PENDING") ?? 0}</strong></div>
          <div className="paid"><span>Đã khớp</span><strong>{counts.get("PAID") ?? 0}</strong></div>
          <div className="review"><span>Cần kiểm tra</span><strong>{needsReview}</strong></div>
        </section>

        <nav className="transaction-filters" aria-label="Lọc trạng thái giao dịch">
          <Link className={!selectedStatus ? "active" : undefined} href="/admin/transactions">Tất cả <span>{total}</span></Link>
          {paymentStatusOptions.map(([status, label]) => (
            <Link className={selectedStatus === status ? "active" : undefined} href={`/admin/transactions?status=${status}`} key={status}>{label}<span>{counts.get(status) ?? 0}</span></Link>
          ))}
        </nav>

        {transactions.length ? (
          <section className="transaction-list panel">
            <div className="transaction-list-header"><span>Giao dịch</span><span>Người chuyển</span><span>Khoản thu</span><span>Số tiền</span><span>Trạng thái</span></div>
            {transactions.map((transaction) => {
              const difference = (transaction.actualAmount ?? 0) - transaction.expectedAmount;
              const sessionNames = [...new Set(transaction.items.map((item) => item.sessionMember.session.title))];
              return (
                <Link className="transaction-row" href={`/admin/transactions/${transaction.id}`} key={transaction.id}>
                  <div className="transaction-primary">
                    <code>{transaction.code}</code>
                    <time>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(transaction.createdAt)}</time>
                  </div>
                  <div className="transaction-user"><strong>{transaction.user.name}</strong><span>{transaction.items.length} khoản</span></div>
                  <div className="transaction-sessions"><strong>{sessionNames[0] ?? "Không có khoản thu"}</strong>{sessionNames.length > 1 ? <span>+{sessionNames.length - 1} buổi khác</span> : transaction.items[0] ? <span>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "UTC" }).format(transaction.items[0].sessionMember.session.playedAt)}</span> : null}</div>
                  <div className="transaction-amounts"><span><small>Cần nhận</small><strong>{formatVnd(transaction.expectedAmount)}</strong></span><span><small>Thực nhận</small><strong>{transaction.actualAmount === null ? "—" : formatVnd(transaction.actualAmount)}</strong></span>{transaction.actualAmount !== null && difference !== 0 ? <em>{difference > 0 ? "+" : ""}{formatVnd(difference)}</em> : null}</div>
                  <span className={`transaction-status ${transaction.status.toLowerCase()}`}>{paymentStatusLabels[transaction.status]}</span>
                </Link>
              );
            })}
          </section>
        ) : (
          <section className="panel transaction-empty"><span>↔</span><h2>Không có giao dịch</h2><p>Chưa có giao dịch nào phù hợp với bộ lọc này.</p></section>
        )}
        {filteredCount ? (
          <nav className="transaction-pagination" aria-label="Phân trang giao dịch">
            <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCount)} / {filteredCount}</span>
            <div><Link className={currentPage === 1 ? "disabled" : undefined} aria-disabled={currentPage === 1} href={pageHref(selectedStatus, Math.max(currentPage - 1, 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Trước</Link><strong>Trang {currentPage}/{totalPages}</strong><Link className={currentPage === totalPages ? "disabled" : undefined} aria-disabled={currentPage === totalPages} href={pageHref(selectedStatus, Math.min(currentPage + 1, totalPages))}>Sau<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></Link></div>
          </nav>
        ) : null}
      </div>
    </AdminShell>
  );
}
