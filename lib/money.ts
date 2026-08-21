const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number) {
  return vndFormatter.format(amount);
}

export function formatMoneyInput(amount: number) {
  return amount > 0 ? numberFormatter.format(amount) : "";
}

export function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function allocateBySlots(
  totalAmount: number,
  entries: Array<{ id: string; slots: number }>,
) {
  const totalSlots = entries.reduce((sum, entry) => sum + entry.slots, 0);
  if (!totalSlots || totalAmount <= 0) {
    return Object.fromEntries(entries.map((entry) => [entry.id, 0]));
  }

  const amountPerSlot = roundUpToOneThousand(totalAmount / totalSlots);
  return Object.fromEntries(
    entries.map((entry) => [entry.id, amountPerSlot * entry.slots]),
  );
}

export function roundUpToOneThousand(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount / 1_000) * 1_000;
}
