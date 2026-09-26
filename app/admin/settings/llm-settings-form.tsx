"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  fetchLlmModels,
  saveLlmSettings,
  testLlmModel,
  type SaveLlmSettingsResult,
} from "@/app/admin/settings/actions";
import { DEFAULT_LLM_SETTINGS } from "@/lib/app-settings";

type Props = {
  enabled: boolean;
  apiUrl: string;
  hasApiKey: boolean;
  model: string;
  reasoningEffort?: string;
  systemPrompt: string;
  debtReminderPrompt?: string;
  targetEnv: "test" | "prod";
  aiDebtReminderEnabled: boolean;
};

const initialState: SaveLlmSettingsResult = { status: "idle", message: "" };

export function LlmSettingsForm({
  enabled,
  apiUrl,
  hasApiKey,
  model: initialModel,
  reasoningEffort: initialReasoningEffort,
  systemPrompt: initialSystemPrompt,
  debtReminderPrompt: initialDebtReminderPrompt,
  targetEnv: initialTargetEnv,
  aiDebtReminderEnabled: initialAiDebtReminderEnabled,
}: Props) {
  const [state, formAction, pending] = useActionState(saveLlmSettings, initialState);
  const [isPendingLocal, startTransition] = useTransition();

  const [currentApiUrl, setCurrentApiUrl] = useState(apiUrl || DEFAULT_LLM_SETTINGS.apiUrl);
  const [currentModel, setCurrentModel] = useState(initialModel || DEFAULT_LLM_SETTINGS.model);
  const [currentPrompt, setCurrentPrompt] = useState(
    initialSystemPrompt || DEFAULT_LLM_SETTINGS.systemPrompt,
  );
  const [currentDebtReminderPrompt, setCurrentDebtReminderPrompt] = useState(
    initialDebtReminderPrompt || DEFAULT_LLM_SETTINGS.debtReminderPrompt,
  );
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  // Models list state
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  // Test model state
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "idle" | "success" | "error";
    message: string;
    latencyMs?: number;
  }>({ status: "idle", message: "" });

  const apiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success" && apiKeyRef.current) {
      apiKeyRef.current.value = "";
      setApiKeyInput("");
    }
  }, [state]);

  function handleFetchModels() {
    setFetchingModels(true);
    setModelsError("");
    startTransition(async () => {
      const result = await fetchLlmModels(currentApiUrl, apiKeyInput);
      setFetchingModels(false);
      if (result.status === "error") {
        setModelsError(result.message || "Không thể lấy danh sách model.");
      } else if (result.models) {
        setModels(result.models);
        if (!result.models.includes(currentModel) && result.models.length > 0) {
          // If luna exists in list, prioritize it
          const lunaModel = result.models.find((m) => m.includes("luna"));
          if (lunaModel) {
            setCurrentModel(lunaModel);
          }
        }
      }
    });
  }

  function handleTestModel() {
    setTestingModel(true);
    setTestResult({ status: "idle", message: "" });
    startTransition(async () => {
      const result = await testLlmModel(currentApiUrl, currentModel, apiKeyInput);
      setTestingModel(false);
      if (result.status === "error") {
        setTestResult({
          status: "error",
          message: result.message || "Test model thất bại.",
        });
      } else {
        setTestResult({
          status: "success",
          message: `Phản hồi: "${result.reply}"`,
          latencyMs: result.latencyMs,
        });
      }
    });
  }

  function resetDefaultPrompt() {
    setCurrentPrompt(DEFAULT_LLM_SETTINGS.systemPrompt);
  }

  function resetDefaultDebtReminderPrompt() {
    setCurrentDebtReminderPrompt(DEFAULT_LLM_SETTINGS.debtReminderPrompt);
  }

  return (
    <form className="settings-integration-form" action={formAction}>
      <div className="settings-integration-head">
        <div>
          <span className="settings-section-label">AI Agent</span>
          <h2>Trợ lý AI (LLM)</h2>
          <p>
            Cấu hình Não AI cho Vũ Quang Bình để tự động trả lời trong nhóm và nhắc nợ thông minh.
          </p>
        </div>
        <label className="settings-toggle">
          <input name="enabled" type="checkbox" defaultChecked={enabled} disabled={pending} />
          <i aria-hidden="true" />
          <span>Bật Trợ lý AI</span>
        </label>
      </div>

      <div className="settings-fields">
        {/* API URL */}
        <label className="settings-field settings-field-wide">
          <span>API Base URL (OpenAI Compatible)</span>
          <input
            name="apiUrl"
            type="url"
            value={currentApiUrl}
            onChange={(e) => setCurrentApiUrl(e.target.value)}
            placeholder="https://raykllx.abc-tunnel.us/v1"
            autoComplete="off"
            disabled={pending}
          />
        </label>

        {/* API Key */}
        <label className="settings-field">
          <span>API Key</span>
          <div className="settings-input-with-action">
            <input
              ref={apiKeyRef}
              name="apiKey"
              type={showApiKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? "Đã cấu hình · để trống nếu không đổi" : "Nhập API Key"}
              autoComplete="new-password"
              disabled={pending}
            />
            <button
              type="button"
              className="input-eye-button"
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? "Ẩn API Key" : "Hiện API Key"}
            >
              {showApiKey ? "👁️" : "🙈"}
            </button>
          </div>
          <small>
            {hasApiKey
              ? "API key hiện tại đã được lưu an toàn trong hệ thống."
              : "Chưa có API key được lưu."}
          </small>
        </label>

        {/* Model Section with Get Models & Test */}
        <div className="settings-field settings-field-wide llm-model-field">
          <span>Model AI</span>
          <div className="llm-model-row">
            {models.length > 0 ? (
              <select
                name="model"
                className="plain-input llm-model-select"
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                disabled={pending}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="model"
                type="text"
                className="plain-input"
                value={currentModel}
                onChange={(e) => setCurrentModel(e.target.value)}
                placeholder="cx/gpt-5.6-luna"
                disabled={pending}
              />
            )}

            <button
              type="button"
              className="secondary-button compact-btn"
              disabled={fetchingModels || pending || isPendingLocal}
              onClick={handleFetchModels}
            >
              {fetchingModels ? <span className="spinner" /> : null}
              {fetchingModels ? "Đang tải..." : "Lấy danh sách Model"}
            </button>

            <button
              type="button"
              className="secondary-button compact-btn"
              disabled={testingModel || pending || isPendingLocal}
              onClick={handleTestModel}
            >
              {testingModel ? <span className="spinner" /> : null}
              {testingModel ? "Đang thử..." : "Test Model"}
            </button>
          </div>

          {modelsError ? <div className="llm-sub-error">! {modelsError}</div> : null}

          {testResult.status !== "idle" && (
            <div
              className={`llm-test-result ${testResult.status === "success" ? "success" : "error"}`}
            >
              <strong>{testResult.status === "success" ? "✓ Test thành công" : "✗ Lỗi test"}</strong>
              {testResult.latencyMs !== undefined ? (
                <span className="latency-badge">{testResult.latencyMs}ms</span>
              ) : null}
              <p>{testResult.message}</p>
            </div>
          )}
        </div>

        {/* Mức độ suy luận (Reasoning Effort) */}
        <label className="settings-field settings-field-wide">
          <span>Mức độ suy luận (Reasoning Effort)</span>
          <select
            name="reasoningEffort"
            className="plain-input"
            defaultValue={initialReasoningEffort || "medium"}
            disabled={pending}
          >
            <option value="none">Tắt (None - Nhanh nhất)</option>
            <option value="low">Thấp (Low - Phản hồi nhanh)</option>
            <option value="medium">Trung bình (Medium - Khuyên dùng)</option>
            <option value="high">Cao (High - Suy nghĩ sâu)</option>
          </select>
          <small>
            Cấu hình độ sâu tư duy ngầm của AI trước khi trả lời. Mức Medium giúp model phân tích và xâu chuỗi sự việc chuẩn xác.
          </small>
        </label>

        {/* Hidden targetEnv preserving environment */}
        <input type="hidden" name="targetEnv" value={initialTargetEnv} />

        {/* AI Debt Reminder Checkbox */}
        <div className="settings-field settings-field-wide">
          <label className="settings-checkbox-card">
            <span className="settings-toggle">
              <input
                name="aiDebtReminderEnabled"
                type="checkbox"
                defaultChecked={initialAiDebtReminderEnabled}
                disabled={pending}
              />
              <i aria-hidden="true" />
            </span>
            <div className="checkbox-card-info">
              <strong>Nhắc nợ thông minh qua AI (Socket + LLM)</strong>
              <p>
                Khi bật, Luna 5.6 sẽ viết lại tin nhắn nhắc nợ dí dỏm kèm tag tên và gửi siêu tốc qua Socket. Khi tắt,
                hệ thống gửi mẫu chuẩn qua API thông thường như hiện tại.
              </p>
            </div>
          </label>
        </div>

        {/* System Prompt */}
        <label className="settings-field settings-field-wide">
          <div className="prompt-label-row">
            <span>System Prompt (Tính cách & Quy tắc của Vũ Quang Bình khi chat)</span>
            <button
              type="button"
              className="prompt-reset-link"
              onClick={resetDefaultPrompt}
              disabled={pending}
            >
              Khôi phục mẫu chuẩn
            </button>
          </div>
          <textarea
            name="systemPrompt"
            className="plain-input prompt-textarea prompt-textarea-system"
            rows={16}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            disabled={pending}
          />
        </label>

        {/* Debt Reminder Prompt */}
        <label className="settings-field settings-field-wide">
          <div className="prompt-label-row">
            <span>Prompt Nhắc nợ thông minh (AI Debt Reminder)</span>
            <button
              type="button"
              className="prompt-reset-link"
              onClick={resetDefaultDebtReminderPrompt}
              disabled={pending}
            >
              Khôi phục mẫu chuẩn
            </button>
          </div>
          <textarea
            name="debtReminderPrompt"
            className="plain-input prompt-textarea"
            rows={6}
            value={currentDebtReminderPrompt}
            onChange={(e) => setCurrentDebtReminderPrompt(e.target.value)}
            disabled={pending}
          />
          <small>
            Sử dụng <code>{'{debtors_list}'}</code> để chỉ định vị trí danh sách con nợ. Bắt buộc giữ định dạng <code>@[Họ và tên]</code> để Facebook nhận diện tag tên.
          </small>
        </label>
      </div>

      <div className="settings-form-footer">
        {state.message ? (
          <div
            className={`settings-form-message ${state.status}`}
            role={state.status === "error" ? "alert" : "status"}
          >
            {state.message}
          </div>
        ) : (
          <span />
        )}
        <button className="primary-button settings-save-button" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Đang lưu..." : "Lưu cấu hình AI"}
        </button>
      </div>
    </form>
  );
}
