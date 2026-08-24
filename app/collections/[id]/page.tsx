import { notFound } from "next/navigation";
import { AdminShell } from "@/app/components/admin-shell";
import { CollectionEditor } from "@/app/collections/collection-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditCollectionPage({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  const [users, session] = await Promise.all([
    getPrisma().user.findMany({
      where: {
        OR: [
          { isActive: true },
          { sessionMembers: { some: { sessionId: id } } },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarKey: true },
    }),
    getPrisma().footballSession.findFirst({
      where: { id, deletedAt: null },
      include: {
        chargeOptions: { orderBy: { sortOrder: "asc" } },
        members: {
          include: {
            manualPaymentOptions: { orderBy: { sortOrder: "asc" } },
            paymentItems: {
              where: { paymentRequest: { status: "PAID" } },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    }),
  ]);
  if (!session) notFound();

  return (
    <AdminShell active="collections">
      <div className="page-content editor-page-content">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">CHỈNH SỬA KHOẢN THU</p><h1>{session.title}</h1><p>{session.status === "DRAFT" ? "Bản nháp chưa hiển thị cho người dùng." : "Khoản thu đang hiển thị cho người dùng."}</p></div>
          <span className={`session-status ${session.status.toLowerCase()}`}><i />{session.status === "DRAFT" ? "Bản nháp" : session.status === "PUBLISHED" ? "Đã public" : "Đã đóng"}</span>
        </div>
        <CollectionEditor
          users={users}
          initial={{
            id: session.id,
            title: session.title,
            playedAt: session.playedAt.toISOString().slice(0, 10),
            note: session.note ?? "",
            totalAmount: session.totalAmount,
            chargeOptions: session.chargeOptions.map((option) => ({
              id: option.id,
              name: option.name,
              defaultAmount: option.defaultAmount,
              autoSelected: option.autoSelected,
              allowCustomAmount: option.allowCustomAmount,
            })),
            status: session.status,
            members: session.members.map((member) => {
              const paidOptionIds = new Set<string>();
              const optionAmounts = new Map<string, number>();
              for (const option of [
                ...member.paymentItems.flatMap((item) => item.options),
                ...member.manualPaymentOptions,
              ]) {
                if (option.optionId) paidOptionIds.add(option.optionId);
                optionAmounts.set(option.name, (optionAmounts.get(option.name) ?? 0) + option.amount);
              }
              return {
                id: member.id,
                userId: member.userId,
                slots: member.slots,
                amountDue: member.amountDue,
                amountPaid: member.amountPaid,
                manualPaidAt: member.manualPaidAt?.toISOString() ?? null,
                paidOptionIds: [...paidOptionIds],
                note: member.note ?? "",
                paidBreakdown: {
                  footballAmount: member.paymentItems.reduce((sum, item) => sum + item.footballAmount, member.manualFootballAmount ?? 0),
                  options: [...optionAmounts].map(([name, amount]) => ({ name, amount })),
                },
              };
            }),
          }}
        />
      </div>
    </AdminShell>
  );
}
