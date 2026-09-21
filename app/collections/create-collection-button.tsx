"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function CreateCollectionButton({ label = "Tạo khoản thu" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button className="primary-button top-add-button" type="button" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        {label}
      </button>
      {open ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="dialog-card collection-kind-dialog" role="dialog" aria-modal="true" aria-labelledby="collection-kind-title">
            <button className="collection-kind-dialog-close" type="button" aria-label="Đóng" onClick={() => setOpen(false)}>×</button>
            <div className="dialog-heading without-icon">
              <h2 id="collection-kind-title">Bạn muốn tạo khoản thu gì?</h2>
              <p>Chọn loại trước, sau đó nhập thông tin chi tiết.</p>
            </div>
            <div className="collection-kind-options">
              <Link href="/admin/collections/new?kind=MATCH">
                <span className="collection-kind-option-icon match" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7Zm-7.7 4.2 3.2 1.2 1 3.4-2 2.1m13.2-6.7-3.2 1.2-1 3.4 2 2.1M9.7 20l2.3-2 2.3 2" /></svg>
                </span>
                <span><strong>Trận đấu</strong><small>Tính lượt tham gia, bàn thắng và kiến tạo</small></span>
                <b aria-hidden="true">›</b>
              </Link>
              <Link href="/admin/collections/new?kind=GENERAL">
                <span className="collection-kind-option-icon general" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M5 7.5h14v11H5zM8 7.5V5h8v2.5M5 11h14M9 14.5h6" /></svg>
                </span>
                <span><strong>Khoản thu khác</strong><small>Tiền áo, quỹ đội hoặc nội dung tự do</small></span>
                <b aria-hidden="true">›</b>
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
