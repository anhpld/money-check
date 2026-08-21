import Link from "next/link";
import type { ReactNode } from "react";

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <div className="client-shell">
      <header className="client-header">
        <Link href="/client" className="client-brand">
          <span aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7.5 18.5c2.2 0 3.2-5 5.5-5 2 0 2.8 7 5.2 7 2.1 0 2.7-4.2 6.3-4.2" /><path d="M22 12.5h3v3" /></svg></span>
          Money<strong>Flow</strong>
        </Link>
        <p>Quỹ bóng đá</p>
      </header>
      {children}
      <footer className="client-footer">MoneyFlow · Thanh toán minh bạch, nhẹ đầu sau mỗi trận.</footer>
    </div>
  );
}
