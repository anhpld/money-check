"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetActivityData } from "@/app/admin/settings/actions";

export function ResetActivityDataButton() {
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
      const result = await resetActivityData(confirmation);
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
      <button className="settings-reset-button secondary-reset" type="button" onClick={() => { setMessage(""); setOpen(true); }}>
        Reset, giữ user và setting
      </button>

      {open ? (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="dialog-card settings-reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-activity-title">
            <div className="settings-reset-icon secondary" aria-hidden="true">!</div>
            <div className="settings-reset-heading">
              <h2 id="reset-activity-title">Xóa dữ liệu thu chi?</h2>
              <p>Khoản thu, phân bổ, mã thanh toán, giao dịch và webhook log sẽ bị xóa. User, avatar, trạng thái Active/Inactive và setting được giữ nguyên.</p>
            </div>
            <label className="settings-confirm-field">
              <span>Nhập <strong>RESET</strong> để xác nhận</span>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" autoFocus />
            </label>
            {error ? <div className="editor-error settings-reset-error" role="alert">! {error}</div> : null}
            <div className="dialog-actions">
              <button className="secondary-button" type="button" disabled={isPending} onClick={closeDialog}>Hủy</button>
              <button className="danger-button settings-confirm-reset" type="button" disabled={isPending || confirmation !== "RESET"} onClick={resetData}>
                {isPending ? "Đang xóa..." : "Xóa dữ liệu thu chi"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
