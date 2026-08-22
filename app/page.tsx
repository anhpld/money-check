import { AdminShell } from "@/app/components/admin-shell";
import { UsersManager, type UserItem } from "@/app/components/users-manager";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUsers(): Promise<{ users: UserItem[]; databaseError: boolean }> {
  try {
    const users = await getPrisma().user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, avatarKey: true, isActive: true },
    });
    return { users, databaseError: false };
  } catch (error) {
    console.error("Không thể tải danh sách người dùng:", error);
    return { users: [], databaseError: true };
  }
}

export default async function AdminPage() {
  const { users, databaseError } = await getUsers();

  return (
    <AdminShell active="users">
      <div className="page-content">
        <div className="page-heading compact-heading">
          <div>
            <p className="eyebrow">QUẢN LÝ NGƯỜI DÙNG</p>
            <h1>Danh sách người dùng</h1>
            <p>Thêm và quản lý những người tham gia thanh toán.</p>
          </div>
        </div>

        <UsersManager users={users} databaseError={databaseError} />
      </div>
    </AdminShell>
  );
}
