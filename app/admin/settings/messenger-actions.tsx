"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import {
  sendDebtReminder,
  sendTestMessengerMessage,
  type SendDebtReminderResult,
} from "@/app/admin/settings/actions";

const initialState: SendDebtReminderResult = { status: "idle", message: "" };
const DEFAULT_TEST_CHAT_URL = "https://www.messenger.com/t/954763997032636";

type Props = {
  configured: boolean;
  targetEnv?: "test" | "prod";
  activeChatUrl?: string;
  aiDebtReminderEnabled?: boolean;
};

export function MessengerActions({
  configured,
  targetEnv = "test",
  activeChatUrl = "https://www.messenger.com/t/954763997032636",
  aiDebtReminderEnabled = false,
}: Props) {
  const [testState, testAction, testPending] = useActionState(sendTestMessengerMessage, initialState);
  const [reminderState, reminderAction, reminderPending] = useActionState(sendDebtReminder, initialState);
  const busy = testPending || reminderPending;

  return (
    <div className="settings-messenger-tools">
      {/* Khối Test Sandbox */}
      <div className="settings-tool-card settings-test-card">
        <div className="settings-tool-header">
          <div>
            <span className="settings-section-label">Thử nghiệm gửi tin</span>
            <h3>Gửi tin nhắn test</h3>
            <p>
              Kiểm tra tính năng gửi tin nhắn và gắn thẻ tag <code>@[Tên]</code>. Tin nhắn sẽ tự động gửi vào nhóm theo môi trường đang chọn.
            </p>
          </div>
        </div>

        <form action={testAction} className="settings-test-form">
          <input type="hidden" name="chatUrl" value={activeChatUrl} />

          <div className="settings-test-fields">
            <div className="settings-field">
              <span>Đích đến hiện tại:</span>
              <div className="settings-active-env-box">
                <span className={`env-pill ${targetEnv}`}>
                  {targetEnv === "prod" ? "🚀 Chính thức (Prod)" : "🧪 Thử nghiệm (Test)"}
                </span>
                <code className="active-url-code">{activeChatUrl}</code>
              </div>
            </div>

            <label className="settings-field">
              <span>Nội dung tin nhắn test</span>
              <textarea
                name="message"
                className="settings-test-textarea"
                defaultValue="Test bot: nhắc bạn @[Đức Anh] vào sân nhé!"
                placeholder="Nhập nội dung tin nhắn... Dùng @[Tên] để thử tag thành viên"
                rows={3}
                disabled={busy || !configured}
              />
              <small>Hỗ trợ cú pháp <code>@[Tên thành viên]</code> để tự động tìm và gắn thẻ tag xanh.</small>
            </label>
          </div>

          <div className="settings-tool-footer">
            <button
              className="secondary-button settings-action-btn"
              type="submit"
              disabled={busy || !configured}
            >
              {testPending ? <span className="spinner" aria-hidden="true" /> : null}
              {testPending ? "Đang gửi test..." : configured ? "Gửi tin nhắn test" : "Chưa bật Messenger"}
            </button>
            {testState.message ? (
              <p
                className={`settings-tool-message ${testState.status}`}
                role={testState.status === "error" ? "alert" : "status"}
              >
                {testState.message}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      {/* Khối Kích hoạt nhắc nợ thủ công */}
      <div className="settings-tool-card settings-manual-reminder-card">
        <div className="settings-tool-header">
          <div>
            <span className="settings-section-label">Thao tác thủ công</span>
            <h3>Gửi nhắc nợ ngay</h3>
            <p>
              Tổng hợp toàn bộ nợ của các thành viên và gửi vào nhóm{" "}
              <strong>{targetEnv === "prod" ? "Chính thức" : "Thử nghiệm"}</strong>.
            </p>
          </div>
        </div>

        <form action={reminderAction} className="settings-manual-reminder-form">
          <div className="settings-test-fields">
            <div className="settings-field">
              <span>Phương thức & Đích gửi:</span>
              <div className="settings-active-env-box">
                <span className={`mode-pill ${aiDebtReminderEnabled ? "ai" : "standard"}`}>
                  {aiDebtReminderEnabled ? "⚡ Socket + LLM Luna 5.6" : "📋 Mẫu chuẩn (Playwright)"}
                </span>
                <code className="active-url-code">{activeChatUrl}</code>
              </div>
            </div>
          </div>

          <div className="settings-tool-footer">
            <button
              className="primary-button settings-action-btn"
              type="submit"
              disabled={busy || !configured}
            >
              {reminderPending ? <span className="spinner" aria-hidden="true" /> : null}
              {reminderPending ? "Đang gửi nhắc nợ..." : configured ? "Gửi nhắc nợ ngay" : "Chưa bật Messenger"}
            </button>
            {reminderState.message ? (
              <p
                className={`settings-tool-message ${reminderState.status}`}
                role={reminderState.status === "error" ? "alert" : "status"}
              >
                {reminderState.message}
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
