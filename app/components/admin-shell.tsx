import Link from "next/link";
import type { ReactNode } from "react";

type AdminSection = "users" | "collections";

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path d="M7.5 18.5c2.2 0 3.2-5 5.5-5 2 0 2.8 7 5.2 7 2.1 0 2.7-4.2 6.3-4.2" />
        <path d="M22 12.5h3v3" />
      </svg>
    </span>
  );
}

function SidebarIcon({ type }: { type: "grid" | "users" | "wallet" | "swap" | "hook" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13" /><path d="M16 11h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></>,
    swap: <><path d="m7 7-4 4 4 4" /><path d="M3 11h14a4 4 0 0 1 4 4v1" /><path d="m17 17 4-4-4-4" /></>,
    hook: <><path d="M18 8a6 6 0 1 0-7 9.8" /><path d="M14 5h4V1M14 19h4v4" /><path d="M18 5a3 3 0 0 1 3 3v1M18 19a3 3 0 0 0 3-3v-1" /></>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

export function AdminShell({ active, children }: { active: AdminSection; children: ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="MoneyFlow - trang quản trị">
          <BrandMark />
          <span>Money<span>Flow</span></span>
        </Link>

        <nav className="main-nav" aria-label="Điều hướng quản trị">
          <p>QUẢN LÝ</p>
          <a href="#overview"><SidebarIcon type="grid" />Tổng quan</a>
          <Link href="/" className={active === "users" ? "active" : undefined}><SidebarIcon type="users" />Người dùng</Link>
          <Link href="/collections" className={active === "collections" ? "active" : undefined}><SidebarIcon type="wallet" />Khoản thu</Link>
          <a href="#transactions"><SidebarIcon type="swap" />Giao dịch<span className="soon">Sắp có</span></a>
          <p>HỆ THỐNG</p>
          <a href="#webhook"><SidebarIcon type="hook" />Webhook<span className="soon">Sắp có</span></a>
        </nav>

        <div className="sidebar-footer">
          <div className="admin-avatar">AD</div>
          <div><strong>Quản trị viên</strong><span>Admin</span></div>
          <button aria-label="Mở tùy chọn tài khoản">•••</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div className="mobile-brand"><BrandMark /> MoneyFlow</div>
          <div className="topbar-actions">
            <Link className="client-link" href="/client">
              Xem trang người dùng
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </Link>
            <button className="notification" aria-label="Thông báo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              <span />
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
