import { AdminShell } from "@/app/components/admin-shell";
import { CollectionEditor } from "@/app/collections/collection-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage() {
  const users = await getPrisma().user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, avatarKey: true },
  });

  return (
    <AdminShell active="collections">
      <div className="page-content editor-page-content">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">KHOẢN THU MỚI</p><h1>Tạo buổi đá bóng</h1><p>Nhập ngày đá, chi phí, chọn người tham gia rồi kiểm tra trước khi public.</p></div>
        </div>
        <CollectionEditor users={users} />
      </div>
    </AdminShell>
  );
}
