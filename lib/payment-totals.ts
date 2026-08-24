type PaidOption = { amount: number };
type PaidItem = { options: readonly PaidOption[] };

export function getPaidOptionsTotal(
  manualOptions: readonly PaidOption[],
  paidItems: readonly PaidItem[],
) {
  return manualOptions.reduce((sum, option) => sum + option.amount, 0)
    + paidItems.reduce(
      (sum, item) => sum + item.options.reduce((optionSum, option) => optionSum + option.amount, 0),
      0,
    );
}

export function getTotalPaidAmount(
  footballPaid: number,
  manualOptions: readonly PaidOption[],
  paidItems: readonly PaidItem[],
) {
  return footballPaid + getPaidOptionsTotal(manualOptions, paidItems);
}

export function getOutstandingAmount(
  amountDue: number,
  footballPaid: number,
  manualOptions: readonly PaidOption[],
  paidItems: readonly PaidItem[],
) {
  return Math.max(amountDue - getTotalPaidAmount(footballPaid, manualOptions, paidItems), 0);
}

export function getPaidBreakdownTotal(breakdown: {
  footballAmount: number;
  options: readonly PaidOption[];
}) {
  return breakdown.footballAmount + breakdown.options.reduce((sum, option) => sum + option.amount, 0);
}
