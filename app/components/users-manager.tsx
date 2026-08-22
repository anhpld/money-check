"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createUser, deleteUser, setUserActive, updateUser, type UserActionResult } from "@/app/actions";
import { UserAvatar } from "@/app/components/user-avatar";

export type UserItem = { id: string; name: string; avatarKey: string | null; isActive: boolean };

type DialogState =
  | { type: "add" }
  | { type: "edit"; user: UserItem }
  | { type: "delete"; user: UserItem }
  | null;

export function UsersManager({ users, databaseError }: { users: UserItem[]; databaseError: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [feedback, setFeedback] = useState<UserActionResult | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) closeDialog();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [dialog, isPending]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function openDialog(nextDialog: Exclude<DialogState, null>) {
    setRemoveAvatar(false);
    setAvatarPreview(nextDialog.type === "edit" && nextDialog.user.avatarKey
      ? `/api/avatars/${encodeURIComponent(nextDialog.user.avatarKey)}`
      : null);
    setDialog(nextDialog);
  }

  function closeDialog() {
    setDialog(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
  }

  function previewAvatar(file: File | undefined) {
    if (!file) return;
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function completeAction(result: UserActionResult) {
    setFeedback(result);
    if (result.status === "success") {
      closeDialog();
      router.refresh();
    }
  }

  function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = dialog?.type === "edit"
        ? await updateUser(formData)
        : await createUser(formData);
      completeAction(result);
    });
  }

  function confirmDelete() {
    if (dialog?.type !== "delete") return;
    startTransition(async () => completeAction(await deleteUser(dialog.user.id)));
  }

  function toggleUserStatus(user: UserItem) {
    startTransition(async () => completeAction(await setUserActive(user.id, !user.isActive)));
  }

  return (
    <>
      <div className="users-toolbar">
        <div className="user-total">
          <span>Tổng người dùng</span>
          <strong>{users.length.toString().padStart(2, "0")}</strong>
        </div>
        <button className="primary-button top-add-button" type="button" onClick={() => openDialog({ type: "add" })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Thêm người dùng
        </button>
      </div>

      {databaseError ? (
        <div className="database-alert" role="alert">
          <span>!</span>
          <div><strong>Chưa kết nối được database</strong><p>Kiểm tra cấu hình database trước khi thao tác.</p></div>
        </div>
      ) : null}

      <article className="panel users-panel">
        <div className="list-header">
          <div><h2>Người dùng</h2><p>{users.length ? `${users.length} người trong danh sách` : "Danh sách hiện đang trống"}</p></div>
          <span className="live-badge"><i /> Dữ liệu trực tiếp</span>
        </div>

        {users.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Người dùng</th><th>Mã ID</th><th>Trạng thái</th><th className="actions-heading">Thao tác</th></tr></thead>
              <tbody>
                {users.map((user, index) => (
                  <tr className={user.isActive ? "" : "user-row-inactive"} key={user.id}>
                    <td><UserAvatar name={user.name} avatarKey={user.avatarKey} className="user-avatar" toneIndex={index} /><strong>{user.name}</strong></td>
                    <td><code>{user.id.slice(0, 8).toUpperCase()}</code></td>
                    <td>
                      <button
                        className={`user-status-toggle ${user.isActive ? "active" : "inactive"}`}
                        type="button"
                        disabled={isPending}
                        aria-label={`Chuyển ${user.name} sang ${user.isActive ? "Inactive" : "Active"}`}
                        onClick={() => toggleUserStatus(user)}
                      >
                        <i aria-hidden="true" />
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="actions-cell">
                      <button className="icon-button edit" type="button" aria-label={`Sửa ${user.name}`} onClick={() => openDialog({ type: "edit", user })}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-1 11-11a2 2 0 0 0-3-3l-11 11L4 20Z" /></svg>
                      </button>
                      <button className="icon-button delete" type="button" aria-label={`Xóa ${user.name}`} onClick={() => openDialog({ type: "delete", user })}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-illustration">
              <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="26" cy="23" r="9" /><path d="M8 51c1-10 7-16 18-16s17 6 18 16M46 18v16M38 26h16" /></svg>
            </span>
            <h3>Chưa có người dùng nào</h3>
            <p>Bấm “Thêm người dùng” để tạo người đầu tiên.</p>
          </div>
        )}
      </article>

      {feedback ? (
        <div className={`toast ${feedback.status}`} role="status">
          <span>{feedback.status === "success" ? "✓" : "!"}</span>{feedback.message}
        </div>
      ) : null}

      {dialog ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isPending) closeDialog();
        }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
            {dialog.type !== "add" ? (
              <div className={`dialog-icon ${dialog.type === "delete" ? "danger" : ""}`}>
                {dialog.type === "delete" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.2-1 11-11a2 2 0 0 0-3-3l-11 11L4 20Z" /></svg>
                )}
              </div>
            ) : null}

            <div className={`dialog-heading ${dialog.type === "add" ? "without-icon" : ""}`}>
              <h2 id="user-dialog-title">
                {dialog.type === "add" ? "Thêm người dùng" : dialog.type === "edit" ? "Sửa người dùng" : "Xóa người dùng?"}
              </h2>
              <p>
                {dialog.type === "delete"
                  ? <>Bạn có chắc muốn xóa <strong>{dialog.user.name}</strong>? Thao tác này không thể hoàn tác.</>
                  : dialog.type === "edit" ? "Cập nhật họ tên và ảnh đại diện của người dùng." : "Nhập họ tên và chọn ảnh đại diện nếu có."}
              </p>
            </div>

            {dialog.type === "delete" ? (
              <div className="dialog-actions">
                <button className="secondary-button" type="button" disabled={isPending} onClick={closeDialog}>Hủy</button>
                <button className="danger-button" type="button" disabled={isPending} onClick={confirmDelete}>
                  {isPending ? <span className="spinner" aria-hidden="true" /> : null}
                  {isPending ? "Đang xóa..." : "Xóa người dùng"}
                </button>
              </div>
            ) : (
              <form className="dialog-form" onSubmit={submitUser}>
                {dialog.type === "edit" ? <input type="hidden" name="id" value={dialog.user.id} /> : null}
                <div className="field-group">
                  <label htmlFor="dialog-name">Họ và tên</label>
                  <div className="input-shell">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" /></svg>
                    <input id="dialog-name" name="name" type="text" minLength={2} maxLength={80} defaultValue={dialog.type === "edit" ? dialog.user.name : ""} placeholder="Ví dụ: Nguyễn Văn An" autoComplete="name" autoFocus required />
                  </div>
                </div>
                <div className="field-group">
                  <label>Ảnh đại diện <span className="optional-label">(không bắt buộc)</span></label>
                  <div className="avatar-upload-field">
                    <span className={`avatar-upload-preview ${avatarPreview ? "has-image" : ""}`}>
                      {avatarPreview ? (
                        <Image src={avatarPreview} alt="Ảnh đại diện xem trước" width={72} height={72} unoptimized />
                      ) : (dialog.type === "edit" ? dialog.user.name : "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="avatar-upload-controls">
                      <label className="avatar-file-button" htmlFor="dialog-avatar">
                        {avatarPreview ? "Chọn ảnh khác" : "Chọn ảnh"}
                      </label>
                      <input
                        className="avatar-file-input"
                        id="dialog-avatar"
                        name="avatar"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => previewAvatar(event.target.files?.[0])}
                      />
                      <small>JPG, PNG hoặc WebP · tối đa 2 MB</small>
                      {dialog.type === "edit" && (dialog.user.avatarKey || avatarPreview || removeAvatar) ? (
                        <label className="avatar-remove-option">
                          <input
                            type="checkbox"
                            name="removeAvatar"
                            value="true"
                            checked={removeAvatar}
                            onChange={(event) => {
                              setRemoveAvatar(event.target.checked);
                              if (event.target.checked) {
                                const fileInput = document.getElementById("dialog-avatar") as HTMLInputElement | null;
                                if (fileInput) fileInput.value = "";
                                setAvatarPreview(null);
                              }
                              else if (dialog.user.avatarKey) setAvatarPreview(`/api/avatars/${encodeURIComponent(dialog.user.avatarKey)}`);
                            }}
                          />
                          Không dùng ảnh đại diện
                        </label>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="dialog-actions">
                  <button className="secondary-button" type="button" disabled={isPending} onClick={closeDialog}>Hủy</button>
                  <button className="primary-button dialog-submit" type="submit" disabled={isPending}>
                    {isPending ? <span className="spinner" aria-hidden="true" /> : null}
                    {isPending ? "Đang lưu..." : dialog.type === "edit" ? "Lưu thay đổi" : "Thêm người dùng"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
