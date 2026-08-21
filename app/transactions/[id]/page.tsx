import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/app/components/admin-shell";
import { ConfirmTransactionButton } from "@/app/transactions/confirm-transaction-button";
import { paymentStatusLabels, reviewablePaymentStatuses } from "@/app/transactions/payment-status";
import { getPrisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const transaction = await getPrisma().paymentRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
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
  if (!transaction) notFound();

  const difference = transaction.actualAmount === null ? null : transaction.actualAmount - transaction.expectedAmount;
  const canConfirm = reviewablePaymentStatuses.some((status) => status === transaction.status);
  const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "medium" });

  return (
    <AdminShell active="transactions">
      <div className="page-content transaction-detail-page">
        <Link className="transaction-detail-back" href="/admin/transactions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>Danh sách giao dịch</Link>
        <header className="transaction-detail-heading">
          <div><p className="eyebrow">CHI TIẾT GIAO DỊCH</p><h1>{transaction.code}</h1><time>{dateTime.format(transaction.createdAt)}</time></div>
          <div className="transaction-detail-actions"><span className={`transaction-status ${transaction.status.toLowerCase()}`}>{paymentStatusLabels[transaction.status]}</span>{canConfirm ? <ConfirmTransactionButton id={transaction.id} expectedAmount={transaction.expectedAmount} actualAmount={transaction.actualAmount} /> : null}</div>
        </header>

        <section className="transaction-detail-summary">
          <div><span>Cần nhận</span><strong>{formatVnd(transaction.expectedAmount)}</strong></div>
          <div><span>Thực nhận</span><strong>{transaction.actualAmount === null ? "—" : formatVnd(transaction.actualAmount)}</strong></div>
          <div className={difference === null || difference === 0 ? "balanced" : "different"}><span>Chênh lệch</span><strong>{difference === null ? "—" : `${difference > 0 ? "+" : ""}${formatVnd(difference)}`}</strong></div>
        </section>

        <div className="transaction-detail-grid">
          <section className="panel transaction-detail-panel">
            <div className="transaction-detail-panel-heading"><h2>Thông tin giao dịch</h2></div>
            <dl className="transaction-meta">
              <div><dt>Người chuyển</dt><dd>{transaction.user.name}</dd></div>
              <div><dt>Thời điểm tạo</dt><dd>{dateTime.format(transaction.createdAt)}</dd></div>
              <div><dt>Webhook xử lý</dt><dd>{transaction.processedAt ? dateTime.format(transaction.processedAt) : "Chưa nhận webhook"}</dd></div>
              <div><dt>Kết thúc xử lý</dt><dd>{transaction.resolvedAt ? dateTime.format(transaction.resolvedAt) : "—"}</dd></div>
            </dl>
          </section>
          <section className="panel transaction-detail-panel">
            <div className="transaction-detail-panel-heading"><h2>Nội dung chuyển khoản</h2></div>
            <div className={`transaction-content ${transaction.fullContent ? "" : "empty"}`}>{transaction.fullContent || "Chưa có nội dung từ webhook."}</div>
          </section>
        </div>

        <section className="panel transaction-items-panel">
          <div className="transaction-detail-panel-heading"><div><h2>Các khoản trong mã QR</h2><p>{transaction.items.length} khoản tại thời điểm tạo mã</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>Buổi bóng</th><th>Ngày đá</th><th>Tiền bóng</th><th>Tiền nước</th><th>Tổng</th></tr></thead><tbody>{transaction.items.map((item) => <tr key={item.id}><td><strong>{item.sessionMember.session.title}</strong></td><td>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeZone: "UTC" }).format(item.sessionMember.session.playedAt)}</td><td>{formatVnd(item.footballAmount)}</td><td>{formatVnd(item.waterAmount)}</td><td><strong className="amount-emphasis">{formatVnd(item.expectedAmount)}</strong></td></tr>)}</tbody></table></div>
        </section>
      </div>
    </AdminShell>
  );
}
