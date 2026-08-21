import Link from "next/link";
import { ClientShell } from "@/app/client/client-shell";
import { getPrisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const users = await getPrisma().user.findMany({
    orderBy: { name: "asc" },
    include: {
      sessionMembers: {
        where: { session: { status: "PUBLISHED" } },
        select: { amountDue: true, amountPaid: true, waterAmount: true },
      },
    },
  });
  const userSummaries = users.map((user) => {
    const debts = user.sessionMembers.map((member) => Math.max(member.amountDue + (member.waterAmount ?? 0) - member.amountPaid, 0));
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

        <section className="client-user-list" aria-label="Danh sách người dùng">
          {userSummaries.map((user, index) => (
            <Link className="client-user-card" href={`/client/${user.id}`} key={user.id}>
              <span className={`client-user-avatar tone-${index % 5}`}>{user.name[0]?.toUpperCase()}</span>
              <span className="client-user-name"><strong>{user.name}</strong><small>{user.debtCount ? `${user.debtCount} buổi chưa thanh toán` : "Đã thanh toán hết"}</small></span>
              <span className={`client-user-debt ${user.debtCount ? "has-debt" : "clear"}`}>
                <strong>{user.debtCount ? formatVnd(user.outstanding) : "Xong"}</strong>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </Link>
          ))}
          {!userSummaries.length ? <div className="client-empty"><h2>Chưa có người dùng</h2><p>Danh sách sẽ xuất hiện sau khi admin thêm người.</p></div> : null}
        </section>
      </main>
    </ClientShell>
  );
}
