"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSendMessageSettings, type SaveSendMessageSettingsResult } from "@/app/admin/settings/actions";

type Props = {
  enabled: boolean;
  apiUrl: string;
  chatUrl: string;
  hasApiKey: boolean;
};

const initialState: SaveSendMessageSettingsResult = { status: "idle", message: "" };

export function SendMessageSettingsForm({ enabled, apiUrl, chatUrl, hasApiKey }: Props) {
  const [state, formAction, pending] = useActionState(saveSendMessageSettings, initialState);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success" && apiKeyRef.current) apiKeyRef.current.value = "";
  }, [state]);

  return (
    <form className="settings-integration-form" action={formAction}>
      <div className="settings-integration-head">
        <div>
          <span className="settings-section-label">Tích hợp</span>
          <h2>Gửi thông báo Messenger</h2>
          <p>Cấu hình API và group nhận thông báo sau khi hệ thống ghi nhận thanh toán.</p>
        </div>
        <label className="settings-toggle">
          <input name="enabled" type="checkbox" defaultChecked={enabled} disabled={pending} />
          <i aria-hidden="true" />
          <span>Bật gửi thông báo</span>
        </label>
      </div>

      <div className="settings-fields">
        <label className="settings-field settings-field-wide">
          <span>API URL</span>
          <input name="apiUrl" type="url" defaultValue={apiUrl} placeholder="http://34.21.166.188:3001/api/messages" autoComplete="off" disabled={pending} />
        </label>

        <label className="settings-field">
          <span>API key</span>
          <input ref={apiKeyRef} name="apiKey" type="password" placeholder={hasApiKey ? "Đã cấu hình · để trống nếu không đổi" : "Nhập API key"} autoComplete="new-password" disabled={pending} />
          <small>{hasApiKey ? "API key hiện tại đang được giữ kín." : "Chưa có API key được lưu."}</small>
        </label>

        <label className="settings-field">
          <span>URL group Messenger</span>
          <input name="chatUrl" type="url" defaultValue={chatUrl} placeholder="https://www.messenger.com/t/ID_GROUP" autoComplete="off" disabled={pending} />
        </label>
      </div>

      <div className="settings-form-footer">
        {state.message ? <div className={`settings-form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</div> : <span />}
        <button className="primary-button settings-save-button" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>
    </form>
  );
}

