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
    getPrisma().footballSession.findUnique({
      where: { id },
      include: { members: { select: { id: true, userId: true, slots: true, amountDue: true, amountPaid: true, manualPaidAt: true, note: true } } },
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
            defaultWaterAmount: session.defaultWaterAmount,
            status: session.status,
            members: session.members.map((member) => ({ ...member, manualPaidAt: member.manualPaidAt?.toISOString() ?? null, note: member.note ?? "" })),
          }}
        />
      </div>
    </AdminShell>
  );
}
