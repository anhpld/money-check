"use client";

import { useActionState } from "react";
import { sendDebtReminder, type SendDebtReminderResult } from "@/app/admin/settings/actions";

const initialState: SendDebtReminderResult = { status: "idle", message: "" };

export function DebtReminderButton({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(sendDebtReminder, initialState);

  return (
    <form className="settings-reminder-action" action={formAction}>
      {state.message ? <p className={`settings-reminder-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
      <button className="primary-button settings-reminder-button" type="submit" disabled={pending || !configured}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? "Đang gửi..." : configured ? "Gửi nhắc nợ" : "Chưa bật Messenger"}
      </button>
    </form>
  );
}
