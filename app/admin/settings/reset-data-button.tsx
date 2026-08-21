"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetApplicationData } from "@/app/admin/settings/actions";

export function ResetDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setConfirmation("");
    setError("");
  }

  function resetData() {
    setError("");
    startTransition(async () => {
      const result = await resetApplicationData(confirmation);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      setOpen(false);
      setConfirmation("");
      router.refresh();
    });
  }

  return (
    <div className="settings-reset-action">
      {message ? <div className="settings-success" role="status">✓ {message}</div> : null}
      <button className="settings-reset-button" type="button" onClick={() => { setMessage(""); setOpen(true); }}>Reset toàn bộ dữ liệu</button>

      {open ? (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="dialog-card settings-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-data-title">
            <div className="settings-reset-icon" aria-hidden="true">!</div>
            <div className="settings-reset-heading">
              <h2 id="reset-data-title">Xóa toàn bộ dữ liệu?</h2>
              <p>Người dùng, khoản thu và giao dịch sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.</p>
            </div>
            <label className="settings-confirm-field">
              <span>Nhập <strong>RESET</strong> để xác nhận</span>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" autoFocus />
            </label>
            {error ? <div className="editor-error settings-reset-error" role="alert">! {error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={isPending} onClick={closeDialog}>Hủy</button>
              <button className="danger-button settings-confirm-reset" type="button" disabled={isPending || confirmation !== "RESET"} onClick={resetData}>{isPending ? "Đang xóa..." : "Xóa dữ liệu"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
