import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/app/client/client-shell";
import { PaymentDialog, type ClientDebtItem } from "@/app/client/payment-dialog";
import { UserAvatar } from "@/app/components/user-avatar";
import { getPrisma } from "@/lib/prisma";
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

  return (
    <ClientShell>
      <main className="client-main client-detail-main">
        <div className="client-detail-header">
          <Link className="btn btn-ghost btn-sm client-back" href="/client"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>Danh sách thành viên</span></Link>

          <section className="card card-border client-person-heading bg-base-100 shadow-sm">
            <div className="card-body client-person-identity flex-row items-center p-4">
              <UserAvatar name={user.name} avatarKey={user.avatarKey} className="client-person-avatar" />
              <div>
                <span className="text-xs text-base-content/55">Khoản thu của</span>
                <h1 className="card-title">{user.name}</h1>
              </div>
            </div>
          </section>
        </div>

        {debts.length ? <PaymentDialog userId={user.id} debts={debts} /> : (
          <section className="card card-border client-debt-section is-clear bg-base-100 shadow-sm">
            <div className="card-body items-center py-14 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-success/10 text-2xl font-black text-success" aria-hidden="true">✓</span>
              <div>
                <h2 className="card-title justify-center">Đã thanh toán hết</h2>
                <p className="mt-2 text-sm text-base-content/60">Bạn không còn khoản nào cần trả.</p>
              </div>
              <Link className="btn btn-soft btn-sm mt-2" href="/client">Về danh sách thành viên</Link>
            </div>
          </section>
        )}
      </main>
    </ClientShell>
  );
}
