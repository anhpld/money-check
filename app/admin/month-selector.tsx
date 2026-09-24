"use client";

import { useRouter } from "next/navigation";
import type { MonthOption } from "@/lib/dashboard";

interface MonthSelectorProps {
  selectedMonth: string;
  availableMonths: MonthOption[];
}

export function MonthSelector({ selectedMonth, availableMonths }: MonthSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "all") {
      router.push("/admin?month=all");
    } else {
      router.push(`/admin?month=${val}`);
    }
  };

  return (
    <div className="month-selector-wrapper">
      <span className="month-selector-icon">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </span>
      <select
        value={selectedMonth}
        onChange={handleChange}
        aria-label="Chọn kỳ xem thống kê"
        className="month-selector-select"
      >
        {availableMonths.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
