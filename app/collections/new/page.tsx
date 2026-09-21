import { AdminShell } from "@/app/components/admin-shell";
import { CollectionEditor } from "@/app/collections/collection-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const [users, opponents] = await Promise.all([
    getPrisma().user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, avatarKey: true } }),
    getPrisma().opponent.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <AdminShell active="collections">
      <div className="page-content editor-page-content">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">KHOẢN THU MỚI</p><h1>Tạo khoản thu</h1><p>Chọn “Trận đấu” để lưu thành tích, hoặc “Khoản thu khác” cho áo đội, quỹ và nội dung tự do.</p></div>
        </div>
        <CollectionEditor users={users} opponents={opponents} />
      </div>
    </AdminShell>
  );
}
