import { AdminShell } from "@/app/components/admin-shell";
import { CollectionEditor } from "@/app/collections/collection-editor";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const requestedKind = (await searchParams).kind;
  const initialKind = requestedKind === "GENERAL" ? "GENERAL" : "MATCH";
  const [users, opponents] = await Promise.all([
    getPrisma().user.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, avatarKey: true } }),
    getPrisma().opponent.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <AdminShell active="collections">
      <div className="page-content editor-page-content">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">KHOẢN THU MỚI</p><h1>{initialKind === "MATCH" ? "Tạo trận đấu" : "Tạo khoản thu khác"}</h1><p>{initialKind === "MATCH" ? "Nhập thông tin trận, người tham gia và số tiền cần thu." : "Dùng cho tiền áo, quỹ đội hoặc một nội dung thu tự do."}</p></div>
        </div>
        <CollectionEditor users={users} opponents={opponents} initialKind={initialKind} />
      </div>
    </AdminShell>
  );
}
