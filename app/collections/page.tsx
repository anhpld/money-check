import Link from "next/link";
import { AdminShell } from "@/app/components/admin-shell";
import { CreateCollectionButton } from "@/app/collections/create-collection-button";
import { getPrisma } from "@/lib/prisma";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const sessions = await getPrisma().footballSession.findMany({
    where: { deletedAt: null },
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
    include: {
      opponent: true,
      members: {
        select: {
          amountDue: true,
          amountPaid: true,
        },
      },
    },
  });

  return (
    <AdminShell active="collections">
      <div className="page-content">
        <div className="page-heading collection-page-heading">
          <div>
            <p className="eyebrow">QUẢN LÝ KHOẢN THU</p>
            <h1>Các khoản thu</h1>
            <p>Tiền trận, áo đội, quỹ và mọi khoản thu khác dùng chung một luồng thanh toán.</p>
          </div>
          <CreateCollectionButton />
        </div>

        {sessions.length ? (
          <div className="session-grid">
            {sessions.map((session) => {
              const allocated = session.members.reduce((sum, member) => sum + member.amountDue, 0);
              const paidByMember = session.members.map((member) => member.amountPaid);
              const paid = paidByMember.reduce((sum, amount) => sum + amount, 0);
              const paidMembers = session.members.filter((member, index) => paidByMember[index] >= member.amountDue).length;
              const outstanding = session.members.reduce((sum, member) => sum + Math.max(member.amountDue - member.amountPaid, 0), 0);
              return (
                <article className="session-card panel" key={session.id}>
                  <div className="session-card-top">
                    <span className={`session-status ${session.status.toLowerCase()}`}><i />{session.status === "DRAFT" ? "Bản nháp" : session.status === "PUBLISHED" ? "Đã public" : "Đã đóng"}</span>
                    <span className="session-date">{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(session.playedAt)}</span>
                  </div>
                  <span className="collection-kind">{session.kind === "MATCH" ? `Trận đấu · ${session.opponent?.name ?? "Chưa cập nhật đối thủ"}` : "Khoản thu khác"}</span>
                  <h2>{session.title}</h2>
                  <p className="session-location">{session.kind === "MATCH" && session.ourScore !== null && session.opponentScore !== null ? `Kết quả ${session.ourScore} - ${session.opponentScore}` : session.note || "Không có ghi chú"}</p>
                  <div className="session-money"><span>Tổng tiền<strong>{formatVnd(session.totalAmount)}</strong></span><span>Còn lại<strong>{formatVnd(outstanding)}</strong></span></div>
                  <div className="session-progress-heading"><span>Đã đóng</span><strong>{paidMembers}/{session.members.length} người</strong></div>
                  <div className="session-progress"><span style={{ width: `${allocated ? Math.min((paid / allocated) * 100, 100) : 0}%` }} /></div>
                  <div className="session-card-bottom">
                    <span>Phân bổ {formatVnd(allocated)}</span>
                    <Link href={`/admin/collections/${session.id}`}>{session.status === "DRAFT" ? "Tiếp tục" : "Xem & sửa"}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="panel collections-empty">
            <span className="empty-illustration"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 19h40v32H12zM20 13v12M44 13v12M12 29h40M23 39h.01M32 39h.01M41 39h.01" /></svg></span>
            <h2>Chưa có khoản thu nào</h2>
            <p>Tạo khoản thu, chọn người cần đóng và nhập số tiền.</p>
            <CreateCollectionButton label="Tạo khoản thu đầu tiên" />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
