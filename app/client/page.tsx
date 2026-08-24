import { cookies } from "next/headers";
import { ClientShell } from "@/app/client/client-shell";
import { ClientUserList } from "@/app/client/client-user-list";
import { RECENT_PAID_USER_COOKIE } from "@/lib/client-preference";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const [cookieStore, users] = await Promise.all([
    cookies(),
    getPrisma().user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        sessionMembers: {
          where: { session: { status: "PUBLISHED", deletedAt: null } },
          select: { amountDue: true, amountPaid: true },
        },
      },
    }),
  ]);
  const recentPaidUserId = cookieStore.get(RECENT_PAID_USER_COOKIE)?.value;
  const userSummaries = users.map((user) => {
    const debts = user.sessionMembers.map((member) => Math.max(member.amountDue - member.amountPaid, 0));
    return {
      id: user.id,
      name: user.name,
      avatarKey: user.avatarKey,
      debtCount: debts.filter((amount) => amount > 0).length,
      outstanding: debts.reduce((sum, amount) => sum + amount, 0),
      recentlyPaid: user.id === recentPaidUserId,
    };
  }).sort((a, b) => Number(b.outstanding > 0) - Number(a.outstanding > 0)
    || b.debtCount - a.debtCount
    || Number(b.recentlyPaid) - Number(a.recentlyPaid)
    || a.name.localeCompare(b.name, "vi"));

  return (
    <ClientShell>
      <main className="client-main">
        <section className="client-hero">
          <p className="client-kicker">QUỸ BÓNG ĐÁ</p>
          <h1>FC ĐÔNG ĐÔ</h1>

        </section>

        <ClientUserList users={userSummaries} />
      </main>
    </ClientShell>
  );
}
