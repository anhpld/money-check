"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const navigation = [
  { key: "users", href: "/admin", label: "Người dùng" },
  { key: "collections", href: "/admin/collections", label: "Khoản thu" },
  { key: "transactions", href: "/admin/transactions", label: "Giao dịch" },
  { key: "webhooks", href: "/admin/webhook-logs", label: "Webhook" },
  { key: "settings", href: "/admin/settings", label: "Cài đặt" },
] as const;

export function MobileAdminMenu({ active }: { active: string }) {
  const toggleRef = useRef<HTMLInputElement>(null);
  const currentPage = navigation.find((item) => item.key === active);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && toggleRef.current) toggleRef.current.checked = false;
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (toggleRef.current) toggleRef.current.checked = false;
  }, [active]);

  return (
    <div className="mobile-admin-menu">
      <input ref={toggleRef} className="mobile-menu-state" id="mobile-admin-menu-state" type="checkbox" tabIndex={-1} aria-hidden="true" />
      <header className="mobile-admin-bar">
        <label
          className="mobile-menu-trigger"
          htmlFor="mobile-admin-menu-state"
          role="button"
          tabIndex={0}
          aria-label="Mở menu quản trị"
          aria-controls="mobile-admin-drawer"
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && toggleRef.current) {
              event.preventDefault();
              toggleRef.current.checked = !toggleRef.current.checked;
            }
          }}
        >
          <span aria-hidden="true">☰</span>
        </label>
        <div className="mobile-admin-title"><small>MoneyFlow</small><strong>{currentPage?.label ?? "Quản trị"}</strong></div>
        <span className="mobile-admin-badge">Admin</span>
      </header>

      <div className="mobile-menu-backdrop">
        <aside id="mobile-admin-drawer" className="mobile-menu-drawer" aria-label="Menu quản trị">
          <div className="mobile-menu-heading">
            <div><strong>MoneyFlow</strong><span>Quản trị</span></div>
            <label htmlFor="mobile-admin-menu-state" role="button" tabIndex={0} aria-label="Đóng menu">×</label>
          </div>
          <nav aria-label="Điều hướng quản trị trên điện thoại">
            {navigation.map((item) => (
              <Link className={active === item.key ? "active" : undefined} href={item.href} key={item.key} onClick={() => { if (toggleRef.current) toggleRef.current.checked = false; }}>{item.label}</Link>
            ))}
          </nav>
          <form className="mobile-menu-logout" action="/api/auth/logout" method="post">
            <button type="submit">Đăng xuất</button>
          </form>
        </aside>
        <label className="mobile-menu-dismiss" htmlFor="mobile-admin-menu-state" aria-label="Đóng menu" />
      </div>
    </div>
  );
}
