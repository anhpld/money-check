"use client";

import { usePathname } from "next/navigation";
import { type MouseEvent, type ReactNode, useState } from "react";

export function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const isNavigating = navigationTarget !== null && navigationTarget !== pathname;

  function handleNavigation(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;

    const destination = new URL(target.href, window.location.href);
    const current = new URL(window.location.href);
    if (destination.origin !== current.origin) return;
    if (destination.pathname === current.pathname && destination.search === current.search) return;

    setNavigationTarget(destination.pathname);
  }

  return (
    <div className="client-shell" onClickCapture={handleNavigation} aria-busy={isNavigating}>
      {children}
      {isNavigating ? (
        <div className="client-navigation-loading" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : null}
    </div>
  );
}
