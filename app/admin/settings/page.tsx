import Link from "next/link";
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
import {
  DEFAULT_LLM_SETTINGS,
  LLM_SETTING_KEYS,
  LLM_SETTING_TYPE,
  SEND_MESSAGE_SETTING_KEYS,
  SEND_MESSAGE_SETTING_TYPE,
} from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const prisma = getPrisma();
  const [settings, llmSettings, reminderSchedule, reminderRuns] = await Promise.all([
    prisma.setting.findMany({
      where: { type: SEND_MESSAGE_SETTING_TYPE },
      select: { key: true, value: true, enabled: true },
    }),
    prisma.setting.findMany({
      where: { type: LLM_SETTING_TYPE },
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
  const prodChatUrl =
    settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.prodChatUrl)?.value ??
    settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.chatUrl)?.value ??
    "https://www.messenger.com/t/2245150785540070";
  const testChatUrl =
    settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.testChatUrl)?.value ??
    "https://www.messenger.com/t/954763997032636";

  const llmSettingsByKey = new Map(llmSettings.map((s) => [s.key, s]));
  const targetEnv = (settingsByKey.get(SEND_MESSAGE_SETTING_KEYS.targetEnv)?.value === "prod"
    ? "prod"
    : (llmSettingsByKey.get(LLM_SETTING_KEYS.targetEnv)?.value === "prod" ? "prod" : "test")) as "test" | "prod";
  const activeChatUrl = targetEnv === "prod" ? prodChatUrl : testChatUrl;

  const enabled = settings.length > 0 && settings.every((setting) => setting.enabled);
  const messengerConfigured = enabled && Boolean(apiUrl && apiKey && (prodChatUrl || testChatUrl));

  const llmApiUrl =
    llmSettingsByKey.get(LLM_SETTING_KEYS.apiUrl)?.value ?? DEFAULT_LLM_SETTINGS.apiUrl;
  const llmApiKey = llmSettingsByKey.get(LLM_SETTING_KEYS.apiKey)?.value ?? "";
  const llmModel =
    llmSettingsByKey.get(LLM_SETTING_KEYS.model)?.value ?? DEFAULT_LLM_SETTINGS.model;
  const llmReasoningEffort =
    llmSettingsByKey.get(LLM_SETTING_KEYS.reasoningEffort)?.value ??
    DEFAULT_LLM_SETTINGS.reasoningEffort;
  const llmSystemPrompt =
    llmSettingsByKey.get(LLM_SETTING_KEYS.systemPrompt)?.value ?? DEFAULT_LLM_SETTINGS.systemPrompt;
  const llmDebtReminderPrompt =
    llmSettingsByKey.get(LLM_SETTING_KEYS.debtReminderPrompt)?.value ??
    DEFAULT_LLM_SETTINGS.debtReminderPrompt;
  const llmAiDebtReminderEnabled =
    llmSettingsByKey.get(LLM_SETTING_KEYS.aiDebtReminderEnabled)?.value === "true";
  const llmEnabled = llmSettings.length > 0 && llmSettings.every((s) => s.enabled);

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

        <div className="settings-section-divider">
          <h2>Tích hợp Messenger & Tự động hóa</h2>
          <p>Cấu hình bot gửi thông báo, thử nghiệm tin nhắn tag tên và lịch nhắc nợ tự động.</p>
        </div>

        <section className="panel settings-integration-panel">
          <SendMessageSettingsForm
            enabled={enabled}
            apiUrl={apiUrl}
            prodChatUrl={prodChatUrl}
            testChatUrl={testChatUrl}
            targetEnv={targetEnv}
            hasApiKey={Boolean(apiKey)}
          />
        </section>

        <section className="panel settings-ai-link-panel">
          <div className="settings-ai-link-content">
            <div className="settings-ai-link-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z" />
              </svg>
            </div>
            <div>
              <h3>Cấu hình Trợ lý AI đã được tách thành tab riêng</h3>
              <p>Mô hình LLM, Reasoning Effort, System Prompt và danh mục Prompt của 15 Kỹ năng AI hiện được tập trung tại tab Trợ lý AI.</p>
            </div>
          </div>
          <Link href="/admin/ai" className="btn btn-primary btn-sm">
            Mở Cấu hình AI →
          </Link>
        </section>

        <section className="panel settings-messenger-actions-panel">
          <MessengerActions
            configured={messengerConfigured}
            targetEnv={targetEnv}
            activeChatUrl={activeChatUrl}
            aiDebtReminderEnabled={llmAiDebtReminderEnabled}
          />
        </section>

        <DebtReminderScheduleForm
          configured={messengerConfigured}
          enabled={schedule.enabled}
          days={schedule.days}
          times={schedule.times}
          nextRunAt={nextRunAt}
          recentRuns={reminderRuns.map((run) => ({ ...run, scheduledFor: run.scheduledFor.toISOString() }))}
        />

        <div className="settings-section-divider">
          <h2>Hệ thống & Dữ liệu người dùng</h2>
          <p>Kiểm tra kết nối ứng dụng Android và đồng bộ danh sách thành viên từ JSON.</p>
        </div>

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

        <div className="settings-section-divider settings-section-divider-danger">
          <h2>Bảo trì & Quản lý dữ liệu</h2>
          <p>Dọn dẹp dữ liệu giao dịch hoặc khôi phục cài đặt gốc của hệ thống.</p>
        </div>

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
