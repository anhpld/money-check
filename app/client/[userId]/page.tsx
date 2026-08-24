import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/app/client/client-shell";
import { PaymentDialog, type ClientDebtItem } from "@/app/client/payment-dialog";
import { UserAvatar } from "@/app/components/user-avatar";
import { getPrisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/money";
import { getOutstandingAmount } from "@/lib/payment-totals";

export const dynamic = "force-dynamic";

export default async function ClientUserPage({ params }: PageProps<"/client/[userId]">) {
  const { userId } = await params;
  const user = await getPrisma().user.findFirst({
    where: { id: userId, isActive: true },
    include: {
      sessionMembers: {
        where: { session: { status: "PUBLISHED", deletedAt: null } },
        orderBy: { session: { playedAt: "desc" } },
        include: {
          session: { include: { chargeOptions: { orderBy: { sortOrder: "asc" } } } },
          manualPaymentOptions: { select: { optionId: true, amount: true } },
          paymentItems: {
            where: { paymentRequest: { status: "PAID" } },
            select: { options: { select: { optionId: true, amount: true } } },
          },
        },
      },
    },
  });
  if (!user) notFound();

  const debts: ClientDebtItem[] = user.sessionMembers
    .map((member) => {
      const outstanding = getOutstandingAmount(
        member.amountDue,
        member.amountPaid,
        member.manualPaymentOptions,
        member.paymentItems,
      );
      const paidOptionIds = new Set([
        ...member.manualPaymentOptions.map((option) => option.optionId),
        ...member.paymentItems.flatMap((item) => item.options.map((option) => option.optionId)),
      ].filter((optionId): optionId is string => Boolean(optionId)));

      return {
        sessionMemberId: member.id,
        title: member.session.title,
        playedAt: member.session.playedAt.toISOString(),
        slots: member.slots,
        footballAmount: outstanding,
        chargeOptions: member.session.chargeOptions
          .filter((option) => !paidOptionIds.has(option.id))
          .map((option) => ({
            id: option.id,
            name: option.name,
            defaultAmount: option.defaultAmount,
            autoSelected: option.autoSelected,
            allowCustomAmount: option.allowCustomAmount,
          })),
        totalOutstanding: outstanding,
        note: member.note,
        sessionNote: member.session.note,
      };
    })
    .filter((member) => member.totalOutstanding > 0);
  const outstanding = debts.reduce((sum, debt) => sum + debt.totalOutstanding, 0);

  return (
    <ClientShell>
      <main className="client-main client-detail-main">
        <div className="client-detail-header">
          <Link className="client-back" href="/client"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>Danh sách thành viên</span></Link>

          <section className="client-person-heading">
            <div className="client-person-identity">
              <UserAvatar name={user.name} avatarKey={user.avatarKey} className="client-person-avatar" />
              <h1>{user.name}</h1>
            </div>
          </section>
        </div>

        {debts.length ? <PaymentDialog userId={user.id} debts={debts} /> : (
          <section className={`client-debt-section ${debts.length ? "has-debt" : "is-clear"}`}>
          <header className={`client-debt-overview ${debts.length ? "has-debt" : "clear"}`}>
            <div>
              <h2>Khoản cần thanh toán</h2>
              <p>{debts.length ? `${debts.length} buổi còn nợ` : "Không còn khoản nợ nào"}</p>
            </div>
          </header>
          {debts.length ? (
            <div className="client-debt-column-head" aria-hidden="true">
              <span>Chi tiết buổi</span>
              <span>Slot</span>
              <span>Số tiền</span>
            </div>
          ) : null}
          <div className="client-debt-list">
            {debts.map((debt) => (
              <article className="client-debt-card" key={debt.sessionMemberId}>
                <div className="debt-date"><strong>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", timeZone: "UTC" }).format(new Date(debt.playedAt))}</strong><span>THÁNG {new Intl.DateTimeFormat("vi-VN", { month: "2-digit", timeZone: "UTC" }).format(new Date(debt.playedAt))}</span></div>
                <div className="debt-info"><h2>{debt.title}</h2>{debt.sessionNote ? <p>{debt.sessionNote}</p> : null}{debt.note ? <span className="member-note">Ghi chú cho bạn: {debt.note}</span> : null}</div>
                <div className="debt-slots"><strong>{debt.slots}</strong></div>
                <strong className="debt-amount">{formatVnd(debt.totalOutstanding)}</strong>
              </article>
            ))}
            {!debts.length ? <div className="client-empty paid-empty"><span>✓</span><h2>Đã thanh toán hết</h2><p>Hẹn gặp bạn ở trận tiếp theo!</p></div> : null}
          </div>
          <footer className={`client-debt-total ${debts.length ? "has-debt" : "clear"}`}>
            <span>{debts.length ? "Tổng" : "Trạng thái"}</span>
            <strong>{debts.length ? formatVnd(outstanding) : "Hết nợ"}</strong>
          </footer>
          </section>
        )}
      </main>
    </ClientShell>
  );
}
