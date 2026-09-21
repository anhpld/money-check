import { AdminShell } from "@/app/components/admin-shell";
import { UserAvatar } from "@/app/components/user-avatar";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const users = await getPrisma().user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      avatarKey: true,
      sessionMembers: {
        where: { session: { kind: "MATCH", deletedAt: null } },
        select: { goals: true, assists: true },
      },
    },
  });
  const rows = users.map((user) => ({
    ...user,
    appearances: user.sessionMembers.length,
    goals: user.sessionMembers.reduce((sum, participant) => sum + participant.goals, 0),
    assists: user.sessionMembers.reduce((sum, participant) => sum + participant.assists, 0),
  })).filter((user) => user.appearances > 0).sort((left, right) => right.appearances - left.appearances || right.goals - left.goals || left.name.localeCompare(right.name, "vi"));

  return <AdminShell active="statistics"><div className="page-stack">
    <header className="page-header"><div><p className="eyebrow">TỔNG KẾT</p><h1>Thống kê thành viên</h1><p>Mỗi người được chọn trong một trận được tính một lần tham gia.</p></div></header>
    <section className="panel"><div className="table-wrap"><table><thead><tr><th>#</th><th>Thành viên</th><th>Trận tham gia</th><th>Bàn thắng</th><th>Kiến tạo</th><th>Đóng góp</th></tr></thead><tbody>{rows.map((user, index) => <tr key={user.id}><td>{index + 1}</td><td><div className="table-user"><UserAvatar name={user.name} avatarKey={user.avatarKey} className="user-avatar" toneIndex={index} /><strong>{user.name}</strong></div></td><td><strong>{user.appearances}</strong></td><td>{user.goals}</td><td>{user.assists}</td><td>{user.goals + user.assists}</td></tr>)}</tbody></table></div>{!rows.length ? <div className="transaction-empty"><h2>Chưa có dữ liệu</h2><p>Thống kê sẽ xuất hiện sau khi tạo trận đấu.</p></div> : null}</section>
  </div></AdminShell>;
}
