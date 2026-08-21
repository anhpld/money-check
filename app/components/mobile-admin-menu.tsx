"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const navigation = [
  { key: "users", href: "/admin", label: "Người dùng" },
  { key: "collections", href: "/admin/collections", label: "Khoản thu" },
  { key: "transactions", href: "/admin/transactions", label: "Giao dịch" },
  { key: "webhooks", href: "/admin/webhook-logs", label: "Webhook" },
  { key: "settings", href: "/admin/settings", label: "Cài đặt" },
] as const;

export function MobileAdminMenu({ active }: { active: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="mobile-admin-menu">
      <button
        className="mobile-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="mobile-admin-drawer"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">☰</span>
        Menu
      </button>

      {open ? (
        <div className="mobile-menu-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <aside id="mobile-admin-drawer" className="mobile-menu-drawer" role="dialog" aria-modal="true" aria-label="Menu quản trị">
            <div className="mobile-menu-heading">
              <div><strong>MoneyFlow</strong><span>Quản trị</span></div>
              <button type="button" aria-label="Đóng menu" onClick={() => setOpen(false)}>×</button>
            </div>
            <nav aria-label="Điều hướng quản trị trên điện thoại">
              {navigation.map((item) => (
                <Link className={active === item.key ? "active" : undefined} href={item.href} key={item.key} onClick={() => setOpen(false)}>{item.label}</Link>
              ))}
            </nav>
            <form className="mobile-menu-logout" action="/api/auth/logout" method="post">
              <button type="submit">Đăng xuất</button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
