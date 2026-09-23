"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import {
  sendDebtReminder,
  sendTestMessengerMessage,
  type SendDebtReminderResult,
} from "@/app/admin/settings/actions";

const initialState: SendDebtReminderResult = { status: "idle", message: "" };
const DEFAULT_TEST_CHAT_URL = "https://www.messenger.com/t/954763997032636";

export function MessengerActions({ configured }: { configured: boolean }) {
  const [testState, testAction, testPending] = useActionState(sendTestMessengerMessage, initialState);
  const [reminderState, reminderAction, reminderPending] = useActionState(sendDebtReminder, initialState);
  const busy = testPending || reminderPending;

  const [testChatUrl, setTestChatUrl] = useState(DEFAULT_TEST_CHAT_URL);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("money_check_test_chat_url");
      if (saved && saved.startsWith("https://www.messenger.com/t/")) {
        setTestChatUrl(saved);
      } else {
        setTestChatUrl(DEFAULT_TEST_CHAT_URL);
        localStorage.setItem("money_check_test_chat_url", DEFAULT_TEST_CHAT_URL);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleChatUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTestChatUrl(val);
    try {
      localStorage.setItem("money_check_test_chat_url", val);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="settings-messenger-tools">
      {/* Khối Test Sandbox */}
      <div className="settings-tool-card settings-test-card">
        <div className="settings-tool-header">
          <div>
            <span className="settings-section-label">Test Sandbox</span>
            <h3>Thử nghiệm gửi tin & Tag tên</h3>
            <p>
              Gửi tin nhắn thử nghiệm tới link chat test để kiểm tra bot và tính năng tag <code>@[Tên]</code>.{" "}
              <strong>Không gửi vào group chính.</strong>
            </p>
          </div>
        </div>

        <form action={testAction} className="settings-test-form">
          <div className="settings-test-fields">
            <label className="settings-field">
              <span>URL đoạn chat test <strong className="settings-required">*</strong></span>
              <input
                name="chatUrl"
                type="url"
                value={testChatUrl}
                onChange={handleChatUrlChange}
                placeholder="https://www.messenger.com/t/..."
                required
                disabled={busy || !configured}
              />
              <small>Nhập link cá nhân hoặc nhóm test (tự động lưu trên trình duyệt).</small>
            </label>

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
            <h3>Gửi nhắc nợ vào Group chính</h3>
            <p>Tổng hợp ngay toàn bộ các khoản nợ của thành viên và gửi thông báo trực tiếp vào URL group chính đã cấu hình ở trên.</p>
          </div>
        </div>

        <form action={reminderAction} className="settings-manual-reminder-form">
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
