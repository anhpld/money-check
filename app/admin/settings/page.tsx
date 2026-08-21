import { ResetDataButton } from "@/app/admin/settings/reset-data-button";
import { AdminShell } from "@/app/components/admin-shell";

export default function SettingsPage() {
  return (
    <AdminShell active="settings">
      <div className="page-content settings-page">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">CÀI ĐẶT HỆ THỐNG</p><h1>Cài đặt</h1><p>Quản lý dữ liệu và các thiết lập chung của ứng dụng.</p></div>
        </div>

        <section className="panel settings-danger-zone">
          <div>
            <span className="settings-danger-label">Vùng nguy hiểm</span>
            <h2>Reset dữ liệu ứng dụng</h2>
            <p>Xóa toàn bộ người dùng, khoản thu và lịch sử giao dịch hiện tại. Cấu trúc database và tài khoản admin vẫn được giữ nguyên.</p>
          </div>
          <ResetDataButton />
        </section>
      </div>
    </AdminShell>
  );
}
