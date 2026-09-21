import { ResetDataButton } from "@/app/admin/settings/reset-data-button";
import { ResetActivityDataButton } from "@/app/admin/settings/reset-activity-data-button";
import { MessengerActions } from "@/app/admin/settings/messenger-actions";
import { SendMessageSettingsForm } from "@/app/admin/settings/send-message-settings-form";
import { UserSyncForm } from "@/app/admin/settings/user-sync-form";
import { AndroidStatusCheck } from "@/app/admin/settings/android-status-check";
import { DebtReminderScheduleForm } from "@/app/admin/settings/debt-reminder-schedule-form";
import { AdminShell } from "@/app/components/admin-shell";
import {
  DEFAULT_DEBT_REMINDER_DAYS,
  DEFAULT_DEBT_REMINDER_TIMES,
  DEBT_REMINDER_SCHEDULE_ID,
  DEBT_REMINDER_TIMEZONE,
  getNextDebtReminderAt,
} from "@/lib/debt-reminder";
import { SEND_MESSAGE_SETTING_KEYS, SEND_MESSAGE_SETTING_TYPE } from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prisma = getPrisma();
  const [settings, reminderSchedule, reminderRuns] = await Promise.all([
    prisma.setting.findMany({
      where: { type: SEND_MESSAGE_SETTING_TYPE },
      select: { key: true, value: true, enabled: true },
    }),
    prisma.debtReminderSchedule.findUnique({ where: { id: DEBT_REMINDER_SCHEDULE_ID } }),
    prisma.debtReminderRun.findMany({
      where: { scheduleId: DEBT_REMINDER_SCHEDULE_ID },
      orderBy: { scheduledFor: "desc" },
      take: 5,
      select: { id: true, scheduledFor: true, status: true, debtorCount: true, error: true },
    }),
  ]);
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const apiUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiUrl)?.value ?? "";
  const apiKey = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.apiKey)?.value ?? "";
  const chatUrl = settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.chatUrl)?.value ?? "";
  const enabled = settings.length > 0 && settings.every((setting) => setting.enabled);
  const messengerConfigured = enabled && Boolean(apiUrl && apiKey && chatUrl);
  const schedule = {
    enabled: reminderSchedule?.enabled ?? false,
    days: reminderSchedule?.days ?? DEFAULT_DEBT_REMINDER_DAYS,
    times: reminderSchedule?.times ?? DEFAULT_DEBT_REMINDER_TIMES,
    timezone: reminderSchedule?.timezone ?? DEBT_REMINDER_TIMEZONE,
  };
  const nextRunAt = getNextDebtReminderAt(schedule)?.toISOString() ?? null;

  return (
    <AdminShell active="settings">
      <div className="page-content settings-page">
        <div className="page-heading compact-heading">
          <div><p className="eyebrow">CÀI ĐẶT HỆ THỐNG</p><h1>Cài đặt</h1><p>Quản lý dữ liệu và các thiết lập chung của ứng dụng.</p></div>
        </div>

        <section className="panel settings-integration-panel">
          <SendMessageSettingsForm enabled={enabled} apiUrl={apiUrl} chatUrl={chatUrl} hasApiKey={Boolean(apiKey)} />
          <MessengerActions configured={messengerConfigured} />
        </section>

        <DebtReminderScheduleForm
          configured={messengerConfigured}
          enabled={schedule.enabled}
          days={schedule.days}
          times={schedule.times}
          nextRunAt={nextRunAt}
          recentRuns={reminderRuns.map((run) => ({ ...run, scheduledFor: run.scheduledFor.toISOString() }))}
        />

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

        <section className="panel settings-maintenance-zone">
          <div>
            <span className="settings-section-label">Dọn dữ liệu</span>
            <h2>Reset dữ liệu, giữ người dùng</h2>
            <p>Xóa toàn bộ trận đấu, khoản thu, giao dịch và webhook log nhưng giữ nguyên user, đối thủ, avatar và cấu hình hệ thống.</p>
          </div>
          <ResetActivityDataButton />
        </section>

        <section className="panel settings-danger-zone">
          <div>
            <span className="settings-danger-label">Vùng nguy hiểm</span>
            <h2>Reset dữ liệu ứng dụng</h2>
            <p>Xóa toàn bộ người dùng, đối thủ, trận đấu, khoản thu và lịch sử giao dịch. Cấu hình hệ thống và tài khoản admin vẫn được giữ nguyên.</p>
          </div>
          <ResetDataButton />
        </section>
      </div>
    </AdminShell>
  );
}
