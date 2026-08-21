import { ClientShell } from "@/app/client/client-shell";
import { ClientUserList } from "@/app/client/client-user-list";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const users = await getPrisma().user.findMany({
    orderBy: { name: "asc" },
    include: {
      sessionMembers: {
        where: { session: { status: "PUBLISHED" } },
        select: { amountDue: true, amountPaid: true },
      },
    },
  });
  const userSummaries = users.map((user) => {
    const debts = user.sessionMembers.map((member) => Math.max(member.amountDue - member.amountPaid, 0));
    return {
      id: user.id,
      name: user.name,
      debtCount: debts.filter((amount) => amount > 0).length,
      outstanding: debts.reduce((sum, amount) => sum + amount, 0),
    };
  }).sort((a, b) => b.debtCount - a.debtCount || a.name.localeCompare(b.name, "vi"));

  return (
    <ClientShell>
      <main className="client-main">
        <section className="client-hero">
          <p className="client-kicker">QUỸ BÓNG ĐÁ</p>
          <h1>Chọn tên của bạn</h1>
          <p>Xem những buổi còn nợ và thanh toán một lần thật nhanh.</p>
        </section>

        <ClientUserList users={userSummaries} />
      </main>
    </ClientShell>
  );
}
