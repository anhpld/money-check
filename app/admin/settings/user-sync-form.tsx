"use client";

import { useActionState, useEffect, useRef } from "react";
import { syncUsersFromJson, type SyncUsersResult } from "@/app/admin/settings/actions";

const initialState: SyncUsersResult = { status: "idle", message: "" };
const exampleJson = `[
  {
    "name": "Vũ Quang Bình",
    "imageUrl": "https://scontent.example.fbcdn.net/avatar.jpg"
  }
]`;

export function UserSyncForm() {
  const [state, formAction, pending] = useActionState(syncUsersFromJson, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.status === "success" && textareaRef.current) textareaRef.current.value = "";
  }, [state]);

  return (
    <form className="settings-user-sync-form" action={formAction}>
      <div className="settings-user-sync-head">
        <div>
          <span className="settings-section-label">Người dùng</span>
          <h2>Đồng bộ dữ liệu người dùng</h2>
          <p>Dán JSON gồm tên và URL ảnh Facebook. Tên đã tồn tại sẽ được cập nhật avatar, không tạo thêm bản ghi trùng.</p>
        </div>
      </div>

      <label className="settings-json-field">
        <span>Danh sách JSON</span>
        <textarea
          ref={textareaRef}
          name="usersJson"
          rows={8}
          placeholder={exampleJson}
          spellCheck={false}
          disabled={pending}
          required
        />
        <small>Tối đa 100 người mỗi lần. URL phải là chuỗi HTTPS thuần thuộc CDN Facebook.</small>
      </label>

      <div className="settings-user-sync-footer">
        <div className="settings-user-sync-result" aria-live="polite">
          {state.message ? <p className={state.status}>{state.message}</p> : null}
          {state.details?.map((detail) => <small key={detail}>{detail}</small>)}
        </div>
        <button className="primary-button settings-user-sync-button" type="submit" disabled={pending}>
          {pending ? <span className="spinner" aria-hidden="true" /> : null}
          {pending ? "Đang đồng bộ..." : "Đồng bộ người dùng"}
        </button>
      </div>
    </form>
  );
}
