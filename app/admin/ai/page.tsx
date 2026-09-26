import { AdminShell } from "@/app/components/admin-shell";
import { LlmSettingsForm } from "@/app/admin/settings/llm-settings-form";
import { AiTabsContainer } from "@/app/admin/ai/ai-tabs-container";
import {
  DEFAULT_LLM_SETTINGS,
  DEFAULT_SUBSYSTEM_PROMPTS,
  LLM_SETTING_KEYS,
  LLM_SETTING_TYPE,
  SEND_MESSAGE_SETTING_KEYS,
  SEND_MESSAGE_SETTING_TYPE,
} from "@/lib/app-settings";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AiAdminPage() {
  const prisma = getPrisma();
  const [llmSettings, sendMsgSettings] = await Promise.all([
    prisma.setting.findMany({
      where: { type: LLM_SETTING_TYPE },
      select: { key: true, value: true, enabled: true },
    }),
    prisma.setting.findMany({
      where: { type: SEND_MESSAGE_SETTING_TYPE },
      select: { key: true, value: true, enabled: true },
    }),
  ]);

  const llmMap = new Map(llmSettings.map((s) => [s.key, s]));
  const sendMsgMap = new Map(sendMsgSettings.map((s) => [s.key, s]));

  const targetEnv = (sendMsgMap.get(SEND_MESSAGE_SETTING_KEYS.targetEnv)?.value === "prod"
    ? "prod"
    : (llmMap.get(LLM_SETTING_KEYS.targetEnv)?.value === "prod" ? "prod" : "test")) as "test" | "prod";

  const llmApiUrl = llmMap.get(LLM_SETTING_KEYS.apiUrl)?.value ?? DEFAULT_LLM_SETTINGS.apiUrl;
  const llmApiKey = llmMap.get(LLM_SETTING_KEYS.apiKey)?.value ?? "";
  const llmModel = llmMap.get(LLM_SETTING_KEYS.model)?.value ?? DEFAULT_LLM_SETTINGS.model;
  const llmReasoningEffort =
    llmMap.get(LLM_SETTING_KEYS.reasoningEffort)?.value ?? DEFAULT_LLM_SETTINGS.reasoningEffort;
  const llmSystemPrompt =
    llmMap.get(LLM_SETTING_KEYS.systemPrompt)?.value ?? DEFAULT_LLM_SETTINGS.systemPrompt;
  const llmDebtReminderPrompt =
    llmMap.get(LLM_SETTING_KEYS.debtReminderPrompt)?.value ?? DEFAULT_LLM_SETTINGS.debtReminderPrompt;
  const llmAiDebtReminderEnabled =
    llmMap.get(LLM_SETTING_KEYS.aiDebtReminderEnabled)?.value === "true";
  const llmEnabled = llmSettings.length > 0 && llmSettings.every((s) => s.enabled);

  // Subsystem prompts from DB or fallback
  const subsystemPrompts: Record<string, string> = {
    [LLM_SETTING_KEYS.promptDirectMemory]:
      llmMap.get(LLM_SETTING_KEYS.promptDirectMemory)?.value || DEFAULT_SUBSYSTEM_PROMPTS.directMemory,
    [LLM_SETTING_KEYS.promptBatchMemory]:
      llmMap.get(LLM_SETTING_KEYS.promptBatchMemory)?.value || DEFAULT_SUBSYSTEM_PROMPTS.batchMemory,
    [LLM_SETTING_KEYS.promptSoulCondensation]:
      llmMap.get(LLM_SETTING_KEYS.promptSoulCondensation)?.value || DEFAULT_SUBSYSTEM_PROMPTS.soulCondensation,
    [LLM_SETTING_KEYS.promptDynamicContext]:
      llmMap.get(LLM_SETTING_KEYS.promptDynamicContext)?.value || DEFAULT_SUBSYSTEM_PROMPTS.dynamicContext,
  };

  const llmConfigNode = (
    <LlmSettingsForm
      enabled={llmEnabled}
      apiUrl={llmApiUrl}
      hasApiKey={Boolean(llmApiKey)}
      model={llmModel}
      reasoningEffort={llmReasoningEffort}
      systemPrompt={llmSystemPrompt}
      debtReminderPrompt={llmDebtReminderPrompt}
      targetEnv={targetEnv}
      aiDebtReminderEnabled={llmAiDebtReminderEnabled}
    />
  );

  return (
    <AdminShell active="ai">
      <div className="page-content ai-admin-page">
        <header className="page-heading overview-heading">
          <div>
            <p className="eyebrow">HỆ THỐNG TRÍ TUỆ NHÂN TẠO</p>
            <h1>Cấu hình Trợ lý AI</h1>
            <p>
              Quản lý mô hình LLM, tinh chỉnh System Prompt và tra cứu toàn bộ 15 Kỹ năng AI của bot Vũ Quang Bình (FC Đông Đô).
            </p>
          </div>
          <div className="ai-status-summary-bar">
            <span className={`status-pill ${llmEnabled ? "status-online" : "status-offline"}`}>
              {llmEnabled ? "Đang hoạt động" : "Đang tắt"}
            </span>
            <span className="status-pill status-model">{llmModel}</span>
            <span className="status-pill status-env">
              {targetEnv === "prod" ? "PROD Nhóm thật" : "TEST Nhóm test"}
            </span>
          </div>
        </header>

        {/* 3 Top-level Segmented Tabs: Config, Prompts (Editable), Tools (Searchable) */}
        <AiTabsContainer
          llmConfigForm={llmConfigNode}
          subsystemPrompts={subsystemPrompts}
        />
      </div>
    </AdminShell>
  );
}
