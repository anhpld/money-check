"use client";

import { useActionState } from "react";
import {
  sendDebtReminder,
  sendTestMessengerMessage,
  type SendDebtReminderResult,
} from "@/app/admin/settings/actions";

const initialState: SendDebtReminderResult = { status: "idle", message: "" };

export function MessengerActions({ configured }: { configured: boolean }) {
  const [testState, testAction, testPending] = useActionState(sendTestMessengerMessage, initialState);
  const [reminderState, reminderAction, reminderPending] = useActionState(sendDebtReminder, initialState);
  const busy = testPending || reminderPending;

  return (
    <div className="settings-messenger-actions">
      <div className="settings-messenger-actions-head">
        <span className="settings-section-label">Thao tác</span>
        <h3>Kiểm tra và gửi thông báo</h3>
        <p>Gửi thử nội dung “test” hoặc gửi danh sách thành viên đang còn nợ vào group đã cấu hình.</p>
      </div>

      <div className="settings-messenger-action-list">
        <form action={testAction}>
          <button className="secondary-button settings-messenger-action-button" type="submit" disabled={busy || !configured}>
            {testPending ? <span className="spinner" aria-hidden="true" /> : null}
            {testPending ? "Đang gửi..." : configured ? "Test gửi message" : "Chưa bật Messenger"}
          </button>
          {testState.message ? <p className={`settings-messenger-action-message ${testState.status}`} role={testState.status === "error" ? "alert" : "status"}>{testState.message}</p> : null}
        </form>

        <form action={reminderAction}>
          <button className="primary-button settings-messenger-action-button" type="submit" disabled={busy || !configured}>
            {reminderPending ? <span className="spinner" aria-hidden="true" /> : null}
            {reminderPending ? "Đang gửi..." : configured ? "Gửi nhắc nợ" : "Chưa bật Messenger"}
          </button>
          {reminderState.message ? <p className={`settings-messenger-action-message ${reminderState.status}`} role={reminderState.status === "error" ? "alert" : "status"}>{reminderState.message}</p> : null}
        </form>
      </div>
    </div>
  );
}
