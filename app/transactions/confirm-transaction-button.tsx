"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmTransaction } from "@/app/transactions/actions";
import { formatVnd } from "@/lib/money";

export function ConfirmTransactionButton({ id, expectedAmount, actualAmount }: { id: string; expectedAmount: number; actualAmount: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setError("");
    startTransition(async () => {
      const result = await confirmTransaction(id);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button className="primary-button transaction-confirm-button" type="button" onClick={() => setOpen(true)}>Xác nhận đã thanh toán</button>
      {open ? (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) setOpen(false); }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="confirm-transaction-title">
            <div className="dialog-heading without-icon"><h2 id="confirm-transaction-title">Xác nhận giao dịch</h2><p>Thao tác này sẽ chấp nhận giao dịch và đánh dấu các khoản liên quan là đã thanh toán.</p></div>
            <div className="confirm-transaction-money"><span>Cần nhận<strong>{formatVnd(expectedAmount)}</strong></span><span>Thực nhận<strong>{actualAmount === null ? "—" : formatVnd(actualAmount)}</strong></span></div>
            {error ? <div className="editor-error" role="alert">! {error}</div> : null}
            <div className="dialog-actions"><button className="secondary-button" type="button" disabled={isPending} onClick={() => setOpen(false)}>Hủy</button><button className="primary-button dialog-submit" type="button" disabled={isPending} onClick={confirm}>{isPending ? <span className="spinner" /> : null}{isPending ? "Đang xác nhận..." : "Xác nhận"}</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}

