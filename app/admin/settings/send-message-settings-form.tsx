"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveSendMessageSettings, type SaveSendMessageSettingsResult } from "@/app/admin/settings/actions";

type Props = {
  enabled: boolean;
  apiUrl: string;
  prodChatUrl: string;
  testChatUrl: string;
  targetEnv: "test" | "prod";
  hasApiKey: boolean;
};

const initialState: SaveSendMessageSettingsResult = { status: "idle", message: "" };

export function SendMessageSettingsForm({
  enabled,
  apiUrl,
  prodChatUrl,
  testChatUrl,
  targetEnv,
  hasApiKey,
}: Props) {
  const [state, formAction, pending] = useActionState(saveSendMessageSettings, initialState);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success" && apiKeyRef.current) apiKeyRef.current.value = "";
  }, [state]);

  return (
    <form className="settings-integration-form" action={formAction}>
      <div className="settings-integration-head">
        <div>
          <span className="settings-section-label">Tích hợp & Điều hướng</span>
          <h2>Cấu hình Nhóm Messenger & Môi trường</h2>
          <p>Tập trung quản lý URL nhóm Thử nghiệm, nhóm Chính thức và chuyển đổi môi trường hoạt động.</p>
        </div>
        <label className="settings-toggle">
          <input name="enabled" type="checkbox" defaultChecked={enabled} disabled={pending} />
          <i aria-hidden="true" />
          <span>Bật Messenger</span>
        </label>
      </div>

      <div className="settings-fields">
        {/* Môi trường hoạt động chung */}
        <div className="settings-field settings-field-wide">
          <span>Môi trường hoạt động hiện tại</span>
          <div className="llm-env-selector">
            <label className="env-radio-card">
              <input
                type="radio"
                name="targetEnv"
                value="test"
                defaultChecked={targetEnv !== "prod"}
                disabled={pending}
              />
              <div className="env-radio-content">
                <strong>🧪 Thử nghiệm (Test)</strong>
                <p>Tin nhắn test, nhắc nợ và bot AI chỉ gửi vào Nhóm Test</p>
              </div>
            </label>

            <label className="env-radio-card">
              <input
                type="radio"
                name="targetEnv"
                value="prod"
                defaultChecked={targetEnv === "prod"}
                disabled={pending}
              />
              <div className="env-radio-content">
                <strong>🚀 Chính thức (Prod)</strong>
                <p>Gửi vào nhóm chính của đội bóng (20h45 sân ĐÔNG ĐÔ)</p>
              </div>
            </label>
          </div>
        </div>

        {/* 2 URL Nhóm tập trung một nơi */}
        <label className="settings-field">
          <span>URL nhóm Thử nghiệm (Test)</span>
          <input
            name="testChatUrl"
            type="url"
            defaultValue={testChatUrl}
            placeholder="https://www.messenger.com/t/954763997032636"
            autoComplete="off"
            disabled={pending}
          />
          <small>Nhóm test dùng để thử nghiệm tính năng và bot an toàn.</small>
        </label>

        <label className="settings-field">
          <span>URL nhóm Chính thức (Prod)</span>
          <input
            name="prodChatUrl"
            type="url"
            defaultValue={prodChatUrl}
            placeholder="https://www.messenger.com/t/2245150785540070"
            autoComplete="off"
            disabled={pending}
          />
          <small>Nhóm chính thức toàn thể thành viên đội bóng FC Đông Đô.</small>
        </label>

        {/* Cấu hình kết nối API Playwright */}
        <label className="settings-field">
          <span>API URL (Playwright Messenger)</span>
          <input
            name="apiUrl"
            type="url"
            defaultValue={apiUrl}
            placeholder="http://34.21.166.188:3001/api/messages"
            autoComplete="off"
            disabled={pending}
          />
        </label>

        <label className="settings-field">
          <span>API Key</span>
          <input
            ref={apiKeyRef}
            name="apiKey"
            type="password"
            placeholder={hasApiKey ? "Đã cấu hình · để trống nếu không đổi" : "Nhập API key"}
            autoComplete="new-password"
            disabled={pending}
          />
          <small>{hasApiKey ? "API key hiện tại đang được giữ kín." : "Chưa có API key được lưu."}</small>
        </label>
      </div>

      <div className="settings-form-footer">
        {state.message ? (
          <div className={`settings-form-message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>
            {state.message}
          </div>
        ) : (
          <span />
        )}
        <button className="primary-button settings-save-button" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Đang lưu..." : "Lưu cấu hình Messenger"}
        </button>
      </div>
    </form>
  );
}

