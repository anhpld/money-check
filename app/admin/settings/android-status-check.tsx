"use client";

import { useActionState } from "react";
import { checkAndroidAppStatus, type AndroidStatusResult } from "@/app/admin/settings/actions";

const initialState: AndroidStatusResult = { status: "idle", message: "Chưa kiểm tra trạng thái." };

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function AndroidStatusCheck() {
  const [state, formAction, pending] = useActionState(checkAndroidAppStatus, initialState);
  const lastSeen = formatDateTime(state.lastSeenAt);
  const checkedAt = formatDateTime(state.checkedAt);

  return (
    <form className="android-status-check" action={formAction}>
      <div className={`android-status-result ${state.status}`} aria-live="polite">
        <i aria-hidden="true" />
        <div>
          <strong>{pending ? "Đang gửi tín hiệu..." : state.message}</strong>
          {!pending && state.status !== "idle" ? (
            <small>
              {state.status === "online" && state.latencyMs !== undefined ? `Phản hồi ${state.latencyMs} ms` : null}
              {state.status === "online" && state.appVersion ? ` · Phiên bản ${state.appVersion}` : null}
              {lastSeen ? ` · Lần cuối ${lastSeen}` : null}
              {checkedAt ? ` · Kiểm tra ${checkedAt}` : null}
            </small>
          ) : null}
        </div>
      </div>
      <button className="primary-button android-status-button" type="submit" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden="true" /> : null}
        {pending ? "Đang kiểm tra..." : "Kiểm tra trạng thái"}
      </button>
    </form>
  );
}
