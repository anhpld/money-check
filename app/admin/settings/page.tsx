import { ResetDataButton } from "@/app/admin/settings/reset-data-button";
import { ResetActivityDataButton } from "@/app/admin/settings/reset-activity-data-button";
import { DebtReminderButton } from "@/app/admin/settings/debt-reminder-button";
import { SendMessageSettingsForm } from "@/app/admin/settings/send-message-settings-form";
import { UserSyncForm } from "@/app/admin/settings/user-sync-form";
import { AndroidStatusCheck } from "@/app/admin/settings/android-status-check";
import { AdminShell } from "@/app/components/admin-shell";
import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getPrisma().setting.findMany({
    where: { type: SEND_MESSAGE_SETTING_TYPE },
    select: { key: true, value: true, enabled: true },
  });
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const apiUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiUrl)?.value ?? "";
  const apiKey = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiKey)?.value ?? "";
  const chatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.chatUrl)?.value ?? "";
  const enabled = settings.length > 0 && settings.every((setting) => setting.enabled);
  const messengerConfigured = enabled && Boolean(apiUrl && apiKey && chatUrl);

  return (
    <AdminShell active="settings">
      <div className="page-content settings-page">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">CÀI ĐẶT HỆ THỐNG</p><h1>Cài đặt</h1><p>Quản lý dữ liệu và các thiết lập chung của ứng dụng.</p></div>
        </div>

        <section className="panel settings-integration-panel">
          <SendMessageSettingsForm enabled={enabled} apiUrl={apiUrl} chatUrl={chatUrl} hasApiKey={Boolean(apiKey)} />
        </section>

        <section className="panel settings-device-status-panel">
          <div>
            <span className="settings-section-label">Android</span>
            <h2>Trạng thái ứng dụng</h2>
            <p>Gửi tín hiệu kiểm tra trực tiếp tới ứng dụng Android và chờ phản hồi tối đa 5 giây.</p>
          </div>
          <AndroidStatusCheck />
        </section>

        <section className="panel settings-user-sync-panel">
          <UserSyncForm />
        </section>

        <section className="panel settings-reminder-panel">
          <div>
            <span className="settings-section-label">Nhắc nợ</span>
            <h2>Gửi danh sách còn nợ</h2>
            <p>Gộp các thành viên theo số buổi còn nợ và gửi một tin nhắn vào group Messenger.</p>
          </div>
          <DebtReminderButton configured={messengerConfigured} />
        </section>

        <section className="panel settings-maintenance-zone">
          <div>
            <span className="settings-section-label">Dọn dữ liệu</span>
            <h2>Reset dữ liệu, giữ người dùng</h2>
            <p>Xóa toàn bộ khoản thu, giao dịch và webhook log nhưng giữ nguyên danh sách user, avatar và cấu hình hệ thống.</p>
          </div>
          <ResetActivityDataButton />
        </section>

        <section className="panel settings-danger-zone">
          <div>
            <span className="settings-danger-label">Vùng nguy hiểm</span>
            <h2>Reset dữ liệu ứng dụng</h2>
            <p>Xóa toàn bộ người dùng, khoản thu và lịch sử giao dịch hiện tại. Cấu hình hệ thống và tài khoản admin vẫn được giữ nguyên.</p>
          </div>
          <ResetDataButton />
        </section>
      </div>
    </AdminShell>
  );
}
